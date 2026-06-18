// src/services/supabase.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 — Back on Supabase (new project)
// Fill in your new Supabase URL and anon key in .env
// ─────────────────────────────────────────────────────────────────────────────
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'
import * as Crypto from 'expo-crypto'
import type { ReadingSeed } from '../types'

// ── WebCrypto polyfill for Expo Go ────────────────────────────────────────────
if (typeof global.crypto === 'undefined') { (global as any).crypto = {} }
if (typeof global.crypto.getRandomValues === 'undefined') {
  (global as any).crypto.getRandomValues = (array: Uint8Array) => {
    const bytes = Crypto.getRandomBytes(array.length)
    array.set(bytes)
    return array
  }
}
if (typeof global.crypto.subtle === 'undefined') {
  (global as any).crypto.subtle = {
    digest: async (_algorithm: string, data: ArrayBuffer) => {
      const base64 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        String.fromCharCode(...new Uint8Array(data)),
        { encoding: Crypto.CryptoEncoding.BASE64 },
      )
      const binary = atob(base64)
      const buffer = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
      return buffer.buffer
    },
  }
}

// ── Your NEW Supabase project credentials ─────────────────────────────────────
// After creating the new project paste the URL and anon key into .env
const supabaseUrl      = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

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
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})

// ════════════════════════════════════════════════════════════════════════════
// PROFILES
// ════════════════════════════════════════════════════════════════════════════

export async function getUserProfile(userId: string) {
  return supabase.from('profiles').select('*').eq('id', userId).single()
}

export async function saveUserProfile(userId: string, data: Partial<{
  display_name: string
  avatar_url: string
  auth_provider: string
}>) {
  return supabase.from('profiles').upsert({ id: userId, ...data }, { onConflict: 'id' }).select().single()
}

// ════════════════════════════════════════════════════════════════════════════
// BIRTH PROFILES
// ════════════════════════════════════════════════════════════════════════════

export async function getBirthProfile(userId: string) {
  return supabase.from('birth_profiles').select('*').eq('user_id', userId).single()
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
  },
) {
  return supabase.from('birth_profiles').insert({ user_id: userId, ...birthData }).select().single()
}

// ════════════════════════════════════════════════════════════════════════════
// READINGS
// ════════════════════════════════════════════════════════════════════════════

export async function getCachedReading(userId: string) {
  return supabase
    .from('readings')
    .select('id, full_reading_text, reading_seed, reading_language, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
}

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
  },
) {
  return supabase
    .from('readings')
    .upsert({ user_id: userId, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single()
}

export async function updateReadingSeed(userId: string, seed: ReadingSeed) {
  return supabase.from('readings').update({ reading_seed: seed }).eq('user_id', userId)
}

// ════════════════════════════════════════════════════════════════════════════
// USER PREFERENCES
// ════════════════════════════════════════════════════════════════════════════

export async function getUserPreferences(userId: string) {
  return supabase.from('user_preferences').select('*').eq('user_id', userId).single()
}

export async function saveUserPreferences(userId: string, prefs: Record<string, unknown>) {
  return supabase
    .from('user_preferences')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
}

// ════════════════════════════════════════════════════════════════════════════
// CHAT SESSIONS + MESSAGES
// ════════════════════════════════════════════════════════════════════════════

export async function saveChatSession(userId: string, title: string, contextType: string, person2Id?: string) {
  return supabase.from('chat_sessions').insert({
    user_id: userId, title, context_type: contextType,
    person2_id: person2Id ?? null,
    last_message_at: new Date().toISOString(),
  }).select().single()
}

export async function getChatSessions(userId: string) {
  return supabase.from('chat_sessions').select('*').eq('user_id', userId).order('last_message_at', { ascending: false }).limit(50)
}

export async function deleteChatSession(sessionId: string) {
  await supabase.from('chat_messages').delete().eq('session_id', sessionId)
  return supabase.from('chat_sessions').delete().eq('id', sessionId)
}

export async function updateChatSessionTitle(sessionId: string, title: string) {
  return supabase.from('chat_sessions').update({ title }).eq('id', sessionId)
}

export async function saveChatMessage(sessionId: string, role: string, content: string) {
  const now = new Date().toISOString()
  const msg = await supabase.from('chat_messages').insert({ session_id: sessionId, role, content, created_at: now }).select().single()
  await supabase.from('chat_sessions').update({ last_message_at: now }).eq('id', sessionId)
  return msg
}

export async function getChatMessages(sessionId: string) {
  return supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }).limit(500)
}

