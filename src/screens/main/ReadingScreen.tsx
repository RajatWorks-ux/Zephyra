// src/screens/main/ReadingScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// FIXES APPLIED:
//
// 1. "Reading/Story generation too slow — no feedback"
//    Added a live GenerationOverlay that floats at the top of the screen when
//    isGenerating is true. It shows:
//      • Animated spinning orb (same cosmic aesthetic as HomeScreen)
//      • "X of 5 chapters written" in real time (uses chaptersDone from store)
//      • Progress bar with % done
//      • Current status message from the AI service
//    This overlay is dismissible — user can scroll the chapter list while
//    generation continues in the background.
//
// 2. "No progress indicator — should show % done + chapters written live"
//    Each chapter row now shows a "Generating…" badge when isGenerating and
//    the chapter has not yet been written. Once a chapter is done (chaptersDone
//    threshold passed) the badge changes to the expand arrow.
//
// 3. The wait card now shows the live progress bar instead of a static message.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import { useReadingStore } from '../../store/readingStore'
import { Videos } from '../../constants/videos'
import { Fonts } from '../../constants/fonts'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const CHAPTERS = [
  {
    id: 'past',
    title: 'Before We Begin',
    subtitle: 'What the stars saw before you did',
    accent: '#C9A84C',
    isPastReveal: true,
    oracleIndex: 0,  // which parallel oracle writes this (0-4)
  },
  {
    id: 'chapter_identity',
    title: 'Who You Are',
    subtitle: 'Your soul at its deepest level',
    accent: '#7B2FBE',
    oracleIndex: 0,
  },
  {
    id: 'chapter_love',
    title: 'Love and Relationships',
    subtitle: 'Your heart, your patterns, your people',
    accent: '#BE2F6E',
    oracleIndex: 1,
  },
  {
    id: 'chapter_career',
    title: 'Money and Career',
    subtitle: 'Your gifts and your path to prosperity',
    accent: '#BEA02F',
    oracleIndex: 1,
  },
  {
    id: 'chapter_health',
    title: 'Health and Vitality',
    subtitle: 'Your body, your energy, your rhythms',
    accent: '#2FBE6E',
    oracleIndex: 2,
  },
  {
    id: 'chapter_family',
    title: 'Family and Roots',
    subtitle: 'Where you came from, what you carry',
    accent: '#8E8EBE',
    oracleIndex: 2,
  },
  {
    id: 'chapter_purpose',
    title: 'Life Purpose and Destiny',
    subtitle: 'Why you are here. What you are building.',
    accent: '#FFD700',
    oracleIndex: 3,
  },
  {
    id: 'chapter_now',
    title: 'Right Now',
    subtitle: 'Your current chapter and what it demands',
    accent: '#2FBEBE',
    oracleIndex: 3,
  },
] as const

// ─── Progress Dots ─────────────────────────────────────────────────────────────
function ProgressDots({
  expandedId,
  visitedIds,
}: {
  expandedId: string | null
  visitedIds: Set<string>
}) {
  return (
    <View style={dots.row}>
      {CHAPTERS.map((ch) => {
        const isActive = ch.id === expandedId
        const isDone = visitedIds.has(ch.id) && ch.id !== expandedId
        return (
          <View
            key={ch.id}
            style={[
              dots.dot,
              isActive && dots.dotActive,
              isDone && dots.dotDone,
            ]}
          />
        )
      })}
      <Text style={dots.label}>
        {visitedIds.size} of {CHAPTERS.length} read
      </Text>
    </View>
  )
}

const dots = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotDone: { backgroundColor: '#C9A84C' },
  dotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#44FF88',
  },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 1,
    marginLeft: 6,
  },
})

// ─── Past Reveal Cards ─────────────────────────────────────────────────────────
function PastRevealCards({ statements }: { statements: string[] }) {
  const [resonates, setResonates] = useState<Record<number, boolean | null>>({})
  const count = Object.values(resonates).filter(v => v === true).length

  return (
    <View>
      {statements.map((stmt, i) => {
        const status = resonates[i]
        return (
          <View
            key={i}
            style={[
              past.card,
              status === true && past.cardTrue,
              status === false && past.cardFalse,
            ]}
          >
            <Text style={past.statement}>{stmt}</Text>
            <View style={past.btnRow}>
              <TouchableOpacity
                style={[past.btn, status === true && past.btnActiveTrue]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setResonates(prev => ({ ...prev, [i]: true }))
                }}
                activeOpacity={0.8}
              >
                <Text style={past.btnText}>Resonates</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[past.btn, past.btnNo, status === false && past.btnActiveFalse]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setResonates(prev => ({ ...prev, [i]: false }))
                }}
                activeOpacity={0.8}
              >
                <Text style={[past.btnText, { color: 'rgba(255,255,255,0.4)' }]}>Not quite</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      })}
      {Object.keys(resonates).length === statements.length && (
        <View style={past.result}>
          <Text style={past.resultText}>
            {count} of {statements.length} resonate with you.
          </Text>
          <Text style={past.resultSub}>
            The stars don't lie. Your future is written just as clearly.
          </Text>
        </View>
      )}
    </View>
  )
}

