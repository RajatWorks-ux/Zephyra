// src/screens/onboarding/NewDeviceApiSetupScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Shown when an EXISTING user signs in on a NEW device (or reinstalls).
//
// WHY THIS SCREEN EXISTS — shown clearly to the user:
// API keys (NVIDIA AI key + NVIDIA TTS key) are stored in the device's secure
// hardware vault (iOS Keychain / Android Keystore). This is the most secure
// place to store them — they are never uploaded to any server, never in the
// cloud. The tradeoff: they cannot transfer between devices or survive a
// reinstall. This is by design — it's what keeps them safe.
//
// PHASE 4: Both keys are now NVIDIA NIM keys (format nvapi-...), but remain
// two distinct, separately-stored credentials — Step 1 powers all text AI
// (nvidia/nemotron-3-super-120b-a12b) across the whole app, Step 2 powers
// voice-only narration (nvidia/chatterbox-multilingual). Same NVIDIA account
// can supply both, or two different accounts — either works.
//
// 3 steps matching the main ApiSetupScreen:
//   Step 1: NVIDIA AI key + QR + explanation
//   Step 2: NVIDIA TTS key + QR (skippable)
//   Step 3: Ready confirmation
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, Animated, Dimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import {
  setKey, testOpenRouterKey, testNvidiaKey,
  KEY_OPENROUTER, KEY_NVIDIA_TTS,
} from '../../services/secureKeyStore'
import { useSetupStore } from '../../store/setupStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const { width } = Dimensions.get('window')
const TOTAL_STEPS = 3

// QR images — add to assets/images/ with these exact names
const QR_OPENROUTER = (() => { try { return require('../../../assets/images/qr-openrouter.png') } catch { return null } })()
const QR_NVIDIA = (() => { try { return require('../../../assets/images/qr-nvidia.png') } catch { return null } })()

