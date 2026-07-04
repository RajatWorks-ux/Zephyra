// src/services/audioService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Global Audio Service — Phase 3
// Primary: NVIDIA Chatterbox-Multilingual TTS (nvapi- key)
// Fallback: expo-speech (always available, device voice)
// NO local TTS server. nvidiaAI.ts is DEAD — never imported here.
//
// Long-press interaction model:
//   - FloatingListenButton first tap → shows hint (does nothing else)
//   - Long-press on any text → speaks that text
//   - FloatingListenButton second tap (while playing) → stops all audio
// ─────────────────────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system'
import { Audio } from 'expo-av'
import * as Speech from 'expo-speech'
import { getKey, KEY_NVIDIA_TTS } from './secureKeyStore'

const NVIDIA_TTS_URL = 'https://integrate.api.nvidia.com/v1/audio/speech'
const NVIDIA_TTS_MODEL = 'nvidia/chatterbox-multilingual'

// ─── State ────────────────────────────────────────────────────────────────────
let currentSound: Audio.Sound | null = null
let isSpeaking = false

// ─── Stop everything ──────────────────────────────────────────────────────────
export async function stopAllAudio(): Promise<void> {
  isSpeaking = false
  if (currentSound) {
    try {
      await currentSound.stopAsync()
      await currentSound.unloadAsync()
    } catch { /* ignore */ }
    currentSound = null
  }
  try {
    Speech.stop()
  } catch { /* ignore */ }
}

// ─── Check if NVIDIA key is available ────────────────────────────────────────
export async function hasNvidiaTtsKey(): Promise<boolean> {
  const key = await getKey(KEY_NVIDIA_TTS)
  return Boolean(key && key.startsWith('nvapi-'))
}

// ─── Split text into ≤1800-char chunks at sentence boundaries ────────────────
function splitIntoChunks(text: string, maxChars = 1800): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?।])\s+/)
  let current = ''
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).length > maxChars && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current = current ? current + ' ' + sentence : sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

// ─── NVIDIA TTS: fetch binary MP3 → write to temp file → play ────────────────
async function playNvidia(text: string, langCode: string, voice: string): Promise<void> {
  const key = await getKey(KEY_NVIDIA_TTS)
  if (!key) throw new Error('No NVIDIA TTS key')

  const chunks = splitIntoChunks(text)

  for (const chunk of chunks) {
    if (!isSpeaking) break

    const response = await fetch(NVIDIA_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: NVIDIA_TTS_MODEL,
        input: chunk,
        voice: voice || 'alloy',
        language: langCode || 'en',
      }),
    })

    if (!response.ok) throw new Error(`NVIDIA TTS HTTP ${response.status}`)

    // Write binary MP3 to temp file (more reliable than base64 on Android)
    const tempPath = `${FileSystem.cacheDirectory}zephyra_tts_${Date.now()}.mp3`
    const arrayBuffer = await response.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i])
    }
    const base64 = btoa(binary)
    await FileSystem.writeAsStringAsync(tempPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    })

    if (!isSpeaking) {
      await FileSystem.deleteAsync(tempPath, { idempotent: true })
      break
    }

    // Set audio mode for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })

    const { sound } = await Audio.Sound.createAsync({ uri: tempPath })
    currentSound = sound

    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return
        if (status.didJustFinish || !isSpeaking) {
          resolve()
        }
      })
      sound.playAsync().catch(resolve)
    })

    try {
      await sound.unloadAsync()
    } catch { /* ignore */ }
    currentSound = null

    // Cleanup temp file
    FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {})
  }
}

// ─── expo-speech fallback ────────────────────────────────────────────────────
function playDeviceSpeech(text: string, langCode: string): Promise<void> {
  return new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: langCode || 'en-US',
      onDone: resolve,
      onError: resolve,
      onStopped: resolve,
    })
  })
}

// ─── Main speak function — called by long-press handlers ─────────────────────
export async function speakText(
  text: string,
  langCode = 'en-US',
  voice = 'alloy',
): Promise<{ provider: 'nvidia' | 'device' }> {
  if (!text?.trim()) return { provider: 'device' }

  // Stop any existing audio
  await stopAllAudio()
  isSpeaking = true

  const hasKey = await hasNvidiaTtsKey()

  try {
    if (hasKey) {
      await playNvidia(text.trim(), langCode, voice)
      return { provider: 'nvidia' }
    }
  } catch (e) {
    console.warn('[AudioService] NVIDIA TTS failed, falling back to device speech:', e)
  }

  // Fallback to expo-speech
  if (isSpeaking) {
    await playDeviceSpeech(text.trim(), langCode)
  }
  isSpeaking = false
  return { provider: 'device' }
}

// ─── Check if currently speaking ─────────────────────────────────────────────
export function getIsSpeaking(): boolean {
  return isSpeaking
}