// ════════════════════════════════════════════════════════════════════════════
// READING HISTORY
// ════════════════════════════════════════════════════════════════════════════

export async function saveReadingHistoryLog(userId: string, entry: Record<string, unknown>) {
  return supabase.from('reading_history_log').insert({ user_id: userId, ...entry, generated_at: new Date().toISOString() })
}

export async function getReadingHistory(userId: string) {
  return supabase.from('reading_history_log').select('*').eq('user_id', userId).order('generated_at', { ascending: false }).limit(50)
}

// ════════════════════════════════════════════════════════════════════════════
// FORECASTS
// ════════════════════════════════════════════════════════════════════════════

export async function saveForecast(userId: string, forecastType: string, forecastDate: string, contentJson: object) {
  return supabase.from('forecasts').upsert({
    user_id: userId, forecast_type: forecastType, forecast_date: forecastDate, content_json: contentJson,
  }, { onConflict: 'user_id,forecast_type,forecast_date' })
}

export async function getForecast(userId: string, forecastType: string, forecastDate: string) {
  return supabase.from('forecasts').select('*').eq('user_id', userId).eq('forecast_type', forecastType).eq('forecast_date', forecastDate).maybeSingle()
}

// ════════════════════════════════════════════════════════════════════════════
// API KEY CLOUD BACKUP (encrypted — survives app reinstall)
// Keys are stored server-side encrypted with the user's own UID as salt.
// Table: user_api_keys (user_id, key1_enc, key2_enc, updated_at)
// The user's UID is the only decryption context — no plaintext keys ever stored.
// ════════════════════════════════════════════════════════════════════════════

function xorObfuscate(text: string, salt: string): string {
  // Simple XOR with repeating salt — keeps keys non-plaintext in DB
  // Not cryptographically secure but prevents trivial DB read
  let result = ''
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ salt.charCodeAt(i % salt.length))
  }
  return btoa(result)
}

function xorDeobfuscate(encoded: string, salt: string): string {
  try {
    const text = atob(encoded)
    let result = ''
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ salt.charCodeAt(i % salt.length))
    }
    return result
  } catch {
    return ''
  }
}

export async function backupApiKeysToCloud(
  userId: string,
  groqKey1: string,
  groqKey2: string,
): Promise<void> {
  if (!userId || !groqKey1) return
  try {
    const salt = userId.replace(/-/g, '')
    const k1enc = xorObfuscate(groqKey1, salt)
    const k2enc = groqKey2 ? xorObfuscate(groqKey2, salt) : ''
    await supabase.from('user_api_keys').upsert(
      { user_id: userId, key1_enc: k1enc, key2_enc: k2enc, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  } catch (e) {
    console.warn('[Zephyra] API key backup failed (non-fatal):', e)
  }
}

export async function restoreApiKeysFromCloud(
  userId: string,
): Promise<{ key1: string; key2: string } | null> {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('key1_enc, key2_enc')
      .eq('user_id', userId)
      .single()
    if (error || !data) return null
    const salt = userId.replace(/-/g, '')
    const key1 = xorDeobfuscate(data.key1_enc ?? '', salt)
    const key2 = xorDeobfuscate(data.key2_enc ?? '', salt)
    if (!key1 || !key1.startsWith('gsk_')) return null
    return { key1, key2: key2.startsWith('gsk_') ? key2 : '' }
  } catch (e) {
    console.warn('[Zephyra] API key restore failed:', e)
    return null
  }
}

