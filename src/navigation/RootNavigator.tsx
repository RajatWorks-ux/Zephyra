import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../store/authStore'
import { AuthNavigator } from './AuthNavigator'
import { SetupNavigator } from './SetupNavigator'
import { MainNavigator } from './MainNavigator'
import { Colors } from '../constants/colors'

export function RootNavigator() {
  const { session, birthProfile, isLoading, isInitialized, isPasswordRecovery } = useAuthStore()

  if (isLoading || !isInitialized) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.starGold} size="large" />
      </View>
    )
  }

  // No session → show auth flow
  // isPasswordRecovery → user clicked reset link, keep them in auth flow
  // (PasswordResetScreen is inside AuthNavigator, so this is correct)
  if (!session || isPasswordRecovery) {
    return <AuthNavigator />
  }

  // Has session but no birth profile → new user, show birth details setup
  if (!birthProfile) {
    return <SetupNavigator />
  }

  // Has session AND birth profile → existing user, go to main app
  return <MainNavigator />
}
