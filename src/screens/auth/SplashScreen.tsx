// src/screens/auth/SplashScreen.tsx
import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Dimensions, Animated, Easing } from 'react-native'
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

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'Splash'>
}

export function SplashScreen({ navigation }: Props) {
  const letterAnims = useRef(letters.map(() => new Animated.Value(0))).current
  const taglineOpacity = useRef(new Animated.Value(0)).current
  const taglineY = useRef(new Animated.Value(20)).current
  const screenOpacity = useRef(new Animated.Value(1)).current
  const orbScale = useRef(new Animated.Value(0.8)).current
  const orbOpacity = useRef(new Animated.Value(0)).current
  const glowPulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Orb appears first
    Animated.timing(orbOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start()

    Animated.timing(orbScale, {
      toValue: 1,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()

    // Glow pulse loop (starts after 500ms delay)
    const glowTimeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start()
    }, 500)

    // Letters stagger in
    letters.forEach((_, i) => {
      Animated.sequence([
        Animated.delay(300 + i * 120),
        Animated.timing(letterAnims[i], {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    })

    // Tagline fades in
    const taglineDelay = 300 + letters.length * 120 + 200
    Animated.sequence([
      Animated.delay(taglineDelay),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(taglineY, {
          toValue: 0,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start()

    // Navigate after animation
    const timer = setTimeout(async () => {
      Animated.timing(screenOpacity, { toValue: 0, duration: 600, useNativeDriver: true }).start()
      await new Promise(r => setTimeout(r, 650))
      const hasLaunched = await AsyncStorage.getItem('zephyra_has_launched')
      if (hasLaunched) {
        navigation.replace('SignIn')
      } else {
        await AsyncStorage.setItem('zephyra_has_launched', 'true')
        navigation.replace('Onboarding')
      }
    }, 3200)

    return () => {
      clearTimeout(timer)
      clearTimeout(glowTimeout)
    }
  }, [])

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      {/* Video Background */}
      <Video
        source={Videos.splashBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />

      {/* Overlay gradient */}
      <LinearGradient
        colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.5)', 'rgba(5,5,15,0.7)']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.center}>
        {/* Glowing orb behind text */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }),
              transform: [{
                scale: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }),
              }],
            },
          ]}
        />
        <Animated.View
          style={[styles.orb, { opacity: orbOpacity, transform: [{ scale: orbScale }] }]}
        >
          <LinearGradient
            colors={['#C9A84C', '#7C3AED', '#C9A84C']}
            style={styles.orbGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Animated letters */}
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
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>

        {/* Decorative line */}
        <View style={styles.decorLine} />

        {/* Tagline */}
        <Animated.Text
          style={[styles.tagline, { opacity: taglineOpacity, transform: [{ translateY: taglineY }] }]}
        >
          Every Star · Every System · Your Entire Life
        </Animated.Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C9A84C40',
    shadowColor: '#C9A84C',
    shadowRadius: 40,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
  },
  orb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 40,
    shadowColor: '#C9A84C',
    shadowRadius: 30,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  orbGradient: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  letter: {
    fontFamily: Fonts.heading,
    fontSize: 40,
    color: '#C9A84C',
    letterSpacing: 8,
    textShadowColor: '#C9A84C80',
    textShadowRadius: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  decorLine: {
    width: 80,
    height: 1,
    backgroundColor: '#C9A84C60',
    marginBottom: 16,
  },
  tagline: {
    fontFamily: Fonts.mystical,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    letterSpacing: 1.5,
    lineHeight: 22,
  },
})
