// src/components/relationship/PersonCard.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Fonts } from '../../constants/fonts'
import type { RelationshipProfile, VedicChart } from '../../types'

interface Props {
  name: string
  chart?: VedicChart | null
  isUser?: boolean
  size?: 'sm' | 'md'
}

export function PersonCard({ name, chart, isUser, size = 'md' }: Props) {
  const avatarSize = size === 'sm' ? 44 : 64
  const fontSize = size === 'sm' ? 13 : 15
  const colors: [string, string] = isUser ? ['#7B2FBE', '#C9A84C'] : ['#2FBEBE', '#7B2FBE']

  return (
    <View style={st.wrap}>
      <View style={[st.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
        <LinearGradient colors={colors} style={StyleSheet.absoluteFillObject} />
        <Text style={[st.letter, { fontSize: avatarSize * 0.38 }]}>{(name || '?')[0].toUpperCase()}</Text>
      </View>
      <Text style={[st.name, { fontSize }]}>{name}</Text>
      {chart && (
        <Text style={st.sub}>{chart.lagna} · {chart.nakshatra}</Text>
      )}
      {isUser && <Text style={st.you}>You</Text>}
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  letter: { color: '#fff', fontFamily: 'CinzelDecorative_400Regular', position: 'absolute' },
  name: { fontFamily: 'CinzelDecorative_400Regular', color: '#C9A84C', textAlign: 'center' },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  you: { fontFamily: 'Inter_400Regular', fontSize: 9, color: '#7B2FBE', letterSpacing: 1 },
})
