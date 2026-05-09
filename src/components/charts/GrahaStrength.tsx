import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native'
import {
  Canvas, Rect as SkRect, RoundedRect, Path, Skia,
  LinearGradient as SkLinGrad, vec, Group, Paint, BlurMask,
} from '@shopify/react-native-skia'
import Animated, {
  useSharedValue, withTiming, withDelay,
  useAnimatedStyle, Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Fonts } from '../../constants/fonts'
import type { VedicChart, VedicGraha } from '../../types'

const { width } = Dimensions.get('window')

// Graha natural strength computation (simplified Shadbala)
function computeStrength(g: VedicGraha): number {
  let score = 50 // base
  if (g.isExalted) score += 35
  if (g.isDebilitated) score -= 30
  // Angular house bonus
  if ([1, 4, 7, 10].includes(g.house)) score += 15
  else if ([2, 5, 8, 11].includes(g.house)) score += 5
  if (g.isRetrograde && !['Rahu', 'Ketu'].includes(g.name)) score += 10
  return Math.max(8, Math.min(98, score))
}

const GRAHA_DATA: Record<string, { fullName: string; color: string; sideColor: string; label: string }> = {
  Surya:   { fullName: 'Surya', label: 'Su', color: '#FF9500', sideColor: '#994400' },
  Chandra: { fullName: 'Chandra', label: 'Mo', color: '#C0C8FF', sideColor: '#606898' },
  Mangal:  { fullName: 'Mangal', label: 'Ma', color: '#FF3B3B', sideColor: '#881010' },
  Budh:    { fullName: 'Budha', label: 'Me', color: '#00C060', sideColor: '#006030' },
  Guru:    { fullName: 'Guru', label: 'Ju', color: '#FFD700', sideColor: '#886600' },
  Shukra:  { fullName: 'Shukra', label: 'Ve', color: '#FF80AA', sideColor: '#883050' },
  Shani:   { fullName: 'Shani', label: 'Sa', color: '#8BA0C0', sideColor: '#405060' },
  Rahu:    { fullName: 'Rahu', label: 'Ra', color: '#9090BB', sideColor: '#404060' },
  Ketu:    { fullName: 'Ketu', label: 'Ke', color: '#B87840', sideColor: '#603818' },
}

