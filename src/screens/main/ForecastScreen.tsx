// src/screens/main/ForecastScreen.tsx — PHASE 3: Full Vedic AI, layout fixes
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, ActivityIndicator, Dimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useForecastStore } from '../../store/forecastStore'
import { useReadingStore } from '../../store/readingStore'
import { useAuthStore } from '../../store/authStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const { width } = Dimensions.get('window')
const TAB_BAR_HEIGHT = 80 // approximate tab bar + safe area
type Tab = 'today' | 'week' | 'month' | 'year'

// ── Score circle color ─────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return '#44FF88'
  if (score >= 55) return '#C9A84C'
  if (score >= 35) return '#FF8C00'
  return '#FF4444'
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score, width: w }: { score: number; width?: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: score / 100, duration: 800, useNativeDriver: false }).start()
  }, [score])
  const barW = w ?? (width - 80)
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

// ── Oracle floating button ────────────────────────────────────────────────────
function OracleButton({ context }: { context: string }) {
  const navigation = useNavigation<any>()
  return (
    <TouchableOpacity
      style={styles.oracleBtn}
      onPress={() => navigation.navigate('Chat', { prefill: context })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(201,168,76,0.25)', 'rgba(201,168,76,0.08)']}
        style={styles.oracleBtnInner}
      >
        <Text style={styles.oracleBtnText}>◈ Ask Oracle</Text>
      </LinearGradient>
    </TouchableOpacity>
  )
}

// ── Today Tab ─────────────────────────────────────────────────────────────────
function TodayTab({ userId, chartData }: { userId: string; chartData: any }) {
  const { todayForecast, isTodayLoading, loadTodayForecast } = useForecastStore()
  useEffect(() => { loadTodayForecast(userId, chartData) }, [userId])

  if (isTodayLoading) return <LoadingState label="Reading today's cosmic weather..." />
  if (!todayForecast) return <ErrorState onRetry={() => loadTodayForecast(userId, chartData)} />

  const { score, energyLabel, summary, fullText, doList, avoidList, keyTransit, moonPhase, moonSign, moonNakshatra } = todayForecast
  const mahadasha = chartData?.vedic?.mahadasha?.replace(' Mahadasha', '') ?? ''

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: TAB_BAR_HEIGHT + 24 }]}
      showsVerticalScrollIndicator={false}
    >
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

      {/* Moon Info */}
      <BlurView intensity={12} tint="dark" style={styles.card}>
        <Text style={styles.cardTitle}>🌙 Moon Phase & Nakshatra</Text>
        <Text style={styles.moonPhase}>{moonPhase}</Text>
        <Text style={styles.moonSign}>Moon in {moonSign}</Text>
        {moonNakshatra ? <Text style={styles.moonNak}>Nakshatra: {moonNakshatra}</Text> : null}
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

      {/* Do's and Avoid */}
      {(doList?.length > 0 || avoidList?.length > 0) && (
        <View style={styles.doRow}>
          {doList?.length > 0 && (
            <BlurView intensity={12} tint="dark" style={[styles.doCard, { flex: 1 }]}>
              <Text style={[styles.doHeader, { color: '#44FF88' }]}>✓ Favorable</Text>
              {doList.map((item: string, i: number) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
            </BlurView>
          )}
          {avoidList?.length > 0 && (
            <BlurView intensity={12} tint="dark" style={[styles.doCard, { flex: 1 }]}>
              <Text style={[styles.doHeader, { color: '#FF4444' }]}>✗ Avoid</Text>
              {avoidList.map((item: string, i: number) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
            </BlurView>
          )}
        </View>
      )}

      <OracleButton context={`Tell me more about today's forecast — I have ${mahadasha} Mahadasha and Moon in ${moonNakshatra}.`} />
    </ScrollView>
  )
}

// ── Week Tab ──────────────────────────────────────────────────────────────────
function WeekTab({ userId, chartData }: { userId: string; chartData: any }) {
  const { weekForecast, isWeekLoading, loadWeekForecast } = useForecastStore()
  const [selectedDay, setSelectedDay] = useState(0)
  useEffect(() => { loadWeekForecast(userId, chartData) }, [userId])
  if (isWeekLoading) return <LoadingState label="Charting your week ahead..." />
  if (!weekForecast?.length) return <ErrorState onRetry={() => loadWeekForecast(userId, chartData)} />

  const day = weekForecast[selectedDay]
  const mahadasha = chartData?.vedic?.mahadasha?.replace(' Mahadasha', '') ?? ''

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: TAB_BAR_HEIGHT + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* 7-day selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        {weekForecast.map((d, i) => {
          const dt = new Date(d.date + 'T12:00:00')
          const isSelected = i === selectedDay
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDay(i)}
              activeOpacity={0.8}
            >
              <BlurView
                intensity={12}
                tint="dark"
                style={[styles.dayCircle, isSelected && { borderColor: scoreColor(d.score) }]}
              >
                <Text style={[styles.dayName, isSelected && { color: scoreColor(d.score) }]}>
                  {dt.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dayNum, isSelected && { color: scoreColor(d.score) }]}>
                  {dt.getDate()}
                </Text>
                <View style={[styles.dayDot, { backgroundColor: scoreColor(d.score) }]} />
                <Text style={[styles.dayScore, { color: scoreColor(d.score) }]}>{d.score}</Text>
              </BlurView>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Selected day detail */}
      {day && (
        <>
          <BlurView intensity={14} tint="dark" style={styles.scoreBanner}>
            <View style={styles.scoreBannerLeft}>
              <View style={[styles.scoreCircle, { borderColor: scoreColor(day.score) }]}>
                <Text style={[styles.scoreNumber, { color: scoreColor(day.score) }]}>{day.score}</Text>
                <Text style={styles.scoreLabel}>/ 100</Text>
              </View>
            </View>
            <View style={styles.scoreBannerRight}>
              <Text style={[styles.energyLabel, { color: scoreColor(day.score) }]}>
                {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
              <Text style={[styles.energyLabelSm, { color: scoreColor(day.score), marginBottom: 6 }]}>{day.energyLabel}</Text>
              <ScoreBar score={day.score} width={width - 160} />
            </View>
          </BlurView>

          {day.summary ? (
            <BlurView intensity={12} tint="dark" style={styles.card}>
              <Text style={styles.cardTitle}>Day Overview</Text>
              <Text style={styles.bodyText}>{day.summary}</Text>
            </BlurView>
          ) : null}

          {day.keyTransit ? (
            <BlurView intensity={12} tint="dark" style={styles.card}>
              <Text style={styles.cardTitle}>✦ Key Astrological Influence</Text>
              <Text style={styles.bodyText}>{day.keyTransit}</Text>
            </BlurView>
          ) : null}

          {day.moonNakshatra ? (
            <BlurView intensity={12} tint="dark" style={styles.card}>
              <Text style={styles.cardTitle}>🌙 Moon</Text>
              <Text style={styles.moonNak}>Nakshatra: {day.moonNakshatra}</Text>
            </BlurView>
          ) : null}

          {(day.doList?.length > 0 || day.avoidList?.length > 0) && (
            <View style={styles.doRow}>
              {day.doList?.length > 0 && (
                <BlurView intensity={12} tint="dark" style={[styles.doCard, { flex: 1 }]}>
                  <Text style={[styles.doHeader, { color: '#44FF88' }]}>✓ Favorable</Text>
                  {day.doList.map((item: string, i: number) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
                </BlurView>
              )}
              {day.avoidList?.length > 0 && (
                <BlurView intensity={12} tint="dark" style={[styles.doCard, { flex: 1 }]}>
                  <Text style={[styles.doHeader, { color: '#FF4444' }]}>✗ Avoid</Text>
                  {day.avoidList.map((item: string, i: number) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
                </BlurView>
              )}
            </View>
          )}
        </>
      )}

      <OracleButton context={`Explain my weekly forecast in depth. ${mahadasha} Mahadasha. What should I focus on this week?`} />
    </ScrollView>
  )
}

// ── Month Tab ─────────────────────────────────────────────────────────────────
function MonthTab({ userId, chartData }: { userId: string; chartData: any }) {
  const { monthForecast, isMonthLoading, loadMonthForecast } = useForecastStore()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  useEffect(() => { loadMonthForecast(userId, chartData) }, [userId])
  if (isMonthLoading) return <LoadingState label="Mapping your month ahead..." />
  if (!monthForecast) return <ErrorState onRetry={() => loadMonthForecast(userId, chartData)} />

  const mahadasha = chartData?.vedic?.mahadasha?.replace(' Mahadasha', '') ?? ''
  const today = new Date().toISOString().split('T')[0]

  // Compute starting weekday offset (0=Sun, 1=Mon ... 6=Sat)
  const firstDay = monthForecast.days[0]
  const firstDayOfWeek = firstDay ? new Date(firstDay.date + 'T12:00:00').getDay() : 0
  const emptyPrefix = Array.from({ length: firstDayOfWeek })

  const selectedDayData = selectedDate
    ? monthForecast.days.find(d => d.date === selectedDate)
    : null

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: TAB_BAR_HEIGHT + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Monthly summary */}
      <BlurView intensity={14} tint="dark" style={styles.card}>
        <Text style={styles.cardTitle}>{monthForecast.monthName}</Text>
        <Text style={styles.bodyText}>{monthForecast.summary}</Text>
      </BlurView>

      {/* Calendar heatmap with weekday headers + offset */}
      <BlurView intensity={12} tint="dark" style={styles.card}>
        <Text style={styles.cardTitle}>Monthly Energy Map</Text>

        {/* Day of week header */}
        <View style={styles.heatHeader}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <View key={i} style={styles.heatHeaderCell}>
              <Text style={styles.heatHeaderText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid with prefix offset */}
        <View style={styles.heatmap}>
          {emptyPrefix.map((_, i) => (
            <View key={`empty-${i}`} style={[styles.heatCell, { backgroundColor: 'transparent' }]} />
          ))}
          {monthForecast.days.map((day, i) => {
            const isToday = day.date === today
            const isSelected = day.date === selectedDate
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedDate(day.date === selectedDate ? null : day.date)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.heatCell,
                  { backgroundColor: scoreColor(day.score) + '55' },
                  isToday && styles.heatCellToday,
                  isSelected && { borderWidth: 2, borderColor: Colors.agedGold },
                ]}>
                  <Text style={[styles.heatDate, isToday && { color: '#fff', fontWeight: 'bold' }]}>
                    {new Date(day.date + 'T12:00:00').getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
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

      {/* Selected day detail */}
      {selectedDayData && (
        <BlurView intensity={14} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>
            {new Date(selectedDayData.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <View style={[styles.scoreCircleSm, { borderColor: scoreColor(selectedDayData.score) }]}>
              <Text style={[styles.scoreNumberSm, { color: scoreColor(selectedDayData.score) }]}>{selectedDayData.score}</Text>
            </View>
            <View>
              <Text style={[styles.energyLabelSm, { color: scoreColor(selectedDayData.score) }]}>{selectedDayData.energyLabel}</Text>
              {selectedDayData.moonNakshatra ? <Text style={styles.moonNak}>🌙 {selectedDayData.moonNakshatra}</Text> : null}
            </View>
          </View>
          {selectedDayData.keyTransit ? <Text style={styles.bodyText}>✦ {selectedDayData.keyTransit}</Text> : null}
        </BlurView>
      )}

      {/* Special alerts */}
      {monthForecast.specialAlerts?.length > 0 && (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <Text style={styles.cardTitle}>⚡ Cosmic Events This Month</Text>
          {monthForecast.specialAlerts.map((alert, i) => (
            <View key={i} style={styles.alertRow}>
              <Text style={styles.alertDate}>{new Date(alert.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertImpact}>{alert.impact}</Text>
              </View>
            </View>
          ))}
        </BlurView>
      )}

      <OracleButton context={`Tell me about this month's most important astrological events for my chart. ${mahadasha} Mahadasha.`} />
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
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: TAB_BAR_HEIGHT + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {mahadasha ? (
        <BlurView intensity={14} tint="dark" style={styles.dashaBanner}>
          <Text style={styles.dashaLabel}>Current Dasha Period</Text>
          <Text style={styles.dashaMain}>{mahadasha}</Text>
          {antardasha ? <Text style={styles.dashaSub}>Sub-period: {antardasha}</Text> : null}
        </BlurView>
      ) : null}

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

      <OracleButton context={`Give me a deep dive into my year ahead. ${mahadasha} ${antardasha}. What are the most critical months?`} />
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
              {activeTab === 'week'  && <WeekTab  userId={userId} chartData={chartData} />}
              {activeTab === 'month' && <MonthTab userId={userId} chartData={chartData} />}
              {activeTab === 'year'  && <YearTab  userId={userId} chartData={chartData} />}
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

import { StyleSheet } from 'react-native'
const CELL_SIZE = Math.floor((width - 40 - 6 * 6) / 7)

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
  tabContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Oracle button
  oracleBtn: { marginTop: 8, marginBottom: 8, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  oracleBtnInner: { paddingVertical: 14, alignItems: 'center' },
  oracleBtnText: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.agedGold },

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
  scoreCircleSm: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNumber: { fontFamily: Fonts.heading, fontSize: 22 },
  scoreNumberSm: { fontFamily: Fonts.heading, fontSize: 16 },
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
  moonNak: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 3 },

  // Do/Avoid
  doRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  doCard: { borderRadius: 18, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.12)' },
  doHeader: { fontFamily: Fonts.heading, fontSize: 11, marginBottom: 10 },
  doItem: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginBottom: 6, lineHeight: 20 },

  // Week day circles
  dayCircle: {
    width: 52, height: 82, borderRadius: 14, marginRight: 8,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  dayName: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  dayNum: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.textPrimary },
  dayDot: { width: 6, height: 6, borderRadius: 3 },
  dayScore: { fontFamily: Fonts.body, fontSize: 10 },

  weekCard: {
    borderRadius: 18, padding: 18, marginBottom: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)',
  },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekCardDay: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.textPrimary },
  weekCardScore: { fontFamily: Fonts.heading, fontSize: 14 },
  keyTransitSm: { fontFamily: Fonts.body, fontSize: 12, color: Colors.agedGold, marginTop: 8 },

  // Month heatmap
  heatHeader: { flexDirection: 'row', marginBottom: 6 },
  heatHeaderCell: { width: CELL_SIZE, alignItems: 'center' },
  heatHeaderText: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
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
