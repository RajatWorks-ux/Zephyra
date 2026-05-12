import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'
import type { VedicChart, PastDashaEntry } from '../../types'

const { width } = Dimensions.get('window')
const YEAR_WIDTH = 16
const BAR_H = 52

const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangal: 7,
  Rahu: 18, Guru: 16, Shani: 19, Budh: 17,
}
const DASHA_ORDER = ['Ketu', 'Shukra', 'Surya', 'Chandra', 'Mangal', 'Rahu', 'Guru', 'Shani', 'Budh']

const DASHA_COLORS: Record<string, [string, string]> = {
  Ketu:    ['#8888AA', '#44446688'],
  Shukra:  ['#FF80AA', '#882244AA'],
  Surya:   ['#FF9500', '#664400AA'],
  Chandra: ['#C0C8FF', '#5060AAAA'],
  Mangal:  ['#FF3B3B', '#881111AA'],
  Rahu:    ['#7070AA', '#303060AA'],
  Guru:    ['#FFD700', '#886600AA'],
  Shani:   ['#8BA0C0', '#405060AA'],
  Budh:    ['#44CC88', '#1A6040AA'],
}

const DASHA_MEANINGS: Record<string, string> = {
  Ketu:    'Spiritualization, past karma clearing, detachment, sudden separations, occult insights. Internal transformation, isolation leading to wisdom.',
  Shukra:  'Relationships, luxury, creativity, artistic expression, sensual pleasure, financial growth. Love affairs, marriage events, beauty and harmony.',
  Surya:   'Father and authority figures, career clarity, recognition, ego development, leadership, government matters, health focus.',
  Chandra: 'Mind, emotions, mother, home changes, public life, travel, business with women or the public, fluctuating circumstances.',
  Mangal:  'Energy, courage, siblings, property matters, competitive environments, physical vitality, real estate. Accidents if afflicted.',
  Rahu:    'Foreign influence, technology, ambition, dramatic shifts, obsession, illusion. Career breakthroughs, unexpected gains and losses.',
  Guru:    'The great benefic period — expansion of wisdom, children, spirituality, wealth, teachers appearing, philosophical development.',
  Shani:   'The most important period — hard discipline rewarded over time, karmic completion, delays that teach, slow but permanent legacy building.',
  Budh:    'Intellect, business, communication, education, writing, commerce, multiple interests, restless mental activity and networking.',
}

interface DashaEntry {
  lord: string
  startYear: number
  endYear: number
  isCurrent: boolean
}

// Build full sequence when pastDashaHistory is NOT provided (fallback)
function buildFullDashaSequence(chart: VedicChart, birthYear: number): DashaEntry[] {
  const currentLord = chart.mahadasha.replace(' Mahadasha', '')
  const periodParts = chart.mahadashaPeriod.split('–')
  const currentStart = parseInt(periodParts[0])
  const currentIdx = DASHA_ORDER.indexOf(currentLord)

  const entries: DashaEntry[] = []
  let yearCursor = currentStart
  let loopIdx = currentIdx

  while (yearCursor > birthYear) {
    const prevIdx = (loopIdx - 1 + 9) % 9
    yearCursor -= DASHA_YEARS[DASHA_ORDER[prevIdx]]
    loopIdx = prevIdx
  }

  let year = yearCursor
  let idx = loopIdx
  const endAge = birthYear + 100

  while (year < endAge) {
    const lord = DASHA_ORDER[idx]
    const years = DASHA_YEARS[lord]
    const startY = Math.max(birthYear, Math.round(year))
    const endY = Math.min(endAge, Math.round(year + years))
    entries.push({
      lord,
      startYear: startY,
      endYear: endY,
      isCurrent: lord === currentLord && startY === currentStart,
    })
    year += years
    idx = (idx + 1) % 9
  }

  return entries
}

// Build precise sequence from pastDashaHistory (preferred path)
function buildFromPastHistory(
  pastHistory: PastDashaEntry[],
  birthYear: number,
  chart: VedicChart,
): DashaEntry[] {
  const currentLord = chart.mahadasha.replace(' Mahadasha', '')
  const periodParts = chart.mahadashaPeriod.split('–')
  const currentStart = parseInt(periodParts[0])
  const currentEnd = parseInt(periodParts[1])

  const entries: DashaEntry[] = []

  // Past periods from computed history
  pastHistory.forEach(entry => {
    const startYear = birthYear + Math.floor(entry.startAge)
    const endYear = birthYear + Math.ceil(entry.endAge)
    entries.push({
      lord: entry.lord,
      startYear,
      endYear,
      isCurrent: false,
    })
  })

  // Mark current
  const currIdx = entries.findIndex(e => e.lord === currentLord && e.startYear === currentStart)
  if (currIdx !== -1) {
    entries[currIdx].isCurrent = true
    entries[currIdx].endYear = currentEnd
  } else {
    // Append current if not already in list
    entries.push({ lord: currentLord, startYear: currentStart, endYear: currentEnd, isCurrent: true })
  }

  // Extend future periods beyond current age
  let futureCursor = currentEnd
  const startIdx = DASHA_ORDER.indexOf(currentLord)
  for (let i = 1; i <= 6; i++) {
    const fIdx = (startIdx + i) % 9
    const fLord = DASHA_ORDER[fIdx]
    const fYears = DASHA_YEARS[fLord]
    entries.push({
      lord: fLord,
      startYear: futureCursor,
      endYear: futureCursor + fYears,
      isCurrent: false,
    })
    futureCursor += fYears
    if (futureCursor > birthYear + 100) break
  }

  return entries
}

