
// src/store/readingStore.ts

import { create } from 'zustand'
import { supabase } from '../services/supabase'
import { calculateChartData, getDailyScore } from '../services/astrologyEngine'
import { generateFullReading, parseReadingJSON } from '../services/nvidiaAI'
import type { ChartData, ParsedReading, BirthProfile } from '../types'

interface ReadingState {
  chartData: ChartData | null
  reading: ParsedReading | null
  dailyScore: number
  isLoading: boolean
  isGenerating: boolean
  generationStatus: string
  generationProgress: number
  chaptersDone: number
  hasError: boolean
  parallelOraclesActive: number

  initialize: (userId: string, birthProfile: BirthProfile) => Promise<void>
  reset: () => void
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  chartData: null,
  reading: null,
  dailyScore: 0,
  isLoading: false,
  isGenerating: false,
  generationStatus: '',
  generationProgress: 0,
  chaptersDone: 0,
  hasError: false,
  parallelOraclesActive: 0,

  initialize: async (userId: string, birthProfile: BirthProfile) => {

    // ── LOG 1: Did initialize even get called? ─────────────────────────
    console.log('[STORE] initialize() called')
    console.log('[STORE] userId:', userId)
    console.log('[STORE] birthProfile:', JSON.stringify(birthProfile))

    // ── LOG 2: chartData guard ─────────────────────────────────────────
    if (get().chartData) {
      console.log('[STORE] chartData already exists — skipping (this is the guard)')
      return
    }

    set({ isLoading: true, hasError: false })
    console.log('[STORE] isLoading set to true')

    try {
      // ── Step 1: Calculate chart ────────────────────────────────────────
      console.log('[STORE] Step 1 — calculating chart data...')
      const chartData = calculateChartData(birthProfile)
      const astrologyScore = getDailyScore(chartData)
      console.log('[STORE] Step 1 done — astrologyScore:', astrologyScore)
      set({ chartData, dailyScore: astrologyScore })

      // ── Step 2: Check Supabase cache ───────────────────────────────────
      console.log('[STORE] Step 2 — checking Supabase for cached reading...')
      const { data: existingReading, error: supabaseError } = await supabase
        .from('readings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      console.log('[STORE] Supabase error:', supabaseError?.message || 'none')
      console.log('[STORE] existingReading found:', !!existingReading)
      console.log('[STORE] has full_reading_text:', !!existingReading?.full_reading_text)

      if (existingReading?.full_reading_text) {
        console.log('[STORE] Trying to parse cached reading...')
        const parsed = parseReadingJSON(existingReading.full_reading_text)
        console.log('[STORE] parseReadingJSON result:', parsed ? 'VALID' : 'NULL/INVALID')

        if (parsed) {
          console.log('[STORE] Using cached reading — done!')
          set({
            reading: parsed,
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

      console.log('[STORE] Calling generateFullReading now...')
      const parsed = await generateFullReading(
        chartData,
        (status: string, progress: number) => {
          console.log(`[STORE] Progress update: ${progress}% — ${status}`)
          const completedOracles = Math.max(0, Math.round((progress - 12) / 16))
          const oraclesRemaining = Math.max(0, 5 - completedOracles)
          set({
            generationStatus: status,
            generationProgress: progress,
            chaptersDone: completedOracles,
            parallelOraclesActive: oraclesRemaining,
          })
        }
      )

      console.log('[STORE] generateFullReading returned:', parsed ? 'VALID READING' : 'NULL')

      if (parsed) {
        console.log('[STORE] Saving to Supabase...')
        await supabase.from('readings').upsert({
          user_id: userId,
          full_reading_text: JSON.stringify(parsed),
          past_statements: parsed.past_statements,
          western_data: chartData.western,
          vedic_data: chartData.vedic,
          chinese_data: chartData.chinese,
          mayan_data: chartData.mayan,
          all_systems_data: { celtic: chartData.celtic, egyptian: chartData.egyptian },
          updated_at: new Date().toISOString(),
        })
        console.log('[STORE] Saved to Supabase successfully!')

        set({
          reading: parsed,
          dailyScore: parsed.daily_score_base ?? astrologyScore,
          isGenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 5,
          generationProgress: 100,
          generationStatus: 'Complete ✦',
        })
        console.log('[STORE] All done! Reading is ready.')
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

  reset: () => {
    console.log('[STORE] reset() called')
    set({
      chartData: null,
      reading: null,
      dailyScore: 0,
      isLoading: false,
      isGenerating: false,
      hasError: false,
      generationStatus: '',
      generationProgress: 0,
      chaptersDone: 0,
      parallelOraclesActive: 0,
    })
  },
}))
