// src/store/readingStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 FIX: import changed from nvidiaAI → groqAI
// Supabase import kept intentionally (new project, same service)
// ─────────────────────────────────────────────────────────────────────────────
import { AppState, AppStateStatus } from 'react-native'
import { create } from 'zustand'
import {
  calculateChartData, getDailyScore, computeDailyScoreV2,
  detectSadeSati, detectJupiterTransitStatus, computeCurrentGochar,
} from '../services/astrologyEngine'
import { generateFullReading, parseReadingJSON, extractReadingSeed } from '../services/groqAI'
import { getCachedReading, saveReading, updateReadingSeed } from '../services/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useForecastStore } from './forecastStore'
import type { ChartData, ParsedReading, BirthProfile, ReadingSeed, Language } from '../types'

const localReadingKey     = (uid: string) => `@zephyra_reading_v1_${uid}`
const localLastRefreshKey = (uid: string) => `@zephyra_last_refresh_v1_${uid}`
const REFRESH_INTERVAL_MS  = 24 * 60 * 60 * 1000
const ASTRO_REFRESH_MIN_MS = 30 * 60 * 1000
const ASTRO_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000
// If generation has been "running" longer than this when the app returns to
// foreground, treat it as dead rather than waiting indefinitely — the OS
// almost certainly suspended JS execution while backgrounded and the
// in-flight fetch never got the chance to resolve or reject. 12 minutes
// gives the real 10-minute timeout a 2-minute margin before we intervene.
const GENERATION_STUCK_THRESHOLD_MS = 12 * 60 * 1000

function computeAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

function isStaleTimestamp(iso: string | null | undefined): boolean {
  if (!iso) return true
  return Date.now() - new Date(iso).getTime() > REFRESH_INTERVAL_MS
}

function mostRecentTimestamp(a: string | null | undefined, b: string | null | undefined): string | null {
  const ts = [a, b].filter(Boolean).map(t => ({ t: t!, ms: new Date(t!).getTime() }))
  if (!ts.length) return null
  return ts.reduce((best, cur) => cur.ms > best.ms ? cur : best).t
}

function shouldRefreshAt7AM(lastRefreshTs: string | null | undefined): boolean {
  const now = new Date()
  const sevenAm = new Date(now); sevenAm.setHours(7, 0, 0, 0)
  if (now < sevenAm) return false
  if (!lastRefreshTs) return true
  return new Date(lastRefreshTs) < sevenAm
}

// ── Forecast auto-generation kickoff ─────────────────────────────────────────
// Fire-and-forget: the moment a reading is parsed/loaded/refreshed, silently
// (re)generate the Day/Week/Month forecast cache in the background, whether
// or not the Forecast screen has ever been opened. forecastStore internally
// no-ops any stage whose cache is still fresh, so calling this on every
// reading-ready event (cold cache hit, Supabase hit, fresh generation,
// silent refresh) is cheap and safe rather than redundant.
function fireForecastAutoGenerate(userId: string, chartData: ChartData, reading: ParsedReading | null) {
  try {
    useForecastStore.getState().autoGenerateAll(userId, chartData, reading).catch(e =>
      console.warn('[STORE] forecast autoGenerateAll failed:', e)
    )
  } catch (e) {
    console.warn('[STORE] forecast autoGenerateAll threw:', e)
  }
}

interface ReadingState {
  chartData: ChartData | null; reading: ParsedReading | null; readingSeed: ReadingSeed | null
  dailyScore: number; isLoading: boolean; isGenerating: boolean; isRegenerating: boolean
  generationStatus: string; generationProgress: number; chaptersDone: number; hasError: boolean
  parallelOraclesActive: number; currentLanguageCode: string; currentLanguage: Language | null
  currentUserId: string | null; silentlyRefreshing: boolean; lastRefreshedAt: string | null
  lastAstroRefreshAt: number | null; appStateSubscription: any
  // ── Background-resilience tracking for long (~10 min) generation calls ──────
  // generationStartedAt: when the current generation attempt began. Used to
  //   detect "this has been running far longer than it should have" after
  //   the app returns from background — JS execution can be suspended by the
  //   OS while backgrounded (especially on iOS, within seconds; Android is
  //   more lenient but not unlimited), which can silently kill the in-flight
  //   fetch without ever calling back into the .then()/.catch() that would
  //   normally update isGenerating/hasError.
  // wasBackgroundedDuringGeneration: set true if AppState left 'active' while
  //   isGenerating/isRegenerating was true. Used only to decide whether to
  //   show the "this took longer than expected because the app was
  //   backgrounded" message rather than a generic stale-progress message.
  generationStartedAt: number | null
  wasBackgroundedDuringGeneration: boolean
  generationAppStateSubscription: any
  checkGenerationHealthOnForeground: () => void
  startGenerationWatcher: () => void
  stopGenerationWatcher: () => void
  initialize: (userId: string, birthProfile: BirthProfile) => Promise<void>
  silentRefresh: (userId: string, birthProfile: BirthProfile) => Promise<void>
  regenerateInLanguage: (userId: string, birthProfile: BirthProfile, language: Language) => Promise<void>
  refreshAstroOnly: (birthProfile: BirthProfile) => void
  startAstroPolling: (userId: string, birthProfile: BirthProfile) => void
  reset: () => void
}

