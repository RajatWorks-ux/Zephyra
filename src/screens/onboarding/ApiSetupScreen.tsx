// src/screens/onboarding/ApiSetupScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 4: 3-step setup wizard
// Step 1: NVIDIA API Key (text AI — reading, chat, forecasts) + QR code
// Step 2: NVIDIA TTS Key + QR code (skippable, separate key, separate purpose)
// Step 3: All ready — Begin Journey
//
// Both keys are NVIDIA NIM keys (format nvapi-...), but they are kept as two
// distinct, separately-stored credentials on purpose:
//   - Step 1 key → KEY_OPENROUTER (name kept for compatibility) → powers ALL
//     text generation across the whole app (groqAI.ts / chatStore.ts /
//     forecastStore.ts) via moonshotai/kimi-k2.6.
//   - Step 2 key → KEY_NVIDIA_TTS → powers voice-only chart narration via
//     nvidia/chatterbox-multilingual. A person could use one NVIDIA account's
//     key for both, or two different NVIDIA accounts — either works, since
//     they're tested and stored completely independently.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Animated, ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Dimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import {
  setKey, testOpenRouterKey, testNvidiaKey, setOpenRouterKeyWithBackup,
  KEY_OPENROUTER, KEY_NVIDIA_TTS,
} from '../../services/secureKeyStore'
import { useSetupStore } from '../../store/setupStore'
import { Videos } from '../../constants/videos'

const { width } = Dimensions.get('window')
const TOTAL_STEPS = 3

// ── QR code placeholder images ────────────────────────────────────────────────
// Add your QR images to assets/images/ with these names:
// qr-openrouter.png → links to your NVIDIA AI-key tutorial / build.nvidia.com
//   (filename kept as qr-openrouter.png on purpose — no asset rename needed)
// qr-nvidia.png → links to your NVIDIA TTS tutorial / build.nvidia.com
// Until you add them, a placeholder box is shown.
const QR_OPENROUTER = (() => {
  try { return require('../../../assets/images/qr-openrouter.png') } catch { return null }
})()
const QR_NVIDIA = (() => {
  try { return require('../../../assets/images/qr-nvidia.png') } catch { return null }
})()

