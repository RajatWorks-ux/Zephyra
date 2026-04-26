import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { BirthDetailsScreen } from '../screens/setup/BirthDetailsScreen'
import { GrandReadingLoadingScreen } from '../screens/setup/GrandReadingLoadingScreen'
import type { BirthFormData } from '../types'

export type SetupStackParams = {
  BirthDetails: undefined
  GrandReadingLoading: { birthData: BirthFormData }
}

const Stack = createNativeStackNavigator<SetupStackParams>()

export function SetupNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#05050F' },
      }}
    >
      <Stack.Screen name="BirthDetails" component={BirthDetailsScreen} />
      <Stack.Screen name="GrandReadingLoading" component={GrandReadingLoadingScreen} />
    </Stack.Navigator>
  )
}