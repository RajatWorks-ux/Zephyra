import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, Animated, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, Pattern, Circle } from 'react-native-svg';
import { Fonts } from '../../constants/fonts';
import type { VedicChart, VedicGraha } from '../../types';

const { width } = Dimensions.get('window');

function computeStrength(g: VedicGraha): number {
  let score = 50;
  if (g.isExalted) score += 35;
  if (g.isDebilitated) score -= 30;
  if ([1, 4, 7, 10].includes(g.house)) score += 15;
  else if ([2, 5, 8, 11].includes(g.house)) score += 5;
  if (g.isRetrograde && !['Rahu', 'Ketu'].includes(g.name)) score += 10;
  return Math.max(8, Math.min(98, score));
}

const GRAHA_METADATA: Record<string, { fullName: string; label: string; glyph: string; color: string; sideColor: string }> = {
  Surya:   { fullName: 'Surya',   label: 'SU', glyph: '☀', color: '#FF9500', sideColor: '#5e2c00' },
  Chandra: { fullName: 'Chandra', label: 'MO', glyph: '☽', color: '#C0C8FF', sideColor: '#363d66' },
  Mangal:  { fullName: 'Mangal',  label: 'MA', glyph: '♂', color: '#FF3B3B', sideColor: '#5e0b0b' },
  Budh:    { fullName: 'Budha',   label: 'ME', glyph: '☿', color: '#00C060', sideColor: '#004221' },
  Guru:    { fullName: 'Guru',    label: 'JU', glyph: '♃', color: '#FFD700', sideColor: '#5e4f00' },
  Shukra:  { fullName: 'Shukra', label: 'VE', glyph: '♀', color: '#FF80AA', sideColor: '#611e38' },
  Shani:   { fullName: 'Shani',   label: 'SA', glyph: '♄', color: '#8BA0C0', sideColor: '#2d3847' },
  Rahu:    { fullName: 'Rahu',    label: 'RA', glyph: '☊', color: '#9090BB', sideColor: '#31314f' },
  Ketu:    { fullName: 'Ketu',    label: 'KE', glyph: '☋', color: '#B87840', sideColor: '#42240b' },
};

const ORDER = ['Surya', 'Chandra', 'Mangal', 'Budh', 'Guru', 'Shukra', 'Shani', 'Rahu', 'Ketu'];

// --- Helper for 270° Gauge Gauge Paths ---
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
}

