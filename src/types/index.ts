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


// ─── Phase 3: Relationship Types ─────────────────────────────────────────────

export type RelationshipType =
  | 'romantic' | 'marriage' | 'business' | 'friendship'
  | 'family_parent' | 'family_child' | 'family_sibling'
  | 'teacher_student' | 'rivalry' | 'colleague' | 'healer' | 'creative_partner'

export interface Person2TraitMemory {
  observed_traits: string[]
  karmic_themes: string[]
  relationship_pattern_with_p1: string
  noted_by_ai_at: string
}

export interface RelationshipProfile {
  id: string
  user_id: string
  person_name: string
  person_gender: 'male' | 'female'
  birth_date: string
  birth_time: string | null
  birth_time_known: boolean
  birth_city: string
  birth_country: string
  birth_lat: number
  birth_lng: number
  timezone: string
  relationship_types: RelationshipType[]
  relationship_start_date?: string | null
  chart_data_cache: VedicChart | null
  person2_trait_memory: Person2TraitMemory | null
  created_at: string
  updated_at: string
}

export interface KootaScore {
  varna: number
  vashya: number
  tara: number
  yoni: number
  grahaMaitri: number
  gana: number
  rashi: number
  nadi: number
  total: number
  maxTotal: 36
  tier: 'excellent' | 'good' | 'average' | 'challenging'
}

export interface RelationshipYoga {
  name: string
  type: 'strength' | 'warning' | 'neutral'
  headline: string
  description: string
  planetsCited: string[]
}

export interface CompatibilityDimensions {
  emotional_score: number
  intellectual_score: number
  physical_score: number
  spiritual_score: number
  financial_score: number
  career_score: number
  overall_score: number
}

export interface CompatibilityResult {
  id?: string
  user_id: string
  person2_id: string
  relationship_type: RelationshipType
  overall_score: number
  emotional_score: number
  intellectual_score: number
  physical_score: number
  spiritual_score: number
  financial_score: number
  career_score: number
  koota_score: KootaScore
  yogas: RelationshipYoga[]
  full_reading_json: {
    bond_identity: string
    bond_strengths: string
    bond_challenges: string
    period_forecast: string
    relationship_type_specific: string
    practical_guidance: string
  }
  reading_language: string
  created_at: string
}

export interface RelationshipReadingSection {
  section_id: string
  title: string
  content: string
}

// ─── Phase 3: Audio ───────────────────────────────────────────────────────────

export interface BookmarkItem {
  id: string
  text: string
  source: string
  topic: string
  savedAt: string
}

export interface ReadingHistoryEntry {
  id: string
  user_id: string
  generated_at: string
  trigger: string
  mahadasha_at_time: string
  antardasha_at_time: string
  daily_score_at_time: number
  key_change_description: string
  reading_summary: string
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
}

export interface AdminMessage {
  id: string
  title: string
  body: string
  message_type: string
  poll_options?: string[]
  scheduled_at?: string
  sent_at?: string
  is_sent: boolean
}
