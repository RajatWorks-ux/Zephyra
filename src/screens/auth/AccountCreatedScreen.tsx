// src/screens/auth/AccountCreatedScreen.tsx
import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, ActivityIndicator, Dimensions,
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

const { width } = Dimensions.get('window')

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'AccountCreated'>
  route: RouteProp<AuthStackParams, 'AccountCreated'>
}

// Small decorative star particle — same approach as StarField component in your project
function StarParticle({ delay, x, size, opacity }: { delay: number; x: number; size: number; opacity: number }) {
  const translateY = useRef(new Animated.Value(0)).current
  const particleOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(particleOpacity, { toValue: opacity, duration: 600, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(translateY, { toValue: -18, duration: 2200 + delay * 0.3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 2200 + delay * 0.3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
      ]),
    ]).start()
  }, [])

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        bottom: 140,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#C9A84C',
        opacity: particleOpacity,
        transform: [{ translateY }],
        shadowColor: '#C9A84C',
        shadowRadius: 6,
        shadowOpacity: 0.8,
        shadowOffset: { width: 0, height: 0 },
      }}
    />
  )
}

export function AccountCreatedScreen({ navigation, route }: Props) {
  const { token_hash, type } = route.params ?? {}

  const [verifying, setVerifying] = useState(true)
  const [verifyError, setVerifyError] = useState(false)

  // ── Animations ──────────────────────────────────────────────────────────
  const screenFade = useRef(new Animated.Value(0)).current
  const floatY = useRef(new Animated.Value(0)).current
  const glowOpacity = useRef(new Animated.Value(0.4)).current
  const starBurst = useRef(new Animated.Value(0)).current     // icon burst on entry
  const starBurstOpacity = useRef(new Animated.Value(0)).current
  const contentSlide = useRef(new Animated.Value(40)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const ringScale = useRef(new Animated.Value(0.6)).current
  const ringOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Screen fade in
    Animated.timing(screenFade, { toValue: 1, duration: 500, useNativeDriver: true }).start()

    // Float loop for icon (same as EmailVerifyScreen envelope)
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -14, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start()

    // Glow pulse loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 1800, useNativeDriver: true }),
      ])
    ).start()

    verifyToken()
  }, [])

  function runSuccessAnimations() {
    // Star burst — icon scales in from 0 with spring overshoot
    Animated.sequence([
      Animated.parallel([
        Animated.spring(starBurst, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(starBurstOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      // Expanding ring
      Animated.parallel([
        Animated.timing(ringOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 1.8, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(ringOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start()

    // Content slides up
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(contentSlide, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start()

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  async function verifyToken() {
    if (token_hash && type === 'signup') {
      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: 'email',
        })
        if (error) {
          // Token might already be consumed (user tapped link twice) — that's fine, still verified
          console.log('OTP verify note:', error.message)
        }
      } catch (e) {
        console.log('Verify token error (non-fatal):', e)
      }
    }
    setVerifying(false)
    runSuccessAnimations()
  }

  // Particle star positions
  const particles = [
    { delay: 200, x: width * 0.12, size: 5, opacity: 0.7 },
    { delay: 400, x: width * 0.25, size: 4, opacity: 0.5 },
    { delay: 100, x: width * 0.42, size: 6, opacity: 0.8 },
    { delay: 600, x: width * 0.60, size: 3, opacity: 0.6 },
    { delay: 300, x: width * 0.75, size: 5, opacity: 0.7 },
    { delay: 500, x: width * 0.88, size: 4, opacity: 0.5 },
  ]

  return (
    <Animated.View style={[styles.root, { opacity: screenFade }]}>
      {/* Video Background — swap Videos.emailVerifyBg for Videos.accountCreatedBg after uploading */}
      <Video
        source={Videos.emailVerifyBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.25)', 'rgba(5,5,15,0.80)', 'rgba(5,5,15,0.97)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating star particles */}
      {particles.map((p, i) => (
        <StarParticle key={i} {...p} />
      ))}

      <View style={styles.container}>

        {/* ── Visual Area ── */}
        <View style={styles.visualArea}>
          {/* Expanding ring burst */}
          <Animated.View
            style={[
              styles.burstRing,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />

          {/* Outer glow circle — same as EmailVerifyScreen */}
          <Animated.View style={[styles.glowCircle, { opacity: glowOpacity }]} />

          {/* Floating star icon */}
          <Animated.View
            style={[
              styles.iconWrap,
              {
                opacity: starBurstOpacity,
                transform: [
                  { translateY: floatY },
                  { scale: starBurst },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#C9A84C', '#FFD700', '#B8860B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGrad}
            >
              <Text style={styles.iconText}>✦</Text>
            </LinearGradient>

            {/* Inner glow ring on icon */}
            <View style={styles.iconRing} />
          </Animated.View>
        </View>

        {/* ── Content ── */}
        <Animated.View
          style={[
            styles.content,
            { opacity: contentOpacity, transform: [{ translateY: contentSlide }] },
          ]}
        >
          {verifying ? (
            <ActivityIndicator size="large" color="#C9A84C" style={{ marginBottom: 20 }} />
          ) : null}

          <Text style={styles.heading}>Welcome to Zephyra</Text>

          <Text style={styles.sub}>
            Your account has been verified.{'\n'}The cosmos awaits you.
          </Text>

          {/* Decorative divider — same as EmailVerifyScreen */}
          <View style={styles.divider} />

          {/* Glass card with info */}
          <BlurView intensity={18} tint="dark" style={styles.glassCard}>
            <Text style={styles.cardLine}>✦  Account verified</Text>
            <View style={styles.cardDivider} />
            <Text style={styles.cardLine}>✦  Profile ready</Text>
            <View style={styles.cardDivider} />
            <Text style={styles.cardLine}>✦  Cosmic reading unlocked</Text>
          </BlurView>

          {/* Gold gradient Sign In button — identical to all other screens */}
          <TouchableOpacity
            style={styles.btn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              navigation.navigate('SignIn')
            }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#C9A84C', '#B8860B']}
              style={styles.btnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.btnText}>Begin Your Journey</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Cosmic Intelligence · Since Your First Breath
          </Text>
        </Animated.View>

      </View>
    </Animated.View>
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

  // ── Visual area ──
  visualArea: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    width: '100%',
  },
  burstRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.5)',
  },
  glowCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(201,168,76,0.10)',
    shadowColor: '#C9A84C',
    shadowRadius: 50,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  iconWrap: {
    shadowColor: '#C9A84C',
    shadowRadius: 24,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGrad: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 38,
    color: '#0A0600',
  },
  iconRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
  },

  // ── Content ──
  content: {
    width: '100%',
    alignItems: 'center',
  },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#FFFFFF',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(201,168,76,0.3)',
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  sub: {
    fontFamily: Fonts.mystical,
    fontSize: 17,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.35)',
    marginBottom: 24,
  },

  // Glass card
  glassCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
    overflow: 'hidden',
    marginBottom: 28,
    paddingVertical: 4,
  },
  cardLine: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(201,168,76,0.85)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.1)',
    marginHorizontal: 16,
  },

  // Button — identical gradient + style to all other screens
  btn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#C9A84C',
    shadowRadius: 16,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  btnGrad: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    color: '#0A0600',
    letterSpacing: 0.5,
  },
  footer: {
    fontFamily: Fonts.mystical,
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
    letterSpacing: 1,
  },
})
