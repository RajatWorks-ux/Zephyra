// src/components/forecast/ForecastOracleModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The Forecast screen's "Ask Oracle" popup — DELIBERATELY a different shape
// from ChartOracleModal (src/components/charts/shared/ChartOracleModal.tsx):
//
//   ChartOracleModal   → 3 plain-text paragraph sections (Interpretation /
//                         Effects / Remedies), slide-up sheet, single scroll.
//   ForecastOracleModal → a verdict band up top, two side-by-side checklist
//                         columns (Do Now / Avoid Now), a highlighted best-
//                         timing strip, and a single watch-for caution card
//                         at the bottom. Centered card, not a bottom sheet.
//
// This keeps the two oracle entry points visually and structurally distinct
// per the product spec, while still calling into the same NVIDIA AI
// transport underneath via getForecastOracleInsight (a separate, JSON-
// structured prompt — never getChartInsight).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  Animated, Dimensions, Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { getForecastOracleInsight, type ForecastOracleResult } from '../../services/groqAI'
import { Fonts } from '../../constants/fonts'
import { Colors } from '../../constants/colors'
import type { Language } from '../../types'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = SCREEN_W * 0.9
const CARD_MAX_H = SCREEN_H * 0.82
const GOLD = '#C9A84C'
const GREEN = '#44FF88'
const RED = '#FF4444'

const FALLBACK_LANGUAGE: Language = {
  code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', promptInstruction: '',
}

export interface ForecastOracleModalProps {
  visible: boolean
  onClose: () => void
  period: 'today' | 'week' | 'month'
  periodLabel: string // e.g. "Today", "This Week", "October 2026"
  contextData: string
  language?: Language
}

// ─── Pulsing loading state — different visual rhythm from the chart popup's
//     skeleton bars: a single rotating glyph + staged checklist placeholders.
function LoadingBriefing() {
  const spin = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, useNativeDriver: true }),
    ).start()
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={lb.wrap}>
      <Animated.Text style={[lb.glyph, { transform: [{ rotate }] }]}>✦</Animated.Text>
      <Animated.Text style={[lb.text, { opacity: pulse }]}>Drawing up your briefing...</Animated.Text>
      <View style={lb.placeholderRow}>
        {[0.85, 0.65, 0.75].map((w, i) => (
          <Animated.View key={i} style={[lb.placeholderBar, { width: `${w * 100}%`, opacity: pulse }]} />
        ))}
      </View>
    </View>
  )
}

const lb = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 30, gap: 14 },
  glyph: { fontSize: 30, color: GOLD },
  text: { fontFamily: Fonts.mystical, fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  placeholderRow: { width: '100%', gap: 10, marginTop: 10 },
  placeholderBar: { height: 11, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'flex-start' },
})

