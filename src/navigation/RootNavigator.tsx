// src/navigation/RootNavigator.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: New routing priority
// 1. Setup not complete → ApiSetupWizard (GROQ keys entry)
// 2. Password recovery → AuthNavigator
// 3. No session → AuthNavigator
// 4. Session but no birth profile → SetupNavigator
// 5. Session + birth profile → MainNavigator
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../store/authStore'
import { useSetupStore } from '../store/setupStore'
import { AuthNavigator } from './AuthNavigator'
import { SetupNavigator } from './SetupNavigator'
import { MainNavigator } from './MainNavigator'
import { SetupApiNavigator } from './SetupApiNavigator'
import { Colors } from '../constants/colors'

export function RootNavigator() {
  const { session, birthProfile, isLoading, isInitialized, isPasswordRecovery } = useAuthStore()
  const { isSetupComplete, isInitialized: setupInitialized, initialize: initSetup } = useSetupStore()

  useEffect(() => {
    initSetup()
  }, [])

  // Wait for both auth and setup stores to initialize
  if (isLoading || !isInitialized || !setupInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.starGold} size="large" />
      </View>
    )
  }

  // Priority 1: API keys not set up yet → show 3-step wizard
  if (!isSetupComplete) {
    return <SetupApiNavigator />
  }

  // Priority 2: Password recovery link clicked
  if (isPasswordRecovery) {
    return <AuthNavigator />
  }

  // Priority 3: Not logged in
  if (!session) {
    return <AuthNavigator />
  }

  // Priority 4: Logged in but no birth profile → collect birth details
  if (!birthProfile) {
    return <SetupNavigator />
  }

  // Priority 5: Fully set up → main app
  return <MainNavigator />
}
