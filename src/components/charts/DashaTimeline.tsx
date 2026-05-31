import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Line, Defs, Pattern, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Fonts } from '../../constants/fonts';
import type { VedicChart, PastDashaEntry } from '../../types';

const { width } = Dimensions.get('window');
const YEAR_WIDTH = 16;
const BASE_BAR_H = 68;
const CURRENT_BAR_H = 80;

const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Shukra: 20, Surya: 6, Chandra: 10, Mangal: 7,
  Rahu: 18, Guru: 16, Shani: 19, Budh: 17,
};
const DASHA_ORDER = ['Ketu', 'Shukra', 'Surya', 'Chandra', 'Mangal', 'Rahu', 'Guru', 'Shani', 'Budh'];

const DASHA_COLORS: Record<string, { primary: string; dark: string; light: string }> = {
  Ketu:    { primary: '#8888AA', dark: '#2b2b3d', light: '#b3b3cc' },
  Shukra:  { primary: '#FF80AA', dark: '#5e1932', light: '#ffa3c2' },
  Surya:   { primary: '#FF9500', dark: '#5c3200', light: '#ffb347' },
  Chandra: { primary: '#C0C8FF', dark: '#31375c', light: '#e0e3ff' },
  Mangal:  { primary: '#FF3B3B', dark: '#5c0b0b', light: '#ff7373' },
  Rahu:    { primary: '#7070AA', dark: '#232342', light: '#9999cc' },
  Guru:    { primary: '#FFD700', dark: '#5c4d00', light: '#ffe34d' },
  Shani:   { primary: '#8BA0C0', dark: '#2d3847', light: '#b0c2de' },
  Budh:    { primary: '#44CC88', dark: '#0f4228', light: '#85ebd0' },
};

interface DashaEntry {
  lord: string;
  startYear: number;
  endYear: number;
  isCurrent: boolean;
}

interface AntardashaEntry {
  lord: string;
  width: number;
  isCurrent: boolean;
}

// Generates structural chronological sequences for the lifecycle map
function buildFullDashaSequence(chart: VedicChart, birthYear: number): DashaEntry[] {
  const currentLord = chart.mahadasha.replace(' Mahadasha', '');
  const periodParts = chart.mahadashaPeriod.split('–');
  const currentStart = parseInt(periodParts[0]);
  const currentIdx = DASHA_ORDER.indexOf(currentLord);

  const entries: DashaEntry[] = [];
  let yearCursor = currentStart;
  let loopIdx = currentIdx;

  while (yearCursor > birthYear) {
    const prevIdx = (loopIdx - 1 + 9) % 9;
    yearCursor -= DASHA_YEARS[DASHA_ORDER[prevIdx]];
    loopIdx = prevIdx;
  }

  let year = yearCursor;
  let idx = loopIdx;
  const endAge = birthYear + 100;

  while (year < endAge) {
    const lord = DASHA_ORDER[idx];
    const years = DASHA_YEARS[lord];
    const startY = Math.max(birthYear, Math.round(year));
    const endY = Math.min(endAge, Math.round(year + years));
    entries.push({
      lord,
      startYear: startY,
      endYear: endY,
      isCurrent: lord === currentLord && startY === currentStart,
    });
    year += years;
    idx = (idx + 1) % 9;
  }

  return entries;
}

