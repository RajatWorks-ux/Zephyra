// src/screens/main/ForecastScreen.tsx — PHASE 2 FULL BUILD
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, ActivityIndicator, Dimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForecastStore } from '../../store/forecastStore'
import { useReadingStore } from '../../store/readingStore'
import { useAuthStore } from '../../store/authStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const { width } = Dimensions.get('window')
type Tab = 'today' | 'week' | 'month' | 'year'

// ── Score circle color ─────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return '#44FF88'
  if (score >= 50) return '#C9A84C'
  if (score >= 30) return '#FF8C00'
  return '#FF4444'
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score, width: w }: { score: number; width?: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: score / 100, duration: 800, useNativeDriver: false }).start()
  }, [score])
  const barW = w ?? (Dimensions.get('window').width - 80)
  return (
    <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, width: barW }}>
      <Animated.View style={{
        height: 6, borderRadius: 3,
        width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, barW] }),
        backgroundColor: scoreColor(score),
      }} />
    </View>
  )
}

// ── Tab pill ──────────────────────────────────────────────────────────────────
function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabPill, active && styles.tabPillActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Today Tab ─────────────────────────────────────────────────────────────────
function TodayTab({ userId, chartData }: { userId: string; chartData: any }) {
  const { todayForecast, isTodayLoading, loadTodayForecast } = useForecastStore()
  useEffect(() => { loadTodayForecast(userId, chartData) }, [userId])

  if (isTodayLoading) return <LoadingState label="Reading today's cosmic weather..." />

  if (!todayForecast) return <ErrorState onRetry={() => loadTodayForecast(userId, chartData)} />

  const { score, energyLabel, summary, fullText, doList, avoidList, keyTransit, moonPhase, moonSign } = todayForecast

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Score Banner */}
      <BlurView intensity={14} tint="dark" style={styles.scoreBanner}>
        <View style={styles.scoreBannerLeft}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor(score) }]}>
            <Text style={[styles.scoreNumber, { color: scoreColor(score) }]}>{score}</Text>
            <Text style={styles.scoreLabel}>/ 100</Text>
          </View>
        </View>
        <View style={styles.scoreBannerRight}>
          <Text style={[styles.energyLabel, { color: scoreColor(score) }]}>{energyLabel}</Text>
          <Text style={styles.summaryText}>{summary}</Text>
        </View>
      </BlurView>

      {/* Moon Phase */}
      <BlurView intensity={12} tint="dark" style={styles.card}>
        <Text style={styles.cardTitle}>🌙 Moon Phase</Text>
        <Text style={styles.moonPhase}>{moonPhase}</Text>
        <Text style={styles.moonSign}>Moon in {moonSign}</Text>
      </BlurView>

      {/* Key Transit */}
      {keyTransit ? (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>✦ Key Transit Today</Text>
          <Text style={styles.bodyText}>{keyTransit}</Text>
        </BlurView>
      ) : null}

      {/* Full Text */}
      {fullText ? (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>Today's Cosmic Forecast</Text>
          <Text style={styles.bodyText}>{fullText}</Text>
        </BlurView>
      ) : null}

      {/* Do's and Don'ts */}
      {(doList?.length > 0 || avoidList?.length > 0) && (
        <View style={styles.doRow}>
          {doList?.length > 0 && (
            <BlurView intensity={12} tint="dark" style={[styles.doCard, { flex: 1 }]}>
              <Text style={[styles.doHeader, { color: '#44FF88' }]}>✓ Favorable Today</Text>
              {doList.map((item, i) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
            </BlurView>
          )}
          {avoidList?.length > 0 && (
            <BlurView intensity={12} tint="dark" style={[styles.doCard, { flex: 1 }]}>
              <Text style={[styles.doHeader, { color: '#FF4444' }]}>✗ Avoid Today</Text>
              {avoidList.map((item, i) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
            </BlurView>
          )}
        </View>
      )}
    </ScrollView>
  )
}

// ── Week Tab ──────────────────────────────────────────────────────────────────
function WeekTab({ userId, chartData }: { userId: string; chartData: any }) {
  const { weekForecast, isWeekLoading, loadWeekForecast } = useForecastStore()
  useEffect(() => { loadWeekForecast(userId, chartData) }, [userId])
  if (isWeekLoading) return <LoadingState label="Charting your week ahead..." />
  if (!weekForecast?.length) return <ErrorState onRetry={() => loadWeekForecast(userId, chartData)} />

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* 7-day row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        {weekForecast.map((day, i) => {
          const d = new Date(day.date)
          const isToday = i === 0
          return (
            <BlurView key={i} intensity={12} tint="dark" style={[styles.dayCircle, isToday && styles.dayCircleToday]}>
              <Text style={[styles.dayName, isToday && { color: Colors.agedGold }]}>
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dayNum, isToday && { color: Colors.agedGold }]}>
                {d.getDate()}
              </Text>
              <View style={[styles.dayDot, { backgroundColor: scoreColor(day.score) }]} />
            </BlurView>
          )
        })}
      </ScrollView>

      {/* Day cards */}
      {weekForecast.map((day, i) => (
        <BlurView key={i} intensity={12} tint="dark" style={styles.weekCard}>
          <View style={styles.weekCardHeader}>
            <Text style={styles.weekCardDay}>
              {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[styles.weekCardScore, { color: scoreColor(day.score) }]}>{day.score}</Text>
          </View>
          <ScoreBar score={day.score} width={width - 80} />
          <Text style={[styles.energyLabelSm, { color: scoreColor(day.score), marginTop: 8 }]}>{day.energyLabel}</Text>
          <Text style={[styles.bodyText, { marginTop: 6 }]}>{day.summary}</Text>
          {day.keyTransit ? <Text style={styles.keyTransitSm}>✦ {day.keyTransit}</Text> : null}
        </BlurView>
      ))}
    </ScrollView>
  )
}

