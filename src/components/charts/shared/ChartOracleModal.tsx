// src/components/charts/shared/ChartOracleModal.tsx
// Universal AI-powered tap-for-description popup used by all 5 chart components.
// Calls getChartInsight() on mount, parses the 3-section plain-text response,
// and renders each section with its own styled block.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { getChartInsight } from '../../../services/groqAI'
import { Fonts } from '../../../constants/fonts'
import { Colors } from '../../../constants/colors'
import type { Language } from '../../../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = SCREEN_W * 0.92
const CARD_MAX_H = SCREEN_H * 0.78
const GOLD = '#C9A84C'

// FIX: Default English language object used when language prop is undefined/null.
// Callers that haven't wired useSettingsStore yet won't crash.
const FALLBACK_LANGUAGE: Language = {
  code: 'en',
  name: 'English',
  nativeName: 'English',
  flag: '🇬🇧',
  promptInstruction: '',
}

// Section header labels as they appear in the AI's plain-text response.
const SECTION_KEYS = {
  interpretation: ['INTERPRETATION'],
  effects:        ['EFFECTS ON YOUR LIFE', 'EFFECTS'],
  remedies:       ['REMEDIES & SOLUTIONS', 'REMEDIES'],
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChartOracleModalProps {
  visible: boolean
  onClose: () => void
  title: string
  subtitle: string
  symbolColor: string
  symbol: string
  contextData: string
  // FIX: language is now optional — falls back to English if not provided
  language?: Language
  accentColor?: string
  apiKey?: string
}

interface ParsedSections {
  interpretation: string
  effects:        string
  remedies:       string[]
}

// ─── Text parser ──────────────────────────────────────────────────────────────

function parseSections(raw: string): ParsedSections | null {
  if (!raw || raw.trim().length === 0) return null

  const text = raw.trim()

  function findHeader(candidates: readonly string[]): number {
    let earliest = -1
    for (const candidate of candidates) {
      const pattern = new RegExp(`^${candidate}\\s*$`, 'im')
      const match = pattern.exec(text)
      if (match && match.index !== undefined) {
        if (earliest === -1 || match.index < earliest) {
          earliest = match.index
        }
      }
    }
    return earliest
  }

  const iIdx = findHeader(SECTION_KEYS.interpretation)
  const eIdx = findHeader(SECTION_KEYS.effects)
  const rIdx = findHeader(SECTION_KEYS.remedies)

  if (iIdx === -1 && eIdx === -1 && rIdx === -1) {
    return { interpretation: text, effects: '', remedies: [] }
  }

  const positions = [
    { key: 'i' as const, idx: iIdx },
    { key: 'e' as const, idx: eIdx },
    { key: 'r' as const, idx: rIdx },
  ]
    .filter(p => p.idx !== -1)
    .sort((a, b) => a.idx - b.idx)

  function extractAfterHeader(startIdx: number, nextIdx: number): string {
    const afterNewline = text.indexOf('\n', startIdx)
    if (afterNewline === -1) return ''
    const start = afterNewline + 1
    const end = nextIdx === -1 ? text.length : nextIdx
    return text.slice(start, end).trim()
  }

  let interpretation = ''
  let effects = ''
  let remediesRaw = ''

  for (let i = 0; i < positions.length; i++) {
    const cur = positions[i]
    const next = positions[i + 1]
    const nextIdx = next ? next.idx : -1
    const content = extractAfterHeader(cur.idx, nextIdx)
    if (cur.key === 'i') interpretation = content
    else if (cur.key === 'e') effects = content
    else if (cur.key === 'r') remediesRaw = content
  }

  let remedies: string[] = []
  if (remediesRaw) {
    // Try numbered list first: "1.", "2." or "1)", "2)"
    const numbered = remediesRaw.split(/\n?\s*\d+[.)]\s+/).filter(s => s.trim().length > 0)
    if (numbered.length >= 2) {
      remedies = numbered.map(s => s.trim())
    } else {
      // FIX: Avoid lookbehind regex — not supported on older Hermes/Android engines.
      // Instead split on ". " and re-attach the period.
      const sentences = remediesRaw
        .split('. ')
        .map((s, i, arr) => (i < arr.length - 1 ? s + '.' : s))
        .filter(s => s.trim().length > 2)

      if (sentences.length >= 3) {
        const grouped: string[] = []
        for (let i = 0; i < sentences.length; i += 2) {
          const chunk = [sentences[i], sentences[i + 1]].filter(Boolean).join(' ')
          if (chunk.trim()) grouped.push(chunk.trim())
        }
        remedies = grouped
      } else {
        remedies = [remediesRaw.trim()]
      }
    }
  }

  return { interpretation, effects, remedies }
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonBars({ symbol, symbolColor }: { symbol: string; symbolColor: string }) {
  const anim0 = useRef(new Animated.Value(0)).current
  const anim1 = useRef(new Animated.Value(0)).current
  const anim2 = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const makeLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        ])
      )

    const l0 = makeLoop(anim0, 0)
    const l1 = makeLoop(anim1, 120)
    const l2 = makeLoop(anim2, 240)
    l0.start(); l1.start(); l2.start()

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    )
    pulse.start()

    return () => { l0.stop(); l1.stop(); l2.stop(); pulse.stop() }
  }, [])

  const anims = [anim0, anim1, anim2]
  const barWidths = ['92%', '78%', '85%'] as const

  return (
    <View style={sk.wrapper}>
      {[0, 1, 2].map(idx => (
        <View key={idx} style={sk.sectionBlock}>
          <Animated.View style={[sk.labelBar, { opacity: anims[idx] }]} />
          {[barWidths[idx], '70%', idx < 2 ? '88%' : '60%'].map((w, li) => (
            <Animated.View key={li} style={[sk.bar, { width: w as any, opacity: anims[idx] }]} />
          ))}
        </View>
      ))}
      <Animated.Text style={[sk.symbol, { color: symbolColor, opacity: pulseAnim }]}>
        {symbol}
      </Animated.Text>
      <Animated.Text style={[sk.loadingText, { opacity: pulseAnim }]}>
        Oracle is reading your chart...
      </Animated.Text>
    </View>
  )
}

