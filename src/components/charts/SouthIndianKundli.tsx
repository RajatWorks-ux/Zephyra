import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Modal, ScrollView, Animated as RNAnimated,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'
import type { VedicChart, VedicGraha } from '../../types'

const { width } = Dimensions.get('window')
const CHART_SIZE = Math.min(width - 32, 364)
const CELL = CHART_SIZE / 4
const CENTER_SIZE = CELL * 2

// ─── Vedic Constants ──────────────────────────────────────────────────────────
const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrishchika',
  'Dhanu', 'Makara', 'Kumbha', 'Meena',
]
const RASHI_SHORT = [
  'Mes', 'Vri', 'Mit', 'Kar',
  'Sin', 'Kan', 'Tul', 'Vsc',
  'Dha', 'Mak', 'Kum', 'Mee',
]
const RASHI_SYMBOL = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

// South Indian fixed grid: rashi index → [row, col]
const RASHI_TO_CELL: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 3],
  [2, 3], [3, 3], [3, 2], [3, 1],
  [3, 0], [2, 0], [1, 0], [0, 0],
]

// Planet abbreviations, colors, full names
const GRAHA_INFO: Record<string, { abbr: string; color: string; fullName: string }> = {
  Surya:    { abbr: 'Su', color: '#FF9500', fullName: 'Surya (Sun)' },
  Chandra:  { abbr: 'Mo', color: '#C0C8FF', fullName: 'Chandra (Moon)' },
  Mangal:   { abbr: 'Ma', color: '#FF3B3B', fullName: 'Mangal (Mars)' },
  Budh:     { abbr: 'Me', color: '#00C060', fullName: 'Budha (Mercury)' },
  Guru:     { abbr: 'Ju', color: '#FFD700', fullName: 'Guru (Jupiter)' },
  Shukra:   { abbr: 'Ve', color: '#FF80AA', fullName: 'Shukra (Venus)' },
  Shani:    { abbr: 'Sa', color: '#8BA0C0', fullName: 'Shani (Saturn)' },
  Rahu:     { abbr: 'Ra', color: '#9090BB', fullName: 'Rahu (North Node)' },
  Ketu:     { abbr: 'Ke', color: '#B87840', fullName: 'Ketu (South Node)' },
}

const HOUSE_MEANINGS = [
  'Self, body, appearance, personality, first impressions, vitality',
  'Wealth, speech, family, food, accumulated resources, early childhood',
  'Courage, siblings, short travels, communication, hands, effort',
  'Mother, home, property, happiness, chest, emotional security',
  'Intelligence, children, creativity, past life merit, speculation',
  'Enemies, diseases, debts, service, daily routine, healing',
  'Spouse, partnerships, open enemies, business associates, lower back',
  'Longevity, transformation, hidden matters, inheritance, occult',
  'Dharma, higher learning, foreign travel, teacher, luck, philosophy',
  'Career, father, status, public life, authority, government',
  'Gains, friends, elder siblings, hopes, large organisations',
  'Losses, expenses, foreign lands, moksha, isolation, sleep',
]

// ─── Cell Component ────────────────────────────────────────────────────────────
interface CellInfo {
  rashiIdx: number
  houseNum: number
  planets: VedicGraha[]
  isLagna: boolean
  isKendra: boolean
  isTrikona: boolean
}

