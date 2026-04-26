import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { ScreenWrapper } from '../../components/layout/ScreenWrapper'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { supabase } from '../../services/supabase'

WebBrowser.maybeCompleteAuthSession()

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'SignIn'>
}

type Mode = 'signin' | 'signup'

export function SignInScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (mode === 'signup') {
      if (!name.trim() || name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters'
      }
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email address'
    }

    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (mode === 'signup' && password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleEmailAuth() {
    if (!validate()) return
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
          },
        })
        if (error) {
          Alert.alert('Sign Up Failed', error.message)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          Alert.alert('Sign In Failed', error.message)
        }
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
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      })
      if (error || !data.url) {
        Alert.alert('Google Sign In Failed', error?.message || 'No URL returned')
        return
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success') {
        const url = result.url
        const { params } = Linking.parse(url)
        const code = params?.code
        if (code) {
          await supabase.auth.exchangeCodeForSession(String(code))
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
  }

  function handlePhone() {
    navigation.navigate('PhoneOTP', { phone: '' })
  }

  function getPasswordStrength(): { label: string; color: string; width: string } {
    if (password.length === 0) return { label: '', color: 'transparent', width: '0%' }
    if (password.length < 6) return { label: 'Weak', color: Colors.marsRed, width: '30%' }
    if (password.length < 10) return { label: 'Fair', color: Colors.amber, width: '60%' }
    return { label: 'Strong', color: Colors.jupiterGreen, width: '100%' }
  }

  const strength = getPasswordStrength()

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.appName}>ZEPHYRA</Text>
        <Text style={styles.heading}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </Text>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'signin' && styles.modeTabActive]}
            onPress={() => {
              setMode('signin')
              setErrors({})
            }}
          >
            <Text style={[styles.modeTabText, mode === 'signin' && styles.modeTabTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'signup' && styles.modeTabActive]}
            onPress={() => {
              setMode('signup')
              setErrors({})
            }}
          >
            <Text style={[styles.modeTabText, mode === 'signup' && styles.modeTabTextActive]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'signup' && (
            <Input
              label="Your Name"
              placeholder="How should we call you?"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              error={errors.name}
            />
          )}

          <Input
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            error={errors.email}
          />

          <Input
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />

          {mode === 'signup' && password.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBar}>
                <View
                  style={[
                    styles.strengthFill,
                    { width: strength.width, backgroundColor: strength.color },
                  ]}
                />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          {mode === 'signup' && (
            <Input
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
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </TouchableOpacity>
          )}

          <Button
            label={mode === 'signin' ? 'Sign In' : 'Create Account'}
            onPress={handleEmailAuth}
            loading={loading}
            style={styles.submitButton}
          />
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* OAuth options */}
        <View style={styles.oauthContainer}>
          <Button
            label="Google"
            onPress={handleGoogle}
            variant="outline"
            style={styles.oauthButton}
          />
          <Button
            label="Phone"
            onPress={handlePhone}
            variant="outline"
            style={styles.oauthButton}
          />
        </View>

        <Text style={styles.legalNote}>
          By continuing you agree to our Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  appName: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    color: Colors.starGold,
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 8,
  },
  heading: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 32,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 28,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: Colors.primaryViolet,
  },
  modeTabText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.textMuted,
  },
  modeTabTextActive: {
    color: Colors.moonWhite,
  },
  form: {
    gap: 4,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 8,
    gap: 10,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    backgroundColor: Colors.cardBorder,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    letterSpacing: 1,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.nebulaCyan,
    textDecorationLine: 'underline',
  },
  submitButton: {
    marginTop: 8,
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  oauthContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  oauthButton: {
    flex: 1,
  },
  legalNote: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
})