function buildFromPastHistory(pastHistory: PastDashaEntry[], birthYear: number, chart: VedicChart): DashaEntry[] {
  const currentLord = chart.mahadasha.replace(' Mahadasha', '');
  const periodParts = chart.mahadashaPeriod.split('–');
  const currentStart = parseInt(periodParts[0]);
  const currentEnd = parseInt(periodParts[1]);

  const entries: DashaEntry[] = [];

  pastHistory.forEach(entry => {
    entries.push({
      lord: entry.lord,
      startYear: birthYear + Math.floor(entry.startAge),
      endYear: birthYear + Math.ceil(entry.endAge),
      isCurrent: false,
    });
  });

  const currIdx = entries.findIndex(e => e.lord === currentLord && e.startYear === currentStart);
  if (currIdx !== -1) {
    entries[currIdx].isCurrent = true;
    entries[currIdx].endYear = currentEnd;
  } else {
    entries.push({ lord: currentLord, startYear: currentStart, endYear: currentEnd, isCurrent: true });
  }

  let futureCursor = currentEnd;
  const startIdx = DASHA_ORDER.indexOf(currentLord);
  for (let i = 1; i <= 6; i++) {
    const fIdx = (startIdx + i) % 9;
    const fLord = DASHA_ORDER[fIdx];
    const fYears = DASHA_YEARS[fLord];
    entries.push({
      lord: fLord,
      startYear: futureCursor,
      endYear: futureCursor + fYears,
      isCurrent: false,
    });
    futureCursor += fYears;
    if (futureCursor > birthYear + 100) break;
  }

  return entries;
}

// Proportional Antardasha nesting engine calculated using classical Vimshottari fractional rules
function getAntardashasForLord(mahadashaLord: string, totalWidth: number, isMahadashaCurrent: boolean, currentYear: number, startYear: number, endYear: number): AntardashaEntry[] {
  const startIndex = DASHA_ORDER.indexOf(mahadashaLord);
  const totalMahadashaYears = DASHA_YEARS[mahadashaLord];
  const antardashas: AntardashaEntry[] = [];
  
  let accumulatedWidth = 0;
  let runningYear = startYear;

  for (let i = 0; i < 9; i++) {
    const subLord = DASHA_ORDER[(startIndex + i) % 9];
    const subYears = DASHA_YEARS[subLord];
    
    // Proportional sub-period duration mapping
    const fractionalDuration = (subYears / 120) * totalMahadashaYears;
    let subWidth = (fractionalDuration / totalMahadashaYears) * totalWidth;
    
    const nextRunningYear = runningYear + fractionalDuration;
    const isCurrentSub = isMahadashaCurrent && currentYear >= runningYear && currentYear < nextRunningYear;

    antardashas.push({
      lord: subLord,
      width: subWidth,
      isCurrent: isCurrentSub,
    });

    runningYear = nextRunningYear;
  }

  return antardashas;
}

interface Props {
  chart: VedicChart;
  pastDashaHistory?: PastDashaEntry[];
  birthYear?: number;
  onOpenOracleModal: (context: any) => void;
}

