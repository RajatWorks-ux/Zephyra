import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import Svg, {
  Path, Circle, Defs, RadialGradient, Stop, G,
} from 'react-native-svg'
import { Fonts } from '../../constants/fonts'
import type { VedicChart } from '../../types'

const { width } = Dimensions.get('window')
const SIZE = Math.min(width - 40, 340)
const CX = SIZE / 2
const CY = SIZE / 2
const OUTER_R = SIZE * 0.46
const INNER_R = SIZE * 0.30
const CENTER_R = SIZE * 0.12

const NAKSHATRAS = [
  { name: 'Ashwini',            lord: 'Ketu',    color: '#8888AA' },
  { name: 'Bharani',            lord: 'Venus',   color: '#FF80AA' },
  { name: 'Krittika',           lord: 'Sun',     color: '#FF9500' },
  { name: 'Rohini',             lord: 'Moon',    color: '#C0C8FF' },
  { name: 'Mrigashira',         lord: 'Mars',    color: '#FF5555' },
  { name: 'Ardra',              lord: 'Rahu',    color: '#7070AA' },
  { name: 'Punarvasu',          lord: 'Jupiter', color: '#FFD700' },
  { name: 'Pushya',             lord: 'Saturn',  color: '#6080B0' },
  { name: 'Ashlesha',           lord: 'Mercury', color: '#44CC88' },
  { name: 'Magha',              lord: 'Ketu',    color: '#9090BB' },
  { name: 'Purva Phalguni',     lord: 'Venus',   color: '#FF90BB' },
  { name: 'Uttara Phalguni',    lord: 'Sun',     color: '#FFA030' },
  { name: 'Hasta',              lord: 'Moon',    color: '#B0B8FF' },
  { name: 'Chitra',             lord: 'Mars',    color: '#FF4444' },
  { name: 'Swati',              lord: 'Rahu',    color: '#8080BB' },
  { name: 'Vishakha',           lord: 'Jupiter', color: '#FFD020' },
  { name: 'Anuradha',           lord: 'Saturn',  color: '#5070A0' },
  { name: 'Jyeshtha',           lord: 'Mercury', color: '#33BB77' },
  { name: 'Mula',               lord: 'Ketu',    color: '#9898CC' },
  { name: 'Purva Ashadha',      lord: 'Venus',   color: '#FF88BB' },
  { name: 'Uttara Ashadha',     lord: 'Sun',     color: '#FFAA40' },
  { name: 'Shravana',           lord: 'Moon',    color: '#A0B0FF' },
  { name: 'Dhanishta',          lord: 'Mars',    color: '#FF3333' },
  { name: 'Shatabhisha',        lord: 'Rahu',    color: '#6868AA' },
  { name: 'Purva Bhadrapada',   lord: 'Jupiter', color: '#EEC600' },
  { name: 'Uttara Bhadrapada',  lord: 'Saturn',  color: '#4060A0' },
  { name: 'Revati',             lord: 'Mercury', color: '#22AA66' },
]

const SPAN = 360 / 27
const DEG_TO_RAD = Math.PI / 180

// Hex color to rgba string
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// Build SVG donut-arc path string
function makeArcPath(
  cx: number, cy: number,
  r1: number, r2: number,
  startDeg: number, endDeg: number
): string {
  // -90 offset so 0° is at top
  const s = (startDeg - 90) * DEG_TO_RAD
  const e = (endDeg - 90) * DEG_TO_RAD
  const largeArc = endDeg - startDeg > 180 ? 1 : 0

  const x1 = cx + r1 * Math.cos(s)
  const y1 = cy + r1 * Math.sin(s)
  const x2 = cx + r1 * Math.cos(e)
  const y2 = cy + r1 * Math.sin(e)
  const x3 = cx + r2 * Math.cos(e)
  const y3 = cy + r2 * Math.sin(e)
  const x4 = cx + r2 * Math.cos(s)
  const y4 = cy + r2 * Math.sin(s)

  return [
    `M ${x1} ${y1}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${r2} ${r2} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ')
}

export function NakshatraWheel({ chart }: { chart: VedicChart }) {
  const currentNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra)
  const currentColor = NAKSHATRAS[Math.max(0, currentNakIdx)]?.color ?? '#C9A84C'

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <RadialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="rgba(50,25,100,0.95)" />
            <Stop offset="100%" stopColor="rgba(10,5,25,0.99)" />
          </RadialGradient>
        </Defs>

        {/* Background circle */}
        <Circle
          cx={CX} cy={CY} r={OUTER_R + 2}
          fill="rgba(5,5,20,0.95)"
        />

        {/* 27 Nakshatra segments */}
        {NAKSHATRAS.map((nak, i) => {
          const startDeg = i * SPAN
          const endDeg = startDeg + SPAN - 0.5
          const isCurrent = i === currentNakIdx
          const d = makeArcPath(CX, CY, INNER_R, OUTER_R, startDeg, endDeg)

          return (
            <G key={nak.name}>
              {/* Fill */}
              <Path
                d={d}
                fill={isCurrent ? hexToRgba(nak.color, 0.85) : hexToRgba(nak.color, 0.19)}
              />
              {/* Stroke */}
              <Path
                d={d}
                fill="none"
                stroke={isCurrent ? hexToRgba(nak.color, 0.8) : 'rgba(255,255,255,0.05)'}
                strokeWidth={isCurrent ? 2 : 0.5}
              />
              {/* Glow ring for current (simulated with extra stroke + opacity) */}
              {isCurrent && (
                <Path
                  d={d}
                  fill="none"
                  stroke={hexToRgba(nak.color, 0.25)}
                  strokeWidth={6}
                />
              )}
            </G>
          )
        })}

        {/* Inner dark fill */}
        <Circle cx={CX} cy={CY} r={INNER_R - 1} fill="rgba(5,5,20,0.98)" />

        {/* Outer glow ring for current nakshatra */}
        {currentNakIdx >= 0 && (
          <Circle
            cx={CX} cy={CY} r={OUTER_R + 8}
            fill="none"
            stroke={hexToRgba(currentColor, 0.18)}
            strokeWidth={6}
          />
        )}

        {/* Center gradient circle */}
        <Circle cx={CX} cy={CY} r={CENTER_R} fill="url(#centerGrad)" />
        <Circle
          cx={CX} cy={CY} r={CENTER_R}
          fill="none"
          stroke="rgba(201,168,76,0.4)"
          strokeWidth={1}
        />
      </Svg>

      {/* Center label overlay */}
      <View style={[
        styles.centerLabel,
        { width: CENTER_R * 2, height: CENTER_R * 2, borderRadius: CENTER_R },
      ]}>
        <Text style={styles.moonSymbol}>☽</Text>
        <Text style={styles.nakName} numberOfLines={2}>{chart.nakshatra}</Text>
        <Text style={styles.pada}>Pada {chart.nakshatraPada}</Text>
      </View>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={[styles.dot, { backgroundColor: currentColor }]} />
        <Text style={styles.infoText}>
          Moon in {chart.nakshatra}  ·  {chart.nakshatraLord} lord
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: 8 },
  centerLabel: {
    position: 'absolute',
    top: SIZE / 2 - SIZE * 0.12,
    left: SIZE / 2 - SIZE * 0.12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  moonSymbol: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  nakName: {
    fontFamily: Fonts.heading,
    fontSize: 9,
    color: '#C9A84C',
    textAlign: 'center',
    lineHeight: 13,
  },
  pada: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(13,13,43,0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  infoText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
})
  
