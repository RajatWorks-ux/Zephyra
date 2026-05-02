import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import * as Crypto from 'expo-crypto'

// ─── WebCrypto polyfill for Expo Go ───────────────────────────────────────────
// Expo Go does not expose the WebCrypto API that Supabase's PKCE flow needs
// in order to generate SHA-256 code challenges and random state values.
// Without this polyfill the client silently falls back to "plain" PKCE,
// causing email verification deep-links to fail on redirect.
// expo-crypto provides the required subtle.digest AND getRandomValues methods.
// ──────────────────────────────────────────────────────────────────────────────
if (typeof global.crypto === 'undefined') {
  // @ts-ignore
  global.crypto = {}
}

// ── getRandomValues — required by Supabase PKCE state generation ──────────────
// expo-crypto's getRandomBytes fills a Uint8Array with cryptographically
// secure random bytes, matching the Web Crypto API contract exactly.
// ──────────────────────────────────────────────────────────────────────────────
if (typeof global.crypto.getRandomValues === 'undefined') {
  // @ts-ignore
  global.crypto.getRandomValues = (array: Uint8Array) => {
    const bytes = Crypto.getRandomBytes(array.length)
    array.set(bytes)
    return array
  }
}

// ── subtle.digest — required by Supabase PKCE code-challenge generation ────────
// Used to hash the PKCE code verifier with SHA-256 before sending it to
// Supabase during email-link token exchange.
// ──────────────────────────────────────────────────────────────────────────────
if (typeof global.crypto.subtle === 'undefined') {
  // @ts-ignore
  global.crypto.subtle = {
    digest: async (algorithm: string, data: ArrayBuffer) => {
      const base64 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        String.fromCharCode(...new Uint8Array(data)),
        { encoding: Crypto.CryptoEncoding.BASE64 }
      )
      // Convert base64 to ArrayBuffer
      const binary = atob(base64)
      const buffer = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i)
      }
      return buffer.buffer
    },
  }
}
// ──────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})

// Refresh token when app comes to foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

// Helper: get current user profile
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

// Helper: check if user has birth profile
export async function getBirthProfile(userId: string) {
  const { data, error } = await supabase
    .from('birth_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

// Helper: save birth profile
export async function saveBirthProfile(
  userId: string,
  birthData: {
    birth_date: string
    birth_time: string | null
    birth_time_known: boolean
    birth_city: string
    birth_country: string
    birth_lat: number
    birth_lng: number
    timezone: string
  }
) {
  const { data, error } = await supabase
    .from('birth_profiles')
    .insert({ user_id: userId, ...birthData })
    .select()
    .single()
  return { data, error }
}
