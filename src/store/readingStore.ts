// src/store/readingStore.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGES IN THIS VERSION:
//
// [FIX 1] 24-HOUR STALENESS REFRESH
// [FIX 2] SCORE STUCK AT AI-GENERATED VALUE
// [FIX 3] SEED RACE CONDITION IN regenerateInLanguage
// [FIX 4] LANGUAGE NOT PERSISTED ACROSS SILENT REFRESHES
// [FIX 5] SUPABASE HIT ON EVERY APP OPEN (EGRESS SPIKE)
// [FIX 6] GOCHARCHART SHOWING STALE TRANSIT PLANETS
// [FIX 7] daily_score_base COMING FROM AI (HALLUCINATED/STATIC)
//
// [FIX 8] LIVE PLANETARY MATH REFRESH (no AI, no storage writes)
//   Two mechanisms keep score + gochar fresh between full AI regenerations:
//   A) AppState listener — fires refreshAstroOnly() when app becomes 'active',
//      but only if 30+ minutes have passed since last astro refresh.
//   B) setInterval — fires refreshAstroOnly() every 2 hours while app is open.
//   refreshAstroOnly() recalculates: computeDailyScoreV2, detectSadeSati,
//   detectJupiterTransitStatus, computeCurrentGochar — then patches chartData
//   and dailyScore in-memory. Zero AI calls, zero AsyncStorage writes.
//
// [FIX 9] 7 AM DAILY RESET TRIGGER
//   shouldRefreshAt7AM() detects when the app opens after 7 AM on a new day
//   and the last full refresh was before today's 7 AM — triggers silentRefresh.
// ═══════════════════════════════════════════════════════════════════════════════

import { AppState, AppStateStatus } from 'react-native'
import { create } from 'zustand'
import {
  calculateChartData,
  getDailyScore,
  computeDailyScoreV2,
  detectSadeSati,
  detectJupiterTransitStatus,
  computeCurrentGochar,
} from '../services/astrologyEngine'
import { generateFullReading, parseReadingJSON, extractReadingSeed } from '../services/nvidiaAI'
import { getCachedReading, saveReading, updateReadingSeed } from '../services/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChartData, ParsedReading, BirthProfile, ReadingSeed, Language } from '../types'

// ─── Local cache keys ─────────────────────────────────────────────────────────
const localReadingKey     = (uid: string) => `@zephyra_reading_v1_${uid}`
const localLastRefreshKey = (uid: string) => `@zephyra_last_refresh_v1_${uid}`

// 24 hours in milliseconds
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

// 30 minutes in milliseconds — minimum gap between astro-only refreshes
const ASTRO_REFRESH_MIN_MS = 30 * 60 * 1000

// 2 hours in milliseconds — interval for background astro polling
const ASTRO_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000

// ─── Compute user age from birth_date ─────────────────────────────────────────
function computeAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

// ─── Is a timestamp older than 24 hours? ─────────────────────────────────────
function isStaleTimestamp(isoString: string | null | undefined): boolean {
  if (!isoString) return true
  return Date.now() - new Date(isoString).getTime() > REFRESH_INTERVAL_MS
}

// ─── Return the most recent of two nullable ISO timestamps ───────────────────
function mostRecentTimestamp(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const ts = [a, b]
    .filter(Boolean)
    .map((t) => ({ t: t!, ms: new Date(t!).getTime() }))
  if (ts.length === 0) return null
  return ts.reduce((best, cur) => (cur.ms > best.ms ? cur : best)).t
}

// ─── [FIX 9] Should we trigger a full silentRefresh at 7 AM today? ───────────
// Returns true if:
//   1) Current time is past 7 AM today
//   2) The last full refresh happened before today's 7 AM
function shouldRefreshAt7AM(lastRefreshTs: string | null | undefined): boolean {
  const now = new Date()
  const sevenAmToday = new Date(now)
  sevenAmToday.setHours(7, 0, 0, 0)

  // Not yet 7 AM today — no trigger
  if (now < sevenAmToday) return false

  // No prior refresh recorded — trigger
  if (!lastRefreshTs) return true

  const lastRefresh = new Date(lastRefreshTs)
  // Last refresh was before today's 7 AM — trigger
  return lastRefresh < sevenAmToday
}