// --- Individual 3D Monolithic Pillar Component ---
function Pillar3D({
  graha,
  strength,
  idx,
  pillarW,
  maxH,
  isSelected,
  isAnySelected,
  onPress,
}: {
  graha: VedicGraha;
  strength: number;
  idx: number;
  pillarW: number;
  maxH: number;
  isSelected: boolean;
  isAnySelected: boolean;
  onPress: () => void;
}) {
  const meta = GRAHA_METADATA[graha.name];
  const heightAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const selectionScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Dynamic sequential cascading fill
    Animated.timing(heightAnim, {
      toValue: strength / 100,
      duration: 1100,
      delay: idx * 75,
      useNativeDriver: false, // Height layout metrics tracking
    }).start(() => {
      // Shimmer sweep configuration triggered immediately after render
      Animated.timing(shimmerAnim, {
        toValue: -0.4,
        duration: 800,
        useNativeDriver: false,
      }).start();
    });

    // Intense Vibrational Neon Energy Pulse for Heavy Hitters (>80 Strength)
    if (strength > 80) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: false }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 750, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [strength]);

  useEffect(() => {
    Animated.spring(selectionScale, {
      toValue: isSelected ? 1.05 : 1.0,
      speed: 15,
      bounciness: 4,
      useNativeDriver: false,
    }).start();
  }, [isSelected]);

  if (!meta) return null;

  const animatedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxH],
  });

  const shimmerTop = shimmerAnim.interpolate({
    inputRange: [-0.4, 1],
    outputRange: ['-40%', '100%'],
  });

  const animatedPulseRadius = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 22],
  });

  // Calculate Dimming / Opacity States based on Global Interactions
  const currentOpacity = isAnySelected ? (isSelected ? 1.0 : 0.35) : 1.0;
  const currentShadowOpacity = isSelected ? 1.0 : 0.95;

  // Arc Gauge Color Matrix Selection
  let arcColor = '#E8E8FF';
  let dynamicArcGlow = false;
  if (strength > 80) {
    arcColor = '#C9A84C';
    dynamicArcGlow = true;
  } else if (strength < 40) {
    arcColor = '#FF4444';
  }

  // Draw exactly a 270-degree custom visual scale arc
  const targetAngle = -135 + (strength / 100) * 270;
  const gaugeBackgroundTrack = describeArc(14, 14, 11, -135, 135);
  const gaugeFilledTrack = describeArc(14, 14, 11, -135, targetAngle);

  return (
    <Animated.View style={[ps.container, { width: pillarW + 8, opacity: currentOpacity, transform: [{ scale: selectionScale }] }]}>
      
      {/* Strength Arc Gauge Wrapper */}
      <View style={ps.arcGaugeWrapper}>
        <Svg width="28" height="28" style={dynamicArcGlow ? ps.goldenGlowArc : undefined}>
          <Path d={gaugeBackgroundTrack} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" strokeLinecap="round" />
          <Path d={gaugeFilledTrack} fill="none" stroke={arcColor} strokeWidth="2.5" strokeLinecap="round" />
        </Svg>
        <Text style={[ps.strengthValueLabel, { color: arcColor }]}>{strength}</Text>
      </View>

      {/* Interactive 3D Crystal Monolith Pillar Matrix */}
      <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[ps.pillarInteractivityZone, { width: pillarW, height: maxH }]}>
        
        {/* RIGHT SIDE perspective depth panel */}
        <Animated.View
          style={[
            ps.rightDepthSide,
            {
              height: animatedHeight,
              backgroundColor: meta.sideColor,
              width: 5,
              right: -5,
            },
          ]}
        />

        {/* FRONT FACE of the Monolith */}
        <Animated.View style={[ps.frontPillarFace, { height: animatedHeight }]}>
          <LinearGradient
            colors={[meta.color, meta.sideColor]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />

          {/* Left Edge Specular Highlight Strip */}
          <View style={ps.specularLeftHighlight} />

          {/* Shimmer Sweep Node Overlay */}
          <Animated.View style={[ps.shimmerSweepOverlay, { top: shimmerTop }]} />
        </Animated.View>

        {/* TOP CROWN CAP Neon Glow Engine */}
        <Animated.View
          style={[
            ps.topCrownCap,
            {
              bottom: animatedHeight,
              width: pillarW + 5,
              backgroundColor: meta.color,
              shadowColor: meta.color,
              shadowOpacity: currentShadowOpacity,
              shadowRadius: strength > 80 ? animatedPulseRadius : 14,
            },
          ]}
        />
      </TouchableOpacity>

      {/* Axis Nomenclature Matrix Footer */}
      <View style={ps.footerIdentityContainer}>
        <Text style={[ps.unicodeGlyph, { color: meta.color }]}>{meta.glyph}</Text>
        <Text style={[ps.abbrevLabel, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </Animated.View>
  );
}

const ps = StyleSheet.create({
  container: { alignItems: 'center', position: 'relative' },
  arcGaugeWrapper: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  goldenGlowArc: { shadowColor: '#C9A84C', shadowRadius: 5, shadowOpacity: 0.6, shadowOffset: { width: 0, height: 0 } },
  strengthValueLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 7, position: 'absolute', textAlign: 'center' },
  pillarInteractivityZone: { position: 'relative', justifyContent: 'flex-end', overflow: 'visible' },
  frontPillarFace: { width: '100%', position: 'absolute', bottom: 0, left: 0, overflow: 'hidden' },
  specularLeftHighlight: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  shimmerSweepOverlay: { position: 'absolute', left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.09)' },
  rightDepthSide: { position: 'absolute', bottom: 0, transform: [{ skewY: '-1deg' }], opacity: 0.7 },
  topCrownCap: { position: 'absolute', left: 0, height: 5, shadowOffset: { width: 0, height: -6 }, elevation: 12, zIndex: 10 },
  footerIdentityContainer: { alignItems: 'center', marginTop: 10 },
  unicodeGlyph: { fontSize: 14, marginBottom: 2, lineHeight: 16 },
  abbrevLabel: { fontFamily: 'Orbitron_600SemiBold', fontSize: 8, letterSpacing: 0.5 },
});

