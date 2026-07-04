// src/components/admin/RetentionGraph.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Polyline, Line, Text as SvgText, Circle } from 'react-native-svg'
import { BlurView } from 'expo-blur'
import { Fonts } from '../../constants/fonts'

interface Props { data?: number[] }

const LABELS = ['D1','D3','D7','D14','D30']
const DEFAULT = [100, 72, 58, 44, 31]

export function RetentionGraph({ data = DEFAULT }: Props) {
  const W = 280, H = 120
  const pad = { l: 30, r: 10, t: 10, b: 24 }
  const cW = W - pad.l - pad.r
  const cH = H - pad.t - pad.b
  const xStep = cW / (LABELS.length - 1)
  const points = data.map((v, i) => `${pad.l + i * xStep},${pad.t + cH - (v / 100) * cH}`).join(' ')

  return (
    <BlurView intensity={15} tint="dark" style={st.card}>
      <Text style={st.title}>User Retention</Text>
      <Svg width={W} height={H}>
        {/* Grid lines */}
        {[0,25,50,75,100].map(v => {
          const y = pad.t + cH - (v / 100) * cH
          return <Line key={v} x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
        })}
        {/* Polyline */}
        <Polyline points={points} fill="none" stroke="#C9A84C" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {data.map((v, i) => {
          const x = pad.l + i * xStep
          const y = pad.t + cH - (v / 100) * cH
          return (
            <React.Fragment key={i}>
              <Circle cx={x} cy={y} r={4} fill="#C9A84C" />
              <SvgText x={x} y={y - 8} textAnchor="middle" fontSize={9} fill="#C9A84C" fontWeight="600">{v}%</SvgText>
              <SvgText x={x} y={H - 6} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.35)">{LABELS[i]}</SvgText>
            </React.Fragment>
          )
        })}
      </Svg>
    </BlurView>
  )
}

const st = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(123,47,190,0.3)', overflow: 'hidden' },
  title: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 12, color: '#C9A84C', marginBottom: 12 },
})
