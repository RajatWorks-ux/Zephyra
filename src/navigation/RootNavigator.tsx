// src/navigation/RootNavigator.tsx
// ─────────────────────────────────────────────────────────────────────────────
// App flow (exactly as specified):
//
//   App opens → Splash (always, every cold start — lives inside AuthNavigator)
//      │
//      ├─ NOT SIGNED IN (covers BOTH a brand-new install AND a returning
//      │  user who isn't logged in — both start at the same place)
//      │     → AuthNavigator: Splash → Onboarding (new installs only,
//      │       gated by a local "have I ever launched" flag) → Sign In
//      │
//      ├─ SIGNED IN, account has never finished setup anywhere
//      │  (no cloud birth profile yet = this really is a brand-new signup)
//      │     → SetupApiNavigator (3-step guided API key wizard)
//      │       → Birth Details → Home
//      │
//      ├─ SIGNED IN, known existing account, but THIS device has no local
//      │  keys (reinstall / new device) — we know it's a real returning
//      │  user because their birth profile already exists in the cloud
//      │     → NewDeviceApiSetupScreen → Home
//      │
//      └─ SIGNED IN, keys present, birth profile present
//            → MainNavigator (Home), directly — no Sign In screen at all
//
// Decision tree (in order):
//
//  Loading                    → spinner
//  Password recovery          → AuthNavigator
//  Not signed in              → AuthNavigator   (Splash → Onboarding → SignIn)
//  Signed in, keys missing:
//    – cloud birth profile exists → NewDeviceApiSetupScreen (returning user)
//    – no cloud birth profile     → SetupApiNavigator (brand-new signup)
//  Signed in, no birth profile yet → SetupNavigator
//  Fully set up                    → MainNavigator
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
    groqKey1Valid,
    isInitialized: setupInitialized,
    initialize: initSetup,
  } = useSetupStore()

  useEffect(() => {
    initSetup()
    initialize()
  }, [])

  // ── Loading state ─────────────────────────────────────────────────────────
  // authStore.initialize() now AWAITS the cloud key-restore attempt before
  // flipping isLoading to false, so we never flash the wrong screen for a
  // returning user while their keys are still being fetched from Supabase.
  if (isLoading || !isInitialized || !setupInitialized) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.starGold} size="large" />
      </View>
    )
  }

  // ── 1. Password recovery deep-link ────────────────────────────────────────
  if (isPasswordRecovery) return <AuthNavigator />

  // ── 2. Not signed in — ALWAYS Splash → (Onboarding) → Sign In ─────────────
  //    This covers brand-new installs and returning-but-logged-out users
  //    identically; OnboardingScreen itself only shows once per install.
  if (!session) return <AuthNavigator />

  // ── 3. Signed in, but no local GROQ keys on this device ────────────────────
  if (!groqKey1Valid) {
    // We know this is a real returning user (not a brand-new signup) if a
    // birth profile already exists for them in Supabase — that can only
    // happen after someone has completed setup before, possibly on a
    // different device. New signups never have a birth profile yet.
    if (birthProfile) {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="NewDeviceSetup" component={NewDeviceApiSetupScreen} />
        </Stack.Navigator>
      )
    }
    // Brand-new account that just signed up — show the full guided wizard.
    return <SetupApiNavigator />
  }

  // ── 4. Signed in, keys present, but birth details not filled in yet ───────
  if (!birthProfile) return <SetupNavigator />

  // ── 5. Fully set up ─────────────────────────────────────────────────────────
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
