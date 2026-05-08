// src/screens/main/ReadingScreen.tsx
// Full redesign — dot animations, TTS, language picker, age-aware past/future,
// summary cards, new chapter content layout, reading seed persistence.

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Audio } from 'expo-av'
import { FannedCards } from '../../components/ui/FannedCards'
import { useNavigation } from '@react-navigation/native'
import { useReadingStore } from '../../store/readingStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { LanguagePicker } from '../../components/ui/LanguagePicker'
import { Videos } from '../../constants/videos'
import { Fonts } from '../../constants/fonts'
import type { Language } from '../../types'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}


// ─── Compute age from birth_date string ────────────────────────────────────────
function computeAge(birthDateStr: string | null | undefined): number {
  if (!birthDateStr) return 25
  try {
    const birth = new Date(birthDateStr)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const m = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
    return Math.max(0, age)
  } catch {
    return 25
  }
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const CHAPTERS = [
  {
    id: 'past',
    title: 'Before We Begin',
    subtitle: 'What the stars saw before you did',
    accent: '#C9A84C',
    isPastReveal: true,
    oracleIndex: 0,
    summaryKey: null as string | null,
    decorativeSymbol: '✦',
  },
  {
    id: 'chapter_identity',
    title: 'Who You Are',
    subtitle: 'Your soul at its deepest level',
    accent: '#7B2FBE',
    oracleIndex: 0,
    summaryKey: 'chapter_identity_summary',
    decorativeSymbol: '◈',
  },
  {
    id: 'chapter_love',
    title: 'Love and Relationships',
    subtitle: 'Your heart, your patterns, your people',
    accent: '#BE2F6E',
    oracleIndex: 1,
    summaryKey: 'chapter_love_summary',
    decorativeSymbol: '♡',
  },
  {
    id: 'chapter_career',
    title: 'Money and Career',
    subtitle: 'Your gifts and your path to prosperity',
    accent: '#BEA02F',
    oracleIndex: 1,
    summaryKey: 'chapter_career_summary',
    decorativeSymbol: '◇',
  },
  {
    id: 'chapter_health',
    title: 'Health and Vitality',
    subtitle: 'Your body, your energy, your rhythms',
    accent: '#2FBE6E',
    oracleIndex: 2,
    summaryKey: 'chapter_health_summary',
    decorativeSymbol: '⟡',
  },
  {
    id: 'chapter_family',
    title: 'Family and Roots',
    subtitle: 'Where you came from, what you carry',
    accent: '#8E8EBE',
    oracleIndex: 2,
    summaryKey: 'chapter_family_summary',
    decorativeSymbol: '⊹',
  },
  {
    id: 'chapter_purpose',
    title: 'Life Purpose and Destiny',
    subtitle: 'Why you are here. What you are building.',
    accent: '#FFD700',
    oracleIndex: 3,
    summaryKey: 'chapter_purpose_summary',
    decorativeSymbol: '✺',
  },
  {
    id: 'chapter_now',
    title: 'Right Now',
    subtitle: 'Your current chapter and what it demands',
    accent: '#2FBEBE',
    oracleIndex: 3,
    summaryKey: 'chapter_now_summary',
    decorativeSymbol: '◎',
  },
] as const



// ─── Summary Card ──────────────────────────────────────────────────────────────
interface SummaryCardProps {
  summary: string
  accentColor: string
}

function SummaryCard({ summary, accentColor }: SummaryCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <Animated.View style={[summaryStyles.card, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={[accentColor + '18', accentColor + '06', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[summaryStyles.topAccent, { backgroundColor: accentColor }]} />
      <View style={summaryStyles.inner}>
        <Text style={[summaryStyles.label, { color: accentColor }]}>✦  IN SIMPLE WORDS</Text>
        <Text style={summaryStyles.text}>{summary}</Text>
      </View>
    </Animated.View>
  )
}

const summaryStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    opacity: 0.7,
  },
  inner: {
    padding: 18,
    paddingTop: 20,
  },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  text: {
    fontFamily: Fonts.mystical,
    fontSize: 16,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 28,
    fontStyle: 'italic',
  },
})

// ─── Age-Aware Past/Future Reveal Cards ────────────────────────────────────────
interface PastStatement {
  raw: string
  tag: 'PAST' | 'FUTURE'
  text: string
}

