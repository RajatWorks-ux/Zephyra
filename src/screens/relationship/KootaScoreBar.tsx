// src/components/relationship/KootaScoreBar.tsx
import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Fonts } from '../../constants/fonts'
import type { KootaScore } from '../../types'

interface KootaRowProps { label: string; value: number; max: number; delay?: number }

function KootaRow({ label, value, max, delay = 0 }: KootaRowProps) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: value / max, duration: 900, delay, useNativeDriver: false }).start()
  }, [value])
  const pct = value / max
  const barColor = pct >= 0.75 ? '#44FF88' : pct >= 0.5 ? '#C9A84C' : pct >= 0.25 ? '#FF9944' : '#FF4444'

  return (
    <View style={st.row}>
      <Text style={st.label}>{label}</Text>
      <View style={st.track}>
        <Animated.View style={[st.fill, { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: barColor }]} />
      </View>
      <Text style={[st.val, { color: barColor }]}>{value}/{max}</Text>
    </View>
  )
}

interface Props { koota: KootaScore }

export function KootaScoreBar({ koota }: Props) {
  const rows: Array<{ label: string; key: keyof KootaScore; max: number }> = [
    { label: 'Nadi', key: 'nadi', max: 8 },
    { label: 'Graha Maitri', key: 'grahaMaitri', max: 5 },
    { label: 'Gana', key: 'gana', max: 6 },
    { label: 'Yoni', key: 'yoni', max: 4 },
    { label: 'Rashi', key: 'rashi', max: 7 },
    { label: 'Tara', key: 'tara', max: 3 },
    { label: 'Vashya', key: 'vashya', max: 2 },
    { label: 'Varna', key: 'varna', max: 1 },
  ]

  return (
    <BlurView intensity={15} tint="dark" style={st.card}>
      <Text style={st.title}>Ashta Koota — {koota.total}/36</Text>
      {rows.map((r, i) => (
        <KootaRow key={r.key} label={r.label} value={koota[r.key] as number} max={r.max} delay={i * 80} />
      ))}
    </BlurView>
  )
}

const st = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', overflow: 'hidden' },
  title: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 13, color: '#C9A84C', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 90 },
  track: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  val: { fontFamily: 'Inter_600SemiBold', fontSize: 10, width: 32, textAlign: 'right' },
})
