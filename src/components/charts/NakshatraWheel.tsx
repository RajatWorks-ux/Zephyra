import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  Animated, Easing, TouchableOpacity, PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, {
  Path, Circle, Defs, RadialGradient, LinearGradient,
  Stop, G, Text as SvgText, Line,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';
import type { VedicChart } from '../../types';

// ─── Layout constants ────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');
const SIZE      = Math.min(width - 40, 340);
const CX        = SIZE / 2;
const CY        = SIZE / 2;
const OUTER_R   = SIZE * 0.46;          // outer edge of main ring
const LABEL_R   = SIZE * 0.415;         // mid of label ring (inside OUTER_R)
const INNER_R   = SIZE * 0.305;         // inner edge of main ring
const COLOR_R   = SIZE * 0.22;          // outer edge of inner color ring
const CENTER_R  = SIZE * 0.12;          // center disc
const KNOB_R    = 9;                    // radius of the draggable knob
const STICK_LEN = OUTER_R + KNOB_R + 2;// stick from center to knob edge

const SPAN      = 360 / 27;
const DEG_TO_RAD = Math.PI / 180;

// ─── Data ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

// Given a raw angle (degrees, 0 = top/12-o'clock, clockwise), return nakshatra index
// accounting for wheel rotation offset
function nakIdxAtAngle(angleDeg: number, wheelRotDeg: number): number {
  // The wheel is rotated by wheelRotDeg. So the nakshatra that appears at
  // angleDeg on screen is the one at (angleDeg - wheelRotDeg) in data space.
  let dataAngle = ((angleDeg - wheelRotDeg) % 360 + 360) % 360;
  return Math.floor(dataAngle / SPAN) % 27;
}

// Convert page (x,y) → angle from center in degrees (0 = top, clockwise)
function pageToAngle(pageX: number, pageY: number, svgPx: number, svgPy: number): number {
  const dx = pageX - svgPx - CX;
  const dy = pageY - svgPy - CY;
  let a = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (a < 0) a += 360;
  return a;
}

// ─── AnimatedCircle wrapper ───────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Component ───────────────────────────────────────────────────────────────
export function NakshatraWheel({
  chart,
  onOpenOracle,
}: {
  chart: VedicChart;
  onOpenOracle: (nak: any) => void;
}) {
  const birthNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra);
  const birthColor  = NAKSHATRAS[Math.max(0, birthNakIdx)]?.color ?? '#C9A84C';

  // ── state ────────────────────────────────────────────────────────────────
  // Index tapped directly on the ring (shows info pill)
  const [selectedIdx, setSelectedIdx]   = useState<number | null>(null);
  const selectedIdxRef                  = useRef<number | null>(null);

  // Wheel drag rotation (degrees, accumulated)
  const [wheelRot, setWheelRot]         = useState(0);
  const wheelRotRef                     = useRef(0);

  // Oracle arm angle (degrees, 0=top, clockwise) — starts pointing at birth nak
  const birthArmAngle = birthNakIdx >= 0
    ? birthNakIdx * SPAN + SPAN / 2   // center of birth nakshatra
    : 0;
  const [armAngle, setArmAngle]         = useState(birthArmAngle);
  const armAngleRef                     = useRef(birthArmAngle);

  // The nakshatra currently pointed at by the arm (taking wheel rotation into account)
  const armNakIdx = nakIdxAtAngle(armAngle, wheelRot);
  const armNak    = NAKSHATRAS[armNakIdx];

  // Are we dragging the arm vs dragging the wheel?
  const dragModeRef = useRef<'none' | 'arm' | 'wheel'>('none');
  const dragStartAngleRef = useRef(0);   // angle at drag start
  const dragStartWheelRef = useRef(0);   // wheelRot at wheel-drag start
  const dragStartArmRef   = useRef(0);   // armAngle at arm-drag start

  // ── animation values ─────────────────────────────────────────────────────
  const spinAnim        = useRef(new Animated.Value(0)).current;
  const pulseAnim       = useRef(new Animated.Value(0)).current;
  const wheelScaleAnim  = useRef(new Animated.Value(1)).current;
  const pillOpacity     = useRef(new Animated.Value(0)).current;
  const mountTranslateY = useRef(new Animated.Value(20)).current;

  const svgLayoutRef = useRef<{ px: number; py: number }>({ px: 0, py: 0 });

  // ── mount animations ─────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(mountTranslateY, {
      toValue: 0, duration: 600,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    Animated.timing(spinAnim, {
      toValue: 1, duration: 1400,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── ring tap ─────────────────────────────────────────────────────────────
  const handleSegmentTap = useCallback((idx: number) => {
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
  }, []);

  // ── determine what is at a point (for hit-testing) ───────────────────────
  function hitTestPoint(pageX: number, pageY: number): 'arm-knob' | 'ring' | 'none' {
    const localX = pageX - svgLayoutRef.current.px;
    const localY = pageY - svgLayoutRef.current.py;
    const dx = localX - CX;
    const dy = localY - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Knob center in SVG coords
    const knobAngleRad = (armAngleRef.current - 90) * DEG_TO_RAD;
    const kx = CX + STICK_LEN * Math.cos(knobAngleRad);
    const ky = CY + STICK_LEN * Math.sin(knobAngleRad);
    const dkx = localX - kx;
    const dky = localY - ky;
    const distKnob = Math.sqrt(dkx * dkx + dky * dky);

    if (distKnob < KNOB_R + 14) return 'arm-knob'; // generous hit area
    if (dist >= INNER_R && dist <= OUTER_R) return 'ring';
    return 'none';
  }

  // ── unified PanResponder ─────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const hit = hitTestPoint(pageX, pageY);
        const currentAngle = pageToAngle(pageX, pageY, svgLayoutRef.current.px, svgLayoutRef.current.py);
        dragStartAngleRef.current = currentAngle;

        if (hit === 'arm-knob') {
          dragModeRef.current = 'arm';
          dragStartArmRef.current = armAngleRef.current;
        } else {
          dragModeRef.current = 'wheel';
          dragStartWheelRef.current = wheelRotRef.current;
        }
      },

      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const currentAngle = pageToAngle(pageX, pageY, svgLayoutRef.current.px, svgLayoutRef.current.py);
        let delta = currentAngle - dragStartAngleRef.current;
        // Wrap delta to [-180, 180] to handle 0/360 crossings
        if (delta > 180)  delta -= 360;
        if (delta < -180) delta += 360;

        if (dragModeRef.current === 'arm') {
          const newAngle = ((dragStartArmRef.current + delta) % 360 + 360) % 360;
          armAngleRef.current = newAngle;
          setArmAngle(newAngle);
        } else if (dragModeRef.current === 'wheel') {
          const newRot = ((dragStartWheelRef.current + delta) % 360 + 360) % 360;
          wheelRotRef.current = newRot;
          setWheelRot(newRot);
        }
      },

      onPanResponderRelease: (e, gs) => {
        const { pageX, pageY } = e.nativeEvent;
        const totalMove = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);

        if (dragModeRef.current === 'arm') {
          // Snap arm to center of nearest nakshatra
          const idx = nakIdxAtAngle(armAngleRef.current, wheelRotRef.current);
          // The arm angle in screen space should point to center of that nakshatra
          const snapAngle = ((idx * SPAN + SPAN / 2 + wheelRotRef.current) % 360 + 360) % 360;
          armAngleRef.current = snapAngle;
          setArmAngle(snapAngle);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Open oracle for the nakshatra the arm is pointing at
          const nak = NAKSHATRAS[idx];
          onOpenOracle(nak);
        } else if (dragModeRef.current === 'wheel' && totalMove < 8) {
          // It was a tap on the ring
          const localX = pageX - svgLayoutRef.current.px;
          const localY = pageY - svgLayoutRef.current.py;
          const dx = localX - CX;
          const dy = localY - CY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= INNER_R && dist <= OUTER_R) {
            let rawAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
            if (rawAngle < 0) rawAngle += 360;
            const dataAngle = ((rawAngle - wheelRotRef.current) % 360 + 360) % 360;
            const idx = Math.floor(dataAngle / SPAN) % 27;
            handleSegmentTap(idx);
          }
        }
        dragModeRef.current = 'none';
      },

      onPanResponderTerminate: () => {
        dragModeRef.current = 'none';
      },
    })
  ).current;

  // ── derived anim values ───────────────────────────────────────────────────
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1], outputRange: ['-360deg', '0deg'],
  });
  const opacityInterpolate = spinAnim.interpolate({
    inputRange: [0, 0.28], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const pulseOuterRing = pulseAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.06, 0.20],
  });
  const pulseMoon = pulseAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.6, 1.0],
  });

  const selectedNak = selectedIdx !== null ? NAKSHATRAS[selectedIdx] : null;

  // Knob position for the arm
  const knobAngleRad = (armAngle - 90) * DEG_TO_RAD;
  const knobX = CX + STICK_LEN * Math.cos(knobAngleRad);
  const knobY = CY + STICK_LEN * Math.sin(knobAngleRad);

  // Fixed top pointer triangle tip coords (points inward from top)
  const PTR_TIP_Y  = CY - OUTER_R - 6;
  const PTR_BASE_Y = CY - OUTER_R - 18;
  const PTR_HALF   = 5;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={{ transform: [{ translateY: mountTranslateY }] }}>
      <View style={styles.wrapper}>

        <View
          {...panResponder.panHandlers}
          onLayout={(e) => {
            e.target.measure((_x, _y, _w, _h, px, py) => {
              svgLayoutRef.current = { px, py };
            });
          }}
        >
          {/* ── SVG canvas: SIZE + padding for arm knob ── */}
          <Animated.View
            style={{
              opacity: opacityInterpolate,
              transform: [{ scale: wheelScaleAnim }],
            }}
          >
            <Svg width={SIZE} height={SIZE} overflow="visible">
              <Defs>
                <RadialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor="rgba(60,30,110,0.98)" />
                  <Stop offset="100%" stopColor="rgba(8,4,22,0.99)" />
                </RadialGradient>
                <RadialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor="rgba(20,10,45,0.97)" />
                  <Stop offset="100%" stopColor="rgba(4,2,12,0.99)" />
                </RadialGradient>
                <LinearGradient id="stickGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%"   stopColor="rgba(201,168,76,0.0)" />
                  <Stop offset="100%" stopColor="rgba(201,168,76,0.9)" />
                </LinearGradient>
              </Defs>

              {/* ── Background disc ── */}
              <Circle cx={CX} cy={CY} r={OUTER_R + 3} fill="url(#bgGrad)" />

              {/* ══ ROTATABLE WHEEL GROUP ══ */}
              <G rotation={wheelRot} origin={`${CX},${CY}`}>

                {/* ── Inner color ring (CENTER_R → COLOR_R) ── */}
                {NAKSHATRAS.map((nak, i) => (
                  <Path
                    key={`color-${i}`}
                    d={makeArcPath(CX, CY, CENTER_R + 6, COLOR_R, i * SPAN, i * SPAN + SPAN - 0.4)}
                    fill={hexToRgba(nak.color, 0.45)}
                    stroke={hexToRgba(nak.color, 0.15)}
                    strokeWidth={0.5}
                  />
                ))}

                {/* ── Subtle divider between color ring and main ring ── */}
                <Circle cx={CX} cy={CY} r={COLOR_R + 1} fill="none"
                  stroke="rgba(201,168,76,0.12)" strokeWidth={1} />
                <Circle cx={CX} cy={CY} r={INNER_R - 1} fill="none"
                  stroke="rgba(201,168,76,0.08)" strokeWidth={0.8} />

                {/* ── Main ring segments (INNER_R → OUTER_R) ── */}
                {NAKSHATRAS.map((nak, i) => {
                  const startDeg   = i * SPAN;
                  const endDeg     = startDeg + SPAN - 0.5;
                  const midAngle   = startDeg + SPAN / 2;
                  const midRad     = (midAngle - 90) * DEG_TO_RAD;
                  const isBirth    = i === birthNakIdx;
                  // arm is pointing at this nak (in wheel-rotated data space)
                  const isArmNak   = i === armNakIdx;
                  const isSelected = i === selectedIdx;
                  const mainPath   = makeArcPath(CX, CY, INNER_R, OUTER_R, startDeg, endDeg);

                  let fillAlpha = 0.32;
                  let strokeColor = hexToRgba(nak.color, 0.18);
                  let strokeW = 0.8;

                  if (isArmNak)    { fillAlpha = 0.85; strokeColor = '#FF4444'; strokeW = 2.2; }
                  else if (isBirth)     { fillAlpha = 0.80; strokeColor = nak.color; strokeW = 2.0; }
                  else if (isSelected) { fillAlpha = 0.65; strokeColor = nak.color; strokeW = 1.5; }

                  // Label position: inside main ring, at mid-radius
                  const labelR   = (INNER_R + OUTER_R) / 2;
                  const labelX   = CX + labelR * Math.cos(midRad);
                  const labelY   = CY + labelR * Math.sin(midRad);
                  // Rotate label so text reads outward
                  const labelRot = midAngle > 180 ? midAngle + 180 : midAngle;

                  return (
                    <G key={nak.name}>
                      {/* Birth/arm glow halo */}
                      {(isBirth || isArmNak) && (
                        <Path
                          d={mainPath}
                          fill="none"
                          stroke={isArmNak ? '#FF4444' : nak.color}
                          strokeWidth={14}
                          opacity={isArmNak ? 0.22 : 0.14}
                        />
                      )}

                      {/* Main segment */}
                      <Path
                        d={mainPath}
                        fill={hexToRgba(isArmNak ? '#FF4444' : nak.color, fillAlpha)}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                      />

                      {/* Label inside the ring band */}
                      <SvgText
                        x={labelX}
                        y={labelY}
                        rotation={labelRot}
                        origin={`${labelX},${labelY}`}
                        fill={
                          isArmNak   ? 'rgba(255,100,100,0.95)' :
                          isBirth    ? hexToRgba(nak.color, 0.95) :
                          isSelected ? hexToRgba(nak.color, 0.85) :
                                       'rgba(255,255,255,0.55)'
                        }
                        fontSize={i < 9 ? '5.8' : '5.2'}
                        fontFamily="Orbitron_400Regular"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {nak.name.length > 7
                          ? nak.name.substring(0, 5).toUpperCase()
                          : nak.name.substring(0, 6).toUpperCase()}
                      </SvgText>

                      {/* Lord dot at inner edge */}
                      <Circle
                        cx={CX + (COLOR_R + 5) * Math.cos(midRad)}
                        cy={CY + (COLOR_R + 5) * Math.sin(midRad)}
                        r={2.2}
                        fill={hexToRgba(nak.color, isArmNak || isBirth ? 0.9 : 0.5)}
                      />
                    </G>
                  );
                })}

                {/* ── Outer ring border ── */}
                <Circle cx={CX} cy={CY} r={OUTER_R} fill="none"
                  stroke="rgba(201,168,76,0.20)" strokeWidth={1} />

              </G>
              {/* ══ END ROTATABLE GROUP ══ */}

              {/* ── Fixed outer pulse ring (not rotating) ── */}
              {birthNakIdx >= 0 && (
                <AnimatedCircle
                  cx={CX} cy={CY} r={OUTER_R + 16}
                  fill="none" stroke={birthColor}
                  strokeWidth={1.5} opacity={pulseOuterRing}
                />
              )}

              {/* ── Fixed top pointer (arrow pointing inward at 12 o'clock) ── */}
              <Path
                d={`M ${CX} ${PTR_TIP_Y} L ${CX - PTR_HALF} ${PTR_BASE_Y} L ${CX + PTR_HALF} ${PTR_BASE_Y} Z`}
                fill="#C9A84C"
                opacity={0.9}
              />
              {/* Small indicator line */}
              <Line
                x1={CX} y1={PTR_BASE_Y}
                x2={CX} y2={CY - OUTER_R - 1}
                stroke="#C9A84C" strokeWidth={1} opacity={0.4}
              />

              {/* ── Oracle arm: stick + knob ── */}
              {/* Stick from center to knob */}
              <Line
                x1={CX} y1={CY}
                x2={knobX} y2={knobY}
                stroke="rgba(201,168,76,0.7)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              {/* Knob outer glow */}
              <Circle
                cx={knobX} cy={knobY} r={KNOB_R + 5}
                fill="rgba(201,168,76,0.08)"
                stroke="rgba(201,168,76,0.15)" strokeWidth={1}
              />
              {/* Knob body */}
              <Circle
                cx={knobX} cy={knobY} r={KNOB_R}
                fill="rgba(20,10,40,0.95)"
                stroke="#C9A84C" strokeWidth={1.8}
              />
              {/* Knob inner dot */}
              <Circle
                cx={knobX} cy={knobY} r={3}
                fill="#C9A84C" opacity={0.9}
              />

              {/* ── Center disc ── */}
              <Circle
                cx={CX} cy={CY} r={CENTER_R + 6}
                fill="url(#centerGrad)"
                stroke="#C9A84C" strokeWidth={1}
                opacity={0.9}
              />
              <Circle
                cx={CX} cy={CY} r={CENTER_R + 6}
                fill="none"
                stroke="rgba(201,168,76,0.35)" strokeWidth={0.5}
              />

            </Svg>
          </Animated.View>

          {/* ── Entrance spin overlay (separate so it doesn't affect arm) ── */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: spinAnim.interpolate({
                  inputRange: [0.85, 1], outputRange: [1, 0], extrapolate: 'clamp',
                }),
              },
            ]}
          />
        </View>

        {/* ── Center text overlay ── */}
        <View style={styles.centerOverlay} pointerEvents="none">
          <Animated.Text style={[styles.moonGlyph, { opacity: pulseMoon }]}>☽</Animated.Text>
          <Text style={styles.centerNakName} numberOfLines={2}>{chart.nakshatra}</Text>
          <Text style={styles.centerPada}>PADA {chart.nakshatraPada}</Text>
          <Text style={styles.centerRashi}>Moon in {chart.moonRashi}</Text>
        </View>

        {/* ── Fixed label above pointer showing active nakshatra ── */}
        <View style={styles.pointerLabel} pointerEvents="none">
          <Text style={[styles.pointerLabelText, { color: armNak.color }]}>
            {armNak.name.toUpperCase()}
          </Text>
          <Text style={styles.pointerLabelSub}>{armNak.lord}</Text>
        </View>

      </View>

      {/* ── Info pill (segment tap) ── */}
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
                <Text style={styles.oracleBtnText}>COSMIC READING</Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        )}
      </Animated.View>

    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    height: SIZE + 60,         // extra room for knob + pointer above
  },
  centerOverlay: {
    position: 'absolute',
    top: 10,
    left: 0, right: 0,
    bottom: 0,
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
  // Label above the fixed top-pointer
  pointerLabel: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  pointerLabelText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 8,
    letterSpacing: 1.2,
  },
  pointerLabelSub: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 9,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  pillWrapper: {
    width: '92%',
    alignSelf: 'center',
    marginTop: 6,
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
