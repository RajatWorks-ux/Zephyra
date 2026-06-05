import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  Animated, PanResponder,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg'
import { Fonts } from '../../constants/fonts'
import type { VedicChart, VedicGraha } from '../../types'
import { ChartOracleModal } from './shared/ChartOracleModal'
import { useSettingsStore } from '../../store/settingsStore'

const { width } = Dimensions.get('window')
const CHART_SIZE = Math.min(width - 32, 364)

// ─── Vedic Constants ──────────────────────────────────────────────────────────
const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrishchika',
  'Dhanu', 'Makara', 'Kumbha', 'Meena',
]
const RASHI_SYMBOL = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓']

export const RASHI_SHORT = [
  'Mes', 'Vri', 'Mit', 'Kar',
  'Sin', 'Kan', 'Tul', 'Vsc',
  'Dha', 'Mak', 'Kum', 'Mee',
]

const GRAHA_INFO: Record<string, { abbr: string; color: string; fullName: string; glyph: string }> = {
  Surya:   { abbr: 'Su', color: '#FF9500', fullName: 'Surya (Sun)', glyph: '☀' },
  Chandra: { abbr: 'Mo', color: '#C0C8FF', fullName: 'Chandra (Moon)', glyph: '☽' },
  Mangal:  { abbr: 'Ma', color: '#FF3B3B', fullName: 'Mangal (Mars)', glyph: '♂' },
  Budh:    { abbr: 'Me', color: '#00C060', fullName: 'Budha (Mercury)', glyph: '☿' },
  Guru:    { abbr: 'Ju', color: '#FFD700', fullName: 'Guru (Jupiter)', glyph: '♃' },
  Shukra:  { abbr: 'Ve', color: '#FF80AA', fullName: 'Shukra (Venus)', glyph: '♀' },
  Shani:   { abbr: 'Sa', color: '#8BA0C0', fullName: 'Shani (Saturn)', glyph: '♄' },
  Rahu:    { abbr: 'Ra', color: '#9090BB', fullName: 'Rahu (North Node)', glyph: '☊' },
  Ketu:    { abbr: 'Ke', color: '#B87840', fullName: 'Ketu (South Node)', glyph: '☋' },
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

// ─── Utility ──────────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number) {
  let r = 255, g = 255, b = 255
  if (hex.startsWith('#') && hex.length >= 7) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GridPlanet {
  name: string
  abbr: string
  color: string
  glyph: string
  isRetrograde?: boolean
  isExalted?: boolean
  isDebilitated?: boolean
  isTransit?: boolean
}

export interface GridCellData {
  rashiIdx: number
  houseNum: number
  isLagna: boolean
  isKendra: boolean
  isTrikona: boolean
  planets: GridPlanet[]
}

// ─── Single Cell ──────────────────────────────────────────────────────────────
function GridCell({ cell, size, onPress }: { cell: GridCellData, size: number, onPress?: (cell: GridCellData) => void }) {
  const pressAnim = useRef(new Animated.Value(1)).current
  const lagnaPulse = useRef(new Animated.Value(8)).current

  useEffect(() => {
    if (cell.isLagna) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(lagnaPulse, { toValue: 20, duration: 2000, useNativeDriver: false }),
          Animated.timing(lagnaPulse, { toValue: 8, duration: 2000, useNativeDriver: false }),
        ])
      ).start()
    }
  }, [cell.isLagna])

  const isEmpty = cell.planets.length === 0

  let gradColors: readonly [string, string] = ['rgba(13,13,43,0.95)', 'rgba(5,5,20,0.98)']
  let borderColor = 'rgba(255,255,255,0.05)'

  if (cell.isLagna) {
    gradColors = ['rgba(60,35,10,0.98)', 'rgba(25,12,4,0.99)']
    borderColor = '#C9A84C'
  } else if (!isEmpty) {
    if (cell.isKendra) {
      gradColors = ['rgba(35,15,75,0.95)', 'rgba(15,6,30,0.98)']
      borderColor = 'rgba(123,47,190,0.5)'
    } else if (cell.isTrikona) {
      gradColors = ['rgba(50,30,8,0.9)', 'rgba(18,10,3,0.97)']
      borderColor = 'rgba(201,168,76,0.35)'
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => Animated.spring(pressAnim, { toValue: 0.93, useNativeDriver: true, speed: 30 }).start()}
        onPressOut={() => Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start()}
        onPress={() => {
          if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onPress(cell)
          }
        }}
        style={[gc.cell, { width: size, height: size, borderColor, borderWidth: cell.isLagna ? 1.5 : 1 }]}
      >
        <LinearGradient colors={gradColors} style={StyleSheet.absoluteFillObject} />

        {cell.isLagna && (
          <Animated.View style={[StyleSheet.absoluteFillObject, { shadowColor: '#C9A84C', shadowRadius: lagnaPulse, shadowOpacity: 1 }]} pointerEvents="none" />
        )}

        {/* Empty House Watermark */}
        {isEmpty && !cell.isLagna && (
          <Text style={gc.watermark}>{RASHI_SYMBOL[cell.rashiIdx]}</Text>
        )}

        {/* Top-Left Lagna Mark */}
        {cell.isLagna && <Text style={gc.lagnaMark}>As</Text>}

        {/* Bottom-Right Kendra/Trikona Marks */}
        {!cell.isLagna && cell.isKendra && !isEmpty && <Text style={[gc.cornerMark, { color: '#7B2FBE' }]}>◆</Text>}
        {!cell.isLagna && cell.isTrikona && !isEmpty && <Text style={[gc.cornerMark, { color: '#BEA02F' }]}>△</Text>}

        <Text style={[gc.houseNum, { color: cell.isLagna ? '#C9A84C' : 'rgba(255,255,255,0.25)' }]}>
          {cell.houseNum}
        </Text>

        <View style={gc.planetsStack}>
          {cell.planets.map((p, i) => {
            const bg = hexToRgba(p.color, 0.15)
            const border = hexToRgba(p.color, 0.5)
            return (
              <View
                key={i}
                style={[
                  gc.planetChip,
                  { backgroundColor: bg, borderColor: p.isDebilitated ? '#FF4444' : border, borderStyle: p.isDebilitated ? 'dotted' : 'solid' },
                  p.isExalted && { shadowColor: p.color, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 }
                ]}
              >
                <Text style={{ fontSize: 12, color: p.color, textAlign: 'center' }}>{p.glyph}</Text>
                {p.isRetrograde && <Text style={gc.retrogradeText}>ℝ</Text>}
              </View>
            )
          })}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Center Mandala ───────────────────────────────────────────────────────────
