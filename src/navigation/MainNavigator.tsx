// src/navigation/MainNavigator.tsx — Phase 3 update
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
import { RelationshipNavigator } from './RelationshipNavigator'
import { ReadingHistoryScreen } from '../screens/history/ReadingHistoryScreen'
import { BookmarksScreen } from '../screens/history/BookmarksScreen'
import { LanguageSelectScreen } from '../screens/settings/LanguageSelectScreen'

// ─── Home Stack ────────────────────────────────────────────────────────────────
export type HomeStackParams = { Home: undefined; Reading: undefined }
const HomeStack = createNativeStackNavigator<HomeStackParams>()
function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#05050F' } }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Reading" component={ReadingScreen} />
    </HomeStack.Navigator>
  )
}

// ─── Profile Stack (includes settings sub-screens) ────────────────────────────
const ProfileStack = createNativeStackNavigator()
function ProfileStackNav() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="ReadingHistory" component={ReadingHistoryScreen} />
      <ProfileStack.Screen name="Bookmarks" component={BookmarksScreen} />
      <ProfileStack.Screen name="LanguageSelect" component={LanguageSelectScreen} />
    </ProfileStack.Navigator>
  )
}

// ─── Tab Navigator (6 tabs) ───────────────────────────────────────────────────
const Tab = createBottomTabNavigator()

export function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="HomeTab"         component={HomeStackNav} />
      <Tab.Screen name="ChartsTab"       component={ChartsScreen} />
      <Tab.Screen name="ChatTab"         component={ChatScreen} />
      <Tab.Screen name="BondsTab"        component={RelationshipNavigator} />
      <Tab.Screen name="ForecastTab"     component={ForecastScreen} />
      <Tab.Screen name="ProfileTab"      component={ProfileStackNav} />
    </Tab.Navigator>
  )
}
