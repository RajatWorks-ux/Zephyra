import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { Videos } from '../../constants/videos'
import { Fonts } from '../../constants/fonts'

export function ChatScreen() {
  return (
    <View style={styles.root}>
      <Video source={Videos.signInBg} style={StyleSheet.absoluteFillObject} resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.5)', 'rgba(5,5,15,0.88)']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.center}>
        <Text style={styles.symbol}>◈</Text>
        <Text style={styles.title}>Ask Zephyra</Text>
        <Text style={styles.sub}>The oracle chat with full streaming AI, conversation history, and personalized answers is coming in Phase 4.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  symbol: { fontSize: 48, color: '#2FBEBE', marginBottom: 20 },
  title: { fontFamily: Fonts.heading, fontSize: 22, color: '#C9A84C', marginBottom: 16, textAlign: 'center' },
  sub: { fontFamily: Fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 24 },
})
