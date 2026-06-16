// src/navigation/RootNavigator.tsx — PHASE 2 — Supabase
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
  const { session, birthProfile, isLoading, isInitialized, isPasswordRecovery, initialize } = useAuthStore()
  const { isSetupComplete, isInitialized: setupInitialized, initialize: initSetup } = useSetupStore()

  useEffect(() => {
    initSetup()
    initialize()
  }, [])

  if (isLoading || !isInitialized || !setupInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.starGold} size="large" />
      </View>
    )
  }

  // 1. GROQ API keys not set up yet → 3-step wizard
  if (!isSetupComplete) return <SetupApiNavigator />

  // 2. Password recovery link clicked
  if (isPasswordRecovery) return <AuthNavigator />

  // 3. Not signed in
  if (!session) return <AuthNavigator />

  // 4. Signed in but no birth details yet
  if (!birthProfile) return <SetupNavigator />

  // 5. Fully set up
  return <MainNavigator />
}

