// src/screens/main/HomeScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// FIXES APPLIED:
//
// 1. "Home screen overlapping UI — elements stacking on each other"
//    ROOT CAUSE: heroRow (score + pills + summary) and scoreBarTrack always
//    rendered even when GeneratingView was also rendering inside the same card.
//    Result: score circle + progress bar + spinning orb all stacked.
//    FIX: heroRow and scoreBarTrack are now hidden while isGenerating || isLoading.
//    GeneratingView fills the heroCard exclusively during generation.
//
// 2. "72 hardcoded — should show what AI actually returned"
//    ROOT CAUSE: dailyScore initial value in readingStore was 72.
//    FIX: readingStore now starts at 0 and updates from AI's daily_score_base.
//    ScoreCircle now renders "--" when score === 0 (not yet loaded).
//
// 3. Design matches Images 4 & 5 (asymmetric grid, guidance row, identity strip)
//    while keeping original colors (#C9A84C gold, #7C3AED purple), fonts,
//    background video, and BlurView effects.
//
// 4. exploreTop had a fixed height: 220 causing card content to be clipped on
//    smaller/larger screens. Removed fixed height — cards now size to content.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, Alert,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuthStore } from '../../store/authStore'
import { useReadingStore } from '../../store/readingStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import type { HomeStackParams } from '../../navigation/MainNavigator'

const { width } = Dimensions.get('window')
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

type Nav = NativeStackNavigationProp<HomeStackParams, 'Home'>

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  const d = new Date()
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

// ─── Score Circle ──────────────────────────────────────────────────────────────
// FIX: shows "--" when score is 0 (not yet loaded from AI)
function ScoreCircle({ score }: { score: number }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (score === 0) return
    Animated.timing(anim, {
      toValue: score / 100,
      duration: 1400,
      useNativeDriver: false,
      delay: 300,
    }).start()
  }, [score])

  const color = score === 0
    ? 'rgba(255,255,255,0.2)'
    : score >= 70 ? '#44FF88'
    : score >= 50 ? '#C9A84C'
    : '#FF4444'

  return (
    <View style={scoreCircle.wrap}>
      <View style={[scoreCircle.ring, { borderColor: color + '55' }]}>
        <Text style={[scoreCircle.num, { color }]}>
          {score === 0 ? '--' : score}
        </Text>
        <Text style={scoreCircle.lbl}>Cosmic</Text>
      </View>
    </View>
  )
}

const scoreCircle = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  num: {
    fontFamily: Fonts.accentBold,
    fontSize: 30,
    letterSpacing: 1,
  },
  lbl: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 1,
  },
})

// ─── Planet Pill ───────────────────────────────────────────────────────────────
function PlanetPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[pill.wrap, { borderColor: color + '30' }]}>
      <View style={[pill.dot, { backgroundColor: color }]} />
      <Text style={pill.text}>{label}</Text>
    </View>
  )
}

const pill = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 6,
    marginBottom: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
  },
})

// ─── Guidance Mini Card ────────────────────────────────────────────────────────
function GuidanceMini({
  icon, label, value, color,
}: {
  icon: string; label: string; value: string; color: string
}) {
  return (
    <View style={gm.card}>
      <Text style={[gm.icon, { color }]}>{icon}</Text>
      <Text style={gm.label}>{label}</Text>
      <Text style={[gm.value, { color }]}>{value}</Text>
    </View>
  )
}

const gm = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(13,13,43,0.6)',
    padding: 14,
    alignItems: 'center',
  },
  icon: { fontSize: 18, marginBottom: 6 },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  value: {
    fontFamily: Fonts.body,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
})

// ─── Explore Card (standard) ───────────────────────────────────────────────────
function ExploreCard({
  label, sub, symbol, accent, onPress, style,
}: {
  label: string; sub: string; symbol: string; accent: string
  onPress: () => void; style?: object
}) {
  return (
    <TouchableOpacity
      style={[ec.card, { borderColor: accent + '40' }, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[accent, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={ec.topLine}
      />
      <LinearGradient
        colors={[accent + '12', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[ec.orb, { backgroundColor: accent }]} />
      <Text style={[ec.symbol, { color: accent }]}>{symbol}</Text>
      <Text style={ec.label}>{label}</Text>
      <Text style={ec.sub}>{sub}</Text>
    </TouchableOpacity>
  )
}

const ec = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,13,43,0.6)',
    position: 'relative',
  },
  topLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  orb: {
    position: 'absolute',
    bottom: -25,
    right: -25,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.1,
  },
  symbol: { fontSize: 22, marginBottom: 10 },
  label: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    color: '#E8E8FF',
    lineHeight: 20,
    marginBottom: 4,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
})