interface ReadingState {
  chartData: ChartData | null
  reading: ParsedReading | null
  readingSeed: ReadingSeed | null
  dailyScore: number
  isLoading: boolean
  isGenerating: boolean
  isRegenerating: boolean
  generationStatus: string
  generationProgress: number
  chaptersDone: number
  hasError: boolean
  parallelOraclesActive: number
  currentLanguageCode: string
  currentLanguage: Language | null
  currentUserId: string | null
  silentlyRefreshing: boolean
  lastRefreshedAt: string | null
  // [FIX 8] Astro polling state
  lastAstroRefreshAt: number | null        // ms timestamp of last refreshAstroOnly() run
  appStateSubscription: any                // AppState listener reference for cleanup

  initialize: (userId: string, birthProfile: BirthProfile) => Promise<void>
  silentRefresh: (userId: string, birthProfile: BirthProfile) => Promise<void>
  regenerateInLanguage: (userId: string, birthProfile: BirthProfile, language: Language) => Promise<void>
  refreshAstroOnly: (birthProfile: BirthProfile) => void
  startAstroPolling: (userId: string, birthProfile: BirthProfile) => void
  reset: () => void
}

// Module-level interval handle so reset() can clear it
let _astroPollingInterval: ReturnType<typeof setInterval> | null = null

