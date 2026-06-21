// src/store/setupStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Controls whether the API setup wizard has been completed.
// Read from SecureStore on initialize. Controls RootNavigator routing.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import {
  isSetupComplete,
  markSetupComplete,
  clearAllKeys,
  getKey,
  KEY_OPENROUTER,
  KEY_NVIDIA_TTS,
  KEY_APPWRITE_ENDPOINT,
  KEY_R2_PUBLIC_BASE_URL,
} from '../services/secureKeyStore'

interface SetupStore {
  // State
  isSetupComplete: boolean
  openRouterKeyValid: boolean
  nvidiaKeyValid: boolean
  appwriteConnected: boolean
  r2Connected: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  setSetupComplete: () => Promise<void>
  resetSetup: () => Promise<void>
  setOpenRouterKeyValid: (v: boolean) => void
  setNvidiaKeyValid: (v: boolean) => void
  setAppwriteConnected: (v: boolean) => void
  setR2Connected: (v: boolean) => void
}

export const useSetupStore = create<SetupStore>((set, get) => ({
  isSetupComplete: false,
  openRouterKeyValid: false,
  nvidiaKeyValid: false,
  appwriteConnected: false,
  r2Connected: false,
  isInitialized: false,

  initialize: async () => {
    const [complete, openRouterKey, nvidiaKey, appwriteEndpoint, r2Url] = await Promise.all([
      isSetupComplete(),
      getKey(KEY_OPENROUTER),
      getKey(KEY_NVIDIA_TTS),
      getKey(KEY_APPWRITE_ENDPOINT),
      getKey(KEY_R2_PUBLIC_BASE_URL),
    ])
    set({
      isSetupComplete: complete,
      openRouterKeyValid: !!openRouterKey,
      nvidiaKeyValid: !!nvidiaKey,
      appwriteConnected: !!appwriteEndpoint,
      r2Connected: !!r2Url,
      isInitialized: true,
    })
  },

  setSetupComplete: async () => {
    await markSetupComplete()
    set({ isSetupComplete: true })
  },

  resetSetup: async () => {
    await clearAllKeys()
    set({
      isSetupComplete: false,
      openRouterKeyValid: false,
      nvidiaKeyValid: false,
      appwriteConnected: false,
      r2Connected: false,
    })
  },

  setOpenRouterKeyValid: (v) => set({ openRouterKeyValid: v }),
  setNvidiaKeyValid: (v) => set({ nvidiaKeyValid: v }),
  setAppwriteConnected: (v) => set({ appwriteConnected: v }),
  setR2Connected: (v) => set({ r2Connected: v }),
}))

