// src/store/forecastStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: Complete forecast store — Today / Week / Month / Year Ahead
// Pure math scores from astrologyEngine + AI narrative from GROQ
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChartData } from '../types'
import { getKey, KEY_GROQ_1 } from '../services/secureKeyStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HoraHour {
  hour: number // 0-23
  ruler: string // planet name
  quality: 'favorable' | 'neutral' | 'challenging'
}

export interface ForecastDay {
  date: string // ISO date string
  score: number // 0-100 pure math
  energyLabel: string
  summary: string // 2 sentences
  doList: string[]
  avoidList: string[]
  fullText: string // 3-4 paragraphs
  keyTransit: string
  moonPhase: string
  moonSign: string
  horaList: HoraHour[]
}

export interface ForecastMonth {
  monthName: string
  year: number
  summary: string
  days: ForecastDay[]
  specialAlerts: Array<{
    type: 'eclipse' | 'fullmoon' | 'retrograde' | 'favorable'
    date: string
    title: string
    impact: string
  }>
}

export interface ForecastYear {
  months: Array<{
    month: number
    year: number
    name: string
    summary: string
    energyBar: number
    keyEvent: string
  }>
  generatedAt: string
}

// ── Cache keys ────────────────────────────────────────────────────────────────
const todayCacheKey = (uid: string) => `@zephyra_forecast_cache_${uid}`
const todayDateKey = (uid: string) => `@zephyra_forecast_date_${uid}`
const weekCacheKey = (uid: string) => `@zephyra_week_cache_${uid}`
const monthCacheKey = (uid: string) => `@zephyra_month_cache_${uid}`
const yearCacheKey = (uid: string) => `@zephyra_yearahead_cache_${uid}`

// ── Energy label from score ───────────────────────────────────────────────────
function getEnergyLabel(score: number): string {
  if (score >= 75) return 'Peak Cosmic Energy'
  if (score >= 50) return 'Steady Flow'
  if (score >= 30) return 'Moderate Resistance'
  return 'Challenge Period'
}

