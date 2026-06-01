import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useReadingStore } from '../../store/readingStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Videos } from '../../constants/videos'
import { Fonts } from '../../constants/fonts'
import { SouthIndianKundli } from '../../components/charts/SouthIndianKundli'
import { NakshatraWheel } from '../../components/charts/NakshatraWheel'
import { GrahaStrength } from '../../components/charts/GrahaStrength'
import { DashaTimeline } from '../../components/charts/DashaTimeline'
import { GocharChart } from '../../components/charts/GocharChart'
import { ChartOracleModal } from '../../components/charts/shared/ChartOracleModal'

const { width } = Dimensions.get('window')

const TABS = [
  { id: 'kundali',   label: 'Kundali',    sub: 'Birth Chart' },
  { id: 'nakshatra', label: 'Nakshatras', sub: 'Moon Star' },
  { id: 'grahas',    label: 'Grahas',     sub: 'Planets' },
  { id: 'dashas',    label: 'Dashas',     sub: 'Life Periods' },
  { id: 'gochar',    label: 'Gochar',     sub: 'Transits Today' },
]

export function ChartsScreen() {
  const { chartData, isLoading, isGenerating } = useReadingStore()
  const { selectedLanguage } = useSettingsStore()
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState(0)
  const slideAnim = useRef(new Animated.Value(0)).current

  // ── Gochar Oracle Modal state ─────────────────────────────────────────────
  const [oracleVisible, setOracleVisible] = useState(false)
  const [oraclePayload, setOraclePayload] = useState<{
    title: string
    subtitle: string
    symbol: string
    symbolColor: string
    contextData: string
    accentColor: string
  } | null>(null)

  // Nakshatra segment tap → oracle modal
  function handleNakshatraOracle(nak: { name: string; lord: string; color: string; type: string }) {
    setOraclePayload({
      title: nak.name,
      subtitle: `Nakshatra · ${nak.type}`,
      symbol: '☽',
      symbolColor: nak.color,
      accentColor: nak.color,
      contextData: [
        `Nakshatra: ${nak.name}`,
        `Lord: ${nak.lord}`,
        `Nature: ${nak.type}`,
        chartData?.vedic?.nakshatra === nak.name ? 'This is your birth nakshatra' : '',
      ].filter(Boolean).join(' — '),
    })
    setOracleVisible(true)
  }

  // Graha pillar tap → oracle modal
  const GRAHA_SYMBOL: Record<string, string> = {
    Surya: '☀', Chandra: '☽', Mangal: '♂', Budh: '☿',
    Guru: '♃', Shukra: '♀', Shani: '♄', Rahu: '☊', Ketu: '☋',
  }
  const GRAHA_COLOR: Record<string, string> = {
    Surya: '#FF9500', Chandra: '#C0C8FF', Mangal: '#FF3B3B', Budh: '#00C060',
    Guru: '#FFD700', Shukra: '#FF80AA', Shani: '#8BA0C0', Rahu: '#9090BB', Ketu: '#B87840',
  }
  function handleGrahaOracle(ctx: Record<string, any>) {
    setOraclePayload({
      title: ctx.planet ?? 'Graha',
      subtitle: `${ctx.rashi ?? ''} · House ${ctx.house ?? ''}`,
      symbol: GRAHA_SYMBOL[ctx.planet] ?? '◉',
      symbolColor: GRAHA_COLOR[ctx.planet] ?? '#C9A84C',
      accentColor: GRAHA_COLOR[ctx.planet] ?? '#C9A84C',
      contextData: [
        `Planet: ${ctx.planet}`,
        `Rashi: ${ctx.rashi}`,
        `House: ${ctx.house}`,
        `Nakshatra: ${ctx.nakshatra}`,
        `Strength: ${ctx.strength}/100`,
        `Status: ${ctx.status}`,
        `Retrograde: ${ctx.isRetrograde}`,
        `Lagna: ${ctx.lagna}`,
      ].filter(Boolean).join(' — '),
    })
    setOracleVisible(true)
  }

  // Receives the raw context object from GocharChart and converts it into
  // the flat strings that ChartOracleModal expects.
  function handleOpenOracleModal(ctx: Record<string, any>) {
    let title = 'Gochar Insight'
    let subtitle = 'Transit Reading'
    let symbol = '◉'
    let symbolColor = '#2FBEBE'
    let contextData = ''

    if (ctx.title) {
      // Cell tap: { title, rashi, natalPlanets, transitingPlanetsNow, transitType, effects, currentMahadasha }
      title = ctx.title
      subtitle = ctx.rashi ? `${ctx.rashi} — Transit Analysis` : 'Transit Analysis'
      contextData = [
        ctx.title,
        ctx.rashi               ? `Rashi: ${ctx.rashi}` : '',
        ctx.natalPlanets        ? `Natal planets: ${ctx.natalPlanets}` : '',
        ctx.transitingPlanetsNow ? `Transiting now: ${ctx.transitingPlanetsNow}` : '',
        ctx.transitType         ? `Transit type: ${ctx.transitType}` : '',
        ctx.effects             ? ctx.effects : '',
        ctx.currentMahadasha    ? `Current Mahadasha: ${ctx.currentMahadasha}` : '',
      ].filter(Boolean).join(' — ')
    } else if (ctx.context === 'Condition Insight') {
      // Severity tile tap: { context, description }
      title = 'Transit Condition'
      subtitle = 'Gochar Effect'
      symbol = '⚡'
      symbolColor = '#C9A84C'
      contextData = ctx.description ?? 'Transit condition insight'
    } else {
      // Fallback: stringify whatever was passed
      contextData = Object.entries(ctx)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' — ')
    }

    setOraclePayload({ title, subtitle, symbol, symbolColor, accentColor: symbolColor === '#C9A84C' ? '#C9A84C' : '#2FBEBE', contextData })
    setOracleVisible(true)
  }

  function switchTab(idx: number) {
    if (idx === activeTab) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const direction = idx > activeTab ? -1 : 1
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: direction * 30, duration: 100, useNativeDriver: true }),
    ]).start(() => {
      setActiveTab(idx)
      slideAnim.setValue(-direction * 30)
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start()
    })
  }

  const notReady = isLoading || isGenerating || !chartData

  return (
    <View style={styles.root}>
      <Video
        source={Videos.chartsBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping shouldPlay isMuted
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.75)', 'rgba(5,5,15,0.92)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.pageTitle}>Vedic Charts</Text>
        <Text style={styles.pageSub}>Jyotish — Science of Light</Text>
      </View>

      {/* Tab bar — scrollable to fit 5 tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
        style={styles.tabBarScroll}
      >
        {TABS.map((tab, i) => {
          const isActive = i === activeTab
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => switchTab(i)}
              activeOpacity={0.75}
            >
              {isActive && (
                <LinearGradient
                  colors={['rgba(201,168,76,0.15)', 'transparent']}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              <Text style={styles.tabSub}>{tab.sub}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Chart content */}
      {notReady ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingSymbol}>☽</Text>
          <Text style={styles.loadingText}>
            {isLoading || isGenerating
              ? 'Calculating your Vedic chart...'
              : 'Complete your birth details to see charts.'}
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          style={[styles.chartScroll, { transform: [{ translateX: slideAnim }] }]}
          contentContainerStyle={[styles.chartContent, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Tab 0: Kundali ── */}
          {activeTab === 0 && (
            <View>
              <SectionHeader
                title="South Indian Kundali"
                desc={`Lagna in ${chartData.vedic.lagna}  ·  Drag the chart to tilt in 3D`}
              />
              <SouthIndianKundli chart={chartData.vedic} />
              {chartData.vedic.yogas.length > 0 && (
                <View style={styles.yogaSection}>
                  <Text style={styles.yogaTitle}>Detected Yogas</Text>
                  {chartData.vedic.yogas.map((yoga, i) => (
                    <View key={i} style={styles.yogaRow}>
                      <View style={styles.yogaDot} />
                      <Text style={styles.yogaText}>{yoga}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Tab 1: Nakshatras ── */}
          {activeTab === 1 && (
            <View>
              <SectionHeader
                title="Nakshatra Chakra"
                desc="27 lunar mansions · Your Moon nakshatra highlighted"
              />
              <NakshatraWheel chart={chartData.vedic} onOpenOracle={handleNakshatraOracle} />
              <View style={styles.nakDetailCard}>
                <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Text style={styles.nakDetailTitle}>{chartData.vedic.nakshatra} Nakshatra</Text>
                <Text style={styles.nakDetailSub}>
                  Lord: {chartData.vedic.nakshatraLord}  ·  Pada {chartData.vedic.nakshatraPada}  ·  Moon in {chartData.vedic.moonRashi}
                </Text>
              </View>
            </View>
          )}

          {/* ── Tab 2: Grahas ── */}
          {activeTab === 2 && (
            <View>
              <SectionHeader
                title="Graha Shakti"
                desc="Planetary strength based on dignity and house position"
              />
              <GrahaStrength chart={chartData.vedic} onOpenOracle={handleGrahaOracle} />
            </View>
          )}

          {/* ── Tab 3: Dashas ── */}
          {activeTab === 3 && (
            <View>
              <SectionHeader
                title="Vimshottari Dasha"
                desc={`Current: ${chartData.vedic.mahadasha} (${chartData.vedic.mahadashaPeriod})`}
              />
              <DashaTimeline
                chart={chartData.vedic}
                pastDashaHistory={chartData.currentTiming?.pastDashaHistory}
                birthYear={
                  chartData.birthProfile.birth_date
                    ? new Date(chartData.birthProfile.birth_date).getFullYear()
                    : undefined
                }
                onOpenOracleModal={handleOpenOracleModal}
              />
              {/* Antardasha info */}
              {chartData.currentTiming?.currentAntardasha && (
                <View style={styles.antarCard}>
                  <Text style={styles.antarLabel}>Current Sub-Period (Antardasha)</Text>
                  <Text style={styles.antarLord}>
                    {chartData.currentTiming.currentAntardasha.lord} Antardasha
                  </Text>
                  <Text style={styles.antarPeriod}>
                    {chartData.currentTiming.currentAntardasha.startDate}  –  {chartData.currentTiming.currentAntardasha.endDate}
                  </Text>
                  <Text style={styles.antarRelation}>
                    Relationship to Mahadasha lord:
                    {' '}<Text style={{
                      color: chartData.currentTiming.currentAntardasha.lordsRelationship === 'friend'
                        ? '#44FF88'
                        : chartData.currentTiming.currentAntardasha.lordsRelationship === 'enemy'
                        ? '#FF4444'
                        : '#C9A84C',
                    }}>
                      {chartData.currentTiming.currentAntardasha.lordsRelationship}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Tab 4: Gochar ── */}
          {activeTab === 4 && chartData.currentTiming && (
            <View>
              <SectionHeader
                title="Gochar — Current Transits"
                desc={`Today's planetary positions relative to your natal chart · ${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              />
              <GocharChart
                natalChart={chartData.vedic}
                gocharData={chartData.currentTiming.gochar}
                onOpenOracleModal={handleOpenOracleModal}
              />
            </View>
          )}
        </Animated.ScrollView>
      )}
      {/* Gochar Oracle Modal — renders on top of everything */}
      {oraclePayload && (
        <ChartOracleModal
          visible={oracleVisible}
          onClose={() => setOracleVisible(false)}
          title={oraclePayload.title}
          subtitle={oraclePayload.subtitle}
          symbol={oraclePayload.symbol}
          symbolColor={oraclePayload.symbolColor}
          contextData={oraclePayload.contextData}
          language={selectedLanguage}
          accentColor={oraclePayload.accentColor}
        />
      )}
    </View>
  )
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.title}>{title}</Text>
      <Text style={sh.desc}>{desc}</Text>
      <View style={sh.line} />
    </View>
  )
}

const sh = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 },
  title: { fontFamily: Fonts.heading, fontSize: 18, color: '#C9A84C', marginBottom: 4 },
  desc: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 20 },
  line: { height: 1, backgroundColor: 'rgba(201,168,76,0.12)', marginTop: 12 },
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  header: { paddingHorizontal: 20, paddingBottom: 12, alignItems: 'center' },
  pageTitle: { fontFamily: Fonts.heading, fontSize: 20, color: '#C9A84C', letterSpacing: 2 },
  pageSub: { fontFamily: Fonts.mystical, fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4, letterSpacing: 1 },

  tabBarScroll: { maxHeight: 62, marginHorizontal: 16, marginBottom: 8 },
  tabBar: {
    backgroundColor: 'rgba(13,13,43,0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    minWidth: 68,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#C9A84C' },
  tabLabel: {
    fontFamily: Fonts.accentBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
  },
  tabLabelActive: { color: '#C9A84C' },
  tabSub: { fontFamily: Fonts.body, fontSize: 8, color: 'rgba(255,255,255,0.2)', marginTop: 2 },

  chartScroll: { flex: 1 },
  chartContent: { paddingTop: 8 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingSymbol: { fontSize: 40, color: '#C9A84C', marginBottom: 20, opacity: 0.5 },
  loadingText: { fontFamily: Fonts.mystical, fontSize: 15, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 24 },

  yogaSection: { marginHorizontal: 16, marginTop: 20 },
  yogaTitle: { fontFamily: Fonts.accent, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  yogaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  yogaDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#C9A84C', marginTop: 7 },
  yogaText: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.6)', flex: 1, lineHeight: 22 },

  nakDetailCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)', overflow: 'hidden', padding: 18, alignItems: 'center',
  },
  nakDetailTitle: { fontFamily: Fonts.heading, fontSize: 18, color: '#C9A84C', marginBottom: 8 },
  nakDetailSub: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22 },

  antarCard: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)', padding: 18,
    backgroundColor: 'rgba(13,13,43,0.8)',
  },
  antarLabel: { fontFamily: Fonts.accent, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  antarLord: { fontFamily: Fonts.heading, fontSize: 16, color: '#C9A84C', marginBottom: 4 },
  antarPeriod: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  antarRelation: { fontFamily: Fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
})