function KundliCell({
  info,
  size,
  onPress,
}: {
  info: CellInfo
  size: number
  onPress: (info: CellInfo) => void
}) {
  const pressAnim = useRef(new RNAnimated.Value(1)).current

  function handlePressIn() {
    RNAnimated.spring(pressAnim, { toValue: 0.93, useNativeDriver: true, speed: 30 }).start()
  }
  function handlePressOut() {
    RNAnimated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start()
  }

  const borderColor = info.isLagna
    ? 'rgba(201,168,76,0.9)'
    : info.isKendra
    ? 'rgba(124,58,237,0.5)'
    : info.isTrikona
    ? 'rgba(201,168,76,0.4)'
    : 'rgba(255,255,255,0.08)'

  const gradColors: [string, string] = info.isLagna
    ? ['rgba(60,40,10,0.95)', 'rgba(20,10,5,0.98)']
    : info.isKendra
    ? ['rgba(30,15,55,0.95)', 'rgba(10,5,25,0.98)']
    : ['rgba(13,13,43,0.95)', 'rgba(5,5,20,0.98)']

  return (
    <RNAnimated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(info) }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[cs.cell, { width: size, height: size, borderColor }]}
      >
        <LinearGradient colors={gradColors} style={StyleSheet.absoluteFillObject} />

        {/* Top-left edge highlight (simulates 3D light) */}
        <View style={cs.lightEdgeTop} />
        <View style={cs.lightEdgeLeft} />

        {/* House number */}
        <Text style={[cs.houseNum, { color: info.isLagna ? '#C9A84C' : 'rgba(255,255,255,0.25)' }]}>
          {info.houseNum}
        </Text>

        {/* Rashi short name */}
        <Text style={cs.rashiName}>{RASHI_SHORT[info.rashiIdx]}</Text>

        {/* Planet abbreviations */}
        <View style={cs.planetsWrap}>
          {info.planets.map((p) => {
            const gi = GRAHA_INFO[p.name]
            return (
              <Text
                key={p.name}
                style={[
                  cs.planet,
                  { color: gi?.color || '#FFF' },
                  p.isExalted && cs.planetExalted,
                  p.isDebilitated && cs.planetDebilitated,
                ]}
              >
                {gi?.abbr || p.name.substring(0, 2)}
                {p.isRetrograde ? 'R' : ''}
                {p.isExalted ? '*' : ''}
              </Text>
            )
          })}
        </View>

        {/* Lagna indicator */}
        {info.isLagna && <View style={cs.lagnaBar} />}
      </TouchableOpacity>
    </RNAnimated.View>
  )
}

const cs = StyleSheet.create({
  cell: {
    borderWidth: 1,
    overflow: 'hidden',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  lightEdgeTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  lightEdgeLeft: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  houseNum: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  rashiName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 9,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 3,
  },
  planetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 1,
  },
  planet: {
    fontFamily: Fonts.accentBold,
    fontSize: 10,
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  planetExalted: {
    textShadowColor: '#FFD700',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
  planetDebilitated: {
    opacity: 0.6,
  },
  lagnaBar: {
    position: 'absolute',
    bottom: 0, left: 4, right: 4,
    height: 2,
    backgroundColor: '#C9A84C',
    borderRadius: 1,
    shadowColor: '#C9A84C',
    shadowRadius: 4,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
  },
})

// ─── Center Mandala ────────────────────────────────────────────────────────────
function CenterMandala({ size, yogas }: { size: number; yogas: string[] }) {
  const firstYoga = yogas[0]?.split('(')[0]?.trim() || 'Zephyra'

  return (
    <View style={[cm.wrap, { width: size, height: size }]}>
      <LinearGradient
        colors={['rgba(40,20,80,0.98)', 'rgba(10,5,25,0.99)']}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Decorative corner lines */}
      <View style={[cm.cornerTL, cm.corner]} />
      <View style={[cm.cornerTR, cm.corner]} />
      <View style={[cm.cornerBL, cm.corner]} />
      <View style={[cm.cornerBR, cm.corner]} />

      {/* Center content */}
      <View style={cm.content}>
        <Text style={cm.symbol}>✦</Text>
        <Text style={cm.appName}>ZEPHYRA</Text>
        {firstYoga ? (
          <Text style={cm.yogaText} numberOfLines={2}>{firstYoga}</Text>
        ) : null}
        <Text style={cm.subText}>Vedic Kundali</Text>
      </View>

      {/* Radiant lines */}
      <View style={cm.lineH} />
      <View style={cm.lineV} />
    </View>
  )
}

const cm = StyleSheet.create({
  wrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  corner: {
    position: 'absolute',
    width: 14, height: 14,
    borderColor: 'rgba(201,168,76,0.5)',
  },
  cornerTL: { top: 6, left: 6, borderTopWidth: 1, borderLeftWidth: 1, borderTopLeftRadius: 3 },
  cornerTR: { top: 6, right: 6, borderTopWidth: 1, borderRightWidth: 1, borderTopRightRadius: 3 },
  cornerBL: { bottom: 6, left: 6, borderBottomWidth: 1, borderLeftWidth: 1, borderBottomLeftRadius: 3 },
  cornerBR: { bottom: 6, right: 6, borderBottomWidth: 1, borderRightWidth: 1, borderBottomRightRadius: 3 },
  content: { alignItems: 'center', zIndex: 2 },
  symbol: { fontSize: 16, color: '#C9A84C', marginBottom: 4 },
  appName: { fontFamily: Fonts.heading, fontSize: 10, color: '#C9A84C', letterSpacing: 3 },
  yogaText: { fontFamily: Fonts.body, fontSize: 8, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 4, maxWidth: 80 },
  subText: { fontFamily: Fonts.accent, fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginTop: 4 },
  lineH: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: 'rgba(201,168,76,0.1)' },
  lineV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(201,168,76,0.1)' },
})

