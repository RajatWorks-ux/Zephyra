import React, { useEffect, useRef, useMemo } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, ScrollView, 
  TouchableOpacity, Animated as RNAnimated, Easing 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Fonts } from '../../constants/fonts';
import type { VedicChart, GocharData } from '../../types';
import { KundliGrid } from './KundliGrid';
import type { GridCellData, GridPlanet } from './KundliGrid';

const { width } = Dimensions.get('window');
const CHART_SIZE = Math.min(width - 32, 364);

// ─── Constants & Dictionaries ────────────────────────────────────────────────
const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 
  'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const RASHI_SHORT = [
  'Mes', 'Vri', 'Mit', 'Kar', 'Sin', 'Kan', 
  'Tul', 'Vsc', 'Dha', 'Mak', 'Kum', 'Mee',
];

const GRAHA_INFO: Record<string, { abbr: string; color: string; glyph: string }> = {
  Surya:   { abbr: 'Su', color: '#FF9500', glyph: '☉' },
  Chandra: { abbr: 'Mo', color: '#C0C8FF', glyph: '☽' },
  Mangal:  { abbr: 'Ma', color: '#FF3B3B', glyph: '♂' },
  Budh:    { abbr: 'Me', color: '#00C060', glyph: '☿' },
  Guru:    { abbr: 'Ju', color: '#FFD700', glyph: '♃' },
  Shukra:  { abbr: 'Ve', color: '#FF80AA', glyph: '♀' },
  Shani:   { abbr: 'Sa', color: '#8BA0C0', glyph: '♄' },
  Rahu:    { abbr: 'Ra', color: '#9090BB', glyph: '☊' },
  Ketu:    { abbr: 'Ke', color: '#B87840', glyph: '☋' },
};

const TODAY_STR = new Date().toLocaleDateString('en-US', {
  day: 'numeric', month: 'short', year: 'numeric',
});

// ─── Helper Functions ─────────────────────────────────────────────────────────
function getConditionTone(text: string): string {
  const t = text.toLowerCase();
  if (t.match(/trine|sextile|exalted|benefic|auspicious|harmony|positive|gain/)) return '#44FF88';
  if (t.match(/opposition|square|debilitated|malefic|affliction|challenging|negative|clash/)) return '#FF4444';
  return '#C9A84C';
}

function extractConditionPlanetGlyph(text: string): string {
  for (const [name, info] of Object.entries(GRAHA_INFO)) {
    if (text.toLowerCase().includes(name.toLowerCase())) return info.glyph;
  }
  return '✧';
}

