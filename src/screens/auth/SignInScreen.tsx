// src/screens/auth/SignInScreen.tsx
import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
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

WebBrowser.maybeCompleteAuthSession()

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'SignIn'>
}
type Mode = 'signin' | 'signup'

// Border color derived from state — no animation library needed
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

export function SignInScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
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

  async function handleGoogle() {
    try {
      const redirectTo = Linking.createURL('auth/callback')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error || !data.url) {
        Alert.alert('Google Sign In Failed', error?.message || 'No URL')
        return
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success') {
        const { params } = Linking.parse(result.url)
        if (params?.code) {
          await supabase.auth.exchangeCodeForSession(String(params.code))
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }

  const strength = getStrength()

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        {/* Video Background */}
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
          {/* Logo */}
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

          {/* Glass card */}
          <BlurView intensity={20} tint="dark" style={styles.card}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              {(['signin', 'signup'] as Mode[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeTab, mode === m && styles.modeTabActive]}
                  onPress={() => { setMode(m); setErrors({}) }}
                >
                  <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                    {m === 'signin' ? 'Sign In' : 'Sign Up'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Form */}
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

              {/* Primary CTA */}
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

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle}>
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialLabel}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => navigation.navigate('PhoneOTP', { phone: '' })}
              >
                <Text style={styles.socialIcon}>☎</Text>
                <Text style={styles.socialLabel}>Phone</Text>
              </TouchableOpacity>
            </View>

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
  appName: { fontFamily: Fonts.heading, fontSize: 22, color: '#C9A84C', letterSpacing: 8, marginBottom: 4 },
  appTagline: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
  card: { borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', padding: 24 },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  modeTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  modeTabActive: { backgroundColor: '#7C3AED' },
  modeTabText: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  modeTabTextActive: { color: '#FFFFFF' },
  form: { gap: 0 },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: -8, marginBottom: 14 },
  strengthBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontFamily: Fonts.accent, fontSize: 10, letterSpacing: 1, width: 40 },
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 16, paddingVertical: 4 },
  forgotText: { fontFamily: Fonts.body, fontSize: 13, color: '#C9A84C' },
  primaryBtn: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  primaryBtnGrad: { paddingVertical: 18, alignItems: 'center', borderRadius: 16 },
  primaryBtnText: { fontFamily: Fonts.bodySemiBold, fontSize: 17, color: '#0A0600', letterSpacing: 0.3 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  dividerText: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  socialIcon: { fontFamily: Fonts.bodySemiBold, fontSize: 16, color: '#FFFFFF' },
  socialLabel: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  legal: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 18 },
})