function parsePastStatements(statements: string[]): PastStatement[] {
  return statements.map((s) => {
    const futureMatch = s.match(/^\[FUTURE\]\s*/i)
    const pastMatch = s.match(/^\[PAST\]\s*/i)
    if (futureMatch) {
      return { raw: s, tag: 'FUTURE', text: s.replace(/^\[FUTURE\]\s*/i, '').trim() }
    }
    if (pastMatch) {
      return { raw: s, tag: 'PAST', text: s.replace(/^\[PAST\]\s*/i, '').trim() }
    }
    // Default to PAST if no tag (backward compatibility)
    return { raw: s, tag: 'PAST', text: s.trim() }
  })
}

function PastRevealCards({ statements, age }: { statements: string[]; age: number }) {
  const [resonates, setResonates] = useState<Record<number, boolean | null>>({})
  const [savedFutures, setSavedFutures] = useState<Record<number, boolean>>({})

  const parsed = useMemo(() => parsePastStatements(statements), [statements])
  const pastItems = parsed.filter((p) => p.tag === 'PAST')
  const futureItems = parsed.filter((p) => p.tag === 'FUTURE')
  const pastCount = Object.values(resonates).filter((v) => v === true).length
  const allPastAnswered = Object.keys(resonates).length === pastItems.length && pastItems.length > 0

  const isVeryYoung = age <= 3
  const hasMeaningfulPast = pastItems.length > 0

  return (
    <View>
      {/* PAST section - age-aware */}
      {isVeryYoung && !hasMeaningfulPast ? (
        <View style={past.noPastCard}>
          <Text style={past.noPastIcon}>✦</Text>
          <Text style={past.noPastTitle}>Your Story Is Just Beginning</Text>
          <Text style={past.noPastText}>
            You are so young that almost everything in your life still lies ahead. The stars have very
            little past to look back on — and that is a beautiful thing. Your whole story is still
            being written.
          </Text>
        </View>
      ) : hasMeaningfulPast ? (
        <>
      {pastItems.map((stmt, i) => {
        const status = resonates[i]
        return (
          <View
            key={`past-${i}`}
            style={[
              past.card,
              status === true && past.cardTrue,
              status === false && past.cardFalse,
            ]}
          >
            <Text style={past.statement}>{stmt.text}</Text>
            <View style={past.btnRow}>
              <TouchableOpacity
                style={[past.btn, status === true && past.btnActiveTrue]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setResonates((prev) => ({ ...prev, [i]: true }))
                }}
                activeOpacity={0.8}
              >
                <Text style={past.btnText}>Resonates</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[past.btn, past.btnNo, status === false && past.btnActiveFalse]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setResonates((prev) => ({ ...prev, [i]: false }))
                }}
                activeOpacity={0.8}
              >
                <Text style={[past.btnText, { color: 'rgba(255,255,255,0.4)' }]}>Not quite</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      })}

      {/* Resonance result after all past answered */}
      {allPastAnswered && (
        <View style={past.result}>
          <Text style={past.resultText}>
            {pastCount} of {pastItems.length} resonate with you.
          </Text>
          <Text style={past.resultSub}>
            The stars don't lie. Your future is written just as clearly.
          </Text>
        </View>
      )}
        </>
      ) : (
        <View style={past.noPastCard}>
          <Text style={past.noPastIcon}>✦</Text>
          <Text style={past.noPastTitle}>Nothing Special to Reveal Yet</Text>
          <Text style={past.noPastText}>
            The stars don't see anything unusual in your past that needs attention. Your most
            important chapters are still ahead of you.
          </Text>
        </View>
      )}

      {/* Divider between PAST and FUTURE */}
      {futureItems.length > 0 && (
        <View style={past.futureDivider}>
          <View style={past.futureLine} />
          <Text style={past.futureDividerText}>✦  From Here, Your Story Unfolds  ✦</Text>
          <View style={past.futureLine} />
        </View>
      )}

        {/* FUTURE section */}
      {futureItems.map((stmt, i) => {
        const isSaved = savedFutures[i] ?? false
        return (
          <View key={`future-${i}`} style={past.futureCard}>
            {/* Future badge */}
            <View style={past.futureBadge}>
              <Text style={past.futureBadgeText}>✦  In Your Future</Text>
            </View>
            <LinearGradient
              colors={['rgba(201,168,76,0.08)', 'rgba(255,215,0,0.03)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={past.futureStatement}>{stmt.text}</Text>
            <TouchableOpacity
              style={[past.saveBtn, isSaved && past.saveBtnDone]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                setSavedFutures((prev) => ({ ...prev, [i]: true }))
              }}
              activeOpacity={0.8}
            >
              <Text style={[past.saveBtnText, isSaved && { color: '#44FF88' }]}>
                {isSaved ? '✓ Saved to Your Future' : 'Save This Prophecy'}
              </Text>
            </TouchableOpacity>
          </View>
        )
      })}
    </View>
  )
}