export function NewDeviceApiSetupScreen() {
  const [step, setStep] = useState(1)

  // OpenRouter
  const [openRouterKey, setOpenRouterKeyInput] = useState('')
  const [keyValid, setKeyValid] = useState<boolean | null>(null)
  const [testing, setTesting] = useState(false)
  const [err, setErr] = useState('')

  // NVIDIA
  const [nvidiaKey, setNvidiaKey] = useState('')
  const [nvidiaValid, setNvidiaValid] = useState<boolean | null>(null)
  const [testingNvidia, setTestingNvidia] = useState(false)
  const [nvidiaErr, setNvidiaErr] = useState('')

  const { setSetupComplete, setOpenRouterKeyValid, setNvidiaKeyValid } = useSetupStore()
  const progressAnim = useRef(new Animated.Value(0)).current

  const animateTo = (s: number) => {
    Animated.timing(progressAnim, {
      toValue: ((s - 1) / (TOTAL_STEPS - 1)) * (width - 48),
      duration: 320,
      useNativeDriver: false,
    }).start()
  }

  const goStep = (s: number) => {
    animateTo(s)
    setStep(s)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const bc = (v: boolean | null) =>
    v === true ? '#44FF88' : v === false ? '#FF4444' : 'rgba(201,168,76,0.4)'

  const testKey = async () => {
    const k = openRouterKey.trim()
    if (!k.startsWith('nvapi-')) { setErr('Key must start with nvapi-'); return }
    setTesting(true); setErr('')
    const { valid, error } = await testOpenRouterKey(k)
    setTesting(false); setKeyValid(valid)
    if (!valid) setErr(error ?? 'Invalid key — check and try again')
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const saveOpenRouterAndNext = async () => {
    if (!keyValid) return
    await setKey(KEY_OPENROUTER, openRouterKey.trim())
    setOpenRouterKeyValid(true)
    goStep(2)
  }

  const testNvidia = async () => {
    const k = nvidiaKey.trim()
    setTestingNvidia(true); setNvidiaErr('')
    const { valid, error } = await testNvidiaKey(k)
    setTestingNvidia(false); setNvidiaValid(valid)
    if (!valid) setNvidiaErr(error ?? 'Invalid NVIDIA key')
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const saveNvidiaAndNext = async () => {
    if (!nvidiaValid) return
    await setKey(KEY_NVIDIA_TTS, nvidiaKey.trim())
    setNvidiaKeyValid(true)
    goStep(3)
  }

  const handleBegin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    await setSetupComplete()
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Video
        source={Videos.signInBg}
        style={StyleSheet.absoluteFillObject}
        shouldPlay isLooping isMuted
        resizeMode={ResizeMode.COVER}
        onError={() => {}}
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.97)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Progress dots */}
      <View style={styles.progressWrap}>
        <Text style={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</Text>
        <View style={styles.dotRow}>
          {[1, 2, 3].map(n => (
            <View key={n} style={[styles.dot, { backgroundColor: step >= n ? '#C9A84C' : 'rgba(255,255,255,0.15)' }]} />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BlurView intensity={18} tint="dark" style={styles.card}>

          {/* ══════════════════════════════════════
              STEP 1 — OPENROUTER KEY
          ══════════════════════════════════════ */}
          {step === 1 && (
            <View style={styles.body}>
              <Text style={styles.symbol}>✦</Text>
              <Text style={styles.titleMain}>Welcome Back</Text>
              <Text style={styles.titleSub}>New Device Detected</Text>

              {/* ── The key explanation box ── */}
              <BlurView intensity={10} tint="dark" style={styles.explainBox}>
                <Text style={styles.explainIcon}>🔐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.explainTitle}>Why enter your key again?</Text>
                  <Text style={styles.explainText}>
                    Your NVIDIA AI key is stored inside this device's secure hardware chip — the same place your bank apps store passwords. This means it is{' '}
                    <Text style={{ color: '#44FF88' }}>completely private</Text>
                    {' '}and never uploaded to any server.{'\n\n'}
                    The tradeoff: it lives only on the device it was entered on. New device, reinstall, or factory reset — you re-enter it once. Your readings, chart, and history are all safe in the cloud and will appear instantly after this.
                  </Text>
                </View>
              </BlurView>

              <Text style={styles.sub}>Takes about 1 minute. Your cosmic data is untouched.</Text>

              {/* QR + steps */}
              <View style={styles.qrRow}>
                {QR_OPENROUTER
                  ? <Image source={QR_OPENROUTER} style={styles.qrImg} />
                  : <View style={styles.qrBox}><Text style={styles.qrBoxText}>QR{'\n'}NVIDIA</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrTitle}>Scan for NVIDIA guide</Text>
                  <Text style={styles.qrStep}>{'→  build.nvidia.com'}</Text>
                  <Text style={styles.qrStep}>{'→  Create free account'}</Text>
                  <Text style={styles.qrStep}>{'→  Get API Key'}</Text>
                  <Text style={styles.qrStep}>{'→  Keys start with nvapi-'}</Text>
                </View>
              </View>

              {/* NVIDIA AI key */}
              <Text style={styles.inputLabel}>AI Key</Text>
              <TextInput
                style={[styles.keyInput, { borderColor: bc(keyValid) }]}
                placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor={Colors.textMuted}
                value={openRouterKey}
                onChangeText={t => { setOpenRouterKeyInput(t); setKeyValid(null); setErr('') }}
                autoCapitalize="none" autoCorrect={false}
              />
              {err ? <Text style={styles.errText}>{err}</Text> : null}
              <TouchableOpacity style={styles.testBtn} onPress={testKey} disabled={testing || !openRouterKey}>
                {testing
                  ? <ActivityIndicator color={Colors.agedGold} size="small" />
                  : <Text style={styles.testBtnText}>{keyValid ? '✓ Key Verified' : 'Test Key'}</Text>
                }
              </TouchableOpacity>

              {keyValid && (
                <Text style={styles.successNote}>✓ AI engine ready</Text>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, !keyValid && styles.btnDisabled]}
                onPress={saveOpenRouterAndNext}
                disabled={!keyValid}
              >
                <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.primaryBtnText}>Next →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ══════════════════════════════════════
              STEP 2 — NVIDIA TTS (OPTIONAL)
          ══════════════════════════════════════ */}
          {step === 2 && (
            <View style={styles.body}>
              <Text style={styles.symbol}>🎙️</Text>
              <Text style={styles.titleMain}>Voice Key</Text>
              <Text style={styles.optionalTag}>(Optional — same reason applies)</Text>
              <Text style={styles.sub}>
                Your NVIDIA voice key also lives on-device only — it's a separate key from your AI key in Step 1. If you used voice reading before, enter the same key again below. Skip if you don't use voice.
              </Text>

              <View style={styles.qrRow}>
                {QR_NVIDIA
                  ? <Image source={QR_NVIDIA} style={styles.qrImg} />
                  : <View style={styles.qrBox}><Text style={styles.qrBoxText}>QR{'\n'}NVIDIA</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrTitle}>Scan for NVIDIA guide</Text>
                  <Text style={styles.qrStep}>{'→  build.nvidia.com'}</Text>
                  <Text style={styles.qrStep}>{'→  Search "Chatterbox"'}</Text>
                  <Text style={styles.qrStep}>{'→  Get API Key'}</Text>
                  <Text style={styles.qrStep}>{'→  Starts with nvapi-'}</Text>
                </View>
              </View>

              <Text style={styles.inputLabel}>NVIDIA API Key</Text>
              <TextInput
                style={[styles.keyInput, { borderColor: bc(nvidiaValid) }]}
                placeholder="nvapi-xxxxxxxxxxxxxxxxxxxxxxxx"
                placeholderTextColor={Colors.textMuted}
                value={nvidiaKey}
                onChangeText={t => { setNvidiaKey(t); setNvidiaValid(null); setNvidiaErr('') }}
                autoCapitalize="none" autoCorrect={false}
              />
              {nvidiaErr ? <Text style={styles.errText}>{nvidiaErr}</Text> : null}

              <TouchableOpacity style={styles.testBtn} onPress={testNvidia} disabled={testingNvidia || !nvidiaKey}>
                {testingNvidia
                  ? <ActivityIndicator color={Colors.agedGold} size="small" />
                  : <Text style={styles.testBtnText}>{nvidiaValid ? '✓ Voice Key Verified' : 'Test Voice Key'}</Text>
                }
              </TouchableOpacity>

              <View style={styles.twoRow}>
                <TouchableOpacity style={styles.skipBtn} onPress={() => goStep(3)}>
                  <Text style={styles.skipText}>Skip for Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }, !nvidiaValid && styles.btnDisabled]}
                  onPress={saveNvidiaAndNext}
                  disabled={!nvidiaValid}
                >
                  <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.primaryBtnText}>Save & Next →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════
              STEP 3 — READY
          ══════════════════════════════════════ */}
          {step === 3 && (
            <View style={styles.body}>
              <Text style={[styles.symbol, { fontSize: 52 }]}>✦</Text>
              <Text style={styles.titleMain}>You're Back</Text>
              <Text style={styles.titleSub}>Device fully configured</Text>

              <BlurView intensity={10} tint="dark" style={[styles.explainBox, { marginBottom: 24 }]}>
                <Text style={styles.explainIcon}>☁️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.explainTitle}>Your data is all here</Text>
                  <Text style={styles.explainText}>
                    Your birth chart, readings, chat history and preferences were all stored safely in the cloud. They are loading now — nothing was lost.
                  </Text>
                </View>
              </BlurView>

              <View style={styles.checklist}>
                {[
                  { label: 'AI Engine Active', done: true },
                  { label: 'Keys Encrypted on This Device', done: true },
                  { label: 'Your Readings Safe in Cloud', done: true },
                  { label: 'Voice Reading', done: nvidiaValid === true },
                ].map((item, i) => (
                  <View key={i} style={styles.checkRow}>
                    <Text style={{ color: item.done ? '#44FF88' : Colors.textMuted, fontSize: 18, width: 28 }}>
                      {item.done ? '✓' : '—'}
                    </Text>
                    <Text style={{ fontFamily: Fonts.body, fontSize: 15, color: item.done ? Colors.textPrimary : Colors.textMuted }}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={styles.encNote}>
                Keys are encrypted in your device's secure hardware chip. They never leave this device.
              </Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleBegin}>
                <LinearGradient colors={['#7C3AED', '#C9A84C']} style={[styles.gradient, { height: 60 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={[styles.primaryBtnText, { fontSize: 17 }]}>Enter Your Cosmos ✦</Text>
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
  progressWrap: { paddingTop: 58, paddingHorizontal: 24, paddingBottom: 14, alignItems: 'center' },
  stepLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  dotRow: { flexDirection: 'row', gap: 12 },
  dot: { width: 36, height: 5, borderRadius: 3 },
  scroll: { padding: 16, paddingBottom: 48 },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)' },
  body: { padding: 26 },
  symbol: {
    fontFamily: Fonts.heading, fontSize: 44, color: Colors.agedGold,
    textAlign: 'center', marginBottom: 12,
    textShadowColor: Colors.agedGold, textShadowRadius: 18,
  },
  titleMain: { fontFamily: Fonts.heading, fontSize: 22, color: Colors.moonWhite, textAlign: 'center', marginBottom: 4 },
  titleSub: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.agedGold, textAlign: 'center', marginBottom: 18, letterSpacing: 1 },
  optionalTag: { fontFamily: Fonts.mystical, fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 10 },
  // ── Explanation box ──────────────────────────────────────────────────────────
  explainBox: {
    flexDirection: 'row', gap: 12, borderRadius: 16, padding: 16,
    marginBottom: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
    backgroundColor: 'rgba(201,168,76,0.04)',
  },
  explainIcon: { fontSize: 24, marginTop: 2 },
  explainTitle: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.agedGold, marginBottom: 6 },
  explainText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  // ────────────────────────────────────────────────────────────────────────────
  sub: { fontFamily: Fonts.mystical, fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 25, marginBottom: 20 },
  qrRow: { flexDirection: 'row', gap: 14, marginBottom: 22, alignItems: 'flex-start' },
  qrImg: { width: 90, height: 90, borderRadius: 10 },
  qrBox: {
    width: 90, height: 90, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(201,168,76,0.3)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(201,168,76,0.04)',
  },
  qrBoxText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  qrTitle: { fontFamily: Fonts.heading, fontSize: 11, color: Colors.agedGold, marginBottom: 6 },
  qrStep: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, marginBottom: 3, lineHeight: 18 },
  inputLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  keyInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderRadius: 12,
    padding: 13, fontSize: 13, fontFamily: Fonts.body,
    color: Colors.textPrimary, marginBottom: 10, letterSpacing: 0.4,
  },
  errText: { fontFamily: Fonts.body, fontSize: 12, color: '#FF4444', marginBottom: 8, textAlign: 'center' },
  successNote: { fontFamily: Fonts.body, fontSize: 13, color: '#44FF88', textAlign: 'center', marginVertical: 12 },
  testBtn: { borderWidth: 1.5, borderColor: Colors.agedGold, borderRadius: 12, padding: 13, alignItems: 'center', marginBottom: 6 },
  testBtnText: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.agedGold },
  primaryBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 14 },
  btnDisabled: { opacity: 0.35 },
  gradient: { height: 56, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { fontFamily: Fonts.heading, fontSize: 15, color: '#fff' },
  twoRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  skipBtn: { flex: 1, borderWidth: 1, borderColor: Colors.textMuted, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 14 },
  skipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  checklist: { gap: 16, marginVertical: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  encNote: { fontFamily: Fonts.body, fontSize: 12, color: '#44FF88', textAlign: 'center', marginBottom: 22, lineHeight: 20 },
})
