// src/screens/auth/PasswordResetScreen.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
  Alert, Animated, Easing, StatusBar, ActivityIndicator,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../constants/videos'
import { supabase } from '../../services/supabase'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'PasswordReset'>
  route: RouteProp<AuthStackParams, 'PasswordReset'>
}

function GlassInput({
  label, placeholder, value, onChangeText, secureTextEntry = false, error,
}: {
  label: string
  placeholder: string
  value: string
  onChangeText: (t: string) => void
  secureTextEntry?: boolean
  error?: string
}) {
  const [focused, setFocused] = useState(false)
  const borderColor = error
    ? 'rgba(239,68,68,0.8)'
    : focused
    ? 'rgba(201,168,76,0.8)'
    : 'rgba(255,255,255,0.1)'
  return (
    <View style={gi.wrap}>
      <Text style={gi.label}>{label}</Text>
      <View style={[gi.inputWrap, { borderColor }]}>
        <TextInput
          style={gi.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? <Text style={gi.error}>{error}</Text> : null}
    </View>
  )
}

const gi = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  input: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(239,68,68,0.9)',
    marginTop: 6,
  },
})

// Three stages this screen can be in
type Stage = 'verifying' | 'form' | 'expired' | 'done'

export function PasswordResetScreen({ navigation, route }: Props) {
  const { code, token_hash, type } = route.params ?? {} as any

  const [stage, setStage] = useState<Stage>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({ password: '', confirm: '' })

  // ── Shared animations ────────────────────────────────────────────────────
  const fadeIn = useRef(new Animated.Value(0)).current
  const floatY = useRef(new Animated.Value(0)).current
  const glow = useRef(new Animated.Value(0.5)).current

  // ── Success-specific animations ──────────────────────────────────────────
  const checkScale = useRef(new Animated.Value(0)).current
  const checkOpacity = useRef(new Animated.Value(0)).current
  const ringScale = useRef(new Animated.Value(0.7)).current
  const ringOpacity = useRef(new Animated.Value(0)).current
  const successContent = useRef(new Animated.Value(30)).current
  const successContentOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -10, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
      ])
    ).start()

    // Exchange the token / code for a live session immediately when screen opens
    establishSession()
  }, [])

  async function establishSession() {
    const params = route.params ?? {} as any
    const { code, token_hash, type } = params

    try {
      if (code) {
        // ── PKCE flow from {{ .ConfirmationURL }} ──────────────────────────
        // exchangeCodeForSession establishes a RECOVERY session automatically
        const { error } = await supabase.auth.exchangeCodeForSession(String(code))
        if (error) {
          setStage('expired')
          return
        }
        setStage('form')
      } else if (token_hash && type === 'recovery') {
        // ── Direct token_hash flow (fallback) ─────────────────────────────
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
        if (error) {
          setStage('expired')
          return
        }
        setStage('form')
      } else {
        setStage('expired')
      }
    } catch (e) {
      setStage('expired')
    }
  }

  function runDoneAnimations() {
    // Check icon bursts in
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start()

    // Ring expands and fades
    Animated.sequence([
      Animated.parallel([
        Animated.timing(ringOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 2, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(ringOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start()

    // Success content slides up
    Animated.parallel([
      Animated.timing(successContentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(successContent, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start()

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  async function handleUpdate() {
    const errs = { password: '', confirm: '' }
    if (password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (password !== confirm) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    if (errs.password || errs.confirm) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    // Sign out so user gets a clean session after the reset
    await supabase.auth.signOut()
    setStage('done')
    runDoneAnimations()
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.root}>
        <Video
          source={Videos.forgotBg}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          isLooping shouldPlay isMuted
        />
        <LinearGradient
          colors={['rgba(5,5,15,0.35)', 'rgba(5,5,15,0.92)']}
          style={StyleSheet.absoluteFillObject}
        />

        <Animated.View style={[styles.container, { opacity: fadeIn }]}>

          {/* ── Visual area — icon changes per stage ── */}
          <View style={styles.visualArea}>
            {/* Burst ring — only visible on 'done' */}
            {stage === 'done' && (
              <Animated.View
                style={[styles.burstRing, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
              />
            )}

            <Animated.View style={[styles.glowCircle, { opacity: glow }]} />

            <Animated.View
              style={[
                styles.iconWrap,
                { transform: [{ translateY: floatY }] },
                stage === 'done' && { opacity: checkOpacity, transform: [{ translateY: floatY }, { scale: checkScale }] },
              ]}
            >
              <LinearGradient
                colors={
                  stage === 'expired'
                    ? ['#EF4444', '#991B1B']
                    : stage === 'done'
                    ? ['#10B981', '#065F46']
                    : ['#C9A84C', '#8B6914']
                }
                style={styles.iconGrad}
              >
                <Text style={styles.iconEmoji}>
                  {stage === 'verifying' ? '🔒'
                    : stage === 'form' ? '🔒'
                    : stage === 'expired' ? '⚠'
                    : '✓'}
                </Text>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* ── STAGE: verifying ── */}
          {stage === 'verifying' && (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color="#C9A84C" style={{ marginBottom: 20 }} />
              <Text style={styles.heading}>Verifying Link...</Text>
              <Text style={styles.sub}>Checking your reset link, just a moment.</Text>
            </View>
          )}

          {/* ── STAGE: expired ── */}
          {stage === 'expired' && (
            <>
              <Text style={styles.heading}>Link Expired</Text>
              <Text style={styles.sub}>
                This reset link has expired or has already been used.{'\n'}
                Please request a new one.
              </Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <LinearGradient
                  colors={['#C9A84C', '#B8860B']}
                  style={styles.btnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>Request New Link</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ── STAGE: form ── */}
          {stage === 'form' && (
            <>
              <Text style={styles.heading}>New Password</Text>
              <Text style={styles.sub}>
                Create a strong password for your Zephyra account.
              </Text>

              <GlassInput
                label="New Password"
                placeholder="Minimum 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={errors.password}
              />
              <GlassInput
                label="Confirm Password"
                placeholder="Repeat your password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                error={errors.confirm}
              />

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#C9A84C', '#B8860B']}
                  style={styles.btnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* ── STAGE: done ── */}
          {stage === 'done' && (
            <Animated.View
              style={{ width: '100%', opacity: successContentOpacity, transform: [{ translateY: successContent }] }}
            >
              <Text style={styles.heading}>Password Changed!</Text>
              <Text style={styles.sub}>
                Your password has been updated successfully.{'\n'}
                Your Zephyra account is now secure.
              </Text>

              {/* Success card */}
              <BlurView intensity={18} tint="dark" style={styles.successCard}>
                <Text style={styles.successLine}>✓  Password updated</Text>
                <View style={styles.successDivider} />
                <Text style={styles.successLine}>✓  Session refreshed</Text>
                <View style={styles.successDivider} />
                <Text style={styles.successLine}>✓  Account secured</Text>
              </BlurView>

              <TouchableOpacity
                style={styles.btn}
                onPress={() => navigation.navigate('SignIn')}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#C9A84C', '#B8860B']}
                  style={styles.btnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>Sign In</Text>
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.footer}>Cosmic Intelligence · Since Your First Breath</Text>
            </Animated.View>
          )}

        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 72,
  },
  centeredState: { alignItems: 'center', paddingTop: 8 },

  // Visual area
  visualArea: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  burstRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: 'rgba(16,185,129,0.6)',
  },
  glowCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(201,168,76,0.10)',
    shadowColor: '#C9A84C',
    shadowRadius: 40,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  iconWrap: {
    shadowColor: '#C9A84C',
    shadowRadius: 20,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 15,
  },
  iconGrad: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 34,
    color: '#FFFFFF',
  },

  heading: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 24,
    marginBottom: 24,
  },

  // Success card
  successCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    overflow: 'hidden',
    marginBottom: 28,
    paddingVertical: 4,
  },
  successLine: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(16,185,129,0.9)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    letterSpacing: 0.5,
  },
  successDivider: {
    height: 1,
    backgroundColor: 'rgba(16,185,129,0.1)',
    marginHorizontal: 16,
  },

  btn: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
  btnGrad: { paddingVertical: 20, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    color: '#0A0600',
    letterSpacing: 0.3,
  },
  footer: {
    fontFamily: Fonts.mystical,
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    letterSpacing: 1,
  },
})
    
