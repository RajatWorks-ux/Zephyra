import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { ScreenWrapper } from '../../components/layout/ScreenWrapper'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { useAuthStore } from '../../store/authStore'

export function HomeScreen() {
  const { profile, birthProfile, signOut } = useAuthStore()

  async function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    )
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.appName}>ZEPHYRA</Text>

        <View style={styles.welcomeCard}>
          <Text style={styles.greeting}>
            Welcome, {profile?.display_name || 'Seeker'}
          </Text>
          <Text style={styles.sub}>
            Your cosmic profile has been created successfully.
          </Text>

          {birthProfile && (
            <View style={styles.birthInfo}>
              <Text style={styles.birthLabel}>Your Birth Details</Text>
              <Text style={styles.birthValue}>
                {birthProfile.birth_date}
              </Text>
              <Text style={styles.birthValue}>
                {birthProfile.birth_city}, {birthProfile.birth_country}
              </Text>
              {birthProfile.birth_time_known && (
                <Text style={styles.birthValue}>
                  {birthProfile.birth_time}
                </Text>
              )}
            </View>
          )}

          <Text style={styles.phaseNote}>
            Full dashboard, readings, charts and AI chat are coming in Phase 2.
          </Text>
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },
  appName: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    color: Colors.starGold,
    letterSpacing: 6,
    marginBottom: 32,
  },
  welcomeCard: {
    width: '100%',
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 24,
    gap: 12,
  },
  greeting: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  birthInfo: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 14,
    gap: 6,
  },
  birthLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  birthValue: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: Colors.starGold,
  },
  phaseNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 14,
  },
  signOutButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  signOutText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.marsRed,
  },
})