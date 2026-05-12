// src/store/readingStore.ts
//
// ═══════════════════════════════════════════════════════════════════════════════
// CHANGES IN THIS VERSION:
//
// [FIX 1] 24-HOUR STALENESS REFRESH
//   Daily data (score, energy summary, caution, peak hours, favours/career_strengths,
//   compatible_signs, natural gifts, power months) was frozen from first-generation day.
//   Now: after loading any cached reading, we compare its saved timestamp against the
//   current time. If > 24 hours old, silentRefresh() runs in the background — the
//   existing reading is shown immediately, then seamlessly replaced when generation
//   completes (~60-90 sec). The user is never blocked.
//
// [FIX 2] SCORE STUCK AT AI-GENERATED VALUE (e.g. 72 forever)
//   Caused by the same staleness issue above. Since daily_score_base is part of
//   the full generation and cached, it never changed. Now it refreshes every 24h.
//
// [FIX 3] SEED RACE CONDITION IN regenerateInLanguage
//   If regenerateInLanguage was called before the async extractReadingSeed had
//   finished saving, readingSeed was null — so personality continuity was silently
//   lost. Fix: if readingSeed is null when a regen starts, extract it inline first.
//
// [FIX 4] LANGUAGE NOT PERSISTED ACROSS SILENT REFRESHES
//   Added currentLanguage: Language | null to store state so silentRefresh
//   can pass the correct language to generateFullReading.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { calculateChartData, getDailyScore } from '../services/astrologyEngine'
import { generateFullReading, parseReadingJSON, extractReadingSeed } from '../services/nvidiaAI'
import { getCachedReading, saveReading, updateReadingSeed } from '../services/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChartData, ParsedReading, BirthProfile, ReadingSeed, Language } from '../types'

// ─── Local cache keys ─────────────────────────────────────────────────────────
const localReadingKey     = (uid: string) => `@zephyra_reading_v1_${uid}`
// [FIX 1] Tracks ISO timestamp of last successful full generation
const localLastRefreshKey = (uid: string) => `@zephyra_last_refresh_v1_${uid}`

