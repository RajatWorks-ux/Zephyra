import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  Animated, Easing, TouchableOpacity, PanResponder,
} from 'react-native';
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
  { name: 'Ashwini',           lord: 'Ketu',    color: '#8888AA', type: 'Deva' },
  { name: 'Bharani',           lord: 'Venus',   color: '#FF80AA', type: 'Nara' },
  { name: 'Krittika',          lord: 'Sun',     color: '#FF9500', type: 'Rakshasa' },
  { name: 'Rohini',            lord: 'Moon',    color: '#C0C8FF', type: 'Nara' },
  { name: 'Mrigashira',        lord: 'Mars',    color: '#FF5555', type: 'Deva' },
  { name: 'Ardra',             lord: 'Rahu',    color: '#7070AA', type: 'Nara' },
  { name: 'Punarvasu',         lord: 'Jupiter', color: '#FFD700', type: 'Deva' },
  { name: 'Pushya',            lord: 'Saturn',  color: '#6080B0', type: 'Deva' },
  { name: 'Ashlesha',          lord: 'Mercury', color: '#44CC88', type: 'Rakshasa' },
  { name: 'Magha',             lord: 'Ketu',    color: '#9090BB', type: 'Rakshasa' },
  { name: 'Purva Phalguni',    lord: 'Venus',   color: '#FF90BB', type: 'Nara' },
  { name: 'Uttara Phalguni',   lord: 'Sun',     color: '#FFA030', type: 'Nara' },
  { name: 'Hasta',             lord: 'Moon',    color: '#B0B8FF', type: 'Deva' },
  { name: 'Chitra',            lord: 'Mars',    color: '#FF4444', type: 'Rakshasa' },
  { name: 'Swati',             lord: 'Rahu',    color: '#8080BB', type: 'Deva' },
  { name: 'Vishakha',          lord: 'Jupiter', color: '#FFD020', type: 'Rakshasa' },
  { name: 'Anuradha',          lord: 'Saturn',  color: '#5070A0', type: 'Deva' },
  { name: 'Jyeshtha',          lord: 'Mercury', color: '#33BB77', type: 'Rakshasa' },
  { name: 'Mula',              lord: 'Ketu',    color: '#9898CC', type: 'Rakshasa' },
  { name: 'Purva Ashadha',     lord: 'Venus',   color: '#FF88BB', type: 'Nara' },
  { name: 'Uttara Ashadha',    lord: 'Sun',     color: '#FFAA40', type: 'Nara' },
  { name: 'Shravana',          lord: 'Moon',    color: '#A0B0FF', type: 'Deva' },
  { name: 'Dhanishta',         lord: 'Mars',    color: '#FF3333', type: 'Rakshasa' },
  { name: 'Shatabhisha',       lord: 'Rahu',    color: '#6868AA', type: 'Rakshasa' },
  { name: 'Purva Bhadrapada',  lord: 'Jupiter', color: '#EEC600', type: 'Nara' },
  { name: 'Uttara Bhadrapada', lord: 'Saturn',  color: '#4060A0', type: 'Nara' },
  { name: 'Revati',            lord: 'Mercury', color: '#22AA66', type: 'Deva' },
];

