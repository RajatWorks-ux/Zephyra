// src/store/authStore.ts
import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { useReadingStore } from './readingStore'
interface Profile {
  id: string                    // ← FIXED: was missing, caused profile.id to be undefined
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

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, auth_provider') // ← FIXED: added 'id'
    .eq('id', userId)
    .single()
  return data
}

async function fetchBirthProfile(userId: string): Promise<BirthProfile | null> {
  const { data } = await supabase
    .from('birth_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  birthProfile: null,
  isLoading: true,
  isInitialized: false,
  isPasswordRecovery: false,

  initialize: async () => {
    supabase.auth.onAuthStateChange(async (event, session) => {

      if (event === 'PASSWORD_RECOVERY') {
        set({
          session,
          isPasswordRecovery: true,
          isLoading: false,
          isInitialized: true,
        })
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          const [profile, birthProfile] = await Promise.all([
            fetchProfile(session.user.id),
            fetchBirthProfile(session.user.id),
          ])
          set({
            session,
            profile,
            birthProfile,
            isPasswordRecovery: false,
            isLoading: false,
            isInitialized: true,
          })
        }
        return
      }

      if (event === 'SIGNED_OUT') {
        set({
          session: null,
          profile: null,
          birthProfile: null,
          isPasswordRecovery: false,
          isLoading: false,
          isInitialized: true,
        })
        return
      }
    })

    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      const [profile, birthProfile] = await Promise.all([
        fetchProfile(session.user.id),
        fetchBirthProfile(session.user.id),
      ])
      set({
        session,
        profile,
        birthProfile,
        isLoading: false,
        isInitialized: true,
        isPasswordRecovery: false,
      })
    } else {
      set({
        session: null,
        profile: null,
        birthProfile: null,
        isLoading: false,
        isInitialized: true,
        isPasswordRecovery: false,
      })
    }
  },

  signOut: async () => {
    set({ isLoading: true })
    useReadingStore.getState().reset()
    await supabase.auth.signOut()
  },

  refreshBirthProfile: async () => {
    const { session } = get()
    if (!session) return
    const birthProfile = await fetchBirthProfile(session.user.id)
    set({ birthProfile })
  },

  clearRecovery: () => {
    set({ isPasswordRecovery: false })
  },
}))

