// src/store/forecastStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3: Full Vedic math + GROQ AI for every forecast tab
// Zero Math.random(). All scores computed from real planetary positions.
// Week: 7-day GROQ call with per-day AI narrative
// Month: Vedic math scores per day + AI monthly summary
// Year: 12-month AI forecast with Dasha-aware context
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ChartData } from '../types'
import { getKey, KEY_GROQ_1, KEY_GROQ_2 } from '../services/secureKeyStore'
import { runQueued, fetchGroqWithBackoff } from '../services/groqQueue'
import {
  computeDailyScoreForDate,
  getMoonNakshatraForDate,
  getTransitingPlanetsForDate,
  getKeyAstroEventForDate,
} from '../services/astrologyEngine'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HoraHour {
  hour: number
  ruler: string
  quality: 'favorable' | 'neutral' | 'challenging'
}

export interface ForecastDay {
  date: string
  score: number
  energyLabel: string
  summary: string
  doList: string[]
  avoidList: string[]
  fullText: string
  keyTransit: string
  moonPhase: string
  moonSign: string
  moonNakshatra: string
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
const todayDateKey  = (uid: string) => `@zephyra_forecast_date_${uid}`
const weekCacheKey  = (uid: string) => `@zephyra_week_cache_${uid}`
const monthCacheKey = (uid: string) => `@zephyra_month_cache_${uid}`
const yearCacheKey  = (uid: string) => `@zephyra_yearahead_cache_${uid}`

// ── Energy label from score ───────────────────────────────────────────────────
function getEnergyLabel(score: number): string {
  if (score >= 75) return 'Peak Cosmic Energy'
  if (score >= 55) return 'Steady Flow'
  if (score >= 35) return 'Moderate Resistance'
  return 'Challenge Period'
}

// ── GROQ call with key rotation + retry ─────────────────────────────────────
async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 800,
  retries: number = 2,
): Promise<string> {
  const [key1, key2] = await Promise.all([getKey(KEY_GROQ_1), getKey(KEY_GROQ_2)])
  const keys = [key1, key2].filter(Boolean) as string[]
  if (keys.length === 0) return ''

  for (let attempt = 0; attempt < retries * keys.length; attempt++) {
    const key = keys[attempt % keys.length]
    try {
      const res = await runQueued(key, () => fetchGroqWithBackoff('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.28,
        }),
      }))
      if (res.status === 413) {
        // Almost always a tokens-per-minute limit on this key, not an
        // actually oversized request — fetchGroqWithBackoff already
        // retried with delays internally; move to the next key/attempt.
        console.warn('[Zephyra] 413 (rate limit) on this key — trying again')
        continue
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '8', 10)
        await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 20000)))
        continue
      }
      if (!res.ok) { console.error('[Zephyra] GROQ error:', res.status); continue }
      const data = await res.json()
      const text = data?.choices?.[0]?.message?.content ?? ''
      if (text.length > 20) return text
    } catch (e: any) {
      console.warn('[Zephyra] GROQ attempt failed:', e.message)
      if (attempt < retries * keys.length - 1) {
        await new Promise(r => setTimeout(r, 3000))
      }
    }
  }
  return ''
}