// ─── Tall Explore Card (My Reading) ───────────────────────────────────────────
function TallExploreCard({
  label, sub, symbol, accent, onPress,
}: {
  label: string; sub: string; symbol: string; accent: string; onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[tec.card, { borderColor: accent + '40' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[accent, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={tec.topLine}
      />
      <LinearGradient
        colors={[accent + '12', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[tec.orb, { backgroundColor: accent }]} />
      <View style={tec.top}>
        <Text style={[tec.symbol, { color: accent }]}>{symbol}</Text>
      </View>
      <View style={tec.bottom}>
        <Text style={tec.label}>{label}</Text>
        <Text style={tec.sub}>{sub}</Text>
        <Text style={[tec.arrow, { color: accent + '80' }]}>→</Text>
      </View>
    </TouchableOpacity>
  )
}

const tec = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,13,43,0.6)',
    position: 'relative',
    justifyContent: 'space-between',
    minHeight: 200, // FIX: minHeight instead of fixed height so content isn't clipped
  },
  topLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  orb: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.12,
  },
  top: { flex: 1, justifyContent: 'flex-start' },
  bottom: {},
  symbol: { fontSize: 28, marginBottom: 8 },
  label: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    color: '#E8E8FF',
    marginBottom: 4,
    lineHeight: 20,
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
  },
  arrow: { fontSize: 20 },
})

// ─── Identity Card ─────────────────────────────────────────────────────────────
function IdentityCard({
  title, lines, accent,
}: {
  title: string; lines: string[]; accent: string
}) {
  return (
    <View style={[icard.card, { borderColor: accent + '40' }]}>
      <LinearGradient
        colors={[accent + '15', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Text style={[icard.title, { color: accent }]}>{title}</Text>
      {lines.map((l, i) => (
        <Text key={i} style={icard.line}>{l}</Text>
      ))}
    </View>
  )
}

const icard = StyleSheet.create({
  card: {
    width: 140,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginRight: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,13,43,0.7)',
  },
  title: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  line: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
    lineHeight: 18,
  },
})

// ─── Generating State ──────────────────────────────────────────────────────────
// Shows live AI progress — status text, oracle dots, progress bar.
// chaptersDone is the NEW field from readingStore that counts finished AI chunks.
function GeneratingView({
  status,
  progress,
  oraclesActive,
  chaptersDone,
}: {
  status: string
  progress: number
  oraclesActive: number
  chaptersDone: number
}) {
  const rotAnim = useRef(new Animated.Value(0)).current
  const rotAnim2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start()
    Animated.loop(
      Animated.timing(rotAnim2, { toValue: 1, duration: 5000, useNativeDriver: true })
    ).start()
  }, [])

  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const rotateReverse = rotAnim2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] })

  const TOTAL_ORACLES = 5

  return (
    <View style={gen.container}>
      {/* Spinning orb */}
      <View style={gen.orbWrap}>
        <Animated.View style={[gen.ringOuter, { transform: [{ rotate: rotateReverse }] }]} />
        <Animated.View style={[gen.ring, { transform: [{ rotate }] }]} />
        <LinearGradient colors={['#C9A84C', '#7C3AED']} style={gen.orb} />
      </View>

      {/* Oracle dots — green = done, gold = active */}
      <View style={gen.oracleRow}>
        {Array.from({ length: TOTAL_ORACLES }).map((_, i) => (
          <View
            key={i}
            style={[
              gen.oracleDot,
              i < chaptersDone ? gen.oracleDotDone : gen.oracleDotActive,
            ]}
          />
        ))}
      </View>

      {/* NEW: live chapter count */}
      <Text style={gen.chapterCount}>
        {chaptersDone > 0
          ? `${chaptersDone} of ${TOTAL_ORACLES} chapters written`
          : 'Consulting the oracles…'}
      </Text>

      {/* Oracle status label */}
      <Text style={gen.oracleLabel}>
        {oraclesActive > 0
          ? `${oraclesActive} oracle${oraclesActive !== 1 ? 's' : ''} channeling in parallel`
          : 'All 5 oracles complete — merging…'}
      </Text>

      {/* Status message from AI service */}
      <Text style={gen.status}>{status}</Text>

      {/* Progress bar with % */}
      <View style={gen.barRow}>
        <View style={gen.bar}>
          <View style={[gen.fill, { width: `${Math.min(progress, 100)}%` }]} />
        </View>
        <Text style={gen.pct}>{Math.min(Math.round(progress), 100)}%</Text>
      </View>

      <Text style={gen.sub}>
        5 AI oracles working simultaneously. Usually ready in 60–90 seconds.
      </Text>
    </View>
  )
}

