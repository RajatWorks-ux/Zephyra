import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { HomeScreen } from '../screens/main/HomeScreen'
import { ReadingScreen } from '../screens/main/ReadingScreen'
import { ChartsScreen } from '../screens/main/ChartsScreen'
import { ChatScreen } from '../screens/main/ChatScreen'
import { ForecastScreen } from '../screens/main/ForecastScreen'
import { ProfileScreen } from '../screens/main/ProfileScreen'
import { BottomTabBar } from '../components/ui/BottomTabBar'

// ─── Home Stack (Home → Reading) ──────────────────────────────────────────────
export type HomeStackParams = {
  Home: undefined
  Reading: undefined
}

const HomeStack = createNativeStackNavigator<HomeStackParams>()

function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#05050F' } }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Reading" component={ReadingScreen} />
    </HomeStack.Navigator>
  )
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator()

export function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNav} />
      <Tab.Screen name="ChartsTab" component={ChartsScreen} />
      <Tab.Screen name="ChatTab" component={ChatScreen} />
      <Tab.Screen name="ForecastTab" component={ForecastScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
