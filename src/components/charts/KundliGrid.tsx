import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated as RNAnimated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'

// ─── Public types ─────────────────────────────────────────────────────────────
export interface GridPlanet {
  abbr: string
  color: string
  isRetrograde?: boolean
  isExalted?: boolean
  isDebilitated?: boolean
  isTransit?: boolean     // cyan overlay for GocharChart
  name?: string           // full planet name used by GocharChart
  glyph?: string          // Unicode glyph used by GocharChart (☀ ☽ ♂ …)
}

export interface GridCellData {
  rashiIdx: number
  houseNum: number
  isLagna: boolean
  isKendra: boolean
  isTrikona: boolean
  planets: GridPlanet[]
  // Optional fields used by GocharChart for dual natal/transit display
  rashiName?: string
  natalPlanets?: GridPlanet[]
  transitPlanets?: GridPlanet[]
}

export const RASHI_SHORT = [
  'Mes', 'Vri', 'Mit', 'Kar',
  'Sin', 'Kan', 'Tul', 'Vsc',
  'Dha', 'Mak', 'Kum', 'Mee',
]

// South Indian fixed layout: rashiIdx → [row, col]
export const RASHI_TO_CELL: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 3],
  [2, 3], [3, 3], [3, 2], [3, 1],
  [3, 0], [2, 0], [1, 0], [0, 0],
]