const past = StyleSheet.create({
  // No-past graceful card
  noPastCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    backgroundColor: 'rgba(201,168,76,0.06)',
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  noPastIcon: {
    fontSize: 22,
    color: '#C9A84C',
    marginBottom: 10,
  },
  noPastTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    color: '#C9A84C',
    marginBottom: 10,
    textAlign: 'center',
  },
  noPastText: {
    fontFamily: Fonts.mystical,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Past cards
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
    lineHeight: 26,
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
  btnActiveTrue: {
    backgroundColor: 'rgba(68,255,136,0.15)',
    borderColor: 'rgba(68,255,136,0.5)',
  },
  btnActiveFalse: { backgroundColor: 'rgba(255,255,255,0.04)' },
  btnText: {
    fontFamily: Fonts.accent,
    fontSize: 11,
    color: '#C9A84C',
    letterSpacing: 0.5,
  },
  result: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    padding: 20,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
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
  // ── Future divider
  futureDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 20,
  },
  futureLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.35)',
  },
  futureDividerText: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    color: '#C9A84C',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  // ── Future cards
  futureCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    backgroundColor: 'rgba(13,13,43,0.6)',
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  futureBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
  },
  futureBadgeText: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    color: '#FFD700',
    letterSpacing: 1.5,
  },
  futureStatement: {
    fontFamily: Fonts.mystical,
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 26,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  saveBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  saveBtnDone: {
    borderColor: 'rgba(68,255,136,0.5)',
    backgroundColor: 'rgba(68,255,136,0.08)',
  },
  saveBtnText: {
    fontFamily: Fonts.accent,
    fontSize: 11,
    color: '#C9A84C',
    letterSpacing: 0.5,
  },
})
// ─── TTS Play/Pause Button ─────────────────────────────────────────────────────
interface TtsButtonProps {
  chapterId: string
  accentColor: string
  textToRead: string
  languageCode: string
  playingChapterId: string | null
  onPlay: (id: string) => void
  onStop: () => void
}

function TtsButton({
  chapterId,
  accentColor,
  textToRead,
  languageCode,
  playingChapterId,
  onPlay,
  onStop,
}: TtsButtonProps) {
  const isPlaying = playingChapterId === chapterId
  const pulseAnim = useRef(new Animated.Value(1)).current
  // ── Keep a ref to the active sound so we can ACTUALLY stop it ──────────────
  const soundRef = useRef<Audio.Sound | null>(null)

  // When parent sets isPlaying=false (e.g. switching chapters), kill the real audio
  useEffect(() => {
    if (!isPlaying && soundRef.current) {
      soundRef.current.stopAsync().catch(() => {})
      soundRef.current.unloadAsync().catch(() => {})
      soundRef.current = null
    }
  }, [isPlaying])

  // Cleanup on unmount — prevents ghost audio after navigating away
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {})
        soundRef.current.unloadAsync().catch(() => {})
        soundRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start()
    } else {
      pulseAnim.setValue(1)
    }
  }, [isPlaying])

  const handlePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (isPlaying) {
      // Stop the real Audio.Sound, then notify parent
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {})
        await soundRef.current.unloadAsync().catch(() => {})
        soundRef.current = null
      }
      onStop()
      return
    }

    // Kill any stale sound before starting fresh (prevents double-audio on rapid taps)
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {})
      await soundRef.current.unloadAsync().catch(() => {})
      soundRef.current = null
    }
    
    try {
      onPlay(chapterId)
      // Map language to lang code
      const langCode = languageCode === 'hinglish' ? 'hi' : languageCode.split('-')[0]
      const encodedText = encodeURIComponent(textToRead)
      const audioUri = `http://127.0.0.1:5000/tts?text=${encodedText}&lang=${langCode}`
      
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      )
      soundRef.current = sound
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {})
          soundRef.current = null
          onStop()
        }
      })
    } catch (e) {
      console.error('[TTS] Error:', e)
      soundRef.current = null
      onStop()
    }
  }, [isPlaying, textToRead, languageCode, chapterId])

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={tts.btn}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          tts.icon,
          { borderColor: accentColor + '70' },
          isPlaying && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Text style={[tts.iconText, { color: accentColor }]}>
          {isPlaying ? '⏸' : '▶'}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  )
}

