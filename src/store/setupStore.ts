// src/store/setupStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Controls whether the 7-step API setup wizard has been completed.
// Read from SecureStore on initialize. Controls RootNavigator routing.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import {
  isSetupComplete,
  markSetupComplete,
  clearAllKeys,
  getKey,
  KEY_GROQ_1,
  KEY_GROQ_2,
  KEY_NVIDIA_TTS,
  KEY_APPWRITE_ENDPOINT,
  KEY_R2_PUBLIC_BASE_URL,
} from '../services/secureKeyStore'

interface SetupStore {
  // State
  isSetupComplete: boolean
  groqKey1Valid: boolean
  groqKey2Valid: boolean
  nvidiaKeyValid: boolean
  appwriteConnected: boolean
  r2Connected: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  setSetupComplete: () => Promise<void>
  resetSetup: () => Promise<void>
  setGroqKey1Valid: (v: boolean) => void
  setGroqKey2Valid: (v: boolean) => void
  setNvidiaKeyValid: (v: boolean) => void
  setAppwriteConnected: (v: boolean) => void
  setR2Connected: (v: boolean) => void
}

export const useSetupStore = create<SetupStore>((set, get) => ({
  isSetupComplete: false,
  groqKey1Valid: false,
  groqKey2Valid: false,
  nvidiaKeyValid: false,
  appwriteConnected: false,
  r2Connected: false,
  isInitialized: false,

  initialize: async () => {
    const [complete, key1, key2, nvidiaKey, appwriteEndpoint, r2Url] = await Promise.all([
      isSetupComplete(),
      getKey(KEY_GROQ_1),
      getKey(KEY_GROQ_2),
      getKey(KEY_NVIDIA_TTS),
      getKey(KEY_APPWRITE_ENDPOINT),
      getKey(KEY_R2_PUBLIC_BASE_URL),
    ])
    set({
      isSetupComplete: complete,
      groqKey1Valid: !!key1,
      groqKey2Valid: !!key2,
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
      groqKey1Valid: false,
      groqKey2Valid: false,
      nvidiaKeyValid: false,
      appwriteConnected: false,
      r2Connected: false,
    })
  },

  setGroqKey1Valid: (v) => set({ groqKey1Valid: v }),
  setGroqKey2Valid: (v) => set({ groqKey2Valid: v }),
  setNvidiaKeyValid: (v) => set({ nvidiaKeyValid: v }),
  setAppwriteConnected: (v) => set({ appwriteConnected: v }),
  setR2Connected: (v) => set({ r2Connected: v }),
}))