// ── Month Tab ─────────────────────────────────────────────────────────────────
function MonthTab({ userId, chartData }: { userId: string; chartData: any }) {
  const { monthForecast, isMonthLoading, loadMonthForecast } = useForecastStore()
  useEffect(() => { loadMonthForecast(userId, chartData) }, [userId])
  if (isMonthLoading) return <LoadingState label="Mapping your month ahead..." />
  if (!monthForecast) return <ErrorState onRetry={() => loadMonthForecast(userId, chartData)} />

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Monthly summary */}
      <BlurView intensity={14} tint="dark" style={styles.card}>
        <Text style={styles.cardTitle}>{monthForecast.monthName}</Text>
        <Text style={styles.bodyText}>{monthForecast.summary}</Text>
      </BlurView>

      {/* Calendar heatmap */}
      <BlurView intensity={12} tint="dark" style={styles.card}>
        <Text style={styles.cardTitle}>Monthly Energy Map</Text>
        <View style={styles.heatmap}>
          {monthForecast.days.map((day, i) => {
            const isToday = day.date === new Date().toISOString().split('T')[0]
            return (
              <View key={i} style={[
                styles.heatCell,
                { backgroundColor: scoreColor(day.score) + '55' },
                isToday && styles.heatCellToday,
              ]}>
                <Text style={[styles.heatDate, isToday && { color: '#fff', fontWeight: 'bold' }]}>
                  {new Date(day.date).getDate()}
                </Text>
              </View>
            )
          })}
        </View>
        <View style={styles.heatLegend}>
          {[['#44FF88', 'Peak'], ['#C9A84C', 'Steady'], ['#FF8C00', 'Mixed'], ['#FF4444', 'Challenge']].map(([c, l]) => (
            <View key={l} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: c }]} />
              <Text style={styles.legendText}>{l}</Text>
            </View>
          ))}
        </View>
      </BlurView>

      {/* Special alerts */}
      {monthForecast.specialAlerts?.length > 0 && (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>⚡ Cosmic Events This Month</Text>
          {monthForecast.specialAlerts.map((alert, i) => (
            <View key={i} style={styles.alertRow}>
              <Text style={styles.alertDate}>{new Date(alert.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertImpact}>{alert.impact}</Text>
              </View>
            </View>
          ))}
        </BlurView>
      )}
    </ScrollView>
  )
}