const tts = StyleSheet.create({
  btn: {
    padding: 4,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  iconText: {
    fontSize: 11,
  },
})

// ─── Progress Dots ─────────────────────────────────────────────────────────────
function ProgressDots({
  expandedId,
  visitedIds,
}: {
  expandedId: string | null
  visitedIds: Set<string>
}) {
  return (
    <View style={pdots.row}>
      {CHAPTERS.map((ch) => {
        const isActive = ch.id === expandedId
        const isDone = visitedIds.has(ch.id) && ch.id !== expandedId
        return (
          <View
            key={ch.id}
            style={[
              pdots.dot,
              isActive && pdots.dotActive,
              isDone && pdots.dotDone,
            ]}
          />
        )
      })}
      <Text style={pdots.label}>
        {visitedIds.size} of {CHAPTERS.length} read
      </Text>
    </View>
  )
}

const pdots = StyleSheet.create({
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

// ─── Live Generation Overlay ───────────────────────────────────────────────────
function GenerationOverlay({
  status,
  progress,
  chaptersDone,
  oraclesActive,
  isRegenerating,
}: {
  status: string
  progress: number
  chaptersDone: number
  oraclesActive: number
  isRegenerating: boolean
}) {
  const rotAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      })
    ).start()
  }, [])

  const rotate = rotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <BlurView intensity={20} tint="dark" style={overlayStyles.card}>
      <LinearGradient
        colors={['rgba(201,168,76,0.12)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={overlayStyles.topRow}>
        <View style={overlayStyles.orbWrap}>
          <Animated.View
            style={[overlayStyles.ring, { transform: [{ rotate }] }]}
          />
          <LinearGradient
            colors={['#C9A84C', '#7C3AED']}
            style={overlayStyles.orbCore}
          />
        </View>

        <View style={overlayStyles.textCol}>
          <Text style={overlayStyles.chapterCount}>
            {chaptersDone > 0
              ? `${chaptersDone} of 5 chapters written`
              : isRegenerating
              ? 'Regenerating in new language…'
              : 'Consulting the oracles…'}
          </Text>
          <Text style={overlayStyles.statusText} numberOfLines={1}>
            {status || 'Awakening cosmic intelligence…'}
          </Text>
          <Text style={overlayStyles.oracleText}>
            {oraclesActive > 0
              ? `${oraclesActive} oracle${oraclesActive !== 1 ? 's' : ''} running in parallel`
              : 'Merging all traditions…'}
          </Text>
        </View>

        <View style={overlayStyles.pctBadge}>
          <Text style={overlayStyles.pctText}>
            {Math.min(Math.round(progress), 100)}%
          </Text>
        </View>
      </View>

      <View style={overlayStyles.barTrack}>
        <View
          style={[overlayStyles.barFill, { width: `${Math.min(progress, 100)}%` }]}
        />
      </View>

      <View style={overlayStyles.dotsRow}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              overlayStyles.dot,
              i < chaptersDone ? overlayStyles.dotDone : overlayStyles.dotPending,
            ]}
          />
        ))}
        <Text style={overlayStyles.dotsLabel}>5 AI oracles · usually 60-90 seconds</Text>
      </View>
    </BlurView>
  )
}

