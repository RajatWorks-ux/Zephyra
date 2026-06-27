// src/screens/main/ForecastScreen.tsx — COMPLETE OVERHAUL
// ─────────────────────────────────────────────────────────────────────────────
// Changes from the previous version:
//  • Year tab removed entirely. Three tabs only: Today · Week · Month.
//    (Forecast generation for all three now happens automatically in the
//    background via forecastStore.autoGenerateAll, kicked off from
//    readingStore the moment a reading is ready — see src/store/readingStore.ts.
//    This screen now just reads whatever is already cached; the loading
//    states below only show if the user opens the screen before that
//    background generation has finished, which should be rare.)
//  • Today tab: hero score circle with animated arc, Moon section (sign +
//    nakshatra + pada + phase), active Dasha pill, Do/Avoid two-column
//    lists, Key Transit card, full 24-hour Hora timeline (tap for detail),
//    Sade Sati / Jupiter alert card, "Ask Oracle" button.
//  • Week tab: week overview (theme/best day/careful day/dominant
//    influence), special alerts strip, 7-day horizontal scroll + tap to
//    expand full detail inline, "Ask Oracle" button.
//  • Month tab: monthly overview (theme + best fortnight + energy bar),
//    redesigned calendar grid (today ring, gold star for favorable days,
//    tap-a-day bottom sheet), special events strip, Best Days for
//    Love/Money sections, "Ask Oracle" button.
//  • Visual system: glassmorphic cards throughout, score color scale
//    (#44FF88/#C9A84C/#FF8C00/#FF4444), CinzelDecorative headers /
//    Orbitron numbers / CormorantGaramond narrative / Inter labels, gold
//    divider lines on section headers, haptic feedback on taps.
//  • "Ask Oracle" now opens ForecastOracleModal (a DIFFERENT structure from
//    the chart popup — verdict band + Do/Avoid checklist + best-window +
//    watch-for, not 3 paragraph sections) instead of navigating to chat.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, ActivityIndicator, Dimensions, Modal,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useForecastStore, type WeekDayCard, type ForecastDay } from '../../store/forecastStore'
import { useReadingStore } from '../../store/readingStore'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { TAB_BAR_CONTENT_HEIGHT } from '../../components/ui/BottomTabBar'
import { ForecastOracleModal } from '../../components/forecast/ForecastOracleModal'

const { width } = Dimensions.get('window')
type Tab = 'today' | 'week' | 'month'

// ── Score color ────────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score >= 75) return '#44FF88'
  if (score >= 50) return '#C9A84C'
  if (score >= 30) return '#FF8C00'
  return '#FF4444'
}

// ── Section header with gold divider on the left ──────────────────────────────
function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionHeaderBar} />
      <Text style={styles.sectionHeaderText}>{icon ? `${icon}  ${title}` : title}</Text>
    </View>
  )
}

// ── Animated score arc (hero) ──────────────────────────────────────────────────
function HeroScoreCircle({ score }: { score: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: score, duration: 1100, useNativeDriver: false }).start()
  }, [score])
  const color = scoreColor(score)
  return (
    <View style={styles.heroCircleWrap}>
      <View style={[styles.heroCircleRing, { borderColor: color + '33' }]} />
      <View style={[styles.heroCircleRing, styles.heroCircleRingInner, { borderColor: color }]} />
      <View style={styles.heroCircleCenter}>
        <Animated.Text style={[styles.heroScoreNum, { color }]}>
          {Math.round(score)}
        </Animated.Text>
        <Text style={styles.heroScoreOutOf}>/ 100</Text>
      </View>
    </View>
  )
}

// ── Tab pill ────────────────────────────────────────────────────────────────────
function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tabPill, active && styles.tabPillActive]} activeOpacity={0.85}>
      {active ? (
        <LinearGradient colors={['rgba(201,168,76,0.28)', 'rgba(201,168,76,0.08)']} style={StyleSheet.absoluteFillObject} />
      ) : null}
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

// ── Ask Oracle button — opens the structurally-distinct ForecastOracleModal ───
function OracleButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.oracleBtn}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress() }}
      activeOpacity={0.85}
    >
      <LinearGradient colors={['rgba(201,168,76,0.28)', 'rgba(124,58,237,0.14)']} style={styles.oracleBtnInner}>
        <Text style={styles.oracleBtnText}>◈ Ask Oracle</Text>
      </LinearGradient>
    </TouchableOpacity>
  )
}

