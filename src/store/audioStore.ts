// src/store/audioStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// Global audio state — Phase 3
// Long-press model: no speaker buttons everywhere.
// One floating button per screen shows hint on 1st tap, stops on 2nd.
// Actual speaking happens via long-press on any text component.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const VOICE_KEY = 'zephyra_tts_voice'

export type TtsVoice = 'alloy' | 'echo' | 'nova' | 'shimmer'
export type TtsProvider = 'nvidia' | 'device'

interface AudioState {
  isPlaying: boolean
  currentText: string
  currentSource: string
  provider: TtsProvider
  selectedVoice: TtsVoice
  isLoadingAudio: boolean
  // Hint state for FloatingListenButton
  hintVisible: boolean
  hintShownCount: number

  setIsPlaying: (v: boolean) => void
  setCurrentText: (text: string, source: string) => void
  setProvider: (p: TtsProvider) => void
  setSelectedVoice: (v: TtsVoice) => Promise<void>
  setIsLoading: (v: boolean) => void
  showHint: () => void
  hideHint: () => void
  reset: () => void
  loadVoice: () => Promise<void>
}

export const useAudioStore = create<AudioState>((set, get) => ({
  isPlaying: false,
  currentText: '',
  currentSource: '',
  provider: 'device',
  selectedVoice: 'alloy',
  isLoadingAudio: false,
  hintVisible: false,
  hintShownCount: 0,

  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentText: (text, source) => set({ currentText: text, currentSource: source }),
  setProvider: (p) => set({ provider: p }),

  setSelectedVoice: async (v) => {
    set({ selectedVoice: v })
    try { await AsyncStorage.setItem(VOICE_KEY, v) } catch { /* ignore */ }
  },

  setIsLoading: (v) => set({ isLoadingAudio: v }),

  showHint: () => {
    set(s => ({ hintVisible: true, hintShownCount: s.hintShownCount + 1 }))
    // Auto-hide after 2.5 seconds
    setTimeout(() => set({ hintVisible: false }), 2500)
  },

  hideHint: () => set({ hintVisible: false }),

  reset: () => set({ isPlaying: false, currentText: '', currentSource: '', isLoadingAudio: false }),

  loadVoice: async () => {
    try {
      const saved = await AsyncStorage.getItem(VOICE_KEY)
      if (saved) set({ selectedVoice: saved as TtsVoice })
    } catch { /* ignore */ }
  },
}))
