import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  Animated, Easing, PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, {
  Path, Circle, Defs, RadialGradient,
  Stop, G, Text as SvgText, Line, Polygon,
} from 'react-native-svg';
import { BlurView } from 'expo-blur';
import type { VedicChart } from '../../types';

// ─── Layout ──────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');
const SIZE     = Math.min(width - 40, 340);
const SVG_PAD  = 36;   // extra canvas on each side for the protruding knob
const SVG_SIZE = SIZE + SVG_PAD * 2;
const CX       = SVG_SIZE / 2;
const CY       = SVG_SIZE / 2;
const OUTER_R  = SIZE * 0.44;
const INNER_R  = SIZE * 0.295;
const COLOR_R  = SIZE * 0.21;
const CENTER_R = SIZE * 0.115;
const KNOB_R   = 13;
// Knob CENTER sits well outside OUTER_R so it protrudes from the wheel
const KNOB_DIST = OUTER_R + KNOB_R + 10;   // knob center is 10px outside ring edge

const SPAN       = 360 / 27;
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

// angle in degrees (0=top, cw) → nakshatra index in data space
// pointer is fixed at top (0°). Wheel rotates by wheelRot.
// So data angle under pointer = (0 - wheelRot) = -wheelRot
function nakAtPointer(wheelRotDeg: number): number {
  let dataAngle = ((-wheelRotDeg) % 360 + 360) % 360;
  return Math.floor(dataAngle / SPAN) % 27;
}

// Convert pageX/Y to angle from SVG center (0=top, cw, degrees)
function pageToAngle(pageX: number, pageY: number, px: number, py: number): number {
  const dx = pageX - px - CX;
  const dy = pageY - py - CY;
  let a = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (a < 0) a += 360;
  return a;
}

