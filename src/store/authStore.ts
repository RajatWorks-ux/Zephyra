
// src/store/authStore.ts
// PHASE 2 — Back on Supabase (new project)
// SKIP_LOGIN = true → development mode (no real auth needed)
// SKIP_LOGIN = false → real Supabase auth

import { create } from 'zustand'
import { supabase, getBirthProfile, getUserProfile } from '../services/supabase'
import { useReadingStore } from './readingStore'

const SKIP_LOGIN = false  // ← set false when ready to test real auth

const MOCK_BIRTH_PROFILE = {
  id: 'mock-birth-001', user_id: 'mock-user-001',
  birth_date: '2010-03-03', birth_time: '23:55:00', birth_time_known: true,
  birth_city: 'Chandigarh', birth_country: 'India',
  birth_lat: 30.7333, birth_lng: 76.7794, timezone: 'Asia/Kolkata',
  created_at: new Date().toISOString(),
}
const MOCK_PROFILE = { id: 'mock-user-001', display_name: 'Zephyra Dev User', avatar_url: null, auth_provider: 'mock' }
const MOCK_SESSION = { user: { id: 'mock-user-001', email: 'dev@zephyra.app' }, access_token: 'mock-token' }

interface Profile {
  id: string; display_name: string | null; avatar_url: string | null; auth_provider: string | null
}
interface BirthProfile {
  id: string; user_id: string; birth_date: string | null; birth_time: string | null
  birth_time_known: boolean; birth_city: string | null; birth_country: string | null
  birth_lat: number | null; birth_lng: number | null; timezone: string | null; created_at: string
}
interface AuthState {
  session: any | null; profile: Profile | null; birthProfile: BirthProfile | null
  isLoading: boolean; isInitialized: boolean; isPasswordRecovery: boolean
  initialize: () => Promise<void>; signOut: () => Promise<void>
  refreshBirthProfile: () => Promise<void>; clearRecovery: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null, profile: null, birthProfile: null,
  isLoading: true, isInitialized: false, isPasswordRecovery: false,

  initialize: async () => {
    if (SKIP_LOGIN) {
      set({ session: MOCK_SESSION, profile: MOCK_PROFILE, birthProfile: MOCK_BIRTH_PROFILE, isLoading: false, isInitialized: true })
      return
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const [profileRes, birthRes] = await Promise.all([
          getUserProfile(session.user.id),
          getBirthProfile(session.user.id),
        ])
        set({
          session,
          profile: profileRes.data ? { id: session.user.id, display_name: profileRes.data.display_name ?? null, avatar_url: profileRes.data.avatar_url ?? null, auth_provider: profileRes.data.auth_provider ?? 'email' } : null,
          birthProfile: birthRes.data ?? null,
          isLoading: false, isInitialized: true, isPasswordRecovery: false,
        })
        // Cloud key restore — silently recovers keys after reinstall
        import('../services/secureKeyStore').then(({ restoreGroqKeysIfNeeded }) => {
          restoreGroqKeysIfNeeded(session.user.id).then(restored => {
            if (restored) {
              // Keys were restored — trigger setupStore re-init
              import('../store/setupStore').then(({ useSetupStore }) => {
                useSetupStore.getState().initialize()
              })
            }
          })
        })
      } else {
        set({ session: null, profile: null, birthProfile: null, isLoading: false, isInitialized: true })
      }

      // Listen for auth state changes (Supabase built-in — no polling needed)
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          set({ isPasswordRecovery: true, session })
          return
        }
        if (event === 'SIGNED_OUT' || !session) {
          set({ session: null, profile: null, birthProfile: null, isPasswordRecovery: false })
          return
        }
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const [profileRes, birthRes] = await Promise.all([
            getUserProfile(session.user.id),
            getBirthProfile(session.user.id),
          ])
          set({
            session,
            profile: profileRes.data ? { id: session.user.id, display_name: profileRes.data.display_name ?? null, avatar_url: profileRes.data.avatar_url ?? null, auth_provider: profileRes.data.auth_provider ?? 'email' } : null,
            birthProfile: birthRes.data ?? null,
          })
          // Cloud key restore on sign-in (handles reinstall scenario)
          import('../services/secureKeyStore').then(({ restoreGroqKeysIfNeeded }) => {
            restoreGroqKeysIfNeeded(session.user.id).then(restored => {
              if (restored) {
                import('../store/setupStore').then(({ useSetupStore }) => {
                  useSetupStore.getState().initialize()
                })
              }
            })
          })
        }
      })
    } catch (e: any) {
      console.error('[AuthStore] initialize error:', e.message)
      set({ isLoading: false, isInitialized: true })
    }
  },

  signOut: async () => {
    if (SKIP_LOGIN) {
      useReadingStore.getState().reset()
      set({ session: MOCK_SESSION, profile: MOCK_PROFILE, birthProfile: MOCK_BIRTH_PROFILE })
      return
    }
    set({ isLoading: true })
    useReadingStore.getState().reset()
    await supabase.auth.signOut()
    set({ session: null, profile: null, birthProfile: null, isLoading: false })
  },

  refreshBirthProfile: async () => {
    if (SKIP_LOGIN) return
    const { session } = get()
    if (!session?.user) return
    const { data } = await getBirthProfile(session.user.id)
    set({ birthProfile: data ?? null })
  },

  clearRecovery: () => set({ isPasswordRecovery: false }),
}))
          