// ─── Single cell ──────────────────────────────────────────────────────────────
function GridCell({
  cell,
  size,
  onPress,
}: {
  cell: GridCellData
  size: number
  onPress?: (cell: GridCellData) => void
}) {
  const pressAnim = React.useRef(new RNAnimated.Value(1)).current

  const borderColor = cell.isLagna
    ? 'rgba(201,168,76,0.9)'
    : cell.isKendra
    ? 'rgba(124,58,237,0.5)'
    : cell.isTrikona
    ? 'rgba(201,168,76,0.4)'
    : 'rgba(255,255,255,0.08)'

  const gradColors: [string, string] = cell.isLagna
    ? ['rgba(60,40,10,0.95)', 'rgba(20,10,5,0.98)']
    : cell.isKendra
    ? ['rgba(30,15,55,0.95)', 'rgba(10,5,25,0.98)']
    : ['rgba(13,13,43,0.95)', 'rgba(5,5,20,0.98)']

  function handlePressIn() {
    if (!onPress) return
    RNAnimated.spring(pressAnim, { toValue: 0.93, useNativeDriver: true, speed: 30 }).start()
  }
  function handlePressOut() {
    RNAnimated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start()
  }

  const natalPlanets = cell.planets.filter(p => !p.isTransit)
  const transitPlanets = cell.planets.filter(p => p.isTransit)

  return (
    <RNAnimated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        onPress={() => {
          if (!onPress) return
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onPress(cell)
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[gc.cell, { width: size, height: size, borderColor }]}
      >
        <LinearGradient colors={gradColors} style={StyleSheet.absoluteFillObject} />
        <View style={gc.lightEdgeTop} />
        <View style={gc.lightEdgeLeft} />

        <Text style={[gc.houseNum, { color: cell.isLagna ? '#C9A84C' : 'rgba(255,255,255,0.25)' }]}>
          {cell.houseNum}
        </Text>
        <Text style={gc.rashiName}>{RASHI_SHORT[cell.rashiIdx]}</Text>

        {/* Natal planets */}
        <View style={gc.planetsWrap}>
          {natalPlanets.map((p, i) => (
            <Text
              key={`n-${i}`}
              style={[
                gc.planet,
                { color: p.color },
                p.isExalted && gc.planetExalted,
                p.isDebilitated && gc.planetDebilitated,
              ]}
            >
              {p.abbr}{p.isRetrograde ? 'R' : ''}{p.isExalted ? '*' : ''}
            </Text>
          ))}
        </View>

        {/* Transit planets in cyan */}
        {transitPlanets.length > 0 && (
          <View style={[gc.planetsWrap, gc.transitRow]}>
            {transitPlanets.map((p, i) => (
              <Text key={`t-${i}`} style={gc.transitPlanet}>
                {p.abbr}
              </Text>
            ))}
          </View>
        )}

        {cell.isLagna && <View style={gc.lagnaBar} />}
      </TouchableOpacity>
    </RNAnimated.View>
  )
}

// ─── Center mandala ───────────────────────────────────────────────────────────
export function CenterMandala({ size, yogas }: { size: number; yogas: string[] }) {
  const firstYoga = yogas[0]?.split('(')[0]?.trim() || 'Zephyra'
  return (
    <View style={[cm.wrap, { width: size, height: size }]}>
      <LinearGradient
        colors={['rgba(40,20,80,0.98)', 'rgba(10,5,25,0.99)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[cm.cornerTL, cm.corner]} />
      <View style={[cm.cornerTR, cm.corner]} />
      <View style={[cm.cornerBL, cm.corner]} />
      <View style={[cm.cornerBR, cm.corner]} />
      <View style={cm.content}>
        <Text style={cm.symbol}>✦</Text>
        <Text style={cm.appName}>ZEPHYRA</Text>
        {firstYoga ? <Text style={cm.yogaText} numberOfLines={2}>{firstYoga}</Text> : null}
        <Text style={cm.subText}>Vedic Kundali</Text>
      </View>
      <View style={cm.lineH} />
      <View style={cm.lineV} />
    </View>
  )
}

// ─── Grid renderer ────────────────────────────────────────────────────────────
interface KundliGridProps {
  cells: GridCellData[]          // exactly 12 cells, one per rashiIdx 0-11
  chartSize: number
  centerContent?: React.ReactNode
  onCellPress?: (cell: GridCellData) => void
  // Optional custom cell renderer — when provided, replaces the default GridCell.
  // GocharChart uses this to render its own dual-quadrant natal/transit view.
  renderCell?: (cell: GridCellData, size: number, onPress?: (cell: GridCellData) => void) => React.ReactNode
}

export function KundliGrid({ cells, chartSize, centerContent, onCellPress, renderCell: customRenderCell }: KundliGridProps) {
  const CELL = chartSize / 4
  const CENTER_SIZE = CELL * 2

  // Map rashiIdx → GridCellData for fast lookup
  const byRashi = React.useMemo(() => {
    const map: Record<number, GridCellData> = {}
    cells.forEach(c => { map[c.rashiIdx] = c })
    return map
  }, [cells])

  function renderCell(rashiIdx: number) {
    const cell = byRashi[rashiIdx]
    if (!cell) return <View key={rashiIdx} style={{ width: CELL, height: CELL }} />
    if (customRenderCell) {
      return <React.Fragment key={rashiIdx}>{customRenderCell(cell, CELL, onCellPress)}</React.Fragment>
    }
    return <GridCell key={rashiIdx} cell={cell} size={CELL} onPress={onCellPress} />
  }

  return (
    <View style={[grid.container, { width: chartSize, height: chartSize }]}>
      {/* Row 0 */}
      <View style={grid.row}>
        {[11, 0, 1, 2].map(renderCell)}
      </View>
      {/* Row 1 */}
      <View style={grid.row}>
        {renderCell(10)}
        {centerContent
          ? <View style={{ width: CENTER_SIZE, height: CELL }}>{centerContent}</View>
          : <View style={{ width: CENTER_SIZE, height: CELL }} />}
        {renderCell(3)}
      </View>
      {/* Row 2 */}
      <View style={grid.row}>
        {renderCell(9)}
        <View style={{ width: CENTER_SIZE, height: CELL }} />
        {renderCell(4)}
      </View>
      {/* Row 3 */}
      <View style={grid.row}>
        {[8, 7, 6, 5].map(renderCell)}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const gc = StyleSheet.create({
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
  transitRow: { marginTop: 2 },
  planet: {
    fontFamily: Fonts.accentBold,
    fontSize: 10,
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  transitPlanet: {
    fontFamily: Fonts.accentBold,
    fontSize: 9,
    color: '#00DFDF',
    letterSpacing: 0.3,
    lineHeight: 13,
  },
  planetExalted: {
    textShadowColor: '#FFD700',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 0 },
  },
  planetDebilitated: { opacity: 0.6 },
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

const grid = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: 4 },
  row: { flexDirection: 'row' },
})
