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
  hasError: boolean
  parallelOraclesActive: number   // how many of the 5 oracles are still running

  initialize: (userId: string, birthProfile: BirthProfile) => Promise<void>
  reset: () => void
}

export const useReadingStore = create<ReadingState>((set, get) => ({
  chartData: null,
  reading: null,
  dailyScore: 72,
  isLoading: false,
  isGenerating: false,
  generationStatus: '',
  generationProgress: 0,
  hasError: false,
  parallelOraclesActive: 0,

  initialize: async (userId: string, birthProfile: BirthProfile) => {
    if (get().chartData) return // Already loaded
    set({ isLoading: true, hasError: false })

    try {
      // 1. Calculate chart data from birth profile
      const chartData = calculateChartData(birthProfile)
      const dailyScore = getDailyScore(chartData)
      set({ chartData, dailyScore })

      // 2. Check for existing reading in Supabase
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
          set({ reading: parsed, isLoading: false })
          return
        }
      }

      // 3. No existing reading — fire all 5 parallel oracles simultaneously
      set({
        isLoading: false,
        isGenerating: true,
        parallelOraclesActive: 5,
        generationStatus: 'Awakening 5 cosmic oracles simultaneously...',
        generationProgress: 5,
      })

      const parsed = await generateFullReading(
        chartData,
        (status, progress) => {
          // Count completions from progress increments (each chunk = +16 progress after 12)
          const oraclesRemaining = Math.max(0, Math.ceil((92 - progress) / 16))
          set({
            generationStatus: status,
            generationProgress: progress,
            parallelOraclesActive: oraclesRemaining,
          })
        }
      )

      if (parsed) {
        // Save complete merged reading to Supabase
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
          isGenerating: false,
          parallelOraclesActive: 0,
          generationProgress: 100,
        })
      } else {
        set({ isGenerating: false, parallelOraclesActive: 0, hasError: true })
      }
    } catch (error) {
      console.error('Reading store error:', error)
      set({ isLoading: false, isGenerating: false, parallelOraclesActive: 0, hasError: true })
    }
  },

  reset: () => set({
    chartData: null,
    reading: null,
    isLoading: false,
    isGenerating: false,
    hasError: false,
    generationStatus: '',
    generationProgress: 0,
    parallelOraclesActive: 0,
  }),
}))
          
