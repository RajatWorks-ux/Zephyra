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

const CHAPTERS = [
  {
    id: 'past',
    title: 'Before We Begin',
    subtitle: 'What the stars saw before you did',
    accent: '#C9A84C',
    isPastReveal: true,
  },
  {
    id: 'chapter_identity',
    title: 'Who You Are',
    subtitle: 'Your soul at its deepest level',
    accent: '#7B2FBE',
  },
  {
    id: 'chapter_love',
    title: 'Love and Relationships',
    subtitle: 'Your heart, your patterns, your people',
    accent: '#BE2F6E',
  },
  {
    id: 'chapter_career',
    title: 'Money and Career',
    subtitle: 'Your gifts and your path to prosperity',
    accent: '#BEA02F',
  },
  {
    id: 'chapter_health',
    title: 'Health and Vitality',
    subtitle: 'Your body, your energy, your rhythms',
    accent: '#2FBE6E',
  },
  {
    id: 'chapter_family',
    title: 'Family and Roots',
    subtitle: 'Where you came from, what you carry',
    accent: '#8E8EBE',
  },
  {
    id: 'chapter_purpose',
    title: 'Life Purpose and Destiny',
    subtitle: 'Why you are here. What you are building.',
    accent: '#FFD700',
  },
  {
    id: 'chapter_now',
    title: 'Right Now',
    subtitle: 'Your current chapter and what it demands',
    accent: '#2FBEBE',
  },
] as const

// ─── Past Reveal Cards ────────────────────────────────────────────────────────
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
  resultText: { fontFamily: Fonts.heading, fontSize: 18, color: '#C9A84C', marginBottom: 8, textAlign: 'center' },
  resultSub: { fontFamily: Fonts.mystical, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },
})

// ─── Chapter Accordion ────────────────────────────────────────────────────────
function Chapter({
  chapter,
  content,
  pastStatements,
  isExpanded,
  onToggle,
}: {
  chapter: typeof CHAPTERS[number]
  content: string
  pastStatements?: string[]
  isExpanded: boolean
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

  const arrowRotate = arrowAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })

  return (
    <View style={[chap.wrapper, { borderColor: chapter.accent + '25' }]}>
      <TouchableOpacity
        style={chap.header}
        onPress={() => {
          LayoutAnimation.easeInEaseOut()
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onToggle()
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[chapter.accent + '10', 'transparent']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <View style={chap.dot} />
        <View style={chap.headerText}>
          <Text style={[chap.title, { color: chapter.accent }]}>{chapter.title}</Text>
          <Text style={chap.subtitle}>{chapter.subtitle}</Text>
        </View>
        <Animated.Text style={[chap.arrow, { transform: [{ rotate: arrowRotate }], color: chapter.accent }]}>
          v
        </Animated.Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={chap.body}>
          {chapter.isPastReveal && pastStatements ? (
            <PastRevealCards statements={pastStatements} />
          ) : (
            <Text style={chap.content}>{content}</Text>
          )}
        </View>
      )}
    </View>
  )
}

const chap = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,13,43,0.55)',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
    overflow: 'hidden',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'currentColor',
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 22,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 18,
  },
  arrow: {
    fontFamily: Fonts.accent,
    fontSize: 12,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
})

// ─── MAIN READING SCREEN ──────────────────────────────────────────────────────
export function ReadingScreen() {
  const navigation = useNavigation()
  const { reading } = useReadingStore()
  const [expandedId, setExpandedId] = useState<string | null>('past')

  function getContent(id: string): string {
    if (!reading) return 'Your reading is still being generated. Please wait a moment.'
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
        isLooping shouldPlay isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.5)', 'rgba(5,5,15,0.75)', 'rgba(5,5,15,0.92)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Back button + Title */}
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
        <Text style={styles.intro}>
          Eight chapters. Every tradition. Your complete truth.
        </Text>

        {!reading && (
          <BlurView intensity={15} tint="dark" style={styles.waitCard}>
            <Text style={styles.waitText}>
              Your reading is being generated. Return to the home screen and come back once it completes.
            </Text>
          </BlurView>
        )}

        {CHAPTERS.map((chapter) => (
          <Chapter
            key={chapter.id}
            chapter={chapter}
            content={getContent(chapter.id)}
            pastStatements={reading?.past_statements || []}
            isExpanded={expandedId === chapter.id}
            onToggle={() => setExpandedId(expandedId === chapter.id ? null : chapter.id)}
          />
        ))}

        {/* Compatible signs */}
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

        {/* Career strengths */}
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
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    textAlign: 'center',
    flex: 1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  intro: {
    fontFamily: Fonts.mystical,
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 24,
  },
  waitCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  waitText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
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
