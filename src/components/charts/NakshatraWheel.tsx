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
const SIZE      = Math.min(width - 40, 340);
const SVG_PAD   = 40;
const SVG_SIZE  = SIZE + SVG_PAD * 2;
const CX        = SVG_SIZE / 2;
const CY        = SVG_SIZE / 2;
const OUTER_R   = SIZE * 0.44;
const INNER_R   = SIZE * 0.295;
const COLOR_R   = SIZE * 0.21;
const CENTER_R  = SIZE * 0.115;
const KNOB_R    = 14;
const KNOB_DIST = OUTER_R + KNOB_R + 14;

const SPAN       = 360 / 27;
const DEG_TO_RAD = Math.PI / 180;

// ─── Data ─────────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ── KEY FIX: use locationX/Y (View-relative) not pageX/Y ──────────────────────
// locationX/Y origin = top-left of the pan-responder View = top-left of the SVG
// So SVG center is always at (CX, CY) in location space. No stored px/py needed.

function locToAngle(locX: number, locY: number): number {
  const dx = locX - CX;
  const dy = locY - CY;
  let a = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  if (a < 0) a += 360;
  return a;
}

function computeNakIdx(armDeg: number, wheelDeg: number): number {
  const dataAngle = ((armDeg - wheelDeg) % 360 + 360) % 360;
  return Math.floor(dataAngle / SPAN) % 27;
}

