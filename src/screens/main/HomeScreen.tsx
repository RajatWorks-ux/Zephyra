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
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

// ─── Score Arc ────────────────────────────────────────────────────────────────
function ScoreArc({ score }: { score: number }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, { toValue: score / 100, duration: 1400, useNativeDriver: false, delay: 300 }).start()
  }, [score])

  const color = score >= 70 ? '#44FF88' : score >= 50 ? '#C9A84C' : '#FF4444'

  return (
    <View style={arc.container}>
      <View style={arc.track}>
        <Animated.View style={[arc.fill, {
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
        }]} />
      </View>
      <Text style={[arc.score, { color }]}>{score}</Text>
      <Text style={arc.label}>Cosmic Score</Text>
    </View>
  )
}

const arc = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 4 },
  track: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: { height: '100%', borderRadius: 2 },
  score: {
    fontFamily: Fonts.accentBold,
    fontSize: 42,
    letterSpacing: 2,
    textShadowColor: 'rgba(201,168,76,0.4)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
})

// ─── Identity Card ────────────────────────────────────────────────────────────
function IdentityCard({ title, lines, accent }: { title: string; lines: string[]; accent: string }) {
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
    width: 170,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginRight: 12,
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
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 3,
    lineHeight: 19,
  },
})

// ─── Quick Access Card ────────────────────────────────────────────────────────
function QuickCard({ label, sub, symbol, accent, onPress }: {
  label: string; sub: string; symbol: string; accent: string; onPress: () => void
}) {
  return (
    <TouchableOpacity style={[qcard.card, { borderColor: accent + '35' }]} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={[accent + '12', 'transparent']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Text style={[qcard.symbol, { color: accent }]}>{symbol}</Text>
      <Text style={qcard.label}>{label}</Text>
      <Text style={qcard.sub}>{sub}</Text>
    </TouchableOpacity>
  )
}

const qcard = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(13,13,43,0.6)',
    gap: 6,
  },
  symbol: { fontSize: 22, marginBottom: 2 },
  label: { fontFamily: Fonts.heading, fontSize: 14, color: '#E8E8FF', lineHeight: 20 },
  sub: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 16 },
})

// ─── Generating State ─────────────────────────────────────────────────────────
function GeneratingView({ status, progress }: { status: string; progress: number }) {
  const rotAnim = useRef(new Animated.Value(0)).current
  const textAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start()
  }, [])

  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={gen.container}>
      <View style={gen.orbWrap}>
        <Animated.View style={[gen.ring, { transform: [{ rotate }] }]} />
        <LinearGradient colors={['#C9A84C', '#7C3AED']} style={gen.orb} />
      </View>
      <Text style={gen.status}>{status}</Text>
      <View style={gen.bar}>
        <View style={[gen.fill, { width: `${progress}%` }]} />
      </View>
      <Text style={gen.sub}>Your complete cosmic profile is being assembled.</Text>
    </View>
  )
}

const gen = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  orbWrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, borderColor: '#C9A84C', borderTopColor: 'transparent',
    borderRightColor: 'rgba(201,168,76,0.3)',
  },
  orb: { width: 50, height: 50, borderRadius: 25 },
  status: {
    fontFamily: Fonts.mystical, fontSize: 15,
    color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 20, lineHeight: 24,
  },
  bar: {
    width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1, overflow: 'hidden', marginBottom: 16,
  },
  fill: { height: '100%', backgroundColor: '#C9A84C', borderRadius: 1 },
  sub: { fontFamily: Fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 20 },
})