export const useReadingStore = create<ReadingState>((set, get) => ({
  chartData: null,
  reading: null,
  readingSeed: null,
  dailyScore: 0,
  isLoading: false,
  isGenerating: false,
  isRegenerating: false,
  generationStatus: '',
  generationProgress: 0,
  chaptersDone: 0,
  hasError: false,
  parallelOraclesActive: 0,
  currentLanguageCode: 'en-US',
  currentLanguage: null,
  currentUserId: null,
  silentlyRefreshing: false,
  lastRefreshedAt: null,
  lastAstroRefreshAt: null,
  appStateSubscription: null,

  // ── [FIX 8] refreshAstroOnly ──────────────────────────────────────────────
  // Pure math recalculation — no AI, no AsyncStorage, no network.
  // Patches chartData.currentTiming and dailyScore in-memory only.
  refreshAstroOnly: (birthProfile: BirthProfile) => {
    const { chartData } = get()
    if (!chartData) return

    try {
      const vedic = chartData.vedic
      const moonRashi = vedic.moonRashi

      const freshScore   = computeDailyScoreV2(vedic)
      const sadeSati     = detectSadeSati(moonRashi)
      const jupiterTs    = detectJupiterTransitStatus(vedic)
      const gochar       = computeCurrentGochar(vedic)

      const updatedTiming = chartData.currentTiming
        ? {
            ...chartData.currentTiming,
            sadeSatiStatus: sadeSati,
            jupiterTransitFavorable: jupiterTs.favorable,
            jupiterHouseFromMoon: jupiterTs.houseFromMoon,
            jupiterHouseFromLagna: jupiterTs.houseFromLagna,
            gochar,
          }
        : chartData.currentTiming

      set({
        chartData: {
          ...chartData,
          currentTiming: updatedTiming,
        },
        dailyScore: freshScore,
        lastAstroRefreshAt: Date.now(),
      })

      console.log('[STORE] refreshAstroOnly: score updated to', freshScore)
    } catch (e) {
      console.warn('[STORE] refreshAstroOnly: failed (non-critical):', e)
    }
  },

  // ── [FIX 8] startAstroPolling ─────────────────────────────────────────────
  // Called once after reading is loaded. Sets up:
  //   1) AppState listener — refreshes on app-foreground if 30+ min elapsed
  //   2) setInterval — refreshes every 2 hours while app is open
  startAstroPolling: (userId: string, birthProfile: BirthProfile) => {
    // Clear any existing subscription and interval before re-registering
    const existing = get().appStateSubscription
    if (existing) {
      try { existing.remove() } catch {}
    }
    if (_astroPollingInterval) {
      clearInterval(_astroPollingInterval)
      _astroPollingInterval = null
    }

    // ── AppState listener ──────────────────────────────────────────────────
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState !== 'active') return

        const state = get()
        if (!state.reading) return
        if (state.silentlyRefreshing) return

        const now = Date.now()
        const lastAstro = state.lastAstroRefreshAt ?? 0
        const elapsed = now - lastAstro

        if (elapsed >= ASTRO_REFRESH_MIN_MS) {
          console.log('[STORE] AppState active — running refreshAstroOnly (elapsed:', Math.round(elapsed / 60000), 'min)')
          get().refreshAstroOnly(birthProfile)
        }

        // [FIX 9] Also check if we need a full 7 AM silentRefresh
        if (shouldRefreshAt7AM(state.lastRefreshedAt) && !state.silentlyRefreshing) {
          console.log('[STORE] AppState active — 7 AM window detected, triggering silentRefresh')
          get().silentRefresh(userId, birthProfile)
        }
      },
    )

    // ── 2-hour interval ────────────────────────────────────────────────────
    _astroPollingInterval = setInterval(() => {
      const state = get()
      if (state.silentlyRefreshing) return
      if (!state.reading) return
      console.log('[STORE] Interval — running refreshAstroOnly (2h tick)')
      get().refreshAstroOnly(birthProfile)
    }, ASTRO_POLL_INTERVAL_MS)

    set({ appStateSubscription: subscription })
    console.log('[STORE] startAstroPolling: AppState listener + 2h interval registered')
  },

  // ── initialize ───────────────────────────────────────────────────────────────
  initialize: async (userId: string, birthProfile: BirthProfile) => {
    console.log('[STORE] initialize() called — userId:', userId)

    if (get().currentUserId && get().currentUserId !== userId) {
      console.log('[STORE] Different user detected — resetting store')
      set({
        chartData: null, reading: null, readingSeed: null, dailyScore: 0,
        currentUserId: null, currentLanguageCode: 'en-US', currentLanguage: null,
        hasError: false, generationStatus: '', generationProgress: 0,
        chaptersDone: 0, silentlyRefreshing: false, lastRefreshedAt: null,
        lastAstroRefreshAt: null,
      })
    }

    if (get().chartData && get().currentUserId === userId) {
      console.log('[STORE] chartData already exists for this user — skipping')
      return
    }

    set({ isLoading: true, hasError: false })

    try {
      // ── Step 1: Calculate chart ────────────────────────────────────────────
      console.log('[STORE] Step 1 — calculating chart data...')
      const chartData = calculateChartData(birthProfile)
      const astrologyScore = getDailyScore(chartData)
      const userAge = computeAge(birthProfile.birth_date)
      console.log('[STORE] Step 1 done — age:', userAge, 'score:', astrologyScore)
      set({ chartData, dailyScore: astrologyScore, currentUserId: userId })

      // ── Antardasha change detection ───────────────────────────────────────
      const currentAntardashaLord = chartData.currentTiming?.currentAntardasha?.lord ?? null
      const storedAntardashaLord = await AsyncStorage.getItem(`@zephyra_antardasha_${userId}`).catch(() => null)
      const antardashaChanged = currentAntardashaLord && storedAntardashaLord
        && currentAntardashaLord !== storedAntardashaLord

      if (currentAntardashaLord) {
        AsyncStorage.setItem(`@zephyra_antardasha_${userId}`, currentAntardashaLord).catch(() => {})
      }

      // ── Step 2: Check LOCAL AsyncStorage first (primary cache) ─────────────
      console.log('[STORE] Step 2 — checking local AsyncStorage first...')
      let localCacheHandled = false
      try {
        const localText      = await AsyncStorage.getItem(localReadingKey(userId))
        const localRefreshTs = await AsyncStorage.getItem(localLastRefreshKey(userId)).catch(() => null)

        if (localText) {
          const parsed = parseReadingJSON(localText)
          if (parsed) {
            const stale = isStaleTimestamp(localRefreshTs)
            const need7amRefresh = shouldRefreshAt7AM(localRefreshTs)
            console.log('[STORE] Local cache found — stale:', stale, '7amTrigger:', need7amRefresh)

            set({
              reading: parsed,
              currentLanguageCode: 'en-US',
              dailyScore: astrologyScore,      // [FIX 7] always math score
              isLoading: false,
              chaptersDone: 5,
              lastRefreshedAt: localRefreshTs,
            })

            if (stale || need7amRefresh) {
              const reason = need7amRefresh ? '7 AM window' : 'stale (>24h)'
              console.log(`[STORE] Scheduling silentRefresh — reason: ${reason}`)
              setTimeout(() => get().silentRefresh(userId, birthProfile), 1000)
            }

            if (antardashaChanged) {
              console.log('[STORE] Antardasha lord changed — forcing silent refresh')
              get().silentRefresh(userId, birthProfile)
            }

            // [FIX 8] Start astro polling now that reading is loaded
            get().startAstroPolling(userId, birthProfile)

            localCacheHandled = true
          } else {
            console.log('[STORE] Local cache unparseable — falling through to Supabase')
          }
        } else {
          console.log('[STORE] No local cache found — falling through to Supabase')
        }
      } catch (localErr) {
        console.warn('[STORE] AsyncStorage read failed:', localErr)
      }

      if (localCacheHandled) return

      // ── Step 2b: Supabase ──────────────────────────────────────────────────
      console.log('[STORE] Step 2b — querying Supabase for cached reading...')
      const { data: existingReading, error: supabaseError } = await getCachedReading(userId)
      console.log('[STORE] Supabase error:', supabaseError?.message || 'none')
      console.log('[STORE] existingReading found:', !!existingReading)

      if (existingReading?.full_reading_text) {
        const parsed = parseReadingJSON(existingReading.full_reading_text)
        console.log('[STORE] parseReadingJSON result:', parsed ? 'VALID' : 'NULL/INVALID')

        if (parsed) {
          await AsyncStorage.setItem(localReadingKey(userId), existingReading.full_reading_text).catch(() => {})

          const localRefreshTs = await AsyncStorage.getItem(localLastRefreshKey(userId)).catch(() => null)
          const supabaseTs = (existingReading as any).updated_at ?? existingReading.created_at ?? null
          const bestTs = mostRecentTimestamp(supabaseTs, localRefreshTs)
          const stale = isStaleTimestamp(bestTs)
          const need7amRefresh = shouldRefreshAt7AM(bestTs)
          console.log('[STORE] bestTs:', bestTs, '| stale:', stale, '| 7amTrigger:', need7amRefresh)

          set({
            reading: parsed,
            readingSeed: existingReading.reading_seed ?? null,
            currentLanguageCode: existingReading.reading_language ?? 'en-US',
            dailyScore: astrologyScore,      // [FIX 7]
            isLoading: false,
            chaptersDone: 5,
            lastRefreshedAt: bestTs,
          })

          if (stale || need7amRefresh) {
            console.log('[STORE] Supabase reading needs refresh — scheduling in 1s...')
            setTimeout(() => get().silentRefresh(userId, birthProfile), 1000)
          }

          if (antardashaChanged) {
            console.log('[STORE] Antardasha lord changed — forcing silent refresh')
            get().silentRefresh(userId, birthProfile)
          }

          // [FIX 8] Start astro polling after Supabase cache load
          get().startAstroPolling(userId, birthProfile)

          return
        }
        console.log('[STORE] Supabase reading invalid — proceeding to generation')
      }

      if (supabaseError || !existingReading) {
        console.log('[STORE] No Supabase reading found — proceeding to generation')
      }

      // ── Step 3: First-time AI generation ──────────────────────────────────
      console.log('[STORE] Step 3 — starting AI generation...')
      set({
        isLoading: false,
        isGenerating: true,
        parallelOraclesActive: 5,
        chaptersDone: 0,
        generationStatus: 'Awakening 5 cosmic oracles simultaneously...',
        generationProgress: 5,
      })

      const parsed = await generateFullReading(
        chartData,
        (status: string, progress: number) => {
          const completedOracles = Math.max(0, Math.round((progress - 12) / 16))
          set({
            generationStatus: status,
            generationProgress: progress,
            chaptersDone: completedOracles,
            parallelOraclesActive: Math.max(0, 5 - completedOracles),
          })
        },
        { age: userAge, seed: null, language: null, mathScore: astrologyScore },
      )

      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()

        await saveReading(userId, {
          full_reading_text: readingJson,
          past_statements: parsed.past_statements,
          western_data: {},
          vedic_data: chartData.vedic,
          chinese_data: {},
          mayan_data: {},
          all_systems_data: {},
          reading_seed: null,
          reading_language: 'en-US',
        }).catch((e) => console.warn('[STORE] Supabase save failed (non-critical):', e))

        if (currentAntardashaLord) {
          await AsyncStorage.setItem(`@zephyra_antardasha_${userId}`, currentAntardashaLord).catch(() => {})
        }

        await AsyncStorage.setItem(localReadingKey(userId), readingJson).catch(() => {})
        await AsyncStorage.setItem(localLastRefreshKey(userId), now).catch(() => {})

        set({
          reading: parsed,
          currentLanguageCode: 'en-US',
          currentLanguage: null,
          dailyScore: astrologyScore,      // [FIX 7]
          isGenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 5,
          generationProgress: 100,
          generationStatus: 'Complete ✦',
          lastRefreshedAt: now,
        })
        console.log('[STORE] Reading ready!')

        // [FIX 8] Start astro polling after first-time generation
        get().startAstroPolling(userId, birthProfile)

        // ── Step 4: Extract seed in background ──────────────────────────────
        extractReadingSeed(parsed, chartData)
          .then(async (seed) => {
            if (seed) {
              set({ readingSeed: seed })
              await updateReadingSeed(userId, seed)
              console.log('[STORE] Seed saved')
            }
          })
          .catch((e) => console.warn('[STORE] Seed extraction failed (non-critical):', e))

      } else {
        set({ isGenerating: false, parallelOraclesActive: 0, chaptersDone: 0, hasError: true })
      }

    } catch (error) {
      console.error('[STORE] CRASH in initialize:', error)
      set({ isLoading: false, isGenerating: false, parallelOraclesActive: 0, chaptersDone: 0, hasError: true })
    }
  },

  // ── [FIX 1] Silent 24-hour background refresh ─────────────────────────────
  silentRefresh: async (userId: string, birthProfile: BirthProfile) => {
    const { chartData, silentlyRefreshing } = get()

    if (!chartData) {
      console.warn('[STORE] silentRefresh: no chartData — aborting')
      return
    }
    if (silentlyRefreshing) {
      console.log('[STORE] silentRefresh: already in progress — skipping')
      return
    }

    console.log('[STORE] silentRefresh: starting background regeneration...')
    set({ silentlyRefreshing: true })

    const userAge = computeAge(birthProfile.birth_date)

    try {
      console.log('[STORE] silentRefresh: recalculating chart data for fresh gochar...')
      const freshChartData = calculateChartData(birthProfile)
      const freshScore = getDailyScore(freshChartData)
      set({ chartData: freshChartData, dailyScore: freshScore })

      // [FIX 3] Guarantee seed exists before generating
      let seed = get().readingSeed
      const currentReading = get().reading
      if (!seed && currentReading) {
        console.log('[STORE] silentRefresh: extracting missing seed inline...')
        seed = await extractReadingSeed(currentReading, freshChartData).catch(() => null)
        if (seed) {
          set({ readingSeed: seed })
          updateReadingSeed(userId, seed).catch(() => {})
          console.log('[STORE] silentRefresh: seed extracted')
        } else {
          console.warn('[STORE] silentRefresh: seed extraction failed — generating without seed')
        }
      }

      const currentLang = get().currentLanguage

      const parsed = await generateFullReading(
        freshChartData,
        () => {},
        { age: userAge, seed, language: currentLang, mathScore: freshScore },
      )

      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()

        set({
          reading: parsed,
          dailyScore: freshScore,          // [FIX 7]
          silentlyRefreshing: false,
          lastRefreshedAt: now,
        })

        await AsyncStorage.setItem(localReadingKey(userId), readingJson).catch(() => {})
        await AsyncStorage.setItem(localLastRefreshKey(userId), now).catch(() => {})

        await saveReading(userId, {
          full_reading_text: readingJson,
          past_statements: parsed.past_statements,
          western_data: {},
          vedic_data: freshChartData.vedic,
          chinese_data: {},
          mayan_data: {},
          all_systems_data: {},
          reading_seed: seed,
          reading_language: get().currentLanguageCode,
        }).catch((e) => console.warn('[STORE] silentRefresh: Supabase save failed (non-critical):', e))

        console.log('[STORE] silentRefresh: complete')
      } else {
        set({ silentlyRefreshing: false })
        console.warn('[STORE] silentRefresh: generation returned null')
      }
    } catch (e) {
      console.error('[STORE] silentRefresh: crash:', e)
      set({ silentlyRefreshing: false })
    }
  },

  // ── Re-generate in a different language ───────────────────────────────────
  regenerateInLanguage: async (userId: string, birthProfile: BirthProfile, language: Language) => {
    const { chartData } = get()
    if (!chartData) {
      console.error('[STORE] Cannot regenerate — no chartData')
      return
    }

    const userAge = computeAge(birthProfile.birth_date)
    const regenScore = getDailyScore(chartData)         // [FIX 7]

    // [FIX 3] Extract seed inline if missing
    let seed = get().readingSeed
    const currentReading = get().reading
    if (!seed && currentReading) {
      console.log('[STORE] regenerateInLanguage: readingSeed null — extracting inline...')
      seed = await extractReadingSeed(currentReading, chartData).catch(() => null)
      if (seed) {
        set({ readingSeed: seed })
        await updateReadingSeed(userId, seed).catch(() => {})
        console.log('[STORE] regenerateInLanguage: seed extracted')
      } else {
        console.warn('[STORE] regenerateInLanguage: seed extraction failed — proceeding without seed')
      }
    }

    console.log('[STORE] regenerateInLanguage — lang:', language.name, 'age:', userAge, 'hasSeed:', !!seed)

    set({
      isRegenerating: true,
      isGenerating: true,
      currentLanguage: language,
      parallelOraclesActive: 5,
      chaptersDone: 0,
      generationStatus: `Generating your reading in ${language.name}...`,
      generationProgress: 5,
    })

    try {
      const parsed = await generateFullReading(
        chartData,
        (status: string, progress: number) => {
          const completedOracles = Math.max(0, Math.round((progress - 12) / 16))
          set({
            generationStatus: status,
            generationProgress: progress,
            chaptersDone: completedOracles,
            parallelOraclesActive: Math.max(0, 5 - completedOracles),
          })
        },
        { age: userAge, seed, language, mathScore: regenScore },
      )

      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()

        set({
          reading: parsed,
          currentLanguageCode: language.code,
          dailyScore: regenScore,          // [FIX 7]
          isGenerating: false,
          isRegenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 5,
          generationProgress: 100,
          generationStatus: 'Complete ✦',
          lastRefreshedAt: now,
        })

        await AsyncStorage.setItem(localReadingKey(userId), readingJson).catch(() => {})
        await AsyncStorage.setItem(localLastRefreshKey(userId), now).catch(() => {})

        await saveReading(userId, {
          full_reading_text: readingJson,
          past_statements: parsed.past_statements,
          western_data: {},
          vedic_data: chartData.vedic,
          chinese_data: {},
          mayan_data: {},
          all_systems_data: {},
          reading_seed: seed,
          reading_language: language.code,
        }).catch((e) => console.warn('[STORE] Supabase save failed (non-critical):', e))

      } else {
        set({ isGenerating: false, isRegenerating: false, parallelOraclesActive: 0, hasError: true })
      }
    } catch (e) {
      console.error('[STORE] regenerateInLanguage crash:', e)
      set({ isGenerating: false, isRegenerating: false, parallelOraclesActive: 0, hasError: true })
    }
  },

  // ── reset ────────────────────────────────────────────────────────────────
  reset: () => {
    console.log('[STORE] reset() called')

    // [FIX 8] Clean up AppState listener and polling interval
    const { appStateSubscription } = get()
    if (appStateSubscription) {
      try { appStateSubscription.remove() } catch {}
    }
    if (_astroPollingInterval) {
      clearInterval(_astroPollingInterval)
      _astroPollingInterval = null
    }

    set({
      chartData: null, reading: null, readingSeed: null, dailyScore: 0,
      isLoading: false, isGenerating: false, isRegenerating: false,
      hasError: false, generationStatus: '', generationProgress: 0,
      chaptersDone: 0, parallelOraclesActive: 0,
      currentLanguageCode: 'en-US', currentLanguage: null, currentUserId: null,
      silentlyRefreshing: false, lastRefreshedAt: null,
      lastAstroRefreshAt: null, appStateSubscription: null,
    })
  },
}))
