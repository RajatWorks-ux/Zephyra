// src/navigation/RootNavigator.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Decision tree (in order):
//
//  Loading          → spinner
//  No API keys      → SetupApiNavigator   (new user, first ever launch)
//  Password recovery→ AuthNavigator
//  Not signed in    → AuthNavigator       (splash → sign-in)
//  Signed in but
//    keys missing   → NewDeviceScreen     (existing user, new device / reinstall)
//  No birth profile → SetupNavigator
//  Fully set up     → MainNavigator
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import { useSetupStore } from '../store/setupStore'
import { AuthNavigator } from './AuthNavigator'
import { SetupNavigator } from './SetupNavigator'
import { MainNavigator } from './MainNavigator'
import { SetupApiNavigator } from './SetupApiNavigator'
import { NewDeviceApiSetupScreen } from '../screens/onboarding/NewDeviceApiSetupScreen'
import { Colors } from '../constants/colors'

const Stack = createNativeStackNavigator()

export function RootNavigator() {
  const {
    session, birthProfile,
    isLoading, isInitialized, isPasswordRecovery,
    initialize,
  } = useAuthStore()

  const {
    isSetupComplete, groqKey1Valid,
    isInitialized: setupInitialized,
    initialize: initSetup,
  } = useSetupStore()

  useEffect(() => {
    initSetup()
    initialize()
  }, [])

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading || !isInitialized || !setupInitialized) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.starGold} size="large" />
      </View>
    )
  }

  // ── 1. Brand-new install — no API keys ever entered ───────────────────────
  if (!isSetupComplete) return <SetupApiNavigator />

  // ── 2. Password recovery deep-link ────────────────────────────────────────
  if (isPasswordRecovery) return <AuthNavigator />

  // ── 3. Not signed in ──────────────────────────────────────────────────────
  if (!session) return <AuthNavigator />

  // ── 4. Signed-in but keys are gone (new device / reinstall) ───────────────
  //    groqKey1Valid is false when SecureStore lost the key (e.g. reinstall).
  //    We show NewDeviceApiSetupScreen so they can re-enter their keys.
  //    This screen only appears for users who already have an account (session
  //    exists) so new users never reach it.
  if (!groqKey1Valid) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="NewDeviceSetup" component={NewDeviceApiSetupScreen} />
      </Stack.Navigator>
    )
  }

  // ── 5. Signed in but birth details not filled in yet ──────────────────────
  if (!birthProfile) return <SetupNavigator />

  // ── 6. Fully set up ───────────────────────────────────────────────────────
  return <MainNavigator />
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