const sk = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, alignItems: 'center' },
  sectionBlock: { width: '100%', marginBottom: 24 },
  labelBar: {
    height: 8, width: '35%',
    backgroundColor: 'rgba(201,168,76,0.25)',
    borderRadius: 4, marginBottom: 10,
  },
  bar: {
    height: 12, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6, marginBottom: 8,
  },
  symbol: { fontFamily: Fonts.accent, fontSize: 28, marginTop: 8, marginBottom: 8 },
  loadingText: {
    fontFamily: Fonts.mystical, fontSize: 12,
    color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5, marginTop: 4,
  },
})

// ─── Content sections ─────────────────────────────────────────────────────────

function SectionBlock({ label, text, accentColor }: {
  label: string
  text: string
  accentColor: string
}) {
  if (!text) return null
  return (
    <View style={sb.wrapper}>
      <View style={[sb.accentBar, { backgroundColor: accentColor }]} />
      <View style={sb.content}>
        <Text style={sb.label}>{label}</Text>
        <Text style={sb.body}>{text}</Text>
      </View>
    </View>
  )
}

const sb = StyleSheet.create({
  wrapper: { flexDirection: 'row', marginBottom: 22, paddingHorizontal: 20 },
  accentBar: { width: 2, borderRadius: 1, marginRight: 14, opacity: 0.65, minHeight: 40 },
  content: { flex: 1 },
  label: {
    fontFamily: Fonts.accent, fontSize: 8,
    color: 'rgba(255,255,255,0.3)', letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 8,
  },
  body: { fontFamily: Fonts.body, fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 24 },
})

// ─── Effects card (violet-bordered, as per design bible) ──────────────────────

function EffectsCard({ text, accentColor }: { text: string; accentColor: string }) {
  if (!text) return null
  return (
    <View style={[ec.card, { borderColor: `${Colors.primaryViolet}55` }]}>
      {/* Violet glow border overlay — fades at corners */}
      <LinearGradient
        colors={[`${Colors.primaryViolet}22`, 'transparent', `${Colors.primaryViolet}18`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, ec.cardGlow]}
      />
      {/* Top accent line in accentColor (teal for Gochar, gold for others) */}
      <View style={[ec.topAccent, { backgroundColor: accentColor }]} />
      <View style={ec.inner}>
        <View style={ec.labelRow}>
          {/* Violet dot */}
          <View style={[ec.dot, { backgroundColor: Colors.primaryViolet }]} />
          <Text style={ec.label}>EFFECTS ON YOUR LIFE</Text>
        </View>
        <Text style={ec.body}>{text}</Text>
      </View>
    </View>
  )
}

const ec = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 22,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: `${Colors.primaryViolet}0D`,   // 5% violet tint
    ...Platform.select({
      ios: {
        shadowColor: Colors.primaryViolet,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  cardGlow: {
    borderRadius: 16,
  },
  topAccent: {
    height: 2,
    opacity: 0.75,
  },
  inner: {
    padding: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.8,
  },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: `${Colors.primaryViolet}CC`,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 24,
  },
})