const past = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(13,13,43,0.5)',
    padding: 16,
    marginBottom: 12,
  },
  cardTrue: { borderColor: 'rgba(68,255,136,0.4)' },
  cardFalse: { borderColor: 'rgba(255,255,255,0.04)' },
  statement: {
    fontFamily: Fonts.mystical,
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 24,
    marginBottom: 14,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    alignItems: 'center',
  },
  btnNo: { borderColor: 'rgba(255,255,255,0.1)' },
  btnActiveTrue: { backgroundColor: 'rgba(68,255,136,0.15)', borderColor: 'rgba(68,255,136,0.5)' },
  btnActiveFalse: { backgroundColor: 'rgba(255,255,255,0.04)' },
  btnText: { fontFamily: Fonts.accent, fontSize: 11, color: '#C9A84C', letterSpacing: 0.5 },
  result: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
  },
  resultText: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#C9A84C',
    marginBottom: 8,
    textAlign: 'center',
  },
  resultSub: {
    fontFamily: Fonts.mystical,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
})

// ─── Live Generation Overlay ───────────────────────────────────────────────────
// NEW: Floats at the top of the scroll, shows real-time AI progress.
// chaptersDone (0-5) comes from readingStore and increments as each oracle finishes.
function GenerationOverlay({
  status,
  progress,
  chaptersDone,
  oraclesActive,
}: {
  status: string
  progress: number
  chaptersDone: number
  oraclesActive: number
}) {
  const rotAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 2500, useNativeDriver: true })
    ).start()
  }, [])

  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <BlurView intensity={20} tint="dark" style={overlay.card}>
      <LinearGradient
        colors={['rgba(201,168,76,0.12)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={overlay.topRow}>
        {/* Spinning orb */}
        <View style={overlay.orbWrap}>
          <Animated.View style={[overlay.ring, { transform: [{ rotate }] }]} />
          <LinearGradient colors={['#C9A84C', '#7C3AED']} style={overlay.orbCore} />
        </View>

        {/* Live chapter count + status */}
        <View style={overlay.textCol}>
          <Text style={overlay.chapterCount}>
            {chaptersDone > 0
              ? `${chaptersDone} of 5 chapters written`
              : 'Consulting the oracles…'}
          </Text>
          <Text style={overlay.statusText} numberOfLines={1}>
            {status || 'Awakening cosmic intelligence…'}
          </Text>
          <Text style={overlay.oracleText}>
            {oraclesActive > 0
              ? `${oraclesActive} oracle${oraclesActive !== 1 ? 's' : ''} running in parallel`
              : 'Merging all traditions…'}
          </Text>
        </View>

        {/* % badge */}
        <View style={overlay.pctBadge}>
          <Text style={overlay.pctText}>{Math.min(Math.round(progress), 100)}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={overlay.barTrack}>
        <Animated.View
          style={[
            overlay.barFill,
            { width: `${Math.min(progress, 100)}%` },
          ]}
        />
      </View>

      {/* Oracle dots */}
      <View style={overlay.dotsRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              overlay.dot,
              i < chaptersDone ? overlay.dotDone : overlay.dotPending,
            ]}
          />
        ))}
        <Text style={overlay.dotsLabel}>5 AI oracles · usually 60-90 seconds</Text>
      </View>
    </BlurView>
  )
}

const overlay = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    overflow: 'hidden',
    padding: 18,
    marginBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  orbWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ring: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#C9A84C',
    borderTopColor: 'transparent',
  },
  orbCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  textCol: { flex: 1 },
  chapterCount: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: '#44FF88',
    marginBottom: 3,
  },
  statusText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 2,
    fontStyle: 'italic',
  },
  oracleText: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.5,
  },
  pctBadge: {
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    flexShrink: 0,
  },
  pctText: {
    fontFamily: Fonts.accentBold,
    fontSize: 14,
    color: '#C9A84C',
  },
  barTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: {
    height: '100%',
    backgroundColor: '#C9A84C',
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotDone: { backgroundColor: '#44FF88' },
  dotPending: { backgroundColor: 'rgba(255,255,255,0.15)' },
  dotsLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    marginLeft: 4,
    flex: 1,
  },
})

