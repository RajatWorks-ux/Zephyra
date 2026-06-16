// src/services/videoCache.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: Videos now served from YOUR Cloudflare R2 bucket.
// On first launch: downloads each video to device cache.
// After that: plays from local cache — fast, no bandwidth cost.
// If R2 URL is missing or fails: falls back gracefully (screen works without video).
//
// TO FILL IN: Replace each R2_PLACEHOLDER_URL below with your actual R2 URLs.
// Format: https://pub-YOURCODE.r2.dev/FILENAME.mp4
// ─────────────────────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system'

const CACHE_DIR = `${FileSystem.cacheDirectory}zephyra_videos/`

// ── YOUR R2 PUBLIC BUCKET BASE URL ───────────────────────────────────────────
// After you create your Cloudflare R2 bucket, paste your public base URL here.
// Example: const R2_BASE = 'https://pub-abc123def456.r2.dev'
const R2_BASE = 'https://YOUR_R2_BUCKET_URL_HERE'  // ← FILL THIS IN

// ── Video filenames — upload these exact filenames to your R2 bucket ──────────
// When you upload videos to R2, name them exactly as shown here.
const REMOTE: Record<string, string> = {
  splashBg:         `${R2_BASE}/splash-bg.mp4`,
  signInBg:         `${R2_BASE}/signin-bg.mp4`,
  phoneOtpBg:       `${R2_BASE}/phone-bg.mp4`,
  onboarding1:      `${R2_BASE}/onboarding-1.mp4`,
  onboarding2:      `${R2_BASE}/onboarding-2.mp4`,
  onboarding3:      `${R2_BASE}/onboarding-3.mp4`,
  loadingBg:        `${R2_BASE}/loading-bg.mp4`,
  emailVerifyBg:    `${R2_BASE}/email-verify-bg.mp4`,
  birthBg:          `${R2_BASE}/birth-bg.mp4`,
  forgotBg:         `${R2_BASE}/forgot-bg.mp4`,
  accountCreatedBg: `${R2_BASE}/account-created-bg.mp4`,
  homeBg:           `${R2_BASE}/home-bg.mp4`,
  readingBg:        `${R2_BASE}/reading-bg.mp4`,
  forecastBg:       `${R2_BASE}/forecast-bg.mp4`,
  chartsBg:         `${R2_BASE}/charts-bg.mp4`,
  chatBg:           `${R2_BASE}/chat-bg.mp4`,
  setupBg:          `${R2_BASE}/setup-bg.mp4`,
}

// ── Check if R2 is configured ─────────────────────────────────────────────────
const R2_CONFIGURED = !R2_BASE.includes('YOUR_R2_BUCKET_URL_HERE')

async function downloadOne(key: string): Promise<void> {
  if (!R2_CONFIGURED) return  // Skip download if R2 not set up yet
  try {
    const local = CACHE_DIR + key + '.mp4'
    const info = await FileSystem.getInfoAsync(local)
    if (!info.exists) {
      console.log(`[Zephyra] Downloading video: ${key}`)
      await FileSystem.downloadAsync(REMOTE[key], local)
      console.log(`[Zephyra] ✓ Cached: ${key}`)
    }
    Videos[key].uri = local
  } catch (e: any) {
    // R2 download failed — keeps using remote URL (graceful fallback)
    console.warn(`[Zephyra] Video cache failed for ${key}:`, e.message)
  }
}

export async function prefetchAllVideos(): Promise<void> {
  if (!R2_CONFIGURED) {
    console.log('[Zephyra] R2 not configured — skipping video prefetch. App works without videos.')
    return
  }
  try {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true })
  } catch {}
  // Download all videos in parallel (on first launch only — cached versions used after)
  await Promise.allSettled(Object.keys(REMOTE).map(downloadOne))
  console.log('[Zephyra] ✓ All videos prefetched')
}

export async function getVideoCacheSize(): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR, { size: true })
    return (info as any).size ?? 0
  } catch { return 0 }
}

export async function clearVideoCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true })
  } catch {}
}

// ─── This is what all screens already import ─────────────────────────────────
// { uri: string } — screens don't need to change at all
// First launch → remote R2 URL
// After first launch → local cached file path
// If R2 not configured → uri is a placeholder (Video component handles gracefully)
export const Videos: Record<string, { uri: string }> = Object.fromEntries(
  Object.entries(REMOTE).map(([key, uri]) => [key, { uri }])
)