// ── Year Tab ──────────────────────────────────────────────────────────────────
function YearTab({ userId, chartData }: { userId: string; chartData: any }) {
  const { yearForecast, isYearLoading, loadYearForecast } = useForecastStore()
  const { chartData: cd } = useReadingStore()
  useEffect(() => { loadYearForecast(userId, chartData) }, [userId])
  if (isYearLoading) return <LoadingState label="Calculating your year ahead..." />
  if (!yearForecast) return <ErrorState onRetry={() => loadYearForecast(userId, chartData)} />

  const mahadasha = cd?.vedic?.mahadasha ?? ''
  const antardasha = cd?.vedic?.antardasha ?? ''

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Dasha Banner */}
      {mahadasha ? (
        <BlurView intensity={14} tint="dark" style={styles.dashaBanner}>
          <Text style={styles.dashaLabel}>Current Period</Text>
          <Text style={styles.dashaMain}>{mahadasha}</Text>
          {antardasha ? <Text style={styles.dashaSub}>Sub-period: {antardasha}</Text> : null}
        </BlurView>
      ) : null}

      {/* 12 months */}
      {yearForecast.months.map((month, i) => (
        <BlurView key={i} intensity={12} tint="dark" style={styles.yearCard}>
          <View style={styles.yearCardHeader}>
            <Text style={styles.yearMonthName}>{month.name}</Text>
            <Text style={[styles.yearScore, { color: scoreColor(month.energyBar) }]}>{month.energyBar}</Text>
          </View>
          <ScoreBar score={month.energyBar} width={width - 80} />
          <Text style={styles.yearKeyEvent}>✦ {month.keyEvent}</Text>
          <Text style={[styles.bodyText, { marginTop: 6 }]}>{month.summary}</Text>
        </BlurView>
      ))}
    </ScrollView>
  )
}

// ── Loading / Error helpers ───────────────────────────────────────────────────
function LoadingState({ label }: { label: string }) {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator color={Colors.agedGold} size="large" />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centerState}>
      <Text style={styles.errorSymbol}>✦</Text>
      <Text style={styles.errorText}>Could not load forecast</Text>
      <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Main ForecastScreen ───────────────────────────────────────────────────────
