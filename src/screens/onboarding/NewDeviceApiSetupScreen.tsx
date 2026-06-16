// src/screens/onboarding/NewDeviceApiSetupScreen.tsx
// Shown when an existing user signs in on a NEW device.
// GROQ + NVIDIA keys are device-local — user re-enters them on new device.
// Only 2 steps: GROQ Keys → NVIDIA (optional) → Done

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { setKey, testGroqKey, testNvidiaKey, KEY_GROQ_1, KEY_GROQ_2, KEY_NVIDIA_TTS } from '../../services/secureKeyStore'
import { useSetupStore } from '../../store/setupStore'
import { Videos } from '../../constants/videos'

const QR_GROQ = (() => { try { return require('../../../assets/images/qr-groq.png') } catch { return null } })()

export function NewDeviceApiSetupScreen() {
  const [step, setStep] = useState(1)
  const [groqKey1, setGroqKey1] = useState('')
  const [groqKey2, setGroqKey2] = useState('')
  const [key1Valid, setKey1Valid] = useState<boolean | null>(null)
  const [key2Valid, setKey2Valid] = useState<boolean | null>(null)
  const [testing1, setTesting1] = useState(false)
  const [testing2, setTesting2] = useState(false)
  const [err1, setErr1] = useState('')
  const [err2, setErr2] = useState('')
  const { setSetupComplete } = useSetupStore()

  const test1 = async () => {
    const k = groqKey1.trim()
    if (!k.startsWith('gsk_')) { setErr1('Must start with gsk_'); return }
    setTesting1(true); setErr1('')
    const { valid, error } = await testGroqKey(k)
    setTesting1(false); setKey1Valid(valid)
    if (!valid) setErr1(error ?? 'Invalid key')
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const test2 = async () => {
    const k = groqKey2.trim()
    if (!k.startsWith('gsk_')) { setErr2('Must start with gsk_'); return }
    setTesting2(true); setErr2('')
    const { valid, error } = await testGroqKey(k)
    setTesting2(false); setKey2Valid(valid)
    if (!valid) setErr2(error ?? 'Invalid key')
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const saveAndContinue = async () => {
    if (!key1Valid || !key2Valid) return
    await Promise.all([setKey(KEY_GROQ_1, groqKey1.trim()), setKey(KEY_GROQ_2, groqKey2.trim())])
    await setSetupComplete()
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const bc = (v: boolean | null) => v === true ? '#44FF88' : v === false ? '#FF4444' : 'rgba(201,168,76,0.4)'

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Video source={Videos.signInBg} style={StyleSheet.absoluteFillObject}
        shouldPlay isLooping isMuted resizeMode={ResizeMode.COVER} onError={() => {}} />
      <LinearGradient colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.96)']} style={StyleSheet.absoluteFillObject} />

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <BlurView intensity={18} tint="dark" style={s.card}>
          <View style={s.body}>
            <Text style={s.title}>Welcome Back{'\n'}New Device Detected</Text>
            <Text style={s.sub}>
              Your readings and birth chart are safe in the cloud. API keys are stored privately on each device — takes about 2 minutes to set up again.
            </Text>

            <View style={s.qrRow}>
              {QR_GROQ
                ? <Image source={QR_GROQ} style={s.qrImg} />
                : <View style={s.qrBox}><Text style={s.qrBoxText}>QR{'\n'}GROQ</Text></View>
              }
              <View style={{ flex: 1 }}>
                <Text style={s.qrTitle}>Scan for GROQ setup guide</Text>
                <Text style={s.qrStep}>→  console.groq.com</Text>
                <Text style={s.qrStep}>→  API Keys → Create API Key</Text>
                <Text style={s.qrStep}>→  Create 2 keys, paste below</Text>
              </View>
            </View>

            <Text style={s.label}>AI Key 1</Text>
            <TextInput style={[s.inp, { borderColor: bc(key1Valid) }]}
              placeholder="gsk_..." placeholderTextColor="#6E6E9E"
              value={groqKey1} onChangeText={t => { setGroqKey1(t); setKey1Valid(null); setErr1('') }}
              autoCapitalize="none" autoCorrect={false} />
            {err1 ? <Text style={s.err}>{err1}</Text> : null}
            <TouchableOpacity style={s.testBtn} onPress={test1} disabled={testing1 || !groqKey1}>
              {testing1 ? <ActivityIndicator color="#C9A84C" size="small" />
                : <Text style={s.testText}>{key1Valid ? '✓ Verified' : 'Test Key 1'}</Text>}
            </TouchableOpacity>

            <Text style={[s.label, { marginTop: 14 }]}>AI Key 2</Text>
            <TextInput style={[s.inp, { borderColor: bc(key2Valid) }]}
              placeholder="gsk_..." placeholderTextColor="#6E6E9E"
              value={groqKey2} onChangeText={t => { setGroqKey2(t); setKey2Valid(null); setErr2('') }}
              autoCapitalize="none" autoCorrect={false} />
            {err2 ? <Text style={s.err}>{err2}</Text> : null}
            <TouchableOpacity style={s.testBtn} onPress={test2} disabled={testing2 || !groqKey2}>
              {testing2 ? <ActivityIndicator color="#C9A84C" size="small" />
                : <Text style={s.testText}>{key2Valid ? '✓ Verified' : 'Test Key 2'}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={[s.btn, (!key1Valid || !key2Valid) && s.btnOff]}
              onPress={saveAndContinue} disabled={!key1Valid || !key2Valid}>
              <LinearGradient colors={['#7C3AED', '#C9A84C']} style={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={s.btnText}>Enter Your Cosmos →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BlurView>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)' },
  body: { padding: 24 },
  title: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 20, color: '#C9A84C', textAlign: 'center', marginBottom: 14, lineHeight: 30 },
  sub: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 16, color: '#B0B0D0', textAlign: 'center', lineHeight: 24, marginBottom: 22 },
  qrRow: { flexDirection: 'row', gap: 12, marginBottom: 22, alignItems: 'flex-start' },
  qrImg: { width: 90, height: 90, borderRadius: 8 },
  qrBox: { width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)', alignItems: 'center', justifyContent: 'center' },
  qrBoxText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#6E6E9E', textAlign: 'center' },
  qrTitle: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 11, color: '#C9A84C', marginBottom: 6 },
  qrStep: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#B0B0D0', marginBottom: 3 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#B0B0D0', marginBottom: 6 },
  inp: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderRadius: 12, padding: 13, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#E8E8FF', marginBottom: 8 },
  err: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#FF4444', marginBottom: 6, textAlign: 'center' },
  testBtn: { borderWidth: 1.5, borderColor: '#C9A84C', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 4 },
  testText: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 13, color: '#C9A84C' },
  btn: { borderRadius: 14, overflow: 'hidden', marginTop: 20 },
  btnOff: { opacity: 0.35 },
  grad: { height: 56, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 15, color: '#fff' },
})
