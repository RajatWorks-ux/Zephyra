// src/store/readingStore.ts

import { create } from 'zustand'
import { calculateChartData, getDailyScore } from '../services/astrologyEngine'
import { generateFullReading, parseReadingJSON, extractReadingSeed } from '../services/nvidiaAI'
import { getCachedReading, saveReading, updateReadingSeed } from '../services/supabase'
import type { ChartData, ParsedReading, BirthProfile, ReadingSeed, Language } from '../types'

// ─── Compute user age from birth_date ─────────────────────────────────────────
function computeAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return Math.max(0, age)
}

interface ReadingState {
  chartData: ChartData | null
  reading: ParsedReading | null
  readingSeed: ReadingSeed | null
  dailyScore: number
  isLoading: boolean
  isGenerating: boolean
  isRegenerating: boolean   // true when re-generating for a new language
  generationStatus: string
  generationProgress: number
  chaptersDone: number
  hasError: boolean
  parallelOraclesActive: number
  currentLanguageCode: string  // tracks what language the current reading is in
  currentUserId: string | null  // tracks which user's data is loaded

  initialize: (userId: string, birthProfile: BirthProfile) => Promise<void>
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
  currentUserId: null,

  initialize: async (userId: string, birthProfile: BirthProfile) => {
    console.log('[STORE] initialize() called — userId:', userId)

    // ── If a DIFFERENT user is logging in, wipe the previous user's data ──
    if (get().currentUserId && get().currentUserId !== userId) {
      console.log('[STORE] Different user detected — resetting store')
      set({
        chartData: null,
        reading: null,
        readingSeed: null,
        dailyScore: 0,
        currentUserId: null,
        currentLanguageCode: 'en-US',
        hasError: false,
        generationStatus: '',
        generationProgress: 0,
        chaptersDone: 0,
      })
    }

    if (get().chartData && get().currentUserId === userId) {
      console.log('[STORE] chartData already exists for this user — skipping')
      return
    }

    set({ isLoading: true, hasError: false })

    try {
      // ── Step 1: Calculate chart ────────────────────────────────────────
      console.log('[STORE] Step 1 — calculating chart data...')
      const chartData = calculateChartData(birthProfile)
      const astrologyScore = getDailyScore(chartData)
      const userAge = computeAge(birthProfile.birth_date)
      console.log(`[STORE] Step 1 done — age: ${userAge}, score: ${astrologyScore}`)
      set({ chartData, dailyScore: astrologyScore, currentUserId: userId })

      // ── Step 2: Check Supabase cache ───────────────────────────────────
      console.log('[STORE] Step 2 — checking Supabase for cached reading...')
      const { data: existingReading, error: supabaseError } = await getCachedReading(userId)

      console.log('[STORE] Supabase error:', supabaseError?.message || 'none')
      console.log('[STORE] existingReading found:', !!existingReading)

      if (existingReading?.full_reading_text) {
        console.log('[STORE] Trying to parse cached reading...')
        const parsed = parseReadingJSON(existingReading.full_reading_text)
        console.log('[STORE] parseReadingJSON result:', parsed ? 'VALID' : 'NULL/INVALID')

        if (parsed) {
          console.log('[STORE] Using cached reading — done!')
          set({
            reading: parsed,
            readingSeed: existingReading.reading_seed ?? null,
            currentLanguageCode: existingReading.reading_language ?? 'en-US',
            dailyScore: parsed.daily_score_base ?? astrologyScore,
            isLoading: false,
            chaptersDone: 5,
          })
          return
        } else {
          console.log('[STORE] Cached reading is invalid — will regenerate')
        }
      }

      // ── Step 3: Fire AI oracles ────────────────────────────────────────
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
          console.log(`[STORE] Progress: ${progress}% — ${status}`)
          const completedOracles = Math.max(0, Math.round((progress - 12) / 16))
          const oraclesRemaining = Math.max(0, 5 - completedOracles)
          set({
            generationStatus: status,
            generationProgress: progress,
            chaptersDone: completedOracles,
            parallelOraclesActive: oraclesRemaining,
          })
        },
        {
          age: userAge,
          seed: null, // No seed on first generation
          language: null, // English default
        }
      )

