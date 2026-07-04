// src/screens/admin/AdminAccessScreen.tsx — Phase 3
// Auth flow: biometric already passed in ProfileScreen → only PIN needed here
// PIN is verified against a salted SHA-256 hash stored in SecureStore
// First launch: any 6-digit PIN you enter becomes YOUR admin PIN (saved)
// NO network calls. NO whitelist. Entirely offline.
//
// ── HOW TO CHANGE YOUR PIN IN FUTURE ────────────────────────────────────────
// In AdminDashboardScreen there will be a "Change PIN" option that:
//   1. Asks for current PIN (verify it)
//   2. Asks for new PIN twice
//   3. Saves new SHA-256 hash to SecureStore
// Or: delete the app and reinstall — first PIN entry becomes the new PIN.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, StatusBar,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import * as Crypto from 'expo-crypto'
import { useNavigation } from '@react-navigation/native'
import { getKey, setKey } from '../../services/secureKeyStore'
import { useAdminStore } from '../../store/adminStore'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

// PIN hash storage key — in SecureStore (encrypted, device-only)
const ADMIN_PIN_HASH_KEY = 'zephyra_admin_pin_hash_v1'

// Salt — hardcoded. Makes rainbow table attacks useless.
// To change: update this string AND clear the old hash key from SecureStore.
const PIN_SALT = 'ZephyraAdmin_Cosmic2025_Salt'

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${PIN_SALT}:${pin}:${PIN_SALT}`,
  )
}

async function verifyOrSetPin(entered: string): Promise<'correct' | 'wrong' | 'first_time_set'> {
  const stored = await getKey(ADMIN_PIN_HASH_KEY)

  if (!stored) {
    // First ever use — this PIN becomes the admin PIN
    const hash = await hashPin(entered)
    await setKey(ADMIN_PIN_HASH_KEY, hash)
    return 'first_time_set'
  }

  const enteredHash = await hashPin(entered)
  return enteredHash === stored ? 'correct' : 'wrong'
}

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
]

export function AdminAccessScreen() {
  const navigation = useNavigation<any>()
  const { clearAdminMode } = useAdminStore()
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [countdown, setCountdown] = useState(30)
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [confirmPin, setConfirmPin] = useState('')
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const shakeAnim = useRef(new Animated.Value(0)).current
  const lockTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check if this is first time (no PIN stored)
  useEffect(() => {
    getKey(ADMIN_PIN_HASH_KEY).then(stored => {
      if (!stored) setIsFirstTime(true)
    })
  }, [])

  // Countdown timer when locked
  useEffect(() => {
    if (locked) {
      let count = 30
      lockTimer.current = setInterval(() => {
        count -= 1
        setCountdown(count)
        if (count <= 0) {
          if (lockTimer.current) clearInterval(lockTimer.current)
          setLocked(false)
          setAttempts(0)
          setCountdown(30)
        }
      }, 1000)
    }
    return () => { if (lockTimer.current) clearInterval(lockTimer.current) }
  }, [locked])

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 14, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -14, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start()
  }

  async function handleDigit(d: string) {
    if (locked) return
    if (pin.length >= 6) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
    const newPin = pin + d
    setPin(newPin)

    if (newPin.length < 6) return

    // 6 digits entered
    if (isFirstTime && step === 'enter') {
      // First time: ask to confirm
      setConfirmPin(newPin)
      setStep('confirm')
      setPin('')
      return
    }

    if (isFirstTime && step === 'confirm') {
      if (newPin !== confirmPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        shake()
        setPin('')
        setStep('enter')
        setConfirmPin('')
        return
      }
    }

    // Verify (or set for first time)
    const result = await verifyOrSetPin(isFirstTime ? confirmPin : newPin)

    if (result === 'correct' || result === 'first_time_set') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (result === 'first_time_set') setIsFirstTime(false)
      navigation.replace('AdminDashboard')
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      shake()
      setPin('')
      const newAttempts = attempts + 1
      setAttempts(newAttempts)
      if (newAttempts >= 3) {
        setLocked(true)
      }
    }
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPin(p => p.slice(0, -1))
  }

  function handleCancel() {
    clearAdminMode()
    navigation.goBack()
  }

  const getPromptText = () => {
    if (isFirstTime && step === 'enter') return 'Set your admin PIN'
    if (isFirstTime && step === 'confirm') return 'Confirm your PIN'
    return ''  // no label for security — just dots
  }

  return (
    <View style={st.root}>
      <StatusBar hidden />

      {/* No branding. Pure dark screen. */}
      <View style={st.inner}>

        {/* Prompt — only shown first time */}
        {isFirstTime && (
          <Text style={st.firstTimePrompt}>{getPromptText()}</Text>
        )}

        {/* PIN dots */}
        <Animated.View style={[st.dots, { transform: [{ translateX: shakeAnim }] }]}>
          {Array(6).fill(null).map((_, i) => (
            <View key={i} style={[st.dot, i < pin.length && st.dotFilled]} />
          ))}
        </Animated.View>

        {locked ? (
          <View style={st.lockWrap}>
            <Text style={st.lockText}>Too many attempts</Text>
            <Text style={st.countdown}>{countdown}s</Text>
            <Text style={st.lockSub}>Try again shortly</Text>
          </View>
        ) : (
          <View style={st.keypad}>
            {KEYPAD.map((row, ri) => (
              <View key={ri} style={st.keyRow}>
                {row.map((key, ki) => {
                  if (key === '') {
                    return <View key={ki} style={st.keyEmpty} />
                  }
                  return (
                    <TouchableOpacity
                      key={ki}
                      style={st.key}
                      onPress={() => key === '⌫' ? handleDelete() : handleDigit(key)}
                      activeOpacity={0.6}
                    >
                      <Text style={[st.keyText, key === '⌫' && st.keyDelete]}>
                        {key}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            ))}
          </View>
        )}

        {/* Subtle cancel — bottom right, nearly invisible */}
        <TouchableOpacity onPress={handleCancel} style={st.cancelBtn}>
          <Text style={st.cancelText}>cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const KEY_SIZE = 72

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05050F',  // pure dark, NO video, NO branding
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  firstTimePrompt: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(201,168,76,0.6)',
    letterSpacing: 1,
  },
  dots: {
    flexDirection: 'row',
    gap: 18,
  },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  dotFilled: {
    backgroundColor: '#C9A84C',
    borderColor: '#C9A84C',
  },
  lockWrap: {
    alignItems: 'center',
    gap: 8,
  },
  lockText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,68,68,0.7)',
  },
  countdown: {
    fontFamily: Fonts.heading,
    fontSize: 36,
    color: '#C9A84C',
  },
  lockSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
  },
  keypad: {
    gap: 16,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 20,
  },
  key: {
    width: KEY_SIZE, height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  keyEmpty: {
    width: KEY_SIZE, height: KEY_SIZE,
  },
  keyText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 22,
    color: '#E8E8FF',
  },
  keyDelete: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 40,
    right: 32,
    padding: 10,
  },
  cancelText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.1)',
    letterSpacing: 1,
  },
})