// Hit test: rotate touch into arm-local space and check knob + needle
function hitTestKnob(locX: number, locY: number, armDeg: number): boolean {
  const lx = locX - CX;
  const ly = locY - CY;
  // armDeg is SVG angle (0=up, CW). Convert to standard math for rotation matrix.
  // To rotate point BACK by armDeg: use -(armDeg) in SVG space = -(armDeg-90) in math = (90-armDeg)
  const rad = (armDeg - 90) * DEG_TO_RAD; // SVG angle → math angle
  // Rotate touch by -rad (un-rotate by arm angle)
  const rotX =  lx * Math.cos(-rad) - ly * Math.sin(-rad);
  const rotY =  lx * Math.sin(-rad) + ly * Math.cos(-rad);
  // In arm-local space: knob is straight UP at (0, -KNOB_DIST)
  // rotX should be ~0, rotY should be ~-KNOB_DIST when touching knob
  const distKnob = Math.sqrt(rotX * rotX + (rotY + KNOB_DIST) * (rotY + KNOB_DIST));
  // Needle: thin strip at x≈0, from -OUTER_R upward to -KNOB_DIST
  const onNeedle = Math.abs(rotX) < 22
    && rotY < -(OUTER_R - 20)
    && rotY > -(KNOB_DIST + KNOB_R + 14);
  return distKnob < KNOB_R + 26 || onNeedle;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Pre-compute static paths once
const STATIC_PATHS = NAKSHATRAS.map((_, i) => ({
  colorPath: makeArcPath(CX, CY, CENTER_R + 5, COLOR_R, i * SPAN, i * SPAN + SPAN - 0.5),
  mainPath:  makeArcPath(CX, CY, INNER_R, OUTER_R, i * SPAN, i * SPAN + SPAN - 0.5),
  midRad:    ((i * SPAN + SPAN / 2) - 90) * DEG_TO_RAD,
  midAngle:  i * SPAN + SPAN / 2,
}));

// ─── Component ────────────────────────────────────────────────────────────────
export function NakshatraWheel({
  chart,
  onOpenOracle,
}: {
  chart: VedicChart;
  onOpenOracle: (nak: any) => void;
}) {
  const birthNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra);

  const initWheelRot = birthNakIdx >= 0
    ? (-(birthNakIdx * SPAN + SPAN / 2) + 360) % 360
    : 0;

  // ── Refs for drag (never trigger re-render mid-drag) ──────────────────────
  const wheelRotRef      = useRef(initWheelRot);
  const armAngleRef      = useRef(0);          // 0 = top, pointing at birth nak
  const dragModeRef      = useRef<'none' | 'arm' | 'wheel'>('none');
  const dragStartRef     = useRef(0);          // angle when finger first touched
  const dragBaseWheelRef = useRef(initWheelRot);
  const dragBaseArmRef   = useRef(0);
  const rafRef           = useRef<number | null>(null);
  const velRef           = useRef(0);
  const lastAngleRef     = useRef(0);
  const lastTimeRef      = useRef(0);
  const momentumRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── State (only for re-rendering SVG) ────────────────────────────────────
  const [wheelRot,  setWheelRot]  = useState(initWheelRot);
  const [armAngle,  setArmAngle]  = useState(0);
  const [armNakIdx, setArmNakIdx] = useState(birthNakIdx >= 0 ? birthNakIdx : 0);

  // ── Animations ────────────────────────────────────────────────────────────
  const spinAnim        = useRef(new Animated.Value(0)).current;
  const pulseAnim       = useRef(new Animated.Value(0)).current;
  const mountTranslateY = useRef(new Animated.Value(20)).current;

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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (momentumRef.current) clearInterval(momentumRef.current);
    };
  }, []);

  const flushState = useCallback(() => {
    setWheelRot(wheelRotRef.current);
    setArmAngle(armAngleRef.current);
    setArmNakIdx(computeNakIdx(armAngleRef.current, wheelRotRef.current));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushState();
    });
  }, [flushState]);

  const stopMomentum = useCallback(() => {
    if (momentumRef.current) { clearInterval(momentumRef.current); momentumRef.current = null; }
  }, []);

  // ── PanResponder ─────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        stopMomentum();
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

        // ✅ USE locationX/Y — perfectly relative to this View, no measurement needed
        const { locationX, locationY } = e.nativeEvent;
        const angle = locToAngle(locationX, locationY);

        dragStartRef.current  = angle;
        lastAngleRef.current  = angle;
        lastTimeRef.current   = Date.now();
        velRef.current        = 0;

        if (hitTestKnob(locationX, locationY, armAngleRef.current)) {
          dragModeRef.current    = 'arm';
          dragBaseArmRef.current = armAngleRef.current;
        } else {
          dragModeRef.current      = 'wheel';
          dragBaseWheelRef.current = wheelRotRef.current;
        }
      },

      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const angle = locToAngle(locationX, locationY);

        let delta = angle - dragStartRef.current;
        if (delta >  180) delta -= 360;
        if (delta < -180) delta += 360;

        // Track velocity for momentum
        const now = Date.now();
        const dt  = now - lastTimeRef.current;
        if (dt > 0) {
          let dA = angle - lastAngleRef.current;
          if (dA >  180) dA -= 360;
          if (dA < -180) dA += 360;
          velRef.current = velRef.current * 0.55 + (dA / dt) * 0.45;
        }
        lastAngleRef.current = angle;
        lastTimeRef.current  = now;

        if (dragModeRef.current === 'arm') {
          // Arm rotates independently — wheel stays fixed
          armAngleRef.current = ((dragBaseArmRef.current + delta) % 360 + 360) % 360;
        } else if (dragModeRef.current === 'wheel') {
          // Wheel rotates — arm stays fixed in screen space
          wheelRotRef.current = ((dragBaseWheelRef.current + delta) % 360 + 360) % 360;
        }

        scheduleFlush();
      },

      onPanResponderRelease: (e, gs) => {
        const totalMove = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);

        if (dragModeRef.current === 'arm') {
          // Snap arm to nearest nak center
          const idx = computeNakIdx(armAngleRef.current, wheelRotRef.current);
          const snapAngle = ((idx * SPAN + SPAN / 2 + wheelRotRef.current) % 360 + 360) % 360;
          armAngleRef.current = snapAngle;
          flushState();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          // Open oracle for the nak the arm is pointing at
          onOpenOracle(NAKSHATRAS[idx]);

        } else if (dragModeRef.current === 'wheel') {
          if (totalMove < 10) {
            // Tap on a segment → snap that nak to pointer
            const { locationX, locationY } = e.nativeEvent;
            const lx   = locationX - CX;
            const ly   = locationY - CY;
            const dist = Math.sqrt(lx * lx + ly * ly);
            if (dist >= INNER_R - 14 && dist <= OUTER_R + 14) {
              let rawAngle = Math.atan2(ly, lx) * (180 / Math.PI) + 90;
              if (rawAngle < 0) rawAngle += 360;
              const dataAngle = ((rawAngle - wheelRotRef.current) % 360 + 360) % 360;
              const idx = Math.floor(dataAngle / SPAN) % 27;
              const newRot  = ((-(idx * SPAN + SPAN / 2)) % 360 + 360) % 360;
              wheelRotRef.current = newRot;
              // Keep arm pointing at same nak (arm follows the segment visually)
              const snapArm = ((idx * SPAN + SPAN / 2 + newRot) % 360 + 360) % 360;
              armAngleRef.current = snapArm;
              flushState();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
          } else {
            // Momentum flick
            const vel = velRef.current;
            if (Math.abs(vel) > 0.04) {
              let v = vel;
              const FRICTION = 0.91;
              momentumRef.current = setInterval(() => {
                v *= FRICTION;
                wheelRotRef.current = ((wheelRotRef.current + v * 16) % 360 + 360) % 360;
                flushState();
                if (Math.abs(v) < 0.008) {
                  stopMomentum();
                  // Snap nearest nak to pointer
                  const pointerData = ((-wheelRotRef.current) % 360 + 360) % 360;
                  const idx = Math.floor(pointerData / SPAN) % 27;
                  const newRot = ((-(idx * SPAN + SPAN / 2)) % 360 + 360) % 360;
                  wheelRotRef.current = newRot;
                  const snapArm = ((idx * SPAN + SPAN / 2 + newRot) % 360 + 360) % 360;
                  armAngleRef.current = snapArm;
                  flushState();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }, 16) as any;
            } else {
              flushState();
            }
          }
        }

        dragModeRef.current = 'none';
      },

      onPanResponderTerminate: () => {
        dragModeRef.current = 'none';
        stopMomentum();
      },
    })
  ).current;

  // ── Derived ───────────────────────────────────────────────────────────────
  const opacityInterp = spinAnim.interpolate({
    inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const pulseOuter = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.22] });
  const pulseMoon  = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.0] });

  const activeNak  = NAKSHATRAS[armNakIdx] ?? NAKSHATRAS[0];
  const PTR_TIP_Y  = CY - OUTER_R + 4;
  const PTR_BASE_Y = CY - OUTER_R - 14;
  const PTR_HALF   = 6;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={{ transform: [{ translateY: mountTranslateY }] }}>

      {/* Active nak label above wheel */}
      <View style={styles.activeLabel} pointerEvents="none">
        <Text style={[styles.activeLabelName, { color: activeNak.color }]}>
          {activeNak.name.toUpperCase()}
        </Text>
        <Text style={styles.activeLabelSub}>{activeNak.lord}</Text>
      </View>

      <View style={styles.wrapper}>
        {/* ── Touch receiver: must be same size as SVG so locationX/Y = SVG coords ── */}
        <View
          {...panResponder.panHandlers}
          style={{ width: SVG_SIZE, height: SVG_SIZE }}
        >
          <Animated.View style={{ opacity: opacityInterp }}>
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

              {/* Background disc */}
              <Circle cx={CX} cy={CY} r={OUTER_R + 2} fill="url(#bg)" />

              {/* ══ ROTATING WHEEL ══ */}
              <G rotation={wheelRot} origin={`${CX},${CY}`}>
                {NAKSHATRAS.map((nak, i) => (
                  <Path
                    key={`c${i}`}
                    d={STATIC_PATHS[i].colorPath}
                    fill={hexToRgba(nak.color, 0.50)}
                    stroke={hexToRgba(nak.color, 0.12)}
                    strokeWidth={0.5}
                  />
                ))}
                <Circle cx={CX} cy={CY} r={COLOR_R} fill="none" stroke="rgba(201,168,76,0.14)" strokeWidth={0.8} />
                <Circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke="rgba(201,168,76,0.10)" strokeWidth={0.8} />

                {NAKSHATRAS.map((nak, i) => {
                  const { mainPath, midRad, midAngle } = STATIC_PATHS[i];
                  const isBirth = i === birthNakIdx;
                  const isArm   = i === armNakIdx;

                  let fillAlpha   = 0.30;
                  let strokeColor = hexToRgba(nak.color, 0.18);
                  let strokeW     = 0.8;
                  if (isArm)        { fillAlpha = 0.90; strokeColor = '#E8D97A'; strokeW = 2.5; }
                  else if (isBirth) { fillAlpha = 0.78; strokeColor = '#2FBEBE'; strokeW = 2.2; }

                  const labelR    = (INNER_R + OUTER_R) / 2;
                  const labelX    = CX + labelR * Math.cos(midRad);
                  const labelY    = CY + labelR * Math.sin(midRad);
                  const labelRot  = midAngle > 180 ? midAngle + 180 : midAngle;
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
                          isArm   ? 'rgba(235,220,110,1.0)' :
                          isBirth ? 'rgba(47,190,190,1.0)'  :
                                    'rgba(255,255,255,0.60)'
                        }
                        fontSize="5.6"
                        fontFamily="Orbitron_400Regular"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {shortName}
                      </SvgText>
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

              {/* ── ARM + KNOB: at root level, fully independent of wheel ── */}
              <G rotation={armAngle} origin={`${CX},${CY}`}>
                {/* Dashed line: center → ring edge */}
                <Line
                  x1={CX} y1={CY - CENTER_R - 6}
                  x2={CX} y2={CY - OUTER_R + 4}
                  stroke="rgba(201,168,76,0.60)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
                {/* Solid needle: ring edge → knob */}
                <Line
                  x1={CX} y1={CY - OUTER_R + 2}
                  x2={CX} y2={CY - KNOB_DIST + KNOB_R + 3}
                  stroke="#C9A84C"
                  strokeWidth={3}
                />
                {/* Knob outer glow */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={KNOB_R + 10}
                  fill="rgba(201,168,76,0.08)" stroke="rgba(201,168,76,0.18)" strokeWidth={1} />
                {/* Knob body */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={KNOB_R}
                  fill="rgba(8,3,20,0.97)" stroke="#C9A84C" strokeWidth={2.5} />
                {/* Knob inner ring */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={KNOB_R - 5}
                  fill="none" stroke="rgba(201,168,76,0.38)" strokeWidth={1} />
                {/* Knob center dot */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={4}
                  fill="#C9A84C" opacity={0.95} />
                {/* Arrow tip (points inward toward ring) */}
                <Polygon
                  points={`${CX},${CY - KNOB_DIST - KNOB_R - 9} ${CX - 6},${CY - KNOB_DIST - KNOB_R + 5} ${CX + 6},${CY - KNOB_DIST - KNOB_R + 5}`}
                  fill="#C9A84C" opacity={0.90}
                />
              </G>

              {/* Pulse ring */}
              {birthNakIdx >= 0 && (
                <AnimatedCircle
                  cx={CX} cy={CY} r={OUTER_R + 14}
                  fill="none" stroke="#2FBEBE"
                  strokeWidth={1.5} opacity={pulseOuter}
                />
              )}

              {/* Fixed pointer at top */}
              <Polygon
                points={`${CX},${PTR_TIP_Y} ${CX - PTR_HALF},${PTR_BASE_Y} ${CX + PTR_HALF},${PTR_BASE_Y}`}
                fill="#C9A84C" opacity={0.95}
              />

              {/* Center disc */}
              <Circle cx={CX} cy={CY} r={CENTER_R + 5} fill="url(#cg)" stroke="#C9A84C" strokeWidth={1} />
            </Svg>
          </Animated.View>
        </View>

        {/* Center text overlay */}
        <View style={styles.centerOverlay} pointerEvents="none">
          <Animated.Text style={[styles.moonGlyph, { opacity: pulseMoon }]}>☽</Animated.Text>
          <Text style={styles.centerNakName} numberOfLines={2}>{chart.nakshatra}</Text>
          <Text style={styles.centerPada}>PADA {chart.nakshatraPada}</Text>
          <Text style={styles.centerRashi}>Moon in {chart.moonRashi}</Text>
        </View>
      </View>

      {/* Bottom pill */}
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
    width:  (CENTER_R + 5) * 2,
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