// 24 hours in milliseconds
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000

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
  currentLanguage: Language | null        // [FIX 4]
  currentUserId: string | null
  silentlyRefreshing: boolean             // [FIX 1] true while 24h background refresh runs
  lastRefreshedAt: string | null          // [FIX 1] ISO timestamp of last successful generation

  initialize: (userId: string, birthProfile: BirthProfile) => Promise<void>
  silentRefresh: (userId: string, birthProfile: BirthProfile) => Promise<void>
  regenerateInLanguage: (userId: string, birthProfile: BirthProfile, language: Language) => Promise<void>
  reset: () => void
}

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

      // ── Antardasha change detection ───────────────────────────────────────────
      // If the stored antardasha lord differs from today's computed one, force
      // a silent refresh even if less than 24 hours have passed.
      const currentAntardashaLord = chartData.currentTiming?.currentAntardasha?.lord ?? null
      const storedAntardashaLord = await AsyncStorage.getItem(`@zephyra_antardasha_${userId}`).catch(() => null)
      const antardashaChanged = currentAntardashaLord && storedAntardashaLord
        && currentAntardashaLord !== storedAntardashaLord

      if (currentAntardashaLord) {
        AsyncStorage.setItem(`@zephyra_antardasha_${userId}`, currentAntardashaLord).catch(() => {})
      }

      // ── Step 2: Check Supabase cache ─────────────────────────────────────────
      console.log('[STORE] Step 2 — checking Supabase for cached reading...')
      const { data: existingReading, error: supabaseError } = await getCachedReading(userId)
      console.log('[STORE] Supabase error:', supabaseError?.message || 'none')
      console.log('[STORE] existingReading found:', !!existingReading)

      if (existingReading?.full_reading_text) {
        const parsed = parseReadingJSON(existingReading.full_reading_text)
        console.log('[STORE] parseReadingJSON result:', parsed ? 'VALID' : 'NULL/INVALID')

        if (parsed) {
          await AsyncStorage.setItem(localReadingKey(userId), existingReading.full_reading_text).catch(() => {})

          // [FIX 1] Determine best timestamp and check staleness
          const localRefreshTs = await AsyncStorage.getItem(localLastRefreshKey(userId)).catch(() => null)
          const supabaseTs = (existingReading as any).updated_at ?? existingReading.created_at ?? null
          const bestTs = mostRecentTimestamp(supabaseTs, localRefreshTs)
          const stale = isStaleTimestamp(bestTs)
          console.log('[STORE] bestTs:', bestTs, '| stale:', stale)

          set({
            reading: parsed,
            readingSeed: existingReading.reading_seed ?? null,
            currentLanguageCode: existingReading.reading_language ?? 'en-US',
            dailyScore: parsed.daily_score_base ?? astrologyScore,
            isLoading: false,
            chaptersDone: 5,
            lastRefreshedAt: bestTs,
          })

          if (stale) {
            console.log('[STORE] Reading is stale — scheduling silent refresh in 1s...')
            setTimeout(() => get().silentRefresh(userId, birthProfile), 1000)
          }

          // Force refresh if antardasha has changed, regardless of timestamp
          if (antardashaChanged) {
            console.log('[STORE] Antardasha lord changed — forcing silent refresh')
            get().silentRefresh(userId, birthProfile)
          }

          return
        }
        console.log('[STORE] Cached Supabase reading invalid — trying local cache')
      }

      // ── Step 2b: AsyncStorage fallback ──────────────────────────────────────
      if (supabaseError || !existingReading) {
        console.log('[STORE] Supabase unavailable — checking local AsyncStorage...')
        try {
          const localText = await AsyncStorage.getItem(localReadingKey(userId))
          if (localText) {
            const parsed = parseReadingJSON(localText)
            if (parsed) {
              const localRefreshTs = await AsyncStorage.getItem(localLastRefreshKey(userId)).catch(() => null)
              const stale = isStaleTimestamp(localRefreshTs)
              console.log('[STORE] Using local cached reading — stale:', stale)

              set({
                reading: parsed,
                currentLanguageCode: 'en-US',
                dailyScore: parsed.daily_score_base ?? astrologyScore,
                isLoading: false,
                chaptersDone: 5,
                lastRefreshedAt: localRefreshTs,
              })

              if (stale) {
                console.log('[STORE] Local reading is stale — scheduling silent refresh...')
                setTimeout(() => get().silentRefresh(userId, birthProfile), 1000)
              }

              // Force refresh if antardasha has changed, regardless of timestamp
              if (antardashaChanged) {
                console.log('[STORE] Antardasha lord changed — forcing silent refresh')
                get().silentRefresh(userId, birthProfile)
              }

              return
            }
          }
        } catch (localErr) {
          console.warn('[STORE] AsyncStorage read failed:', localErr)
        }
        console.log('[STORE] No local cache found — generating fresh reading')
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
        { age: userAge, seed: null, language: null },
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
        // [FIX 1] Record initial generation timestamp
        await AsyncStorage.setItem(localLastRefreshKey(userId), now).catch(() => {})

        set({
          reading: parsed,
          currentLanguageCode: 'en-US',
          currentLanguage: null,
          dailyScore: parsed.daily_score_base ?? astrologyScore,
          isGenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 5,
          generationProgress: 100,
          generationStatus: 'Complete ✦',
          lastRefreshedAt: now,
        })
        console.log('[STORE] Reading ready!')

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
  // The existing reading is displayed uninterrupted while generation runs.
  // When complete, score + all daily fields + full reading are replaced atomically.
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
      // [FIX 3] Guarantee seed exists before generating
      let seed = get().readingSeed
      const currentReading = get().reading
      if (!seed && currentReading) {
        console.log('[STORE] silentRefresh: extracting missing seed inline...')
        seed = await extractReadingSeed(currentReading, chartData).catch(() => null)
        if (seed) {
          set({ readingSeed: seed })
          updateReadingSeed(userId, seed).catch(() => {})
          console.log('[STORE] silentRefresh: seed extracted')
        } else {
          console.warn('[STORE] silentRefresh: seed extraction failed — generating without seed')
        }
      }

      // [FIX 4] Use the language the user last chose
      const currentLang = get().currentLanguage

      const parsed = await generateFullReading(
        chartData,
        () => {}, // No progress callbacks — fully silent
        { age: userAge, seed, language: currentLang },
      )

      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()

        // Atomically replace all fields that refresh every 24h:
        // daily_score_base, daily_energy_summary, daily_caution, peak_hours,
        // career_strengths (favours), compatible_signs, best_months_*, plus all chapters
        set({
          reading: parsed,
          dailyScore: parsed.daily_score_base ?? get().dailyScore,
          silentlyRefreshing: false,
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
          reading_language: get().currentLanguageCode,
        }).catch((e) => console.warn('[STORE] silentRefresh: Supabase save failed (non-critical):', e))

        console.log('[STORE] silentRefresh: complete — score, caution, peak hours, favours, compatibility all updated')
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

    // [FIX 3] If seed is null (race condition from async extraction), extract it now
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
      currentLanguage: language,    // [FIX 4] persist language object for future silent refreshes
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
        { age: userAge, seed, language },
      )

      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()

        // Update state first regardless of save outcome
        set({
          reading: parsed,
          currentLanguageCode: language.code,
          dailyScore: parsed.daily_score_base ?? get().dailyScore,
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

  reset: () => {
    console.log('[STORE] reset() called')
    set({
      chartData: null, reading: null, readingSeed: null, dailyScore: 0,
      isLoading: false, isGenerating: false, isRegenerating: false,
      hasError: false, generationStatus: '', generationProgress: 0,
      chaptersDone: 0, parallelOraclesActive: 0,
      currentLanguageCode: 'en-US', currentLanguage: null, currentUserId: null,
      silentlyRefreshing: false, lastRefreshedAt: null,
    })
  },
}))
        
