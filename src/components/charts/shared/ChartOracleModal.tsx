// src/components/charts/shared/ChartOracleModal.tsx
// Universal AI-powered tap-for-description popup used by all 5 chart components.
// Calls getChartInsight() on mount, parses the 3-section plain-text response,
// and renders each section with its own styled block.
// Never import this from outside — always use the named export ChartOracleModal.

import React, { useEffect, useRef, useState } from 'react'
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
import { getChartInsight } from '../../../services/nvidiaAI'
import { Fonts } from '../../../constants/fonts'
import type { Language } from '../../../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const CARD_W = SCREEN_W * 0.92
const CARD_MAX_H = SCREEN_H * 0.78
const GOLD = '#C9A84C'

// Section header labels as they appear in the AI's plain-text response.
// The AI is instructed to use these exact headers (translated when needed).
// We split on them to extract each paragraph.
// We also keep English fallbacks for the rare case translation is inconsistent.
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
  contextData: string       // assembled by the calling chart component
  language: Language        // from useSettingsStore
  accentColor?: string      // theme color for Section 2 accent bar (defaults to gold)
  apiKey?: string           // optional API key override
}

interface ParsedSections {
  interpretation: string
  effects:        string
  remedies:       string[]  // split into individual remedy sentences
}

// ─── Text parser ──────────────────────────────────────────────────────────────
// The AI returns plain text with section headers in ALL CAPS on their own line.
// We locate each header and extract the paragraph that follows it.

function parseSections(raw: string): ParsedSections | null {
  if (!raw || raw.trim().length === 0) return null

  const text = raw.trim()

  // Find the index of the first match for a set of candidate header strings
  function findHeader(candidates: readonly string[]): number {
    let earliest = -1
    for (const candidate of candidates) {
      // Case-insensitive search on full lines
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

  // Need at least one recognized section
  if (iIdx === -1 && eIdx === -1 && rIdx === -1) {
    // Fallback: treat the whole response as interpretation
    return {
      interpretation: text,
      effects: '',
      remedies: [],
    }
  }

  // Sort section positions to know where each ends
  const positions = [
    { key: 'i' as const, idx: iIdx },
    { key: 'e' as const, idx: eIdx },
    { key: 'r' as const, idx: rIdx },
  ]
    .filter(p => p.idx !== -1)
    .sort((a, b) => a.idx - b.idx)

  function extractAfterHeader(startIdx: number, nextIdx: number): string {
    // Skip the header line itself (find the next newline after startIdx)
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

  // Split remedies paragraph into individual sentences / items.
  // The AI typically writes them as numbered items or as a flowing paragraph.
  // We try numbered split first, then fall back to sentence split.
  let remedies: string[] = []
  if (remediesRaw) {
    // Try splitting on numbered list markers: "1.", "2.", "3." or "1)", "2)"
    const numbered = remediesRaw.split(/\n?\s*\d+[.)]\s+/).filter(s => s.trim().length > 0)
    if (numbered.length >= 2) {
      remedies = numbered.map(s => s.trim())
    } else {
      // Fall back: split on sentence boundaries, keep groups of 1-2 sentences per pill
      const sentences = remediesRaw.split(/(?<=[.!?])\s+/)
      if (sentences.length >= 3) {
        // Group every 1–2 sentences into a remedy pill
        const grouped: string[] = []
        for (let i = 0; i < sentences.length; i += 2) {
          const chunk = [sentences[i], sentences[i + 1]].filter(Boolean).join(' ')
          if (chunk.trim()) grouped.push(chunk.trim())
        }
        remedies = grouped
      } else {
        // Last resort: show as single pill
        remedies = [remediesRaw.trim()]
      }
    }
  }

  return { interpretation, effects, remedies }
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonBars({ symbol, symbolColor }: { symbol: string; symbolColor: string }) {
  // Three shimmer bars of varying widths
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ]
  const pulseAnim = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    // Staggered shimmer on each bar
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        ])
      )
    )
    loops.forEach(l => l.start())

    // Pulsing symbol below bars
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      ])
    )
    pulse.start()

    return () => {
      loops.forEach(l => l.stop())
      pulse.stop()
    }
  }, [])

  const barWidths = ['92%', '78%', '85%'] as const

  return (
    <View style={sk.wrapper}>
      {/* Section block skeletons — one per section */}
      {[0, 1, 2].map(sectionIdx => (
        <View key={sectionIdx} style={sk.sectionBlock}>
          {/* Section label skeleton */}
          <Animated.View
            style={[sk.labelBar, { opacity: anims[sectionIdx] }]}
          />
          {/* Content bars */}
          {[barWidths[sectionIdx], '70%', sectionIdx < 2 ? '88%' : '60%'].map((w, lineIdx) => (
            <Animated.View
              key={lineIdx}
              style={[sk.bar, { width: w as any, opacity: anims[sectionIdx] }]}
            />
          ))}
        </View>
      ))}

      {/* Pulsing mystic symbol */}
      <Animated.Text
        style={[sk.symbol, { color: symbolColor, opacity: pulseAnim }]}
      >
        {symbol}
      </Animated.Text>
      <Animated.Text
        style={[sk.loadingText, { opacity: pulseAnim }]}
      >
        Oracle is reading your chart...
      </Animated.Text>
    </View>
  )
}

