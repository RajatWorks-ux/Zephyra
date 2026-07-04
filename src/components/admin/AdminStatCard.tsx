// src/components/admin/AdminStatCard.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Fonts } from '../../constants/fonts'

interface Props { icon: string; value: string | number; label: string; color?: string }

export function AdminStatCard({ icon, value, label, color = '#C9A84C' }: Props) {
  return (
    <View style={st.wrap}>
      <BlurView intensity={20} tint="dark" style={st.card}>
        <LinearGradient colors={['rgba(123,47,190,0.15)', 'rgba(5,5,15,0.3)']} style={StyleSheet.absoluteFillObject} />
        <Text style={st.icon}>{icon}</Text>
        <Text style={[st.value, { color }]}>{value}</Text>
        <Text style={st.label}>{label}</Text>
      </BlurView>
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { flex: 1, minWidth: '45%' },
  card: { borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(123,47,190,0.3)', overflow: 'hidden', gap: 4 },
  icon: { fontSize: 22 },
  value: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 24 },
  label: { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: 0.5 },
})
