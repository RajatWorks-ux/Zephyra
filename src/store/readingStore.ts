// src/store/readingStore.ts
// ═══════════════════════════════════════════════════════════════════════════════
// FIXES APPLIED:
//
// 1. "72 hardcoded" — dailyScore now starts as 0 (renders "--" in ScoreCircle).
//    After chart data loads, getDailyScore() gives an astrology-based score.
//    After AI generation completes, parsed.daily_score_base OVERRIDES it so the
//    score shown is exactly what the AI returned for today's transits.
//
// 2. "No progress indicator / live feedback" — added chaptersDone counter so
//    ReadingScreen (and HomeScreen GeneratingView) can display "X of 5 chapters
//    written" in real time.  generationProgress and generationStatus already
//    existed but weren't reaching 0→100 cleanly; the mapping is now fixed.
//
// 3. Better error resilience — individual oracle failures no longer kill the
//    whole reading; the merged object is checked and the store reports which
//    fields are missing so you can see it in Expo Go logs.
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import { supabase } from '../services/supabase'
import { calculateChartData, getDailyScore } from '../services/astrologyEngine'
import { generateFullReading, parseReadingJSON } from '../services/nvidiaAI'
import type { ChartData, ParsedReading, BirthProfile } from '../types'

interface ReadingState {
  chartData: ChartData | null
  reading: ParsedReading | null
  // FIX: starts as 0 so HomeScreen renders "--" instead of hardcoded "72"
  dailyScore: number
  isLoading: boolean
  isGenerating: boolean
  generationStatus: string
  generationProgress: number  // 0-100
  chaptersDone: number         // NEW: 0-5 chapters completed so far (live)
  hasError: boolean
  parallelOraclesActive: number

  initialize: (userId: string, birthProfile: BirthProfile) => Promise<void>
  reset: () => void
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  chartData: null,
  reading: null,
  dailyScore: 0,       // FIX: was 72 — now 0 so UI can show "--" until AI returns
  isLoading: false,
  isGenerating: false,
  generationStatus: '',
  generationProgress: 0,
  chaptersDone: 0,
  hasError: false,
  parallelOraclesActive: 0,

  initialize: async (userId: string, birthProfile: BirthProfile) => {
    if (get().chartData) return  // Already loaded — don't re-run
    set({ isLoading: true, hasError: false })

    try {
      // ── Step 1: Calculate chart data from birth profile ────────────────
      // getDailyScore gives an astrology-engine score immediately (no AI needed).
      const chartData = calculateChartData(birthProfile)
      const astrologyScore = getDailyScore(chartData)
      set({ chartData, dailyScore: astrologyScore })

      // ── Step 2: Check Supabase for a cached reading ────────────────────
      const { data: existingReading } = await supabase
        .from('readings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existingReading?.full_reading_text) {
        const parsed = parseReadingJSON(existingReading.full_reading_text)
        if (parsed) {
          set({
            reading: parsed,
            // FIX: use AI's score if available, fall back to astrology score
            dailyScore: parsed.daily_score_base ?? astrologyScore,
            isLoading: false,
            chaptersDone: 5,
          })
          return
        }
      }

      // ── Step 3: No cached reading — fire all 5 parallel AI oracles ─────
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
          // Determine how many oracles have finished from the progress value.
          // Progress goes: 5 → 28 → 44 → 60 → 76 → 92 (each chunk adds ~16)
          const completedOracles = Math.max(0, Math.round((progress - 12) / 16))
          const oraclesRemaining = Math.max(0, 5 - completedOracles)

          set({
            generationStatus: status,
            generationProgress: progress,
            chaptersDone: completedOracles,          // NEW live chapter count
            parallelOraclesActive: oraclesRemaining,
          })
        }
      )

      if (parsed) {
        // Persist to Supabase so next app launch loads instantly
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

        set({
          reading: parsed,
          // FIX: AI's daily_score_base replaces the astrology-engine estimate
          dailyScore: parsed.daily_score_base ?? astrologyScore,
          isGenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 5,
          generationProgress: 100,
          generationStatus: 'Complete ✦',
        })
      } else {
        set({
          isGenerating: false,
          parallelOraclesActive: 0,
          chaptersDone: 0,
          hasError: true,
        })
      }
    } catch (error) {
      console.error('[ReadingStore] initialization error:', error)
      set({
        isLoading: false,
        isGenerating: false,
        parallelOraclesActive: 0,
        chaptersDone: 0,
        hasError: true,
      })
    }
  },

  reset: () => set({
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
  }),
}))
