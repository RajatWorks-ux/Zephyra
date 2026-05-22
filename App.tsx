import 'react-native-url-polyfill/auto'
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { useFonts, CinzelDecorative_400Regular } from '@expo-google-fonts/cinzel-decorative'
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { Orbitron_400Regular, Orbitron_600SemiBold } from '@expo-google-fonts/orbitron'
import { CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond'
import { RootNavigator } from './src/navigation/RootNavigator'
import { useAuthStore } from './src/store/authStore'
import { useSettingsStore } from './src/store/settingsStore'
import { prefetchAllVideos } from './src/services/videoCache'  // ← only new line

SplashScreen.preventAutoHideAsync()

const linking = {
  prefixes: [Linking.createURL('/'), 'zephyra://'],
  config: {
    screens: {
      PasswordReset: { path: 'reset-password' },
      AccountCreated: { path: 'account-created' },
    },
  },
}

export default function App() {
  const { initialize } = useAuthStore()
  const { loadSettings } = useSettingsStore()

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
      await Promise.all([initialize(), loadSettings()])
      if (fontsLoaded) await SplashScreen.hideAsync()
      prefetchAllVideos() // ← only new line, runs in background, no await
    }
    prepare()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

