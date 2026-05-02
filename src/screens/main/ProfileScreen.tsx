import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Videos } from '../../constants/videos'
import { Fonts } from '../../constants/fonts'
import { useAuthStore } from '../../store/authStore'
import { useReadingStore } from '../../store/readingStore'

export function ProfileScreen() {
  const { profile, birthProfile, signOut } = useAuthStore()
  const { chartData } = useReadingStore()

  function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <View style={styles.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject} resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.85)']} style={StyleSheet.absoluteFillObject} />

      <View style={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <LinearGradient colors={['#C9A84C', '#7C3AED']} style={styles.avatarGrad} />
          <Text style={styles.avatarLetter}>{(profile?.display_name || 'S')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile?.display_name || 'Seeker'}</Text>
        {chartData && (
          <Text style={styles.identity}>
            {chartData.western.sunSign} Sun · {chartData.western.moonSign} Moon · {chartData.western.ascendant} Rising
          </Text>
        )}

        {/* Birth details card */}
        {birthProfile && (
          <BlurView intensity={15} tint="dark" style={styles.card}>
            <Text style={styles.cardLabel}>Birth Details</Text>
            <Text style={styles.cardValue}>{birthProfile.birth_date}</Text>
            <Text style={styles.cardValue}>{birthProfile.birth_city}, {birthProfile.birth_country}</Text>
            {birthProfile.birth_time_known && (
              <Text style={styles.cardValue}>{birthProfile.birth_time}</Text>
            )}
          </BlurView>
        )}

        <Text style={styles.phaseNote}>
          Full profile editing, notification settings, appearance themes, and data management are coming in Phase 5.
        </Text>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  container: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 100 },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
  },
  avatarGrad: StyleSheet.absoluteFillObject,
  avatarLetter: { position: 'absolute', fontFamily: Fonts.heading, fontSize: 36, color: '#05050F', zIndex: 1 },
  name: { fontFamily: Fonts.heading, fontSize: 22, color: '#C9A84C', marginBottom: 8 },
  identity: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 28, textAlign: 'center', lineHeight: 20 },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    padding: 22,
    gap: 6,
    marginBottom: 24,
  },
  cardLabel: { fontFamily: Fonts.accent, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  cardValue: { fontFamily: Fonts.bodySemiBold, fontSize: 14, color: '#C9A84C' },
  phaseNote: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: 32 },
  signOutBtn: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.3)',
  },
  signOutText: { fontFamily: Fonts.accent, fontSize: 12, color: '#FF4444', letterSpacing: 1 },
})
