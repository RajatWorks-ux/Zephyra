// App.tsx — PHASE 3
// Added: audioStore.loadVoice(), FloatingListenButton overlay
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
import { useSetupStore } from './src/store/setupStore'
import { useAudioStore } from './src/store/audioStore'
import { FloatingListenButton } from './src/components/audio/FloatingListenButton'
import { prefetchAllVideos } from './src/services/videoCache'
import { registerDailyResetTask } from './src/tasks/dailyResetTask'

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
  const { initialize: initSetup } = useSetupStore()
  const { loadVoice } = useAudioStore()

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
      await Promise.all([initialize(), loadSettings(), initSetup(), loadVoice()])
      if (fontsLoaded) await SplashScreen.hideAsync()
      prefetchAllVideos()
      try { await registerDailyResetTask() } catch {}
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
          {/* Floating listen button — visible on all screens, above tab bar */}
          <FloatingListenButton />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
