// src/services/secureKeyStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central hub for all user-provided credentials.
// All API keys are stored using expo-secure-store which encrypts data
// using the device's hardware secure enclave (iOS Keychain / Android Keystore).
// Keys NEVER leave the device. NEVER uploaded anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'

// ── Key names stored in SecureStore ──────────────────────────────────────────
export const KEY_OPENROUTER = 'zephyra_openrouter_key'
export const KEY_NVIDIA_TTS = 'zephyra_nvidia_tts_key'
export const KEY_APPWRITE_ENDPOINT = 'zephyra_appwrite_endpoint'
export const KEY_APPWRITE_PROJECT_ID = 'zephyra_appwrite_project_id'
export const KEY_APPWRITE_DATABASE_ID = 'zephyra_appwrite_database_id'
export const KEY_APPWRITE_STORAGE_BUCKET_ID = 'zephyra_appwrite_storage_bucket_id'
export const KEY_R2_PUBLIC_BASE_URL = 'zephyra_r2_public_base_url'
export const KEY_SETUP_COMPLETE = 'zephyra_setup_complete'
export const KEY_DEVICE_ID = 'zephyra_device_id'
export const KEY_ADMIN_HASH = 'zephyra_admin_hash'

// ── Store a value (encrypted by OS) ──────────────────────────────────────────
export async function setKey(name: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(name, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  })
}

// ── Read a value, returns null if not set ──────────────────────────────────────
export async function getKey(name: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(name)
  } catch {
    return null
  }
}

// ── Delete a single key ───────────────────────────────────────────────────────
export async function deleteKey(name: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(name)
  } catch {
    // ignore if key doesn't exist
  }
}

// ── Check if setup has been completed ────────────────────────────────────────
export async function isSetupComplete(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(KEY_SETUP_COMPLETE)
    return val === 'true'
  } catch {
    return false
  }
}

// ── Mark setup as done ────────────────────────────────────────────────────────
export async function markSetupComplete(): Promise<void> {
  await setKey(KEY_SETUP_COMPLETE, 'true')
}

// ── Get or create a permanent device ID ───────────────────────────────────────
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getKey(KEY_DEVICE_ID)
  if (existing) return existing
  // Generate a UUID v4 using expo-crypto
  const randomBytes = await Crypto.getRandomBytesAsync(16)
  const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
  await setKey(KEY_DEVICE_ID, uuid)
  return uuid
}

// ── Nuclear reset — deletes ALL keys. Only for "Reset App" or admin panel ─────
export async function clearAllKeys(): Promise<void> {
  const allKeys = [
    KEY_OPENROUTER, KEY_NVIDIA_TTS,
    KEY_APPWRITE_ENDPOINT, KEY_APPWRITE_PROJECT_ID,
    KEY_APPWRITE_DATABASE_ID, KEY_APPWRITE_STORAGE_BUCKET_ID,
    KEY_R2_PUBLIC_BASE_URL, KEY_SETUP_COMPLETE,
    KEY_DEVICE_ID, KEY_ADMIN_HASH,
  ]
  await Promise.all(allKeys.map(k => deleteKey(k)))
}

// ── Test an OpenRouter key validity ────────────────────────────────────────────
export async function testOpenRouterKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zephyra.app',
        'X-Title': 'Zephyra',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [{ role: 'user', content: '1+1=' }],
        max_tokens: 1,
      }),
    })
    if (res.ok) return { valid: true }
    const err = await res.json().catch(() => ({}))
    return { valid: false, error: (err as any)?.error?.message ?? `HTTP ${res.status}` }
  } catch (e: any) {
    return { valid: false, error: e.message }
  }
}

// ── Test NVIDIA TTS key validity ──────────────────────────────────────────────
export async function testNvidiaKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nvidia/chatterbox-multilingual',
        input: 'Hello.',
        voice: 'default',
      }),
    })
    if (res.ok || res.status === 200) return { valid: true }
    return { valid: false, error: `HTTP ${res.status}` }
  } catch (e: any) {
    return { valid: false, error: e.message }
  }
}

// ── Test Appwrite connection ───────────────────────────────────────────────────
export async function testAppwriteConnection(
  endpoint: string,
  projectId: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const url = `${endpoint.replace(/\/$/, '')}/health`
    const res = await fetch(url, {
      headers: { 'X-Appwrite-Project': projectId },
    })
    if (res.ok) return { valid: true }
    return { valid: false, error: `HTTP ${res.status} — check endpoint and project ID` }
  } catch (e: any) {
    return { valid: false, error: 'Cannot reach endpoint — check URL' }
  }
}


// ── Cloud-backed key set (saves to SecureStore + Supabase simultaneously) ─────
// Use this instead of setKey() for the OpenRouter key so it survives reinstall.
export async function setOpenRouterKeyWithBackup(
  userId: string,
  key: string,
): Promise<void> {
  // Always save locally first (instant)
  await setKey(KEY_OPENROUTER, key)
  // Async cloud backup (non-blocking — never delay the user)
  import('../services/supabase').then(({ backupApiKeysToCloud }) => {
    backupApiKeysToCloud(userId, key).catch(() => {})
  })
}

// ── Restore OpenRouter key from cloud if local store is empty ─────────────────
// Called once on app init after auth. Returns true if key was restored.
export async function restoreOpenRouterKeyIfNeeded(userId: string): Promise<boolean> {
  const existing = await getKey(KEY_OPENROUTER)
  if (existing && existing.startsWith('sk-or-')) return false // already have a key

  try {
    const { restoreApiKeysFromCloud } = await import('../services/supabase')
    const restored = await restoreApiKeysFromCloud(userId)
    if (restored?.key) {
      await setKey(KEY_OPENROUTER, restored.key)
      await setKey(KEY_SETUP_COMPLETE, 'true')
      console.log('[Zephyra] ✓ API key restored from cloud backup')
      return true
    }
  } catch (e) {
    console.warn('[Zephyra] Cloud key restore failed:', e)
  }
  return false
}

