// src/screens/auth/SplashScreen.tsx
import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../constants/videos'
import { LinearGradient } from 'expo-linear-gradient'
import { Video, ResizeMode } from 'expo-av'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated'

const { width, height } = Dimensions.get('window')
const APP_NAME = 'ZEPHYRA'
const letters = APP_NAME.split('')

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'Splash'>
}

export function SplashScreen({ navigation }: Props) {
  const letterAnims = letters.map(() => useSharedValue(0))
  const taglineOpacity = useSharedValue(0)
  const taglineY = useSharedValue(20)
  const screenOpacity = useSharedValue(1)
  const orbScale = useSharedValue(0.8)
  const orbOpacity = useSharedValue(0)
  const glowPulse = useSharedValue(0)

  useEffect(() => {
    // Orb appears first
    orbOpacity.value = withTiming(1, { duration: 800 })
    orbScale.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })
    
    // Glow pulse loop
    glowPulse.value = withDelay(500, withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      false
    ))

    // Letters stagger in
    letters.forEach((_, i) => {
      letterAnims[i].value = withDelay(
        300 + i * 120,
        withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
      )
    })

    // Tagline fades in
    taglineOpacity.value = withDelay(
      300 + letters.length * 120 + 200,
      withTiming(1, { duration: 700 })
    )
    taglineY.value = withDelay(
      300 + letters.length * 120 + 200,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) })
    )

    // Navigate after animation
    const timer = setTimeout(async () => {
      screenOpacity.value = withTiming(0, { duration: 600 })
      await new Promise(r => setTimeout(r, 650))
      const hasLaunched = await AsyncStorage.getItem('zephyra_has_launched')
      if (hasLaunched) {
        navigation.replace('SignIn')
      } else {
        await AsyncStorage.setItem('zephyra_has_launched', 'true')
        navigation.replace('Onboarding')
      }
    }, 3200)

    return () => clearTimeout(timer)
  }, [])

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }))
  const orbStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value }],
  }))
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.3, 0.8]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.15]) }],
  }))
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }))

  return (
    <Animated.View style={[styles.root, screenStyle]}>
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
        <Animated.View style={[styles.glowRing, glowStyle]} />
        <Animated.View style={[styles.orb, orbStyle]}>
          <LinearGradient
            colors={['#C9A84C', '#7C3AED', '#C9A84C']}
            style={styles.orbGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Animated letters */}
        <View style={styles.nameRow}>
          {letters.map((letter, i) => {
            const animStyle = useAnimatedStyle(() => ({
              opacity: letterAnims[i].value,
              transform: [{
                translateY: interpolate(letterAnims[i].value, [0, 1], [30, 0])
              }]
            }))
            return (
              <Animated.Text key={i} style={[styles.letter, animStyle]}>
                {letter}
              </Animated.Text>
            )
          })}
        </View>

        {/* Decorative line */}
        <View style={styles.decorLine} />

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, taglineStyle]}>
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
    
