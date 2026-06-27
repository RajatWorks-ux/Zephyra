// src/components/chat/WhisperInput.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Whisper to the Oracle" — the redesigned chat input.
//
// Instead of a static always-visible text box, the input defaults to a
// collapsed glyph (◇) gently pulsing above the tab bar. Tapping it expands
// into the real input pill with a quick scale+fade animation, THEN the
// keyboard is focused — so the keyboard's arrival feels like a consequence
// of "waking the oracle," not just a generic text field being tapped.
//
// On send, the pill collapses back to the glyph automatically. The actual
// message-sending logic, text state, and ref all live in the parent
// (ChatScreen) exactly as before — this component only owns the
// expand/collapse presentation layer, so it's a drop-in replacement with
// minimal risk to existing send/retry/session logic.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, forwardRef } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Animated, Easing, ActivityIndicator } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

type WhisperInputProps = {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  disabled?: boolean
  sending?: boolean
  bottomPad: number
  placeholder?: string
}

export const WhisperInput = forwardRef<TextInput, WhisperInputProps>(function WhisperInput(
  { value, onChangeText, onSend, disabled, sending, bottomPad, placeholder },
  ref,
) {
  const [expanded, setExpanded] = useState(false)
  const expandAnim = useRef(new Animated.Value(0)).current // 0 = glyph, 1 = full pill
  const pulseAnim = useRef(new Animated.Value(0)).current
  const sendRiseAnim = useRef(new Animated.Value(0)).current
  const internalRef = useRef<TextInput>(null)

  // Forward the ref so the parent (ChatScreen) can still call
  // inputRef.current?.focus() from handleSuggestion etc.
  useEffect(() => {
    if (typeof ref === 'function') ref(internalRef.current)
    else if (ref) (ref as React.MutableRefObject<TextInput | null>).current = internalRef.current
  }, [ref])

  // Idle pulse on the collapsed glyph — subtle "the oracle is listening"
  // breathing animation. Only runs while collapsed to save cycles.
  useEffect(() => {
    if (expanded) {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [expanded])

  // If the parent sets text directly (e.g. a suggestion chip was tapped),
  // make sure the pill is expanded so the user sees what was inserted —
  // otherwise the text would silently sit in a collapsed glyph.
  useEffect(() => {
    if (value && !expanded) {
      expandNow()
    }
  }, [value])

  function expandNow() {
    setExpanded(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.timing(expandAnim, {
      toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start(() => {
      internalRef.current?.focus()
    })
  }

  function collapseNow() {
    Animated.timing(expandAnim, {
      toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: false,
    }).start(() => setExpanded(false))
  }

  function handleSendPress() {
    if (!value.trim() || sending) return
    // Quick rise-and-fade flourish so the message feels like it lifts up
    // into the conversation above, rather than just appearing in a list.
    sendRiseAnim.setValue(0)
    Animated.timing(sendRiseAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: false }).start()
    onSend()
    if (!disabled) {
      internalRef.current?.blur()
      collapseNow()
    }
    // If disabled (e.g. chart still loading), leave the pill open and the
    // text intact — onSend's own validation (in the parent) will alert the
    // user, and they shouldn't lose what they typed.
  }

  const pillScale = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })
  const pillOpacity = expandAnim
  const glyphScale = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] })
  const glyphOpacity = expandAnim.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' })
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] })
  const pulseGlow = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] })
  const riseTranslate = sendRiseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] })
  const riseOpacity = sendRiseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })

  return (
    <View style={[styles.root, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      {/* Collapsed glyph state */}
      {!expanded && (
        <Animated.View
          style={[
            styles.glyphWrap,
            { transform: [{ scale: glyphScale }], opacity: glyphOpacity },
          ]}
        >
          <TouchableOpacity activeOpacity={0.85} onPress={expandNow} style={styles.glyphTouch}>
            <Animated.View style={[styles.glyphGlow, { transform: [{ scale: pulseScale }], opacity: pulseGlow }]} />
            <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.glyphCircle}>
              <Text style={styles.glyphSymbol}>◇</Text>
            </LinearGradient>
            <Text style={styles.glyphHint}>whisper your question...</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Expanded pill state */}
      {expanded && (
        <Animated.View
          style={{
            transform: [{ scale: pillScale }, { translateY: riseTranslate }],
            opacity: Animated.multiply(pillOpacity, riseOpacity),
          }}
        >
          <BlurView intensity={30} tint="dark" style={styles.pillBlur}>
            <View style={styles.pill}>
              <TouchableOpacity style={styles.micBtn} disabled activeOpacity={1}>
                <Text style={styles.micIcon}>🎤</Text>
              </TouchableOpacity>
              <TextInput
                ref={internalRef}
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder ?? 'whisper your question...'}
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
                returnKeyType="default"
                onBlur={() => {
                  if (!value.trim()) collapseNow()
                }}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!value.trim() || sending || disabled) && styles.sendBtnOff]}
                onPress={handleSendPress}
                disabled={!value.trim() || sending}
                activeOpacity={0.85}
              >
                {sending ? (
                  <View style={styles.sendBtnGrad}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                ) : (
                  <LinearGradient
                    colors={value.trim() ? ['#7B2FBE', '#C9A84C'] : ['#333', '#444']}
                    style={styles.sendBtnGrad}
                  >
                    <Text style={styles.sendIcon}>↑</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  root: { paddingHorizontal: 12, paddingTop: 10, minHeight: 64, justifyContent: 'center' },

  // Collapsed glyph
  glyphWrap: { alignItems: 'center' },
  glyphTouch: { alignItems: 'center', paddingVertical: 4 },
  glyphGlow: {
    position: 'absolute', top: 0, width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(201,168,76,0.35)',
  },
  glyphCircle: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
  },
  glyphSymbol: { fontSize: 20, color: '#fff' },
  glyphHint: {
    fontFamily: Fonts.mystical, fontSize: 13, color: Colors.textMuted,
    marginTop: 6, letterSpacing: 0.3,
  },

  // Expanded pill
  pillBlur: { borderRadius: 24, overflow: 'hidden' },
  pill: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: 24, paddingLeft: 8, paddingRight: 6, paddingVertical: 6,
  },
  micBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: 0.35 },
  micIcon: { fontSize: 16 },
  input: {
    flex: 1, fontFamily: Fonts.body, fontSize: 15, color: Colors.textPrimary,
    maxHeight: 120, paddingVertical: 8, paddingRight: 10, lineHeight: 22,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  sendBtnOff: { opacity: 0.4 },
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
})
