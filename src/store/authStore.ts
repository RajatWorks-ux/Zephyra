// src/store/authStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// SKIP_LOGIN_MODE: true
// Supabase auth is bypassed entirely. A hardcoded mock session + birth profile
// is injected so the app boots straight into MainNavigator.
// To restore real login: set SKIP_LOGIN to false.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { useReadingStore } from './readingStore'

// ── Toggle this one constant to switch modes ──────────────────────────────────
const SKIP_LOGIN = true

// ── Fill in your real birth details here ─────────────────────────────────────
const MOCK_BIRTH_PROFILE = {
  id:               'mock-birth-001',
  user_id:          'mock-user-001',
  birth_date:       '2010-03-03',       // YYYY-MM-DD
  birth_time:       '23:55:00',         // HH:MM:SS (24h)
  birth_time_known: true,
  birth_city:       'Chandigarh',
  birth_country:    'India',
  birth_lat:        30.7333,
  birth_lng:        76.7794,
  timezone:         'Asia/Kolkata',
  created_at:       new Date().toISOString(),
}

const MOCK_PROFILE = {
  id:            'mock-user-001',
  display_name:  'Zephyra User',
  avatar_url:    null,
  auth_provider: 'mock',
}

// A minimal object that satisfies the Session type shape the rest of the app reads
const MOCK_SESSION = {
  user: {
    id:    'mock-user-001',
    email: 'dev@zephyra.app',
  },
  access_token:  'mock-token',
  token_type:    'bearer',
  expires_in:    999999,
  refresh_token: 'mock-refresh',
} as unknown as Session

// ─────────────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  auth_provider: string | null
}

interface BirthProfile {
  id: string
  user_id: string
  birth_date: string | null
  birth_time: string | null
  birth_time_known: boolean
  birth_city: string | null
  birth_country: string | null
  birth_lat: number | null
  birth_lng: number | null
  timezone: string | null
  created_at: string
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  birthProfile: BirthProfile | null
  isLoading: boolean
  isInitialized: boolean
  isPasswordRecovery: boolean
  initialize: () => Promise<void>
  signOut: () => Promise<void>
  refreshBirthProfile: () => Promise<void>
  clearRecovery: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session:            null,
  profile:            null,
  birthProfile:       null,
  isLoading:          true,
  isInitialized:      false,
  isPasswordRecovery: false,

  initialize: async () => {
    if (SKIP_LOGIN) {
      // Skip all Supabase calls — inject mock data directly
      set({
        session:            MOCK_SESSION,
        profile:            MOCK_PROFILE,
        birthProfile:       MOCK_BIRTH_PROFILE,
        isLoading:          false,
        isInitialized:      true,
        isPasswordRecovery: false,
      })
      return
    }

    // ── Real Supabase auth (original code) ────────────────────────────────────
    const { supabase } = await import('../services/supabase')

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        set({ session, isPasswordRecovery: true, isLoading: false, isInitialized: true })
        return
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          const [profileRes, birthRes] = await Promise.all([
            supabase.from('profiles').select('id, display_name, avatar_url, auth_provider').eq('id', session.user.id).single(),
            supabase.from('birth_profiles').select('*').eq('user_id', session.user.id).single(),
          ])
          set({ session, profile: profileRes.data, birthProfile: birthRes.data, isPasswordRecovery: false, isLoading: false, isInitialized: true })
        }
        return
      }
      if (event === 'SIGNED_OUT') {
        set({ session: null, profile: null, birthProfile: null, isPasswordRecovery: false, isLoading: false, isInitialized: true })
        return
      }
    })

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const [profileRes, birthRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, auth_provider').eq('id', session.user.id).single(),
        supabase.from('birth_profiles').select('*').eq('user_id', session.user.id).single(),
      ])
      set({ session, profile: profileRes.data, birthProfile: birthRes.data, isLoading: false, isInitialized: true, isPasswordRecovery: false })
    } else {
      set({ session: null, profile: null, birthProfile: null, isLoading: false, isInitialized: true, isPasswordRecovery: false })
    }
  },

  signOut: async () => {
    if (SKIP_LOGIN) {
      // In mock mode, signOut just resets to the same mock state
      useReadingStore.getState().reset()
      set({ session: MOCK_SESSION, profile: MOCK_PROFILE, birthProfile: MOCK_BIRTH_PROFILE })
      return
    }
    set({ isLoading: true })
    useReadingStore.getState().reset()
    const { supabase } = await import('../services/supabase')
    await supabase.auth.signOut()
  },

  refreshBirthProfile: async () => {
    if (SKIP_LOGIN) return  // mock profile never changes
    const { session } = get()
    if (!session) return
    const { supabase } = await import('../services/supabase')
    const { data } = await supabase.from('birth_profiles').select('*').eq('user_id', session.user.id).single()
    set({ birthProfile: data })
  },

  clearRecovery: () => {
    set({ isPasswordRecovery: false })
  },
}))

