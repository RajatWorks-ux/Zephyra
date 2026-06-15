// src/store/authStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: Migrated from Supabase to Appwrite
// SKIP_LOGIN = true for development (hardcoded mock user)
// Set SKIP_LOGIN = false when Appwrite is configured and ready
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import { useReadingStore } from './readingStore'

// ── Toggle this to bypass login during development ────────────────────────────
const SKIP_LOGIN = true

// ── Mock data for development (fill in your real birth details) ───────────────
const MOCK_BIRTH_PROFILE = {
  id:               'mock-birth-001',
  user_id:          'mock-user-001',
  birth_date:       '2010-03-03',
  birth_time:       '23:55:00',
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
  display_name:  'Zephyra Dev User',
  avatar_url:    null,
  auth_provider: 'mock',
}

const MOCK_SESSION = {
  user: { id: 'mock-user-001', email: 'dev@zephyra.app' },
  access_token: 'mock-token',
  token_type: 'bearer',
  expires_in: 999999,
  refresh_token: 'mock-refresh',
}

// ── Types ─────────────────────────────────────────────────────────────────────
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
  session: any | null
  profile: Profile | null
  birthProfile: BirthProfile | null
  isLoading: boolean
  isInitialized: boolean
  isPasswordRecovery: boolean
  // polling interval ref for session check
  _pollingInterval: ReturnType<typeof setInterval> | null

  initialize: () => Promise<void>
  signOut: () => Promise<void>
  refreshBirthProfile: () => Promise<void>
  clearRecovery: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  birthProfile: null,
  isLoading: true,
  isInitialized: false,
  isPasswordRecovery: false,
  _pollingInterval: null,

  initialize: async () => {
    // ── SKIP_LOGIN mode (development) ─────────────────────────────────────────
    if (SKIP_LOGIN) {
      set({
        session: MOCK_SESSION,
        profile: MOCK_PROFILE,
        birthProfile: MOCK_BIRTH_PROFILE,
        isLoading: false,
        isInitialized: true,
        isPasswordRecovery: false,
      })
      return
    }

    // ── Real Appwrite auth ────────────────────────────────────────────────────
    try {
      const { getSession, getUser, getBirthProfile, getUserProfile } = await import('../services/appwriteService')

      const session = await getSession()
      if (session) {
        const [user, birthProfile] = await Promise.all([
          getUser(),
          getBirthProfile(session.userId),
        ])
        const profile = user ? await getUserProfile(user.$id).catch(() => null) : null

        set({
          session,
          profile: profile ? {
            id: user!.$id,
            display_name: profile.display_name ?? user?.name ?? null,
            avatar_url: profile.avatar_url ?? null,
            auth_provider: profile.auth_provider ?? 'email',
          } : null,
          birthProfile: birthProfile as BirthProfile | null,
          isLoading: false,
          isInitialized: true,
          isPasswordRecovery: false,
        })

        // ── Start 30s polling to detect session expiry ─────────────────────────
        // (Appwrite has no onAuthStateChange — we poll instead)
        const interval = setInterval(async () => {
          try {
            await getSession()
          } catch {
            // 401 = session expired → sign out
            clearInterval(interval)
            set({ session: null, profile: null, birthProfile: null, _pollingInterval: null })
          }
        }, 30000)
        set({ _pollingInterval: interval })
      } else {
        set({ session: null, profile: null, birthProfile: null, isLoading: false, isInitialized: true })
      }
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
    // Stop polling
    const { _pollingInterval } = get()
    if (_pollingInterval) clearInterval(_pollingInterval)

    set({ isLoading: true })
    useReadingStore.getState().reset()

    try {
      const { signOut } = await import('../services/appwriteService')
      await signOut()
    } catch {}
    set({ session: null, profile: null, birthProfile: null, isLoading: false, _pollingInterval: null })
  },

  refreshBirthProfile: async () => {
    if (SKIP_LOGIN) return
    const { session } = get()
    if (!session) return
    try {
      const { getBirthProfile } = await import('../services/appwriteService')
      const birthProfile = await getBirthProfile(session.userId)
      set({ birthProfile: birthProfile as BirthProfile | null })
    } catch {}
  },

  clearRecovery: () => set({ isPasswordRecovery: false }),
}))
