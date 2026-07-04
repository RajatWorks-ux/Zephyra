// src/store/relationshipStore.ts — Phase 3 (Supabase backend)
import { create } from 'zustand'
import {
  getRelationshipProfiles, saveRelationshipProfile,
  updateRelationshipProfile, deleteRelationshipProfile,
  getCompatibilityResult, saveCompatibilityResult,
} from '../services/supabase'
import { calculateAllKootas, detectRelationshipYogas, calculateDimensionScores } from '../services/synastryCaiculations'
import { calculateChartData } from '../services/astrologyEngine'
import { generateRelationshipReading } from '../services/groqAI'
import type { RelationshipProfile, CompatibilityResult, RelationshipType, VedicChart, BirthProfile, Language } from '../types'

interface RelationshipState {
  profiles: RelationshipProfile[]
  activeProfile: RelationshipProfile | null
  activeResult: CompatibilityResult | null
  isLoadingProfiles: boolean
  isGenerating: boolean
  generatingStatus: string
  error: string | null
  loadProfiles: (userId: string) => Promise<void>
  setActiveProfile: (p: RelationshipProfile | null) => void
  addProfile: (userId: string, data: any) => Promise<RelationshipProfile | null>
  deleteProfile: (profileId: string) => Promise<void>
  generateCompatibility: (userId: string, userBirthProfile: BirthProfile, profile: RelationshipProfile, language: Language | null) => Promise<CompatibilityResult | null>
  loadExistingResult: (userId: string, person2Id: string) => Promise<void>
  clearError: () => void
}

