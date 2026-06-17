// src/services/videoService.ts
// ─────────────────────────────────────────────────────────────────────────────
// Re-export wrapper so useVideoSource.ts import works correctly.
// All actual logic lives in videoCache.ts — this is the named-export bridge.
// ─────────────────────────────────────────────────────────────────────────────
import * as FileSystem from 'expo-file-system'
import { Videos } from '../constants/videos'

const CACHE_DIR = `${FileSystem.cacheDirectory}zephyra_videos/`

// ── Read R2 base URL from videoCache config ───────────────────────────────────
// We import the same constant videoCache uses to stay in sync
let _r2FailureCount = 0
let _r2LastFailureTime = 0
const R2_FAILURE_COOLDOWN_MS = 5 * 60 * 1000

// ── getVideoSource — used by useVideoSource hook ───────────────────────────────
export async function getVideoSource(videoName: string): Promise<{ uri: string } | number> {
  // Check if cached version exists on device
  const cachedPath = await getCachedVideoPath(videoName)
  if (cachedPath) return { uri: cachedPath }

  // Check R2 failure cooldown
  if (_r2FailureCount >= 3 && Date.now() - _r2LastFailureTime < R2_FAILURE_COOLDOWN_MS) {
    return (Videos as any)[videoName] ?? Videos.signInBg
  }

  // Return R2 URI from Videos object (populated by videoCache.ts)
  const videoEntry = (Videos as any)[videoName]
  if (videoEntry?.uri && !videoEntry.uri.includes('YOUR_R2_BUCKET_URL_HERE')) {
    return { uri: videoEntry.uri }
  }

  // R2 not configured — return local asset
  return videoEntry ?? Videos.signInBg
}

// ── preloadVideo — downloads and caches a video ────────────────────────────────
export async function preloadVideo(videoName: string): Promise<void> {
  const videoEntry = (Videos as any)[videoName]
  if (!videoEntry?.uri || videoEntry.uri.includes('YOUR_R2_BUCKET_URL_HERE')) return

  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
    const destPath = `${CACHE_DIR}${videoName}.mp4`
    const info = await FileSystem.getInfoAsync(destPath)
    if (!info.exists) {
      await FileSystem.downloadAsync(videoEntry.uri, destPath)
    }
  } catch (e: any) {
    console.warn(`[videoService] preload failed for ${videoName}:`, e.message)
    _r2FailureCount++
    _r2LastFailureTime = Date.now()
  }
}

// ── getCachedVideoPath — returns local path if exists, null if not ─────────────
export async function getCachedVideoPath(videoName: string): Promise<string | null> {
  try {
    const path = `${CACHE_DIR}${videoName}.mp4`
    const info = await FileSystem.getInfoAsync(path)
    return info.exists ? path : null
  } catch { return null }
}

// ── clearVideoCache — removes all cached videos ────────────────────────────────
export async function clearVideoCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
    console.log('[videoService] Video cache cleared')
  } catch {}
}

// ── getVideoCacheSize — returns total bytes cached ────────────────────────────
export async function getVideoCacheSize(): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR, { size: true })
    return (info as any).size ?? 0
  } catch { return 0 }
}

// ── reportR2Failure — called by useVideoSource onError ────────────────────────
export function reportR2Failure(): void {
  _r2FailureCount++
  _r2LastFailureTime = Date.now()
  console.warn(`[videoService] R2 failure #${_r2FailureCount}`)
}

// ── resetR2Failures — call when R2 URL changes ────────────────────────────────
export function resetR2Failures(): void {
  _r2FailureCount = 0
  _r2LastFailureTime = 0
}
