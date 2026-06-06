import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, {
  Path, Circle, Defs, RadialGradient, Stop, G, Text as SvgText,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Fonts } from '../../constants/fonts';
import type { VedicChart } from '../../types';

const { width } = Dimensions.get('window');
const SIZE = Math.min(width - 40, 340);
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = SIZE * 0.46;
const INNER_R = SIZE * 0.30;
const CENTER_R = SIZE * 0.12;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const NAKSHATRAS = [
  { name: 'Ashwini',            lord: 'Ketu',    color: '#8888AA', type: 'Deva' },
  { name: 'Bharani',            lord: 'Venus',   color: '#FF80AA', type: 'Nara' },
  { name: 'Krittika',           lord: 'Sun',     color: '#FF9500', type: 'Rakshasa' },
  { name: 'Rohini',             lord: 'Moon',    color: '#C0C8FF', type: 'Nara' },
  { name: 'Mrigashira',         lord: 'Mars',    color: '#FF5555', type: 'Deva' },
  { name: 'Ardra',              lord: 'Rahu',    color: '#7070AA', type: 'Nara' },
  { name: 'Punarvasu',          lord: 'Jupiter', color: '#FFD700', type: 'Deva' },
  { name: 'Pushya',             lord: 'Saturn',  color: '#6080B0', type: 'Deva' },
  { name: 'Ashlesha',           lord: 'Mercury', color: '#44CC88', type: 'Rakshasa' },
  { name: 'Magha',              lord: 'Ketu',    color: '#9090BB', type: 'Rakshasa' },
  { name: 'Purva Phalguni',     lord: 'Venus',   color: '#FF90BB', type: 'Nara' },
  { name: 'Uttara Phalguni',    lord: 'Sun',     color: '#FFA030', type: 'Nara' },
  { name: 'Hasta',              lord: 'Moon',    color: '#B0B8FF', type: 'Deva' },
  { name: 'Chitra',             lord: 'Mars',    color: '#FF4444', type: 'Rakshasa' },
  { name: 'Swati',              lord: 'Rahu',    color: '#8080BB', type: 'Deva' },
  { name: 'Vishakha',           lord: 'Jupiter', color: '#FFD020', type: 'Rakshasa' },
  { name: 'Anuradha',           lord: 'Saturn',  color: '#5070A0', type: 'Deva' },
  { name: 'Jyeshtha',           lord: 'Mercury', color: '#33BB77', type: 'Rakshasa' },
  { name: 'Mula',               lord: 'Ketu',    color: '#9898CC', type: 'Rakshasa' },
  { name: 'Purva Ashadha',      lord: 'Venus',   color: '#FF88BB', type: 'Nara' },
  { name: 'Uttara Ashadha',     lord: 'Sun',     color: '#FFAA40', type: 'Nara' },
  { name: 'Shravana',           lord: 'Moon',    color: '#A0B0FF', type: 'Deva' },
  { name: 'Dhanishta',          lord: 'Mars',    color: '#FF3333', type: 'Rakshasa' },
  { name: 'Shatabhisha',        lord: 'Rahu',    color: '#6868AA', type: 'Rakshasa' },
  { name: 'Purva Bhadrapada',   lord: 'Jupiter', color: '#EEC600', type: 'Nara' },
  { name: 'Uttara Bhadrapada',  lord: 'Saturn',  color: '#4060A0', type: 'Nara' },
  { name: 'Revati',             lord: 'Mercury', color: '#22AA66', type: 'Deva' },
];