// --- Main Engine Component Export ---
export function GrahaStrength({ chart, onOpenOracle }: { chart: VedicChart; onOpenOracle: (context: any) => void }) {
  const [activePlanet, setActivePlanet] = useState<string | null>(null);

  const availableCanvasWidth = Math.min(width - 40, 360);
  const pillarW = Math.floor((availableCanvasWidth - 36) / 9) - 6;
  const maxH = 160;

  const handlePillarInteraction = (name: string, graha: VedicGraha) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activePlanet === name) {
      setActivePlanet(null);
    } else {
      setActivePlanet(name);
      onOpenOracle({
        planet: name,
        rashi: graha.rashi,
        house: graha.house,
        nakshatra: graha.nakshatra,
        strength: computeStrength(graha),
        status: graha.isExalted ? 'Exalted' : graha.isDebilitated ? 'Debilitated' : 'Normal',
        isRetrograde: graha.isRetrograde ? 'Yes' : 'No',
        lagna: chart.lagna || 'Unknown',
      });
    }
  };

  return (
    <View style={gstyles.wrapper}>
      
      {/* Core Sacred Architecture Scene */}
      <View style={[gstyles.chartStage, { width: availableCanvasWidth }]}>
        
        {/* Ancient Sacred Geometry Infinite Hexagonal Grid Backdrop */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <Pattern id="hexGridPattern" width="34.64" height="30" patternUnits="userSpaceOnUse">
                <Path
                  d="M 0,15 L 8.66,0 L 25.98,0 L 34.64,15 L 25.98,30 L 8.66,30 Z M 34.64,15 L 43.3,0 M 34.64,15 L 43.3,30"
                  fill="none"
                  stroke="rgba(255,255,255,0.025)"
                  strokeWidth="1"
                />
              </Pattern>
            </Defs>
            <Path d={`M 0,0 L ${availableCanvasWidth},0 L ${availableCanvasWidth},${maxH + 70} L 0,${maxH + 70} Z`} fill="url(#hexGridPattern)" />
          </Svg>
        </View>

        {/* Three Golden Horizontal Architectural Reference Beams */}
        {[25, 50, 75].map((pct) => {
          const calculatedBottomPosition = (pct / 100) * maxH + 42;
          return (
            <View key={pct} style={[gstyles.architecturalBeam, { bottom: calculatedBottomPosition }]}>
              <Text style={gstyles.architecturalBeamLabel}>{pct}</Text>
            </View>
          );
        })}

        {/* Primary Monolithic Pillars Array Node Layer */}
        <View style={gstyles.pillarsFlexRow}>
          {ORDER.map((name, idx) => {
            const graha = chart.grahas.find((g) => g.name === name);
            if (!graha) return null;
            return (
              <Pillar3D
                key={name}
                graha={graha}
                strength={computeStrength(graha)}
                idx={idx}
                pillarW={pillarW}
                maxH={maxH}
                isSelected={activePlanet === name}
                isAnySelected={activePlanet !== null}
                onPress={() => handlePillarInteraction(name, graha)}
              />
            );
          })}
        </View>

        {/* Baseline Floor Edge */}
        <View style={gstyles.templeBaseline} />

        {/* Ground Shadow Plate — depth shadow beneath the pillar array */}
        <View style={gstyles.bottomShadowPlate} />
      </View>

      {/* Horizontal Scrolling Detail Cards Interface Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={gstyles.cardsScrollerContent}
      >
        {ORDER.map((name) => {
          const graha = chart.grahas.find((g) => g.name === name);
          if (!graha) return null;
          const meta = GRAHA_METADATA[name];
          const isSelected = activePlanet === name;

          return (
            <TouchableOpacity
              key={`card-${name}`}
              activeOpacity={0.85}
              onPress={() => handlePillarInteraction(name, graha)}
              style={[gstyles.touchableCardWrapper, isSelected && gstyles.selectedCardOutline]}
            >
              <BlurView intensity={20} tint="dark" style={[gstyles.tallSquareCard, { borderColor: meta.color + '40' }]}>
                <Text style={[gstyles.cardGlyph, { color: meta.color }]}>{meta.glyph}</Text>
                <Text style={gstyles.cardTitle}>{meta.fullName.toUpperCase()}</Text>
                <Text style={gstyles.cardRashiSubtext}>{graha.rashi}</Text>
                
                <View style={gstyles.cardDividerLine} />
                
                <Text style={gstyles.cardHouseMetrics}>HOUSE {graha.house}</Text>
                <Text style={gstyles.cardNakMetrics}>{graha.nakshatra.toUpperCase()}</Text>
              </BlurView>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const gstyles = StyleSheet.create({
  wrapper: { paddingVertical: 10, alignItems: 'center' },
  chartStage: { position: 'relative', paddingBottom: 12, backgroundColor: 'rgba(5,3,15,0.4)', borderRadius: 16, overflow: 'hidden', paddingHorizontal: 10, paddingTop: 16 },
  pillarsFlexRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', zIndex: 5 },
  templeBaseline: { height: 2, backgroundColor: 'rgba(201,168,76,0.25)', marginTop: 2, shadowColor: '#C9A84C', shadowRadius: 3, shadowOpacity: 0.5 },
  bottomShadowPlate: {
    height: 10,
    marginHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  architecturalBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.12)',
    shadowColor: '#C9A84C',
    shadowRadius: 4,
    shadowOpacity: 0.4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  architecturalBeamLabel: { fontFamily: 'Orbitron_400Regular', fontSize: 7, color: 'rgba(201,168,76,0.3)', marginRight: 6, position: 'absolute', top: -10 },
  cardsScrollerContent: { paddingHorizontal: 4, paddingTop: 24, paddingBottom: 10, gap: 10 },
  touchableCardWrapper: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'transparent' },
  selectedCardOutline: { borderColor: '#C9A84C', shadowColor: '#C9A84C', shadowRadius: 8, shadowOpacity: 0.4 },
  tallSquareCard: { width: 95, height: 125, padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16 },
  cardGlyph: { fontSize: 20, marginBottom: 4 },
  cardTitle: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 9, color: '#C9A84C', textAlign: 'center', letterSpacing: 0.5 },
  cardRashiSubtext: { fontFamily: 'CormorantGaramond_400Regular_Italic', fontSize: 12, color: '#E8E8FF', marginTop: 1, marginBottom: 4 },
  cardDividerLine: { width: '60%', height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  houseMetrics: { fontFamily: 'Orbitron_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  cardHouseMetrics: { fontFamily: 'Orbitron_400Regular', fontSize: 7, color: 'rgba(255,255,255,0.45)' },
  cardNakMetrics: { fontFamily: 'Orbitron_400Regular', fontSize: 6.5, color: 'rgba(255,255,255,0.25)', marginTop: 1, textAlign: 'center' },
});