// ── Moon phase icon glyphs ──────────────────────────────────────────────────────
const PHASE_GLYPH: Record<string, string> = {
  new: '🌑', 'waxing-crescent': '🌒', 'first-quarter': '🌓', 'waxing-gibbous': '🌔',
  full: '🌕', 'waning-gibbous': '🌖', 'last-quarter': '🌗', 'waning-crescent': '🌘',
}

// ── Hora bottom sheet ───────────────────────────────────────────────────────────
function HoraDetailSheet({ hour, onClose }: { hour: { hour: number; ruler: string; quality: string; goodFor: string } | null; onClose: () => void }) {
  if (!hour) return null
  const label = hour.hour === 0 ? '12 AM' : hour.hour < 12 ? `${hour.hour} AM` : hour.hour === 12 ? '12 PM' : `${hour.hour - 12} PM`
  const qColor = hour.quality === 'favorable' ? '#44FF88' : hour.quality === 'challenging' ? '#FF4444' : '#C9A84C'
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose}>
        <View />
      </TouchableOpacity>
      <View style={styles.sheetWrap}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(13,13,43,0.97)', 'rgba(5,5,15,0.99)']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTime}>{label} Hora</Text>
        <View style={[styles.sheetRulerPill, { borderColor: qColor }]}>
          <Text style={[styles.sheetRulerText, { color: qColor }]}>{hour.ruler} · {hour.quality}</Text>
        </View>
        <Text style={styles.sheetGoodForLabel}>GOOD FOR</Text>
        <Text style={styles.sheetGoodForText}>{hour.goodFor}</Text>
        <TouchableOpacity style={styles.sheetCloseBtn} onPress={onClose}>
          <Text style={styles.sheetCloseText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

// ── Today Tab ───────────────────────────────────────────────────────────────────
function TodayTab({
  userId, chartData, bottomPad, onAskOracle,
}: { userId: string; chartData: any; bottomPad: number; onAskOracle: (ctx: string) => void }) {
  const { todayForecast, isTodayLoading, loadTodayForecast } = useForecastStore()
  const [selectedHour, setSelectedHour] = useState<any>(null)
  useEffect(() => { loadTodayForecast(userId, chartData) }, [userId])

  if (isTodayLoading && !todayForecast) return <LoadingState label="Reading today's cosmic weather..." />
  if (!todayForecast) return <ErrorState onRetry={() => loadTodayForecast(userId, chartData)} />

  const { score, energyLabel, summary, fullText, doList, avoidList, keyTransit, keyTransitInterpretation, moon, dasha, horaList, sadeSatiActive, sadeSatiPhase, jupiterFavorable } = todayForecast
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const currentHour = new Date().getHours()

  return (
    <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <BlurView intensity={16} tint="dark" style={styles.heroCard}>
        <LinearGradient colors={[scoreColor(score) + '1A', 'transparent']} style={StyleSheet.absoluteFillObject} />
        <HeroScoreCircle score={score} />
        <Text style={[styles.heroEnergyLabel, { color: scoreColor(score) }]}>{energyLabel}</Text>
        <Text style={styles.heroDate}>{todayStr}</Text>
        <Text style={styles.heroSummary}>{summary}</Text>
      </BlurView>

      {/* Sade Sati / Jupiter alert */}
      {sadeSatiActive ? (
        <View style={styles.alertCardAmber}>
          <Text style={styles.alertCardIcon}>⚠</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertCardTitle}>Sade Sati — {sadeSatiPhase ?? 'active'} phase</Text>
            <Text style={styles.alertCardBody}>Saturn is transiting near your natal Moon. This brings karmic tests, patience-building, and emotional pressure — approach big decisions slowly.</Text>
          </View>
        </View>
      ) : jupiterFavorable ? (
        <View style={styles.alertCardGreen}>
          <Text style={styles.alertCardIcon}>✦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertCardTitle}>Favorable Jupiter Transit</Text>
            <Text style={styles.alertCardBody}>Jupiter is supporting expansion, opportunity, and good fortune right now — a strong window to take initiative.</Text>
          </View>
        </View>
      ) : null}

      {/* Moon section */}
      <BlurView intensity={12} tint="dark" style={styles.card}>
        <SectionHeader title="Moon" icon={PHASE_GLYPH[moon.phaseIcon] ?? '🌙'} />
        <View style={styles.moonRow}>
          <Text style={styles.moonSignText}>{moon.rashi}</Text>
          <Text style={styles.moonDivider}>·</Text>
          <Text style={styles.moonSignText}>{moon.nakshatra} Pada {moon.pada}</Text>
        </View>
        <Text style={styles.moonPhaseName}>{moon.phaseName} · {moon.paksha}</Text>
        <Text style={styles.bodyText}>{moon.interpretation}</Text>
      </BlurView>

      {/* Active Dasha pill */}
      {dasha ? (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <SectionHeader title="Active Dasha" icon="◈" />
          <View style={styles.dashaPillRow}>
            <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(201,168,76,0.2)']} style={styles.dashaPill}>
              <Text style={styles.dashaPillText}>{dasha.mahadashaLord} → {dasha.antardashaLord}</Text>
            </LinearGradient>
            {dasha.antardashaEndDate ? (
              <Text style={styles.dashaEndDate}>
                until {new Date(dasha.antardashaEndDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.bodyText, { marginTop: 10 }]}>{dasha.meaning}</Text>
        </BlurView>
      ) : null}

      {/* Do / Avoid */}
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

      {/* Key Transit */}
      {keyTransit ? (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <SectionHeader title="Key Transit of the Day" icon="✦" />
          <Text style={styles.keyTransitTitle}>{keyTransit}</Text>
          {keyTransitInterpretation ? <Text style={[styles.bodyText, { marginTop: 6 }]}>{keyTransitInterpretation}</Text> : null}
        </BlurView>
      ) : null}

      {/* Hora Timeline */}
      {horaList?.length > 0 && (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <SectionHeader title="Hora Timeline" icon="⏳" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {horaList.map((h, i) => {
              const isNow = h.hour === currentHour
              const qColor = h.quality === 'favorable' ? '#44FF88' : h.quality === 'challenging' ? '#FF4444' : 'rgba(255,255,255,0.3)'
              const label = h.hour === 0 ? '12A' : h.hour < 12 ? `${h.hour}A` : h.hour === 12 ? '12P' : `${h.hour - 12}P`
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => { Haptics.selectionAsync(); setSelectedHour(h) }}
                  style={[styles.horaCell, isNow && styles.horaCellNow, { borderColor: qColor + '55' }]}
                  activeOpacity={0.75}
                >
                  {isNow && <View style={styles.horaGlow} />}
                  <Text style={styles.horaHourLabel}>{label}</Text>
                  <View style={[styles.horaDot, { backgroundColor: qColor }]} />
                  <Text style={styles.horaRulerLabel}>{h.ruler.slice(0, 3)}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </BlurView>
      )}

      {/* Full forecast text */}
      {fullText ? (
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <SectionHeader title="Today's Cosmic Forecast" />
          <Text style={styles.bodyText}>{fullText}</Text>
        </BlurView>
      ) : null}

      <OracleButton onPress={() => onAskOracle(buildTodayOracleContext(todayForecast, chartData))} />

      <HoraDetailSheet hour={selectedHour} onClose={() => setSelectedHour(null)} />
    </ScrollView>
  )
}

function buildTodayOracleContext(day: ForecastDay, chartData: any): string {
  const v = chartData?.vedic
  return `Today (${day.date}): Score ${day.score}/100, ${day.energyLabel}. Moon in ${day.moon.rashi} sign, ${day.moon.nakshatra} Nakshatra Pada ${day.moon.pada}, phase ${day.moon.phaseName}. Key transit: ${day.keyTransit}. Active Dasha: ${day.dasha?.mahadashaLord ?? v?.mahadasha} → ${day.dasha?.antardashaLord ?? v?.antardasha}. Sade Sati: ${day.sadeSatiActive ? `active (${day.sadeSatiPhase})` : 'not active'}. Jupiter: ${day.jupiterFavorable ? 'favorable' : 'mixed'}. Lagna: ${v?.lagna}.`
}

// ── Week Tab ─────────────────────────────────────────────────────────────────
function WeekDayCardView({ day, isToday, isExpanded, onToggle }: { day: WeekDayCard; isToday: boolean; isExpanded: boolean; onToggle: () => void }) {
  const d = new Date(day.date + 'T12:00:00')
  return (
    <View>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
        <BlurView intensity={12} tint="dark" style={[styles.weekCard, isToday && styles.weekCardToday]}>
          <View style={styles.weekCardHeader}>
            <View>
              <Text style={styles.weekCardDay}>{d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
              <Text style={styles.moonNak}>🌙 {day.moonNakshatra}</Text>
            </View>
            <Text style={[styles.weekCardScore, { color: scoreColor(day.score) }]}>{day.score}</Text>
          </View>
          <Text style={[styles.energyLabelSm, { color: scoreColor(day.score), marginTop: 4 }]}>{day.energyLabel}</Text>
          {day.keyTransit ? <Text style={styles.keyTransitSm}>✦ {day.keyTransit}</Text> : null}
          <Text style={styles.expandHint}>{isExpanded ? '▲ tap to collapse' : '▼ tap to expand'}</Text>
        </BlurView>
      </TouchableOpacity>

      {isExpanded && (
        <BlurView intensity={10} tint="dark" style={styles.weekExpandCard}>
          {day.summary ? <Text style={styles.bodyText}>{day.summary}</Text> : null}

          {(day.doList?.length > 0 || day.avoidList?.length > 0) && (
            <View style={[styles.doRow, { marginTop: 12 }]}>
              {day.doList?.length > 0 && (
                <View style={[styles.doCardInline, { flex: 1 }]}>
                  <Text style={[styles.doHeader, { color: '#44FF88' }]}>✓ Do</Text>
                  {day.doList.map((item, i) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
                </View>
              )}
              {day.avoidList?.length > 0 && (
                <View style={[styles.doCardInline, { flex: 1 }]}>
                  <Text style={[styles.doHeader, { color: '#FF4444' }]}>✗ Avoid</Text>
                  {day.avoidList.map((item, i) => <Text key={i} style={styles.doItem}>• {item}</Text>)}
                </View>
              )}
            </View>
          )}

          <View style={styles.horaSimpleRow}>
            <View style={styles.horaSimpleCol}><Text style={styles.horaSimpleLabel}>MORNING</Text><Text style={styles.horaSimpleVal}>{day.horaMorning || '—'}</Text></View>
            <View style={styles.horaSimpleCol}><Text style={styles.horaSimpleLabel}>AFTERNOON</Text><Text style={styles.horaSimpleVal}>{day.horaAfternoon || '—'}</Text></View>
            <View style={styles.horaSimpleCol}><Text style={styles.horaSimpleLabel}>EVENING</Text><Text style={styles.horaSimpleVal}>{day.horaEvening || '—'}</Text></View>
          </View>
        </BlurView>
      )}
    </View>
  )
}

function WeekTab({
  userId, chartData, bottomPad, onAskOracle,
}: { userId: string; chartData: any; bottomPad: number; onAskOracle: (ctx: string) => void }) {
  const { weekForecast, isWeekLoading, loadWeekForecast } = useForecastStore()
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  useEffect(() => { loadWeekForecast(userId, chartData) }, [userId])

  if (isWeekLoading && !weekForecast) return <LoadingState label="Charting your week ahead..." />
  if (!weekForecast?.days?.length) return <ErrorState onRetry={() => loadWeekForecast(userId, chartData)} />

  const today = new Date().toISOString().split('T')[0]
  const { overview, alerts, days } = weekForecast
  const ALERT_ICON: Record<string, string> = { retrograde: '↺', fullmoon: '🌕', newmoon: '🌑', eclipse: '🌒', favorable: '✦' }

  return (
    <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
      {/* Week overview */}
      <BlurView intensity={14} tint="dark" style={styles.card}>
        <SectionHeader title="This Week's Theme" icon="◈" />
        <Text style={styles.bodyText}>{overview.theme}</Text>
        <View style={styles.weekOverviewGrid}>
          <View style={styles.weekOverviewItem}>
            <Text style={styles.weekOverviewLabel}>BEST DAY</Text>
            <Text style={[styles.weekOverviewValue, { color: '#44FF88' }]}>
              {new Date(overview.bestDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.weekOverviewItem}>
            <Text style={styles.weekOverviewLabel}>BE CAREFUL</Text>
            <Text style={[styles.weekOverviewValue, { color: '#FF8C00' }]}>
              {new Date(overview.carefulDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>
        <Text style={styles.dominantInfluence}>Dominant influence: {overview.dominantInfluence}</Text>
      </BlurView>

      {/* Special alerts */}
      {alerts?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {alerts.map((a, i) => (
            <View key={i} style={styles.weekAlertChip}>
              <Text style={styles.weekAlertIcon}>{ALERT_ICON[a.type] ?? '✦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.weekAlertTitle}>{a.title}</Text>
                <Text style={styles.weekAlertImpact} numberOfLines={2}>{a.impact}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 7-day cards */}
      {days.map((day) => (
        <WeekDayCardView
          key={day.date}
          day={day}
          isToday={day.date === today}
          isExpanded={expandedDate === day.date}
          onToggle={() => { Haptics.selectionAsync(); setExpandedDate(expandedDate === day.date ? null : day.date) }}
        />
      ))}

      <OracleButton onPress={() => onAskOracle(buildWeekOracleContext(weekForecast, chartData))} />
    </ScrollView>
  )
}

function buildWeekOracleContext(week: NonNullable<ReturnType<typeof useForecastStore.getState>['weekForecast']>, chartData: any): string {
  const v = chartData?.vedic
  const days = week.days.map(d => `${d.date}: ${d.score}/100, Moon ${d.moonNakshatra}, ${d.keyTransit}`).join(' | ')
  return `This week's theme: ${week.overview.theme} Dominant influence: ${week.overview.dominantInfluence}. Best day: ${week.overview.bestDay}. Careful day: ${week.overview.carefulDay}. Daily breakdown: ${days}. Mahadasha: ${v?.mahadasha}, Antardasha: ${v?.antardasha}.`
}

// ── Month Tab ──────────────────────────────────────────────────────────────────
function MonthDaySheet({ day, onClose, onAskOracle }: { day: ForecastDay | null; onClose: () => void; onAskOracle: (ctx: string) => void }) {
  if (!day) return null
  const d = new Date(day.date + 'T12:00:00')
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose}><View /></TouchableOpacity>
      <View style={styles.sheetWrap}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(13,13,43,0.97)', 'rgba(5,5,15,0.99)']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTime}>{d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, marginBottom: 12 }}>
          <View style={[styles.scoreCircleSm, { borderColor: scoreColor(day.score) }]}>
            <Text style={[styles.scoreNumberSm, { color: scoreColor(day.score) }]}>{day.score}</Text>
          </View>
          <View>
            <Text style={[styles.energyLabelSm, { color: scoreColor(day.score) }]}>{day.energyLabel}</Text>
            <Text style={styles.moonNak}>🌙 {day.moon.rashi} · {day.moon.nakshatra} Pada {day.moon.pada}</Text>
          </View>
        </View>
        {day.keyTransit ? <Text style={styles.bodyText}>✦ {day.keyTransit}</Text> : null}
        <TouchableOpacity
          style={[styles.sheetCloseBtn, { marginTop: 16 }]}
          onPress={() => { onAskOracle(`This date (${day.date}): Score ${day.score}/100, Moon in ${day.moon.rashi} ${day.moon.nakshatra} Pada ${day.moon.pada}. Key transit: ${day.keyTransit}.`); onClose() }}
        >
          <Text style={styles.sheetCloseText}>◈ Ask Oracle About This Day</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sheetCloseBtn, { marginTop: 10, borderColor: 'rgba(255,255,255,0.15)' }]} onPress={onClose}>
          <Text style={[styles.sheetCloseText, { color: 'rgba(255,255,255,0.6)' }]}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

function MonthTab({
  userId, chartData, bottomPad, onAskOracle,
}: { userId: string; chartData: any; bottomPad: number; onAskOracle: (ctx: string) => void }) {
  const { monthForecast, isMonthLoading, loadMonthForecast } = useForecastStore()
  const { reading } = useReadingStore()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  useEffect(() => { loadMonthForecast(userId, chartData, reading) }, [userId])

  if (isMonthLoading && !monthForecast) return <LoadingState label="Mapping your month ahead..." />
  if (!monthForecast) return <ErrorState onRetry={() => loadMonthForecast(userId, chartData, reading)} />

  const today = new Date().toISOString().split('T')[0]
  const firstDay = monthForecast.days[0]
  const firstDayOfWeek = firstDay ? new Date(firstDay.date + 'T12:00:00').getDay() : 0
  const emptyPrefix = Array.from({ length: firstDayOfWeek })
  const selectedDayData = selectedDate ? monthForecast.days.find(d => d.date === selectedDate) ?? null : null
  const EVENT_ICON: Record<string, string> = { eclipse: '🌒', fullmoon: '🌕', newmoon: '🌑', retrograde: '↺', favorable: '✦' }

  return (
    <>
      <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        {/* Monthly overview */}
        <BlurView intensity={14} tint="dark" style={styles.card}>
          <SectionHeader title={monthForecast.monthName} icon="◐" />
          <Text style={styles.bodyText}>{monthForecast.summary}</Text>
          <View style={styles.monthMetaRow}>
            <Text style={styles.monthMetaText}>Best fortnight: <Text style={{ color: Colors.agedGold }}>{monthForecast.bestFortnight}</Text></Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <View style={styles.energyBarTrack}>
              <View style={[styles.energyBarFill, { width: `${monthForecast.energyBar}%`, backgroundColor: scoreColor(monthForecast.energyBar) }]} />
            </View>
            <Text style={styles.monthEnergyLabel}>Overall monthly energy: {monthForecast.energyBar}/100</Text>
          </View>
        </BlurView>

        {/* Calendar grid */}
        <BlurView intensity={12} tint="dark" style={styles.card}>
          <SectionHeader title="Monthly Energy Map" />
          <View style={styles.heatHeader}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <View key={i} style={styles.heatHeaderCell}><Text style={styles.heatHeaderText}>{d}</Text></View>
            ))}
          </View>
          <View style={styles.heatmap}>
            {emptyPrefix.map((_, i) => <View key={`empty-${i}`} style={[styles.heatCell, { backgroundColor: 'transparent' }]} />)}
            {monthForecast.days.map((day, i) => {
              const isToday = day.date === today
              const isFavorable = day.score >= 75
              return (
                <TouchableOpacity key={i} onPress={() => { Haptics.selectionAsync(); setSelectedDate(day.date) }} activeOpacity={0.7}>
                  <View style={[styles.heatCell, { backgroundColor: scoreColor(day.score) + '55' }, isToday && styles.heatCellToday]}>
                    <Text style={[styles.heatDate, isToday && { color: '#fff', fontWeight: 'bold' }]}>
                      {new Date(day.date + 'T12:00:00').getDate()}
                    </Text>
                    {isFavorable && <Text style={styles.heatStar}>★</Text>}
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

        {/* Special events strip */}
        {monthForecast.specialAlerts?.length > 0 && (
          <BlurView intensity={12} tint="dark" style={styles.card}>
            <SectionHeader title="Cosmic Events This Month" icon="⚡" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {monthForecast.specialAlerts.filter(a => a.date).map((alert, i) => (
                <View key={i} style={styles.eventChip}>
                  <Text style={styles.eventChipIcon}>{EVENT_ICON[alert.type] ?? '✦'}</Text>
                  <Text style={styles.eventChipDate}>{new Date(alert.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  <Text style={styles.eventChipTitle} numberOfLines={2}>{alert.title}</Text>
                </View>
              ))}
            </ScrollView>
          </BlurView>
        )}

        {/* Best days for love / money */}
        {(monthForecast.bestDaysLove?.length > 0 || monthForecast.bestDaysMoney?.length > 0) && (
          <BlurView intensity={12} tint="dark" style={styles.card}>
            <SectionHeader title="Best Days This Month" icon="✦" />
            {monthForecast.bestDaysLove?.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={styles.bestDaysLabel}>💗 FOR LOVE</Text>
                {monthForecast.bestDaysLove.map((b, i) => (
                  <View key={i} style={styles.bestDayRow}>
                    <Text style={styles.bestDayDate}>{new Date(b.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    <Text style={styles.bestDayReason}>{b.reason}</Text>
                  </View>
                ))}
              </View>
            )}
            {monthForecast.bestDaysMoney?.length > 0 && (
              <View>
                <Text style={styles.bestDaysLabel}>💰 FOR MONEY & WORK</Text>
                {monthForecast.bestDaysMoney.map((b, i) => (
                  <View key={i} style={styles.bestDayRow}>
                    <Text style={styles.bestDayDate}>{new Date(b.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                    <Text style={styles.bestDayReason}>{b.reason}</Text>
                  </View>
                ))}
              </View>
            )}
          </BlurView>
        )}

        <OracleButton onPress={() => onAskOracle(buildMonthOracleContext(monthForecast, chartData))} />
      </ScrollView>

      <MonthDaySheet day={selectedDayData} onClose={() => setSelectedDate(null)} onAskOracle={onAskOracle} />
    </>
  )
}

function buildMonthOracleContext(month: NonNullable<ReturnType<typeof useForecastStore.getState>['monthForecast']>, chartData: any): string {
  const v = chartData?.vedic
  return `${month.monthName}: ${month.summary} Best fortnight: ${month.bestFortnight}. Overall energy: ${month.energyBar}/100. Mahadasha: ${v?.mahadasha}, Antardasha: ${v?.antardasha}.`
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
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<Tab>('today')
  const fadeAnim = useRef(new Animated.Value(1)).current
  const { chartData } = useReadingStore()
  const { session } = useAuthStore()
  const { selectedLanguage } = useSettingsStore()
  const userId = session?.user?.id ?? '00000000-0000-4000-8000-000000000001'

  const [oracleVisible, setOracleVisible] = useState(false)
  const [oracleContext, setOracleContext] = useState('')

  const bottomPad = insets.bottom + TAB_BAR_CONTENT_HEIGHT + 24

  const switchTab = (tab: Tab) => {
    Haptics.selectionAsync()
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setActiveTab(tab)
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    })
  }

  const handleAskOracle = (ctx: string) => {
    setOracleContext(ctx)
    setOracleVisible(true)
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const periodLabelMap: Record<Tab, string> = {
    today: 'Today',
    week: 'This Week',
    month: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }

  return (
    <View style={styles.root}>
      <Video
        source={Videos.forecastBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping shouldPlay isMuted
        onError={() => {}}
      />
      <LinearGradient colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.9)']} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <BlurView intensity={18} tint="dark" style={styles.header}>
          <Text style={styles.headerTitle}>Cosmic Forecast</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </BlurView>

        {/* Tabs — Today · Week · Month only */}
        <View style={styles.tabs}>
          {(['today', 'week', 'month'] as Tab[]).map(tab => (
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
              {activeTab === 'today' && <TodayTab userId={userId} chartData={chartData} bottomPad={bottomPad} onAskOracle={handleAskOracle} />}
              {activeTab === 'week' && <WeekTab userId={userId} chartData={chartData} bottomPad={bottomPad} onAskOracle={handleAskOracle} />}
              {activeTab === 'month' && <MonthTab userId={userId} chartData={chartData} bottomPad={bottomPad} onAskOracle={handleAskOracle} />}
            </>
          )}
        </Animated.View>
      </SafeAreaView>

      {/* Forecast Oracle popup — structurally distinct from the chart popup */}
      <ForecastOracleModal
        visible={oracleVisible}
        onClose={() => setOracleVisible(false)}
        period={activeTab}
        periodLabel={periodLabelMap[activeTab]}
        contextData={oracleContext}
        language={selectedLanguage ?? undefined}
      />
    </View>
  )
}

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
    flex: 1, paddingVertical: 10, borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', overflow: 'hidden',
  },
  tabPillActive: { borderColor: Colors.agedGold, shadowColor: Colors.agedGold, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  tabText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  tabTextActive: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.agedGold },
  tabContent: { paddingHorizontal: 16, paddingTop: 4 },

  // Section header
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  sectionHeaderBar: { width: 3, height: 16, borderRadius: 1.5, backgroundColor: Colors.agedGold },
  sectionHeaderText: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.agedGold, letterSpacing: 0.3 },

  // Ask Oracle button
  oracleBtn: { marginTop: 8, marginBottom: 8, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  oracleBtnInner: { paddingVertical: 15, alignItems: 'center' },
  oracleBtnText: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.agedGold },

  // Hero
  heroCard: {
    borderRadius: 24, padding: 26, marginBottom: 14, alignItems: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)',
  },
  heroCircleWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroCircleRing: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 3 },
  heroCircleRingInner: { width: 118, height: 118, borderRadius: 59, top: 7, left: 7 },
  heroCircleCenter: { alignItems: 'center' },
  heroScoreNum: { fontFamily: Fonts.accent, fontSize: 38 },
  heroScoreOutOf: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  heroEnergyLabel: { fontFamily: Fonts.heading, fontSize: 16, marginBottom: 6 },
  heroDate: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginBottom: 12 },
  heroSummary: { fontFamily: Fonts.mystical, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  // Alerts
  alertCardAmber: {
    flexDirection: 'row', gap: 12, borderRadius: 18, padding: 16, marginBottom: 14,
    backgroundColor: 'rgba(255,140,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,140,0,0.3)',
  },
  alertCardGreen: {
    flexDirection: 'row', gap: 12, borderRadius: 18, padding: 16, marginBottom: 14,
    backgroundColor: 'rgba(68,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(68,255,136,0.3)',
  },
  alertCardIcon: { fontSize: 20, color: Colors.agedGold },
  alertCardTitle: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.textPrimary, marginBottom: 4 },
  alertCardBody: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  // Cards
  card: {
    borderRadius: 18, padding: 20, marginBottom: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.12)',
  },
  bodyText: { fontFamily: Fonts.mystical, fontSize: 15, color: Colors.textSecondary, lineHeight: 24 },
  moonNak: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 3 },

  // Moon
  moonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  moonSignText: { fontFamily: Fonts.heading, fontSize: 15, color: Colors.textPrimary },
  moonDivider: { color: Colors.textMuted },
  moonPhaseName: { fontFamily: Fonts.body, fontSize: 12, color: Colors.agedGold, marginBottom: 10 },

  // Dasha pill
  dashaPillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  dashaPill: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  dashaPillText: { fontFamily: Fonts.heading, fontSize: 13, color: '#fff' },
  dashaEndDate: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },

  // Do/Avoid
  doRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  doCard: { borderRadius: 18, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.12)' },
  doCardInline: { borderRadius: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
  doHeader: { fontFamily: Fonts.heading, fontSize: 11, marginBottom: 10 },
  doItem: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginBottom: 6, lineHeight: 20 },

  // Key transit
  keyTransitTitle: { fontFamily: Fonts.heading, fontSize: 14, color: Colors.textPrimary },

  // Hora timeline
  horaCell: {
    width: 56, height: 78, borderRadius: 14, marginRight: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  horaCellNow: { borderWidth: 2 },
  horaGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: Colors.agedGold },
  horaHourLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  horaDot: { width: 8, height: 8, borderRadius: 4 },
  horaRulerLabel: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textSecondary },

  // Week
  weekOverviewGrid: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 8 },
  weekOverviewItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10 },
  weekOverviewLabel: { fontFamily: Fonts.accent, fontSize: 9, color: Colors.textMuted, letterSpacing: 1, marginBottom: 4 },
  weekOverviewValue: { fontFamily: Fonts.heading, fontSize: 12 },
  dominantInfluence: { fontFamily: Fonts.body, fontSize: 12, color: Colors.agedGold, marginTop: 4 },

  weekAlertChip: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', width: 220, marginRight: 10,
    borderRadius: 14, padding: 12, backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.25)',
  },
  weekAlertIcon: { fontSize: 16, color: Colors.agedGold },
  weekAlertTitle: { fontFamily: Fonts.heading, fontSize: 11, color: Colors.textPrimary, marginBottom: 3 },
  weekAlertImpact: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, lineHeight: 15 },

  weekCard: {
    borderRadius: 18, padding: 16, marginBottom: 4,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.1)',
  },
  weekCardToday: { borderColor: Colors.agedGold, borderWidth: 1.5 },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weekCardDay: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.textPrimary },
  weekCardScore: { fontFamily: Fonts.heading, fontSize: 16 },
  keyTransitSm: { fontFamily: Fonts.body, fontSize: 12, color: Colors.agedGold, marginTop: 8 },
  expandHint: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 8, textAlign: 'right' },
  weekExpandCard: {
    borderRadius: 18, padding: 16, marginTop: -6, marginBottom: 12, paddingTop: 18,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(201,168,76,0.08)',
  },
  horaSimpleRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  horaSimpleCol: { flex: 1, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 8, alignItems: 'center' },
  horaSimpleLabel: { fontFamily: Fonts.accent, fontSize: 8, color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  horaSimpleVal: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },

  // Month heatmap
  monthMetaRow: { marginTop: 10 },
  monthMetaText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary },
  energyBarTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  energyBarFill: { height: 8, borderRadius: 4 },
  monthEnergyLabel: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 6 },
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
  heatStar: { position: 'absolute', top: 1, right: 2, fontSize: 7, color: '#FFD700' },
  heatLegend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },

  eventChip: { width: 130, marginRight: 10, borderRadius: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  eventChipIcon: { fontSize: 16, marginBottom: 6 },
  eventChipDate: { fontFamily: Fonts.heading, fontSize: 11, color: Colors.agedGold, marginBottom: 4 },
  eventChipTitle: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textSecondary, lineHeight: 15 },

  bestDaysLabel: { fontFamily: Fonts.accent, fontSize: 10, color: Colors.agedGold, letterSpacing: 1, marginBottom: 10 },
  bestDayRow: { flexDirection: 'row', gap: 12, marginBottom: 8, alignItems: 'flex-start' },
  bestDayDate: { fontFamily: Fonts.heading, fontSize: 12, color: Colors.textPrimary, width: 56 },
  bestDayReason: { flex: 1, fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },

  scoreCircleSm: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreNumberSm: { fontFamily: Fonts.heading, fontSize: 16 },
  energyLabelSm: { fontFamily: Fonts.heading, fontSize: 11 },

  // Bottom sheets (Hora detail + Month day detail)
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden',
    padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', borderBottomWidth: 0,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 16 },
  sheetTime: { fontFamily: Fonts.heading, fontSize: 17, color: Colors.agedGold, textAlign: 'center', marginBottom: 10 },
  sheetRulerPill: { alignSelf: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16 },
  sheetRulerText: { fontFamily: Fonts.body, fontSize: 13 },
  sheetGoodForLabel: { fontFamily: Fonts.accent, fontSize: 9, color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8, textAlign: 'center' },
  sheetGoodForText: { fontFamily: Fonts.mystical, fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  sheetCloseBtn: { marginTop: 20, borderWidth: 1, borderColor: Colors.agedGold, borderRadius: 18, paddingVertical: 12, alignItems: 'center' },
  sheetCloseText: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.agedGold },

  // States
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingLabel: { fontFamily: Fonts.mystical, fontSize: 16, color: Colors.textMuted, marginTop: 16, textAlign: 'center' },
  errorSymbol: { fontSize: 40, color: Colors.agedGold, marginBottom: 16 },
  errorText: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textMuted, marginBottom: 20 },
  retryBtn: { borderWidth: 1, borderColor: Colors.agedGold, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { fontFamily: Fonts.heading, fontSize: 13, color: Colors.agedGold },
})
