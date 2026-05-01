// src/store/authStore.ts
import { create } from 'zustand'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

interface Profile {
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
    .select('display_name, avatar_url, auth_provider')
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
    // ─── FIX APPLIED: Register listener FIRST before getSession() ────────────
    // Previously the listener was registered AFTER getSession() completed.
    // If a Google OAuth redirect arrived during that async gap (cold start),
    // the SIGNED_IN event would fire before the listener was attached and
    // would be silently missed — leaving session: null and sending the user
    // back to the sign-in screen even though auth succeeded.
    // Registering first guarantees we never miss an auth event.
    // ─────────────────────────────────────────────────────────────────────────
    supabase.auth.onAuthStateChange(async (event, session) => {

      // ────────────────────────────────────────────────────────────────
      // PASSWORD_RECOVERY: User clicked the reset link from email.
      // We MUST NOT navigate to the main app here.
      // Set the flag so RootNavigator keeps showing AuthNavigator.
      // PasswordResetScreen handles everything from here.
      // ────────────────────────────────────────────────────────────────
      if (event === 'PASSWORD_RECOVERY') {
        set({
          session,
          isPasswordRecovery: true,
          isLoading: false,
        })
        return
      }

      // ────────────────────────────────────────────────────────────────
      // SIGNED_IN: Fires after Google OAuth, Phone OTP, email login,
      // and exchangeCodeForSession. Fetch profile + birthProfile and
      // let RootNavigator decide where to send the user.
      // ────────────────────────────────────────────────────────────────
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
          })
        }
        return
      }

      // ────────────────────────────────────────────────────────────────
      // SIGNED_OUT: Clear everything. RootNavigator shows SignIn.
      // ────────────────────────────────────────────────────────────────
      if (event === 'SIGNED_OUT') {
        set({
          session: null,
          profile: null,
          birthProfile: null,
          isPasswordRecovery: false,
          isLoading: false,
        })
        return
      }
    })

    // Check if user already had a session (e.g. app restarted).
    // This runs AFTER the listener is registered so no events are missed.
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
    await supabase.auth.signOut()
    // SIGNED_OUT event above will clean up state
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
            
