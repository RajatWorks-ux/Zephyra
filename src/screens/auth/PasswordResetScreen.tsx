// src/screens/auth/PasswordResetScreen.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
  Alert, Animated, StatusBar,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../constants/videos'
import { supabase } from '../../services/supabase'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'PasswordReset'>
}

function GlassInput({ label, placeholder, value, onChangeText, secureTextEntry = false, error }: any) {
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

export function PasswordResetScreen({ navigation }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({ password: '', confirm: '' })
  const [done, setDone] = useState(false)

  const floatY = useRef(new Animated.Value(0)).current
  const glow = useRef(new Animated.Value(0.5)).current
  const fadeIn = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -10, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start()
  }, [])

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
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setDone(true)
    }
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
          isLooping
          shouldPlay
          isMuted
        />
        <LinearGradient
          colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.92)']}
          style={StyleSheet.absoluteFillObject}
        />

        <Animated.View style={[styles.container, { opacity: fadeIn }]}>

          <View style={styles.visualArea}>
            <Animated.View style={[styles.glowCircle, { opacity: glow }]} />
            <Animated.View style={[styles.iconWrap, { transform: [{ translateY: floatY }] }]}>
              <LinearGradient colors={['#C9A84C', '#8B6914']} style={styles.iconGrad}>
                <Text style={styles.iconEmoji}>{done ? '✅' : '🔒'}</Text>
              </LinearGradient>
            </Animated.View>
          </View>

          {!done ? (
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
                style={[styles.btn, loading && { opacity: 0.6 }]}
                onPress={handleUpdate}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#C9A84C', '#8B6914']}
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
          ) : (
            <>
              <Text style={styles.heading}>Password Updated!</Text>
              <Text style={styles.sub}>
                Your password has been changed successfully.{'\n'}You can now sign in with your new password.
              </Text>

              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>✨ Account secured</Text>
              </View>

              <TouchableOpacity
                style={styles.btn}
                onPress={() => navigation.navigate('SignIn')}
              >
                <LinearGradient
                  colors={['#C9A84C', '#8B6914']}
                  style={styles.btnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>Sign In</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
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
    paddingTop: 80,
  },
  visualArea: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  glowCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(201,168,76,0.12)',
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
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 34 },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 30,
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 24,
    marginBottom: 20,
  },
  btn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnGrad: { paddingVertical: 20, alignItems: 'center' },
  btnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    color: '#0A0600',
    letterSpacing: 0.3,
  },
  infoPill: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  infoPillText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#C9A84C',
  },
})