// ─── Checklist column ─────────────────────────────────────────────────────────
function ChecklistColumn({ title, items, color, icon }: { title: string; items: string[]; color: string; icon: string }) {
  if (!items.length) return null
  return (
    <View style={[cl.col, { borderColor: `${color}33` }]}>
      <View style={[cl.headerRow, { backgroundColor: `${color}14` }]}>
        <Text style={[cl.icon, { color }]}>{icon}</Text>
        <Text style={[cl.title, { color }]}>{title}</Text>
      </View>
      <View style={cl.body}>
        {items.map((item, i) => (
          <View key={i} style={cl.row}>
            <View style={[cl.dot, { backgroundColor: color }]} />
            <Text style={cl.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const cl = StyleSheet.create({
  col: { flex: 1, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 12 },
  icon: { fontSize: 12 },
  title: { fontFamily: Fonts.accent, fontSize: 10, letterSpacing: 1 },
  body: { padding: 12, gap: 10 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 6, flexShrink: 0 },
  itemText: { flex: 1, fontFamily: Fonts.body, fontSize: 12.5, color: 'rgba(255,255,255,0.82)', lineHeight: 19 },
})

// ─── Main modal ───────────────────────────────────────────────────────────────
export function ForecastOracleModal({
  visible, onClose, period, periodLabel, contextData, language,
}: ForecastOracleModalProps) {
  const lang = language ?? FALLBACK_LANGUAGE
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<ForecastOracleResult | null>(null)

  const slideAnim = useRef(new Animated.Value(40)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const contentAnim = useRef(new Animated.Value(0)).current
  const [isMounted, setIsMounted] = useState(false)
  // Guards against a slow, stale request (e.g. an earlier "today" fetch
  // still in flight on NVIDIA NIM's serialized queue) resolving after a
  // newer one and overwriting it on screen with outdated content.
  const requestIdRef = useRef(0)

  const fetchInsight = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setErrorMsg(null)
    contentAnim.setValue(0)
    try {
      const insight = await getForecastOracleInsight(period, contextData, lang.promptInstruction)
      if (requestId !== requestIdRef.current) return // a newer request superseded this one
      if (!insight) {
        setErrorMsg('The oracle could not form a clear reading just now. Try again in a moment.')
      } else {
        setResult(insight)
        Animated.timing(contentAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start()
      }
    } catch {
      if (requestId !== requestIdRef.current) return
      setErrorMsg('Something interrupted the reading. Please try again.')
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [period, contextData, lang.promptInstruction])

  useEffect(() => {
    if (visible) {
      setIsMounted(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  // Re-fetch whenever the period or context changes while the modal is
  // open — e.g. the user taps "Ask Oracle" again from a different tab/day
  // while a previous reading is still showing or loading. Without this,
  // only the very first open ever triggered a fetch, so later requests
  // ran (visible in the logs) but never reached the screen, since the
  // modal's visible prop hadn't flipped to re-trigger anything.
  useEffect(() => {
    if (visible) {
      fetchInsight()
    }
  }, [visible, period, contextData])

  function handleClose() {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 40, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setIsMounted(false)
      setResult(null)
      onClose()
    })
  }

  if (!visible && !isMounted) return null

  return (
    <Modal transparent visible={visible || isMounted} animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />
      </Animated.View>

      <View style={s.centerWrap} pointerEvents="box-none">
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={['rgba(124,58,237,0.14)', 'rgba(5,5,15,0.97)']} style={StyleSheet.absoluteFillObject} />

          {/* Verdict band — the visually distinct header: full-width gold
              band rather than a small symbol+title row like the chart popup */}
          <LinearGradient
            colors={['rgba(201,168,76,0.22)', 'rgba(201,168,76,0.05)']}
            style={s.verdictBand}
          >
            <View style={s.verdictTopRow}>
              <Text style={s.verdictEyebrow}>ORACLE BRIEFING · {periodLabel.toUpperCase()}</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.closeX}>✕</Text>
              </TouchableOpacity>
            </View>
            {!isLoading && result?.verdict ? (
              <Text style={s.verdictText}>{result.verdict}</Text>
            ) : !isLoading && errorMsg ? null : (
              <Text style={[s.verdictText, { opacity: 0.4 }]}>Reading the current sky...</Text>
            )}
          </LinearGradient>

          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            {isLoading && <LoadingBriefing />}

            {!isLoading && errorMsg && (
              <View style={s.errorWrap}>
                <Text style={s.errorSymbol}>⚠</Text>
                <Text style={s.errorText}>{errorMsg}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={fetchInsight}>
                  <Text style={s.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isLoading && result && (
              <Animated.View style={{ opacity: contentAnim }}>
                {/* Two-column checklist — the structurally distinct centerpiece */}
                <View style={s.checklistRow}>
                  <ChecklistColumn title="DO NOW" items={result.doNow} color={GREEN} icon="✓" />
                  <ChecklistColumn title="AVOID NOW" items={result.avoidNow} color={RED} icon="✗" />
                </View>

                {/* Best window strip */}
                {result.bestWindow ? (
                  <View style={s.windowStrip}>
                    <Text style={s.windowLabel}>◈ BEST WINDOW</Text>
                    <Text style={s.windowText}>{result.bestWindow}</Text>
                  </View>
                ) : null}

                {/* Watch-for caution card */}
                {result.watchFor ? (
                  <View style={s.watchCard}>
                    <Text style={s.watchLabel}>⚠ WATCH FOR</Text>
                    <Text style={s.watchText}>{result.watchFor}</Text>
                  </View>
                ) : null}

                <View style={{ height: 8 }} />
              </Animated.View>
            )}
          </ScrollView>

          <View style={s.footer}>
            <Text style={s.footerBrand}>Zephyra Oracle ✦ Forecast Briefing</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,15,0.86)' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_W, maxHeight: CARD_MAX_H, borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.22)',
    ...Platform.select({
      ios: { shadowColor: GOLD, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24 },
      android: { elevation: 18 },
    }),
  },
  verdictBand: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  verdictTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  verdictEyebrow: { fontFamily: Fonts.accent, fontSize: 9, color: GOLD, letterSpacing: 2 },
  closeX: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  verdictText: { fontFamily: Fonts.mystical, fontSize: 17, color: Colors.textPrimary, lineHeight: 24 },
  scroll: { flex: 1 },
  scrollContent: { padding: 18, paddingTop: 16 },
  checklistRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  windowStrip: {
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
    backgroundColor: 'rgba(201,168,76,0.08)', padding: 14, marginBottom: 12,
  },
  windowLabel: { fontFamily: Fonts.accent, fontSize: 9, color: GOLD, letterSpacing: 1.5, marginBottom: 6 },
  windowText: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  watchCard: {
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,68,68,0.3)',
    backgroundColor: 'rgba(255,68,68,0.06)', padding: 14,
  },
  watchLabel: { fontFamily: Fonts.accent, fontSize: 9, color: RED, letterSpacing: 1.5, marginBottom: 6 },
  watchText: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  errorWrap: { alignItems: 'center', padding: 32, gap: 12 },
  errorSymbol: { fontSize: 26, color: 'rgba(201,168,76,0.5)' },
  errorText: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 6, paddingHorizontal: 22, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', backgroundColor: 'rgba(201,168,76,0.08)' },
  retryText: { fontFamily: Fonts.accent, fontSize: 10, color: GOLD, letterSpacing: 1 },
  footer: { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  footerBrand: { fontFamily: Fonts.accent, fontSize: 7, color: 'rgba(201,168,76,0.35)', letterSpacing: 1.5 },
})
