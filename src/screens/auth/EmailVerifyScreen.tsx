// src/screens/auth/EmailVerifyScreen.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../constants/videos'
import { supabase } from '../../services/supabase'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withDelay,
} from 'react-native-reanimated'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'EmailVerify'>
  route: RouteProp<AuthStackParams, 'EmailVerify'>
}

export function EmailVerifyScreen({ navigation, route }: Props) {
  const { email } = route.params
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(60)
  const inputRefs = useRef<(TextInput | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Envelope float animation
  const floatY = useSharedValue(0)
  const glow = useSharedValue(0.5)

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      false
    )
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 }),
        withTiming(0.4, { duration: 2000 })
      ),
      -1,
      false
    )

    startTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startTimer() {
    setResendTimer(60)
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const envelopeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }))
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  function handleOTPChange(text: string, index: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
    if (digit) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      const newOtp = [...otp]
      newOtp[index - 1] = ''
      setOtp(newOtp)
    }
  }

  async function handleVerify() {
    const code = otp.join('')
    if (code.length !== 6) {
      Alert.alert('Incomplete', 'Enter the 6-digit code from your email')
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })
      if (error) Alert.alert('Verification Failed', error.message)
      // On success, RootNavigator picks up the new session automatically
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (resendTimer > 0) return
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) Alert.alert('Error', error.message)
    else startTimer()
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        <Video
          source={Videos.emailVerifyBg}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay
          isMuted
        />
        <LinearGradient
          colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.9)']}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.container}>
          {/* Floating envelope visual */}
          <View style={styles.visualArea}>
            <Animated.View style={[styles.glowCircle, glowStyle]} />
            <Animated.View style={[styles.envelopeWrap, envelopeStyle]}>
              <LinearGradient
                colors={['#C9A84C', '#8B6914']}
                style={styles.envelope}
              >
                <Text style={styles.envelopeAt}>@</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          <Text style={styles.heading}>Verify Your Email</Text>
          <Text style={styles.sub}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
          <Text style={styles.subNote}>Check your inbox and spam folder</Text>

          {/* OTP input */}
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={r => (inputRefs.current[i] = r)}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : null,
                ]}
                value={digit}
                onChangeText={t => handleOTPChange(t, i)}
                onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Verify button */}
          <TouchableOpacity
            style={[styles.verifyBtn, loading && { opacity: 0.6 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            <LinearGradient
              colors={['#C9A84C', '#B8860B']}
              style={styles.verifyBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.verifyBtnText}>
                {loading ? 'Verifying...' : 'Confirm Email'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0} style={styles.resendBtn}>
            <Text style={[styles.resendText, resendTimer > 0 && styles.resendDisabled]}>
              {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Wrong email? Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    alignItems: 'center',
  },
  visualArea: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  glowCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(201,168,76,0.12)',
    shadowColor: '#C9A84C',
    shadowRadius: 40,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  envelopeWrap: {
    shadowColor: '#C9A84C',
    shadowRadius: 20,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 15,
  },
  envelope: {
    width: 80,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envelopeAt: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#0A0600',
  },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 4,
  },
  emailText: {
    fontFamily: Fonts.bodySemiBold,
    color: '#C9A84C',
  },
  subNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 36,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
    width: '100%',
  },
  otpBox: {
    flex: 1,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    textAlign: 'center',
    fontFamily: Fonts.heading,
    fontSize: 24,
    color: '#C9A84C',
  },
  otpBoxFilled: {
    borderColor: '#C9A84C',
    backgroundColor: 'rgba(201,168,76,0.1)',
    shadowColor: '#C9A84C',
    shadowRadius: 10,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
  },
  verifyBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  verifyBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  verifyBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    color: '#0A0600',
    letterSpacing: 0.3,
  },
  resendBtn: { paddingVertical: 12 },
  resendText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: '#C9A84C',
    textDecorationLine: 'underline',
  },
  resendDisabled: {
    color: 'rgba(255,255,255,0.3)',
    textDecorationLine: 'none',
  },
  backBtn: { marginTop: 8, paddingVertical: 8 },
  backText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
})
  
