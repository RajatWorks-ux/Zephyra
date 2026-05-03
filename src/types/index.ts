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

export interface WesternChart {
  sunSign: string
  sunDegree: number
  moonSign: string
  moonDegree: number
  ascendant: string
  ascendantDegree: number
}

export interface VedicChart {
  rashi: string
  moonRashi: string
  lagna: string
  nakshatra: string
  nakshatraPada: number
  mahadasha: string
  mahadashaPeriod: string
  antardasha: string
}

export interface ChineseChart {
  animal: string
  yearStem: string
  yearBranch: string
  element: string
  polarity: string
  dayStem: string
  dayBranch: string
  hourBranch: string
  yearPillar: { stem: string; branch: string; element: string }
  monthPillar: { stem: string; branch: string; element: string }
  dayPillar: { stem: string; branch: string; element: string }
  hourPillar: { stem: string; branch: string; element: string }
}

export interface MayanChart {
  daySign: string
  tone: number
  toneKeyword: string
  galacticSignature: string
}

export interface CelticChart {
  treeName: string
  oghamSymbol: string
  treeMeaning: string
}

export interface EgyptianChart {
  decanName: string
  decanGod: string
  decanNumber: number
  sunDecan: string
}

export interface ChartData {
  western: WesternChart
  vedic: VedicChart
  chinese: ChineseChart
  mayan: MayanChart
  celtic: CelticChart
  egyptian: EgyptianChart
  birthProfile: BirthProfile
  calculatedAt: string
}

export interface CompatibleSign {
  sign: string
  percentage: number
}

// ─── Reading Seed — stable personality fingerprint saved after first generation ─
export interface ReadingSeed {
  core_traits: string[]
  life_themes: string[]
  relationship_pattern: string
  career_archetype: string
  spiritual_direction: string
  past_statement_themes: string[]
}

// ─── Language — for multilingual reading generation ───────────────────────────
export interface Language {
  code: string          // BCP47 code e.g. 'en-US', 'hi-IN'
  name: string          // English display name e.g. 'Hindi'
  nativeName: string    // Native name e.g. 'हिन्दी'
  promptInstruction: string // What to tell the AI
  flag: string          // Emoji flag
}

export interface ParsedReading {
  // ── Past / Present ──────────────────────────────────────────────────────────
  // Each string is prefixed with [PAST] or [FUTURE] for age-aware rendering
  past_statements: string[]
  present_statements: string[]

  // ── Chapters — main content ──────────────────────────────────────────────────
  chapter_identity: string
  chapter_love: string
  chapter_career: string
  chapter_health: string
  chapter_family: string
  chapter_purpose: string
  chapter_now: string

  // ── Chapter summaries — 2-3 plain sentences per chapter ──────────────────────
  chapter_identity_summary: string
  chapter_love_summary: string
  chapter_career_summary: string
  chapter_health_summary: string
  chapter_family_summary: string
  chapter_purpose_summary: string
  chapter_now_summary: string

  // ── Scores and compatibility ──────────────────────────────────────────────────
  compatible_signs: CompatibleSign[]
  career_strengths: string[]
  best_months_love: number[]
  best_months_money: number[]
  daily_score_base: number
  daily_energy_summary: string

  // ── Meta ─────────────────────────────────────────────────────────────────────
  language?: string   // BCP47 code of the language this reading was generated in
}

export interface Reading {
  id: string
  user_id: string
  full_reading_text: string | null
  past_statements: string[] | null
  western_data: WesternChart | null
  vedic_data: VedicChart | null
  chinese_data: ChineseChart | null
  created_at: string
  reading_seed: ReadingSeed | null
  reading_language: string | null
}
