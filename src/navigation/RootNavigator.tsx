import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../store/authStore'
import { AuthNavigator } from './AuthNavigator'
import { SetupNavigator } from './SetupNavigator'
import { MainNavigator } from './MainNavigator'
import { Colors } from '../constants/colors'

export function RootNavigator() {
  const { session, birthProfile, isLoading, isInitialized } = useAuthStore()

  if (isLoading || !isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.starGold} size="large" />
      </View>
    )
  }

  // No session → show auth flow
  if (!session) {
    return <AuthNavigator />
  }

  // Has session but no birth profile → show setup
  if (!birthProfile) {
    return <SetupNavigator />
  }

  // Has session and birth profile → main app
  return <MainNavigator />
}