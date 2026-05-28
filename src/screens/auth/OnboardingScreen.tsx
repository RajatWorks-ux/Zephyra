
// src/screens/auth/OnboardingScreen.tsx
import React, { useRef, useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, StatusBar, Animated,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { Videos } from '../../constants/videos'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

const { width, height } = Dimensions.get('window')

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'Onboarding'>
}

const slides = [
  {
    id: '1',
    video: Videos.onboarding1,
    tag: 'PAST · PRESENT · FUTURE',
    title: 'We Know\nYour Past',
    subtitle: 'Tell us when and where you were born. We reveal what already happened before predicting your future.',
    accent: '#C9A84C',
  },
  {
    id: '2',
    video: Videos.onboarding2,
    tag: 'VEDIC ASTROLOGY',
    title: 'Ancient Vedic\nWisdom.',
    subtitle: 'The oldest astrological tradition on Earth — Jyotish — reads your birth chart to reveal the precise karma, gifts, and timing written into your life.',
    accent: '#7C3AED',
  },
  {
    id: '3',
    video: Videos.onboarding3,
    tag: 'LOVE · CAREER · PURPOSE',
    title: 'Your Entire\nLife. Decoded.',
    subtitle: 'No vague predictions. No generic horoscopes. Only your truth, explained in simple and honest words.',
    accent: '#00D4FF',
  },
]

function SlideItem({
  item,
  index,
  activeIndex,
}: {
  item: typeof slides[0]
  index: number
  activeIndex: number
}) {
  const opacity = useRef(new Animated.Value(index === 0 ? 1 : 0)).current
  const translateY = useRef(new Animated.Value(index === 0 ? 0 : 30)).current

  useEffect(() => {
    if (activeIndex === index) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 30, duration: 200, useNativeDriver: true }),
      ]).start()
    }
  }, [activeIndex])

  return (
    <View style={styles.slide}>
      <Video
        source={item.video}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay={activeIndex === index}
        isMuted
      />
      <LinearGradient
        colors={['transparent', 'rgba(5,5,15,0.6)', 'rgba(5,5,15,0.95)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[styles.textBlock, { opacity, transform: [{ translateY }] }]}>
        <View style={[styles.tagPill, { borderColor: item.accent + '60' }]}>
          <Text style={[styles.tagText, { color: item.accent }]}>{item.tag}</Text>
        </View>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </Animated.View>
    </View>
  )
}

export function OnboardingScreen({ navigation }: Props) {
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (currentIndex < slides.length - 1) {
      const next = currentIndex + 1
      flatListRef.current?.scrollToIndex({ index: next })
      setCurrentIndex(next)
    } else {
      navigation.replace('SignIn')
    }
  }

  function handleSkip() {
    navigation.replace('SignIn')
  }

  function handleScroll(e: any) {
    const index = Math.round(e.nativeEvent.contentOffset.x / width)
    if (index !== currentIndex) setCurrentIndex(index)
  }

  const isLast = currentIndex === slides.length - 1

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        keyExtractor={(item) => item.id}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <SlideItem item={item} index={index} activeIndex={currentIndex} />
        )}
      />
      <View style={styles.controls}>
        <View style={styles.dotsRow}>
          {slides.map((_, i) => {
            const active = i === currentIndex
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  active && {
                    width: 28,
                    backgroundColor: slides[currentIndex].accent,
                    shadowColor: slides[currentIndex].accent,
                    shadowRadius: 8,
                    shadowOpacity: 0.8,
                    shadowOffset: { width: 0, height: 0 },
                  },
                ]}
              />
            )
          })}
        </View>
        <View style={styles.buttonRow}>
          {!isLast && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: slides[currentIndex].accent, flex: isLast ? 1 : 0 }]}
            onPress={handleNext}
          >
            <Text style={styles.nextText}>{isLast ? 'Begin My Journey' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  slide: { width, height, backgroundColor: '#05050F' },
  textBlock: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
  },
  tagPill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  tagText: { fontFamily: Fonts.accent, fontSize: 10, letterSpacing: 2 },
  slideTitle: {
    fontFamily: Fonts.heading,
    fontSize: 42,
    color: '#FFFFFF',
    lineHeight: 50,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 2 },
  },
  slideSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 26,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(5,5,15,0.8)',
    paddingTop: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  buttonRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  skipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  skipText: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  nextBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowRadius: 20,
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  nextText: { fontFamily: Fonts.bodySemiBold, fontSize: 17, color: '#FFFFFF', letterSpacing: 0.5 },
})
        