let _astroPollingInterval: ReturnType<typeof setInterval> | null = null

export const useReadingStore = create<ReadingState>((set, get) => ({
  chartData: null, reading: null, readingSeed: null, dailyScore: 0,
  isLoading: false, isGenerating: false, isRegenerating: false,
  generationStatus: '', generationProgress: 0, chaptersDone: 0, hasError: false,
  parallelOraclesActive: 0, currentLanguageCode: 'en-US', currentLanguage: null,
  currentUserId: null, silentlyRefreshing: false, lastRefreshedAt: null,
  lastAstroRefreshAt: null, appStateSubscription: null,
  generationStartedAt: null, wasBackgroundedDuringGeneration: false,
  generationAppStateSubscription: null,

  refreshAstroOnly: (birthProfile) => {
    const { chartData } = get()
    if (!chartData) return
    try {
      const vedic = chartData.vedic
      const freshScore = computeDailyScoreV2(vedic)
      const sadeSati = detectSadeSati(vedic.moonRashi)
      const jupiterTs = detectJupiterTransitStatus(vedic.lagna, vedic.moonRashi)
      const gochar = computeCurrentGochar(vedic)
      const updatedTiming = chartData.currentTiming ? {
        ...chartData.currentTiming, sadeSatiStatus: sadeSati,
        jupiterTransitFavorable: jupiterTs.isFavorable,
        jupiterHouseFromMoon: jupiterTs.houseFromMoon,
        jupiterHouseFromLagna: jupiterTs.houseFromLagna, gochar,
      } : chartData.currentTiming
      set({ chartData: { ...chartData, currentTiming: updatedTiming }, dailyScore: freshScore, lastAstroRefreshAt: Date.now() })
    } catch (e) { console.warn('[STORE] refreshAstroOnly failed:', e) }
  },

  // ── Background-resilience: detect generation that died silently while the
  //    app was backgrounded, instead of leaving the UI stuck on a progress
  //    bar that will never move again. This does NOT make generation
  //    continue in the background (Expo's managed workflow + iOS's strict
  //    background suspension make that unreliable to promise) — it only
  //    ensures the user gets an honest "this didn't finish, try again"
  //    instead of silence if the OS killed the in-flight call.
  checkGenerationHealthOnForeground: () => {
    const state = get()
    if (!state.isGenerating && !state.isRegenerating) return
    if (!state.generationStartedAt) return
    const elapsed = Date.now() - state.generationStartedAt
    if (elapsed < GENERATION_STUCK_THRESHOLD_MS) return
    if (!state.wasBackgroundedDuringGeneration) return

    console.warn('[STORE] Generation likely killed by backgrounding — elapsed:', Math.round(elapsed / 1000), 's. Surfacing error to user.')
    set({
      isGenerating: false, isRegenerating: false, parallelOraclesActive: 0,
      hasError: true,
      generationStatus: 'Generation paused — the app was backgrounded for too long. Tap to try again.',
      generationStartedAt: null, wasBackgroundedDuringGeneration: false,
    })
  },

  startGenerationWatcher: () => {
    const existing = get().generationAppStateSubscription
    if (existing) { try { existing.remove() } catch {} }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const state = get()
      const generating = state.isGenerating || state.isRegenerating
      if (nextState === 'active') {
        get().checkGenerationHealthOnForeground()
      } else if (generating) {
        // App left the foreground while a 10-minute generation call was in
        // flight. We can't know yet whether the OS will suspend JS — flag it
        // so checkGenerationHealthOnForeground knows to apply the stuck-time
        // check when (if) the app comes back.
        set({ wasBackgroundedDuringGeneration: true })
      }
    })

    set({ generationAppStateSubscription: subscription })
  },

  stopGenerationWatcher: () => {
    const { generationAppStateSubscription } = get()
    if (generationAppStateSubscription) { try { generationAppStateSubscription.remove() } catch {} }
    set({ generationAppStateSubscription: null })
  },

  startAstroPolling: (userId, birthProfile) => {
    const existing = get().appStateSubscription
    if (existing) { try { existing.remove() } catch {} }
    if (_astroPollingInterval) { clearInterval(_astroPollingInterval); _astroPollingInterval = null }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') return
      const state = get()
      if (!state.reading || state.silentlyRefreshing) return
      if (Date.now() - (state.lastAstroRefreshAt ?? 0) >= ASTRO_REFRESH_MIN_MS) {
        get().refreshAstroOnly(birthProfile)
      }
      if (shouldRefreshAt7AM(state.lastRefreshedAt) && !state.silentlyRefreshing) {
        get().silentRefresh(userId, birthProfile)
      }
    })

    _astroPollingInterval = setInterval(() => {
      const state = get()
      if (!state.silentlyRefreshing && state.reading) get().refreshAstroOnly(birthProfile)
    }, ASTRO_POLL_INTERVAL_MS)

    set({ appStateSubscription: subscription })
  },

  initialize: async (userId, birthProfile) => {
    if (get().currentUserId && get().currentUserId !== userId) {
      set({ chartData: null, reading: null, readingSeed: null, dailyScore: 0, currentUserId: null, hasError: false })
    }
    if (get().chartData && get().currentUserId === userId) return

    set({ isLoading: true, hasError: false })
    try {
      if (!birthProfile?.birth_date || !birthProfile?.birth_lat) {
        console.error('[STORE] birthProfile incomplete — aborting initialize')
        set({ isLoading: false, hasError: true })
        return
      }
      const chartData = calculateChartData(birthProfile)
      const astrologyScore = getDailyScore(chartData)
      const userAge = computeAge(birthProfile.birth_date)
      set({ chartData, dailyScore: astrologyScore, currentUserId: userId })

      const currentAntardashaLord = chartData.currentTiming?.currentAntardasha?.lord ?? null
      const storedAntardashaLord = await AsyncStorage.getItem(`@zephyra_antardasha_${userId}`).catch(() => null)
      const antardashaChanged = !!(currentAntardashaLord && storedAntardashaLord && currentAntardashaLord !== storedAntardashaLord)
      if (currentAntardashaLord) AsyncStorage.setItem(`@zephyra_antardasha_${userId}`, currentAntardashaLord).catch(() => {})

      // Local cache
      let localCacheHandled = false
      try {
        const localText = await AsyncStorage.getItem(localReadingKey(userId))
        const localRefreshTs = await AsyncStorage.getItem(localLastRefreshKey(userId)).catch(() => null)
        if (localText) {
          const parsed = parseReadingJSON(localText)
          if (parsed) {
            const stale = isStaleTimestamp(localRefreshTs)
            const need7am = shouldRefreshAt7AM(localRefreshTs)
            set({ reading: parsed, currentLanguageCode: 'en-US', dailyScore: astrologyScore, isLoading: false, chaptersDone: 5, lastRefreshedAt: localRefreshTs })
            if (stale || need7am) setTimeout(() => get().silentRefresh(userId, birthProfile), 1000)
            if (antardashaChanged) get().silentRefresh(userId, birthProfile)
            get().startAstroPolling(userId, birthProfile)
            fireForecastAutoGenerate(userId, chartData, parsed)
            localCacheHandled = true
          }
        }
      } catch (e) { console.warn('[STORE] AsyncStorage read failed:', e) }
      if (localCacheHandled) return

      // Supabase cache
      const { data: existingReading } = await getCachedReading(userId)
      if (existingReading?.full_reading_text) {
        const parsed = parseReadingJSON(existingReading.full_reading_text)
        if (parsed) {
          await AsyncStorage.setItem(localReadingKey(userId), existingReading.full_reading_text).catch(() => {})
          const localRefreshTs = await AsyncStorage.getItem(localLastRefreshKey(userId)).catch(() => null)
          const bestTs = mostRecentTimestamp((existingReading as any).updated_at ?? existingReading.created_at, localRefreshTs)
          set({ reading: parsed, readingSeed: (existingReading.reading_seed && typeof existingReading.reading_seed === 'object') ? existingReading.reading_seed : null, currentLanguageCode: existingReading.reading_language ?? 'en-US', dailyScore: astrologyScore, isLoading: false, chaptersDone: 5, lastRefreshedAt: bestTs })
          if (isStaleTimestamp(bestTs) || shouldRefreshAt7AM(bestTs)) setTimeout(() => get().silentRefresh(userId, birthProfile), 1000)
          if (antardashaChanged) get().silentRefresh(userId, birthProfile)
          get().startAstroPolling(userId, birthProfile)
          fireForecastAutoGenerate(userId, chartData, parsed)
          return
        }
      }

      // First-time generation
      set({ isLoading: false, isGenerating: true, parallelOraclesActive: 5, chaptersDone: 0, generationStatus: 'Awakening 5 cosmic oracles simultaneously...', generationProgress: 5, generationStartedAt: Date.now(), wasBackgroundedDuringGeneration: false })
      get().startGenerationWatcher()
      const parsed = await generateFullReading(chartData,
        (status, progress) => {
          const done = Math.max(0, Math.round((progress - 12) / 16))
          set({ generationStatus: status, generationProgress: progress, chaptersDone: done, parallelOraclesActive: Math.max(0, 5 - done) })
        },
        { age: userAge, seed: null, language: null, mathScore: astrologyScore },
      )

      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()
        await saveReading(userId, { full_reading_text: readingJson, past_statements: parsed.past_statements, western_data: {}, vedic_data: chartData.vedic, chinese_data: {}, mayan_data: {}, all_systems_data: {}, reading_seed: null, reading_language: 'en-US' }).catch(() => {})
        await AsyncStorage.setItem(localReadingKey(userId), readingJson).catch(() => {})
        await AsyncStorage.setItem(localLastRefreshKey(userId), now).catch(() => {})
        set({ reading: parsed, currentLanguageCode: 'en-US', currentLanguage: null, dailyScore: astrologyScore, isGenerating: false, parallelOraclesActive: 0, chaptersDone: 5, generationProgress: 100, generationStatus: 'Complete ✦', lastRefreshedAt: now, generationStartedAt: null, wasBackgroundedDuringGeneration: false })
        get().stopGenerationWatcher()
        get().startAstroPolling(userId, birthProfile)
        fireForecastAutoGenerate(userId, chartData, parsed)
        extractReadingSeed(parsed, chartData).then(async (seed) => {
          if (seed) { set({ readingSeed: seed }); await updateReadingSeed(userId, seed) }
        }).catch(() => {})
      } else {
        set({ isGenerating: false, parallelOraclesActive: 0, chaptersDone: 0, hasError: true, generationStartedAt: null, wasBackgroundedDuringGeneration: false })
        get().stopGenerationWatcher()
      }
    } catch (error) {
      console.error('[STORE] initialize crash:', error)
      set({ isLoading: false, isGenerating: false, parallelOraclesActive: 0, hasError: true, generationStartedAt: null, wasBackgroundedDuringGeneration: false })
      get().stopGenerationWatcher()
    }
  },

  silentRefresh: async (userId, birthProfile) => {
    const { chartData, silentlyRefreshing } = get()
    if (!chartData || silentlyRefreshing) return
    set({ silentlyRefreshing: true })
    const userAge = computeAge(birthProfile.birth_date)
    try {
      const freshChartData = calculateChartData(birthProfile)
      const freshScore = getDailyScore(freshChartData)
      set({ chartData: freshChartData, dailyScore: freshScore })
      let seed = get().readingSeed
      const currentReading = get().reading
      if (!seed && currentReading) {
        seed = await extractReadingSeed(currentReading, freshChartData).catch(() => null)
        if (seed) { set({ readingSeed: seed }); updateReadingSeed(userId, seed).catch(() => {}) }
      }
      const parsed = await generateFullReading(freshChartData, () => {}, { age: userAge, seed, language: get().currentLanguage, mathScore: freshScore })
      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()
        set({ reading: parsed, dailyScore: freshScore, silentlyRefreshing: false, lastRefreshedAt: now })
        await AsyncStorage.setItem(localReadingKey(userId), readingJson).catch(() => {})
        await AsyncStorage.setItem(localLastRefreshKey(userId), now).catch(() => {})
        await saveReading(userId, { full_reading_text: readingJson, past_statements: parsed.past_statements, western_data: {}, vedic_data: freshChartData.vedic, chinese_data: {}, mayan_data: {}, all_systems_data: {}, reading_seed: seed, reading_language: get().currentLanguageCode }).catch(() => {})
        fireForecastAutoGenerate(userId, freshChartData, parsed)
      } else { set({ silentlyRefreshing: false }) }
    } catch (e) { console.error('[STORE] silentRefresh crash:', e); set({ silentlyRefreshing: false }) }
  },

  regenerateInLanguage: async (userId, birthProfile, language) => {
    const { chartData } = get()
    if (!chartData) return
    const userAge = computeAge(birthProfile.birth_date)
    const regenScore = getDailyScore(chartData)
    let seed = get().readingSeed
    const currentReading = get().reading
    if (!seed && currentReading) {
      seed = await extractReadingSeed(currentReading, chartData).catch(() => null)
      if (seed) { set({ readingSeed: seed }); await updateReadingSeed(userId, seed).catch(() => {}) }
    }
    set({ isRegenerating: true, isGenerating: true, currentLanguage: language, parallelOraclesActive: 5, chaptersDone: 0, generationStatus: `Generating your reading in ${language.name}...`, generationProgress: 5, generationStartedAt: Date.now(), wasBackgroundedDuringGeneration: false })
    get().startGenerationWatcher()
    try {
      const parsed = await generateFullReading(chartData,
        (status, progress) => {
          const done = Math.max(0, Math.round((progress - 12) / 16))
          set({ generationStatus: status, generationProgress: progress, chaptersDone: done, parallelOraclesActive: Math.max(0, 5 - done) })
        },
        { age: userAge, seed, language, mathScore: regenScore },
      )
      if (parsed) {
        const readingJson = JSON.stringify(parsed)
        const now = new Date().toISOString()
        set({ reading: parsed, currentLanguageCode: language.code, dailyScore: regenScore, isGenerating: false, isRegenerating: false, parallelOraclesActive: 0, chaptersDone: 5, generationProgress: 100, generationStatus: 'Complete ✦', lastRefreshedAt: now, generationStartedAt: null, wasBackgroundedDuringGeneration: false })
        get().stopGenerationWatcher()
        await AsyncStorage.setItem(localReadingKey(userId), readingJson).catch(() => {})
        await AsyncStorage.setItem(localLastRefreshKey(userId), now).catch(() => {})
        await saveReading(userId, { full_reading_text: readingJson, past_statements: parsed.past_statements, western_data: {}, vedic_data: chartData.vedic, chinese_data: {}, mayan_data: {}, all_systems_data: {}, reading_seed: seed, reading_language: language.code }).catch(() => {})
      } else {
        set({ isGenerating: false, isRegenerating: false, parallelOraclesActive: 0, hasError: true, generationStartedAt: null, wasBackgroundedDuringGeneration: false })
        get().stopGenerationWatcher()
      }
    } catch (e) {
      console.error('[STORE] regenerateInLanguage crash:', e)
      set({ isGenerating: false, isRegenerating: false, parallelOraclesActive: 0, hasError: true, generationStartedAt: null, wasBackgroundedDuringGeneration: false })
      get().stopGenerationWatcher()
    }
  },

  reset: () => {
    const { appStateSubscription, generationAppStateSubscription } = get()
    if (appStateSubscription) { try { appStateSubscription.remove() } catch {} }
    if (generationAppStateSubscription) { try { generationAppStateSubscription.remove() } catch {} }
    if (_astroPollingInterval) { clearInterval(_astroPollingInterval); _astroPollingInterval = null }
    set({ chartData: null, reading: null, readingSeed: null, dailyScore: 0, isLoading: false, isGenerating: false, isRegenerating: false, hasError: false, generationStatus: '', generationProgress: 0, chaptersDone: 0, parallelOraclesActive: 0, currentLanguageCode: 'en-US', currentLanguage: null, currentUserId: null, silentlyRefreshing: false, lastRefreshedAt: null, lastAstroRefreshAt: null, appStateSubscription: null, generationStartedAt: null, wasBackgroundedDuringGeneration: false, generationAppStateSubscription: null })
  },
}))
             