// ─── Single Cell Component ────────────────────────────────────────────────────
function GridCell({ cell, size, onPress }: { cell: GridCellData, size: number, onPress?: (cell: GridCellData) => void }) {
  const pressAnim = useRef(new RNAnimated.Value(1)).current;
  const pulseAnim = useRef(new RNAnimated.Value(0)).current;

  const hasNatal = cell.natalPlanets.length > 0;
  const hasTransit = cell.transitPlanets.length > 0;
  const isActiveZone = hasNatal && hasTransit;

  useEffect(() => {
    if (isActiveZone) {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          RNAnimated.timing(pulseAnim, { toValue: 0, duration: 1250, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])
      ).start();
    }
  }, [isActiveZone]);

  const baseBorderColor = cell.isLagna ? 'rgba(201,168,76,0.9)' : isActiveZone ? 'rgba(47,190,190,0.5)' : 'rgba(255,255,255,0.08)';
  
  const bgPulse = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(47,190,190,0.08)', 'rgba(47,190,190,0.18)']
  });

  function handlePressIn() {
    RNAnimated.spring(pressAnim, { toValue: 0.93, useNativeDriver: true, speed: 30 }).start();
  }
  function handlePressOut() {
    RNAnimated.spring(pressAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  }

  return (
    <RNAnimated.View style={{ transform: [{ scale: pressAnim }] }}>
      <TouchableOpacity
        onPress={() => {
          if (!onPress) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress(cell);
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={[gc.cell, { width: size, height: size, borderColor: baseBorderColor }]}
      >
        {/* Background Layers */}
        <LinearGradient 
          colors={cell.isLagna ? ['rgba(60,40,10,0.95)', 'rgba(20,10,5,0.98)'] : ['rgba(13,13,43,0.95)', 'rgba(5,5,20,0.98)']} 
          style={StyleSheet.absoluteFillObject} 
        />
        {isActiveZone && (
          <RNAnimated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: bgPulse }]} />
        )}
        
        {isActiveZone && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </Svg>
          </View>
        )}

        {/* Global House & Rashi Headers */}
        <Text style={[gc.houseNum, { color: cell.isLagna ? '#C9A84C' : 'rgba(255,255,255,0.25)' }]}>
          {cell.houseNum}
        </Text>
        <Text style={gc.rashiName}>{RASHI_SHORT[cell.rashiIdx]}</Text>

        {/* Natal Quadrant (Top Left) */}
        {hasNatal && (
          <View style={gc.quadrantNatal}>
            {cell.natalPlanets.map((p, i) => (
              <View key={`n-${i}`} style={gc.planetPill}>
                <Text style={[gc.glyphNatal, p.isExalted && gc.planetExalted, p.isDebilitated && gc.planetDebilitated]}>{p.glyph}</Text>
                <Text style={gc.abbrNatal}>{p.abbr}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Transit Quadrant (Bottom Right) */}
        {hasTransit && (
          <View style={gc.quadrantTransit}>
             {cell.transitPlanets.map((p, i) => (
              <View key={`t-${i}`} style={gc.planetPill}>
                <Text style={gc.glyphTransit}>{p.glyph}</Text>
                <Text style={gc.abbrTransit}>{p.abbr}</Text>
              </View>
            ))}
          </View>
        )}

        {cell.isLagna && <View style={gc.lagnaBar} />}
      </TouchableOpacity>
    </RNAnimated.View>
  );
}

// ─── Center "Today Badge" ─────────────────────────────────────────────────────
function CenterTodayBadge({ size }: { size: number }) {
  const pulseAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.centerGochar, { width: size, height: size / 2 }]}>
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={['rgba(47,190,190,0.15)', 'rgba(5,5,20,0.8)']} style={StyleSheet.absoluteFillObject} />
      <RNAnimated.Text style={[styles.centerSymbol, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }]}>
        ◈
      </RNAnimated.Text>
      <Text style={styles.centerLabel}>GOCHAR</Text>
      <Text style={styles.centerDate}>{TODAY_STR}</Text>
    </View>
  );
}

// ─── Main GocharChart Component ───────────────────────────────────────────────
interface GocharChartProps {
  natalChart: VedicChart;
  gocharData: GocharData;
  onOpenOracleModal: (context: any) => void;
}