interface Props {
  chart: VedicChart
  pastDashaHistory?: PastDashaEntry[]
  birthYear?: number   // passed explicitly from ChartsScreen when available
}

export function DashaTimeline({ chart, pastDashaHistory, birthYear: birthYearProp }: Props) {
  const [selectedLord, setSelectedLord] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const fadeAnim = useRef(new Animated.Value(0)).current

  const currentLord = chart.mahadasha.replace(' Mahadasha', '')
  const periodParts = chart.mahadashaPeriod.split('–')
  const currentStart = parseInt(periodParts[0])
  const currentYear = new Date().getFullYear()

  // Resolve birth year
  const birthYear = birthYearProp ?? (currentStart - (() => {
    let age = 0
    let idx = DASHA_ORDER.indexOf(currentLord)
    while (DASHA_YEARS[DASHA_ORDER[idx]] < (currentYear - currentStart + 1)) {
      age += DASHA_YEARS[DASHA_ORDER[idx]]
      idx = (idx - 1 + 9) % 9
    }
    return age
  })())

  const entries: DashaEntry[] = pastDashaHistory && pastDashaHistory.length > 0
    ? buildFromPastHistory(pastDashaHistory, birthYear, chart)
    : buildFullDashaSequence(chart, birthYear)

  const totalW = entries.reduce((sum, e) => sum + (e.endYear - e.startYear) * YEAR_WIDTH, 0)
  const currentX = entries
    .filter(e => e.startYear < currentYear)
    .reduce((sum, e) => {
      const effectiveEnd = Math.min(e.endYear, currentYear)
      return sum + (effectiveEnd - e.startYear) * YEAR_WIDTH
    }, 0)

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }).start()
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, currentX - width / 2), animated: true })
    }, 400)
  }, [])

  function openDetail(lord: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedLord(prev => prev === lord ? null : lord)
  }

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#C9A84C' }]} />
          <Text style={styles.legendText}>Current period</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
          <Text style={styles.legendText}>Past / Future</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { width: totalW + 40 }]}
      >
        {entries.map((entry, i) => {
          const barW = (entry.endYear - entry.startYear) * YEAR_WIDTH
          const colors = DASHA_COLORS[entry.lord] ?? ['#888', '#44444488']
          const isPast = entry.endYear <= currentYear
          const isFuture = entry.startYear > currentYear
          const isActive = entry.isCurrent

          return (
            <TouchableOpacity
              key={`${entry.lord}-${entry.startYear}`}
              style={[styles.block, { width: barW }]}
              onPress={() => openDetail(entry.lord)}
              activeOpacity={0.8}
            >
              <View style={[
                styles.bar,
                { height: BAR_H, opacity: isPast ? 0.5 : isFuture ? 0.35 : 1 },
              ]}>
                <LinearGradient
                  colors={isActive ? [colors[0], colors[0] + 'BB'] : [colors[0] + '88', colors[1]]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {isActive && <View style={styles.activeGlow} />}
                <Text style={[styles.lordLabel, { fontSize: barW > 60 ? 11 : 8 }]} numberOfLines={1}>
                  {entry.lord}
                </Text>
                {barW > 50 && (
                  <Text style={styles.yearsLabel}>
                    {entry.endYear - entry.startYear}y
                  </Text>
                )}
                {isActive && <View style={styles.nowLine} />}
              </View>
              <Text style={styles.yearLabel}>{entry.startYear}</Text>
            </TouchableOpacity>
          )
        })}

        {/* "Now" cursor */}
        <View style={[styles.nowCursor, { left: currentX }]}>
          <View style={styles.nowDot} />
          <View style={styles.nowLineV} />
          <Text style={styles.nowText}>Now</Text>
        </View>
      </ScrollView>

      {/* Detail panel */}
      {selectedLord && (
        <View style={styles.detailPanel}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={[DASHA_COLORS[selectedLord]?.[0] + '22' ?? '#ffffff11', 'rgba(5,5,20,0.95)']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.detailAccent, { backgroundColor: DASHA_COLORS[selectedLord]?.[0] ?? '#888' }]} />
          <Text style={[styles.detailLord, { color: DASHA_COLORS[selectedLord]?.[0] ?? '#C9A84C' }]}>
            {selectedLord} Mahadasha
          </Text>
          <Text style={styles.detailDuration}>
            {DASHA_YEARS[selectedLord]} year period
          </Text>
          <Text style={styles.detailMeaning}>{DASHA_MEANINGS[selectedLord]}</Text>
        </View>
      )}

      <Text style={styles.hint}>Tap any period to learn its meaning</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16 },
  legendRow: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  scroll: { paddingHorizontal: 20, paddingBottom: 12, position: 'relative' },
  block: { alignItems: 'flex-start', paddingRight: 1 },
  bar: {
    width: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.6)',
    borderRadius: 6,
  },
  lordLabel: {
    fontFamily: Fonts.accentBold,
    color: '#FFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  yearsLabel: {
    fontFamily: Fonts.accent,
    fontSize: 7,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  nowLine: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    width: 2,
    backgroundColor: '#C9A84C',
  },
  yearLabel: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  nowCursor: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    width: 2,
  },
  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#C9A84C', marginBottom: 2 },
  nowLineV: { width: 2, height: BAR_H - 8, backgroundColor: 'rgba(201,168,76,0.7)' },
  nowText: { fontFamily: Fonts.accent, fontSize: 8, color: '#C9A84C', marginTop: 2 },
  detailPanel: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  detailAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  detailLord: { fontFamily: Fonts.heading, fontSize: 16, marginBottom: 4 },
  detailDuration: { fontFamily: Fonts.accent, fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 10 },
  detailMeaning: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 22 },
  hint: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 14 },
})
