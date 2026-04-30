import { create } from 'zustand'
import { supabase } from '../services/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { UserProfile, BirthProfile } from '../types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  birthProfile: BirthProfile | null
  isLoading: boolean
  isInitialized: boolean

  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setBirthProfile: (birth: BirthProfile | null) => void
  setLoading: (loading: boolean) => void
  initialize: () => Promise<void>
  signOut: () => Promise<void>
  refreshBirthProfile: () => Promise<void>
}

// ── KEY FIX: extracted helper so both initialize and onAuthStateChange
// load both profiles in a single parallel round-trip instead of two
// sequential awaits. Keeps code DRY and reduces latency.
async function loadProfiles(userId: string) {
  const [{ data: profile }, { data: birth }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('birth_profiles').select('*').eq('user_id', userId).single(),
  ])
  return { profile: profile ?? null, birthProfile: birth ?? null }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  birthProfile: null,
  isLoading: true,
  isInitialized: false,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setProfile: (profile) => set({ profile }),

  setBirthProfile: (birthProfile) => set({ birthProfile }),

  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ session, user: session?.user ?? null })

      if (session?.user) {
        const { profile, birthProfile } = await loadProfiles(session.user.id)
        set({ profile, birthProfile })
      }
    } catch (error) {
      console.error('Auth init error:', error)
    } finally {
      set({ isLoading: false, isInitialized: true })
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      // ── KEY FIX: show spinner while profiles load ──────────────────────
      // Without this, RootNavigator sees session=true + birthProfile=null
      // and briefly flashes the wrong screen before profiles finish loading.
      // isInitialized stays true so the full app spinner doesn't show again.
      set({ isLoading: true, session, user: session?.user ?? null })

      if (session?.user) {
        const { profile, birthProfile } = await loadProfiles(session.user.id)
        set({ profile, birthProfile, isLoading: false })
      } else {
        set({ profile: null, birthProfile: null, isLoading: false })
      }
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null, birthProfile: null })
  },

  refreshBirthProfile: async () => {
    const { user } = get()
    if (!user) return
    const { data } = await supabase
      .from('birth_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    set({ birthProfile: data ?? null })
  },
}))