export function GocharChart({ natalChart, gocharData, onOpenOracleModal }: GocharChartProps) {
  const outerRotation = useRef(new RNAnimated.Value(0)).current;
  const innerRotation = useRef(new RNAnimated.Value(0)).current;
  
  const lagnaRashiIdx = RASHI_NAMES.indexOf(natalChart.lagna);

  useEffect(() => {
    RNAnimated.loop(RNAnimated.timing(outerRotation, { toValue: 1, duration: 12000, easing: Easing.linear, useNativeDriver: true })).start();
    RNAnimated.loop(RNAnimated.timing(innerRotation, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  const cells: GridCellData[] = useMemo(() => Array.from({ length: 12 }, (_, rashiIdx) => {
    const houseNum = ((rashiIdx - lagnaRashiIdx + 12) % 12) + 1;
    const isLagna = rashiIdx === lagnaRashiIdx;

    const natalPlanets: GridPlanet[] = natalChart.grahas
      .filter(g => RASHI_NAMES.indexOf(g.rashi) === rashiIdx)
      .map(g => ({
        name: g.name,
        abbr: GRAHA_INFO[g.name]?.abbr ?? g.name.substring(0, 2),
        color: GRAHA_INFO[g.name]?.color ?? '#C9A84C',
        glyph: GRAHA_INFO[g.name]?.glyph ?? '✧',
        isRetrograde: g.isRetrograde,
        isExalted: g.isExalted,
        isDebilitated: g.isDebilitated,
        isTransit: false,
      }));

    const transitPlanets: GridPlanet[] = gocharData.transitingPlanets
      .filter(g => RASHI_NAMES.indexOf(g.rashi) === rashiIdx)
      .map(g => ({
        name: g.name,
        abbr: GRAHA_INFO[g.name]?.abbr ?? g.name.substring(0, 2),
        color: '#2FBEBE',
        glyph: GRAHA_INFO[g.name]?.glyph ?? '✧',
        isTransit: true,
      }));

    return {
      rashiIdx,
      rashiName: RASHI_NAMES[rashiIdx],
      houseNum,
      isLagna,
      isKendra: [1, 4, 7, 10].includes(houseNum),
      isTrikona: [1, 5, 9].includes(houseNum),
      planets: [...natalPlanets, ...transitPlanets],
      natalPlanets,
      transitPlanets,
    };
  }), [natalChart, gocharData, lagnaRashiIdx]);

  const handleCellPress = (cell: GridCellData) => {
    const nList = cell.natalPlanets.length ? cell.natalPlanets.map(p => p.name).join(', ') : 'None';
    const tList = cell.transitPlanets.length ? cell.transitPlanets.map(p => p.name).join(', ') : 'None';
    
    onOpenOracleModal({
      title: `House ${cell.houseNum} Transits`,
      rashi: cell.rashiName,
      natalPlanets: nList,
      transitingPlanetsNow: tList,
      transitType: cell.natalPlanets.length && cell.transitPlanets.length ? 'Conjunction / Activation' : 'Movement',
      effects: `Focus on House ${cell.houseNum} matters`,
      currentMahadasha: natalChart.mahadasha.replace(' Mahadasha', '')
    });
  };

  const outerInterpolate = outerRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const innerInterpolate = innerRotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View style={styles.wrapper}>
      
      {/* Legend Redesign */}
      <BlurView intensity={20} tint="dark" style={styles.legendPill}>
        <View style={styles.legendSide}>
          <Text style={[styles.legendDotTxt, { color: '#C9A84C' }]}>◉</Text>
          <View>
            <Text style={styles.legendTitle}>Natal</Text>
            <Text style={styles.legendSub}>your birth sky</Text>
          </View>
        </View>
        <View style={styles.legendDivider} />
        <View style={styles.legendSide}>
          <Text style={[styles.legendDotTxt, { color: '#2FBEBE' }]}>◉</Text>
          <View>
            <Text style={styles.legendTitleGochar}>Gochar</Text>
            <Text style={styles.legendSub}>today's sky</Text>
          </View>
        </View>
      </BlurView>

      {/* Grid with Animated Orbital Rings */}
      <View style={styles.gridWrap}>
        
        {/* Orbital SVG Rings Layer */}
        <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', zIndex: -1 }]} pointerEvents="none">
          <RNAnimated.View style={{ position: 'absolute', transform: [{ rotate: outerInterpolate }] }}>
            <Svg width={CHART_SIZE + 60} height={CHART_SIZE + 60} viewBox={`0 0 ${CHART_SIZE + 60} ${CHART_SIZE + 60}`}>
              <Circle cx={(CHART_SIZE + 60)/2} cy={(CHART_SIZE + 60)/2} r={CHART_SIZE/2 + 18} stroke="rgba(47,190,190,0.25)" strokeWidth="1.5" strokeDasharray="4 8" fill="none" />
            </Svg>
          </RNAnimated.View>
          <RNAnimated.View style={{ position: 'absolute', transform: [{ rotate: innerInterpolate }] }}>
            <Svg width={CHART_SIZE + 60} height={CHART_SIZE + 60} viewBox={`0 0 ${CHART_SIZE + 60} ${CHART_SIZE + 60}`}>
              <Circle cx={(CHART_SIZE + 60)/2} cy={(CHART_SIZE + 60)/2} r={CHART_SIZE/2 + 8} stroke="rgba(123,47,190,0.3)" strokeWidth="1" strokeDasharray="2 6" fill="none" />
            </Svg>
          </RNAnimated.View>
        </View>

        <KundliGrid
          cells={cells}
          chartSize={CHART_SIZE}
          centerContent={<CenterTodayBadge size={CHART_SIZE / 4} />}
          onCellPress={handleCellPress}
          renderCell={(cell, size, onPress) => (
            <GridCell cell={cell} size={size} onPress={onPress} />
          )}
        />
      </View>

      {/* Severity Tiles (Transit Conditions) */}
      <View style={styles.conditionsWrap}>
        {gocharData.keyConditions.map((cond, i) => {
          const toneColor = getConditionTone(cond);
          const glyph = extractConditionPlanetGlyph(cond);
          
          return (
            <TouchableOpacity 
              key={i} 
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenOracleModal({ context: 'Condition Insight', description: cond });
              }}
            >
              <BlurView intensity={20} tint="dark" style={styles.severityTile}>
                <View style={[styles.tileAccentBar, { backgroundColor: toneColor }]} />
                <Text style={[styles.tileGlyph, { color: toneColor }]}>{glyph}</Text>
                <Text style={styles.tileText}>{cond}</Text>
                <Text style={styles.tileBadge}>H{(i % 12) + 1}</Text>
              </BlurView>
            </TouchableOpacity>
          );
        })}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const gc = StyleSheet.create({
  cell: { borderWidth: 1, overflow: 'hidden', padding: 4, position: 'relative' },
  houseNum: { position: 'absolute', top: 4, right: 4, fontFamily: Fonts.accent, fontSize: 9, opacity: 0.8 },
  rashiName: { position: 'absolute', bottom: 4, left: 4, fontFamily: Fonts.bodySemiBold, fontSize: 9, color: 'rgba(255,255,255,0.25)' },
  quadrantNatal: { position: 'absolute', top: 4, left: 4, paddingRight: 4, paddingBottom: 4, borderBottomWidth: 1, borderRightWidth: 1, borderColor: 'rgba(201,168,76,0.3)', gap: 2 },
  quadrantTransit: { position: 'absolute', bottom: 4, right: 4, paddingLeft: 4, paddingTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderColor: 'rgba(47,190,190,0.3)', gap: 2, alignItems: 'flex-end' },
  planetPill: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  glyphNatal: { fontSize: 11, color: '#C9A84C' },
  abbrNatal: { fontFamily: Fonts.accent, fontSize: 7, color: '#C9A84C' },
  glyphTransit: { fontSize: 11, color: '#2FBEBE' },
  abbrTransit: { fontFamily: Fonts.accent, fontSize: 7, color: '#2FBEBE' },
  planetExalted: { textShadowColor: '#FFD700', textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
  planetDebilitated: { opacity: 0.5 },
  lagnaBar: { position: 'absolute', bottom: 0, left: 4, right: 4, height: 2, backgroundColor: '#C9A84C', borderRadius: 1, shadowColor: '#C9A84C', shadowRadius: 4, shadowOpacity: 0.8 },
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  legendPill: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden', backgroundColor: 'rgba(10,8,22,0.4)',
  },
  legendSide: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDotTxt: { fontSize: 10, marginTop: 1 },
  legendTitle: { fontFamily: Fonts.heading, fontSize: 9, color: '#C9A84C', textTransform: 'uppercase' },
  legendTitleGochar: { fontFamily: Fonts.heading, fontSize: 9, color: '#2FBEBE', textTransform: 'uppercase' },
  legendSub: { fontFamily: Fonts.mystical, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  legendDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  gridWrap: { alignItems: 'center', position: 'relative', marginBottom: 32 },
  centerGochar: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(47,190,190,0.3)' },
  centerSymbol: { fontSize: 14, color: '#2FBEBE', marginBottom: 2 },
  centerLabel: { fontFamily: Fonts.heading, fontSize: 9, color: '#2FBEBE', letterSpacing: 3 },
  centerDate: { fontFamily: Fonts.mystical, fontSize: 10, color: 'rgba(232,232,255,0.6)', marginTop: 2 },
  conditionsWrap: { width: '100%', gap: 10, marginTop: 12 },
  severityTile: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 14, paddingLeft: 18, position: 'relative', overflow: 'hidden',
    backgroundColor: 'rgba(10,8,20,0.5)',
  },
  tileAccentBar: { position: 'absolute', left: 4, top: 12, bottom: 12, width: 3, borderRadius: 1.5 },
  tileGlyph: { fontSize: 18, marginRight: 12, marginTop: -2 },
  tileText: { fontFamily: Fonts.mystical, fontSize: 14, color: '#B0B0D0', flex: 1, flexWrap: 'wrap', lineHeight: 20 },
  tileBadge: { position: 'absolute', top: 12, right: 12, fontFamily: Fonts.accent, fontSize: 8, color: 'rgba(255,255,255,0.3)' },
});
