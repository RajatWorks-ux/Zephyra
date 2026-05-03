// src/store/settingsStore.ts
// Persists user language preference and TTS setting across sessions.

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Language } from '../types'

const LANGUAGE_STORAGE_KEY = 'zephyra_selected_language'
const TTS_STORAGE_KEY = 'zephyra_tts_enabled'

// ─── Language Master List ──────────────────────────────────────────────────────
export const LANGUAGES: Language[] = [
  {
    code: 'en-US',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    promptInstruction: 'Write all content in clear, warm, conversational American English.',
  },
  {
    code: 'hi-IN',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Hindi, using Devanagari script. Use warm, conversational language.',
  },
  {
    code: 'hinglish',
    name: 'Hinglish',
    nativeName: 'Hinglish',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Hinglish — a natural, fluid mix of Hindi and English written entirely in Roman script (no Devanagari). Use conversational Hindi phrases naturally blended with English. Example style: "Teri life mein ek bada change aane wala hai, aur yeh change tujhe bahut kuch sikhayega. Tere andar jo strength hai, use abhi puri tarah se explore nahi kiya tune." Keep it warm and personal.',
  },
  {
    code: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    promptInstruction: 'Write all content in Spanish. Use warm, poetic, conversational Spanish.',
  },
  {
    code: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    promptInstruction: 'Write all content in French. Use warm, elegant, conversational French.',
  },
  {
    code: 'ar-SA',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    promptInstruction: 'Write all content in Modern Standard Arabic. Use clear, warm, spiritual language.',
  },
  {
    code: 'pt-BR',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    promptInstruction: 'Write all content in Brazilian Portuguese. Use warm, conversational language.',
  },
  {
    code: 'bn-BD',
    name: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🇧🇩',
    promptInstruction: 'Write all content in Bengali using Bengali script. Use warm, conversational language.',
  },
  {
    code: 'ur-PK',
    name: 'Urdu',
    nativeName: 'اردو',
    flag: '🇵🇰',
    promptInstruction: 'Write all content in Urdu using Nastaliq script. Use poetic, warm language.',
  },
  {
    code: 'ru-RU',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    promptInstruction: 'Write all content in Russian. Use warm, conversational Russian.',
  },
  {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    promptInstruction: 'Write all content in Japanese. Use warm, respectful Japanese with appropriate kanji and hiragana.',
  },
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
    promptInstruction: 'Write all content in Simplified Chinese. Use warm, clear Mandarin.',
  },
  {
    code: 'zh-TW',
    name: 'Chinese (Traditional)',
    nativeName: '繁體中文',
    flag: '🇹🇼',
    promptInstruction: 'Write all content in Traditional Chinese. Use warm, clear Mandarin.',
  },
  {
    code: 'ko-KR',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    promptInstruction: 'Write all content in Korean. Use warm, respectful Korean.',
  },
  {
    code: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    promptInstruction: 'Write all content in German. Use warm, clear, conversational German.',
  },
  {
    code: 'it-IT',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    promptInstruction: 'Write all content in Italian. Use warm, expressive Italian.',
  },
  {
    code: 'tr-TR',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    promptInstruction: 'Write all content in Turkish. Use warm, conversational Turkish.',
  },
  {
    code: 'vi-VN',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    promptInstruction: 'Write all content in Vietnamese. Use warm, conversational Vietnamese.',
  },
  {
    code: 'th-TH',
    name: 'Thai',
    nativeName: 'ภาษาไทย',
    flag: '🇹🇭',
    promptInstruction: 'Write all content in Thai. Use warm, respectful Thai.',
  },
  {
    code: 'ms-MY',
    name: 'Malay',
    nativeName: 'Bahasa Melayu',
    flag: '🇲🇾',
    promptInstruction: 'Write all content in Malay. Use warm, conversational Bahasa Melayu.',
  },
  {
    code: 'ta-IN',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Tamil using Tamil script. Use warm language.',
  },
  {
    code: 'te-IN',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Telugu using Telugu script. Use warm language.',
  },
  {
    code: 'kn-IN',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Kannada using Kannada script. Use warm language.',
  },
  {
    code: 'mr-IN',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Marathi using Devanagari script. Use warm language.',
  },
  {
    code: 'gu-IN',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Gujarati using Gujarati script. Use warm language.',
  },
  {
    code: 'pa-IN',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳',
    promptInstruction: 'Write all content in Punjabi using Gurmukhi script. Use warm language.',
  },
  {
    code: 'sw-KE',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    flag: '🇰🇪',
    promptInstruction: 'Write all content in Swahili. Use warm, conversational Swahili.',
  },
  {
    code: 'fa-IR',
    name: 'Persian / Farsi',
    nativeName: 'فارسی',
    flag: '🇮🇷',
    promptInstruction: 'Write all content in Persian (Farsi) using Persian script. Use warm, poetic language.',
  },
  {
    code: 'nl-NL',
    name: 'Dutch',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    promptInstruction: 'Write all content in Dutch. Use warm, conversational Dutch.',
  },
  {
    code: 'pl-PL',
    name: 'Polish',
    nativeName: 'Polski',
    flag: '🇵🇱',
    promptInstruction: 'Write all content in Polish. Use warm, conversational Polish.',
  },
  {
    code: 'id-ID',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    promptInstruction: 'Write all content in Indonesian. Use warm, conversational Bahasa Indonesia.',
  },
  {
    code: 'el-GR',
    name: 'Greek',
    nativeName: 'Ελληνικά',
    flag: '🇬🇷',
    promptInstruction: 'Write all content in Greek. Use warm, conversational Greek.',
  },
  {
    code: 'he-IL',
    name: 'Hebrew',
    nativeName: 'עברית',
    flag: '🇮🇱',
    promptInstruction: 'Write all content in Hebrew. Use warm, conversational Hebrew.',
  },
  {
    code: 'ro-RO',
    name: 'Romanian',
    nativeName: 'Română',
    flag: '🇷🇴',
    promptInstruction: 'Write all content in Romanian. Use warm, conversational Romanian.',
  },
  {
    code: 'uk-UA',
    name: 'Ukrainian',
    nativeName: 'Українська',
    flag: '🇺🇦',
    promptInstruction: 'Write all content in Ukrainian. Use warm, conversational Ukrainian.',
  },
  {
    code: 'cs-CZ',
    name: 'Czech',
    nativeName: 'Čeština',
    flag: '🇨🇿',
    promptInstruction: 'Write all content in Czech. Use warm, conversational Czech.',
  },
  {
    code: 'hu-HU',
    name: 'Hungarian',
    nativeName: 'Magyar',
    flag: '🇭🇺',
    promptInstruction: 'Write all content in Hungarian. Use warm, conversational Hungarian.',
  },
  {
    code: 'sv-SE',
    name: 'Swedish',
    nativeName: 'Svenska',
    flag: '🇸🇪',
    promptInstruction: 'Write all content in Swedish. Use warm, conversational Swedish.',
  },
  {
    code: 'nb-NO',
    name: 'Norwegian',
    nativeName: 'Norsk',
    flag: '🇳🇴',
    promptInstruction: 'Write all content in Norwegian Bokmål. Use warm, conversational Norwegian.',
  },
  {
    code: 'da-DK',
    name: 'Danish',
    nativeName: 'Dansk',
    flag: '🇩🇰',
    promptInstruction: 'Write all content in Danish. Use warm, conversational Danish.',
  },
  {
    code: 'fi-FI',
    name: 'Finnish',
    nativeName: 'Suomi',
    flag: '🇫🇮',
    promptInstruction: 'Write all content in Finnish. Use warm, conversational Finnish.',
  },
  {
    code: 'fil-PH',
    name: 'Filipino',
    nativeName: 'Filipino',
    flag: '🇵🇭',
    promptInstruction: 'Write all content in Filipino (Tagalog). Use warm, conversational Filipino.',
  },
  {
    code: 'ne-NP',
    name: 'Nepali',
    nativeName: 'नेपाली',
    flag: '🇳🇵',
    promptInstruction: 'Write all content in Nepali using Devanagari script. Use warm language.',
  },
]

