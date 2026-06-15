// src/navigation/SetupApiNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ApiSetupScreen } from '../screens/onboarding/ApiSetupScreen'

const Stack = createNativeStackNavigator()

export function SetupApiNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="ApiSetup" component={ApiSetupScreen} />
    </Stack.Navigator>
  )
}
