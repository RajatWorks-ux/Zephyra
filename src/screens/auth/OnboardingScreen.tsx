import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParams } from '../../navigation/AuthNavigator'
import { ScreenWrapper } from '../../components/layout/ScreenWrapper'
import { Button } from '../../components/ui/Button'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const { width } = Dimensions.get('window')

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParams, 'Onboarding'>
}

const slides = [
  {
    id: '1',
    title: 'We Know Your Past',
    subtitle:
      'Tell us when and where you were born. We reveal what already happened before predicting your future.',
    detail:
      'Every major event in your life is written in the positions of the stars at the moment you arrived.',
  },
  {
    id: '2',
    title: '20 Traditions. One Truth.',
    subtitle:
      'We consult every major astrology system humanity has ever created — simultaneously — for you.',
    detail:
      'Western, Vedic, Chinese, Mayan, Celtic, Egyptian, Kabbalistic, Persian, Tibetan and eleven more traditions speak to your chart.',
  },
  {
    id: '3',
    title: 'Your Entire Life. Decoded.',
    subtitle:
      'Love. Career. Health. Family. Purpose. Past. Present. Future. All in one place.',
    detail:
      'Explained in simple, honest words. No vague predictions. No generic horoscopes. Only your truth.',
  },
]

export function OnboardingScreen({ navigation }: Props) {
  const flatListRef = useRef<FlatList>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  function handleNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })
      setCurrentIndex(currentIndex + 1)
    } else {
      navigation.replace('SignIn')
    }
  }

  function handleSkip() {
    navigation.replace('SignIn')
  }

  function handleScroll(e: any) {
    const index = Math.round(e.nativeEvent.contentOffset.x / width)
    setCurrentIndex(index)
  }

  return (
    <ScreenWrapper>
      <View style={styles.skipRow}>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Visual placeholder — replaced with real art in Phase 5 */}
            <View style={styles.visual}>
              <Text style={styles.slideNumber}>{item.id}</Text>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            <Text style={styles.detail}>{item.detail}</Text>
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.buttonRow}>
        <Button
          label={currentIndex === slides.length - 1 ? 'Begin My Journey' : 'Next'}
          onPress={handleNext}
          style={styles.button}
        />
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  skipRow: {
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  skipText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  slide: {
    width,
    paddingHorizontal: 32,
    paddingTop: 24,
    alignItems: 'center',
  },
  visual: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  slideNumber: {
    fontFamily: Fonts.heading,
    fontSize: 48,
    color: Colors.starGold + '40',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    color: Colors.moonWhite,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  detail: {
    fontFamily: Fonts.mystical,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cardBorder,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.starGold,
  },
  buttonRow: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  button: {
    width: '100%',
  },
})