export const DEFAULT_LANGUAGE = LANGUAGES[0] // English

// ─── Settings Store ───────────────────────────────────────────────────────────
interface SettingsState {
  selectedLanguage: Language
  ttsEnabled: boolean
  isSettingsLoaded: boolean

  loadSettings: () => Promise<void>
  setLanguage: (lang: Language) => Promise<void>
  setTtsEnabled: (enabled: boolean) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  selectedLanguage: DEFAULT_LANGUAGE,
  ttsEnabled: false,
  isSettingsLoaded: false,

  loadSettings: async () => {
    try {
      const [langJson, ttsVal] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
        AsyncStorage.getItem(TTS_STORAGE_KEY),
      ])
      const lang: Language = langJson ? JSON.parse(langJson) : DEFAULT_LANGUAGE
      const tts = ttsVal === 'true'
      set({ selectedLanguage: lang, ttsEnabled: tts, isSettingsLoaded: true })
    } catch (e) {
      console.warn('[Settings] Failed to load settings:', e)
      set({ isSettingsLoaded: true })
    }
  },

  setLanguage: async (lang: Language) => {
    set({ selectedLanguage: lang })
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(lang))
    } catch (e) {
      console.warn('[Settings] Failed to save language:', e)
    }
  },

  setTtsEnabled: async (enabled: boolean) => {
    set({ ttsEnabled: enabled })
    try {
      await AsyncStorage.setItem(TTS_STORAGE_KEY, String(enabled))
    } catch (e) {
      console.warn('[Settings] Failed to save TTS setting:', e)
    }
  },
}))
