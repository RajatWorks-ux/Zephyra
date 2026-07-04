// src/components/audio/FloatingListenButton.tsx — Phase 3
//
// Interaction model:
//   TAP when idle + NO nvidia key  → shows "Add NVIDIA key in Settings first" toast
//   TAP when idle + key exists     → shows "Long-press any text to hear it" hint (2.5s)
//   TAP when playing               → stops all audio immediately
//   Long-press on any Text         → speaks that text (handled in each component)
//
// This button is mode indicator + global stop + key-missing alert.
// It has NO speaker-everywhere logic, NO auto-play, NO queue.
import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform, Alert,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAudioStore } from '../../store/audioStore'
import { stopAllAudio, getIsSpeaking, hasNvidiaTtsKey } from '../../services/audioService'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

export function FloatingListenButton() {
  const insets = useSafeAreaInsets()
  const {
    isPlaying, hintVisible, isLoadingAudio,
    showHint, setIsPlaying, reset,
  } = useAudioStore()

  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current
  const hintOpacity = useRef(new Animated.Value(0)).current
  const toastOpacity = useRef(new Animated.Value(0)).current
  const bars = [
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.8)).current,
    useRef(new Animated.Value(0.5)).current,
  ]

  // Pulse while loading
  useEffect(() => {
    if (isLoadingAudio) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start()
    } else {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)
    }
  }, [isLoadingAudio])

  // Hint fade
  useEffect(() => {
    Animated.timing(hintOpacity, {
      toValue: hintVisible ? 1 : 0,
      duration: hintVisible ? 200 : 300,
      useNativeDriver: true,
    }).start()
  }, [hintVisible])

  // Wave bars while playing
  useEffect(() => {
    if (!isPlaying) { bars.forEach(b => b.setValue(0.4)); return }
    bars.forEach((bar, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 1, duration: 280 + i * 90, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.3, duration: 280 + i * 90, useNativeDriver: true }),
        ])
      ).start()
    })
  }, [isPlaying])

  function showToast(msg: string) {
    setToastMsg(msg)
    setToastVisible(true)
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false))
  }

  async function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    // If currently playing → stop
    if (isPlaying || getIsSpeaking()) {
      await stopAllAudio()
      reset()
      return
    }

    // Check if NVIDIA TTS key exists
    const hasKey = await hasNvidiaTtsKey()
    if (!hasKey) {
      // Show specific guidance: go add key in settings
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      showToast('Add NVIDIA Voice Key in Profile → API Keys first')
      return
    }

    // Key exists → show long-press hint
    showHint()
  }

  const bottomOffset = insets.bottom + 68 + 14

  return (
    <View
      style={[st.wrapper, { bottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      {/* Toast: no-key warning */}
      {toastVisible && (
        <Animated.View style={[st.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <BlurView intensity={35} tint="dark" style={st.toastBlur}>
            <Text style={st.toastIcon}>⚠</Text>
            <Text style={st.toastText}>{toastMsg}</Text>
          </BlurView>
        </Animated.View>
      )}

      {/* Hint: long-press instruction */}
      {!toastVisible && (
        <Animated.View style={[st.hint, { opacity: hintOpacity }]} pointerEvents="none">
          <BlurView intensity={30} tint="dark" style={st.hintBlur}>
            <Text style={st.hintText}>Long-press any text to hear it</Text>
          </BlurView>
        </Animated.View>
      )}

      {/* Main button */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.82}
          style={st.btnOuter}
        >
          <BlurView intensity={35} tint="dark" style={st.blur}>
            <LinearGradient
              colors={
                isPlaying
                  ? ['#7B2FBE', '#2FBEBE']
                  : ['rgba(201,168,76,0.22)', 'rgba(123,47,190,0.22)']
              }
              style={StyleSheet.absoluteFillObject}
            />
            {isPlaying ? (
              // Wave bars
              <View style={st.bars}>
                {bars.map((bar, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      st.bar,
                      { transform: [{ scaleY: bar }], backgroundColor: '#C9A84C' }
                    ]}
                  />
                ))}
              </View>
            ) : isLoadingAudio ? (
              <Text style={st.iconLoading}>◌</Text>
            ) : (
              <Text style={st.icon}>◎</Text>
            )}
          </BlurView>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

const BTN = 46

const st = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 18,
    alignItems: 'flex-end',
    zIndex: 999,
  },
  toast: {
    marginBottom: 8,
    maxWidth: 240,
    alignSelf: 'flex-end',
  },
  toastBlur: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,153,68,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toastIcon: {
    fontSize: 14,
    color: '#FF9944',
  },
  toastText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: '#FFD0A0',
    lineHeight: 16,
    flex: 1,
  },
  hint: {
    marginBottom: 8,
    maxWidth: 210,
    alignSelf: 'flex-end',
  },
  hintBlur: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  hintText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  btnOuter: {
    width: BTN, height: BTN, borderRadius: BTN / 2,
    overflow: 'hidden',
    shadowColor: '#7B2FBE',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  blur: {
    flex: 1,
    borderRadius: BTN / 2,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18, color: '#C9A84C' },
  iconLoading: { fontSize: 18, color: 'rgba(201,168,76,0.5)' },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
  },
  bar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
})
