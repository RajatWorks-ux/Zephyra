// src/services/videoCache.ts
import * as FileSystem from 'expo-file-system'

const CACHE_DIR = `${FileSystem.cacheDirectory}zephyra_videos/`

const REMOTE: Record<string, string> = {
  splashBg:         'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/splash-bg.mp4',
  signInBg:         'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/signin-bg.mp4',
  phoneOtpBg:       'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/phone-bg.mp4',
  onboarding1:      'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/onboarding-1.mp4',
  onboarding2:      'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/onboarding-2.mp4',
  onboarding3:      'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/onboarding-3.mp4',
  loadingBg:        'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/loading-bg.mp4',
  emailVerifyBg:    'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/email-verify-bg.mp4',
  birthBg:          'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/birth-bg.mp4',
  forgotBg:         'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/forgot-bg.mp4',
  accountCreatedBg: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/account-created-bg.mp4',
  homeBg:           'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/home-bg.mp4',
  readingBg:        'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/reading-bg.mp4',
  forecastBg:       'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/forecast-bg.mp4',
  chartsBg:         'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/charts-bg.mp4',
}

async function downloadOne(key: string): Promise<void> {
  try {
    const local = CACHE_DIR + key + '.mp4'
    const info = await FileSystem.getInfoAsync(local)
    if (!info.exists) {
      await FileSystem.downloadAsync(REMOTE[key], local)
    }
    // Mutate the Videos object URI in-place — no screen changes needed
    Videos[key].uri = local
  } catch (e) {
    // Stays as remote URL — no crash
  }
}

export async function prefetchAllVideos() {
  await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true }).catch(() => {})
  await Promise.allSettled(Object.keys(REMOTE).map(downloadOne))
}

// ─── This is what all screens already import ─────────────────────────────────
// Shape is identical to before: { uri: string }
// First launch → remote URL (Supabase, one time only)
// Every launch after → local file, zero egress
export const Videos: Record<string, { uri: string }> = Object.fromEntries(
  Object.entries(REMOTE).map(([key, uri]) => [key, { uri }])
)

