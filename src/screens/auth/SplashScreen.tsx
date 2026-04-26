import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { StarField } from '../../components/layout/StarField'
import { LinearGradient } from 'expo-linear-gradient'

const { width } = Dimensions.get('window')
const APP_NAME = 'ZEPHYRA'
const letters = APP_NAME.split('')

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'Splash'>
}

export function SplashScreen({ navigation }: Props) {
  const letterAnims = useRef(letters.map(() => new Animated.Value(0))).current
  const taglineAnim = useRef(new Animated.Value(0)).current
  const screenAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Stagger each letter in
    const letterAnimations = letters.map((_, i) =>
      Animated.timing(letterAnims[i], {
        toValue: 1,
        duration: 300,
        delay: i * 120,
        useNativeDriver: true,
      })
    )

    Animated.sequence([
      Animated.stagger(120, letterAnimations),
      Animated.timing(taglineAnim, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      // After animation, wait then navigate
      await new Promise((r) => setTimeout(r, 900))

      // Fade out
      Animated.timing(screenAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(async () => {
        const hasLaunched = await AsyncStorage.getItem('zephyra_has_launched')
        if (hasLaunched) {
          navigation.replace('SignIn')
        } else {
          await AsyncStorage.setItem('zephyra_has_launched', 'true')
          navigation.replace('Onboarding')
        }
      })
    })
  }, [])

  return (
    <Animated.View style={[styles.root, { opacity: screenAnim }]}>
      <LinearGradient
        colors={[Colors.background, '#0A0A20', Colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <StarField />

      <View style={styles.center}>
        {/* App name letters */}
        <View style={styles.nameRow}>
          {letters.map((letter, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                {
                  opacity: letterAnims[i],
                  transform: [
                    {
                      translateY: letterAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: taglineAnim,
              transform: [
                {
                  translateY: taglineAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          Every Star. Every System. Your Entire Life.
        </Animated.Text>
      </View>
    </Animated.View>
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
    paddingHorizontal: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  letter: {
    fontFamily: Fonts.heading,
    fontSize: 38,
    color: Colors.starGold,
    letterSpacing: 6,
  },
  tagline: {
    fontFamily: Fonts.mystical,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 24,
  },
})