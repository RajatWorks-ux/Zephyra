// src/tasks/dailyResetTask.ts
//
// Background task that triggers a silent full AI refresh once daily.
// Registered via expo-background-fetch — fires roughly every hour (iOS/Android
// may throttle, so the actual interval is a minimum, not a guarantee).
//
// The task itself checks whether a real refresh is needed (7 AM logic lives in
// the store) before doing any work, so even if the OS fires it more frequently
// it remains cheap.

import * as TaskManager from 'expo-task-manager'
import * as BackgroundFetch from 'expo-background-fetch'
import { useReadingStore } from '../store/readingStore'

// ─── Task name constant ────────────────────────────────────────────────────────
export const ZEPHYRA_DAILY_RESET = 'ZEPHYRA_DAILY_RESET'

// ─── Task definition ──────────────────────────────────────────────────────────
// Must be called at the module's top level (outside any component or function)
// so Expo Task Manager can register it before the JS bundle evaluates fully.
TaskManager.defineTask(ZEPHYRA_DAILY_RESET, async () => {
  console.log('[TASK] ZEPHYRA_DAILY_RESET fired')

  try {
    const { silentRefresh, silentlyRefreshing, reading, chartData, currentUserId } =
      useReadingStore.getState()

    // Nothing to refresh yet — user hasn't generated a reading
    if (!reading || !chartData || !currentUserId) {
      console.log('[TASK] No reading/chartData/userId in store — skipping')
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    // Another refresh is already running — skip
    if (silentlyRefreshing) {
      console.log('[TASK] silentlyRefreshing already true — skipping')
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    // birthProfile is embedded in chartData
    const birthProfile = chartData.birthProfile
    if (!birthProfile) {
      console.log('[TASK] No birthProfile on chartData — skipping')
      return BackgroundFetch.BackgroundFetchResult.NoData
    }

    console.log('[TASK] Triggering silentRefresh for userId:', currentUserId)
    await silentRefresh(currentUserId, birthProfile)

    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch (e) {
    console.error('[TASK] ZEPHYRA_DAILY_RESET crashed:', e)
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

// ─── Registration helper ──────────────────────────────────────────────────────
// Call once from App.tsx after fonts load. Safe to call multiple times —
// if already registered, expo-background-fetch is a no-op.
export async function registerDailyResetTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(ZEPHYRA_DAILY_RESET)
  if (isRegistered) {
    console.log('[TASK] ZEPHYRA_DAILY_RESET already registered — skipping')
    return
  }

  await BackgroundFetch.registerTaskAsync(ZEPHYRA_DAILY_RESET, {
    minimumInterval: 3600,   // 1 hour — OS may fire less frequently
    stopOnTerminate: false,  // Keep running after app is force-closed (Android)
    startOnBoot: true,       // Re-register after device reboot (Android)
  })

  console.log('[TASK] ZEPHYRA_DAILY_RESET registered successfully')
}