export function DashaTimeline({ chart, pastDashaHistory, birthYear: birthYearProp, onOpenOracleModal }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const currentYear = new Date().getFullYear();

  // Animation Refs
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const borderPulseAnim = useRef(new Animated.Value(0)).current;
  const globalTimelineScale = useRef(new Animated.Value(1)).current;

  const currentLord = chart.mahadasha.replace(' Mahadasha', '');
  const periodParts = chart.mahadashaPeriod.split('–');
  const currentStart = parseInt(periodParts[0]);

  const birthYear = birthYearProp ?? (currentStart - (() => {
    let age = 0;
    let idx = DASHA_ORDER.indexOf(currentLord);
    while (DASHA_YEARS[DASHA_ORDER[idx]] < (currentYear - currentStart + 1)) {
      age += DASHA_YEARS[DASHA_ORDER[idx]];
      idx = (idx - 1 + 9) % 9;
    }
    return age;
  })());

  const entries = useMemo(() => {
    return pastDashaHistory && pastDashaHistory.length > 0
      ? buildFromPastHistory(pastDashaHistory, birthYear, chart)
      : buildFullDashaSequence(chart, birthYear);
  }, [pastDashaHistory, birthYear, chart]);

  // Compute positions along the horizontal temporal field
  const { totalW, currentX, decadeMarkers } = useMemo(() => {
    let widthAccumulator = 0;
    let currentExecutionX = 0;
    
    entries.forEach(e => {
      const duration = e.endYear - e.startYear;
      if (e.isCurrent) {
        const elapsedYears = currentYear - e.startYear;
        currentExecutionX = widthAccumulator + (elapsedYears * YEAR_WIDTH);
      }
      widthAccumulator += duration * YEAR_WIDTH;
    });

    // Extract exact 10-year incremental coordinate points based on the dynamic birth anchor
    const markers = [];
    const absoluteStartDecade = Math.ceil(birthYear / 10) * 10;
    const absoluteEndDecade = Math.floor((birthYear + 100) / 10) * 10;
    
    for (let yr = absoluteStartDecade; yr <= absoluteEndDecade; yr += 10) {
      const offsetFactor = (yr - birthYear) * YEAR_WIDTH;
      markers.push({ year: yr, xOffset: offsetFactor });
    }

    return { totalW: widthAccumulator, currentX: currentExecutionX, decadeMarkers: markers };
  }, [entries, birthYear, currentYear]);

  // Generate 25 unique structural coordinates for the sky background to prevent spatial morphing between rendering ticks
  const staticStarfieldCoords = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      top: `${Math.sin(i * 99) * 40 + 50}%`,
      left: `${Math.cos(i * 45) * 48 + 50}%`,
    }));
  }, []);

  useEffect(() => {
    // Structural Sync Looping Systems
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(borderPulseAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(borderPulseAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start();

    // Instantly translate camera frame center onto the interactive cursor coordinates
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, currentX - width / 2 + 20), animated: true });
    }, 500);
  }, [currentX]);

  const handleTimelinePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(globalTimelineScale, { toValue: 0.98, speed: 20, useNativeDriver: false }).start();
  };

  const handlePeriodSelection = (entry: DashaEntry, antardashas: AntardashaEntry[]) => {
    Animated.spring(globalTimelineScale, { toValue: 1.0, speed: 12, useNativeDriver: false }).start();
    
    const activeSub = antardashas.find(a => a.isCurrent)?.lord || 'None';
    const totalDuration = entry.endYear - entry.startYear;
    const remainingTime = entry.isCurrent ? Math.max(0, entry.endYear - currentYear) : 0;
    
    let lifecycleStatus = 'Future';
    if (entry.endYear <= currentYear) lifecycleStatus = 'Past';
    else if (entry.isCurrent) lifecycleStatus = 'Current';

    onOpenOracleModal({
      mahadashaLord: entry.lord,
      period: `${entry.startYear}–${entry.endYear}`,
      duration: totalDuration,
      status: lifecycleStatus,
      currentAntardasha: activeSub,
      yearsRemaining: entry.isCurrent ? `${remainingTime} years` : 'N/A',
      lordRashi: chart.grahas.find(g => g.name === entry.lord)?.rashi || 'Unknown Placement',
    });
  };

  // Interpolation mapping matrices
  const animatedOrbScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.3] });
  const animatedLaserRadius = borderPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 10] });
  const animatedBorderW = borderPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });

  return (
    <Animated.View style={[styles.outerBoundaryWrapper, { transform: [{ scale: globalTimelineScale }] }]}>
      <BlurView intensity={30} tint="dark" style={styles.glassContainerShell}>
        
        {/* Constellation Starfield Engine Overlay Backdrop */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {staticStarfieldCoords.map(star => (
            <View
              key={star.id}
              style={[
                styles.starNode,
                { top: star.top, left: star.left }
              ]}
            />
          ))}
        </View>

        {/* Scrollable Temporal Reality Canvas */}
        <ScrollView
          ref={scrollRef}
          horizontal
          snapToInterval={YEAR_WIDTH * 10}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollerContentCanvas, { width: totalW + 80 }]}
        >
          
          {/* Svg Past-Era Diagonal Calendar Cross-Hatch Pattern Layer Definition */}
          <View style={[StyleSheet.absoluteFillObject, { zIndex: 1 }]} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <Pattern id="diagonalHatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <Line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                </Pattern>
              </Defs>
            </Key>
          </Svg>
          </View>

          {/* Decade Reference Axis Tick Tiers */}
          {decadeMarkers.map(marker => (
            <View key={`tick-${marker.year}`} style={[styles.decadeTickLine, { left: marker.xOffset + 40 }]}>
              <Text style={styles.decadeTickLabel}>{marker.year}</Text>
            </View>
          ))}

          {/* Core Sequential Mahadasha River Nodes Array */}
          <View style={styles.riverHorizontalRow}>
            {entries.map((entry) => {
              const barW = (entry.endYear - entry.startYear) * YEAR_WIDTH;
              const theme = DASHA_COLORS[entry.lord] || { primary: '#FFF', dark: '#000', light: '#FFF' };
              
              const isPast = entry.endYear <= currentYear;
              const isFuture = entry.startYear > currentYear;
              const isActive = entry.isCurrent;

              // Generate child Antardasha array map internally
              const antardashas = getAntardashasForLord(entry.lord, barW, isActive, currentYear, entry.startYear, entry.endYear);

              // Configure specific visual hierarchy opacities
              let faceOpacity = 0.55;
              if (isActive) faceOpacity = 0.90;
              if (isPast) faceOpacity = 0.30;

              return (
                <TouchableOpacity
                  key={`${entry.lord}-${entry.startYear}`}
                  activeOpacity={0.9}
                  onPressIn={handleTimelinePressIn}
                  onPress={() => handlePeriodSelection(entry, antardashas)}
                  style={[
                    styles.temporalBlockFrame,
                    { width: barW, height: isActive ? CURRENT_BAR_H + 22 : BASE_BAR_H + 22 }
                  ]}
                >
                  {/* 3D Mahadasha Monolithic Container */}
                  <Animated.View style={[
                    styles.monolithic3DBar,
                    { 
                      height: isActive ? CURRENT_BAR_H : BASE_BAR_H,
                      opacity: isPast ? 0.25 : 1.0,
                      borderColor: isActive ? 'rgba(201,168,76,0.7)' : 'transparent',
                      borderWidth: isActive ? animatedBorderW : 0,
                    }
                  ]}>
                    
                    {/* Linear Gradient Core Face Fill */}
                    <LinearGradient
                      colors={[theme.primary, theme.dark]}
                      style={StyleSheet.absoluteFillObject}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      opacity={faceOpacity}
                    />

                    {/* Left Leading Cap Edge Glow */}
                    <View style={[styles.leftCapGlowEdge, { backgroundColor: theme.light }]} />

                    {/* Top Surface Specular Sheen Highlight */}
                    <View style={styles.topSpecularSheen} />

                    {/* Ancient Structural Hatch Pattern Layer applied if period exists in the past */}
                    {isPast && (
                      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                        <Svg width="100%" height="100%">
                          <Rect width="100%" height="100%" fill="url(#diagonalHatch)" />
                        </Svg>
                      </View>
                    )}

                    {/* Core Ident Label Stack */}
                    <View style={styles.barTextCoreStack}>
                      <Text style={[styles.lordNameLabel, { fontSize: barW > 55 ? 11 : 8 }]} numberOfLines={1}>
                        {entry.lord.toUpperCase()}
                      </Text>
                      {barW > 45 && (
                        <Text style={styles.durationSpanLabel}>{entry.endYear - entry.startYear} YRS</Text>
                      )}
                    </View>

                    {/* Bottom Grounding Shadow Thickness Plate */}
                    <View style={[styles.bottomShadowPlate, { backgroundColor: theme.dark }]} />
                  </Animated.View>

                  {/* Micro-Antardasha Strip Matrix Core Tier */}
                  <View style={[styles.antardashaHorizontalRibbon, { width: barW }]}>
                    {antardashas.map((sub, sIdx) => {
                      const subTheme = DASHA_COLORS[sub.lord] || { primary: '#FFF', dark: '#000' };
                      return (
                        <View 
                          key={`sub-${sub.lord}-${sIdx}`}
                          style={[
                            styles.antardashaSegmentUnit,
                            { 
                              width: sub.width, 
                              opacity: sub.isCurrent ? 0.70 : 0.30,
                              borderTopWidth: sub.isCurrent ? 1 : 0,
                              borderColor: subTheme.primary,
                            }
                          ]}
                        >
                          <LinearGradient
                            colors={[subTheme.primary, subTheme.dark]}
                            style={StyleSheet.absoluteFillObject}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                          />
                        </View>
                      );
                    })}
                  </View>

                  {/* Baseline Calendar Node Stamp */}
                  <Text style={styles.axisCalendarYearStamp}>{entry.startYear}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Absolute Universal Floating "NOW" Laser Cursor System */}
          <Animated.View style={[styles.nowLaserCursorVerticalAnchor, { left: currentX + 40, shadowRadius: animatedLaserRadius }]} pointerEvents="none">
            
            {/* Top Identity Header Tags */}
            <Text style={styles.nowIndicatorHeaderLabel}>NOW</Text>
            
            {/* Floating Gold Shadow Orb */}
            <Animated.View style={[styles.floatingGoldOrbTracker, { transform: [{ scale: animatedOrbScale }] }]} />
            
            {/* Extended Laser Structural Downward Vector Beam */}
            <LinearGradient
              colors={['rgba(201,168,76,0.9)', 'rgba(201,168,76,0.5)', 'transparent']}
              style={styles.laserDownwardBeamLine}
            />
            
            {/* Operational Current Dynamic Calendar Year Marker Node */}
            <Text style={styles.laserCurrentCalendarYearNode}>{currentYear}</Text>
          </Animated.View>

        </ScrollView>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerBoundaryWrapper: { paddingHorizontal: 14, marginVertical: 8 },
  glassContainerShell: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.15)', overflow: 'hidden', backgroundColor: 'rgba(10,8,22,0.4)' },
  starNode: { position: 'absolute', width: 1.5, height: 1.5, borderRadius: 0.75, backgroundColor: 'rgba(255,255,255,0.25)' },
  scrollerContentCanvas: { paddingLeft: 40, paddingRight: 40, paddingTop: 44, paddingBottom: 16, position: 'relative' },
  decadeTickLine: { position: 'absolute', top: 20, bottom: 24, width: 1, backgroundColor: 'rgba(255,255,255,0.08)', zIndex: 2 },
  decadeTickLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 7, color: 'rgba(255,255,255,0.2)', position: 'absolute', top: -14, transform: [{ translateX: -8 }] },
  riverHorizontalRow: { flexDirection: 'row', alignItems: 'flex-end', zIndex: 5 },
  temporalBlockFrame: { alignItems: 'flex-start', marginRight: 1, justifyContent: 'flex-end', position: 'relative' },
  monolithic3DBar: { width: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative', justifyContent: 'center', paddingHorizontal: 6 },
  leftCapGlowEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 4 },
  topSpecularSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.18)', zIndex: 3 },
  bottomShadowPlate: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, opacity: 0.8, zIndex: 3 },
  barTextCoreStack: { zIndex: 5, shadowColor: '#000', shadowRadius: 3, shadowOpacity: 0.9 },
  lordNameLabel: { fontFamily: 'Orbitron_400Regular', color: '#FFF', letterSpacing: 0.5 },
  durationSpanLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  antardashaHorizontalRibbon: { height: 14, flexDirection: 'row', marginTop: 4, borderRadius: 3, overflow: 'hidden' },
  antardashaSegmentUnit: { height: '100%', marginRight: 0.5 },
  axisCalendarYearStamp: { fontFamily: 'Orbitron_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 6 },
  nowLaserCursorVerticalAnchor: { position: 'absolute', top: 12, bottom: 0, width: 2, alignItems: 'center', zIndex: 50, shadowColor: '#C9A84C', shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 } },
  nowIndicatorHeaderLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 7, color: '#C9A84C', position: 'absolute', top: -14, letterSpacing: 0.5 },
  floatingGoldOrbTracker: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#C9A84C', position: 'absolute', top: 0, shadowColor: '#C9A84C', shadowRadius: 8, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 4 } },
  laserDownwardBeamLine: { width: 1.5, position: 'absolute', top: 10, bottom: 16 },
  laserCurrentCalendarYearNode: { fontFamily: 'Orbitron_400Regular', fontSize: 8, color: '#C9A84C', position: 'absolute', bottom: -1, letterSpacing: 0.5 }
});
