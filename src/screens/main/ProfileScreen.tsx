// src/screens/main/ProfileScreen.tsx — Phase 3
// Admin entry: 7 taps → biometric (hardcoded, no whitelist) → PIN screen
// Biometric: uses expo-local-authentication — device owner's enrolled biometric only.
// HOW TO CHANGE BIOMETRIC IN FUTURE: see BIOMETRIC_CHANGE_GUIDE.md
import React, { useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, Dimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import * as LocalAuthentication from 'expo-local-authentication'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { useAuthStore } from '../../store/authStore'
import { useReadingStore } from '../../store/readingStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useAudioStore, type TtsVoice } from '../../store/audioStore'
import { useAdminStore } from '../../store/adminStore'
import { isDeveloperAccount } from '../../constants/adminConfig'
import { TAB_BAR_CONTENT_HEIGHT } from '../../components/ui/BottomTabBar'
import { ApiKeyUpdateModal } from '../settings/ApiKeyUpdateModal'

// ─────────────────────────────────────────────────────────────────────────────
// HARDCODED ADMIN BIOMETRIC CONFIG
// The biometric prompt message is hardcoded here.
// This file is the single source of truth for admin authentication.
// Even if someone decompiles/debugs the app, they still need the actual
// enrolled biometric (your fingerprint / Face ID) on the physical device.
//
// HOW TO CHANGE IN FUTURE:
//   Only change the ADMIN_PROMPT_MESSAGE string below for the prompt text.
//   To change the actual biometric, go to your phone Settings → Biometrics
//   and enroll a new fingerprint/face. The app does NOT store which biometric —
//   it only verifies "is the person holding this phone the device owner?"
//   See: BIOMETRIC_CHANGE_GUIDE.md for full details.
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_PROMPT_MESSAGE = 'Zephyra admin verification'

// ─── Settings row component ───────────────────────────────────────────────────
function SettingsRow({
  icon, label, onPress, value, isSwitch, switchVal, onToggle, danger, chevron = true,
}: {
  icon: string; label: string; onPress?: () => void; value?: string;
  isSwitch?: boolean; switchVal?: boolean; onToggle?: (v: boolean) => void;
  danger?: boolean; chevron?: boolean;
}) {
  return (
    <TouchableOpacity
      style={st.row}
      onPress={() => { if (onPress) { Haptics.selectionAsync(); onPress() } }}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={st.rowIcon}>{icon}</Text>
      <Text style={[st.rowLabel, danger && st.rowDanger]}>{label}</Text>
      {value !== undefined && <Text style={st.rowValue}>{value}</Text>}
      {isSwitch && onToggle && (
        <Switch
          value={switchVal}
          onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onToggle(v) }}
          trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#7B2FBE' }}
          thumbColor="#fff"
          style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
        />
      )}
      {chevron && !isSwitch && <Text style={st.rowChevron}>›</Text>}
    </TouchableOpacity>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <BlurView intensity={12} tint="dark" style={st.sectionCard}>
      {children}
    </BlurView>
  )
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { profile, session, signOut } = useAuthStore()
  const { chartData } = useReadingStore()
  const settings = useSettingsStore()
  const { selectedVoice, setSelectedVoice } = useAudioStore()
  const { registerTap, setAdminMode } = useAdminStore()
  const [keyModalVisible, setKeyModalVisible] = React.useState(false)
  const [keyModalType, setKeyModalType] = React.useState<'nvidia_text' | 'nvidia_tts'>('nvidia_text')

  const chart = chartData?.vedic

  // ── 7-tap hidden admin entry ───────────────────────────────────────────────
  // Security layers: real account check (silent) → 7 taps → Face ID (no
  // fallback) → PIN → gate ritual screen.
  // Only the developer's own account can ever get past the first check —
  // for every other user, tapping the avatar 7,000 times does nothing at all.
  const handleAvatarTap = useCallback(async () => {
    // Real gate #1 — everything below this line is UX, not security.
    // If this isn't the developer's account, taps are silently no-ops.
    if (!isDeveloperAccount(session?.user?.id)) {
      return
    }

    const triggered = registerTap()
    if (!triggered) return  // not 7 taps yet, do nothing visible

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
      const hasFaceId = types.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )

      if (!compatible || !enrolled || !hasFaceId) {
        // No Face ID available on this device — deny outright.
        // (No more "no biometric = free admin access" bypass.)
        return
      }

      // Face ID only. disableDeviceFallback blocks the device passcode
      // from being usable as a substitute — it must be your face.
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: ADMIN_PROMPT_MESSAGE,
        disableDeviceFallback: true,
        cancelLabel: 'Cancel',
      })

      if (result.success) {
        setAdminMode(true)
        // RootNavigator renders AdminNavigator automatically when isAdminMode=true
      }
      // If biometric fails: silent rejection. No error shown to user.
    } catch {
      // Any error = silent rejection
    }
  }, [registerTap, setAdminMode, session])

  function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  function openKeyModal(type: 'nvidia_text' | 'nvidia_tts') {
    setKeyModalType(type)
    setKeyModalVisible(true)
  }

  const VOICES: TtsVoice[] = ['alloy', 'echo', 'nova', 'shimmer']

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient
        colors={['rgba(5,5,15,0.35)', 'rgba(5,5,15,0.9)']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={[
          st.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + TAB_BAR_CONTENT_HEIGHT + 80 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <View style={st.hero}>
          {/* Avatar: invisible 7-tap zone — no visual feedback on taps 1-6 */}
          <TouchableOpacity
            onPress={handleAvatarTap}
            activeOpacity={1}
            style={st.avatarWrap}
          >
            <LinearGradient colors={['#C9A84C', '#7B2FBE']} style={StyleSheet.absoluteFillObject} />
            <Text style={st.avatarLetter}>
              {(profile?.display_name || 'S')[0].toUpperCase()}
            </Text>
          </TouchableOpacity>

          <Text style={st.displayName}>{profile?.display_name || 'Seeker'}</Text>
          {chart && (
            <Text style={st.identity}>
              {chart.lagna} Lagna · {chart.nakshatra} · {chart.currentMahadasha || ''} Mahadasha
            </Text>
          )}

          <View style={st.statsRow}>
            {[
              { icon: '◈', label: 'Oracle' },
              { icon: '✦', label: 'Readings' },
              { icon: '◎', label: 'Bookmarks' },
            ].map(s => (
              <BlurView key={s.label} intensity={15} tint="dark" style={st.statPill}>
                <Text style={st.statIcon}>{s.icon}</Text>
                <Text style={st.statLabel}>{s.label}</Text>
              </BlurView>
            ))}
          </View>
        </View>

        {/* ── Reading Preferences ─────────────────────────────────────────── */}
        <Text style={st.sectionHeader}>READING PREFERENCES</Text>
        <SectionCard>
          <SettingsRow
            icon="◌" label="Language"
            value={settings.language?.name || 'English'}
            onPress={() => navigation.navigate('LanguageSelect')}
          />
          <View style={st.divider} />
          <SettingsRow icon="✦" label="Reading History" onPress={() => navigation.navigate('ReadingHistory')} />
          <View style={st.divider} />
          <SettingsRow icon="◎" label="Saved Insights" onPress={() => navigation.navigate('Bookmarks')} />
        </SectionCard>

        {/* ── Voice & Audio ────────────────────────────────────────────────── */}
        <Text style={st.sectionHeader}>VOICE & AUDIO</Text>
        <SectionCard>
          <SettingsRow
            icon="◎" label="Voice Readings"
            isSwitch switchVal={settings.voiceEnabled ?? true}
            onToggle={v => settings.setVoiceEnabled?.(v)}
            chevron={false}
          />
          <View style={st.divider} />
          <View style={st.voiceStyleRow}>
            <Text style={st.rowIcon}>◉</Text>
            <Text style={[st.rowLabel, { flex: 0, marginRight: 10 }]}>Voice Style</Text>
            <View style={st.voicePills}>
              {VOICES.map(v => (
                <TouchableOpacity
                  key={v}
                  onPress={() => { Haptics.selectionAsync(); setSelectedVoice(v) }}
                  style={[st.voicePill, selectedVoice === v && st.voicePillActive]}
                >
                  <Text style={[st.voicePillText, selectedVoice === v && st.voicePillTextActive]}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </SectionCard>

        {/* ── Notifications ─────────────────────────────────────────────────── */}
        <Text style={st.sectionHeader}>NOTIFICATIONS</Text>
        <SectionCard>
          <SettingsRow icon="◐" label="Daily Forecast" isSwitch switchVal={settings.notifDaily ?? true} onToggle={v => settings.setNotifDaily?.(v)} chevron={false} />
          <View style={st.divider} />
          <SettingsRow icon="◎" label="Full Moon Alerts" isSwitch switchVal={settings.notifFullMoon ?? true} onToggle={v => settings.setNotifFullMoon?.(v)} chevron={false} />
          <View style={st.divider} />
          <SettingsRow icon="◈" label="Retrograde Alerts" isSwitch switchVal={settings.notifRetrograde ?? false} onToggle={v => settings.setNotifRetrograde?.(v)} chevron={false} />
          <View style={st.divider} />
          <SettingsRow icon="✦" label="Weekly Review" isSwitch switchVal={settings.notifWeekly ?? true} onToggle={v => settings.setNotifWeekly?.(v)} chevron={false} />
        </SectionCard>

        {/* ── API Keys ──────────────────────────────────────────────────────── */}
        <Text style={st.sectionHeader}>API KEYS</Text>
        <SectionCard>
          <SettingsRow
            icon="◈" label="NVIDIA Text AI Key"
            value="nvapi-••••"
            onPress={() => openKeyModal('nvidia_text')}
          />
          <View style={st.divider} />
          <SettingsRow
            icon="◎" label="NVIDIA Voice Key (TTS)"
            value="nvapi-••••"
            onPress={() => openKeyModal('nvidia_tts')}
          />
        </SectionCard>

        {/* ── Account ───────────────────────────────────────────────────────── */}
        <Text style={st.sectionHeader}>ACCOUNT</Text>
        <SectionCard>
          <SettingsRow icon="◉" label="Sign Out" onPress={handleSignOut} danger />
        </SectionCard>

        <Text style={st.version}>Zephyra · Vedic AI · Phase 3</Text>
        <Text style={st.version2}>Admin: tap avatar 7× to access</Text>
      </ScrollView>

      <ApiKeyUpdateModal
        visible={keyModalVisible}
        keyType={keyModalType}
        onClose={() => setKeyModalVisible(false)}
        onSaved={() => setKeyModalVisible(false)}
      />
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 20 },
  hero: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  avatarWrap: {
    width: 84, height: 84, borderRadius: 42, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(201,168,76,0.4)',
  },
  avatarLetter: { fontFamily: Fonts.heading, fontSize: 32, color: '#fff', zIndex: 1 },
  displayName: { fontFamily: Fonts.heading, fontSize: 22, color: '#E8E8FF' },
  identity: { fontFamily: Fonts.mystical, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  statIcon: { fontSize: 12, color: '#C9A84C' },
  statLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  sectionHeader: {
    fontFamily: Fonts.bodySemiBold, fontSize: 10, color: Colors.textMuted,
    letterSpacing: 2, marginTop: 22, marginBottom: 8,
  },
  sectionCard: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16, gap: 14, minHeight: 54,
  },
  rowIcon: { fontSize: 16, color: Colors.textMuted, width: 24, textAlign: 'center' },
  rowLabel: { flex: 1, fontFamily: Fonts.body, fontSize: 15, color: '#E8E8FF' },
  rowDanger: { color: '#FF6666' },
  rowValue: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  rowChevron: { fontSize: 20, color: Colors.textMuted },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 18 },
  voiceStyleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, gap: 8,
  },
  voicePills: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  voicePill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  voicePillActive: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: '#C9A84C' },
  voicePillText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  voicePillTextActive: { color: '#C9A84C' },
  version: {
    fontFamily: Fonts.body, fontSize: 10, color: 'rgba(255,255,255,0.1)',
    textAlign: 'center', marginTop: 24, letterSpacing: 1,
  },
  version2: {
    fontFamily: Fonts.body, fontSize: 9, color: 'rgba(255,255,255,0.06)',
    textAlign: 'center', marginTop: 4, letterSpacing: 0.5,
  },
})