export const useRelationshipStore = create<RelationshipState>((set, get) => ({
  profiles: [], activeProfile: null, activeResult: null,
  isLoadingProfiles: false, isGenerating: false, generatingStatus: '', error: null,

  loadProfiles: async (userId) => {
    set({ isLoadingProfiles: true })
    try {
      const { data, error } = await getRelationshipProfiles(userId)
      if (!error) set({ profiles: (data || []) as RelationshipProfile[] })
    } catch (e) { console.warn('[RelStore] loadProfiles:', e) }
    finally { set({ isLoadingProfiles: false }) }
  },

  setActiveProfile: (p) => set({ activeProfile: p, activeResult: null }),

  addProfile: async (userId, data) => {
    try {
      // Calculate + cache Person 2 chart immediately
      const bp2: BirthProfile = {
        id: 'temp', user_id: userId,
        birth_date: data.birth_date, birth_time: data.birth_time,
        birth_time_known: data.birth_time_known, birth_city: data.birth_city,
        birth_country: data.birth_country, birth_lat: data.birth_lat,
        birth_lng: data.birth_lng, timezone: data.timezone,
        created_at: new Date().toISOString(),
      }
      let chart2Cache: VedicChart | null = null
      try { chart2Cache = calculateChartData(bp2).vedic } catch {}
      const saveData = { ...data, chart_data_cache: chart2Cache ? JSON.stringify(chart2Cache) : null, person2_trait_memory: null }
      const { data: saved, error } = await saveRelationshipProfile(userId, saveData)
      if (error) throw error
      const profile = saved as RelationshipProfile
      set(s => ({ profiles: [profile, ...s.profiles] }))
      return profile
    } catch (e: any) { set({ error: 'Could not save profile' }); return null }
  },

  deleteProfile: async (profileId) => {
    try {
      await deleteRelationshipProfile(profileId)
      set(s => ({ profiles: s.profiles.filter(p => p.id !== profileId) }))
    } catch {}
  },

  generateCompatibility: async (userId, userBirthProfile, profile, language) => {
    set({ isGenerating: true, error: null, generatingStatus: 'Mapping both birth charts...' })
    try {
      // Build full ChartData for Person 1
      const p1ChartData = calculateChartData(userBirthProfile)

      // Parse or recalculate Person 2 chart
      let chart2: VedicChart
      if (profile.chart_data_cache) {
        chart2 = typeof profile.chart_data_cache === 'string'
          ? JSON.parse(profile.chart_data_cache) : profile.chart_data_cache as VedicChart
      } else {
        const bp2: BirthProfile = {
          id: profile.id, user_id: userId,
          birth_date: profile.birth_date, birth_time: profile.birth_time,
          birth_time_known: profile.birth_time_known, birth_city: profile.birth_city,
          birth_country: profile.birth_country, birth_lat: profile.birth_lat,
          birth_lng: profile.birth_lng, timezone: profile.timezone,
          created_at: profile.created_at,
        }
        chart2 = calculateChartData(bp2).vedic
      }
      const p2ChartData = { vedic: chart2, birthProfile: {
        id: profile.id, user_id: userId,
        birth_date: profile.birth_date, birth_time: profile.birth_time,
        birth_time_known: profile.birth_time_known, birth_city: profile.birth_city,
        birth_country: profile.birth_country, birth_lat: profile.birth_lat,
        birth_lng: profile.birth_lng, timezone: profile.timezone,
        created_at: profile.created_at,
      } as BirthProfile, calculatedAt: new Date().toISOString() }

      set({ generatingStatus: 'Calculating all 8 Kootas...' })
      const koota = calculateAllKootas(p1ChartData.vedic, chart2)

      set({ generatingStatus: 'Detecting relationship yogas...' })
      const yogas = detectRelationshipYogas(p1ChartData.vedic, chart2)
      const dimensions = calculateDimensionScores(p1ChartData.vedic, chart2, koota, yogas, profile.relationship_types)

      set({ generatingStatus: 'Generating AI cosmic reading (3 parallel calls)...' })
      const primaryType = profile.relationship_types[0] || 'friendship'
      let fullReading = { bond_identity: '', bond_strengths: '', bond_challenges: '', period_forecast: '', relationship_type_specific: '', practical_guidance: '' }
      try {
        const rawReading = await generateRelationshipReading(
          p1ChartData, p2ChartData, primaryType,
          (s: string) => set({ generatingStatus: s }), language,
        )
        if (rawReading) {
          const clean = rawReading.replace(/```json|```/g, '').trim()
          const parsed = JSON.parse(clean)
          fullReading = {
            bond_identity: parsed.bond_identity || parsed.full_reading_json?.bond_identity || rawReading,
            bond_strengths: parsed.bond_strengths || parsed.full_reading_json?.bond_strengths || '',
            bond_challenges: parsed.bond_challenges || parsed.full_reading_json?.bond_challenges || '',
            period_forecast: parsed.period_forecast || parsed.full_reading_json?.period_forecast || '',
            relationship_type_specific: parsed.relationship_type_specific || parsed.full_reading_json?.relationship_type_specific || '',
            practical_guidance: parsed.practical_guidance || parsed.full_reading_json?.practical_guidance || '',
          }
        }
      } catch (e) {
        fullReading.bond_identity = 'Your cosmic reading is being prepared. Please regenerate to see the full analysis.'
      }

      const result: CompatibilityResult = {
        user_id: userId, person2_id: profile.id, relationship_type: primaryType,
        ...dimensions, koota_score: koota, yogas,
        full_reading_json: fullReading, reading_language: language?.code || 'en-US',
        created_at: new Date().toISOString(),
      }

      // Save to Supabase
      try {
        const { data: saved } = await saveCompatibilityResult(userId, profile.id, {
          ...result, koota_score: JSON.stringify(koota),
          yogas: JSON.stringify(yogas), full_reading_json: JSON.stringify(fullReading),
        })
        if (saved) result.id = (saved as any).id
      } catch {}

      set({ activeResult: result, isGenerating: false, generatingStatus: '' })
      return result
    } catch (e: any) {
      set({ error: e.message || 'Generation failed', isGenerating: false, generatingStatus: '' })
      return null
    }
  },

  loadExistingResult: async (userId, person2Id) => {
    try {
      const { data, error } = await getCompatibilityResult(userId, person2Id)
      if (error || !data) return
      const raw = data as any
      set({ activeResult: {
        ...raw,
        koota_score: typeof raw.koota_score === 'string' ? JSON.parse(raw.koota_score) : raw.koota_score,
        yogas: typeof raw.yogas === 'string' ? JSON.parse(raw.yogas) : (raw.yogas || []),
        full_reading_json: typeof raw.full_reading_json === 'string' ? JSON.parse(raw.full_reading_json) : raw.full_reading_json,
      }})
    } catch {}
  },

  clearError: () => set({ error: null }),
}))