// ─── MAIN HOME SCREEN ─────────────────────────────────────────────────────────
export function HomeScreen() {
  const navigation = useNavigation<Nav>()
  const { profile, birthProfile, signOut } = useAuthStore()
  const { chartData, reading, dailyScore, isLoading, isGenerating, generationStatus, generationProgress, hasError, initialize } = useReadingStore()

  useEffect(() => {
    if (profile?.id && birthProfile) {
      initialize(profile.id, birthProfile)
    }
  }, [profile?.id, birthProfile])

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ])
  }

  const isReady = chartData && reading && !isLoading && !isGenerating

  return (
    <View style={styles.root}>
      <Video
        source={Videos.homeBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping shouldPlay isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.3)', 'rgba(5,5,15,0.6)', 'rgba(5,5,15,0.85)']}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {getGreeting()}, {profile?.display_name?.split(' ')[0] || 'Seeker'}
            </Text>
            <Text style={styles.dateText}>{formatDate()}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7}>
            <View style={styles.avatar}>
              <LinearGradient colors={['#C9A84C', '#7C3AED']} style={styles.avatarGrad} />
              <Text style={styles.avatarLetter}>
                {(profile?.display_name || 'S')[0].toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Cosmic Score Card ────────────────────────────────────────────── */}
        <BlurView intensity={15} tint="dark" style={styles.scoreCard}>
          <LinearGradient
            colors={['rgba(201,168,76,0.08)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.scoreBorder} />
          <ScoreArc score={dailyScore} />
          {reading && (
            <Text style={styles.energySummary}>
              {reading.daily_energy_summary}
            </Text>
          )}
          {(isGenerating || isLoading) && (
            <GeneratingView status={generationStatus} progress={generationProgress} />
          )}
          {hasError && (
            <Text style={styles.errorText}>
              Could not generate reading. Check your connection and restart the app.
            </Text>
          )}
        </BlurView>

        {/* ── Identity Strip ───────────────────────────────────────────────── */}
        {chartData && (
          <>
            <Text style={styles.sectionLabel}>Your Cosmic Identity</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.identityScroll}
            >
              <IdentityCard
                title="Western"
                lines={[
                  `${chartData.western.sunSign} Sun`,
                  `${chartData.western.moonSign} Moon`,
                  `${chartData.western.ascendant} Rising`,
                ]}
                accent="#C9A84C"
              />
              <IdentityCard
                title="Vedic"
                lines={[
                  chartData.vedic.nakshatra,
                  `${chartData.vedic.moonRashi} Rashi`,
                  chartData.vedic.mahadasha,
                ]}
                accent="#7B2FBE"
              />
              <IdentityCard
                title="Chinese"
                lines={[
                  `${chartData.chinese.animal}`,
                  `${chartData.chinese.element} · ${chartData.chinese.polarity}`,
                  `Day: ${chartData.chinese.dayStem.split(' ')[0]}`,
                ]}
                accent="#BE2F2F"
              />
              <IdentityCard
                title="Mayan"
                lines={[
                  chartData.mayan.daySign.split('(')[0].trim(),
                  `Tone ${chartData.mayan.tone}`,
                  chartData.mayan.toneKeyword,
                ]}
                accent="#2FBEBE"
              />
              <IdentityCard
                title="Celtic"
                lines={[
                  `${chartData.celtic.treeName} Tree`,
                  chartData.celtic.treeMeaning.split(' ').slice(0, 3).join(' '),
                ]}
                accent="#44FF88"
              />
              <IdentityCard
                title="Egyptian"
                lines={[
                  chartData.egyptian.decanGod,
                  `Decan ${chartData.egyptian.decanNumber}`,
                  chartData.egyptian.sunDecan,
                ]}
                accent="#FFD700"
              />
            </ScrollView>
          </>
        )}

        {/* ── Today's Guidance ────────────────────────────────────────────── */}
        {isReady && (
          <>
            <Text style={styles.sectionLabel}>Today's Guidance</Text>
            <BlurView intensity={15} tint="dark" style={styles.guidanceCard}>
              <View style={styles.guidanceRow}>
                <Text style={styles.guidanceDot}>▸</Text>
                <View style={styles.guidanceText}>
                  <Text style={styles.guidanceLabel}>Favorable for</Text>
                  <Text style={styles.guidanceValue}>
                    {reading.career_strengths?.[0] || 'Creative expression and planning'}
                  </Text>
                </View>
              </View>
              <View style={styles.guidanceDivider} />
              <View style={styles.guidanceRow}>
                <Text style={[styles.guidanceDot, { color: '#FF6B6B' }]}>▸</Text>
                <View style={styles.guidanceText}>
                  <Text style={styles.guidanceLabel}>Approach with care</Text>
                  <Text style={styles.guidanceValue}>
                    {dailyScore < 55 ? 'Major financial decisions today' : 'Impulsive reactions under pressure'}
                  </Text>
                </View>
              </View>
              <View style={styles.guidanceDivider} />
              <View style={styles.guidanceRow}>
                <Text style={[styles.guidanceDot, { color: '#44FF88' }]}>▸</Text>
                <View style={styles.guidanceText}>
                  <Text style={styles.guidanceLabel}>Best hours today</Text>
                  <Text style={styles.guidanceValue}>
                    {new Date().getHours() < 12 ? '10:00 AM – 12:00 PM' : '3:00 PM – 5:00 PM'}
                  </Text>
                </View>
              </View>
            </BlurView>
          </>
        )}

        {/* ── Quick Access Grid ────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Explore</Text>
        <View style={styles.gridRow}>
          <QuickCard
            label="My Reading"
            sub="Full life analysis"
            symbol="◈"
            accent="#C9A84C"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              navigation.navigate('Reading')
            }}
          />
          <View style={styles.gridSpacer} />
          <QuickCard
            label="My Charts"
            sub="Visual star maps"
            symbol="◎"
            accent="#7B2FBE"
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
        </View>
        <View style={[styles.gridRow, { marginTop: 12 }]}>
          <QuickCard
            label="Ask Zephyra"
            sub="AI oracle chat"
            symbol="◉"
            accent="#2FBEBE"
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
          <View style={styles.gridSpacer} />
          <QuickCard
            label="Forecast"
            sub="Month ahead"
            symbol="◐"
            accent="#44FF88"
            onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          />
        </View>

        {/* Bottom padding for tab bar */}
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
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    color: '#C9A84C',
    marginBottom: 4,
  },
  dateText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
  },
  avatarGrad: { ...StyleSheet.absoluteFillObject },
  avatarLetter: {
    position: 'absolute',
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#05050F',
    zIndex: 1,
  },

  // Score card
  scoreCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
    overflow: 'hidden',
    padding: 24,
    marginBottom: 28,
    position: 'relative',
  },
  scoreBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.25)',
  },
  energySummary: {
    fontFamily: Fonts.mystical,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#FF4444',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },

  // Identity strip
  sectionLabel: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  identityScroll: {
    paddingRight: 20,
    marginBottom: 28,
  },

  // Guidance card
  guidanceCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    padding: 20,
    marginBottom: 28,
  },
  guidanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  guidanceDot: { fontSize: 14, color: '#C9A84C', marginTop: 2 },
  guidanceText: { flex: 1 },
  guidanceLabel: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  guidanceValue: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
  },
  guidanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 14,
  },

  // Quick access grid
  gridRow: { flexDirection: 'row' },
  gridSpacer: { width: 12 },
})