const gen = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  orbWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: '#C9A84C', borderTopColor: 'transparent',
    borderRightColor: 'rgba(201,168,76,0.3)',
  },
  orb: { width: 50, height: 50, borderRadius: 25 },
  ringOuter: {
    position: 'absolute', width: 88, height: 88, borderRadius: 44,
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)', borderBottomColor: 'transparent',
  },
  oracleRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  oracleDot: { width: 10, height: 10, borderRadius: 5 },
  oracleDotActive: { backgroundColor: 'rgba(201,168,76,0.35)' },
  oracleDotDone: { backgroundColor: '#44FF88' },
  // NEW: chapter counter — prominent and clear
  chapterCount: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
    color: '#44FF88',
    marginBottom: 4,
    textAlign: 'center',
  },
  oracleLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    marginBottom: 14,
  },
  status: {
    fontFamily: Fonts.mystical,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  barRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  bar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#C9A84C', borderRadius: 2 },
  // NEW: percentage label beside bar
  pct: {
    fontFamily: Fonts.accentBold,
    fontSize: 12,
    color: '#C9A84C',
    width: 34,
    textAlign: 'right',
  },
  sub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.22)',
    textAlign: 'center',
    lineHeight: 18,
  },
})

// ─── MAIN HOME SCREEN ──────────────────────────────────────────────────────────
export function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const { profile, birthProfile, signOut } = useAuthStore()
  const {
    chartData, reading, dailyScore,
    isLoading, isGenerating, generationStatus, generationProgress,
    hasError, parallelOraclesActive, chaptersDone, initialize,
  } = useReadingStore()

  useEffect(() => {
  console.log('[HOME] useEffect fired!')
  console.log('[HOME] profile:', JSON.stringify(profile))
  console.log('[HOME] birthProfile:', JSON.stringify(birthProfile))
  
  if (!profile?.id) {
    console.log('[HOME] BLOCKED — profile.id is null/undefined')
    return
  }
  if (!birthProfile) {
    console.log('[HOME] BLOCKED — birthProfile is null/undefined')
    return
  }
  
  console.log('[HOME] Calling initialize...')
  initialize(profile.id, birthProfile)
}, [profile?.id, birthProfile])
  
  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  const isReady = chartData && reading && !isLoading && !isGenerating
  const isWorking = isGenerating || isLoading

  // Derive score color — transparent when score not yet available
  const scoreColor = dailyScore === 0
    ? 'rgba(255,255,255,0.1)'
    : dailyScore >= 70 ? '#44FF88'
    : dailyScore >= 50 ? '#C9A84C'
    : '#FF4444'

  return (
    <View style={styles.root}>
      {/* Background Video — unchanged */}
      <Video
        source={Videos.homeBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping
        shouldPlay
        isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.6)', 'rgba(5,5,15,0.85)']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.eyebrow}>✦ Your cosmic briefing</Text>
            <Text style={styles.greeting}>
              {getGreeting()},{'\n'}
              {profile?.display_name?.split(' ')[0] || 'Seeker'}
            </Text>
            <Text style={styles.dateText}>{formatDate()}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <LinearGradient colors={['#C9A84C', '#7C3AED']} style={StyleSheet.absoluteFillObject} />
              <Text style={styles.avatarLetter}>
                {(profile?.display_name || 'S')[0].toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Hero Score Card ────────────────────────────────────────────────── */}
        <BlurView intensity={15} tint="dark" style={styles.heroCard}>
          <LinearGradient
            colors={['transparent', 'rgba(201,168,76,0.5)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroTopLine}
          />
          <LinearGradient
            colors={['rgba(201,168,76,0.08)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.heroOrb} />

          {/*
            FIX: heroRow + scoreBar are HIDDEN while generating to prevent
            the score circle from stacking on top of GeneratingView.
            They only appear when the reading is ready OR there's an error.
          */}
          {!isWorking && (
            <>
              <View style={styles.heroRow}>
                <ScoreCircle score={dailyScore} />
                <View style={styles.heroRight}>
                  <View style={styles.pillRow}>
                    <PlanetPill label={`Chandra · ${chartData?.vedic.moonRashi || '—'}`} color="#C9A84C" />
                    <PlanetPill label={`${chartData?.vedic.mahadasha || 'Loading...'}`} color="#7C3AED" />
                  </View>
                  {reading && (
                    <Text style={styles.energySummary} numberOfLines={3}>
                      {reading.daily_energy_summary}
                    </Text>
                  )}
                </View>
              </View>

              {/* Progress bar (only when reading is available) */}
              {dailyScore > 0 && (
                <View style={styles.scoreBarTrack}>
                  <View style={[styles.scoreBarFill, {
                    width: `${dailyScore}%`,
                    backgroundColor: scoreColor,
                  }]} />
                </View>
              )}
            </>
          )}

          {/* GeneratingView fills the card exclusively during generation */}
          {isWorking && (
            <GeneratingView
              status={generationStatus}
              progress={generationProgress}
              oraclesActive={parallelOraclesActive}
              chaptersDone={chaptersDone}
            />
          )}

          {hasError && (
            <Text style={styles.errorText}>
              Could not generate reading. Check your connection and restart the app.
            </Text>
          )}
        </BlurView>

        {/* ── Today's Guidance — horizontal 3-up mini cards ─────────────────── */}
        {isReady && (
          <>
            <Text style={styles.sectionLabel}>Today's Guidance</Text>
            <View style={styles.guidanceRow}>
              <GuidanceMini
                icon="✦"
                label="Favours"
                value={reading.career_strengths?.[0] || 'Creative work'}
                color="#44FF88"
              />
              <View style={styles.guidanceSpacer} />
              <GuidanceMini
                icon="△"
                label="Caution"
                value={dailyScore < 55 ? 'Financial calls' : 'Impulsive talk'}
                color="#FF6B6B"
              />
              <View style={styles.guidanceSpacer} />
              <GuidanceMini
                icon="◷"
                label="Peak Hours"
                value={new Date().getHours() < 12 ? '10–12 AM' : '3–5 PM'}
                color="#C9A84C"
              />
            </View>
          </>
        )}

        {/* ── Explore — asymmetric grid (matches Images 4 & 5) ─────────────── */}
        <Text style={styles.sectionLabel}>Explore</Text>

        {/* Row 1: tall Reading card on left, Charts + Ask Zephyra stacked right */}
        <View style={styles.exploreTop}>
          <TallExploreCard
            label="My Reading"
            sub="Full life analysis"
            symbol="◈"
            accent="#C9A84C"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              navigation.navigate('Reading')
            }}
          />
          <View style={styles.exploreRightCol}>
            <ExploreCard
              label="My Charts"
              sub="Visual star maps"
              symbol="◎"
              accent="#7B2FBE"
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            />
            <ExploreCard
              label="Ask Zephyra"
              sub="AI oracle chat"
              symbol="◉"
              accent="#2FBEBE"
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>

        {/* Row 2: full-width Forecast banner */}
        <TouchableOpacity
          style={styles.forecastCard}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#44FF88', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.forecastTopLine}
          />
          <LinearGradient
            colors={['rgba(68,255,136,0.08)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={[styles.forecastOrb, { backgroundColor: '#44FF88' }]} />
          <View style={styles.forecastInner}>
            <View>
              <Text style={[styles.forecastSymbol, { color: '#44FF88' }]}>◐</Text>
              <Text style={styles.forecastLabel}>Monthly Forecast</Text>
              <Text style={styles.forecastSub}>Your month ahead, mapped</Text>
            </View>
            <Text style={styles.forecastArrow}>→</Text>
          </View>
        </TouchableOpacity>

        {/* ── Cosmic Identity strip ──────────────────────────────────────────── */}
        {chartData && (
          <>
            <Text style={styles.sectionLabel}>Vedic Jyotish Chart</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.identityScroll}
            >
              <IdentityCard
                title="Lagna"
                lines={[
                  `${chartData.vedic.lagna} Rising`,
                  `${chartData.vedic.lagnaDegree}° degree`,
                  'Ascendant',
                ]}
                accent="#C9A84C"
              />
              <IdentityCard
                title="Surya"
                lines={[
                  `${chartData.vedic.rashi} Rashi`,
                  `${chartData.vedic.rashiDegree}°`,
                  'Sun Sign',
                ]}
                accent="#FF9500"
              />
              <IdentityCard
                title="Chandra"
                lines={[
                  `${chartData.vedic.moonRashi} Rashi`,
                  chartData.vedic.nakshatra,
                  `Pada ${chartData.vedic.nakshatraPada}`,
                ]}
                accent="#7B2FBE"
              />
              <IdentityCard
                title="Mahadasha"
                lines={[
                  chartData.vedic.mahadasha,
                  chartData.vedic.mahadashaPeriod,
                  chartData.vedic.antardasha,
                ]}
                accent="#2FBEBE"
              />
              {chartData.vedic.grahas.filter(g => ['Mangal','Guru','Shani','Shukra'].includes(g.name)).map(g => (
                <IdentityCard
                  key={g.name}
                  title={g.name}
                  lines={[
                    `${g.rashi} · H${g.house}`,
                    g.nakshatra,
                    g.isExalted ? '✦ Exalted' : g.isDebilitated ? '⚠ Debilitated' : `Pada ${g.nakshatraPada}`,
                  ]}
                  accent={
                    g.name === 'Mangal' ? '#BE2F2F' :
                    g.name === 'Guru' ? '#44FF88' :
                    g.name === 'Shani' ? '#8E8EBE' : '#BE2F6E'
                  }
                />
              ))}
              {chartData.vedic.yogas.length > 0 && (
                <IdentityCard
                  title="Yogas"
                  lines={chartData.vedic.yogas.slice(0, 2).map(y => y.split('(')[0].trim())}
                  accent="#FFD700"
                />
              )}
            </ScrollView>
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: { flex: 1 },
  eyebrow: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    letterSpacing: 3,
    color: 'rgba(201,168,76,0.55)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  greeting: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    color: '#C9A84C',
    letterSpacing: 0.5,
    lineHeight: 30,
    marginBottom: 5,
  },
  dateText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  avatarLetter: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#05050F',
    zIndex: 1,
  },

  // Hero score card
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    overflow: 'hidden',
    padding: 24,
    marginBottom: 16,
    position: 'relative',
  },
  heroTopLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
  },
  heroOrb: {
    position: 'absolute',
    top: -30, right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(124,58,237,0.18)',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  heroRight: { flex: 1 },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  energySummary: {
    fontFamily: Fonts.mystical,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  scoreBarTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#FF4444',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },

  // Section label
  sectionLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 22,
  },

  // Guidance row
  guidanceRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  guidanceSpacer: { width: 10 },

  // FIX: removed fixed height: 220 — cards now size to their content
  exploreTop: {
    flexDirection: 'row',
    gap: 12,
  },
  exploreRightCol: {
    flex: 1,
    flexDirection: 'column',
  },

  // Forecast full-width card
  forecastCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(68,255,136,0.25)',
    backgroundColor: 'rgba(13,13,43,0.6)',
    overflow: 'hidden',
    marginTop: 12,
    position: 'relative',
  },
  forecastTopLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  forecastOrb: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.1,
  },
  forecastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  forecastSymbol: { fontSize: 22, marginBottom: 8 },
  forecastLabel: {
    fontFamily: Fonts.heading,
    fontSize: 15,
    color: '#E8E8FF',
    marginBottom: 3,
  },
  forecastSub: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
  },
  forecastArrow: {
    fontSize: 26,
    color: 'rgba(68,255,136,0.3)',
  },

  // Identity strip
  identityScroll: {
    paddingRight: 20,
  },
})
