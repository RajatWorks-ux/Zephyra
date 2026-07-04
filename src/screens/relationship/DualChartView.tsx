// src/components/relationship/DualChartView.tsx
import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { Fonts } from '../../constants/fonts'
import type { VedicChart } from '../../types'

const { width } = Dimensions.get('window')
const CHART_W = (width - 48) / 2

interface Props {
  chart1: VedicChart
  chart2: VedicChart
  name1: string
  name2: string
}

const RASHI_ABBREV: Record<string, string> = {
  Aries:'Ar', Taurus:'Ta', Gemini:'Ge', Cancer:'Ca',
  Leo:'Le', Virgo:'Vi', Libra:'Li', Scorpio:'Sc',
  Sagittarius:'Sg', Capricorn:'Cp', Aquarius:'Aq', Pisces:'Pi',
}

function MiniChartGrid({ chart, color }: { chart: VedicChart; color: string }) {
  const houses = chart.houses || Array(12).fill('Aries')
  // South Indian: fixed house grid 3×4
  const layout = [
    [11,0,1,2],
    [10,-1,-1,3],
    [9,-1,-1,4],
    [8,7,6,5],
  ]
  const cellSize = CHART_W / 4

  return (
    <View style={{ width: CHART_W, height: CHART_W * 1.1 }}>
      {layout.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((houseIdx, ci) => {
            if (houseIdx === -1) {
              return (
                <View key={ci} style={[gridSt.cell, { width: cellSize, height: cellSize * 1.1, borderColor: 'rgba(255,255,255,0.04)' }]} />
              )
            }
            const rashi = houses[houseIdx] || 'Aries'
            const planets = chart.grahas?.filter(g => g.house === houseIdx + 1) || []
            return (
              <View key={ci} style={[gridSt.cell, { width: cellSize, height: cellSize * 1.1 }]}>
                <Text style={[gridSt.hNum, { color }]}>{houseIdx + 1}</Text>
                <Text style={gridSt.rashi}>{RASHI_ABBREV[rashi] || rashi.slice(0,2)}</Text>
                {planets.slice(0, 2).map(p => (
                  <Text key={p.name} style={[gridSt.planet, { color }]}>{p.name.slice(0,2)}</Text>
                ))}
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

export function DualChartView({ chart1, chart2, name1, name2 }: Props) {
  return (
    <View style={st.container}>
      <BlurView intensity={12} tint="dark" style={[st.chartCard, { marginRight: 8 }]}>
        <Text style={[st.chartName, { color: '#C9A84C' }]} numberOfLines={1}>{name1}</Text>
        <MiniChartGrid chart={chart1} color="#C9A84C" />
      </BlurView>
      <BlurView intensity={12} tint="dark" style={st.chartCard}>
        <Text style={[st.chartName, { color: '#2FBEBE' }]} numberOfLines={1}>{name2}</Text>
        <MiniChartGrid chart={chart2} color="#2FBEBE" />
      </BlurView>
    </View>
  )
}

const st = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: 16 },
  chartCard: { flex: 1, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  chartName: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 10, marginBottom: 8, textAlign: 'center' },
})
const gridSt = StyleSheet.create({
  cell: { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', padding: 2, gap: 1 },
  hNum: { fontSize: 7, fontFamily: 'Inter_600SemiBold', opacity: 0.5 },
  rashi: { fontSize: 7, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.4)' },
  planet: { fontSize: 7, fontFamily: 'Inter_600SemiBold' },
})