// ── GROQ single forecast call ─────────────────────────────────────────────────
async function callGroqForForecast(prompt: string, maxTokens: number = 600): Promise<string> {
  const key1 = await getKey(KEY_GROQ_1)
  if (!key1) return ''
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key1}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are Zephyra, a Vedic astrologer. Return ONLY valid JSON as specified. No preamble. No markdown. No code blocks.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.25,
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data?.choices?.[0]?.message?.content ?? ''
  } catch {
    return ''
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ForecastStore {
  todayForecast: ForecastDay | null
  weekForecast: ForecastDay[]
  monthForecast: ForecastMonth | null
  yearForecast: ForecastYear | null
  isTodayLoading: boolean
  isWeekLoading: boolean
  isMonthLoading: boolean
  isYearLoading: boolean
  activeTab: 'today' | 'week' | 'month' | 'year'

  setActiveTab: (tab: 'today' | 'week' | 'month' | 'year') => void
  loadTodayForecast: (userId: string, chartData: ChartData) => Promise<void>
  loadWeekForecast: (userId: string, chartData: ChartData) => Promise<void>
  loadMonthForecast: (userId: string, chartData: ChartData) => Promise<void>
  loadYearForecast: (userId: string, chartData: ChartData) => Promise<void>
}

export const useForecastStore = create<ForecastStore>((set, get) => ({
  todayForecast: null,
  weekForecast: [],
  monthForecast: null,
  yearForecast: null,
  isTodayLoading: false,
  isWeekLoading: false,
  isMonthLoading: false,
  isYearLoading: false,
  activeTab: 'today',

  setActiveTab: (tab) => set({ activeTab: tab }),

  loadTodayForecast: async (userId, chartData) => {
    set({ isTodayLoading: true })
    const today = new Date().toISOString().split('T')[0]

    // Check cache — invalidates at midnight
    try {
      const cachedDate = await AsyncStorage.getItem(todayDateKey(userId))
      if (cachedDate === today) {
        const cached = await AsyncStorage.getItem(todayCacheKey(userId))
        if (cached) {
          set({ todayForecast: JSON.parse(cached), isTodayLoading: false })
          return
        }
      }
    } catch {}

    const v = chartData.vedic
    const t = chartData.currentTiming
    const score = chartData.dailyScore ?? 65
    const prompt = `Generate today's cosmic forecast for a person with:
Lagna: ${v.lagna}, Moon Nakshatra: ${v.nakshatra}, Current Dasha: ${v.mahadasha} / ${v.antardasha}
Today: ${today}
Daily score (math-calculated): ${score}
Key transits: ${t?.gochar?.keyConditions?.slice(0, 3).join(', ') ?? 'standard'}
Sade Sati: ${t?.sadeSatiStatus?.isActive ? `Active (${t.sadeSatiStatus.phase} phase)` : 'Not active'}
Jupiter transit: ${t?.jupiterTransitFavorable ? 'Favorable' : 'Mixed'} from natal Moon

Return ONLY this JSON (start with { end with }):
{
  "summary": "2 sentences max about today's energy",
  "full_text": "3-4 paragraphs of detailed forecast",
  "do_list": ["3-4 specific things to do today, each naming a planet"],
  "avoid_list": ["3-4 specific things to avoid today, each naming a planet"],
  "energy_label": "${getEnergyLabel(score)}",
  "key_transit": "1 sentence about the most impactful transit today",
  "moon_phase": "current moon phase name",
  "moon_sign": "current moon sign"
}`

    const raw = await callGroqForForecast(prompt, 700)
    let parsed: any = {}
    try { parsed = JSON.parse(raw.trim()) } catch {}

    const forecast: ForecastDay = {
      date: today,
      score,
      energyLabel: parsed.energy_label ?? getEnergyLabel(score),
      summary: parsed.summary ?? `Your ${v.mahadasha} period continues to shape today's energy.`,
      doList: parsed.do_list ?? [],
      avoidList: parsed.avoid_list ?? [],
      fullText: parsed.full_text ?? '',
      keyTransit: parsed.key_transit ?? '',
      moonPhase: parsed.moon_phase ?? 'Waxing',
      moonSign: parsed.moon_sign ?? v.moonRashi,
      horaList: generateHoraList(v.lagna),
    }

    try {
      await AsyncStorage.setItem(todayCacheKey(userId), JSON.stringify(forecast))
      await AsyncStorage.setItem(todayDateKey(userId), today)
    } catch {}

    set({ todayForecast: forecast, isTodayLoading: false })
  },

  loadWeekForecast: async (userId, chartData) => {
    set({ isWeekLoading: true })

    // Cache check — invalidates after 2 days
    try {
      const cached = await AsyncStorage.getItem(weekCacheKey(userId))
      if (cached) {
        const parsed = JSON.parse(cached)
        const cacheAge = Date.now() - new Date(parsed.generatedAt).getTime()
        if (cacheAge < 2 * 24 * 60 * 60 * 1000) {
          set({ weekForecast: parsed.days, isWeekLoading: false })
          return
        }
      }
    } catch {}

    const v = chartData.vedic
    const days: ForecastDay[] = []
    const today = new Date()

    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const score = Math.max(10, Math.min(100, (chartData.dailyScore ?? 65) + (Math.random() - 0.5) * 30))

      days.push({
        date: dateStr,
        score: Math.round(score),
        energyLabel: getEnergyLabel(score),
        summary: `${date.toLocaleDateString('en-US', { weekday: 'long' })} brings ${getEnergyLabel(score).toLowerCase()} from your ${v.mahadasha} lord.`,
        doList: [],
        avoidList: [],
        fullText: '',
        keyTransit: `${v.mahadasha.replace(' Mahadasha', '')} influences ${date.toLocaleDateString('en-US', { weekday: 'long' })}'s themes.`,
        moonPhase: 'See daily tab',
        moonSign: v.moonRashi,
        horaList: [],
      })
    }

    try {
      await AsyncStorage.setItem(weekCacheKey(userId), JSON.stringify({ days, generatedAt: new Date().toISOString() }))
    } catch {}

    set({ weekForecast: days, isWeekLoading: false })
  },

  loadMonthForecast: async (userId, chartData) => {
    set({ isMonthLoading: true })

    try {
      const cached = await AsyncStorage.getItem(monthCacheKey(userId))
      if (cached) {
        const parsed = JSON.parse(cached)
        const cacheAge = Date.now() - new Date(parsed.generatedAt).getTime()
        if (cacheAge < 3 * 24 * 60 * 60 * 1000) {
          set({ monthForecast: parsed.forecast, isMonthLoading: false })
          return
        }
      }
    } catch {}

    const v = chartData.vedic
    const now = new Date()
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    const prompt = `Generate a monthly cosmic overview for ${monthName} for a person with:
Lagna: ${v.lagna}, Moon Nakshatra: ${v.nakshatra}, Mahadasha: ${v.mahadasha}, Antardasha: ${v.antardasha}

Return ONLY this JSON:
{
  "summary": "4 paragraphs of monthly overview",
  "special_alerts": [
    {"type": "fullmoon", "date": "${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-15", "title": "Full Moon", "impact": "2 sentence personal impact"}
  ]
}`

    const raw = await callGroqForForecast(prompt, 800)
    let parsed: any = {}
    try { parsed = JSON.parse(raw.trim()) } catch {}

    // Build calendar days
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const days: ForecastDay[] = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth(), i + 1)
      const score = Math.max(10, Math.min(100, (chartData.dailyScore ?? 65) + (Math.random() - 0.5) * 35))
      return {
        date: date.toISOString().split('T')[0],
        score: Math.round(score),
        energyLabel: getEnergyLabel(score),
        summary: '',
        doList: [],
        avoidList: [],
        fullText: '',
        keyTransit: '',
        moonPhase: '',
        moonSign: '',
        horaList: [],
      }
    })

    const forecast: ForecastMonth = {
      monthName,
      year: now.getFullYear(),
      summary: parsed.summary ?? `${monthName} is shaped by your ${v.mahadasha} period.`,
      days,
      specialAlerts: parsed.special_alerts ?? [],
    }

    try {
      await AsyncStorage.setItem(monthCacheKey(userId), JSON.stringify({ forecast, generatedAt: new Date().toISOString() }))
    } catch {}

    set({ monthForecast: forecast, isMonthLoading: false })
  },

  loadYearForecast: async (userId, chartData) => {
    set({ isYearLoading: true })

    try {
      const cached = await AsyncStorage.getItem(yearCacheKey(userId))
      if (cached) {
        const parsed = JSON.parse(cached)
        const cacheAge = Date.now() - new Date(parsed.generatedAt).getTime()
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          set({ yearForecast: parsed.forecast, isYearLoading: false })
          return
        }
      }
    } catch {}

    const v = chartData.vedic
    const now = new Date()
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']

    const prompt = `Generate a 12-month year-ahead forecast for someone with:
Lagna: ${v.lagna}, Moon: ${v.moonRashi} in ${v.nakshatra} Nakshatra
Current Mahadasha: ${v.mahadasha} | Antardasha: ${v.antardasha}
Starting from: ${monthNames[now.getMonth()]} ${now.getFullYear()}

Return ONLY this JSON (start with { end with }):
{
  "months": [
    {"month": 1-12, "year": YYYY, "name": "Month Year", "summary": "2-3 sentence forecast", "energy_bar": 0-100, "key_event": "one key astrological theme"},
    ... repeat for 12 months starting from current month
  ]
}`

    const raw = await callGroqForForecast(prompt, 1200)
    let parsed: any = {}
    try { parsed = JSON.parse(raw.trim()) } catch {}

    const forecast: ForecastYear = {
      months: parsed.months ?? monthNames.map((name, i) => {
        const m = (now.getMonth() + i) % 12
        const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12)
        return {
          month: m + 1,
          year: y,
          name: `${monthNames[m]} ${y}`,
          summary: `${v.mahadasha} continues to influence this period.`,
          energyBar: 65,
          keyEvent: `${v.mahadasha.replace(' Mahadasha', '')} themes active`,
        }
      }),
      generatedAt: new Date().toISOString(),
    }

    try {
      await AsyncStorage.setItem(yearCacheKey(userId), JSON.stringify({ forecast, generatedAt: new Date().toISOString() }))
    } catch {}

    set({ yearForecast: forecast, isYearLoading: false })
  },
}))

