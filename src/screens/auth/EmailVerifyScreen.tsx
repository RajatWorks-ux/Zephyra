// src/screens/auth/EmailVerifyScreen.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Animated,
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

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'EmailVerify'>
  route: RouteProp<AuthStackParams, 'EmailVerify'>
}

export function EmailVerifyScreen({ navigation, route }: Props) {
  const { email } = route.params
  const [resendTimer, setResendTimer] = useState(60)
  const [resendLoading, setResendLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Envelope float animation
  const floatY = useRef(new Animated.Value(0)).current
  const glow = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    // Float loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -12, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start()

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start()

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

  async function handleResend() {
    if (resendTimer > 0 || resendLoading) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setResendLoading(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResendLoading(false)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Sent!', 'A new verification link has been sent to your email.')
      startTimer()
    }
  }

  return (
    <View style={styles.root}>
      <Video
        source={Videos.emailVerifyBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping shouldPlay isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.85)']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.container}>

        {/* Floating envelope visual */}
        <View style={styles.visualArea}>
          <Animated.View style={[styles.glowCircle, { opacity: glow }]} />
          <Animated.View style={[styles.envelopeWrap, { transform: [{ translateY: floatY }] }]}>
            <LinearGradient colors={['#C9A84C', '#8B6914']} style={styles.envelope}>
              <Text style={styles.envelopeIcon}>✉</Text>
            </LinearGradient>
          </Animated.View>
        </View>

        <Text style={styles.heading}>Check Your Email</Text>

        <Text style={styles.sub}>
          We sent a verification link to
        </Text>
        <Text style={styles.emailText}>{email}</Text>

        <Text style={styles.instruction}>
          Open your email and tap the link{'\n'}to verify your account.
        </Text>

        <Text style={styles.subNote}>Don't forget to check your spam folder</Text>

        {/* Decorative divider */}
        <View style={styles.divider} />

        {/* Info pill */}
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>
            Once verified, come back and sign in
          </Text>
        </View>

        {/* Resend */}
        <TouchableOpacity
          onPress={handleResend}
          disabled={resendTimer > 0 || resendLoading}
          style={styles.resendBtn}
        >
          <Text style={[styles.resendText, (resendTimer > 0 || resendLoading) && styles.resendDisabled]}>
            {resendLoading
              ? 'Sending...'
              : resendTimer > 0
              ? `Resend link in ${resendTimer}s`
              : 'Resend verification link'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Wrong email? Go back</Text>
        </TouchableOpacity>

      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    alignItems: 'center',
  },
  visualArea: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
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
  envelopeIcon: {
    fontSize: 30,
    color: '#0A0600',
  },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 30,
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 6,
  },
  emailText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: '#C9A84C',
    textAlign: 'center',
    marginBottom: 20,
  },
  instruction: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
  },
  subNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 28,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.3)',
    marginBottom: 24,
  },
  infoPill: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 32,
  },
  infoPillText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#C9A84C',
    textAlign: 'center',
  },
  resendBtn: { paddingVertical: 12, marginBottom: 8 },
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
  backBtn: { marginTop: 4, paddingVertical: 8 },
  backText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
})
