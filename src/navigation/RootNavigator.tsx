// src/navigation/RootNavigator.tsx — Phase 3: AdminNavigator overlay added
import React, { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import { useSetupStore } from '../store/setupStore'
import { useAdminStore } from '../store/adminStore'
import { AuthNavigator } from './AuthNavigator'
import { SetupNavigator } from './SetupNavigator'
import { MainNavigator } from './MainNavigator'
import { SetupApiNavigator } from './SetupApiNavigator'
import { AdminNavigator } from './AdminNavigator'
import { NewDeviceApiSetupScreen } from '../screens/onboarding/NewDeviceApiSetupScreen'
import { Colors } from '../constants/colors'

const Stack = createNativeStackNavigator()

export function RootNavigator() {
  const { session, birthProfile, isLoading, isInitialized, isPasswordRecovery, initialize } = useAuthStore()
  const { openRouterKeyValid, isInitialized: setupInitialized, initialize: initSetup } = useSetupStore()
  const { isAdminMode } = useAdminStore()

  useEffect(() => { initSetup(); initialize() }, [])

  if (isLoading || !isInitialized || !setupInitialized) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.starGold} size="large" />
      </View>
    )
  }

  if (isPasswordRecovery) return <AuthNavigator />
  if (!session) return <AuthNavigator />

  if (!openRouterKeyValid) {
    if (birthProfile) {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="NewDeviceSetup" component={NewDeviceApiSetupScreen} />
        </Stack.Navigator>
      )
    }
    return <SetupApiNavigator />
  }

  if (!birthProfile) return <SetupNavigator />

  // ── Admin overlay: renders as full-screen modal on top of everything ──────
  if (isAdminMode) return <AdminNavigator />

  return <MainNavigator />
}

const styles = StyleSheet.create({
  loader: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
})
