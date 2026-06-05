import React, { useEffect, useRef, useState } from 'react';
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

// Animated SVG components
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

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

export function NakshatraWheel({ chart, onOpenOracle }: { chart: VedicChart, onOpenOracle: (nak: any) => void }) {
  const birthNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra);
  const birthColor = NAKSHATRAS[Math.max(0, birthNakIdx)]?.color ?? '#C9A84C';

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Animations
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const wheelScaleAnim = useRef(new Animated.Value(1)).current;
  const pillTranslateY = useRef(new Animated.Value(200)).current;
  const segmentScales = useRef(NAKSHATRAS.map(() => new Animated.Value(1))).current;
  const mountTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Mount rise (opacity is already handled by spinAnim opacityInterpolate)
    Animated.timing(mountTranslateY, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Spin-In Birth Animation
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Pulse animations for Moon (Center) and Outer Ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleSegmentPress = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Reset previous
    if (selectedIdx !== null && selectedIdx !== idx) {
      Animated.spring(segmentScales[selectedIdx], { toValue: 1, useNativeDriver: true }).start();
    }
    
    // Animate entire wheel slightly
    Animated.sequence([
      Animated.spring(wheelScaleAnim, { toValue: 0.97, speed: 20, useNativeDriver: true }),
      Animated.spring(wheelScaleAnim, { toValue: 1, speed: 20, useNativeDriver: true })
    ]).start();

    if (selectedIdx === idx) {
      // Deselect
      setSelectedIdx(null);
      Animated.spring(segmentScales[idx], { toValue: 1, useNativeDriver: true }).start();
      Animated.timing(pillTranslateY, { toValue: 200, duration: 300, useNativeDriver: true }).start();
    } else {
      // Select
      setSelectedIdx(idx);
      Animated.spring(segmentScales[idx], { toValue: 1.05, useNativeDriver: true }).start(); // Spring slightly larger
      Animated.spring(pillTranslateY, { toValue: 0, speed: 12, bounciness: 6, useNativeDriver: true }).start();
    }
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-360deg', '0deg']
  });

  const opacityInterpolate = spinAnim.interpolate({
    inputRange: [0, 0.28], // First ~400ms of 1400ms
    outputRange: [0, 1],
    extrapolate: 'clamp'
  });

  const pulseOuterRing = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.22]
  });

  const pulseMoon = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1.0]
  });

  const selectedNak = selectedIdx !== null ? NAKSHATRAS[selectedIdx] : null;

  return (
    <Animated.View style={{ transform: [{ translateY: mountTranslateY }] }}>
    <View style={styles.wrapper}>
      <Animated.View style={{ 
        transform: [{ rotate: spinInterpolate }, { scale: wheelScaleAnim }],
        opacity: opacityInterpolate 
      }}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <RadialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="rgba(50,25,100,0.98)" />
              <Stop offset="100%" stopColor="rgba(10,5,25,0.99)" />
            </RadialGradient>
          </Defs>

          {/* Background circle */}
          <Circle cx={CX} cy={CY} r={OUTER_R + 2} fill="rgba(5,5,20,0.95)" />

          {/* Ring 3: Lord Color Ring (Grouped by geometry) */}
          {NAKSHATRAS.map((nak, i) => {
            const startDeg = i * SPAN;
            const endDeg = startDeg + SPAN;
            return (
              <Path
                key={`lord-${i}`}
                d={makeArcPath(CX, CY, CENTER_R + 10, INNER_R - 2, startDeg, endDeg)}
                fill={hexToRgba(nak.color, 0.3)}
              />
            );
          })}

          {/* Rings 1 & 2: Names and Main Band */}
          {NAKSHATRAS.map((nak, i) => {
            const startDeg = i * SPAN;
            const endDeg = startDeg + SPAN - 0.5;
            const midAngle = startDeg + SPAN / 2;
            const isBirth = i === birthNakIdx;
            const isSelected = i === selectedIdx;
            
            const mainPath = makeArcPath(CX, CY, INNER_R, OUTER_R, startDeg, endDeg);

            // Styling logic based on state
            let fillOpacity = 0.14;
            let strokeColor = 'rgba(255,255,255,0.04)';
            let strokeW = 0.5;

            if (isBirth) {
              fillOpacity = 0.90;
              strokeColor = nak.color;
              strokeW = 2.5;
            } else if (isSelected) {
              fillOpacity = 0.75;
              strokeW = 1.5;
              strokeColor = nak.color;
            }

            return (
              <AnimatedG 
                key={nak.name}
                scale={segmentScales[i]}
                originX={CX}
                originY={CY}
              >
                {/* Ring 1: Outer Name Label */}
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

                {/* Ring 2: Main Nakshatra Band */}
                <Path
                  d={mainPath}
                  fill={hexToRgba(nak.color, fillOpacity)}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  onPress={() => handleSegmentPress(i)}
                />

                {/* Birth Nakshatra Neon Glow Bloom */}
                {isBirth && (
                  <Path
                    d={mainPath}
                    fill="none"
                    stroke={nak.color}
                    strokeWidth={12}
                    opacity={0.15}
                    pointerEvents="none"
                  />
                )}
              </AnimatedG>
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

          {/* Ring 4: Inner Moon Ring */}
          <Circle cx={CX} cy={CY} r={CENTER_R + 8} fill="url(#centerGrad)" stroke="#C9A84C" strokeWidth={1} opacity={0.4} />
          
        </Svg>
      </Animated.View>

      {/* Center Overlay - Absolutely positioned to float dead center */}
      <View style={styles.centerOverlay} pointerEvents="none">
        <Animated.Text style={[styles.moonGlyph, { opacity: pulseMoon }]}>☽</Animated.Text>
        <Text style={styles.centerNakName} numberOfLines={2}>{chart.nakshatra}</Text>
        <Text style={styles.centerPada}>PADA {chart.nakshatraPada}</Text>
        <Text style={styles.centerRashi}>Moon in {chart.rashi}</Text>
      </View>

      {/* Tapped Segment Info Strip (Glass Pill) */}
      <Animated.View style={[styles.pillWrapper, { transform: [{ translateY: pillTranslateY }] }]}>
        {selectedNak && (
          <BlurView intensity={25} tint="dark" style={styles.glassPill}>
            <View style={styles.pillTextContainer}>
              <Text style={styles.pillNakName}>{selectedNak.name}</Text>
              <Text style={styles.pillDetails}>
                Lord: <Text style={{ color: selectedNak.color }}>{selectedNak.lord}</Text>  ·  {selectedNak.type}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.oracleBtn}
              onPress={() => onOpenOracle(selectedNak)}
            >
              <Text style={styles.oracleBtnText}>GET COSMIC READING</Text>
            </TouchableOpacity>
          </BlurView>
        )}
      </Animated.View>
    </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 10,
    height: SIZE + 60, // accommodate pill and rings
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
    position: 'absolute',
    bottom: -10,
    width: '90%',
    alignSelf: 'center',
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
    overflow: 'hidden',
  },
  pillTextContainer: {
    flex: 1,
  },
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
  }
});
