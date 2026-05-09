import React, { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'
import type { VedicChart } from '../../types'

const { width } = Dimensions.get('window')
const YEAR_WIDTH = 16 // px per year
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
  Shani:   ['#8BA0C0', '#3050706AA'],
  Budh:    ['#44CC88', '#1A6040AA'],
}

interface DashaEntry {
  lord: string
  startYear: number
  endYear: number
  isCurrent: boolean
}

function buildFullDashaSequence(chart: VedicChart, birthYear: number): DashaEntry[] {
  // Find current dasha from chart
  const currentLord = chart.mahadasha.replace(' Mahadasha', '')
  const periodParts = chart.mahadashaPeriod.split('–')
  const currentStart = parseInt(periodParts[0])
  const currentEnd = parseInt(periodParts[1])
  const currentIdx = DASHA_ORDER.indexOf(currentLord)

  const entries: DashaEntry[] = []

  // Go backwards from current to birth
  let yearCursor = currentStart
  let loopIdx = currentIdx
  while (yearCursor > birthYear) {
    const prevIdx = (loopIdx - 1 + 9) % 9
    const prevLord = DASHA_ORDER[prevIdx]
    const prevYears = DASHA_YEARS[prevLord]
    yearCursor -= prevYears
    loopIdx = prevIdx
  }

  // Now go forward from loopIdx at yearCursor
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

const DASHA_MEANINGS: Record<string, string> = {
  Ketu: 'Spiritualization, past karma clearing, detachment, sudden separations, occult insights. Internal transformation, isolation leading to wisdom.',
  Shukra: 'Relationships, luxury, creativity, artistic expression, sensual pleasure, financial growth. Love affairs, marriage events, beauty and harmony.',
  Surya: 'Father and authority figures, career clarity, recognition, ego development, leadership, government matters, health focus.',
  Chandra: 'Mind, emotions, mother, home changes, public life, travel, business with women or the public, fluctuating circumstances.',
  Mangal: 'Energy, courage, siblings, property matters, competitive environments, physical vitality, real estate. Accidents if afflicted.',
  Rahu: 'Foreign influence, technology, ambition, dramatic shifts, obsession, illusion. Career breakthroughs, unexpected gains and losses.',
  Guru: 'The great benefic period — expansion of wisdom, children, spirituality, wealth, teachers appearing, philosophical development.',
  Shani: 'The most important period — hard discipline rewarded over time, karmic completion, delays that teach, slow but permanent legacy building.',
  Budh: 'Intellect, business, communication, education, writing, commerce, multiple interests, restless mental activity and networking.',
}

export function DashaTimeline({ chart }: { chart: VedicChart }) {
  const birthYear = parseInt(chart.grahas[0]?.nakshatra ? '' : '') || new Date().getFullYear() - 30
  // Get birth year from the mahadasha period context
  const currentStart = parseInt(chart.mahadashaPeriod.split('–')[0])
  const currentLord = chart.mahadasha.replace(' Mahadasha', '')
  const currentIdx = DASHA_ORDER.indexOf(currentLord)

  // Estimate birth year: work backwards from current mahadasha start
  const bYear = currentStart - 30 // rough estimate — will be overridden by actual birth profile
  const sequences = buildFullDashaSequence(chart, bYear)
  const currentYear = new Date().getFullYear()
  const currentAge = currentYear - bYear

  const [selected, setSelected] = useState<DashaEntry | null>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  const totalWidth = sequences.reduce((acc, d) => acc + (d.endYear - d.startYear) * YEAR_WIDTH, 0) + 40

  // Find scroll offset to "now"
  const scrollRef = useRef<ScrollView>(null)
  useEffect(() => {
    const nowOffset = sequences.reduce((acc, d) => {
      if (d.endYear <= currentYear) return acc + (d.endYear - d.startYear) * YEAR_WIDTH
      if (d.startYear <= currentYear) return acc + (currentYear - d.startYear) * YEAR_WIDTH
      return acc
    }, 0)
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, nowOffset - width / 2), animated: true })
    }, 600)
  }, [])

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: totalWidth, paddingVertical: 16, paddingHorizontal: 20 }}
      >
        {/* Timeline bars */}
        <View style={{ flexDirection: 'row', height: BAR_H + 60, alignItems: 'flex-end' }}>
          {sequences.map((entry, idx) => {
            const barW = (entry.endYear - entry.startYear) * YEAR_WIDTH
            const colors = DASHA_COLORS[entry.lord] || ['#888888', '#33333388']
            const isCurrent = entry.isCurrent
            const isPast = entry.endYear <= currentYear

            // Current position marker
            let nowX: number | null = null
            if (entry.startYear <= currentYear && entry.endYear > currentYear) {
              nowX = (currentYear - entry.startYear) * YEAR_WIDTH
            }

            return (
              <TouchableOpacity
                key={idx}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setSelected(entry)
                }}
                activeOpacity={0.85}
                style={{ width: barW, height: BAR_H + 60, justifyContent: 'flex-end' }}
              >
                {/* Lord name at top */}
                <Text
                  style={[
                    styles.lordLabel,
                    { color: isCurrent ? colors[0] : isPast ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)' },
                  ]}
                  numberOfLines={1}
                >
                  {entry.lord}
                </Text>

                {/* Year range */}
                <Text style={styles.yearRange}>
                  {entry.startYear}
                </Text>

                {/* Bar */}
                <View
                  style={[
                    styles.bar,
                    {
                      width: barW - 2,
                      height: isCurrent ? BAR_H + 8 : BAR_H,
                      borderColor: isCurrent ? colors[0] + 'AA' : 'rgba(255,255,255,0.06)',
                      opacity: isPast ? 0.45 : 1,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={isCurrent ? [colors[0], colors[1]] : [colors[0] + '60', colors[1]]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  {/* Top edge highlight */}
                  <View style={styles.barTopEdge} />

                  {/* NOW marker */}
                  {nowX !== null && (
                    <Animated.View
                      style={[
                        styles.nowMarker,
                        {
                          left: nowX,
                          shadowColor: colors[0],
                          transform: [{ scaleY: pulseAnim }],
                        },
                      ]}
                    />
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* "NOW" label */}
      <Text style={styles.hintText}>Scroll left for past  ·  Scroll right for future</Text>

      {/* Selected Dasha Detail */}
      {selected && (
        <View style={styles.detailCard}>
          <LinearGradient
            colors={[DASHA_COLORS[selected.lord]?.[0] + '15' || '#88888815', 'transparent']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.detailHeader}>
            <View>
              <Text style={[styles.detailLord, { color: DASHA_COLORS[selected.lord]?.[0] || '#FFF' }]}>
                {selected.lord} Mahadasha
              </Text>
              <Text style={styles.detailPeriod}>
                {selected.startYear} – {selected.endYear}  ·  {DASHA_YEARS[selected.lord]} years
                {selected.isCurrent ? '  (Active now)' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.closeX}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.detailMeaning}>{DASHA_MEANINGS[selected.lord]}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { paddingBottom: 8 },
  lordLabel: { fontFamily: Fonts.accentBold, fontSize: 9, letterSpacing: 0.5, marginBottom: 2, paddingHorizontal: 2 },
  yearRange: { fontFamily: Fonts.body, fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 4, paddingHorizontal: 2 },
  bar: { borderRadius: 4, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  barTopEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  nowMarker: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 10,
  },
  hintText: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  detailCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    padding: 18,
    backgroundColor: 'rgba(13,13,43,0.85)',
  },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  detailLord: { fontFamily: Fonts.heading, fontSize: 17, marginBottom: 4 },
  detailPeriod: { fontFamily: Fonts.accent, fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  closeX: { fontSize: 22, color: 'rgba(255,255,255,0.3)', lineHeight: 24, paddingHorizontal: 4 },
  detailMeaning: { fontFamily: Fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 24 },
})
