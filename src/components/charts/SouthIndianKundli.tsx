import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Modal, ScrollView, Animated, PanResponder,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'
import type { VedicChart, VedicGraha } from '../../types'
import {
  KundliGrid, CenterMandala,
  RASHI_SHORT, RASHI_TO_CELL,
} from './KundliGrid'
import type { GridCellData, GridPlanet } from './KundliGrid'

const { width } = Dimensions.get('window')
const CHART_SIZE = Math.min(width - 32, 364)
const CELL = CHART_SIZE / 4

// ─── Vedic Constants ──────────────────────────────────────────────────────────
const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrishchika',
  'Dhanu', 'Makara', 'Kumbha', 'Meena',
]
const RASHI_SYMBOL = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

const GRAHA_INFO: Record<string, { abbr: string; color: string; fullName: string }> = {
  Surya:   { abbr: 'Su', color: '#FF9500', fullName: 'Surya (Sun)' },
  Chandra: { abbr: 'Mo', color: '#C0C8FF', fullName: 'Chandra (Moon)' },
  Mangal:  { abbr: 'Ma', color: '#FF3B3B', fullName: 'Mangal (Mars)' },
  Budh:    { abbr: 'Me', color: '#00C060', fullName: 'Budha (Mercury)' },
  Guru:    { abbr: 'Ju', color: '#FFD700', fullName: 'Guru (Jupiter)' },
  Shukra:  { abbr: 'Ve', color: '#FF80AA', fullName: 'Shukra (Venus)' },
  Shani:   { abbr: 'Sa', color: '#8BA0C0', fullName: 'Shani (Saturn)' },
  Rahu:    { abbr: 'Ra', color: '#9090BB', fullName: 'Rahu (North Node)' },
  Ketu:    { abbr: 'Ke', color: '#B87840', fullName: 'Ketu (South Node)' },
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

// ─── CellInfo for detail modal ────────────────────────────────────────────────
interface CellInfo {
  rashiIdx: number
  houseNum: number
  planets: VedicGraha[]
  isLagna: boolean
  isKendra: boolean
  isTrikona: boolean
}

// ─── Bottom Sheet Modal ────────────────────────────────────────────────────────
function CellDetailModal({ cell, onClose }: { cell: CellInfo | null; onClose: () => void }) {
  if (!cell) return null

  const slideAnim = useRef(new Animated.Value(400)).current
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }).start()
  }, [])

  function close() {
    Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }).start(onClose)
  }

  return (
    <Modal transparent animationType="none" onRequestClose={close}>
      <TouchableOpacity style={dm.overlay} onPress={close} activeOpacity={1} />
      <Animated.View style={[dm.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(30,10,60,0.95)', 'rgba(5,5,20,0.98)']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={dm.handle} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={dm.scroll}>
          <View style={dm.header}>
            <View>
              <Text style={dm.rashiText}>{RASHI_NAMES[cell.rashiIdx]}</Text>
              <Text style={dm.houseLabel}>House {cell.houseNum}</Text>
            </View>
            <Text style={dm.symbolText}>{RASHI_SYMBOL[cell.rashiIdx]}</Text>
          </View>
          <View style={dm.meaningCard}>
            <Text style={dm.meaningLabel}>House Domain</Text>
            <Text style={dm.meaningText}>{HOUSE_MEANINGS[cell.houseNum - 1]}</Text>
          </View>
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
      </Animated.View>
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
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  scroll: { padding: 24, paddingBottom: 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  rashiText: { fontFamily: Fonts.heading, fontSize: 22, color: '#C9A84C', marginBottom: 4 },
  houseLabel: { fontFamily: Fonts.accent, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 },
  symbolText: { fontSize: 36, color: 'rgba(255,255,255,0.5)' },
  meaningCard: { backgroundColor: 'rgba(201,168,76,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', padding: 16, marginBottom: 20 },
  meaningLabel: { fontFamily: Fonts.accent, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  meaningText: { fontFamily: Fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 22 },
  sectionLabel: { fontFamily: Fonts.accent, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 },
  planetsSection: { marginBottom: 20 },
  planetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  planetDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  planetInfo: { flex: 1 },
  planetName: { fontFamily: Fonts.bodySemiBold, fontSize: 14, lineHeight: 22 },
  planetDegree: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 18 },
  emptyPlanets: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, marginBottom: 20 },
  emptyText: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 },
  emptySubText: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 20 },
  closeBtn: { margin: 20, marginTop: 8, paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  closeText: { fontFamily: Fonts.accent, fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
})

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function SouthIndianKundli({ chart }: { chart: VedicChart }) {
  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null)

  // Built-in Animated values for 3-D tilt
  const rotXAnim = useRef(new Animated.Value(0)).current
  const rotYAnim = useRef(new Animated.Value(0)).current

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        rotXAnim.setValue(-gs.dy / 12)
        rotYAnim.setValue(gs.dx / 12)
      },
      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(rotXAnim, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: false }),
          Animated.spring(rotYAnim, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: false }),
        ]).start()
      },
    })
  ).current

  // Interpolate numbers → deg strings for transform
  const rotXStr = rotXAnim.interpolate({ inputRange: [-25, 25], outputRange: ['-25deg', '25deg'] })
  const rotYStr = rotYAnim.interpolate({ inputRange: [-25, 25], outputRange: ['-25deg', '25deg'] })

  // Build grid cells from chart data
  const lagnaRashiIdx = RASHI_NAMES.indexOf(chart.lagna)

  const cells: GridCellData[] = Array.from({ length: 12 }, (_, rashiIdx) => {
    const houseNum = ((rashiIdx - lagnaRashiIdx + 12) % 12) + 1
    const natalGrahas = chart.grahas.filter(g => RASHI_NAMES.indexOf(g.rashi) === rashiIdx)
    const isLagna = rashiIdx === lagnaRashiIdx
    const isKendra = [1, 4, 7, 10].includes(houseNum)
    const isTrikona = [1, 5, 9].includes(houseNum)
    const planets: GridPlanet[] = natalGrahas.map(g => {
      const gi = GRAHA_INFO[g.name]
      return {
        abbr: gi?.abbr ?? g.name.substring(0, 2),
        color: gi?.color ?? '#FFF',
        isRetrograde: g.isRetrograde,
        isExalted: g.isExalted,
        isDebilitated: g.isDebilitated,
      }
    })
    return { rashiIdx, houseNum, planets, isLagna, isKendra, isTrikona }
  })

  function handleCellPress(cell: GridCellData) {
    const vedicGrahas = chart.grahas.filter(
      g => RASHI_NAMES.indexOf(g.rashi) === cell.rashiIdx
    )
    setSelectedCell({
      rashiIdx: cell.rashiIdx,
      houseNum: cell.houseNum,
      planets: vedicGrahas,
      isLagna: cell.isLagna,
      isKendra: cell.isKendra,
      isTrikona: cell.isTrikona,
    })
  }

  const center = (
    <CenterMandala
      size={CHART_SIZE / 2}
      yogas={chart.yogas}
    />
  )

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.shadowWrap,
          {
            transform: [
              { perspective: 1100 },
              { rotateX: rotXStr },
              { rotateY: rotYStr },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Gold outer frame glow */}
        <View style={[styles.outerFrame, { width: CHART_SIZE + 4, height: CHART_SIZE + 4 }]}>
          <LinearGradient
            colors={['rgba(201,168,76,0.6)', 'rgba(120,60,220,0.4)', 'rgba(201,168,76,0.6)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>

        <KundliGrid
          cells={cells}
          chartSize={CHART_SIZE}
          centerContent={center}
          onCellPress={handleCellPress}
        />
      </Animated.View>

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
  dragHint: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 14,
    letterSpacing: 0.3,
  },
})
