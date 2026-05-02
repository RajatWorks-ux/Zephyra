// src/screens/auth/SignInScreen.tsx
import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, KeyboardAvoidingView, Platform, Animated,
} from 'react-native'
import * as Linking from 'expo-linking'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../constants/videos'
import { supabase } from '../../services/supabase'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'SignIn'>
}
type Mode = 'signin' | 'signup'

// ─── GlassInput — unchanged from original ────────────────────────────────────
function GlassInput({
  label, placeholder, value, onChangeText, secureTextEntry = false,
  keyboardType = 'default', error, autoCapitalize = 'none',
}: any) {
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
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? <Text style={gi.error}>{error}</Text> : null}
    </View>
  )
}

const gi = StyleSheet.create({
  wrap: { marginBottom: 14 },
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
    overflow: 'hidden',
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
    marginLeft: 4,
  },
})
// ─────────────────────────────────────────────────────────────────────────────

export function SignInScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ─── Sliding pill animation state ─────────────────────────────────────────
  // toggleWidth is measured via onLayout so the pill knows exactly how far to slide.
  const [toggleWidth, setToggleWidth] = useState(0)
  const pillAnim   = useRef(new Animated.Value(0)).current  // 0 = Sign In, 1 = Sign Up
  const formOpacity = useRef(new Animated.Value(1)).current // fades form between modes
  const formSlide   = useRef(new Animated.Value(0)).current // subtle translateX on switch
  // ──────────────────────────────────────────────────────────────────────────

  // ─── Mode switcher with spring pill + form fade ────────────────────────────
  function switchMode(newMode: Mode) {
    if (newMode === mode) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // Pill slides to new side with spring feel
    Animated.spring(pillAnim, {
      toValue: newMode === 'signup' ? 1 : 0,
      useNativeDriver: true,
      tension: 130,
      friction: 9,
    }).start()

    // Form fades + slides out, state flips, then fades + slides back in
    const outDir = newMode === 'signup' ? -14 : 14
    Animated.parallel([
      Animated.timing(formOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(formSlide,   { toValue: outDir, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setMode(newMode)
      setErrors({})
      formSlide.setValue(-outDir) // start the enter-slide from the opposite side
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(formSlide,   { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start()
    })
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ─── Pill translate: 0 → right half of toggle bar ─────────────────────────
  // Pill lives at left:4 top:4 bottom:4, width = half of (containerWidth - 8).
  // translateX shifts it exactly one pill-width to the right for "Sign Up".
  const pillHalfWidth = toggleWidth > 0 ? (toggleWidth - 8) / 2 : 0
  const pillTranslateX = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillHalfWidth],
  })
  // ──────────────────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (mode === 'signup' && (!name.trim() || name.trim().length < 2))
      e.name = 'Name must be at least 2 characters'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = 'Enter a valid email address'
    if (!password || password.length < 8)
      e.password = 'Password must be at least 8 characters'
    if (mode === 'signup' && password !== confirmPassword)
      e.confirmPassword = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function getStrength() {
    if (!password) return { label: '', color: 'transparent', w: '0%' }
    if (password.length < 6) return { label: 'Weak', color: '#EF4444', w: '30%' }
    if (password.length < 10) return { label: 'Fair', color: '#F59E0B', w: '60%' }
    return { label: 'Strong', color: '#10B981', w: '100%' }
  }

  async function handleEmailAuth() {
    if (!validate()) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)
    try {
      if (mode === 'signup') {
        // ── Pre-check: is this email already taken? ──────────────────────────
        // This gives much better error messages than raw Supabase errors.
        // ─────────────────────────────────────────────────────────────────────
        const { data: authMethod } = await supabase.rpc(
          'check_email_auth_method',
          { p_email: email.trim() }
        )
        if (authMethod === 'email') {
          setLoading(false)
          Alert.alert(
            'Account Already Exists',
            'An account with this email already exists. Please sign in instead. If you forgot your password, tap "Forgot Password".',
            [
              { text: 'Sign In', onPress: () => switchMode('signin') },
              { text: 'Forgot Password', onPress: () => navigation.navigate('ForgotPassword') },
              { text: 'Cancel', style: 'cancel' },
            ]
          )
          return
        }
        if (authMethod === 'oauth:google') {
          // ── Google account exists — Google login is no longer available.
          // Direct the user to phone sign-in as the alternative. ────────────
          setLoading(false)
          Alert.alert(
            'Account Already Registered',
            'This email is linked to an existing account. Please use Phone sign-in below, or try a different email address.',
            [{ text: 'OK' }]
          )
          return
        }
        if (authMethod === 'phone') {
          setLoading(false)
          Alert.alert(
            'Phone Account Exists',
            'This email is linked to a phone number account. Please sign in using the Phone button below.',
            [{ text: 'OK' }]
          )
          return
        }
        // ── No existing account found — proceed with signup ──────────────────
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: Linking.createURL('account-created'),
          },
        })
        if (error) {
          Alert.alert('Sign Up Failed', error.message)
        } else {
          navigation.navigate('EmailVerify', { email: email.trim() })
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        })
        if (error) Alert.alert('Sign In Failed', error.message)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  const strength = getStrength()

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>

        {/* ── Video Background — unchanged ───────────────────────────────── */}
        <Video
          source={Videos.signInBg}
          style={StyleSheet.absoluteFillObject}
          resizeMode={ResizeMode.COVER}
          isLooping shouldPlay isMuted
        />
        <LinearGradient
          colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.85)']}
          style={StyleSheet.absoluteFillObject}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Logo — unchanged ─────────────────────────────────────────── */}
          <View style={styles.logoArea}>
            <View style={styles.logoOrb}>
              <LinearGradient
                colors={['#C9A84C', '#7C3AED']}
                style={{ flex: 1, borderRadius: 28 }}
              />
            </View>
            <Text style={styles.appName}>ZEPHYRA</Text>
            <Text style={styles.appTagline}>Cosmic Intelligence · Since Your First Breath</Text>
          </View>

          {/* ── Glass card ───────────────────────────────────────────────── */}
          <BlurView intensity={20} tint="dark" style={styles.card}>

            {/* ── NEW: Animated sliding pill mode toggle ─────────────────── */}
            <View
              style={styles.modeToggle}
              onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}
            >
              {/* Pill — absolutely positioned, slides under the active label */}
              <Animated.View
                style={[
                  styles.modePill,
                  {
                    width: pillHalfWidth || '50%',
                    transform: [{ translateX: pillTranslateX }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['#6D28D9', '#7C3AED']}
                  style={styles.modePillGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>

              {/* Tab labels — sit above the pill via zIndex ──────────────── */}
              <TouchableOpacity
                style={styles.modeTab}
                onPress={() => switchMode('signin')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modeTab}
                onPress={() => switchMode('signup')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
            {/* ─────────────────────────────────────────────────────────── */}

            {/* ── Form — wraps in Animated.View for fade + slide effect ─── */}
            <Animated.View
              style={{
                opacity: formOpacity,
                transform: [{ translateX: formSlide }],
              }}
            >
              <View style={styles.form}>
                {mode === 'signup' && (
                  <GlassInput
                    label="Your Name"
                    placeholder="How should we call you?"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    error={errors.name}
                  />
                )}

                <GlassInput
                  label="Email"
                  placeholder="your@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  error={errors.email}
                />

                <GlassInput
                  label="Password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  error={errors.password}
                />

                {mode === 'signup' && password.length > 0 && (
                  <View style={styles.strengthRow}>
                    <View style={styles.strengthBar}>
                      <View
                        style={[
                          styles.strengthFill,
                          { width: strength.w as any, backgroundColor: strength.color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.strengthLabel, { color: strength.color }]}>
                      {strength.label}
                    </Text>
                  </View>
                )}

                {mode === 'signup' && (
                  <GlassInput
                    label="Confirm Password"
                    placeholder="Same password again"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    error={errors.confirmPassword}
                  />
                )}

                {mode === 'signin' && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ForgotPassword')}
                    style={styles.forgotLink}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}

                {/* Primary CTA — unchanged */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                  onPress={handleEmailAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#C9A84C', '#B8860B']}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.primaryBtnText}>
                      {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
            {/* ─────────────────────────────────────────────────────────── */}

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Phone button — full width, glass-purple style ─────────── */}
            <TouchableOpacity
              style={styles.phoneBtn}
              onPress={() => navigation.navigate('PhoneOTP', { phone: '' })}
              activeOpacity={0.8}
            >
              <Text style={styles.phoneBtnIcon}>📱</Text>
              <Text style={styles.phoneBtnText}>Continue with Phone</Text>
            </TouchableOpacity>
            {/* ─────────────────────────────────────────────────────────── */}

            <Text style={styles.legal}>
              By continuing you agree to our Terms and Privacy Policy
            </Text>
          </BlurView>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },

  // ── Logo — unchanged ──────────────────────────────────────────────────────
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 12,
    shadowColor: '#C9A84C',
    shadowRadius: 20,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 15,
    overflow: 'hidden',
  },
  appName: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: '#C9A84C',
    letterSpacing: 8,
    marginBottom: 4,
  },
  appTagline: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.5,
  },

  // ── Card — unchanged ──────────────────────────────────────────────────────
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    padding: 24,
  },

  // ── NEW: Animated pill toggle ─────────────────────────────────────────────
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
    position: 'relative',         // so the absolute pill sits inside
  },
  modePill: {
    // Absolutely positioned inside modeToggle; width is set dynamically inline
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 10,
    overflow: 'hidden',
    // Shadow gives depth to the pill against the toggle background
    shadowColor: '#7C3AED',
    shadowRadius: 8,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  modePillGrad: { flex: 1 },
  modeTab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 10,
    zIndex: 1,                    // labels sit above the sliding pill
  },
  modeTabText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  modeTabTextActive: { color: '#FFFFFF' },
  // ─────────────────────────────────────────────────────────────────────────

  // ── Form — unchanged ──────────────────────────────────────────────────────
  form: { gap: 0 },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -8,
    marginBottom: 14,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    letterSpacing: 1,
    width: 40,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotText: { fontFamily: Fonts.body, fontSize: 13, color: '#C9A84C' },
  primaryBtn: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  primaryBtnGrad: { paddingVertical: 18, alignItems: 'center', borderRadius: 16 },
  primaryBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    color: '#0A0600',
    letterSpacing: 0.3,
  },

  // ── Divider — unchanged ───────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },

  // ── NEW: Full-width Phone button ──────────────────────────────────────────
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.45)',
    backgroundColor: 'rgba(124,58,237,0.10)',
    marginBottom: 20,
    // Subtle inner glow matching the purple palette
    shadowColor: '#7C3AED',
    shadowRadius: 10,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  phoneBtnIcon: { fontSize: 18 },
  phoneBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.2,
  },
  // ─────────────────────────────────────────────────────────────────────────

  legal: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    lineHeight: 18,
  },
})