const SPAN = 360 / 27;
const DEG_TO_RAD = Math.PI / 180;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function makeArcPath(
  cx: number, cy: number,
  r1: number, r2: number,
  startDeg: number, endDeg: number,
): string {
  const s = (startDeg - 90) * DEG_TO_RAD;
  const e = (endDeg   - 90) * DEG_TO_RAD;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${cx + r1 * Math.cos(s)} ${cy + r1 * Math.sin(s)}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${cx + r1 * Math.cos(e)} ${cy + r1 * Math.sin(e)}`,
    `L ${cx + r2 * Math.cos(e)} ${cy + r2 * Math.sin(e)}`,
    `A ${r2} ${r2} 0 ${largeArc} 0 ${cx + r2 * Math.cos(s)} ${cy + r2 * Math.sin(s)}`,
    'Z',
  ].join(' ');
}

// Which nakshatra index was tapped based on (x,y) relative to SVG center
function getNakshatraIdxFromPoint(x: number, y: number): number | null {
  const dx = x - CX;
  const dy = y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < INNER_R || dist > OUTER_R) return null; // outside ring
  // atan2 gives angle from positive-x axis; we need angle from top (12 o'clock)
  let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (angleDeg < 0) angleDeg += 360;
  return Math.floor(angleDeg / SPAN) % 27;
}

export function NakshatraWheel({
  chart,
  onOpenOracle,
}: {
  chart: VedicChart;
  onOpenOracle: (nak: any) => void;
}) {
  const birthNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra);
  const birthColor  = NAKSHATRAS[Math.max(0, birthNakIdx)]?.color ?? '#C9A84C';

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  // ref so PanResponder callbacks never capture stale state
  const selectedIdxRef = useRef<number | null>(null);

  const spinAnim       = useRef(new Animated.Value(0)).current;
  const pulseAnim      = useRef(new Animated.Value(0)).current;
  const wheelScaleAnim = useRef(new Animated.Value(1)).current;
  const pillOpacity    = useRef(new Animated.Value(0)).current;
  const mountTranslateY = useRef(new Animated.Value(20)).current;

  // Track tap start so we can distinguish tap vs scroll
  const tapStartRef = useRef<{ x: number; y: number } | null>(null);
  // Layout position of the SVG on screen (set by onLayout)
  const svgLayoutRef = useRef<{ px: number; py: number }>({ px: 0, py: 0 });

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

  const handleSegmentTap = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.spring(wheelScaleAnim, { toValue: 0.97, speed: 20, useNativeDriver: true }),
      Animated.spring(wheelScaleAnim, { toValue: 1,    speed: 20, useNativeDriver: true }),
    ]).start();

    if (selectedIdxRef.current === idx) {
      selectedIdxRef.current = null;
      setSelectedIdx(null);
      Animated.timing(pillOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else {
      selectedIdxRef.current = idx;
      setSelectedIdx(idx);
      Animated.timing(pillOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  };

  /*
   * ROOT CAUSE FIX:
   * NakshatraWheel lives inside an Animated.ScrollView in ChartsScreen.
   * The ScrollView steals all touch events before SVG onPress ever fires.
   * Solution: use a PanResponder on the wrapper View that:
   *   - Claims the touch immediately on finger-down (so ScrollView can't steal it)
   *   - On finger-up, if movement < 8px it's a tap → hit-test the nakshatra ring
   *   - If movement >= 8px it's a scroll → release so ScrollView can handle it
   */
  const panResponder = useRef(
    PanResponder.create({
      // We want to try to be the responder
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) => {
        // Only claim if horizontal/vertical movement is tiny (still a tap)
        return Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8;
      },
      // Don't let parent ScrollView steal once we've claimed
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        tapStartRef.current = { x: pageX, y: pageY };
      },

      onPanResponderRelease: (e, gs) => {
        // If finger moved too much → not a tap, bail
        if (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8) {
          tapStartRef.current = null;
          return;
        }
        const start = tapStartRef.current;
        if (!start) return;
        tapStartRef.current = null;

        // Convert pageX/pageY → local SVG coords
        const localX = start.x - svgLayoutRef.current.px;
        const localY = start.y - svgLayoutRef.current.py;

        const idx = getNakshatraIdxFromPoint(localX, localY);
        if (idx !== null) handleSegmentTap(idx);
      },

      onPanResponderTerminate: () => {
        tapStartRef.current = null;
      },
    })
  ).current;

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-360deg', '0deg'],
  });
  const opacityInterpolate = spinAnim.interpolate({
    inputRange: [0, 0.28],
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

        {/* This View catches taps via PanResponder BEFORE ScrollView steals them */}
        <View
          {...panResponder.panHandlers}
          onLayout={(e) => {
            // measure gives us page-level coords so we can convert tap to SVG coords
            e.target.measure((_x, _y, _w, _h, px, py) => {
              svgLayoutRef.current = { px, py };
            });
          }}
        >
          <Animated.View
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

              {/* Background */}
              <Circle cx={CX} cy={CY} r={OUTER_R + 2} fill="rgba(5,5,20,0.95)" />

              {/* Ring 3: Lord Color Ring */}
              {NAKSHATRAS.map((nak, i) => (
                <Path
                  key={`lord-${i}`}
                  d={makeArcPath(CX, CY, CENTER_R + 10, INNER_R - 2, i * SPAN, i * SPAN + SPAN)}
                  fill={hexToRgba(nak.color, 0.3)}
                />
              ))}

              {/* Rings 1 & 2: Names + Main Band */}
              {NAKSHATRAS.map((nak, i) => {
                const startDeg   = i * SPAN;
                const endDeg     = startDeg + SPAN - 0.5;
                const midAngle   = startDeg + SPAN / 2;
                const isBirth    = i === birthNakIdx;
                const isSelected = i === selectedIdx;
                const mainPath   = makeArcPath(CX, CY, INNER_R, OUTER_R, startDeg, endDeg);

                let fillOpacity = 0.14;
                let strokeColor = 'rgba(255,255,255,0.04)';
                let strokeW = 0.5;
                if (isBirth)     { fillOpacity = 0.90; strokeColor = nak.color; strokeW = 2.5; }
                else if (isSelected) { fillOpacity = 0.75; strokeColor = nak.color; strokeW = 1.5; }

                return (
                  <G key={nak.name}>
                    <SvgText
                      x={CX}
                      y={CY - OUTER_R - 30}
                      origin={`${CX}, ${CY}`}
                      rotation={midAngle}
                      fill={isBirth || isSelected
                        ? hexToRgba(nak.color, 0.7)
                        : 'rgba(255,255,255,0.25)'}
                      fontSize="5.5"
                      fontFamily="Orbitron_400Regular"
                      textAnchor="middle"
                    >
                      {nak.name.substring(0, 4).toUpperCase()}
                    </SvgText>

                    <Path
                      d={mainPath}
                      fill={hexToRgba(nak.color, fillOpacity)}
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                    />

                    {isBirth && (
                      <Path
                        d={mainPath}
                        fill="none"
                        stroke={nak.color}
                        strokeWidth={12}
                        opacity={0.15}
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
        </View>

        {/* Center Overlay */}
        <View style={styles.centerOverlay} pointerEvents="none">
          <Animated.Text style={[styles.moonGlyph, { opacity: pulseMoon }]}>☽</Animated.Text>
          <Text style={styles.centerNakName} numberOfLines={2}>{chart.nakshatra}</Text>
          <Text style={styles.centerPada}>PADA {chart.nakshatraPada}</Text>
          <Text style={styles.centerRashi}>Moon in {chart.moonRashi}</Text>
        </View>

      </View>

      {/* Glass Pill */}
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
                  Lord:{' '}
                  <Text style={{ color: selectedNak.color }}>{selectedNak.lord}</Text>
                  {'  ·  '}{selectedNak.type}
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
    pointerEvents: 'none',
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