const ORDER = ['Surya', 'Chandra', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani', 'Rahu', 'Ketu']

// One 3D pillar
function Pillar({
  graha,
  strength,
  idx,
  pillarW,
  maxH,
}: {
  graha: VedicGraha
  strength: number
  idx: number
  pillarW: number
  maxH: number
}) {
  const fillH = useSharedValue(0)

  useEffect(() => {
    fillH.value = withDelay(
      idx * 80,
      withTiming(strength / 100, { duration: 1000, easing: Easing.out(Easing.cubic) })
    )
  }, [strength])

  const gd = GRAHA_DATA[graha.name]
  if (!gd) return null

  const filledH = (strength / 100) * maxH
  const pillarH = maxH
  const gapW = 3

  return (
    <View style={{ alignItems: 'center', width: pillarW + gapW }}>
      {/* Strength % */}
      <Text style={[ps.pct, { color: graha.isExalted ? '#C9A84C' : graha.isDebilitated ? '#FF4444' : 'rgba(255,255,255,0.45)' }]}>
        {strength}
      </Text>

      {/* Pillar */}
      <View style={[ps.pillarWrap, { width: pillarW, height: pillarH }]}>
        {/* Track (empty portion) */}
        <View style={[ps.track, { width: pillarW, height: pillarH }]}>
          <LinearGradient
            colors={['rgba(20,10,40,0.8)', 'rgba(10,5,20,0.9)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>

        {/* Filled portion (animated) */}
        <Animated.View
          style={[
            ps.fill,
            {
              width: pillarW,
              height: (strength / 100) * pillarH,
            },
          ]}
        >
          <LinearGradient
            colors={[gd.color, gd.sideColor + 'AA']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          {/* Left face highlight */}
          <View style={ps.faceHighlight} />
          {/* Top glow when strength > 70 */}
          {strength > 70 && (
            <View style={[ps.topGlow, { shadowColor: gd.color }]} />
          )}
        </Animated.View>

        {/* 3D right side shadow */}
        <View style={[ps.rightSide, { height: (strength / 100) * pillarH, backgroundColor: gd.sideColor + '60' }]} />

        {/* Retro / exalted badge */}
        {(graha.isRetrograde || graha.isExalted || graha.isDebilitated) && (
          <View style={ps.badge}>
            <Text style={ps.badgeText}>
              {graha.isExalted ? 'U' : graha.isDebilitated ? 'N' : 'R'}
            </Text>
          </View>
        )}
      </View>

      {/* Label */}
      <Text style={[ps.label, { color: gd.color }]}>{gd.label}</Text>
    </View>
  )
}

const ps = StyleSheet.create({
  pct: { fontFamily: Fonts.accent, fontSize: 9, letterSpacing: 0.5, marginBottom: 4 },
  pillarWrap: { position: 'relative', overflow: 'visible', justifyContent: 'flex-end' },
  track: { position: 'absolute', bottom: 0, left: 0, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  fill: { position: 'absolute', bottom: 0, left: 0, borderRadius: 4, overflow: 'hidden', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  faceHighlight: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  topGlow: {
    position: 'absolute', top: -3, left: 0, right: 0,
    height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  rightSide: { position: 'absolute', bottom: 0, right: -4, width: 4, borderTopRightRadius: 2, borderBottomRightRadius: 4 },
  badge: {
    position: 'absolute', top: 2, right: -6,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(10,5,20,0.9)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: Fonts.accentBold, fontSize: 7, color: '#C9A84C' },
  label: { fontFamily: Fonts.accentBold, fontSize: 10, marginTop: 6, letterSpacing: 0.3 },
})

export function GrahaStrength({ chart }: { chart: VedicChart }) {
  const availW = Math.min(width - 40, 360)
  const pillarW = Math.floor((availW - 20) / 9) - 4
  const maxH = 160

  return (
    <View style={gstyles.wrapper}>
      <View style={gstyles.legend}>
        <Text style={gstyles.legendItem}><Text style={{ color: '#C9A84C' }}>U</Text> = Exalted (Uchcha)</Text>
        <Text style={gstyles.legendItem}><Text style={{ color: '#FF4444' }}>N</Text> = Debilitated (Neecha)</Text>
        <Text style={gstyles.legendItem}><Text style={{ color: 'rgba(255,255,255,0.5)' }}>R</Text> = Retrograde</Text>
      </View>

      <View style={gstyles.chart}>
        <View style={gstyles.pillarsRow}>
          {ORDER.map((name, idx) => {
            const graha = chart.grahas.find(g => g.name === name)
            if (!graha) return null
            const strength = computeStrength(graha)
            return (
              <Pillar
                key={name}
                graha={graha}
                strength={strength}
                idx={idx}
                pillarW={pillarW}
                maxH={maxH}
              />
            )
          })}
        </View>

        {/* Baseline */}
        <View style={gstyles.baseline} />

        {/* Grid lines */}
        {[25, 50, 75].map(pct => (
          <View
            key={pct}
            style={[gstyles.gridLine, { bottom: (pct / 100) * maxH + 28 }]}
          >
            <Text style={gstyles.gridLabel}>{pct}</Text>
          </View>
        ))}
      </View>

      {/* Graha details */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={gstyles.detailScroll}>
        {ORDER.map((name) => {
          const graha = chart.grahas.find(g => g.name === name)
          if (!graha) return null
          const gd = GRAHA_DATA[name]
          return (
            <View key={name} style={[gstyles.detailCard, { borderColor: gd.color + '30' }]}>
              <Text style={[gstyles.detailName, { color: gd.color }]}>{gd.fullName}</Text>
              <Text style={gstyles.detailRashi}>{graha.rashi}</Text>
              <Text style={gstyles.detailHouse}>House {graha.house}</Text>
              <Text style={gstyles.detailNak}>{graha.nakshatra}</Text>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

const gstyles = StyleSheet.create({
  wrapper: { paddingHorizontal: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  legendItem: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  chart: { position: 'relative', paddingHorizontal: 8, paddingBottom: 28 },
  pillarsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 0 },
  baseline: { height: 1, backgroundColor: 'rgba(201,168,76,0.3)', marginTop: 4 },
  gridLine: {
    position: 'absolute',
    left: 8, right: 8,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: { fontFamily: Fonts.accent, fontSize: 8, color: 'rgba(255,255,255,0.2)', position: 'absolute', right: 0, top: -9 },
  detailScroll: { paddingHorizontal: 4, paddingTop: 20, gap: 8 },
  detailCard: {
    backgroundColor: 'rgba(13,13,43,0.8)',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minWidth: 90,
    gap: 3,
  },
  detailName: { fontFamily: Fonts.accentBold, fontSize: 11, letterSpacing: 0.5 },
  detailRashi: { fontFamily: Fonts.bodySemiBold, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  detailHouse: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  detailNak: { fontFamily: Fonts.body, fontSize: 10, color: 'rgba(255,255,255,0.3)' },
})
