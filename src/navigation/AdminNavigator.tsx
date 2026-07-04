// src/navigation/AdminNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { AdminAccessScreen } from '../screens/admin/AdminAccessScreen'
import { AdminDashboardScreen } from '../screens/admin/AdminDashboardScreen'

export type AdminStackParams = {
  AdminAccess: undefined
  AdminDashboard: undefined
  AdminMessages: undefined
}

const Stack = createNativeStackNavigator<AdminStackParams>()

export function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        presentation: 'fullScreenModal',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="AdminAccess" component={AdminAccessScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    </Stack.Navigator>
  )
}
