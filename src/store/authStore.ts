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
        // Load profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        // Load birth profile
        const { data: birth } = await supabase
          .from('birth_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        set({ profile, birthProfile: birth ?? null })
      }
    } catch (error) {
      console.error('Auth init error:', error)
    } finally {
      set({ isLoading: false, isInitialized: true })
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session, user: session?.user ?? null })

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        const { data: birth } = await supabase
          .from('birth_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        set({ profile, birthProfile: birth ?? null })
      } else {
        set({ profile: null, birthProfile: null })
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