      console.log('[STORE] generateFullReading returned:', parsed ? 'VALID' : 'NULL')

      if (parsed) {
        // Save reading to Supabase
        console.log('[STORE] Saving to Supabase...')
        await saveReading(userId, {
          full_reading_text: JSON.stringify(parsed),
          past_statements: parsed.past_statements,
          western_data: chartData.western,
          vedic_data: chartData.vedic,
          chinese_data: chartData.chinese,
          mayan_data: chartData.mayan,
          all_systems_data: { celtic: chartData.celtic, egyptian: chartData.egyptian },
          reading_seed: null, // Seed extracted asynchronously below
          reading_language: 'en-US',
        })

        set({
          reading: parsed,
          currentLanguageCode: 'en-US',
          dailyScore: parsed.daily_score_base ?? astrologyScore,
          isGenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 5,
          generationProgress: 100,
          generationStatus: 'Complete ✦',
        })
        console.log('[STORE] Reading ready!')

        // ── Step 4: Extract and save seed asynchronously ───────────────
        // This runs in the background so it doesn't slow down the UI.
        console.log('[STORE] Step 4 — extracting reading seed in background...')
        extractReadingSeed(parsed, chartData)
          .then(async (seed) => {
            if (seed) {
              set({ readingSeed: seed })
              await updateReadingSeed(userId, seed)
              console.log('[STORE] Seed saved to Supabase')
            }
          })
          .catch((e) => {
            console.warn('[STORE] Seed extraction failed (non-critical):', e)
          })

      } else {
        console.error('[STORE] Generation returned null — setting hasError')
        set({
          isGenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 0,
          hasError: true,
        })
      }

    } catch (error) {
      console.error('[STORE] CRASH in initialize:', error)
      set({
        isLoading: false,
        isGenerating: false,
        parallelOraclesActive: 0,
        chaptersDone: 0,
        hasError: true,
      })
    }
  },

  // ── Re-generate the reading in a different language ──────────────────────
  regenerateInLanguage: async (userId: string, birthProfile: BirthProfile, language: Language) => {
    const { chartData, readingSeed } = get()
    if (!chartData) {
      console.error('[STORE] Cannot regenerate — no chartData')
      return
    }

    const userAge = computeAge(birthProfile.birth_date)
    console.log(`[STORE] regenerateInLanguage — lang: ${language.name}, age: ${userAge}`)

    set({
      isRegenerating: true,
      isGenerating: true,
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
        {
          age: userAge,
          seed: readingSeed,  // Use existing seed for personality consistency
          language,
        }
      )

      if (parsed) {
        // Save translated reading to Supabase (overwrites with new language)
        await saveReading(userId, {
          full_reading_text: JSON.stringify(parsed),
          past_statements: parsed.past_statements,
          western_data: chartData.western,
          vedic_data: chartData.vedic,
          chinese_data: chartData.chinese,
          mayan_data: chartData.mayan,
          all_systems_data: { celtic: chartData.celtic, egyptian: chartData.egyptian },
          reading_seed: readingSeed,
          reading_language: language.code,
        })

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
        })
      } else {
        set({
          isGenerating: false,
          isRegenerating: false,
          parallelOraclesActive: 0,
          hasError: true,
        })
      }
    } catch (e) {
      console.error('[STORE] regenerateInLanguage crash:', e)
      set({
        isGenerating: false,
        isRegenerating: false,
        parallelOraclesActive: 0,
        hasError: true,
      })
    }
  },

  reset: () => {
    console.log('[STORE] reset() called')
    set({
      chartData: null,
      reading: null,
      readingSeed: null,
      dailyScore: 0,
      isLoading: false,
      isGenerating: false,
      isRegenerating: false,
      hasError: false,
      generationStatus: '',
      generationProgress: 0,
      chaptersDone: 0,
      parallelOraclesActive: 0,
      currentLanguageCode: 'en-US',
      currentUserId: null,
    })
  },
}))
