// src/navigation/RelationshipNavigator.tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { RelationshipListScreen } from '../screens/relationship/RelationshipListScreen'
import { AddPersonScreen } from '../screens/relationship/AddPersonScreen'
import { CompatibilityLoadingScreen } from '../screens/relationship/CompatibilityLoadingScreen'
import { CompatibilityResultScreen } from '../screens/relationship/CompatibilityResultScreen'
import { RelationshipForecastScreen } from '../screens/relationship/RelationshipForecastScreen'
import { RelationshipChatScreen } from '../screens/relationship/RelationshipChatScreen'

export type RelationshipStackParams = {
  RelationshipList: undefined
  AddPerson: undefined
  CompatibilityLoading: undefined
  CompatibilityResult: undefined
  RelationshipForecast: undefined
  RelationshipChat: undefined
}

const Stack = createNativeStackNavigator<RelationshipStackParams>()

export function RelationshipNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="RelationshipList" component={RelationshipListScreen} />
      <Stack.Screen name="AddPerson" component={AddPersonScreen} />
      <Stack.Screen name="CompatibilityLoading" component={CompatibilityLoadingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="CompatibilityResult" component={CompatibilityResultScreen} />
      <Stack.Screen name="RelationshipForecast" component={RelationshipForecastScreen} />
      <Stack.Screen name="RelationshipChat" component={RelationshipChatScreen} />
    </Stack.Navigator>
  )
}