const SPAN = 360 / 27;
const DEG_TO_RAD = Math.PI / 180;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeArcPath(cx: number, cy: number, r1: number, r2: number, startDeg: number, endDeg: number): string {
  const s = (startDeg - 90) * DEG_TO_RAD;
  const e = (endDeg - 90) * DEG_TO_RAD;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${cx + r1 * Math.cos(s)} ${cy + r1 * Math.sin(s)}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${cx + r1 * Math.cos(e)} ${cy + r1 * Math.sin(e)}`,
    `L ${cx + r2 * Math.cos(e)} ${cy + r2 * Math.sin(e)}`,
    `A ${r2} ${r2} 0 ${largeArc} 0 ${cx + r2 * Math.cos(s)} ${cy + r2 * Math.sin(s)}`,
    'Z',
  ].join(' ');
}

// Pre-compute all paths once — outside render
const ARC_PATHS = NAKSHATRAS.map((_, i) => ({
  lord: makeArcPath(CX, CY, CENTER_R + 10, INNER_R - 2, i * SPAN, i * SPAN + SPAN),
  main: makeArcPath(CX, CY, INNER_R, OUTER_R, i * SPAN, i * SPAN + SPAN - 0.5),
}));

export function NakshatraWheel({ chart, onOpenOracle }: { chart: VedicChart, onOpenOracle: (nak: any) => void }) {
  const birthNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra);
  const birthColor = NAKSHATRAS[Math.max(0, birthNakIdx)]?.color ?? '#C9A84C';

  // Use a ref to track selectedIdx so SVG onPress callbacks never go stale
  const selectedIdxRef = useRef<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Animations
  const spinAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(0)).current;
  const wheelScaleAnim = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const mountTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.timing(mountTranslateY, {
      toValue: 0, duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(spinAnim, {
      toValue: 1, duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // FIXED: useCallback so the function identity is stable,
  // and read selectedIdx from ref (never stale) not from closure state
  const handleSegmentPress = useCallback((idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.spring(wheelScaleAnim, { toValue: 0.97, speed: 20, useNativeDriver: true }),
      Animated.spring(wheelScaleAnim, { toValue: 1,    speed: 20, useNativeDriver: true }),
    ]).start();

    const prev = selectedIdxRef.current;

    if (prev === idx) {
      // Deselect
      selectedIdxRef.current = null;
      setSelectedIdx(null);
      Animated.timing(pillOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else {
      // Select
      selectedIdxRef.current = idx;
      setSelectedIdx(idx);
      Animated.timing(pillOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, []); // no deps — reads ref, never stale

  const spinInterpolate = spinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['-360deg', '0deg'],
  });
  const opacityInterpolate = spinAnim.interpolate({
    inputRange:  [0, 0.28],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const pulseOuterRing = pulseAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.08, 0.22],
  });
  const pulseMoon = pulseAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.6, 1.0],
  });

  const selectedNak = selectedIdx !== null ? NAKSHATRAS[selectedIdx] : null;

  return (
    <Animated.View style={{ transform: [{ translateY: mountTranslateY }] }}>
      <View style={styles.wrapper}>

        {/*
          FIX: The spin+scale animation is on the Animated.View as before,
          BUT we add pointerEvents="box-none" so the Animated.View itself
          never intercepts touches — they fall through to the SVG paths below.
          The SVG onPress handlers work correctly once the Animated.View
          stops consuming the touch events.
        */}
        <Animated.View
          pointerEvents="box-none"
          style={{
            transform: [{ rotate: spinInterpolate }, { scale: wheelScaleAnim }],
            opacity: opacityInterpolate,
          }}
        >
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%"   stopColor="rgba(50,25,100,0.98)" />
                <Stop offset="100%" stopColor="rgba(10,5,25,0.99)" />
              </RadialGradient>
            </Defs>

            {/* Background circle */}
            <Circle cx={CX} cy={CY} r={OUTER_R + 2} fill="rgba(5,5,20,0.95)" />

            {/* Ring 3: Lord Color Ring */}
            {NAKSHATRAS.map((nak, i) => (
              <Path
                key={`lord-${i}`}
                d={ARC_PATHS[i].lord}
                fill={hexToRgba(nak.color, 0.3)}
              />
            ))}

            {/* Rings 1 & 2: Names and Main Band */}
            {NAKSHATRAS.map((nak, i) => {
              const midAngle = i * SPAN + SPAN / 2;
              const isBirth  = i === birthNakIdx;
              const isSelected = i === selectedIdx;

              let fillOpacity = 0.14;
              let strokeColor = 'rgba(255,255,255,0.04)';
              let strokeW = 0.5;
              if (isBirth)    { fillOpacity = 0.90; strokeColor = nak.color; strokeW = 2.5; }
              else if (isSelected) { fillOpacity = 0.75; strokeColor = nak.color; strokeW = 1.5; }

              return (
                <G key={nak.name}>
                  {/* Outer Name Label */}
                  <SvgText
                    x={CX}
                    y={CY - OUTER_R - 30}
                    origin={`${CX}, ${CY}`}
                    rotation={midAngle}
                    fill={isBirth || isSelected ? hexToRgba(nak.color, 0.7) : 'rgba(255,255,255,0.25)'}
                    fontSize="5.5"
                    fontFamily="Orbitron_400Regular"
                    textAnchor="middle"
                  >
                    {nak.name.substring(0, 4).toUpperCase()}
                  </SvgText>

                  {/* Main Nakshatra Band — tappable */}
                  <Path
                    d={ARC_PATHS[i].main}
                    fill={hexToRgba(nak.color, fillOpacity)}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    onPress={() => handleSegmentPress(i)}
                  />

                  {/* Birth Glow */}
                  {isBirth && (
                    <Path
                      d={ARC_PATHS[i].main}
                      fill="none"
                      stroke={nak.color}
                      strokeWidth={12}
                      opacity={0.15}
                      pointerEvents="none"
                    />
                  )}
                </G>
              );
            })}

            {/* Outer Pulse Ring */}
            {birthNakIdx >= 0 && (
              <AnimatedCircle
                cx={CX} cy={CY} r={OUTER_R + 14}
                fill="none"
                stroke={birthColor}
                strokeWidth={2}
                opacity={pulseOuterRing}
              />
            )}

            {/* Inner Moon Ring */}
            <Circle
              cx={CX} cy={CY} r={CENTER_R + 8}
              fill="url(#centerGrad)" stroke="#C9A84C" strokeWidth={1} opacity={0.4}
            />
          </Svg>
        </Animated.View>

        {/* Center Overlay */}
        <View style={styles.centerOverlay} pointerEvents="none">
          <Animated.Text style={[styles.moonGlyph, { opacity: pulseMoon }]}>☽</Animated.Text>
          <Text style={styles.centerNakName} numberOfLines={2}>{chart.nakshatra}</Text>
          <Text style={styles.centerPada}>PADA {chart.nakshatraPada}</Text>
          <Text style={styles.centerRashi}>Moon in {chart.rashi}</Text>
        </View>

      </View>

      {/* Glass Pill — below the wheel */}
      <Animated.View style={[styles.pillWrapper, { opacity: pillOpacity }]}>
        {selectedNak && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onOpenOracle(selectedNak);
            }}
          >
            <BlurView intensity={25} tint="dark" style={styles.glassPill}>
              <View style={styles.pillTextContainer}>
                <Text style={styles.pillNakName}>{selectedNak.name}</Text>
                <Text style={styles.pillDetails}>
                  Lord: <Text style={{ color: selectedNak.color }}>{selectedNak.lord}</Text>  ·  {selectedNak.type}
                </Text>
              </View>
              <View style={styles.oracleBtn}>
                <Text style={styles.oracleBtnText}>GET COSMIC READING</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    height: SIZE + 20,
  },
  centerOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
  },
  moonGlyph: {
    fontSize: 22,
    color: '#E8E8FF',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowRadius: 8,
    marginBottom: 2,
  },
  centerNakName: {
    fontFamily: 'CinzelDecorative_400Regular',
    fontSize: 11,
    color: '#C9A84C',
    textAlign: 'center',
    maxWidth: CENTER_R * 1.5,
    lineHeight: 14,
  },
  centerPada: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 8,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  centerRashi: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 10,
    color: 'rgba(232,232,255,0.5)',
    marginTop: 2,
  },
  pillWrapper: {
    width: '90%',
    alignSelf: 'center',
    marginTop: 8,
  },
  glassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  pillTextContainer: { flex: 1 },
  pillNakName: {
    fontFamily: 'CinzelDecorative_400Regular',
    color: '#C9A84C',
    fontSize: 14,
    marginBottom: 2,
  },
  pillDetails: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  oracleBtn: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderWidth: 1,
    borderColor: '#C9A84C',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  oracleBtnText: {
    fontFamily: 'Orbitron_400Regular',
    color: '#C9A84C',
    fontSize: 9,
    letterSpacing: 0.5,
  },
});