// ── Safe JSON parse ──────────────────────────────────────────────────────────
function safeJSON(raw: string): any {
  try {
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch {
    // Try to extract first JSON object
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return null
  }
}

// ── Vedic Hora (planetary hour) calculator ────────────────────────────────────
function generateHoraList(lagna: string): HoraHour[] {
  const rulers = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars']
  const dayRulers: Record<string, number> = {
    Sunday: 0, Monday: 3, Tuesday: 6, Wednesday: 4, Thursday: 5, Friday: 1, Saturday: 5,
  }
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  let rulerIndex = dayRulers[dayName] ?? 0
  const favorablePlanets = getFavorablePlanets(lagna)
  return Array.from({ length: 24 }, (_, hour) => {
    const ruler = rulers[rulerIndex % 7]
    rulerIndex++
    return { hour, ruler, quality: favorablePlanets.includes(ruler) ? 'favorable' : 'neutral' }
  })
}

function getFavorablePlanets(lagna: string): string[] {
  const map: Record<string, string[]> = {
    Mesha:      ['Sun', 'Jupiter', 'Mars'],
    Vrishabha:  ['Mercury', 'Venus', 'Saturn'],
    Mithuna:    ['Mercury', 'Venus', 'Saturn'],
    Karka:      ['Moon', 'Mars', 'Jupiter'],
    Simha:      ['Sun', 'Mars', 'Jupiter'],
    Kanya:      ['Mercury', 'Venus', 'Saturn'],
    Tula:       ['Mercury', 'Saturn', 'Venus'],
    Vrishchika: ['Moon', 'Jupiter', 'Sun'],
    Dhanu:      ['Sun', 'Mars', 'Jupiter'],
    Makara:     ['Mercury', 'Venus', 'Saturn'],
    Kumbha:     ['Venus', 'Saturn', 'Mercury'],
    Meena:      ['Moon', 'Mars', 'Jupiter'],
  }
  return map[lagna] ?? ['Jupiter', 'Mercury', 'Venus']
}

// ── Minimal chart context to prevent 413 ─────────────────────────────────────
function buildMiniChartContext(chartData: ChartData): string {
  const v = chartData.vedic
  const t = chartData.currentTiming
  const grahas = v.grahas.map(g =>
    `${g.name} in ${g.rashi} H${g.house}${g.isRetrograde ? 'R' : ''}${g.isExalted ? '(Ex)' : g.isDebilitated ? '(Deb)' : ''}`
  ).join(', ')
  return `Lagna: ${v.lagna} | Moon: ${v.moonRashi} in ${v.nakshatra} | Mahadasha: ${v.mahadasha} | Antardasha: ${v.antardasha} | Age: ${t?.userAge ?? '?'} | Sade Sati: ${t?.sadeSatiStatus?.isActive ? 'YES' : 'No'} | Jupiter: H${t?.jupiterHouseFromMoon ?? '?'} from Moon | Grahas: ${grahas} | Yogas: ${v.yogas.slice(0, 3).join(', ') || 'None'}`
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

const SYSTEM_VEDIC = `You are Zephyra, a master Vedic Jyotishi (Vedic astrologer). You speak only in pure Jyotish — sidereal zodiac, Vimshottari Dasha, classical texts (BPHS, Phaladeepika, Saravali). Every statement must name specific planets, houses, nakshatras, or Dasha periods. No generic advice. Return ONLY valid JSON — no markdown, no preamble, no code fences.`

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

  // ── TODAY ───────────────────────────────────────────────────────────────────
  loadTodayForecast: async (userId, chartData) => {
    set({ isTodayLoading: true })
    const today = new Date().toISOString().split('T')[0]

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
    const todayDate = new Date()
    const score = computeDailyScoreForDate(v, todayDate)
    const moonNak = getMoonNakshatraForDate(todayDate)
    const transits = getTransitingPlanetsForDate(v, todayDate)
    const keyEvent = getKeyAstroEventForDate(v, todayDate)
    const transitDesc = transits.slice(0, 4).map(p =>
      `${p.planet} in ${p.rashi} (H${p.house})${p.isRetro ? ' Retrograde' : ''}`
    ).join(', ')

    const chartCtx = buildMiniChartContext(chartData)
    const prompt = `Chart: ${chartCtx}

Today: ${today}
Daily Vedic score (mathematically computed): ${score}/100
Moon today: ${moonNak} Nakshatra
Key transits: ${transitDesc}
Key event: ${keyEvent}
Sade Sati: ${t?.sadeSatiStatus?.isActive ? `YES — ${t.sadeSatiStatus.phase} phase` : 'No'}
Jupiter H${t?.jupiterHouseFromMoon} from natal Moon

Generate today's full Vedic cosmic forecast. Return exactly this JSON:
{
  "summary": "2 sentences on today's energy naming specific planets and houses",
  "full_text": "3 rich paragraphs — each paragraph references specific planets, houses, nakshatras, or Dasha period. No generic lines.",
  "do_list": ["4 specific actions grounded in today's transits, each naming a planet or nakshatra"],
  "avoid_list": ["4 specific things to avoid, each grounded in a specific planetary influence"],
  "key_transit": "1 sentence naming the single most impactful transit today with house number",
  "moon_phase": "current moon phase name in Vedic tradition (Shukla/Krishna Paksha tithi)",
  "moon_sign": "current transiting Moon rashi in Sanskrit"
}`

    const raw = await callGroq(SYSTEM_VEDIC, prompt, 750)
    const parsed = safeJSON(raw)

    const forecast: ForecastDay = {
      date: today,
      score,
      energyLabel: getEnergyLabel(score),
      summary: parsed?.summary ?? `Your ${v.mahadasha} period shapes today's energy with Moon in ${moonNak}.`,
      doList: parsed?.do_list ?? [],
      avoidList: parsed?.avoid_list ?? [],
      fullText: parsed?.full_text ?? keyEvent,
      keyTransit: parsed?.key_transit ?? keyEvent,
      moonPhase: parsed?.moon_phase ?? 'Shukla Paksha',
      moonSign: parsed?.moon_sign ?? v.moonRashi,
      moonNakshatra: moonNak,
      horaList: generateHoraList(v.lagna),
    }

    try {
      await AsyncStorage.setItem(todayCacheKey(userId), JSON.stringify(forecast))
      await AsyncStorage.setItem(todayDateKey(userId), today)
    } catch {}

    set({ todayForecast: forecast, isTodayLoading: false })
  },

  // ── WEEK ────────────────────────────────────────────────────────────────────
  loadWeekForecast: async (userId, chartData) => {
    set({ isWeekLoading: true })

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
    const t = chartData.currentTiming
    const today = new Date()

    // Compute Vedic math scores for all 7 days
    const mathData = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const score = computeDailyScoreForDate(v, date)
      const moonNak = getMoonNakshatraForDate(date)
      const keyEvent = getKeyAstroEventForDate(v, date)
      const transits = getTransitingPlanetsForDate(v, date)
      const mainTransit = transits.find(p => p.planet !== 'Chandra') // pick non-moon transit
      return {
        dateStr: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        score,
        moonNak,
        keyEvent,
        mainTransit: mainTransit ? `${mainTransit.planet} in ${mainTransit.rashi} H${mainTransit.house}${mainTransit.isRetro ? 'R' : ''}` : '',
      }
    })

    const chartCtx = buildMiniChartContext(chartData)
    const dayContext = mathData.map(d =>
      `${d.dayName} (${d.dateStr}): Score ${d.score}, Moon in ${d.moonNak}, ${d.keyEvent}, Transit: ${d.mainTransit}`
    ).join('\n')

    const prompt = `Chart: ${chartCtx}

Per-day Vedic math data for next 7 days:
${dayContext}

Generate a 7-day Vedic forecast. The scores are already computed via Vedic mathematics — use them as-is. Return ONLY this JSON with exactly 7 entries in "days":
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "summary": "2 sentences naming specific planets, house numbers, or nakshatra",
      "key_transit": "1 sentence on the day's dominant astrological influence",
      "do_list": ["2 specific actions grounded in the day's planetary influences"],
      "avoid_list": ["2 specific things to avoid with planetary reason"]
    }
  ]
}`

    const raw = await callGroq(SYSTEM_VEDIC, prompt, 1400)
    const parsed = safeJSON(raw)
    const aiDays: any[] = parsed?.days ?? []

    const days: ForecastDay[] = mathData.map((md, i) => {
      const ai = aiDays.find(d => d.date === md.dateStr) ?? aiDays[i] ?? {}
      return {
        date: md.dateStr,
        score: md.score,
        energyLabel: getEnergyLabel(md.score),
        summary: ai.summary ?? `${md.dayName}: Moon in ${md.moonNak}. ${md.keyEvent}.`,
        doList: ai.do_list ?? [],
        avoidList: ai.avoid_list ?? [],
        fullText: '',
        keyTransit: ai.key_transit ?? md.keyEvent,
        moonPhase: '',
        moonSign: '',
        moonNakshatra: md.moonNak,
        horaList: [],
      }
    })

    try {
      await AsyncStorage.setItem(weekCacheKey(userId), JSON.stringify({ days, generatedAt: new Date().toISOString() }))
    } catch {}

    set({ weekForecast: days, isWeekLoading: false })
  },

  // ── MONTH ───────────────────────────────────────────────────────────────────
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
    const t = chartData.currentTiming
    const now = new Date()
    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    // Compute Vedic math scores for all days in the month
    const days: ForecastDay[] = Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth(), i + 1)
      const score = computeDailyScoreForDate(v, date)
      const moonNak = getMoonNakshatraForDate(date)
      const keyEvent = getKeyAstroEventForDate(v, date)
      return {
        date: date.toISOString().split('T')[0],
        score,
        energyLabel: getEnergyLabel(score),
        summary: '',
        doList: [],
        avoidList: [],
        fullText: '',
        keyTransit: keyEvent,
        moonPhase: '',
        moonSign: '',
        moonNakshatra: moonNak,
        horaList: [],
      }
    })

    // Find peak and low days for context
    const sortedByScore = [...days].sort((a, b) => b.score - a.score)
    const peakDays = sortedByScore.slice(0, 3).map(d => `${new Date(d.date).getDate()} (${d.score})`).join(', ')
    const lowDays = sortedByScore.slice(-3).map(d => `${new Date(d.date).getDate()} (${d.score})`).join(', ')

    const chartCtx = buildMiniChartContext(chartData)
    const prompt = `Chart: ${chartCtx}

Month: ${monthName}
Peak energy days (Vedic math): ${peakDays}
Challenging energy days: ${lowDays}
Sade Sati: ${t?.sadeSatiStatus?.isActive ? `YES — ${t.sadeSatiStatus.phase}` : 'No'}

Generate a monthly Vedic forecast. Return ONLY this JSON:
{
  "summary": "4 paragraphs. Each paragraph names specific planets, houses, Dasha periods, or nakshatras. Cover career/finances, relationships, health, spirituality. No generic lines.",
  "special_alerts": [
    {"type": "fullmoon", "date": "${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-XX", "title": "Purnima — Full Moon", "impact": "2 sentences on personal impact for this chart"},
    {"type": "favorable", "date": "${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-XX", "title": "Peak Transit Window", "impact": "2 sentences naming the specific planetary configuration"},
    {"type": "retrograde", "date": "${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-XX", "title": "Retrograde Caution", "impact": "2 sentences on what to watch"}
  ]
}`

    const raw = await callGroq(SYSTEM_VEDIC, prompt, 850)
    const parsed = safeJSON(raw)

    const forecast: ForecastMonth = {
      monthName,
      year: now.getFullYear(),
      summary: parsed?.summary ?? `${monthName} is dominated by your ${v.mahadasha} period. Focus on the themes of ${v.antardasha.replace(' Antardasha', '')}.`,
      days,
      specialAlerts: parsed?.special_alerts ?? [],
    }

    try {
      await AsyncStorage.setItem(monthCacheKey(userId), JSON.stringify({ forecast, generatedAt: new Date().toISOString() }))
    } catch {}

    set({ monthForecast: forecast, isMonthLoading: false })
  },

  
  // ── YEAR ────────────────────────────────────────────────────────────────────
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
    const t = chartData.currentTiming
    const now = new Date()
    const monthNames = ['January','February','March','April','May','June',
      'July','August','September','October','November','December']

    // Compute rough monthly energy bar from Vedic math (first day of each month)
    const monthBars = Array.from({ length: 12 }, (_, i) => {
      const m = (now.getMonth() + i) % 12
      const y = now.getFullYear() + Math.floor((now.getMonth() + i) / 12)
      const firstDay = new Date(y, m, 1)
      const midDay = new Date(y, m, 14)
      const lastDay = new Date(y, m + 1, 0)
      const avg = Math.round((
        computeDailyScoreForDate(v, firstDay) +
        computeDailyScoreForDate(v, midDay) +
        computeDailyScoreForDate(v, lastDay)
      ) / 3)
      return { month: m + 1, year: y, name: `${monthNames[m]} ${y}`, energyBar: avg }
    })

    const chartCtx = buildMiniChartContext(chartData)
    const monthContext = monthBars.map(m =>
      `${m.name}: energy bar ${m.energyBar}`
    ).join('\n')

    const prompt = `Chart: ${chartCtx}

12-month period starting ${monthNames[now.getMonth()]} ${now.getFullYear()}.
Vedic math energy levels per month:
${monthContext}

Antardasha timeline: ${t?.currentAntardasha?.lord ?? 'Unknown'} Antardasha running until ${t?.currentAntardasha?.endDate ?? 'unknown date'}.

Generate a 12-month year-ahead Vedic forecast. The energy bars are already computed — use them. Return ONLY this JSON:
{
  "months": [
    {
      "month": 1-12,
      "year": YYYY,
      "name": "Month YYYY",
      "summary": "2-3 sentences — name specific planets, houses, Dasha sub-periods. Different theme for each month.",
      "energy_bar": 0-100 (use the math-computed value provided),
      "key_event": "one specific astrological theme for this month naming a planet or transit"
    }
  ]
}`

    const raw = await callGroq(SYSTEM_VEDIC, prompt, 1600)
    const parsed = safeJSON(raw)

    const forecast: ForecastYear = {
      months: parsed?.months?.length === 12
        ? parsed.months.map((m: any, i: number) => ({
            ...m,
            energyBar: m.energy_bar ?? monthBars[i]?.energyBar ?? 60,
          }))
        : monthBars.map((mb, i) => ({
            month: mb.month,
            year: mb.year,
            name: mb.name,
            summary: `${v.mahadasha} continues. ${v.antardasha.replace(' Antardasha', '')} sub-period themes active.`,
            energyBar: mb.energyBar,
            keyEvent: `${v.mahadasha.replace(' Mahadasha', '')} themes — house ${(i % 12) + 1} in focus`,
          })),
      generatedAt: new Date().toISOString(),
    }

    try {
      await AsyncStorage.setItem(yearCacheKey(userId), JSON.stringify({ forecast, generatedAt: new Date().toISOString() }))
    } catch {}

    set({ yearForecast: forecast, isYearLoading: false })
  },
}))