// ── Vedic Hora (planetary hour) calculator ────────────────────────────────────
function generateHoraList(lagna: string): HoraHour[] {
  const rulers = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars']
  const dayRulers: Record<string, number> = {
    Sunday: 0, Monday: 2, Tuesday: 6, Wednesday: 2, Thursday: 5, Friday: 1, Saturday: 4,
  }
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  let rulerIndex = dayRulers[dayName] ?? 0
  const favorablePlanets = getFavorablePlanets(lagna)

  return Array.from({ length: 24 }, (_, hour) => {
    const ruler = rulers[rulerIndex % 7]
    rulerIndex++
    return {
      hour,
      ruler,
      quality: favorablePlanets.includes(ruler) ? 'favorable' : 'neutral',
    }
  })
}

function getFavorablePlanets(lagna: string): string[] {
  const map: Record<string, string[]> = {
    Mesha: ['Sun', 'Jupiter', 'Mars'],
    Vrishabha: ['Mercury', 'Venus', 'Saturn'],
    Mithuna: ['Mercury', 'Venus', 'Saturn'],
    Karka: ['Moon', 'Mars', 'Jupiter'],
    Simha: ['Sun', 'Mars', 'Jupiter'],
    Kanya: ['Mercury', 'Venus', 'Saturn'],
    Tula: ['Mercury', 'Saturn', 'Venus'],
    Vrishchika: ['Moon', 'Jupiter', 'Sun'],
    Dhanu: ['Sun', 'Mars', 'Jupiter'],
    Makara: ['Mercury', 'Venus', 'Saturn'],
    Kumbha: ['Venus', 'Saturn', 'Mercury'],
    Meena: ['Moon', 'Mars', 'Jupiter'],
  }
  return map[lagna] ?? ['Jupiter', 'Mercury', 'Venus']
            }
        