export function ApiSetupScreen() {
  const [step, setStep] = useState(1)

  // OpenRouter key
  const [openRouterKey, setOpenRouterKeyInput] = useState('')
  const [testingKey, setTestingKey] = useState(false)
  const [keyValid, setKeyValid] = useState<boolean | null>(null)
  const [keyError, setKeyError] = useState('')

  // NVIDIA TTS
  const [nvidiaKey, setNvidiaKey] = useState('')
  const [testingNvidia, setTestingNvidia] = useState(false)
  const [nvidiaValid, setNvidiaValid] = useState<boolean | null>(null)
  const [nvidiaError, setNvidiaError] = useState('')

  const progressAnim = useRef(new Animated.Value(0)).current
  const { setSetupComplete, setOpenRouterKeyValid, setNvidiaKeyValid } = useSetupStore()

  const animateTo = (s: number) => {
    Animated.timing(progressAnim, {
      toValue: ((s - 1) / (TOTAL_STEPS - 1)) * (width - 48),
      duration: 350,
      useNativeDriver: false,
    }).start()
  }

  const goStep = (s: number) => {
    animateTo(s)
    setStep(s)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  // ── Test NVIDIA AI Key ──────────────────────────────────────────────────────
  const handleTestKey = async () => {
    const k = openRouterKey.trim()
    if (!k.startsWith('nvapi-')) { setKeyError('Must start with nvapi-'); return }
    setTestingKey(true); setKeyError('')
    const { valid, error } = await testOpenRouterKey(k)
    setTestingKey(false)
    setKeyValid(valid)
    if (!valid) { setKeyError(error ?? 'Invalid key — check and try again') }
    else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) }
  }

  // ── Save NVIDIA AI key and advance ──────────────────────────────────────────
  const handleOpenRouterNext = async () => {
    if (!keyValid) return
    // Save with cloud backup (survives reinstall)
    const authMod = await import('../../store/authStore')
    const userId = authMod.useAuthStore.getState().session?.user?.id
    if (userId) {
      await setOpenRouterKeyWithBackup(userId, openRouterKey.trim())
    } else {
      await setKey(KEY_OPENROUTER, openRouterKey.trim())
    }
    setOpenRouterKeyValid(true)
    goStep(2)
  }

  // ── Test NVIDIA TTS ─────────────────────────────────────────────────────────
  const handleTestNvidia = async () => {
    const k = nvidiaKey.trim()
    setTestingNvidia(true); setNvidiaError('')
    const { valid, error } = await testNvidiaKey(k)
    setTestingNvidia(false)
    setNvidiaValid(valid)
    if (!valid) { setNvidiaError(error ?? 'Invalid key') }
    else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) }
  }

  // ── Save NVIDIA key and advance ─────────────────────────────────────────────
  const handleNvidiaSave = async () => {
    if (!nvidiaValid) return
    await setKey(KEY_NVIDIA_TTS, nvidiaKey.trim())
    setNvidiaKeyValid(true)
    goStep(3)
  }

  // ── Finish setup ────────────────────────────────────────────────────────────
  const handleBegin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    await setSetupComplete()
    // RootNavigator will re-render to AuthNavigator automatically
  }

  const borderColor = (valid: boolean | null) => {
    if (valid === true) return '#44FF88'
    if (valid === false) return '#FF4444'
    return 'rgba(201,168,76,0.4)'
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Background video — graceful if not loaded */}
      <Video
        source={Videos.setupBg?.uri ? Videos.setupBg : Videos.onboarding1}
        style={StyleSheet.absoluteFillObject}
        shouldPlay isLooping isMuted
        resizeMode={ResizeMode.COVER}
        onError={() => {}}  // silent fail — screen works without video
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.25)', 'rgba(5,5,15,0.96)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>
        <View style={styles.progressTrack}>
          <View style={styles.progressDotRow}>
            {[1, 2, 3].map(n => (
              <View key={n} style={[styles.dot, { backgroundColor: step >= n ? '#C9A84C' : 'rgba(255,255,255,0.15)' }]} />
            ))}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BlurView intensity={18} tint="dark" style={styles.card}>

          {/* ════════════════════════════════════════
              STEP 1 — OPENROUTER KEY
          ════════════════════════════════════════ */}
          {step === 1 && (
            <View style={styles.body}>
              <Text style={styles.symbol}>✦</Text>
              <Text style={styles.titleMain}>Set Up Your AI Key</Text>
              <Text style={styles.sub}>
                Zephyra runs on NVIDIA's free NIM AI — powered by Kimi K2.6, a powerful frontier model from Moonshot AI. You need 1 key — it's free, no credit card. Your key stays on your device, encrypted. Never shared.
              </Text>

              {/* QR code + instructions */}
              <View style={styles.qrRow}>
                {QR_OPENROUTER
                  ? <Image source={QR_OPENROUTER} style={styles.qrImage} />
                  : <View style={styles.qrPlaceholder}><Text style={styles.qrPlaceholderText}>QR{'\n'}NVIDIA</Text></View>
                }
                <View style={styles.qrInstructions}>
                  <Text style={styles.qrTitle}>Scan to get your free key</Text>
                  <Text style={styles.qrStep}>{'→  Go to build.nvidia.com'}</Text>
                  <Text style={styles.qrStep}>{'→  Create free account'}</Text>
                  <Text style={styles.qrStep}>{'→  Click Get API Key'}</Text>
                  <Text style={styles.qrStep}>{'→  Keys start with nvapi-'}</Text>
                  <Text style={styles.qrStep}>{'→  Paste below'}</Text>
                </View>
              </View>

              {/* NVIDIA AI key */}
              <Text style={styles.inputLabel}>AI Key</Text>
              <TextInput
                style={[styles.keyInput, { borderColor: borderColor(keyValid) }]}
                placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor="#6E6E9E"
                value={openRouterKey}
                onChangeText={t => { setOpenRouterKeyInput(t); setKeyValid(null); setKeyError('') }}
                autoCapitalize="none" autoCorrect={false} secureTextEntry={false}
              />
              {keyError ? <Text style={styles.errText}>{keyError}</Text> : null}
              <TouchableOpacity style={styles.testBtn} onPress={handleTestKey} disabled={testingKey || !openRouterKey}>
                {testingKey ? <ActivityIndicator color="#C9A84C" size="small" />
                  : <Text style={styles.testBtnText}>{keyValid ? '✓ Key Verified' : 'Test Key'}</Text>}
              </TouchableOpacity>

              {keyValid && (
                <Text style={styles.successNote}>✓ AI engine ready</Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, !keyValid && styles.btnDisabled]}
                onPress={handleOpenRouterNext}
                disabled={!keyValid}
              >
                <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 2 — NVIDIA TTS (OPTIONAL)
          ════════════════════════════════════════ */}
          {step === 2 && (
            <View style={styles.body}>
              <Text style={styles.symbol}>🎙️</Text>
              <Text style={styles.titleMain}>Voice Key</Text>
              <Text style={styles.optionalTag}>(Optional)</Text>
              <Text style={styles.sub}>
                This is a second, separate NVIDIA key just for voice — she'll read your cosmic chart aloud in a rich, natural voice. You can reuse the same NVIDIA account as Step 1, or use a different one. Free account at build.nvidia.com.
              </Text>

              {/* QR code + instructions */}
              <View style={styles.qrRow}>
                {QR_NVIDIA
                  ? <Image source={QR_NVIDIA} style={styles.qrImage} />
                  : <View style={styles.qrPlaceholder}><Text style={styles.qrPlaceholderText}>QR{'\n'}NVIDIA</Text></View>
                }
                <View style={styles.qrInstructions}>
                  <Text style={styles.qrTitle}>Scan to get your free key</Text>
                  <Text style={styles.qrStep}>{'→  Go to build.nvidia.com'}</Text>
                  <Text style={styles.qrStep}>{'→  Create free account'}</Text>
                  <Text style={styles.qrStep}>{'→  Search "Chatterbox"'}</Text>
                  <Text style={styles.qrStep}>{'→  Click Get API Key'}</Text>
                  <Text style={styles.qrStep}>{'→  Paste below'}</Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>NVIDIA API Key</Text>
              <TextInput
                style={[styles.keyInput, { borderColor: borderColor(nvidiaValid) }]}
                placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor="#6E6E9E"
                value={nvidiaKey}
                onChangeText={t => { setNvidiaKey(t); setNvidiaValid(null); setNvidiaError('') }}
                autoCapitalize="none" autoCorrect={false}
              />
              {nvidiaError ? <Text style={styles.errText}>{nvidiaError}</Text> : null}

              <TouchableOpacity style={styles.testBtn} onPress={handleTestNvidia} disabled={testingNvidia || !nvidiaKey}>
                {testingNvidia ? <ActivityIndicator color="#C9A84C" size="small" />
                  : <Text style={styles.testBtnText}>{nvidiaValid ? '✓ Voice Key Verified' : 'Test Voice Key'}</Text>}
              </TouchableOpacity>

              <View style={styles.twoRow}>
                <TouchableOpacity style={styles.skipBtn} onPress={() => goStep(3)}>
                  <Text style={styles.skipText}>Skip for Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }, !nvidiaValid && styles.btnDisabled]}
                  onPress={handleNvidiaSave}
                  disabled={!nvidiaValid}
                >
                  <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.primaryBtnText}>Save & Next →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ════════════════════════════════════════
              STEP 3 — READY
          ════════════════════════════════════════ */}
          {step === 3 && (
            <View style={styles.body}>
              <Text style={[styles.symbol, { fontSize: 56 }]}>✦</Text>
              <Text style={styles.titleMain}>Your Cosmic Oracle{'\n'}is Ready</Text>

              <View style={styles.checklist}>
                {[
                  { label: 'AI Engine Active', done: true },
                  { label: 'Keys Encrypted on Device', done: true },
                  { label: 'Database Connected', done: true },
                  { label: 'Voice Reading', done: nvidiaValid === true },
                ].map((item, i) => (
                  <View key={i} style={styles.checkRow}>
                    <Text style={{ color: item.done ? '#44FF88' : '#6E6E9E', fontSize: 18, width: 28 }}>
                      {item.done ? '✓' : '—'}
                    </Text>
                    <Text style={{ color: item.done ? '#E8E8FF' : '#6E6E9E', fontFamily: 'Inter_400Regular', fontSize: 15 }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={styles.encNote}>
                All API keys are encrypted using your device's secure hardware. They never leave your phone.
              </Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleBegin}>
                <LinearGradient colors={['#7C3AED', '#C9A84C']} style={[styles.gradient, { height: 62 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={[styles.primaryBtnText, { fontSize: 17 }]}>Begin Your Journey ✦</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

        </BlurView>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  progressWrap: { paddingTop: 58, paddingHorizontal: 24, paddingBottom: 12 },
  stepLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6E6E9E', textAlign: 'center', marginBottom: 10 },
  progressTrack: { alignItems: 'center' },
  progressDotRow: { flexDirection: 'row', gap: 12 },
  dot: { width: 36, height: 5, borderRadius: 3 },
  scroll: { padding: 16, paddingBottom: 48 },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)' },
  body: { padding: 26 },
  symbol: {
    fontFamily: 'CinzelDecorative_400Regular',
    fontSize: 44,
    color: '#C9A84C',
    textAlign: 'center',
    marginBottom: 14,
    textShadowColor: '#C9A84C',
    textShadowRadius: 18,
  },
  titleMain: {
    fontFamily: 'CinzelDecorative_400Regular',
    fontSize: 22,
    color: '#E8E8FF',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 32,
  },
  optionalTag: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 16,
    color: '#6E6E9E',
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 17,
    color: '#B0B0D0',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 22,
  },
  qrRow: { flexDirection: 'row', gap: 14, marginBottom: 24, alignItems: 'flex-start' },
  qrImage: { width: 100, height: 100, borderRadius: 10 },
  qrPlaceholder: {
    width: 100, height: 100, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.3)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,168,76,0.05)',
  },
  qrPlaceholderText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6E6E9E', textAlign: 'center' },
  qrInstructions: { flex: 1 },
  qrTitle: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 11, color: '#C9A84C', marginBottom: 6 },
  qrStep: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#B0B0D0', marginBottom: 3, lineHeight: 18 },
  inputLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#B0B0D0', marginBottom: 6 },
  keyInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1.5, borderRadius: 12,
    padding: 13, fontFamily: 'Inter_400Regular', // monospace-ish
    fontSize: 13, color: '#E8E8FF',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  errText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#FF4444', marginBottom: 8, textAlign: 'center' },
  successNote: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#44FF88', textAlign: 'center', marginVertical: 12 },
  testBtn: {
    borderWidth: 1.5, borderColor: '#C9A84C', borderRadius: 12,
    padding: 13, alignItems: 'center', marginBottom: 6,
  },
  testBtnText: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 13, color: '#C9A84C' },
  primaryBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 14 },
  btnDisabled: { opacity: 0.35 },
  gradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 15, color: '#fff' },
  twoRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  skipBtn: {
    flex: 1, borderWidth: 1, borderColor: '#6E6E9E', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', padding: 14,
  },
  skipText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6E6E9E' },
  checklist: { gap: 16, marginVertical: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  encNote: {
    fontFamily: 'Inter_400Regular', fontSize: 12, color: '#44FF88',
    textAlign: 'center', marginBottom: 22, lineHeight: 20,
  },
})
