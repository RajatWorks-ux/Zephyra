export interface UserProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  auth_provider: string
  created_at: string
}

export interface BirthProfile {
  id: string
  user_id: string
  birth_date: string
  birth_time: string | null
  birth_time_known: boolean
  birth_city: string
  birth_country: string
  birth_lat: number
  birth_lng: number
  timezone: string
  created_at: string
}

export interface BirthFormData {
  day: number
  month: number
  year: number
  hour: number
  minute: number
  isPM: boolean
  timeKnown: boolean
  city: string
  country: string
  lat: number
  lng: number
  timezone: string
}

export interface CityResult {
  display_name: string
  city: string
  country: string
  lat: number
  lng: number
}

export type AuthScreen = 'signin' | 'signup'

// ─── Vedic Graha (Planet) ─────────────────────────────────────────────────────
export interface VedicGraha {
  name: string
  rashi: string
  degree: number
  house: number
  nakshatra: string
  nakshatraPada: number
  isRetrograde: boolean
  isExalted: boolean
  isDebilitated: boolean
}

// ─── Vedic Chart ─────────────────────────────────────────────────────────────
export interface VedicChart {
  lagna: string
  lagnaDegree: number
  rashi: string
  rashiDegree: number
  moonRashi: string
  moonDegree: number
  nakshatra: string
  nakshatraPada: number
  nakshatraLord: string
  mahadasha: string
  mahadashaPeriod: string
  antardasha: string
  grahas: VedicGraha[]
  houses: string[]
  yogas: string[]
}

// ─── New Timing Types ─────────────────────────────────────────────────────────
export interface GocharData {
  transitingPlanets: VedicGraha[]
  keyConditions: string[]
}

export interface AntardashaInfo {
  lord: string
  startDate: string
  endDate: string
  lordsRelationship: 'friend' | 'neutral' | 'enemy'
}

export interface PastDashaEntry {
  lord: string
  startAge: number
  endAge: number
}

export interface SadeSatiStatus {
  isActive: boolean
  phase: 'starting' | 'peak' | 'ending' | null
  endYear: number | null
}

export type LifeStage = 'formation' | 'consolidation' | 'mastery' | 'transcendence'

export interface CurrentTimingData {
  gochar: GocharData
  currentAntardasha: AntardashaInfo
  pastDashaHistory: PastDashaEntry[]
  sadeSatiStatus: SadeSatiStatus
  jupiterTransitFavorable: boolean
  jupiterHouseFromMoon: number
  jupiterHouseFromLagna: number
  userAge: number
  lifeStage: LifeStage
}

// ─── Chart Data ───────────────────────────────────────────────────────────────
export interface ChartData {
  vedic: VedicChart
  birthProfile: BirthProfile
  calculatedAt: string
  currentTiming?: CurrentTimingData   // optional so old cached readings don't break
}

export interface CompatibleSign {
  sign: string
  percentage: number
}

// ─── Reading Seed ─────────────────────────────────────────────────────────────
export interface ReadingSeed {
  core_traits: string[]
  life_themes: string[]
  relationship_pattern: string
  career_archetype: string
  spiritual_direction: string
  past_statement_themes: string[]
}

// ─── Language ────────────────────────────────────────────────────────────────
export interface Language {
  code: string
  name: string
  nativeName: string
  promptInstruction: string
  flag: string
}

// ─── Parsed Reading ───────────────────────────────────────────────────────────
export interface ParsedReading {
  past_statements: string[]
  present_statements: string[]
  chapter_identity: string
  chapter_love: string
  chapter_career: string
  chapter_health: string
  chapter_family: string
  chapter_purpose: string
  chapter_now: string
  chapter_identity_summary: string
  chapter_love_summary: string
  chapter_career_summary: string
  chapter_health_summary: string
  chapter_family_summary: string
  chapter_purpose_summary: string
  chapter_now_summary: string
  compatible_signs: CompatibleSign[]
  career_strengths: string[]
  best_months_love: number[]
  best_months_money: number[]
  daily_score_base: number
  daily_energy_summary: string
  daily_caution?: string
  peak_hours?: string
  language?: string
}

export interface Reading {
  id: string
  user_id: string
  full_reading_text: string | null
  past_statements: string[] | null
  vedic_data: VedicChart | null
  created_at: string
  reading_seed: ReadingSeed | null
  reading_language: string | null
  }