const overlayStyles = StyleSheet.create({
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

// ─── Language Regen Banner ─────────────────────────────────────────────────────
interface LangBannerProps {
  currentLangCode: string
  selectedLang: Language
  onRegenerate: () => void
}

function LanguageRegenBanner({ currentLangCode, selectedLang, onRegenerate }: LangBannerProps) {
  if (currentLangCode === selectedLang.code) return null

  return (
    <TouchableOpacity onPress={onRegenerate} activeOpacity={0.85} style={langBanner.wrap}>
      <LinearGradient
        colors={['rgba(201,168,76,0.18)', 'rgba(201,168,76,0.06)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={langBanner.inner}>
        <Text style={langBanner.flag}>{selectedLang.flag}</Text>
        <View style={langBanner.textWrap}>
          <Text style={langBanner.title}>
            Reading is in English
          </Text>
          <Text style={langBanner.subtitle}>
            Tap to regenerate in {selectedLang.name}
          </Text>
        </View>
        <View style={langBanner.arrow}>
          <Text style={langBanner.arrowText}>→</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const langBanner = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  flag: {
    fontSize: 22,
  },
  textWrap: { flex: 1 },
  title: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: '#C9A84C',
  },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(201,168,76,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 14,
    color: '#C9A84C',
  },
})

// ─── Chapter Row ───────────────────────────────────────────────────────────────
interface ChapterRowProps {
  chapter: typeof CHAPTERS[number]
  index: number
  content: string
  summary: string
  pastStatements?: string[]
  userAge: number
  isExpanded: boolean
  isVisited: boolean
  isLast: boolean
  isGenerating: boolean
  chaptersDone: number
  playingChapterId: string | null
  languageCode: string
  onToggle: () => void
  onPlay: (id: string) => void
  onStop: () => void
}

function ChapterRow({
  chapter,
  index,
  content,
  summary,
  pastStatements,
  userAge,
  isExpanded,
  isVisited,
  isLast,
  isGenerating,
  chaptersDone,
  playingChapterId,
  languageCode,
  onToggle,
  onPlay,
  onStop,
}: ChapterRowProps) {
  const arrowAnim = useRef(new Animated.Value(0)).current
  const contentKey = useRef(0) // Force re-mount of FadeInText on each open

  useEffect(() => {
    Animated.timing(arrowAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start()

    if (isExpanded) {
      contentKey.current += 1
    }
  }, [isExpanded])

  const arrowRotate = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  })

  const isChapterReady = chaptersDone > chapter.oracleIndex

  const nodeColor = isExpanded
    ? '#44FF88'
    : isVisited
    ? '#C9A84C'
    : isChapterReady
    ? 'rgba(201,168,76,0.5)'
    : 'rgba(255,255,255,0.15)'

  // Build the text to read via TTS (summary first, then content)
  const ttsText = chapter.isPastReveal
    ? pastStatements?.map(s => s.replace(/^\[(PAST|FUTURE)\]\s*/i, '')).join('. ') ?? ''
    : `${summary ? summary + '. ' : ''}${content}`

  return (
    <View style={rowStyles.container}>
      {/* Timeline spine + node */}
      <View style={rowStyles.spine}>
        <View
          style={[
            rowStyles.node,
            { borderColor: nodeColor, backgroundColor: '#05050F' },
          ]}
        >
          <Text style={[rowStyles.nodeNum, { color: nodeColor }]}>
            {ROMAN[index]}
          </Text>
        </View>
        {!isLast && <View style={rowStyles.line} />}
      </View>

      {/* Card */}
      <View style={[rowStyles.card, { borderColor: chapter.accent + '30' }]}>
        {/* Top color line */}
        <LinearGradient
          colors={[chapter.accent, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={rowStyles.topLine}
        />
        {/* Background glow */}
        <LinearGradient
          colors={[chapter.accent + '0D', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Dot explosion animation — renders behind content */}

        {/* Header row — tap to expand */}
        <TouchableOpacity
          style={rowStyles.header}
          onPress={() => {
            if (!isChapterReady && isGenerating) return
            LayoutAnimation.easeInEaseOut()
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onToggle()
          }}
          activeOpacity={isChapterReady ? 0.8 : 1}
        >
          <View style={rowStyles.headerText}>
            <Text style={rowStyles.chapterLabel}>Chapter {ROMAN[index]}</Text>
            <Text style={[rowStyles.title, { color: chapter.accent }]}>
              {chapter.title}
            </Text>
            <Text style={rowStyles.subtitle}>{chapter.subtitle}</Text>
          </View>

          <View style={rowStyles.headerRight}>
            {/* TTS button — only show when chapter is ready and has content */}
            {isChapterReady && ttsText.length > 0 && (
              <TtsButton
                chapterId={chapter.id}
                accentColor={chapter.accent}
                textToRead={ttsText}
                languageCode={languageCode}
                playingChapterId={playingChapterId}
                onPlay={onPlay}
                onStop={onStop}
              />
            )}

            {/* Expand arrow or Generating badge */}
            {isGenerating && !isChapterReady ? (
              <View style={rowStyles.generatingBadge}>
                <Text style={rowStyles.generatingDot}>◌</Text>
                <Text style={rowStyles.generatingText}>Writing…</Text>
              </View>
            ) : (
              <Animated.Text
                style={[
                  rowStyles.arrow,
                  {
                    color: chapter.accent,
                    transform: [{ rotate: arrowRotate }],
                  },
                ]}
              >
                ›
              </Animated.Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Expanded body */}
        {isExpanded && (
          <View style={rowStyles.body}>
            {chapter.isPastReveal && pastStatements ? (
              <>
                {/* Summary for Before We Begin */}
                {summary ? (
                  <SummaryCard summary={summary} accentColor={chapter.accent} />
                ) : null}
                <PastRevealCards statements={pastStatements} age={userAge} />
              </>
            ) : content ? (
              <>
        {/* Summary card */}
                {summary ? (
                  <SummaryCard summary={summary} accentColor={chapter.accent} />
                ) : null}

                {/* Decorative section opener */}
                <View style={rowStyles.sectionOpener}>
                  <View style={[rowStyles.openerLine, { backgroundColor: chapter.accent + '40' }]} />
                  <Text style={[rowStyles.openerSymbol, { color: chapter.accent + '90' }]}>
                    {chapter.decorativeSymbol}
                  </Text>
                  <View style={[rowStyles.openerLine, { backgroundColor: chapter.accent + '40' }]} />
                </View>

                {/* Fanned yellow card deck for paragraphs */}
                <FannedCards
                  key={`${chapter.id}-${contentKey.current}`}
                  paragraphs={content.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0)}
                  accentColor={chapter.accent}
                />

                {/* Closing symbol */}
                <View style={rowStyles.closingSymbol}>
                  <Text style={{ color: chapter.accent + '50', fontSize: 16 }}>
                    {chapter.decorativeSymbol}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={rowStyles.placeholderText}>
                Your reading is still being generated. Please wait a moment.
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

const rowStyles = StyleSheet.create({
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
    width: 28,
    height: 28,
    borderRadius: 14,
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
    minHeight: 20,
    marginTop: 4,
    backgroundColor: 'rgba(201,168,76,0.2)',
  },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,13,43,0.65)',
    position: 'relative',
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    paddingTop: 22,
    gap: 10,
  },
  headerText: { flex: 1 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  chapterLabel: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 17,
  },
  arrow: {
    fontSize: 22,
    paddingRight: 2,
  },
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
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 20,
  },
  sectionOpener: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  openerLine: {
    flex: 1,
    height: 1,
  },
  openerSymbol: {
    fontSize: 18,
  },
  closingSymbol: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 4,
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
    isRegenerating,
    generationStatus,
    generationProgress,
    chaptersDone,
    parallelOraclesActive,
    currentLanguageCode,
    regenerateInLanguage,
  } = useReadingStore()

  const { session, birthProfile } = useAuthStore()

  const {
    selectedLanguage,
    setLanguage,
    loadSettings,
    isSettingsLoaded,
  } = useSettingsStore()

  // Compute user's age from birth profile
  const userAge = useMemo(
    () => computeAge(birthProfile?.birth_date),
    [birthProfile?.birth_date]
  )

  const [expandedId, setExpandedId] = useState<string | null>('past')
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set(['past']))
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [playingChapterId, setPlayingChapterId] = useState<string | null>(null)

  // Load settings on mount
  useEffect(() => {
    if (!isSettingsLoaded) {
      loadSettings()
    }
  }, [])

  useEffect(() => {
    return () => {} // cleanup
  }, [])

  function handleToggle(id: string) {
    LayoutAnimation.easeInEaseOut()
    setVisitedIds((prev) => new Set([...prev, id]))
    setExpandedId((prev) => (prev === id ? null : id))
    // Stop TTS when switching chapters
    if (playingChapterId && playingChapterId !== id) {
      setPlayingChapterId(null)
    }
  }

  function getContent(id: string): string {
    if (!reading) return ''
    const key = id as keyof typeof reading
    const val = reading[key]
    return typeof val === 'string' ? val : ''
  }

  function getSummary(summaryKey: string | null): string {
    if (!summaryKey || !reading) return ''
    const key = summaryKey as keyof typeof reading
    const val = reading[key]
    return typeof val === 'string' ? val : ''
  }

  function handleLanguageSelect(lang: Language) {
    // If same language already selected, do nothing
    if (lang.code === selectedLanguage.code) return

    setLanguage(lang)

    // Immediately prompt regeneration — lang passed directly to avoid stale state
    if (!session || !birthProfile) return
    Alert.alert(
      `Regenerate in ${lang.name}?`,
      `Your full reading will be regenerated in ${lang.name}. This takes about 60-90 seconds.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: () => {
            setPlayingChapterId(null)
            regenerateInLanguage(session.user.id, birthProfile as any, lang)
          },
        },
      ]
    )
  }

  // Kept for any direct "Regenerate" button usage
  function handleRegenerateInLanguage() {
    if (!session || !birthProfile) return
    Alert.alert(
      `Regenerate in ${selectedLanguage.name}?`,
      `Your full reading will be regenerated in ${selectedLanguage.name}. This will take about 60-90 seconds.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: () => {
            setPlayingChapterId(null)
            regenerateInLanguage(session.user.id, birthProfile as any, selectedLanguage)
          },
        },
      ]
    )
  }

  function handlePlay(id: string) {
    setPlayingChapterId(id)
  }

  function handleStop() {
    setPlayingChapterId(null)
  }

  // Fix: build a meaningful age-aware summary for "Before We Begin"
  const beforeWeBeginSummary = useMemo(() => {
    if (!reading?.past_statements?.length) return ''
    const parsed = parsePastStatements(reading.past_statements)
    const pastCount = parsed.filter((p) => p.tag === 'PAST').length
    const futureCount = parsed.filter((p) => p.tag === 'FUTURE').length
    if (userAge <= 3 && pastCount === 0) {
      return 'You are very young — your whole story still lies ahead. The stars see a beautiful future waiting for you.'
    }
    if (pastCount === 0) {
      return 'Nothing unusual in your past needs attention here. Your most important chapters are still ahead.'
    }
    return `The stars looked back at your ${userAge} year${userAge !== 1 ? 's' : ''} and found ${pastCount} moment${pastCount !== 1 ? 's' : ''} worth noting — and ${futureCount} prophet${futureCount !== 1 ? 'ies' : 'y'} waiting in your future.`
  }, [reading?.past_statements, userAge])

  return (
    <View style={styles.root}>
      {/* Background video */}
      <Video
        source={Videos.readingBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.45)', 'rgba(5,5,15,0.75)', 'rgba(5,5,15,0.93)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            navigation.goBack()
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>The Book of Your Soul</Text>

        {/* Globe button — language picker */}
        <TouchableOpacity
          style={styles.globeBtn}
          onPress={() => setShowLangPicker(true)}
          activeOpacity={0.7}
        >
          <View style={styles.globeBtnInner}>
            <Text style={styles.globeFlag}>
              {selectedLanguage.flag}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Main scroll */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>✦ Your complete reading</Text>
          <Text style={styles.heroTitle}>
            {'Eight Chapters.\nEvery Tradition.'}
          </Text>
          <Text style={styles.heroSub}>
            Your complete truth, written in the stars.
          </Text>
        </View>

        {/* Progress dots */}
        <ProgressDots expandedId={expandedId} visitedIds={visitedIds} />

        {/* Language mismatch banner */}
        {!isGenerating && reading && (
          <LanguageRegenBanner
            currentLangCode={currentLanguageCode}
            selectedLang={selectedLanguage}
            onRegenerate={handleRegenerateInLanguage}
          />
        )}

        {/* Live generation overlay */}
        {isGenerating && (
          <GenerationOverlay
            status={generationStatus}
            progress={generationProgress}
            chaptersDone={chaptersDone}
            oraclesActive={parallelOraclesActive}
            isRegenerating={isRegenerating}
          />
        )}

        {/* Static wait card */}
        {!isGenerating && !reading && (
          <BlurView intensity={15} tint="dark" style={styles.waitCard}>
            <Text style={styles.waitIcon}>◌</Text>
            <Text style={styles.waitText}>
              {'Your reading is being generated.\nReturn once it completes.'}
            </Text>
          </BlurView>
        )}

        {/* Timeline chapters */}
        <View style={styles.timelineWrap}>
          {CHAPTERS.map((chapter, index) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              index={index}
              content={getContent(chapter.id)}
              summary={
                chapter.id === 'past'
                  ? beforeWeBeginSummary
                  : getSummary(chapter.summaryKey)
              }
              pastStatements={reading?.past_statements ?? []}
              userAge={userAge}
              isExpanded={expandedId === chapter.id}
              isVisited={visitedIds.has(chapter.id)}
              isLast={index === CHAPTERS.length - 1}
              isGenerating={isGenerating}
              chaptersDone={chaptersDone}
              playingChapterId={playingChapterId}
              languageCode={selectedLanguage.code}
              onToggle={() => handleToggle(chapter.id)}
              onPlay={handlePlay}
              onStop={handleStop}
            />
          ))}
        </View>

        {/* Compatible signs */}
        {reading?.compatible_signs && (
          <>
            <Text style={styles.sectionLabel}>Your Highest Compatibility</Text>
            <View style={styles.compatRow}>
              {reading.compatible_signs.map((c, i) => (
                <BlurView key={i} intensity={15} tint="dark" style={styles.compatCard}>
                  <LinearGradient
                    colors={['rgba(201,168,76,0.1)', 'transparent']}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={styles.compatSign}>{c.sign}</Text>
                  <Text style={styles.compatPct}>{c.percentage}%</Text>
                </BlurView>
              ))}
            </View>
          </>
        )}

        {/* Career strengths */}
        {reading?.career_strengths && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Your Natural Gifts</Text>
            {reading.career_strengths.map((s, i) => (
              <View key={i} style={styles.strengthRow}>
                <View style={styles.strengthDot} />
                <Text style={styles.strengthText}>{s}</Text>
              </View>
            ))}
          </>
        )}

        {/* Best months */}
        {reading?.best_months_love && reading?.best_months_money && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Your Power Months</Text>
            <View style={styles.monthsRow}>
              <BlurView intensity={12} tint="dark" style={styles.monthCard}>
                <Text style={styles.monthCardTitle}>♡ Love</Text>
                <Text style={styles.monthCardMonths}>
                  {reading.best_months_love
                    .map((m) =>
                      new Date(2024, m - 1, 1).toLocaleString('default', { month: 'short' })
                    )
                    .join('  ·  ')}
                </Text>
              </BlurView>
              <BlurView intensity={12} tint="dark" style={styles.monthCard}>
                <Text style={styles.monthCardTitle}>◇ Money</Text>
                <Text style={styles.monthCardMonths}>
                  {reading.best_months_money
                    .map((m) =>
                      new Date(2024, m - 1, 1).toLocaleString('default', { month: 'short' })
                    )
                    .join('  ·  ')}
                </Text>
              </BlurView>
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Language picker modal */}
      <LanguagePicker
        visible={showLangPicker}
        onClose={() => setShowLangPicker(false)}
        onSelect={handleLanguageSelect}
      />
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
  backText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: '#C9A84C',
  },
  pageTitle: {
    fontFamily: Fonts.heading,
    fontSize: 12,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
  },
  globeBtn: {
    padding: 4,
  },
  globeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeFlag: {
    fontSize: 18,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  hero: {
    alignItems: 'center',
    paddingBottom: 28,
  },
  heroEyebrow: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    letterSpacing: 3,
    color: 'rgba(201,168,76,0.5)',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: Fonts.heading,
    fontSize: 28,
    color: '#C9A84C',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 38,
    marginBottom: 10,
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

  compatRow: {
    flexDirection: 'row',
    gap: 10,
  },
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
  compatSign: {
    fontFamily: Fonts.heading,
    fontSize: 13,
    color: '#C9A84C',
  },
  compatPct: {
    fontFamily: Fonts.accentBold,
    fontSize: 20,
    color: '#FFD700',
  },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
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

  monthsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  monthCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
    overflow: 'hidden',
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  monthCardTitle: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: '#C9A84C',
    letterSpacing: 1,
  },
  monthCardMonths: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
})
