// src/components/charts/DashaTimeline.tsx
// Fixes applied:
//   1. REMOVED the stray </Key> syntax error that prevented compilation
//   2. FIXED cross-SVG diagonal hatch: Pattern now defined inline inside each
//      past-bar's own <Svg> instead of referencing a global id that doesn't
//      cross SVG element boundaries in react-native-svg
//   3. ADDED mount animation: 600ms fade-in + 20px rise with cubic ease-out
//   4. onOpenOracleModal is a required prop — ChartsScreen must pass it

import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated, Easing,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import Svg, { Line, Defs, Pattern, Rect } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'
import type { VedicChart, PastDashaEntry } from '../../types'

const { width } = Dimensions.get('window')
const YEAR_WIDTH = 16
const BASE_BAR_H = 68
const CURRENT_BAR_H = 80

// ─── Dasha Data ───────────────────────────────────────────────────────────────

const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangal: 7,
  Rahu: 18, Guru: 16, Shani: 19, Budh: 17,
}

const DASHA_ORDER = [
  'Ketu', 'Shukra', 'Surya', 'Chandra', 'Mangal',
  'Rahu', 'Guru', 'Shani', 'Budh',
]

const DASHA_COLORS: Record<string, { primary: string; dark: string; light: string }> = {
  Ketu:    { primary: '#8888AA', dark: '#2b2b3d', light: '#b3b3cc' },
  Shukra:  { primary: '#FF80AA', dark: '#5e1932', light: '#ffa3c2' },
  Surya:   { primary: '#FF9500', dark: '#5c3200', light: '#ffb347' },
  Chandra: { primary: '#C0C8FF', dark: '#31375c', light: '#e0e3ff' },
  Mangal:  { primary: '#FF3B3B', dark: '#5c0b0b', light: '#ff7373' },
  Rahu:    { primary: '#7070AA', dark: '#232342', light: '#9999cc' },
  Guru:    { primary: '#FFD700', dark: '#5c4d00', light: '#ffe34d' },
  Shani:   { primary: '#8BA0C0', dark: '#2d3847', light: '#b0c2de' },
  Budh:    { primary: '#44CC88', dark: '#0f4228', light: '#85ebd0' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashaEntry {
  lord: string
  startYear: number
  endYear: number
  isCurrent: boolean
}

interface AntardashaEntry {
  lord: string
  width: number
  isCurrent: boolean
}

// ─── Sequence Builders ────────────────────────────────────────────────────────

function buildFullDashaSequence(chart: VedicChart, birthYear: number): DashaEntry[] {
  const currentLord  = chart.mahadasha.replace(' Mahadasha', '')
  const periodParts  = chart.mahadashaPeriod.split('–')
  const currentStart = parseInt(periodParts[0])
  const currentIdx   = DASHA_ORDER.indexOf(currentLord)

  const entries: DashaEntry[] = []
  let yearCursor = currentStart
  let loopIdx    = currentIdx

  while (yearCursor > birthYear) {
    const prevIdx = (loopIdx - 1 + 9) % 9
    yearCursor   -= DASHA_YEARS[DASHA_ORDER[prevIdx]]
    loopIdx       = prevIdx
  }

  let year   = yearCursor
  let idx    = loopIdx
  const endAge = birthYear + 100

  while (year < endAge) {
    const lord   = DASHA_ORDER[idx]
    const years  = DASHA_YEARS[lord]
    const startY = Math.max(birthYear, Math.round(year))
    const endY   = Math.min(endAge, Math.round(year + years))
    entries.push({
      lord,
      startYear: startY,
      endYear:   endY,
      isCurrent: lord === currentLord && startY === currentStart,
    })
    year += years
    idx   = (idx + 1) % 9
  }

  return entries
}

function buildFromPastHistory(
  pastHistory: PastDashaEntry[],
  birthYear: number,
  chart: VedicChart,
): DashaEntry[] {
  const currentLord  = chart.mahadasha.replace(' Mahadasha', '')
  const periodParts  = chart.mahadashaPeriod.split('–')
  const currentStart = parseInt(periodParts[0])
  const currentEnd   = parseInt(periodParts[1])

  const entries: DashaEntry[] = pastHistory.map(entry => ({
    lord:       entry.lord,
    startYear:  birthYear + Math.floor(entry.startAge),
    endYear:    birthYear + Math.ceil(entry.endAge),
    isCurrent:  false,
  }))

  const currIdx = entries.findIndex(
    e => e.lord === currentLord && e.startYear === currentStart
  )
  if (currIdx !== -1) {
    entries[currIdx].isCurrent = true
    entries[currIdx].endYear   = currentEnd
  } else {
    entries.push({ lord: currentLord, startYear: currentStart, endYear: currentEnd, isCurrent: true })
  }

  let futureCursor = currentEnd
  const startIdx   = DASHA_ORDER.indexOf(currentLord)
  for (let i = 1; i <= 6; i++) {
    const fIdx   = (startIdx + i) % 9
    const fLord  = DASHA_ORDER[fIdx]
    const fYears = DASHA_YEARS[fLord]
    entries.push({
      lord:       fLord,
      startYear:  futureCursor,
      endYear:    futureCursor + fYears,
      isCurrent:  false,
    })
    futureCursor += fYears
    if (futureCursor > birthYear + 100) break
  }

  return entries
}

// ─── Antardasha Engine ────────────────────────────────────────────────────────

function getAntardashasForLord(
  mahadashaLord: string,
  totalWidth: number,
  isMahadashaCurrent: boolean,
  currentYear: number,
  startYear: number,
): AntardashaEntry[] {
  const startIndex          = DASHA_ORDER.indexOf(mahadashaLord)
  const totalMahadashaYears = DASHA_YEARS[mahadashaLord]
  const antardashas: AntardashaEntry[] = []
  let runningYear = startYear

  for (let i = 0; i < 9; i++) {
    const subLord           = DASHA_ORDER[(startIndex + i) % 9]
    const subYears          = DASHA_YEARS[subLord]
    const fractionalDuration = (subYears / 120) * totalMahadashaYears
    const subWidth           = (fractionalDuration / totalMahadashaYears) * totalWidth
    const nextRunningYear    = runningYear + fractionalDuration
    const isCurrentSub       = isMahadashaCurrent
      && currentYear >= runningYear
      && currentYear < nextRunningYear

    antardashas.push({ lord: subLord, width: subWidth, isCurrent: isCurrentSub })
    runningYear = nextRunningYear
  }

  return antardashas
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  chart: VedicChart
  pastDashaHistory?: PastDashaEntry[]
  birthYear?: number
  onOpenOracleModal: (context: Record<string, any>) => void
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DashaTimeline({
  chart,
  pastDashaHistory,
  birthYear: birthYearProp,
  onOpenOracleModal,
}: Props) {
  const scrollRef  = useRef<ScrollView>(null)
  const currentYear = new Date().getFullYear()

  // ── Mount animation (native driver — separate from scale) ──────────────────
  const mountOpacity    = useRef(new Animated.Value(0)).current
  const mountTranslateY = useRef(new Animated.Value(20)).current

  // ── Operational animations (non-native — layout values) ───────────────────
  const pulseAnim            = useRef(new Animated.Value(0)).current
  const borderPulseAnim      = useRef(new Animated.Value(0)).current
  const globalTimelineScale  = useRef(new Animated.Value(1)).current

  // ── Derived chart values ───────────────────────────────────────────────────
  const currentLord  = chart.mahadasha.replace(' Mahadasha', '')
  const periodParts  = chart.mahadashaPeriod.split('–')
  const currentStart = parseInt(periodParts[0])

  const birthYear = birthYearProp ?? (() => {
    // Approximate birth year from current dasha position
    let age = 0
    let idx = DASHA_ORDER.indexOf(currentLord)
    while (DASHA_YEARS[DASHA_ORDER[idx]] < (currentYear - currentStart + 1)) {
      age += DASHA_YEARS[DASHA_ORDER[idx]]
      idx  = (idx - 1 + 9) % 9
    }
    return currentStart - age
  })()

  // ── Sequence ───────────────────────────────────────────────────────────────
  const entries = useMemo(
    () => pastDashaHistory?.length
      ? buildFromPastHistory(pastDashaHistory, birthYear, chart)
      : buildFullDashaSequence(chart, birthYear),
    [pastDashaHistory, birthYear, chart],
  )

  // ── Geometry ───────────────────────────────────────────────────────────────
  const { totalW, currentX, decadeMarkers } = useMemo(() => {
    let widthAccumulator = 0
    let currentExecutionX = 0

    entries.forEach(e => {
      if (e.isCurrent) {
        currentExecutionX = widthAccumulator + (currentYear - e.startYear) * YEAR_WIDTH
      }
      widthAccumulator += (e.endYear - e.startYear) * YEAR_WIDTH
    })

    const markers: { year: number; xOffset: number }[] = []
    const startDecade = Math.ceil(birthYear / 10) * 10
    const endDecade   = Math.floor((birthYear + 100) / 10) * 10
    for (let yr = startDecade; yr <= endDecade; yr += 10) {
      markers.push({ year: yr, xOffset: (yr - birthYear) * YEAR_WIDTH })
    }

    return { totalW: widthAccumulator, currentX: currentExecutionX, decadeMarkers: markers }
  }, [entries, birthYear, currentYear])

  // ── Static starfield (stable coords — won't re-generate on re-render) ─────
  const starfieldCoords = useMemo(
    () => Array.from({ length: 25 }, (_, i) => ({
      id:   i,
      top:  `${Math.sin(i * 99) * 40 + 50}%`,
      left: `${Math.cos(i * 45) * 48 + 50}%`,
    })),
    [],
  )

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Mount: fade + rise (useNativeDriver: true — no layout deps)
    Animated.parallel([
      Animated.timing(mountOpacity, {
        toValue: 1, duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(mountTranslateY, {
        toValue: 0, duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    // Orb pulse (non-native — drives Animated interpolation for shadowRadius)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0, duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    ).start()

    // Border pulse (non-native — drives borderWidth interpolation)
    Animated.loop(
      Animated.sequence([
        Animated.timing(borderPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(borderPulseAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ]),
    ).start()

    // Auto-scroll to NOW — slight delay to let mount animation start first
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, currentX - width / 2 + 20), animated: true })
    }, 700)
  }, [currentX])

  // ── Event handlers ─────────────────────────────────────────────────────────
  function handleTimelinePressIn() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Animated.spring(globalTimelineScale, { toValue: 0.98, speed: 20, useNativeDriver: false }).start()
  }

  function handlePeriodSelection(entry: DashaEntry, antardashas: AntardashaEntry[]) {
    Animated.spring(globalTimelineScale, { toValue: 1.0, speed: 12, useNativeDriver: false }).start()

    const activeSub    = antardashas.find(a => a.isCurrent)?.lord ?? 'None'
    const totalDuration = entry.endYear - entry.startYear
    const remaining    = entry.isCurrent ? Math.max(0, entry.endYear - currentYear) : 0

    let status = 'Future'
    if (entry.endYear <= currentYear) status = 'Past'
    else if (entry.isCurrent)         status = 'Current'

    onOpenOracleModal({
      mahadashaLord:      entry.lord,
      period:             `${entry.startYear}–${entry.endYear}`,
      duration:           totalDuration,
      status,
      currentAntardasha:  activeSub,
      yearsRemaining:     entry.isCurrent ? `${remaining} years` : 'N/A',
      lordRashi:          chart.grahas.find(g => g.name === entry.lord)?.rashi ?? 'Unknown',
    })
  }

  // ── Interpolations ─────────────────────────────────────────────────────────
  const animatedOrbScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.3] })
  const animatedLaserGlow  = borderPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 10] })
  const animatedBorderW    = borderPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    // Mount animation wrapper — useNativeDriver: true, isolated from scale
    <Animated.View style={{
      opacity:   mountOpacity,
      transform: [{ translateY: mountTranslateY }],
    }}>

      {/* Scale wrapper — useNativeDriver: false (spring scale on press) */}
      <Animated.View style={[
        styles.outerBoundaryWrapper,
        { transform: [{ scale: globalTimelineScale }] },
      ]}>
        <BlurView intensity={30} tint="dark" style={styles.glassContainerShell}>

          {/* ── Constellation Starfield ──────────────────────────────────── */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {starfieldCoords.map(star => (
              <View
                key={star.id}
                style={[styles.starNode, { top: star.top as any, left: star.left as any }]}
              />
            ))}
          </View>

          {/* ── Scrollable Temporal Canvas ──────────────────────────────── */}
          <ScrollView
            ref={scrollRef}
            horizontal
            snapToInterval={YEAR_WIDTH * 10}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.scrollerCanvas, { width: totalW + 80 }]}
          >
            {/* Decade Tick Marks */}
            {decadeMarkers.map(marker => (
              <View
                key={`tick-${marker.year}`}
                style={[styles.decadeTickLine, { left: marker.xOffset + 40 }]}
              >
                <Text style={styles.decadeTickLabel}>{marker.year}</Text>
              </View>
            ))}

            {/* ── Mahadasha River ─────────────────────────────────────── */}
            <View style={styles.riverRow}>
              {entries.map(entry => {
                const barW  = (entry.endYear - entry.startYear) * YEAR_WIDTH
                const theme = DASHA_COLORS[entry.lord] ?? { primary: '#FFF', dark: '#222', light: '#FFF' }

                const isPast   = entry.endYear <= currentYear
                const isActive = entry.isCurrent

                const faceOpacity = isActive ? 0.90 : isPast ? 0.30 : 0.55

                const antardashas = getAntardashasForLord(
                  entry.lord, barW, isActive, currentYear, entry.startYear,
                )

                // ── Unique hatch id per bar — avoids cross-SVG id collisions ──
                const hatchId = `hatch-${entry.lord}-${entry.startYear}`

                return (
                  <TouchableOpacity
                    key={`${entry.lord}-${entry.startYear}`}
                    activeOpacity={0.9}
                    onPressIn={handleTimelinePressIn}
                    onPress={() => handlePeriodSelection(entry, antardashas)}
                    style={[
                      styles.temporalBlock,
                      { width: barW, height: (isActive ? CURRENT_BAR_H : BASE_BAR_H) + 22 },
                    ]}
                  >
                    {/* ── 3D Mahadasha Bar ─────────────────────────────── */}
                    <Animated.View style={[
                      styles.monolithBar,
                      {
                        height:      isActive ? CURRENT_BAR_H : BASE_BAR_H,
                        opacity:     isPast ? 0.25 : 1.0,
                        borderColor: isActive ? 'rgba(201,168,76,0.7)' : 'transparent',
                        borderWidth: isActive ? animatedBorderW : 0,
                      },
                    ]}>

                      {/* Left-to-right gradient face */}
                      <LinearGradient
                        colors={[theme.primary, theme.dark]}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        opacity={faceOpacity}
                      />

                      {/* Left leading cap glow edge */}
                      <View style={[styles.leftCapEdge, { backgroundColor: theme.light }]} />

                      {/* Top specular sheen */}
                      <View style={styles.topSheen} />

                      {/* Bottom shadow plate */}
                      <View style={[styles.bottomPlate, { backgroundColor: theme.dark }]} />

                      {/* FIX: Past-bar diagonal hatch.
                          Pattern defined INSIDE this bar's own <Svg> — react-native-svg
                          does not share id namespaces across separate <Svg> elements,
                          so the pattern MUST live in the same SVG that uses it. */}
                      {isPast && (
                        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                          <Svg width="100%" height="100%">
                            <Defs>
                              <Pattern
                                id={hatchId}
                                width="8"
                                height="8"
                                patternTransform="rotate(45)"
                                patternUnits="userSpaceOnUse"
                              >
                                <Line
                                  x1="0" y1="0" x2="0" y2="8"
                                  stroke="rgba(255,255,255,0.06)"
                                  strokeWidth="1"
                                />
                              </Pattern>
                            </Defs>
                            <Rect width="100%" height="100%" fill={`url(#${hatchId})`} />
                          </Svg>
                        </View>
                      )}

                      {/* Lord name + duration */}
                      <View style={styles.barTextStack}>
                        <Text
                          style={[styles.lordName, { fontSize: barW > 55 ? 11 : 8 }]}
                          numberOfLines={1}
                        >
                          {entry.lord.toUpperCase()}
                        </Text>
                        {barW > 45 && (
                          <Text style={styles.durationLabel}>
                            {entry.endYear - entry.startYear} YRS
                          </Text>
                        )}
                      </View>
                    </Animated.View>

                    {/* ── Antardasha Micro-Strip ───────────────────────── */}
                    <View style={[styles.antarStrip, { width: barW }]}>
                      {antardashas.map((sub, sIdx) => {
                        const subTheme = DASHA_COLORS[sub.lord] ?? { primary: '#FFF', dark: '#222' }
                        return (
                          <View
                            key={`sub-${sub.lord}-${sIdx}`}
                            style={[
                              styles.antarSegment,
                              {
                                width:        sub.width,
                                opacity:      sub.isCurrent ? 0.70 : 0.30,
                                borderTopWidth: sub.isCurrent ? 1 : 0,
                                borderColor:  subTheme.primary,
                              },
                            ]}
                          >
                            <LinearGradient
                              colors={[subTheme.primary, subTheme.dark]}
                              style={StyleSheet.absoluteFillObject}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0, y: 1 }}
                            />
                          </View>
                        )
                      })}
                    </View>

                    {/* Year stamp below strip */}
                    <Text style={styles.yearStamp}>{entry.startYear}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* ── NOW Laser Cursor ─────────────────────────────────────── */}
            <Animated.View
              style={[
                styles.nowCursor,
                { left: currentX + 40, shadowRadius: animatedLaserGlow },
              ]}
              pointerEvents="none"
            >
              <Text style={styles.nowLabel}>NOW</Text>

              <Animated.View style={[
                styles.goldOrb,
                { transform: [{ scale: animatedOrbScale }] },
              ]} />

              <LinearGradient
                colors={['rgba(201,168,76,0.9)', 'rgba(201,168,76,0.5)', 'transparent']}
                style={styles.laserBeam}
              />

              <Text style={styles.nowYear}>{currentYear}</Text>
            </Animated.View>

          </ScrollView>
        </BlurView>
      </Animated.View>
    </Animated.View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerBoundaryWrapper: {
    paddingHorizontal: 14,
    marginVertical: 8,
  },
  glassContainerShell: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
    overflow: 'hidden',
    backgroundColor: 'rgba(10,8,22,0.4)',
  },
  starNode: {
    position: 'absolute',
    width: 1.5,
    height: 1.5,
    borderRadius: 0.75,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  scrollerCanvas: {
    paddingLeft: 40,
    paddingRight: 40,
    paddingTop: 44,
    paddingBottom: 16,
    position: 'relative',
  },
  decadeTickLine: {
    position: 'absolute',
    top: 20,
    bottom: 24,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 2,
  },
  decadeTickLabel: {
    fontFamily: Fonts.accent,
    fontSize: 7,
    color: 'rgba(255,255,255,0.2)',
    position: 'absolute',
    top: -14,
    transform: [{ translateX: -8 }],
  },
  riverRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    zIndex: 5,
  },
  temporalBlock: {
    alignItems: 'flex-start',
    marginRight: 1,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  monolithBar: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  leftCapEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 4,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    zIndex: 3,
  },
  bottomPlate: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.8,
    zIndex: 3,
  },
  barTextStack: {
    zIndex: 5,
    shadowColor: '#000',
    shadowRadius: 3,
    shadowOpacity: 0.9,
  },
  lordName: {
    fontFamily: Fonts.accent,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  durationLabel: {
    fontFamily: Fonts.accent,
    fontSize: 7,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
  antarStrip: {
    height: 14,
    flexDirection: 'row',
    marginTop: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
  antarSegment: {
    height: '100%',
    marginRight: 0.5,
  },
  yearStamp: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 6,
  },

  // NOW Cursor system
  nowCursor: {
    position: 'absolute',
    top: 12,
    bottom: 0,
    width: 2,
    alignItems: 'center',
    zIndex: 50,
    shadowColor: '#C9A84C',
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
  },
  nowLabel: {
    fontFamily: Fonts.accent,
    fontSize: 7,
    color: '#C9A84C',
    position: 'absolute',
    top: -14,
    letterSpacing: 0.5,
  },
  goldOrb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C9A84C',
    position: 'absolute',
    top: 0,
    shadowColor: '#C9A84C',
    shadowRadius: 8,
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 4 },
  },
  laserBeam: {
    width: 1.5,
    position: 'absolute',
    top: 10,
    bottom: 16,
  },
  nowYear: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: '#C9A84C',
    position: 'absolute',
    bottom: -1,
    letterSpacing: 0.5,
  },
})