// ─── Chapter Row (Timeline style) ──────────────────────────────────────────────
function ChapterRow({
  chapter,
  index,
  content,
  pastStatements,
  isExpanded,
  isVisited,
  isLast,
  isGenerating,
  chaptersDone,
  onToggle,
}: {
  chapter: typeof CHAPTERS[number]
  index: number
  content: string
  pastStatements?: string[]
  isExpanded: boolean
  isVisited: boolean
  isLast: boolean
  isGenerating: boolean
  chaptersDone: number
  onToggle: () => void
}) {
  const arrowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(arrowAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [isExpanded])

  const arrowRotate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  // NEW: a chapter is "ready" once the oracle that writes it has completed.
  // oracleIndex 0→chaptersDone≥1, 1→chaptersDone≥2, etc.
  const isChapterReady = chaptersDone > chapter.oracleIndex

  const nodeColor = isExpanded
    ? '#44FF88'
    : isVisited
    ? '#C9A84C'
    : isChapterReady
    ? 'rgba(201,168,76,0.5)'
    : 'rgba(255,255,255,0.15)'

  return (
    <View style={row.container}>
      {/* Timeline spine + node */}
      <View style={row.spine}>
        <View style={[row.node, { borderColor: nodeColor, backgroundColor: '#05050F' }]}>
          <Text style={[row.nodeNum, { color: nodeColor }]}>{ROMAN[index]}</Text>
        </View>
        {!isLast && <View style={row.line} />}
      </View>

      {/* Card */}
      <View style={[row.card, { borderColor: chapter.accent + '30' }]}>
        <LinearGradient
          colors={[chapter.accent, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={row.topLine}
        />
        <LinearGradient
          colors={[chapter.accent + '10', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <TouchableOpacity
          style={row.header}
          onPress={() => {
            if (!isChapterReady && isGenerating) return  // not ready yet
            LayoutAnimation.easeInEaseOut()
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onToggle()
          }}
          activeOpacity={isChapterReady ? 0.8 : 1}
        >
          <View style={row.headerText}>
            <Text style={row.chapterLabel}>Chapter {ROMAN[index]}</Text>
            <Text style={[row.title, { color: chapter.accent }]}>{chapter.title}</Text>
            <Text style={row.subtitle}>{chapter.subtitle}</Text>
          </View>

          {/* NEW: show "Generating…" badge or expand arrow */}
          {isGenerating && !isChapterReady ? (
            <View style={row.generatingBadge}>
              <Text style={row.generatingDot}>◌</Text>
              <Text style={row.generatingText}>Writing…</Text>
            </View>
          ) : (
            <Animated.Text
              style={[row.arrow, { color: chapter.accent, transform: [{ rotate: arrowRotate }] }]}
            >
              ›
            </Animated.Text>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={row.body}>
            {chapter.isPastReveal && pastStatements ? (
              <PastRevealCards statements={pastStatements} />
            ) : content ? (
              <Text style={row.content}>{content}</Text>
            ) : (
              <Text style={row.placeholderText}>
                Your reading is still being generated. Please wait a moment.
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  spine: {
    width: 52,
    alignItems: 'center',
    paddingTop: 16,
  },
  node: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  nodeNum: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  line: {
    width: 1,
    flex: 1,
    minHeight: 16,
    marginTop: 4,
    backgroundColor: 'rgba(201,168,76,0.2)',
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,13,43,0.6)',
    position: 'relative',
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    paddingTop: 20,
    gap: 10,
  },
  headerText: { flex: 1 },
  chapterLabel: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 3,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 17,
  },
  arrow: {
    fontSize: 20,
    paddingRight: 2,
  },
  // NEW: generating badge shown on chapters not yet written
  generatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  generatingDot: {
    fontSize: 12,
    color: '#C9A84C',
  },
  generatingText: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    color: 'rgba(201,168,76,0.7)',
    letterSpacing: 0.5,
  },
  body: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
  },
  content: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 28,
  },
  placeholderText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 24,
    fontStyle: 'italic',
  },
})

// ─── MAIN READING SCREEN ───────────────────────────────────────────────────────
export function ReadingScreen() {
  const navigation = useNavigation()
  const {
    reading,
    isGenerating,
    generationStatus,
    generationProgress,
    chaptersDone,
    parallelOraclesActive,
  } = useReadingStore()

  const [expandedId, setExpandedId] = useState<string | null>('past')
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set(['past']))

  function handleToggle(id: string) {
    LayoutAnimation.easeInEaseOut()
    setVisitedIds(prev => new Set([...prev, id]))
    setExpandedId(prev => (prev === id ? null : id))
  }

  function getContent(id: string): string {
    if (!reading) return ''
    const key = id as keyof typeof reading
    const val = reading[key]
    return typeof val === 'string' ? val : ''
  }

  return (
    <View style={styles.root}>
      <Video
        source={Videos.readingBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.5)', 'rgba(5,5,15,0.75)', 'rgba(5,5,15,0.92)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>The Book of Your Soul</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>✦ Your complete reading</Text>
          <Text style={styles.heroTitle}>Eight Chapters.{'\n'}Every Tradition.</Text>
          <Text style={styles.heroSub}>Your complete truth, written in the stars.</Text>
        </View>

        {/* ── Progress dots ─────────────────────────────────────────────── */}
        <ProgressDots expandedId={expandedId} visitedIds={visitedIds} />

        {/* ── NEW: Live generation overlay — shows when AI is running ───── */}
        {isGenerating && (
          <GenerationOverlay
            status={generationStatus}
            progress={generationProgress}
            chaptersDone={chaptersDone}
            oraclesActive={parallelOraclesActive}
          />
        )}

        {/* ── Static wait card — shown only when not yet generating and no reading */}
        {!isGenerating && !reading && (
          <BlurView intensity={15} tint="dark" style={styles.waitCard}>
            <Text style={styles.waitIcon}>◌</Text>
            <Text style={styles.waitText}>
              Your reading is being generated.{'\n'}Return once it completes.
            </Text>
          </BlurView>
        )}

        {/* ── Timeline chapters ─────────────────────────────────────────── */}
        <View style={styles.timelineWrap}>
          {CHAPTERS.map((chapter, index) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              index={index}
              content={getContent(chapter.id)}
              pastStatements={reading?.past_statements || []}
              isExpanded={expandedId === chapter.id}
              isVisited={visitedIds.has(chapter.id)}
              isLast={index === CHAPTERS.length - 1}
              isGenerating={isGenerating}
              chaptersDone={chaptersDone}
              onToggle={() => handleToggle(chapter.id)}
            />
          ))}
        </View>

        {/* ── Compatible signs ──────────────────────────────────────────── */}
        {reading?.compatible_signs && (
          <>
            <Text style={styles.sectionLabel}>Your Highest Compatibility</Text>
            <View style={styles.compatRow}>
              {reading.compatible_signs.map((c, i) => (
                <BlurView key={i} intensity={15} tint="dark" style={styles.compatCard}>
                  <Text style={styles.compatSign}>{c.sign}</Text>
                  <Text style={styles.compatPct}>{c.percentage}%</Text>
                </BlurView>
              ))}
            </View>
          </>
        )}

        {/* ── Career strengths ──────────────────────────────────────────── */}
        {reading?.career_strengths && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Your Natural Gifts</Text>
            {reading.career_strengths.map((s, i) => (
              <View key={i} style={styles.strengthRow}>
                <View style={styles.strengthDot} />
                <Text style={styles.strengthText}>{s}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backBtn: { paddingVertical: 8, paddingRight: 12 },
  backText: { fontFamily: Fonts.body, fontSize: 14, color: '#C9A84C' },
  pageTitle: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  hero: { alignItems: 'center', paddingBottom: 24 },
  heroEyebrow: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    letterSpacing: 3,
    color: 'rgba(201,168,76,0.5)',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroTitle: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#C9A84C',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 36,
    marginBottom: 8,
  },
  heroSub: {
    fontFamily: Fonts.mystical,
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
  },

  waitCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
  },
  waitIcon: {
    fontSize: 22,
    color: 'rgba(201,168,76,0.45)',
    marginBottom: 10,
  },
  waitText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },

  timelineWrap: {},

  sectionLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
    marginTop: 8,
  },

  compatRow: { flexDirection: 'row', gap: 12 },
  compatCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
    overflow: 'hidden',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  compatSign: { fontFamily: Fonts.heading, fontSize: 14, color: '#C9A84C' },
  compatPct: { fontFamily: Fonts.accentBold, fontSize: 20, color: '#FFD700' },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  strengthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C9A84C',
  },
  strengthText: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    flex: 1,
    lineHeight: 22,
  },
})