// ─── Remedy pill ──────────────────────────────────────────────────────────────

function RemedyPill({ text }: { text: string }) {
  if (!text.trim()) return null
  return (
    <View style={rp.pill}>
      <Text style={rp.dot}>◈</Text>
      <Text style={rp.text}>{text.trim()}</Text>
    </View>
  )
}

const rp = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 12, padding: 12, marginBottom: 8, marginHorizontal: 20,
  },
  dot: { color: GOLD, fontSize: 13, marginRight: 10, marginTop: 1, lineHeight: 20 },
  text: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 21, flex: 1 },
})

// ─── Main component ───────────────────────────────────────────────────────────

export function ChartOracleModal({
  visible,
  onClose,
  title,
  subtitle,
  symbolColor,
  symbol,
  contextData,
  language,        // FIX: optional — falls back to FALLBACK_LANGUAGE
  accentColor = GOLD,
  apiKey,
}: ChartOracleModalProps) {

  // FIX: Resolve language once, guard against undefined/null from callers
  const lang = language ?? FALLBACK_LANGUAGE

  // FIX: Keep language in a ref so fetchInsight always reads the latest value
  // even if props change between the AI call starting and finishing.
  const langRef = useRef(lang)
  useEffect(() => { langRef.current = lang }, [lang])

  // ── Animation refs ──────────────────────────────────────────────────────────
  const slideAnim    = useRef(new Animated.Value(SCREEN_H)).current
  const backdropAnim = useRef(new Animated.Value(0)).current
  const contentAnim  = useRef(new Animated.Value(0)).current

  // FIX: Track render visibility separately from `visible` prop so the
  // card stays mounted during the close animation and doesn't snap away.
  const [isMounted, setIsMounted] = useState(false)

  // ── AI content state ────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true)
  const [sections,  setSections]  = useState<ParsedSections | null>(null)
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)

  const hasFetched = useRef(false)

  // ── Open: mount → animate in → fetch ───────────────────────────────────────
  useEffect(() => {
    if (!visible) return

    // Reset everything for a fresh open
    setIsMounted(true)
    setIsLoading(true)
    setSections(null)
    setErrorMsg(null)
    hasFetched.current = false

    // FIX: Start from bottom of screen (not 600 — ensures card is fully offscreen
    // regardless of device height, preventing a flash of the card at wrong position)
    slideAnim.setValue(SCREEN_H)
    backdropAnim.setValue(0)
    contentAnim.setValue(0)

    // FIX: spring for slide-up gives natural feel; timing for backdrop is crisp
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 24,       // slightly more damping = less bounce = smoother
        stiffness: 220,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start()

    hasFetched.current = true
    fetchInsight()
  }, [visible, contextData])

  // ── Fetch from AI ───────────────────────────────────────────────────────────
  // FIX: useCallback so retryBtn can call the same stable reference
  const fetchInsight = useCallback(async () => {
    try {
      const raw = await getChartInsight(
        title,
        contextData,
        // FIX: Always read from langRef — avoids stale closure if language changes mid-flight
        langRef.current.promptInstruction,
      )

      if (!raw || raw.trim().length === 0) {
        setErrorMsg('The oracle is quiet right now. Please try again in a moment.')
        setIsLoading(false)
        return
      }

      const parsed = parseSections(raw)
      if (!parsed) {
        setErrorMsg("Could not read the oracle's response. Please try again.")
        setIsLoading(false)
        return
      }

      setSections(parsed)
      setIsLoading(false)
      Animated.timing(contentAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()

    } catch {
      setErrorMsg('The oracle encountered an error. Please close and try again.')
      setIsLoading(false)
    }
  }, [title, contextData])

  // ── Close: animate out → unmount ────────────────────────────────────────────
  // FIX: Card stays mounted during the close animation, then unmounts cleanly.
  // Previously returning null while visible=false caused the spring to never play.
  function handleClose() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsMounted(false)
      onClose()
    })
  }

  // FIX: Render nothing if we have never been opened. Once opened, keep mounted
  // until the close animation completes (isMounted controls this).
  if (!visible && !isMounted) return null

  return (
    <Modal
      transparent
      // FIX: visible tied to isMounted so Modal stays open during close animation
      visible={visible || isMounted}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[s.backdrop, { opacity: backdropAnim }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={handleClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Card — slides up from bottom */}
      <Animated.View style={[s.card, { transform: [{ translateY: slideAnim }] }]}>

        {/* Layer 1: blur */}
        <BlurView intensity={30} tint="dark" style={[StyleSheet.absoluteFillObject, s.blurRadius]} />

        {/* Layer 2: dark gradient */}
        <LinearGradient
          colors={['rgba(13,13,43,0.97)', 'rgba(5,5,15,0.99)']}
          style={[StyleSheet.absoluteFillObject, s.blurRadius]}
        />

        {/* Layer 3: gold signature strip */}
        <View style={s.goldStrip} />

        {/* Header */}
        <View style={s.header}>
          <View style={[s.symbolWrap, { borderColor: symbolColor + '30' }]}>
            <Text style={[s.symbolText, { color: symbolColor }]}>{symbol}</Text>
          </View>
          <View style={s.headerTextWrap}>
            <Text style={s.title} numberOfLines={2}>{title}</Text>
            <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={s.divider} />

        {/* Scrollable content */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {isLoading && <SkeletonBars symbol={symbol} symbolColor={symbolColor} />}

          {!isLoading && errorMsg && (
            <View style={s.errorWrap}>
              <Text style={s.errorSymbol}>⚠</Text>
              <Text style={s.errorText}>{errorMsg}</Text>
              <TouchableOpacity
                style={s.retryBtn}
                onPress={() => {
                  setIsLoading(true)
                  setErrorMsg(null)
                  fetchInsight()
                }}
              >
                <Text style={s.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLoading && sections && (
            <Animated.View style={{ opacity: contentAnim }}>
              <SectionBlock
                label="INTERPRETATION"
                text={sections.interpretation}
                accentColor={GOLD}
              />
              <EffectsCard
                text={sections.effects}
                accentColor={accentColor}
              />
              {/* FIX: Was &amp; — now correctly renders the & character */}
              {sections.remedies.length > 0 && (
                <View style={s.remediesBlock}>
                  <Text style={s.remediesLabel}>REMEDIES & SOLUTIONS</Text>
                  {sections.remedies.map((remedy, i) => (
                    <RemedyPill key={i} text={remedy} />
                  ))}
                </View>
              )}
              <View style={{ height: 16 }} />
            </Animated.View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.langPill}>
            <Text style={s.langFlag}>{lang.flag}</Text>
            <Text style={s.langName}>{lang.nativeName}</Text>
          </View>
          <Text style={s.footerBrand}>Zephyra Oracle  ✦</Text>
        </View>
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,15,0.88)',
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: (SCREEN_W - CARD_W) / 2,
    width: CARD_W,
    maxHeight: CARD_MAX_H,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderBottomWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 20 },
    }),
  },
  blurRadius: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  goldStrip: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 2, backgroundColor: GOLD, zIndex: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 14,
    gap: 12, zIndex: 5,
  },
  symbolWrap: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  symbolText: { fontSize: 20, lineHeight: 24 },
  headerTextWrap: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.heading, fontSize: 17,
    color: GOLD, letterSpacing: 0.5, lineHeight: 22,
  },
  subtitle: {
    fontFamily: Fonts.accent, fontSize: 9,
    color: 'rgba(255,255,255,0.35)', letterSpacing: 2, textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  closeBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 16, fontFamily: Fonts.body },
  divider: { height: 1, backgroundColor: 'rgba(201,168,76,0.2)', zIndex: 5 },
  scroll: { flex: 1, zIndex: 5 },
  scrollContent: { paddingTop: 20, paddingBottom: 12 },
  remediesBlock: { marginBottom: 4 },
  remediesLabel: {
    fontFamily: Fonts.accent, fontSize: 8,
    color: 'rgba(255,255,255,0.3)', letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 10, paddingHorizontal: 20,
  },
  errorWrap: { alignItems: 'center', padding: 32, gap: 12 },
  errorSymbol: { fontSize: 28, color: 'rgba(201,168,76,0.5)' },
  errorText: {
    fontFamily: Fonts.body, fontSize: 14,
    color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)', backgroundColor: 'rgba(201,168,76,0.08)',
  },
  retryText: { fontFamily: Fonts.accent, fontSize: 11, color: GOLD, letterSpacing: 1 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', zIndex: 5,
  },
  langPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  langFlag: { fontSize: 12, lineHeight: 16 },
  langName: { fontFamily: Fonts.accent, fontSize: 8, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  footerBrand: { fontFamily: Fonts.accent, fontSize: 7, color: 'rgba(201,168,76,0.3)', letterSpacing: 1.5 },
})