function CenterMandala({ size, yogas }: { size: number; yogas: string[] }) {
  const yogaString = yogas.length > 0 ? yogas.join('  •  ').toUpperCase() : 'NO MAJOR YOGAS DETECTED'
  const center = size / 2

  return (
    <View style={[cm.wrap, { width: size, height: size }]}>
      <LinearGradient colors={['rgba(20,10,30,0.98)', 'rgba(5,5,15,0.99)']} style={StyleSheet.absoluteFillObject} />
      
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Defs>
           {/* Circular path for the text to follow */}
          <Path
            id="yogaPath"
            d={`M ${size * 0.1}, ${center} a ${size * 0.4},${size * 0.4} 0 1,1 ${size * 0.8},0 a ${size * 0.4},${size * 0.4} 0 1,1 -${size * 0.8},0`}
          />
        </Defs>
        <Circle cx={center} cy={center} r={size * 0.45} stroke="rgba(201,168,76,0.15)" strokeWidth={1} fill="none" />
        <Circle cx={center} cy={center} r={size * 0.35} stroke="rgba(123,47,190,0.12)" strokeWidth={1} fill="none" />
        <Circle cx={center} cy={center} r={size * 0.25} stroke="rgba(47,190,190,0.08)" strokeWidth={1} fill="none" />
        
        <SvgText fill="rgba(201,168,76,0.5)" fontSize="7" fontFamily="Orbitron_400Regular" letterSpacing="1">
          <TextPath href="#yogaPath" startOffset="50%" textAnchor="middle">
            {yogaString}
          </TextPath>
        </SvgText>
      </Svg>

      <View style={cm.content}>
        <Text style={cm.symbol}>✦</Text>
        <Text style={cm.appName}>ZEPHYRA</Text>
        <Text style={cm.subText}>Vedic Kundali</Text>
      </View>
    </View>
  )
}