// Convert pageX/Y to local SVG coords
function pageToLocal(pageX: number, pageY: number, px: number, py: number) {
  return { x: pageX - px, y: pageY - py };
}

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

  // Wheel rotation: start so birth nak is at top (pointer)
  // pointer is at 0°, birth nak center is at birthNakIdx*SPAN + SPAN/2
  // we want that data angle to appear at 0° → wheelRot = -(birthNakIdx*SPAN + SPAN/2)
  const initWheelRot = birthNakIdx >= 0
    ? (-(birthNakIdx * SPAN + SPAN / 2) + 360) % 360
    : 0;

  const [wheelRot, setWheelRot] = useState(initWheelRot);
  const wheelRotRef             = useRef(initWheelRot);

  // Arm angle: starts at top (0°), pointing at birth nak
  const [armAngle, setArmAngle] = useState(0);
  const armAngleRef             = useRef(0);

  // nakshatra under the arm (arm is in screen space, same angle math as pointer but moveable)
  // arm points at screen angle armAngle; nakshatra there = nakAtPointer but with armAngle offset
  const armNakIdx = (() => {
    let dataAngle = ((armAngle - wheelRotRef.current) % 360 + 360) % 360;
    return Math.floor(dataAngle / SPAN) % 27;
  })();
  // also need reactive version
  const [armNakIdxState, setArmNakIdxState] = useState(birthNakIdx >= 0 ? birthNakIdx : 0);

  const dragModeRef           = useRef<'none' | 'arm' | 'wheel'>('none');
  const dragStartAngleRef     = useRef(0);
  const dragStartWheelRef     = useRef(initWheelRot);
  const dragStartArmRef       = useRef(0);

  // animations
  const spinAnim        = useRef(new Animated.Value(0)).current;
  const pulseAnim       = useRef(new Animated.Value(0)).current;
  const wheelScaleAnim  = useRef(new Animated.Value(1)).current;
  const mountTranslateY = useRef(new Animated.Value(20)).current;

  const svgLayoutRef = useRef<{ px: number; py: number }>({ px: 0, py: 0 });

  useEffect(() => {
    Animated.timing(mountTranslateY, {
      toValue: 0, duration: 600,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    Animated.timing(spinAnim, {
      toValue: 1, duration: 1400,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ])).start();
  }, []);

  // Recalculate arm nak index reactively
  const computeArmNak = useCallback((arm: number, wheel: number) => {
    let dataAngle = ((arm - wheel) % 360 + 360) % 360;
    return Math.floor(dataAngle / SPAN) % 27;
  }, []);

  // Hit-test: is touch on the knob?
  const isOnKnob = useCallback((pageX: number, pageY: number): boolean => {
    const { px, py } = svgLayoutRef.current;
    const local = pageToLocal(pageX, pageY, px, py);
    const rad = (armAngleRef.current - 90) * DEG_TO_RAD;
    const kx  = CX + KNOB_DIST * Math.cos(rad);
    const ky  = CY + KNOB_DIST * Math.sin(rad);
    const dist = Math.sqrt((local.x - kx) ** 2 + (local.y - ky) ** 2);
    return dist < KNOB_R + 18; // generous
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const angle = pageToAngle(pageX, pageY, svgLayoutRef.current.px, svgLayoutRef.current.py);
        dragStartAngleRef.current = angle;

        if (isOnKnob(pageX, pageY)) {
          dragModeRef.current     = 'arm';
          dragStartArmRef.current = armAngleRef.current;
        } else {
          dragModeRef.current       = 'wheel';
          dragStartWheelRef.current = wheelRotRef.current;
        }
      },

      onPanResponderMove: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        const { px, py } = svgLayoutRef.current;
        const angle = pageToAngle(pageX, pageY, px, py);
        let delta = angle - dragStartAngleRef.current;
        if (delta > 180)  delta -= 360;
        if (delta < -180) delta += 360;

        if (dragModeRef.current === 'arm') {
          const newArm = ((dragStartArmRef.current + delta) % 360 + 360) % 360;
          armAngleRef.current = newArm;
          setArmAngle(newArm);
          setArmNakIdxState(computeArmNak(newArm, wheelRotRef.current));
        } else if (dragModeRef.current === 'wheel') {
          const newRot = ((dragStartWheelRef.current + delta) % 360 + 360) % 360;
          wheelRotRef.current = newRot;
          setWheelRot(newRot);
          setArmNakIdxState(computeArmNak(armAngleRef.current, newRot));
        }
      },

      onPanResponderRelease: (_e, gs) => {
        const totalMove = Math.sqrt(gs.dx ** 2 + gs.dy ** 2);

        if (dragModeRef.current === 'arm') {
          // Snap arm to center of nearest nak in screen space
          const idx = computeArmNak(armAngleRef.current, wheelRotRef.current);
          // center of that nak in screen space = idx*SPAN + SPAN/2 + wheelRot
          const snapAngle = ((idx * SPAN + SPAN / 2 + wheelRotRef.current) % 360 + 360) % 360;
          armAngleRef.current = snapAngle;
          setArmAngle(snapAngle);
          setArmNakIdxState(idx);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onOpenOracle(NAKSHATRAS[idx]);

        } else if (dragModeRef.current === 'wheel' && totalMove < 10) {
          // tap on wheel → snap wheel so tapped nak aligns to pointer (top)
          const { pageX, pageY } = _e.nativeEvent;
          const { px, py } = svgLayoutRef.current;
          const local = pageToLocal(pageX, pageY, px, py);
          const dx = local.x - CX;
          const dy = local.y - CY;
          const dist = Math.sqrt(dx ** 2 + dy ** 2);
          if (dist >= INNER_R - 10 && dist <= OUTER_R + 10) {
            let rawAngle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
            if (rawAngle < 0) rawAngle += 360;
            const dataAngle = ((rawAngle - wheelRotRef.current) % 360 + 360) % 360;
            const idx = Math.floor(dataAngle / SPAN) % 27;
            // snap that nak to pointer
            const newRot = ((-(idx * SPAN + SPAN / 2)) % 360 + 360) % 360;
            wheelRotRef.current = newRot;
            setWheelRot(newRot);
            // snap arm too to stay at that same nak
            const snapArm = ((idx * SPAN + SPAN / 2 + newRot) % 360 + 360) % 360;
            armAngleRef.current = snapArm;
            setArmAngle(snapArm);
            setArmNakIdxState(idx);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
        dragModeRef.current = 'none';
      },

      onPanResponderTerminate: () => { dragModeRef.current = 'none'; },
    })
  ).current;

  // ── derived values ────────────────────────────────────────────────────────
  const opacityInterpolate = spinAnim.interpolate({
    inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const pulseOuter = pulseAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.05, 0.18],
  });
  const pulseMoon = pulseAnim.interpolate({
    inputRange: [0, 1], outputRange: [0.55, 1.0],
  });

  // Knob SVG position (inside wheel)
  const knobRad = (armAngle - 90) * DEG_TO_RAD;
  const knobX   = CX + KNOB_DIST * Math.cos(knobRad);
  const knobY   = CY + KNOB_DIST * Math.sin(knobRad);

  // Active nak = whichever the arm currently points at
  const activeNak = NAKSHATRAS[armNakIdxState] ?? NAKSHATRAS[0];

  // Pointer triangle (fixed at top, just outside ring)
  const PTR_TIP_Y  = CY - OUTER_R + 4;    // tip points INTO the ring slightly
  const PTR_BASE_Y = CY - OUTER_R - 14;
  const PTR_HALF   = 6;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={{ transform: [{ translateY: mountTranslateY }] }}>

      {/* ── Active nakshatra label (above wheel) ── */}
      <View style={styles.activeLabel} pointerEvents="none">
        <Text style={[styles.activeLabelName, { color: activeNak.color }]}>
          {activeNak.name.toUpperCase()}
        </Text>
        <Text style={styles.activeLabelSub}>{activeNak.lord}</Text>
      </View>

      <View style={styles.wrapper}>

        <View
          {...panResponder.panHandlers}
          onLayout={(e) => {
            e.target.measure((_x, _y, _w, _h, px, py) => {
              svgLayoutRef.current = { px, py };
            });
          }}
        >
          <Animated.View style={{ opacity: opacityInterpolate, transform: [{ scale: wheelScaleAnim }] }}>
            <Svg width={SVG_SIZE} height={SVG_SIZE}>
              <Defs>
                <RadialGradient id="cg" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor="rgba(55,25,105,1)" />
                  <Stop offset="100%" stopColor="rgba(6,3,18,1)" />
                </RadialGradient>
                <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor="rgba(18,8,40,0.98)" />
                  <Stop offset="100%" stopColor="rgba(3,1,10,0.99)" />
                </RadialGradient>
              </Defs>

              {/* Background */}
              <Circle cx={CX} cy={CY} r={OUTER_R + 2} fill="url(#bg)" />

              {/* ══ ROTATING WHEEL ══ */}
              <G rotation={wheelRot} origin={`${CX},${CY}`}>

                {/* Inner color ring */}
                {NAKSHATRAS.map((nak, i) => (
                  <Path
                    key={`c${i}`}
                    d={makeArcPath(CX, CY, CENTER_R + 5, COLOR_R, i * SPAN, i * SPAN + SPAN - 0.5)}
                    fill={hexToRgba(nak.color, 0.50)}
                    stroke={hexToRgba(nak.color, 0.12)}
                    strokeWidth={0.5}
                  />
                ))}

                <Circle cx={CX} cy={CY} r={COLOR_R}   fill="none" stroke="rgba(201,168,76,0.14)" strokeWidth={0.8} />
                <Circle cx={CX} cy={CY} r={INNER_R}   fill="none" stroke="rgba(201,168,76,0.10)" strokeWidth={0.8} />

                {/* Main ring segments */}
                {NAKSHATRAS.map((nak, i) => {
                  const startDeg = i * SPAN;
                  const endDeg   = startDeg + SPAN - 0.5;
                  const midAngle = startDeg + SPAN / 2;
                  const midRad   = (midAngle - 90) * DEG_TO_RAD;
                  const isBirth  = i === birthNakIdx;
                  const isArm    = i === armNakIdxState;
                  const mainPath = makeArcPath(CX, CY, INNER_R, OUTER_R, startDeg, endDeg);

                  let fillAlpha   = 0.30;
                  let strokeColor = hexToRgba(nak.color, 0.18);
                  let strokeW     = 0.8;
                  // arm nak → bright gold highlight (oracle selector)
                  // birth nak → teal/cyan glow (your moon nakshatra)
                  if (isArm)        { fillAlpha = 0.90; strokeColor = '#E8D97A'; strokeW = 2.5; }
                  else if (isBirth) { fillAlpha = 0.78; strokeColor = '#2FBEBE'; strokeW = 2.2; }

                  const labelR  = (INNER_R + OUTER_R) / 2;
                  const labelX  = CX + labelR * Math.cos(midRad);
                  const labelY  = CY + labelR * Math.sin(midRad);
                  const labelRot = midAngle > 180 ? midAngle + 180 : midAngle;

                  // Short label: max 5 chars
                  const shortName = nak.name.split(' ')[0].substring(0, 5).toUpperCase();

                  return (
                    <G key={nak.name}>
                      {isArm && (
                        <Path d={mainPath} fill="none" stroke="#E8D97A" strokeWidth={16} opacity={0.20} />
                      )}
                      {isBirth && !isArm && (
                        <Path d={mainPath} fill="none" stroke="#2FBEBE" strokeWidth={14} opacity={0.18} />
                      )}

                      <Path
                        d={mainPath}
                        fill={hexToRgba(isArm ? '#E8D97A' : nak.color, fillAlpha)}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                      />

                      <SvgText
                        x={labelX} y={labelY}
                        rotation={labelRot}
                        origin={`${labelX},${labelY}`}
                        fill={
                          isArm    ? 'rgba(235,220,110,1.0)' :
                          isBirth  ? 'rgba(47,190,190,1.0)' :
                                     'rgba(255,255,255,0.60)'
                        }
                        fontSize="5.6"
                        fontFamily="Orbitron_400Regular"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {shortName}
                      </SvgText>

                      {/* Lord dot on color ring boundary */}
                      <Circle
                        cx={CX + (COLOR_R + 4) * Math.cos(midRad)}
                        cy={CY + (COLOR_R + 4) * Math.sin(midRad)}
                        r={2}
                        fill={hexToRgba(nak.color, isArm || isBirth ? 1.0 : 0.55)}
                      />
                    </G>
                  );
                })}

                <Circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke="rgba(201,168,76,0.22)" strokeWidth={1} />
              </G>
              {/* ══ END ROTATING WHEEL ══ */}

              {/* ── Oracle arm: lives at SVG ROOT so rotation is pure screen-space ── */}
              {/* rotation={armAngle} with origin at center = always correct, no nesting math */}
              <G rotation={armAngle} origin={`${CX},${CY}`}>
                {/* Dashed stick from center to ring edge */}
                <Line
                  x1={CX} y1={CY - CENTER_R - 6}
                  x2={CX} y2={CY - OUTER_R + 2}
                  stroke="rgba(201,168,76,0.70)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
                {/* Solid needle from ring edge outward to knob */}
                <Line
                  x1={CX} y1={CY - OUTER_R + 2}
                  x2={CX} y2={CY - KNOB_DIST + KNOB_R + 2}
                  stroke="#C9A84C"
                  strokeWidth={2.5}
                />
                {/* Knob outer glow */}
                <Circle
                  cx={CX} cy={CY - KNOB_DIST}
                  r={KNOB_R + 9}
                  fill="rgba(201,168,76,0.09)"
                  stroke="rgba(201,168,76,0.25)"
                  strokeWidth={1}
                />
                {/* Knob body */}
                <Circle
                  cx={CX} cy={CY - KNOB_DIST}
                  r={KNOB_R}
                  fill="rgba(10,5,24,0.97)"
                  stroke="#C9A84C"
                  strokeWidth={2.5}
                />
                {/* Knob inner ring */}
                <Circle
                  cx={CX} cy={CY - KNOB_DIST}
                  r={KNOB_R - 4}
                  fill="none"
                  stroke="rgba(201,168,76,0.35)"
                  strokeWidth={1}
                />
                {/* Knob center dot */}
                <Circle
                  cx={CX} cy={CY - KNOB_DIST}
                  r={4}
                  fill="#C9A84C"
                  opacity={0.95}
                />
                {/* Arrow tip pointing toward ring */}
                <Polygon
                  points={`${CX},${CY - KNOB_DIST - KNOB_R - 7} ${CX - 5},${CY - KNOB_DIST - KNOB_R + 4} ${CX + 5},${CY - KNOB_DIST - KNOB_R + 4}`}
                  fill="#C9A84C"
                  opacity={0.85}
                />
              </G>

              {/* ── Pulse ring (fixed, teal = birth nak indicator) ── */}
              {birthNakIdx >= 0 && (
                <AnimatedCircle
                  cx={CX} cy={CY} r={OUTER_R + 14}
                  fill="none" stroke="#2FBEBE"
                  strokeWidth={1.5} opacity={pulseOuter}
                />
              )}

              {/* ── Fixed pointer at top ── */}
              <Polygon
                points={`${CX},${PTR_TIP_Y} ${CX - PTR_HALF},${PTR_BASE_Y} ${CX + PTR_HALF},${PTR_BASE_Y}`}
                fill="#C9A84C"
                opacity={0.95}
              />

              {/* ── Center disc (fixed, on top) ── */}
              <Circle cx={CX} cy={CY} r={CENTER_R + 5} fill="url(#cg)" stroke="#C9A84C" strokeWidth={1} />
            </Svg>
          </Animated.View>
        </View>

        {/* ── Center text overlay (strictly inside center disc) ── */}
        <View style={styles.centerOverlay} pointerEvents="none">
          <Animated.Text style={[styles.moonGlyph, { opacity: pulseMoon }]}>☽</Animated.Text>
          <Text style={styles.centerNakName} numberOfLines={2}>{chart.nakshatra}</Text>
          <Text style={styles.centerPada}>PADA {chart.nakshatraPada}</Text>
          <Text style={styles.centerRashi}>Moon in {chart.moonRashi}</Text>
        </View>

      </View>

      {/* ── Bottom pill: active nak info + oracle ── */}
      <BlurView intensity={18} tint="dark" style={styles.bottomPill}>
        <View style={styles.pillLeft}>
          <Text style={[styles.pillNakName, { color: activeNak.color }]}>{activeNak.name}</Text>
          <Text style={styles.pillDetails}>
            Lord: <Text style={{ color: activeNak.color }}>{activeNak.lord}</Text>
            {'  ·  '}{activeNak.type}
          </Text>
        </View>
        <View style={styles.pillHint}>
          <Text style={styles.pillHintText}>{'◉ DRAG\nKNOB'}</Text>
        </View>
      </BlurView>

    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  activeLabel: {
    alignItems: 'center',
    marginBottom: 4,
  },
  activeLabelName: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 11,
    letterSpacing: 2,
  },
  activeLabelSub: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
    marginTop: 1,
  },
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    // Strictly cover only the center disc area
    width: (CENTER_R + 5) * 2,
    height: (CENTER_R + 5) * 2,
    borderRadius: CENTER_R + 5,
    pointerEvents: 'none',
  },
  moonGlyph: {
    fontSize: 18,
    color: '#E8E8FF',
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowRadius: 6,
    marginBottom: 1,
  },
  centerNakName: {
    fontFamily: 'CinzelDecorative_400Regular',
    fontSize: 8,
    color: '#C9A84C',
    textAlign: 'center',
    maxWidth: CENTER_R * 1.6,
    lineHeight: 11,
  },
  centerPada: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 6,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 1,
    marginTop: 2,
  },
  centerRashi: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    fontSize: 8,
    color: 'rgba(232,232,255,0.45)',
    marginTop: 1,
  },
  bottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.20)',
    overflow: 'hidden',
  },
  pillLeft: { flex: 1 },
  pillNakName: {
    fontFamily: 'CinzelDecorative_400Regular',
    fontSize: 15,
    marginBottom: 3,
  },
  pillDetails: {
    fontFamily: 'CormorantGaramond_400Regular_Italic',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  pillHint: {
    marginLeft: 12,
    alignItems: 'center',
  },
  pillHintText: {
    fontFamily: 'Orbitron_400Regular',
    color: 'rgba(201,168,76,0.45)',
    fontSize: 7,
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 10,
  },
});