export function ForecastScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const fadeAnim = useRef(new Animated.Value(1)).current
  const { chartData } = useReadingStore()
  const { session } = useAuthStore()
  const userId = session?.user?.id ?? 'mock-user-001'

  const switchTab = (tab: Tab) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setActiveTab(tab)
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    })
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <View style={styles.root}>
      <Video
        source={Videos.forecastBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping shouldPlay isMuted
        onError={() => {}}
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.9)']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <BlurView intensity={18} tint="dark" style={styles.header}>
          <Text style={styles.headerTitle}>Cosmic Forecast</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </BlurView>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['today', 'week', 'month', 'year'] as Tab[]).map(tab => (
            <TabPill
              key={tab}
              label={tab.charAt(0).toUpperCase() + tab.slice(1)}
              active={activeTab === tab}
              onPress={() => switchTab(tab)}
            />
          ))}
        </View>

        {/* Content */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {!chartData ? (
            <LoadingState label="Loading your chart..." />
          ) : (
            <>
              {activeTab === 'today' && <TodayTab userId={userId} chartData={chartData} />}
              {activeTab === 'week' && <WeekTab userId={userId} chartData={chartData} />}
              {activeTab === 'month' && <MonthTab userId={userId} chartData={chartData} />}
              {activeTab === 'year' && <YearTab userId={userId} chartData={chartData} />}
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const CELL_SIZE = (width - 40 - 6 * 7) / 7

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  header: {
    paddingHorizontal: 20, height: 70, justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.1)',
  },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.agedGold },
  headerDate: { fontFamily: Fonts.mystical, fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tabPill: {
    flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
  },
  tabPillActive: { borderColor: Colors.agedGold, backgroundColor: 'rgba(201,168,76,0.08)' },
  tabText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  tabTextActive: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.agedGold },
  tabContent: { paddingHorizontal: 16, paddingBottom: 40 },
  // Score banner
  scoreBanner: {
    flexDirection: 'row', borderRadius: 20, padding: 20, marginBottom: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', gap: 16,
  },
  scoreBannerLeft: { alignItems: 'center', justifyContent: 'center' },
  scoreCircle: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNumber: { fontFamily: Fonts.heading, fontSize: 22 },
  scoreLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  scoreBannerRight: { flex: 1, justifyContent: 'center' },
  energyLabel: { fontFamily: Fonts.heading, fontSize: 13, marginBottom: 6 },
  energyLabelSm: { fontFamily: Fonts.heading, fontSize: 11 },
  summaryText: { fontFamily: Fonts.mystical, fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  // Cards
  card: {
    borderRadius: 18, padding: 20, marginBottom: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.12)',
  },
  cardTitle: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.agedGold, marginBottom: 12 },
  bodyText: { fontFamily: Fonts.mystical, fontSize: 16, color: Colors.textSecondary, lineHeight: 26 },
  moonPhase: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.textPrimary, marginBottom: 4 },
  moonSign: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  // Do/Avoid
  doRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  doCard: { borderRadius: 18, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.12)' },
  doHeader: { fontFamily: Fonts.heading, fontSize: 11, marginBottom: 10 },
  doItem: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginBottom: 6, lineHeight: 20 },
  // Week
  dayCircle: {
    width: 52, height: 76, borderRadius: 14, marginRight: 8,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  dayCircleToday: { borderColor: Colors.agedGold },
  dayName: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  dayNum: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.textPrimary },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  weekCard: {
    borderRadius: 18, padding: 18, marginBottom: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)',
  },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekCardDay: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.textPrimary },
  weekCardScore: { fontFamily: Fonts.heading, fontSize: 14 },
  keyTransitSm: { fontFamily: Fonts.body, fontSize: 12, color: Colors.agedGold, marginTop: 8 },
  // Month heatmap
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  heatCell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  heatCellToday: { borderWidth: 2, borderColor: '#fff' },
  heatDate: { fontFamily: Fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  heatLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  alertRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  alertDate: { fontFamily: Fonts.heading, fontSize: 11, color: Colors.agedGold, width: 50 },
  alertTitle: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.textPrimary, marginBottom: 4 },
  alertImpact: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  // Year
  dashaBanner: {
    borderRadius: 18, padding: 20, marginBottom: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)', alignItems: 'center',
  },
  dashaLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  dashaMain: { fontFamily: Fonts.heading, fontSize: 20, color: Colors.agedGold },
  dashaSub: { fontFamily: Fonts.mystical, fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  yearCard: {
    borderRadius: 18, padding: 18, marginBottom: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)',
  },
  yearCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  yearMonthName: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.textPrimary },
  yearScore: { fontFamily: Fonts.heading, fontSize: 14 },
  yearKeyEvent: { fontFamily: Fonts.body, fontSize: 12, color: Colors.agedGold, marginTop: 8 },
  // States
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingLabel: { fontFamily: Fonts.mystical, fontSize: 16, color: Colors.textMuted, marginTop: 16, textAlign: 'center' },
  errorSymbol: { fontSize: 40, color: Colors.agedGold, marginBottom: 16 },
  errorText: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textMuted, marginBottom: 20 },
  retryBtn: { borderWidth: 1, borderColor: Colors.agedGold, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.agedGold },
})