// ─── Kundli Grid ──────────────────────────────────────────────────────────────
function KundliGrid({ cells, chartSize, centerContent, onCellPress }: { cells: GridCellData[], chartSize: number, centerContent: React.ReactNode, onCellPress: (c: GridCellData) => void }) {
  const CELL = chartSize / 4
  const CENTER_SIZE = CELL * 2

  const byRashi = useMemo(() => {
    const map: Record<number, GridCellData> = {}
    cells.forEach(c => { map[c.rashiIdx] = c })
    return map
  }, [cells])

  const renderCell = (idx: number) => {
    const cell = byRashi[idx]
    if (!cell) return <View key={idx} style={{ width: CELL, height: CELL }} />
    return <GridCell key={idx} cell={cell} size={CELL} onPress={onCellPress} />
  }

  return (
    <View style={[grid.container, { width: chartSize, height: chartSize }]}>
      <View style={grid.row}>{[11, 0, 1, 2].map(renderCell)}</View>
      <View style={grid.row}>
        {renderCell(10)}
        <View style={{ width: CENTER_SIZE, height: CELL }}>{centerContent}</View>
        {renderCell(3)}
      </View>
      <View style={grid.row}>
        {renderCell(9)}
        <View style={{ width: CENTER_SIZE, height: CELL }} />
        {renderCell(4)}
      </View>
      <View style={grid.row}>{[8, 7, 6, 5].map(renderCell)}</View>
    </View>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function SouthIndianKundli({ chart }: { chart: VedicChart }) {
  const { selectedLanguage } = useSettingsStore()

  // ── Oracle modal state ────────────────────────────────────────────────────
  const [oracleVisible, setOracleVisible] = useState(false)
  const [oraclePayload, setOraclePayload] = useState<{
    title: string
    subtitle: string
    symbol: string
    symbolColor: string
    contextData: string
  } | null>(null)

  // ── Mount animation (fade + rise 20px) ────────────────────────────────────
  const mountAnim = useRef(new Animated.Value(0)).current

  // Animations
  const rotXAnim = useRef(new Animated.Value(0)).current
  const rotYAnim = useRef(new Animated.Value(0)).current
  const tiltMagnitude = useRef(new Animated.Value(0)).current
  const haloRotAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Entry: fade in + rise 20px
    Animated.timing(mountAnim, {
      toValue: 1,
      duration: 620,
      useNativeDriver: true,
    }).start()

    Animated.loop(
      Animated.timing(haloRotAnim, { toValue: 1, duration: 8000, useNativeDriver: true })
    ).start()
  }, [])

  const mountOpacity = mountAnim
  const mountTranslateY = mountAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] })

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only grab if it's clearly a drag (>4px movement), never a tap
        return Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4
      },
      onPanResponderMove: (_, gs) => {
        rotXAnim.setValue(-gs.dy / 12)
        rotYAnim.setValue(gs.dx / 12)
        tiltMagnitude.setValue(Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy))
      },
      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(rotXAnim, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: false }),
          Animated.spring(rotYAnim, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: false }),
          Animated.spring(tiltMagnitude, { toValue: 0, damping: 14, stiffness: 120, useNativeDriver: false }),
        ]).start()
      },
    })
  ).current

  const rotXStr = rotXAnim.interpolate({ inputRange: [-25, 25], outputRange: ['-25deg', '25deg'] })
  const rotYStr = rotYAnim.interpolate({ inputRange: [-25, 25], outputRange: ['-25deg', '25deg'] })
  const shadowOpacity = tiltMagnitude.interpolate({ inputRange: [0, 50], outputRange: [0.15, 0.5], extrapolate: 'clamp' })
  const specularLeft = rotYAnim.interpolate({ inputRange: [-25, 25], outputRange: ['-10%', '110%'] })
  const haloRotation = haloRotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

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
        name: g.name,
        abbr: gi?.abbr ?? g.name.substring(0, 2),
        color: gi?.color ?? '#FFF',
        glyph: gi?.glyph ?? '●',
        isRetrograde: g.isRetrograde,
        isExalted: g.isExalted,
        isDebilitated: g.isDebilitated,
      }
    })
    return { rashiIdx, houseNum, planets, isLagna, isKendra, isTrikona }
  })

  function handleCellPress(cellData: GridCellData) {
    const vedicGrahas = chart.grahas.filter(g => RASHI_NAMES.indexOf(g.rashi) === cellData.rashiIdx)

    const isDusthana = [6, 8, 12].includes(cellData.houseNum)
    const classification = cellData.isLagna   ? 'Lagna'
      : cellData.isKendra                     ? 'Kendra'
      : cellData.isTrikona                    ? 'Trikona'
      : isDusthana                            ? 'Dusthana'
      : 'Neutral House'

    const planetNames = vedicGrahas.length
      ? vedicGrahas.map(g => {
          const flags = [
            g.isRetrograde  ? 'Retrograde' : '',
            g.isExalted     ? 'Exalted'    : '',
            g.isDebilitated ? 'Debilitated': '',
          ].filter(Boolean).join(', ')
          return flags ? `${g.name} (${flags})` : g.name
        }).join(', ')
      : 'None'

    const activeYogas = chart.yogas.length ? chart.yogas.join(', ') : 'None'
    const rashiName   = RASHI_NAMES[cellData.rashiIdx]

    const contextData = [
      `House ${cellData.houseNum} — ${rashiName}`,
      `Classification: ${classification}`,
      `Planets: ${planetNames}`,
      `Lagna: ${chart.lagna}`,
      `Yogas active: ${activeYogas}`,
    ].join(' — ')

    // Symbol and accent colour reflect the house classification
    const symbolColor = cellData.isLagna   ? '#C9A84C'
      : cellData.isKendra                  ? '#7B2FBE'
      : cellData.isTrikona                 ? '#BEA02F'
      : isDusthana                         ? '#FF6B6B'
      : 'rgba(255,255,255,0.5)'

    setOraclePayload({
      title:       `House ${cellData.houseNum} — ${rashiName}`,
      subtitle:    `${classification} · Birth Chart`,
      symbol:      RASHI_SYMBOL[cellData.rashiIdx],
      symbolColor,
      contextData,
    })
    setOracleVisible(true)
  }

  return (
  <>
    <Animated.View style={{ opacity: mountOpacity, transform: [{ translateY: mountTranslateY }] }}>
      <BlurView intensity={35} tint="dark" style={styles.glassShell}>
      <Animated.View
        style={[
          styles.shadowWrap,
          {
            shadowOpacity,
            transform: [
              { perspective: 1400 },
              { scale: 1.015 },
              { rotateX: rotXStr },
              { rotateY: rotYStr },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Specular highlight stripe at rest top edge */}
        <Animated.View style={[styles.specularHighlight, { left: specularLeft }]} />

        {/* Outer Cosmic Frame (2px breathing ring) */}
        <View style={styles.haloWrap}>
          <Animated.View style={[styles.haloContainer, { transform: [{ rotate: haloRotation }] }]}>
            <LinearGradient
              colors={['#C9A84C', '#7B2FBE', '#2FBEBE', '#C9A84C']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.haloInnerMask} />
          </Animated.View>
        </View>

        <KundliGrid
          cells={cells}
          chartSize={CHART_SIZE}
          centerContent={<CenterMandala size={CHART_SIZE / 2} yogas={chart.yogas} />}
          onCellPress={handleCellPress}
        />
      </Animated.View>

      <Text style={styles.dragHint}>Drag to tilt in space · Tap any house for its cosmic reading</Text>

      </BlurView>
    </Animated.View>

    {oraclePayload && (
      <ChartOracleModal
        visible={oracleVisible}
        onClose={() => setOracleVisible(false)}
        title={oraclePayload.title}
        subtitle={oraclePayload.subtitle}
        symbol={oraclePayload.symbol}
        symbolColor={oraclePayload.symbolColor}
        contextData={oraclePayload.contextData}
        language={selectedLanguage}
        accentColor={oraclePayload.symbolColor}
      />
    )}
  </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  glassShell: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
  },
  wrapper: { alignItems: 'center', paddingVertical: 16 },
  shadowWrap: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 32,
    elevation: 20,
    borderRadius: 4,
    backgroundColor: '#050514', // Base backdrop behind chart
  },
  specularHighlight: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 2,
    backgroundColor: '#FFFFFF',
    opacity: 0.1,
    zIndex: 10,
  },
  haloWrap: {
    position: 'absolute',
    width: CHART_SIZE + 16,
    height: CHART_SIZE + 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  haloContainer: {
    width: CHART_SIZE + 16,
    height: CHART_SIZE + 16,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  haloInnerMask: {
    width: CHART_SIZE + 12,
    height: CHART_SIZE + 12,
    backgroundColor: '#050514', // Matches screen dark bg to mask gradient into a 2px ring
    borderRadius: 6,
  },
  dragHint: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 24,
    letterSpacing: 0.3,
  },
})

