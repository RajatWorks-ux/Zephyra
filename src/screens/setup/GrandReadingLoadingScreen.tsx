import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { SetupStackParams } from '../../navigation/SetupNavigator'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../../constants/videos'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'

type Props = {
  navigation: NativeStackNavigationProp<SetupStackParams, 'GrandReadingLoading'>
  route: RouteProp<SetupStackParams, 'GrandReadingLoading'>
}

const LOADING_TEXTS = [
  'Reading your birth positions...',
  'Calculating your Vedic Nakshatra...',
  'Computing Chinese Four Pillars...',
  'Consulting the Mayan Tzolkin...',
  'Decoding Celtic tree signs...',
  'Examining Egyptian decans...',
  'Cross-referencing all 20 traditions...',
  'Building your complete cosmic profile...',
  'Synthesizing your unique truth...',
  'Almost ready...',
]

export function GrandReadingLoadingScreen({ navigation }: Props) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const textOpacity = useRef(new Animated.Value(1)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const rotateAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start()

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 9000,
      useNativeDriver: false,
    }).start()

    let index = 0
    const interval = setInterval(() => {
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        index = (index + 1) % LOADING_TEXTS.length
        setCurrentTextIndex(index)
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start()
      })
    }, 900)

    const navTimer = setTimeout(() => {
      clearInterval(interval)
    }, 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(navTimer)
    }
  }, [])

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={styles.root}>
      {/* Video Background */}
      <Video
        source={Videos.loadingBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.7)', Colors.background]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.center}>
        {/* Spinning ring */}
        <View style={styles.ringContainer}>
          <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
          <View style={styles.ringInner}>
            <Text style={styles.ringSymbol}>Z</Text>
          </View>
        </View>

        {/* Cycling text */}
        <Animated.Text style={[styles.loadingText, { opacity: textOpacity }]}>
          {LOADING_TEXTS[currentTextIndex]}
        </Animated.Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        <Text style={styles.patientText}>
          Your complete cosmic profile is being assembled.{'\n'}This takes a moment.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  ringContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.starGold,
    borderTopColor: 'transparent',
    borderRightColor: Colors.starGold + '40',
  },
  ringInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSymbol: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: Colors.starGold,
  },
  loadingText: {
    fontFamily: Fonts.mystical,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  progressContainer: {
    width: '100%',
    height: 2,
    backgroundColor: Colors.cardBorder,
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 32,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.starGold,
    borderRadius: 1,
  },
  patientText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
