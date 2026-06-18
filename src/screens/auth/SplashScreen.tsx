// src/screens/auth/SplashScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Splash screen — shown EVERY time the app is opened.
// Shows the logo (zephyra-logo.png) + animated "ZEPHYRA" + tagline.
// After animation completes, routes to:
//   • Onboarding  — brand-new user (no zephyra_has_launched key)
//   • SignIn       — returning user who is not signed in
// (Signed-in users bypass this screen entirely via RootNavigator.)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Dimensions, Animated, Easing, Image,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../constants/videos'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode } from 'expo-av'

const { width, height } = Dimensions.get('window')
const APP_NAME = 'ZEPHYRA'
const letters = APP_NAME.split('')

// Logo image — save your PNG to assets/images/zephyra-logo.png
const LOGO = (() => {
  try { return require('../../../assets/images/zephyra-logo.png') } catch { return null }
})()

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'Splash'>
}

export function SplashScreen({ navigation }: Props) {
  // Logo animations
  const logoScale   = useRef(new Animated.Value(0.4)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoY       = useRef(new Animated.Value(-30)).current

  // Glow behind logo
  const glowPulse = useRef(new Animated.Value(0)).current
  const glowScale = useRef(new Animated.Value(0.6)).current
  const glowOpacity = useRef(new Animated.Value(0)).current

  // Letter animations
  const letterAnims = useRef(letters.map(() => new Animated.Value(0))).current

  // Tagline
  const taglineOpacity = useRef(new Animated.Value(0)).current
  const taglineY       = useRef(new Animated.Value(18)).current

  // Divider line
  const lineWidth   = useRef(new Animated.Value(0)).current
  const lineOpacity = useRef(new Animated.Value(0)).current

  // Whole-screen fade out
  const screenOpacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // ── 1. Glow appears first ───────────────────────────────────────────────
    Animated.parallel([
      Animated.timing(glowOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(glowScale,   { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start()

    // Glow pulse loop
    const glowLoop = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 2200, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0, duration: 2200, useNativeDriver: true }),
        ])
      ).start()
    }, 400)

    // ── 2. Logo rises in ───────────────────────────────────────────────────
    const logoDelay = 200
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(logoScale,   { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.05)), useNativeDriver: true }),
        Animated.timing(logoY,       { toValue: 0, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    }, logoDelay)

    // ── 3. Letters stagger in ──────────────────────────────────────────────
    const lettersStart = 700
    letters.forEach((_, i) => {
      Animated.sequence([
        Animated.delay(lettersStart + i * 100),
        Animated.timing(letterAnims[i], {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    })

    // ── 4. Divider line expands ────────────────────────────────────────────
    const lineDelay = lettersStart + letters.length * 100 + 100
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(lineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(lineWidth,   { toValue: 100, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]).start()
    }, lineDelay)

    // ── 5. Tagline fades in ────────────────────────────────────────────────
    const taglineDelay = lineDelay + 300
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(taglineY,       { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    }, taglineDelay)

    // ── 6. Navigate after full animation ───────────────────────────────────
    const navTimer = setTimeout(async () => {
      Animated.timing(screenOpacity, {
        toValue: 0, duration: 700, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start()
      await new Promise(r => setTimeout(r, 720))

      const hasLaunched = await AsyncStorage.getItem('zephyra_has_launched')
      if (hasLaunched) {
        navigation.replace('SignIn')
      } else {
        await AsyncStorage.setItem('zephyra_has_launched', 'true')
        navigation.replace('Onboarding')
      }
    }, 3800)

    return () => {
      clearTimeout(glowLoop)
      clearTimeout(navTimer)
    }
  }, [])

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      {/* ── Video background ── */}
      <Video
        source={Videos.splashBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />

      {/* ── Dark overlay gradient ── */}
      <LinearGradient
        colors={['rgba(5,5,15,0.25)', 'rgba(5,5,15,0.55)', 'rgba(5,5,15,0.8)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Centre content ── */}
      <View style={styles.center}>

        {/* Radial glow behind logo */}
        <Animated.View style={[
          styles.glowOuter,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}>
          <Animated.View style={[
            styles.glowInner,
            {
              opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
              transform: [{ scale: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
            },
          ]} />
        </Animated.View>

        {/* Logo image */}
        {LOGO && (
          <Animated.Image
            source={LOGO}
            style={[
              styles.logo,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { translateY: logoY }],
              },
            ]}
            resizeMode="contain"
          />
        )}

        {/* ZEPHYRA animated letters */}
        <View style={styles.nameRow}>
          {letters.map((letter, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                {
                  opacity: letterAnims[i],
                  transform: [{
                    translateY: letterAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [28, 0],
                    }),
                  }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>

        {/* Decorative divider */}
        <View style={styles.decorRow}>
          <View style={styles.decorDot} />
          <Animated.View style={[styles.decorLine, { width: lineWidth, opacity: lineOpacity }]} />
          <View style={styles.decorDiamond} />
          <Animated.View style={[styles.decorLine, { width: lineWidth, opacity: lineOpacity }]} />
          <View style={styles.decorDot} />
        </View>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            { opacity: taglineOpacity, transform: [{ translateY: taglineY }] },
          ]}
        >
          Every Star · Every System · Your Entire Life
        </Animated.Text>
      </View>
    </Animated.View>
  )
}

const LOGO_SIZE = 160

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05050F',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  // ── Glow ──────────────────────────────────────────────────────────────────
  glowOuter: {
    position: 'absolute',
    width: LOGO_SIZE * 2,
    height: LOGO_SIZE * 2,
    alignItems: 'center',
    justifyContent: 'center',
    // vertically align with logo centre
    top: '50%',
    marginTop: -(LOGO_SIZE * 1.5),   // nudge up to match logo position
  },
  glowInner: {
    width: LOGO_SIZE * 1.6,
    height: LOGO_SIZE * 1.6,
    borderRadius: LOGO_SIZE * 0.8,
    backgroundColor: 'transparent',
    shadowColor: '#7C3AED',
    shadowRadius: 60,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    // Android fallback
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.15)',
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: 32,
    // subtle drop shadow so logo lifts off background
    shadowColor: '#C9A84C',
    shadowRadius: 24,
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
  },

  // ── Name row ─────────────────────────────────────────────────────────────
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  letter: {
    fontFamily: Fonts.heading,
    fontSize: 38,
    color: '#C9A84C',
    letterSpacing: 10,
    textShadowColor: 'rgba(201,168,76,0.55)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  decorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 6,
  },
  decorLine: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.45)',
  },
  decorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(201,168,76,0.5)',
  },
  decorDiamond: {
    width: 6,
    height: 6,
    backgroundColor: '#C9A84C',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#C9A84C',
    shadowRadius: 6,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },

  // ── Tagline ───────────────────────────────────────────────────────────────
  tagline: {
    fontFamily: Fonts.mystical,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    letterSpacing: 2,
    lineHeight: 22,
  },
})
