import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import * as Crypto from 'expo-crypto'
import type { ReadingSeed } from '../types'

// ─── WebCrypto polyfill for Expo Go ───────────────────────────────────────────
if (typeof global.crypto === 'undefined') {
  // @ts-ignore
  global.crypto = {}
}

if (typeof global.crypto.getRandomValues === 'undefined') {
  // @ts-ignore
  global.crypto.getRandomValues = (array: Uint8Array) => {
    const bytes = Crypto.getRandomBytes(array.length)
    array.set(bytes)
    return array
  }
}

if (typeof global.crypto.subtle === 'undefined') {
  // @ts-ignore
  global.crypto.subtle = {
    digest: async (algorithm: string, data: ArrayBuffer) => {
      const base64 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        String.fromCharCode(...new Uint8Array(data)),
        { encoding: Crypto.CryptoEncoding.BASE64 }
      )
      const binary = atob(base64)
      const buffer = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i)
      }
      return buffer.buffer
    },
  }
}

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

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export async function getBirthProfile(userId: string) {
  const { data, error } = await supabase
    .from('birth_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

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

// ─── Get cached reading for a user (returns seed too) ────────────────────────
// updated_at is included so the store can determine whether the reading is stale
// (> 24 hours old) and trigger a silent background refresh if needed.
export async function getCachedReading(userId: string) {
  const { data, error } = await supabase
    .from('readings')
    .select('id, full_reading_text, reading_seed, reading_language, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { data, error }
}

// ─── Save reading with seed and language ─────────────────────────────────────
export async function saveReading(
  userId: string,
  payload: {
    full_reading_text: string
    past_statements: string[]
    western_data: object
    vedic_data: object
    chinese_data: object
    mayan_data: object
    all_systems_data: object
    reading_seed?: ReadingSeed | null
    reading_language?: string
  }
) {
  const { data, error } = await supabase
    .from('readings')
    .upsert({
      user_id: userId,
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  return { data, error }
}

// ─── Update reading seed after extraction ────────────────────────────────────
export async function updateReadingSeed(userId: string, seed: ReadingSeed) {
  const { error } = await supabase
    .from('readings')
    .update({ reading_seed: seed })
    .eq('user_id', userId)
  return { error }
  }

