import React from 'react'
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Fonts } from '../../constants/fonts'
import type { VedicChart, VedicGraha, GocharData } from '../../types'
import { KundliGrid, CenterMandala } from './KundliGrid'
import type { GridCellData, GridPlanet } from './KundliGrid'

const { width } = Dimensions.get('window')
const CHART_SIZE = Math.min(width - 32, 364)

const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrishchika',
  'Dhanu', 'Makara', 'Kumbha', 'Meena',
]

const GRAHA_INFO: Record<string, { abbr: string; color: string }> = {
  Surya:   { abbr: 'Su', color: '#FF9500' },
  Chandra: { abbr: 'Mo', color: '#C0C8FF' },
  Mangal:  { abbr: 'Ma', color: '#FF3B3B' },
  Budh:    { abbr: 'Me', color: '#00C060' },
  Guru:    { abbr: 'Ju', color: '#FFD700' },
  Shukra:  { abbr: 'Ve', color: '#FF80AA' },
  Shani:   { abbr: 'Sa', color: '#8BA0C0' },
  Rahu:    { abbr: 'Ra', color: '#9090BB' },
  Ketu:    { abbr: 'Ke', color: '#B87840' },
}

const TODAY_STR = new Date().toLocaleDateString('en-US', {
  day: 'numeric', month: 'short', year: 'numeric',
})

interface GocharChartProps {
  natalChart: VedicChart
  gocharData: GocharData
}

export function GocharChart({ natalChart, gocharData }: GocharChartProps) {
  const lagnaRashiIdx = RASHI_NAMES.indexOf(natalChart.lagna)

  const cells: GridCellData[] = Array.from({ length: 12 }, (_, rashiIdx) => {
    const houseNum = ((rashiIdx - lagnaRashiIdx + 12) % 12) + 1
    const isLagna = rashiIdx === lagnaRashiIdx
    const isKendra = [1, 4, 7, 10].includes(houseNum)
    const isTrikona = [1, 5, 9].includes(houseNum)

    // Natal planets (gold)
    const natalHere = natalChart.grahas.filter(
      g => RASHI_NAMES.indexOf(g.rashi) === rashiIdx
    )
    const natalPlanets: GridPlanet[] = natalHere.map(g => ({
      abbr: GRAHA_INFO[g.name]?.abbr ?? g.name.substring(0, 2),
      color: GRAHA_INFO[g.name]?.color ?? '#C9A84C',
      isRetrograde: g.isRetrograde,
      isExalted: g.isExalted,
      isDebilitated: g.isDebilitated,
      isTransit: false,
    }))

    // Transit planets (cyan)
    const transitHere = gocharData.transitingPlanets.filter(
      g => RASHI_NAMES.indexOf(g.rashi) === rashiIdx
    )
    const transitPlanets: GridPlanet[] = transitHere.map(g => ({
      abbr: GRAHA_INFO[g.name]?.abbr ?? g.name.substring(0, 2),
      color: '#00DFDF',
      isTransit: true,
    }))

    return {
      rashiIdx,
      houseNum,
      isLagna,
      isKendra,
      isTrikona,
      planets: [...natalPlanets, ...transitPlanets],
    }
  })

  const center = (
    <View style={styles.centerGochar}>
      <LinearGradient
        colors={['rgba(0,80,80,0.8)', 'rgba(10,5,25,0.95)']}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.centerSymbol}>☿</Text>
      <Text style={styles.centerLabel}>GOCHAR</Text>
      <Text style={styles.centerDate}>{TODAY_STR}</Text>
    </View>
  )

  return (
    <View style={styles.wrapper}>
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
          <Text style={styles.legendText}>Natal (birth)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00DFDF' }]} />
          <Text style={styles.legendText}>Transit (today)</Text>
        </View>
      </View>

      {/* Grid */}
      <View style={styles.gridWrap}>
        <View style={[styles.outerFrame, { width: CHART_SIZE + 4, height: CHART_SIZE + 4 }]}>
          <LinearGradient
            colors={['rgba(0,180,180,0.5)', 'rgba(120,60,220,0.3)', 'rgba(0,180,180,0.5)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
        <KundliGrid
          cells={cells}
          chartSize={CHART_SIZE}
          centerContent={center}
        />
      </View>

      {/* Transit condition cards */}
      <View style={styles.conditionsWrap}>
        <Text style={styles.conditionsTitle}>Active Transit Conditions</Text>
        {gocharData.keyConditions.map((cond, i) => (
          <View key={i} style={styles.condCard}>
            <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFillObject} />
            <LinearGradient
              colors={['rgba(0,40,60,0.7)', 'rgba(5,5,20,0.8)']}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.condDot}>◈</Text>
            <Text style={styles.condText}>{cond}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.hint}>
        Gold = natal birth positions  ·  Cyan = today's transiting planets
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  legend: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(13,13,43,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  gridWrap: { alignItems: 'center', position: 'relative' },
  outerFrame: { position: 'absolute', borderRadius: 6, overflow: 'hidden' },
  centerGochar: {
    width: CHART_SIZE / 2,
    height: CHART_SIZE / 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  centerSymbol: { fontSize: 18, color: '#00DFDF', marginBottom: 2 },
  centerLabel: { fontFamily: Fonts.heading, fontSize: 10, color: '#00DFDF', letterSpacing: 3 },
  centerDate: { fontFamily: Fonts.accent, fontSize: 7, color: 'rgba(0,220,220,0.5)', letterSpacing: 0.5, marginTop: 2 },
  conditionsWrap: { width: '100%', marginTop: 16, gap: 8 },
  conditionsTitle: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  condCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,200,200,0.15)',
    overflow: 'hidden',
    padding: 14,
    position: 'relative',
  },
  condDot: { fontSize: 14, color: '#00DFDF', marginTop: 1 },
  condText: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1, lineHeight: 20 },
  hint: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 14, textAlign: 'center' },
})