const sk = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
  },
  sectionBlock: {
    width: '100%',
    marginBottom: 24,
  },
  labelBar: {
    height: 8,
    width: '35%',
    backgroundColor: 'rgba(201,168,76,0.25)',
    borderRadius: 4,
    marginBottom: 10,
  },
  bar: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    marginBottom: 8,
  },
  symbol: {
    fontFamily: Fonts.accent,
    fontSize: 28,
    marginTop: 8,
    marginBottom: 8,
  },
  loadingText: {
    fontFamily: Fonts.mystical,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.5,
    marginTop: 4,
  },
})

// ─── Content sections ──────────────────────────────────────────────────────────

function SectionBlock({
  label,
  text,
  accentColor,
}: {
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
  wrapper: {
    flexDirection: 'row',
    marginBottom: 22,
    paddingHorizontal: 20,
  },
  accentBar: {
    width: 2,
    borderRadius: 1,
    marginRight: 14,
    opacity: 0.65,
    minHeight: 40,
  },
  content: { flex: 1 },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  dot: {
    color: GOLD,
    fontSize: 13,
    marginRight: 10,
    marginTop: 1,
    lineHeight: 20,
  },
  text: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 21,
    flex: 1,
  },
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
  language,
  accentColor = GOLD,
  apiKey,
}: ChartOracleModalProps) {

  // ── Animation refs ──────────────────────────────────────────────────────────
  const slideAnim    = useRef(new Animated.Value(600)).current
  const backdropAnim = useRef(new Animated.Value(0)).current
  const contentAnim  = useRef(new Animated.Value(0)).current

  // ── AI content state ────────────────────────────────────────────────────────
  const [isLoading,  setIsLoading]  = useState(true)
  const [sections,   setSections]   = useState<ParsedSections | null>(null)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)

  // Track whether this instance has already fetched (avoid double-fire in StrictMode)
  const hasFetched = useRef(false)

  // ── Mount: animate in + start AI call ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return

    // Reset state when re-opened with new context
    setIsLoading(true)
    setSections(null)
    setErrorMsg(null)
    hasFetched.current = false

    // Reset animation values
    slideAnim.setValue(600)
    backdropAnim.setValue(0)
    contentAnim.setValue(0)

    // Slide card up + fade backdrop simultaneously
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()

    // Fire AI call immediately — don't wait for animation
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchInsight()
    }
  }, [visible, contextData])

  // ── Fetch from AI ───────────────────────────────────────────────────────────
  async function fetchInsight() {
    try {
      const raw = await getChartInsight(
        title,
        contextData,
        language.promptInstruction,
        apiKey,
      )

      if (!raw || raw.trim().length === 0) {
        setErrorMsg('The oracle is quiet right now. Please try again in a moment.')
        setIsLoading(false)
        return
      }

      const parsed = parseSections(raw)
      if (!parsed) {
        setErrorMsg('Could not read the oracle\'s response. Please try again.')
        setIsLoading(false)
        return
      }

      setSections(parsed)
      setIsLoading(false)

      // Fade content in after data arrives
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start()

    } catch (e: any) {
      setErrorMsg('The oracle encountered an error. Please close and try again.')
      setIsLoading(false)
    }
  }

  // ── Close animation ─────────────────────────────────────────────────────────
  function handleClose() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onClose())
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!visible) return null

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop — tap to dismiss */}
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
      <Animated.View
        style={[
          s.card,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Layer 1: blur */}
        <BlurView
          intensity={30}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, s.blurRadius]}
        />

        {/* Layer 2: dark gradient overlay */}
        <LinearGradient
          colors={['rgba(13,13,43,0.97)', 'rgba(5,5,15,0.99)']}
          style={[StyleSheet.absoluteFillObject, s.blurRadius]}
        />

        {/* Layer 3: 2px gold top border strip — the Zephyra signature */}
        <View style={s.goldStrip} />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          {/* Symbol icon */}
          <View style={[s.symbolWrap, { borderColor: symbolColor + '30' }]}>
            <Text style={[s.symbolText, { color: symbolColor }]}>{symbol}</Text>
          </View>

          {/* Title + subtitle */}
          <View style={s.headerTextWrap}>
            <Text style={s.title} numberOfLines={2}>{title}</Text>
            <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={s.closeBtn}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <View style={s.divider} />

        {/* ── Scrollable content ──────────────────────────────────────────── */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* Loading skeleton */}
          {isLoading && (
            <SkeletonBars symbol={symbol} symbolColor={symbolColor} />
          )}

          {/* Error state */}
          {!isLoading && errorMsg && (
            <View style={s.errorWrap}>
              <Text style={s.errorSymbol}>⚠</Text>
              <Text style={s.errorText}>{errorMsg}</Text>
              <TouchableOpacity
                style={s.retryBtn}
                onPress={() => {
                  setIsLoading(true)
                  setErrorMsg(null)
                  hasFetched.current = false
                  fetchInsight()
                }}
              >
                <Text style={s.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Content — fades in after AI responds */}
          {!isLoading && sections && (
            <Animated.View style={{ opacity: contentAnim }}>

              {/* Section 1 — INTERPRETATION (gold accent bar) */}
              <SectionBlock
                label="INTERPRETATION"
                text={sections.interpretation}
                accentColor={GOLD}
              />

              {/* Section 2 — EFFECTS (chart theme accent bar) */}
              <SectionBlock
                label="EFFECTS ON YOUR LIFE"
                text={sections.effects}
                accentColor={accentColor}
              />

              {/* Section 3 — REMEDIES (pill chips) */}
              {sections.remedies.length > 0 && (
                <View style={s.remediesBlock}>
                  <Text style={s.remediesLabel}>REMEDIES &amp; SOLUTIONS</Text>
                  {sections.remedies.map((remedy, i) => (
                    <RemedyPill key={i} text={remedy} />
                  ))}
                </View>
              )}

              {/* Bottom spacer */}
              <View style={{ height: 16 }} />
            </Animated.View>
          )}
        </ScrollView>

        {/* ── Footer: language pill ───────────────────────────────────────── */}
        <View style={s.footer}>
          <View style={s.langPill}>
            <Text style={s.langFlag}>{language.flag}</Text>
            <Text style={s.langName}>{language.nativeName}</Text>
          </View>
          <Text style={s.footerBrand}>Zephyra Oracle  ✦</Text>
        </View>
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,15,0.88)',
  },

  // Card — pinned to bottom, slides up
  card: {
    position: 'absolute',
    bottom: 0,
    left: (SCREEN_W - CARD_W) / 2,
    width: CARD_W,
    maxHeight: CARD_MAX_H,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    // Subtle outer border along the rounded top edges
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderBottomWidth: 0,
    // iOS shadow
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

  // Shared border radius applied to absolute fill layers
  blurRadius: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // 2px gold strip — Zephyra signature
  goldStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: GOLD,
    zIndex: 10,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 20,   // clears the 2px gold strip + adds breathing room
    paddingBottom: 14,
    gap: 12,
    zIndex: 5,
  },
  symbolWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  symbolText: {
    fontSize: 20,
    lineHeight: 24,
  },
  headerTextWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    color: GOLD,
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  subtitle: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeBtnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
    fontFamily: Fonts.body,
  },

  // ── Divider ─────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.2)',
    marginHorizontal: 0,
    zIndex: 5,
  },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
    zIndex: 5,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 12,
  },

  // ── Remedies block (has its own horizontal padding for label) ───────────────
  remediesBlock: {
    marginBottom: 4,
  },
  remediesLabel: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 20,
  },

  // ── Error state ─────────────────────────────────────────────────────────────
  errorWrap: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  errorSymbol: {
    fontSize: 28,
    color: 'rgba(201,168,76,0.5)',
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  retryText: {
    fontFamily: Fonts.accent,
    fontSize: 11,
    color: GOLD,
    letterSpacing: 1,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    zIndex: 5,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  langFlag: {
    fontSize: 12,
    lineHeight: 16,
  },
  langName: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  footerBrand: {
    fontFamily: Fonts.accent,
    fontSize: 7,
    color: 'rgba(201,168,76,0.3)',
    letterSpacing: 1.5,
  },
})