const gc = StyleSheet.create({
  cell: {
    overflow: 'hidden',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  lagnaMark: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontFamily: 'CinzelDecorative', // Expecting this font loaded
    fontSize: 8,
    color: '#C9A84C',
    opacity: 0.9,
  },
  cornerMark: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    fontFamily: 'Orbitron_400Regular',
    fontSize: 7,
  },
  watermark: {
    position: 'absolute',
    fontSize: 28,
    color: 'rgba(255,255,255,0.04)',
    top: '50%',
    transform: [{ translateY: -16 }],
  },
  houseNum: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 2,
  },
  planetsStack: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  planetChip: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  retrogradeText: {
    position: 'absolute',
    top: -1,
    right: 0,
    fontSize: 6,
    color: '#E8E8FF',
    fontFamily: Fonts.accentBold,
  }
})

const cm = StyleSheet.create({
  wrap: { position: 'relative', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  content: { alignItems: 'center', zIndex: 2, pointerEvents: 'none' },
  symbol: { fontSize: 16, color: '#C9A84C', marginBottom: 4 },
  appName: { fontFamily: Fonts.heading, fontSize: 10, color: '#C9A84C', letterSpacing: 3 },
  subText: { fontFamily: Fonts.accent, fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginTop: 4 },
})

const grid = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: 6, zIndex: 5 },
  row: { flexDirection: 'row' },
})

// (dm StyleSheet removed — fake local modal replaced by shared/ChartOracleModal)
