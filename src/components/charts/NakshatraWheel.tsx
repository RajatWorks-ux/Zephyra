import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import {
  Canvas, Path, Skia, Group, Circle, Paint,
  RadialGradient, BlurMask, vec,
} from '@shopify/react-native-skia'
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

function makeArcPath(
  cx: number, cy: number, r1: number, r2: number,
  startDeg: number, endDeg: number
): ReturnType<typeof Skia.Path.Make> {
  const path = Skia.Path.Make()
  const s1 = (startDeg - 90) * DEG_TO_RAD
  const e1 = (endDeg - 90) * DEG_TO_RAD
  const cosSt = Math.cos(s1), sinSt = Math.sin(s1)
  const cosEn = Math.cos(e1), sinEn = Math.sin(e1)

  path.moveTo(cx + r1 * cosSt, cy + r1 * sinSt)
  path.arcToOval(
    { x: cx - r1, y: cy - r1, width: r1 * 2, height: r1 * 2 },
    startDeg - 90, endDeg - startDeg, false
  )
  path.lineTo(cx + r2 * cosEn, cy + r2 * sinEn)
  path.arcToOval(
    { x: cx - r2, y: cy - r2, width: r2 * 2, height: r2 * 2 },
    endDeg - 90, -(endDeg - startDeg), false
  )
  path.close()
  return path
}

export function NakshatraWheel({ chart }: { chart: VedicChart }) {
  const currentNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra)

  return (
    <View style={styles.wrapper}>
      <Canvas style={{ width: SIZE, height: SIZE }}>
        {/* Background circle */}
        <Circle cx={CX} cy={CY} r={OUTER_R + 2}>
          <Paint color="rgba(5,5,20,0.95)" />
        </Circle>

        {/* 27 Nakshatra segments */}
        {NAKSHATRAS.map((nak, i) => {
          const startDeg = i * SPAN
          const endDeg = startDeg + SPAN - 0.5
          const isCurrent = i === currentNakIdx
          const path = makeArcPath(CX, CY, INNER_R, OUTER_R, startDeg, endDeg)

          return (
            <Group key={nak.name}>
              <Path path={path}>
                <Paint color={isCurrent ? nak.color : nak.color + '30'} style="fill" />
                {isCurrent && <BlurMask blur={6} style="outer" respectCTM />}
              </Path>
              <Path path={path}>
                <Paint
                  color={isCurrent ? nak.color + 'CC' : 'rgba(255,255,255,0.05)'}
                  style="stroke"
                  strokeWidth={isCurrent ? 2 : 0.5}
                />
              </Path>
            </Group>
          )
        })}

        {/* Inner dark fill */}
        <Circle cx={CX} cy={CY} r={INNER_R - 1}>
          <Paint color="rgba(5,5,20,0.98)" />
        </Circle>

        {/* Outer glow ring for current nakshatra */}
        {currentNakIdx >= 0 && (
          <Circle cx={CX} cy={CY} r={OUTER_R + 8} style="stroke">
            <Paint
              color={NAKSHATRAS[currentNakIdx].color + '30'}
              strokeWidth={6}
            />
            <BlurMask blur={8} style="normal" respectCTM />
          </Circle>
        )}

        {/* Center decoration */}
        <Circle cx={CX} cy={CY} r={CENTER_R}>
          <Paint>
            <RadialGradient
              c={vec(CX, CY)}
              r={CENTER_R}
              colors={['rgba(50,25,100,0.95)', 'rgba(10,5,25,0.99)']}
            />
          </Paint>
        </Circle>
        <Circle cx={CX} cy={CY} r={CENTER_R} style="stroke">
          <Paint color="rgba(201,168,76,0.4)" strokeWidth={1} />
        </Circle>
      </Canvas>

      {/* Center label overlay */}
      <View style={[styles.centerLabel, { width: CENTER_R * 2, height: CENTER_R * 2, borderRadius: CENTER_R }]}>
        <Text style={styles.moonSymbol}>☽</Text>
        <Text style={styles.nakName} numberOfLines={2}>{chart.nakshatra}</Text>
        <Text style={styles.pada}>Pada {chart.nakshatraPada}</Text>
      </View>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={[styles.dot, { backgroundColor: NAKSHATRAS[Math.max(0, currentNakIdx)].color }]} />
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
