import 'react-native-url-polyfill/auto'
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  CinzelDecorative_400Regular,
} from '@expo-google-fonts/cinzel-decorative'
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter'
import {
  Orbitron_400Regular,
  Orbitron_600SemiBold,
} from '@expo-google-fonts/orbitron'
import {
  CormorantGaramond_400Regular_Italic,
} from '@expo-google-fonts/cormorant-garamond'
import { RootNavigator } from './src/navigation/RootNavigator'
import { useAuthStore } from './src/store/authStore'

SplashScreen.preventAutoHideAsync()

export default function App() {
  const { initialize } = useAuthStore()

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    Inter_400Regular,
    Inter_600SemiBold,
    Orbitron_400Regular,
    Orbitron_600SemiBold,
    CormorantGaramond_400Regular_Italic,
  })

  useEffect(() => {
    async function prepare() {
      await initialize()
      if (fontsLoaded) {
        await SplashScreen.hideAsync()
      }
    }
    prepare()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}