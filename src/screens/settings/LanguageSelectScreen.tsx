// src/screens/settings/LanguageSelectScreen.tsx
import React from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { useSettingsStore } from '../../store/settingsStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const LANGUAGES = [
  { code: 'en-US', name: 'English', native: 'English', flag: '🇺🇸' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳' },
  { code: 'gu-IN', name: 'Gujarati', native: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'pa-IN', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
]

export function LanguageSelectScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { language, setLanguage } = useSettingsStore()

  function handleSelect(lang: typeof LANGUAGES[0]) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setLanguage({ code: lang.code, name: lang.name, nativeName: lang.native })
    navigation.goBack()
  }

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.92)']} style={StyleSheet.absoluteFillObject} />

      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Reading Language</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={st.subtitle}>
        AI readings, forecasts, and chat responses will be generated in your selected language.
      </Text>

      <FlatList
        data={LANGUAGES}
        keyExtractor={i => i.code}
        contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isActive = language?.code === item.code
          return (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              activeOpacity={0.8}
            >
              <BlurView intensity={isActive ? 20 : 10} tint="dark" style={[st.langCard, isActive && st.langCardActive]}>
                {isActive && (
                  <LinearGradient
                    colors={['rgba(201,168,76,0.12)', 'rgba(123,47,190,0.08)']}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <Text style={st.langFlag}>{item.flag}</Text>
                <View style={st.langInfo}>
                  <Text style={[st.langName, isActive && st.langNameActive]}>{item.name}</Text>
                  <Text style={st.langNative}>{item.native}</Text>
                </View>
                {isActive && <Text style={st.checkmark}>✓</Text>}
              </BlurView>
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#C9A84C' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: '#C9A84C' },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, paddingHorizontal: 20, marginBottom: 16, lineHeight: 20 },
  list: { padding: 16, gap: 10 },
  langCard: {
    borderRadius: 16, padding: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  langCardActive: { borderColor: '#C9A84C' },
  langFlag: { fontSize: 28 },
  langInfo: { flex: 1 },
  langName: { fontFamily: Fonts.bodySemiBold, fontSize: 15, color: '#E8E8FF' },
  langNameActive: { color: '#C9A84C' },
  langNative: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  checkmark: { fontSize: 18, color: '#C9A84C' },
})
