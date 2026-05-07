// src/components/ui/
// Yellow tilted stacked card deck — Vedic reading paragraph display

import React, { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Animated,
  LayoutAnimation, StyleSheet, Platform, UIManager,
} from 'react-native'
import { Fonts } from '../../constants/fonts'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// Rotation pattern for the fanned deck effect
const ROTATIONS = [-2.5, 1.8, -1.2, 2.2, -1.8, 1.4, -2.1, 1.6, -0.9, 2.4]

interface FannedCardsProps {
  paragraphs: string[]
  accentColor?: string
}

export function FannedCards({ paragraphs, accentColor = '#C9A84C' }: FannedCardsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  // Animated rotation values for each card
  const rotAnims = useRef(
    paragraphs.map((_, i) => new Animated.Value(ROTATIONS[i % ROTATIONS.length]))
  ).current

  function handlePress(index: number) {
    LayoutAnimation.configureNext({
      duration: 320,
      create: { type: 'easeInEaseOut', property: 'scaleXY' },
      update: { type: 'spring', springDamping: 0.7 },
    })

    const isOpening = expandedIndex !== index

    // Animate rotation: tapped card → 0deg, others → their tilt
    paragraphs.forEach((_, i) => {
      Animated.timing(rotAnims[i], {
        toValue: (isOpening && i === index) ? 0 : ROTATIONS[i % ROTATIONS.length],
        duration: 280,
        useNativeDriver: true,
      }).start()
    })

    setExpandedIndex(isOpening ? index : null)
  }

  return (
    <View style={styles.container}>
      {paragraphs.map((para, i) => {
        const isExpanded = expandedIndex === i
        const isBelowExpanded = expandedIndex !== null && i > expandedIndex

        const rotate = rotAnims[i].interpolate({
          inputRange: [-5, 0, 5],
          outputRange: ['-5deg', '0deg', '5deg'],
        })

        return (
          <Animated.View
            key={i}
            style={[
              styles.cardWrapper,
              { transform: [{ rotate }] },
              isBelowExpanded && styles.cardShiftedDown,
            ]}
          >
            <TouchableOpacity
              onPress={() => handlePress(i)}
              activeOpacity={0.88}
              style={[
                styles.card,
                isExpanded && styles.cardExpanded,
              ]}
            >
              {/* Card top strip */}
              <View style={[styles.cardStrip, { backgroundColor: isExpanded ? '#8B6914' : '#A07820' }]} />

              {/* Header row */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.cardNum}>✦ {i + 1}</Text>
                  {!isExpanded && (
                    <Text style={styles.preview} numberOfLines={1}>
                      {para.trim().substring(0, 55)}…
                    </Text>
                  )}
                </View>
                <Text style={styles.arrow}>{isExpanded ? '▾' : '▸'}</Text>
              </View>

              {/* Full content when expanded */}
              {isExpanded && (
                <Text style={styles.fullText}>{para.trim()}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  cardWrapper: {
    // Shadow for depth/stacking effect
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  cardShiftedDown: {
    marginTop: 4,
  },
  card: {
    backgroundColor: '#C9A84C',
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingBottom: 16,
    paddingTop: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cardExpanded: {
    backgroundColor: '#D4B558',
    shadowOpacity: 0.7,
  },
  cardStrip: {
    height: 4,
    marginHorizontal: -18,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  headerLeft: {
    flex: 1,
    gap: 5,
  },
  cardNum: {
    fontFamily: 'SpaceMono-Regular', // Fonts.accent equivalent
    fontSize: 10,
    color: 'rgba(5,5,15,0.45)',
    letterSpacing: 1,
  },
  preview: {
    fontSize: 13,
    color: 'rgba(5,5,15,0.7)',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  arrow: {
    fontSize: 14,
    color: 'rgba(5,5,15,0.45)',
    flexShrink: 0,
  },
  fullText: {
    fontSize: 15,
    color: '#05050F',
    lineHeight: 28,
    letterSpacing: 0.15,
    fontWeight: '400',
    marginTop: 8,
  },
})
