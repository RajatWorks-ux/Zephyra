// src/store/adminStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Admin panel state — Phase 3
// Security: 7-tap → biometric → device whitelist → PIN
// Simple, no analytics complexity in Phase 3
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'

interface AdminState {
  isAdminMode: boolean
  tapCount: number
  lastTapTime: number
  isCheckingWhitelist: boolean

  // 7-tap detection
  registerTap: () => boolean  // returns true if 7 taps reached within 3s
  resetTaps: () => void

  // Admin mode
  setAdminMode: (v: boolean) => void
  clearAdminMode: () => void
}

export const useAdminStore = create<AdminState>((set, get) => ({
  isAdminMode: false,
  tapCount: 0,
  lastTapTime: 0,
  isCheckingWhitelist: false,

  registerTap: () => {
    const now = Date.now()
    const { tapCount, lastTapTime } = get()

    // Reset if more than 3 seconds since last tap
    if (now - lastTapTime > 3000) {
      set({ tapCount: 1, lastTapTime: now })
      return false
    }

    const newCount = tapCount + 1
    set({ tapCount: newCount, lastTapTime: now })

    if (newCount >= 7) {
      set({ tapCount: 0 })
      return true  // signal to trigger biometric
    }
    return false
  },

  resetTaps: () => set({ tapCount: 0, lastTapTime: 0 }),

  setAdminMode: (v) => set({ isAdminMode: v }),
  clearAdminMode: () => set({ isAdminMode: false }),
}))