// ─── Bottom Sheet Detail Modal ────────────────────────────────────────────────
function CellDetailModal({
  cell,
  onClose,
}: {
  cell: CellInfo | null
  onClose: () => void
}) {
  if (!cell) return null

  const slideAnim = useRef(new RNAnimated.Value(400)).current
  useEffect(() => {
    RNAnimated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start()
  }, [])

  function close() {
    RNAnimated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start(onClose)
  }

  return (
    <Modal transparent animationType="none" onRequestClose={close}>
      <TouchableOpacity style={dm.overlay} onPress={close} activeOpacity={1} />
      <RNAnimated.View style={[dm.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(30,10,60,0.95)', 'rgba(5,5,20,0.98)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={dm.handle} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dm.scroll}>
          {/* Header */}
          <View style={dm.header}>
            <View>
              <Text style={dm.rashiText}>{RASHI_NAMES[cell.rashiIdx]}</Text>
              <Text style={dm.houseLabel}>House {cell.houseNum}</Text>
            </View>
            <Text style={dm.symbolText}>{RASHI_SYMBOL[cell.rashiIdx]}</Text>
          </View>

          {/* House meaning */}
          <View style={dm.meaningCard}>
            <Text style={dm.meaningLabel}>House Domain</Text>
            <Text style={dm.meaningText}>{HOUSE_MEANINGS[cell.houseNum - 1]}</Text>
          </View>

          {/* Planets in this house */}
          {cell.planets.length > 0 && (
            <View style={dm.planetsSection}>
              <Text style={dm.sectionLabel}>Planets Here</Text>
              {cell.planets.map((p) => {
                const gi = GRAHA_INFO[p.name]
                return (
                  <View key={p.name} style={dm.planetRow}>
                    <View style={[dm.planetDot, { backgroundColor: gi?.color || '#FFF' }]} />
                    <View style={dm.planetInfo}>
                      <Text style={[dm.planetName, { color: gi?.color }]}>
                        {gi?.fullName || p.name}
                        {p.isRetrograde ? '  (Retrograde)' : ''}
                        {p.isExalted ? '  (Exalted)' : ''}
                        {p.isDebilitated ? '  (Debilitated)' : ''}
                      </Text>
                      <Text style={dm.planetDegree}>
                        {p.nakshatra} Nakshatra · Pada {p.nakshatraPada} · {p.degree.toFixed(1)}° in {p.rashi}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {cell.planets.length === 0 && (
            <View style={dm.emptyPlanets}>
              <Text style={dm.emptyText}>No planets placed in this house at birth.</Text>
              <Text style={dm.emptySubText}>An empty house is read through its lord — the ruling planet of {RASHI_NAMES[cell.rashiIdx]}.</Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity onPress={close} style={dm.closeBtn}>
          <Text style={dm.closeText}>Close</Text>
        </TouchableOpacity>
      </RNAnimated.View>
    </Modal>
  )
}

const dm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', maxHeight: '75%',
    borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  scroll: { padding: 24, paddingBottom: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  rashiText: { fontFamily: Fonts.heading, fontSize: 22, color: '#C9A84C', marginBottom: 4 },
  houseLabel: { fontFamily: Fonts.accent, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  symbolText: { fontSize: 36, color: 'rgba(255,255,255,0.5)' },
  meaningCard: {
    backgroundColor: 'rgba(201,168,76,0.06)',
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)', padding: 16, marginBottom: 20,
  },
  meaningLabel: { fontFamily: Fonts.accent, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  meaningText: { fontFamily: Fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 22 },
  sectionLabel: { fontFamily: Fonts.accent, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 },
  planetsSection: { marginBottom: 20 },
  planetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  planetDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  planetInfo: { flex: 1 },
  planetName: { fontFamily: Fonts.bodySemiBold, fontSize: 14, lineHeight: 22 },
  planetDegree: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 18 },
  emptyPlanets: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 16, marginBottom: 20,
  },
  emptyText: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  emptySubText: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 20 },
  closeBtn: { margin: 20, marginTop: 8, paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  closeText: { fontFamily: Fonts.accent, fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
})

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function SouthIndianKundli({ chart }: { chart: VedicChart }) {
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null)

  // 3D tilt values
  const rotX = useSharedValue(0)
  const rotY = useSharedValue(0)

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onUpdate((e) => {
      rotX.value = -e.translationY / 12
      rotY.value = e.translationX / 12
    })
    .onEnd(() => {
      rotX.value = withSpring(0, { damping: 14, stiffness: 120 })
      rotY.value = withSpring(0, { damping: 14, stiffness: 120 })
    })

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value}deg` },
    ],
  }))

  // Build cell info for each rashi position
  const lagnaRashiIdx = RASHI_NAMES.indexOf(chart.lagna)

  function buildCell(rashiIdx: number): CellInfo {
    const houseNum = ((rashiIdx - lagnaRashiIdx + 12) % 12) + 1
    const planets = chart.grahas.filter(g => RASHI_NAMES.indexOf(g.rashi) === rashiIdx)
    const isLagna = rashiIdx === lagnaRashiIdx
    const isKendra = [1, 4, 7, 10].includes(houseNum)
    const isTrikona = [1, 5, 9].includes(houseNum)
    return { rashiIdx, houseNum, planets, isLagna, isKendra, isTrikona }
  }

  // Build grid rows
  // Row 0: rashis 11,0,1,2
  // Row 1: rashi 10, center, center, rashi 3
  // Row 2: rashi 9, center, center, rashi 4
  // Row 3: rashis 8,7,6,5
  const row0 = [11, 0, 1, 2].map(buildCell)
  const row1_L = buildCell(10)
  const row1_R = buildCell(3)
  const row2_L = buildCell(9)
  const row2_R = buildCell(4)
  const row3 = [8, 7, 6, 5].map(buildCell)

  return (
    <View style={styles.wrapper}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[animStyle, styles.shadowWrap]}>
          {/* Gold outer frame glow */}
          <View style={[styles.outerFrame, { width: CHART_SIZE + 4, height: CHART_SIZE + 4 }]}>
            <LinearGradient
              colors={['rgba(201,168,76,0.6)', 'rgba(120,60,220,0.4)', 'rgba(201,168,76,0.6)']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>

          {/* Chart grid */}
          <View style={[styles.grid, { width: CHART_SIZE, height: CHART_SIZE }]}>
            {/* Row 0 */}
            <View style={styles.row}>
              {row0.map((cell) => (
                <KundliCell key={cell.rashiIdx} info={cell} size={CELL} onPress={setSelectedCell} />
              ))}
            </View>

            {/* Row 1 */}
            <View style={styles.row}>
              <KundliCell info={row1_L} size={CELL} onPress={setSelectedCell} />
              <CenterMandala size={CENTER_SIZE} yogas={chart.yogas} />
              <KundliCell info={row1_R} size={CELL} onPress={setSelectedCell} />
            </View>

            {/* Row 2 */}
            <View style={styles.row}>
              <KundliCell info={row2_L} size={CELL} onPress={setSelectedCell} />
              <View style={{ width: CENTER_SIZE, height: CELL }} />
              <KundliCell info={row2_R} size={CELL} onPress={setSelectedCell} />
            </View>

            {/* Row 3 */}
            <View style={styles.row}>
              {row3.map((cell) => (
                <KundliCell key={cell.rashiIdx} info={cell} size={CELL} onPress={setSelectedCell} />
              ))}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      <Text style={styles.dragHint}>Drag to tilt · Tap any house for details</Text>

      <CellDetailModal cell={selectedCell} onClose={() => setSelectedCell(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: 8 },
  shadowWrap: {
    alignItems: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 20,
  },
  outerFrame: {
    position: 'absolute',
    borderRadius: 6,
    overflow: 'hidden',
  },
  grid: {
    overflow: 'hidden',
    borderRadius: 4,
  },
  row: { flexDirection: 'row' },
  dragHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 14,
    letterSpacing: 0.3,
  },
})
