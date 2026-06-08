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

// ─── Layout ───────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');
const SIZE      = Math.min(width - 40, 340);
const SVG_PAD   = 50;                          // extra space for knob outside ring
const SVG_SIZE  = SIZE + SVG_PAD * 2;
const CX        = SVG_SIZE / 2;
const CY        = SVG_SIZE / 2;
const OUTER_R   = SIZE * 0.44;
const INNER_R   = SIZE * 0.295;
const COLOR_R   = SIZE * 0.21;
const CENTER_R  = SIZE * 0.115;

// Knob — BIG so it's easy to grab
const KNOB_R    = 18;
const KNOB_DIST = OUTER_R + 28 + KNOB_R;      // knob center well outside ring

const SPAN        = 360 / 27;
const DEG_TO_RAD  = Math.PI / 180;

// ─── Nakshatra data ───────────────────────────────────────────────────────────
const NAKSHATRAS = [
  { name: 'Ashwini',           lord: 'Ketu',    color: '#8888AA', type: 'Deva'     },
  { name: 'Bharani',           lord: 'Venus',   color: '#FF80AA', type: 'Nara'     },
  { name: 'Krittika',          lord: 'Sun',     color: '#FF9500', type: 'Rakshasa' },
  { name: 'Rohini',            lord: 'Moon',    color: '#C0C8FF', type: 'Nara'     },
  { name: 'Mrigashira',        lord: 'Mars',    color: '#FF5555', type: 'Deva'     },
  { name: 'Ardra',             lord: 'Rahu',    color: '#7070AA', type: 'Nara'     },
  { name: 'Punarvasu',         lord: 'Jupiter', color: '#FFD700', type: 'Deva'     },
  { name: 'Pushya',            lord: 'Saturn',  color: '#6080B0', type: 'Deva'     },
  { name: 'Ashlesha',          lord: 'Mercury', color: '#44CC88', type: 'Rakshasa' },
  { name: 'Magha',             lord: 'Ketu',    color: '#9090BB', type: 'Rakshasa' },
  { name: 'Purva Phalguni',    lord: 'Venus',   color: '#FF90BB', type: 'Nara'     },
  { name: 'Uttara Phalguni',   lord: 'Sun',     color: '#FFA030', type: 'Nara'     },
  { name: 'Hasta',             lord: 'Moon',    color: '#B0B8FF', type: 'Deva'     },
  { name: 'Chitra',            lord: 'Mars',    color: '#FF4444', type: 'Rakshasa' },
  { name: 'Swati',             lord: 'Rahu',    color: '#8080BB', type: 'Deva'     },
  { name: 'Vishakha',          lord: 'Jupiter', color: '#FFD020', type: 'Rakshasa' },
  { name: 'Anuradha',          lord: 'Saturn',  color: '#5070A0', type: 'Deva'     },
  { name: 'Jyeshtha',          lord: 'Mercury', color: '#33BB77', type: 'Rakshasa' },
  { name: 'Mula',              lord: 'Ketu',    color: '#9898CC', type: 'Rakshasa' },
  { name: 'Purva Ashadha',     lord: 'Venus',   color: '#FF88BB', type: 'Nara'     },
  { name: 'Uttara Ashadha',    lord: 'Sun',     color: '#FFAA40', type: 'Nara'     },
  { name: 'Shravana',          lord: 'Moon',    color: '#A0B0FF', type: 'Deva'     },
  { name: 'Dhanishta',         lord: 'Mars',    color: '#FF3333', type: 'Rakshasa' },
  { name: 'Shatabhisha',       lord: 'Rahu',    color: '#6868AA', type: 'Rakshasa' },
  { name: 'Purva Bhadrapada',  lord: 'Jupiter', color: '#EEC600', type: 'Nara'     },
  { name: 'Uttara Bhadrapada', lord: 'Saturn',  color: '#4060A0', type: 'Nara'     },
  { name: 'Revati',            lord: 'Mercury', color: '#22AA66', type: 'Deva'     },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function makeArcPath(cx:number,cy:number,r1:number,r2:number,a0:number,a1:number) {
  const s = (a0-90)*DEG_TO_RAD, e = (a1-90)*DEG_TO_RAD;
  const lg = a1-a0>180?1:0;
  return [
    `M ${cx+r1*Math.cos(s)} ${cy+r1*Math.sin(s)}`,
    `A ${r1} ${r1} 0 ${lg} 1 ${cx+r1*Math.cos(e)} ${cy+r1*Math.sin(e)}`,
    `L ${cx+r2*Math.cos(e)} ${cy+r2*Math.sin(e)}`,
    `A ${r2} ${r2} 0 ${lg} 0 ${cx+r2*Math.cos(s)} ${cy+r2*Math.sin(s)}`,
    'Z',
  ].join(' ');
}

// Convert screen pageX/pageY → angle (0=top, clockwise)
function pageToAngle(pageX:number, pageY:number, originX:number, originY:number) {
  const dx = pageX - originX;
  const dy = pageY - originY;
  let a = Math.atan2(dy, dx) * (180/Math.PI) + 90;
  return ((a % 360) + 360) % 360;
}

function computeNakIdx(armDeg:number, wheelDeg:number) {
  return Math.floor((((armDeg - wheelDeg) % 360 + 360) % 360) / SPAN) % 27;
}

// ─── Hit-test knob with large grab zone ───────────────────────────────────────
// originX/Y = SVG center in screen coords
// armDeg    = current arm angle (SVG convention: 0=up, CW)
function hitTestKnob(pageX:number, pageY:number, originX:number, originY:number, armDeg:number) {
  // Where is the knob in screen space?
  const armMath = (armDeg - 90) * DEG_TO_RAD;   // SVG angle → math angle
  const knobScreenX = originX + KNOB_DIST * Math.cos(armMath);
  const knobScreenY = originY + KNOB_DIST * Math.sin(armMath);
  const dx = pageX - knobScreenX;
  const dy = pageY - knobScreenY;
  const distToKnob = Math.sqrt(dx*dx + dy*dy);

  // Also check the needle from OUTER_R to KNOB_DIST along the arm direction
  // Project touch onto the arm axis
  const ax = Math.cos(armMath), ay = Math.sin(armMath); // unit vector along arm
  const tx = pageX - originX,   ty = pageY - originY;
  const proj = tx*ax + ty*ay;                           // distance along arm
  const perp = Math.abs(tx*(-ay) + ty*ax);              // distance from arm axis
  const onNeedle = perp < 28 && proj > OUTER_R - 10 && proj < KNOB_DIST + KNOB_R + 10;

  return distToKnob < KNOB_R + 34 || onNeedle;
}

// ─── Pre-computed static arc paths ────────────────────────────────────────────
const STATIC_PATHS = NAKSHATRAS.map((_,i) => ({
  colorPath: makeArcPath(CX,CY,CENTER_R+5,COLOR_R, i*SPAN, i*SPAN+SPAN-0.5),
  mainPath:  makeArcPath(CX,CY,INNER_R,  OUTER_R,  i*SPAN, i*SPAN+SPAN-0.5),
  midRad:    ((i*SPAN + SPAN/2) - 90) * DEG_TO_RAD,
  midAngle:  i*SPAN + SPAN/2,
}));

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Component ────────────────────────────────────────────────────────────────
export function NakshatraWheel({
  chart,
  onOpenOracle,
}: {
  chart: VedicChart;
  onOpenOracle: (nak: any) => void;
}) {
  const birthNakIdx = NAKSHATRAS.findIndex(n => n.name === chart.nakshatra);
  const initWheel   = birthNakIdx >= 0
    ? (-(birthNakIdx*SPAN + SPAN/2) + 360) % 360
    : 0;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const wheelRef   = useRef(initWheel);
  const armRef     = useRef(0);                     // arm starts at top (0°)
  const modeRef    = useRef<'none'|'arm'|'wheel'>('none');
  const startRef   = useRef(0);                     // angle at touch start
  const baseWRef   = useRef(initWheel);
  const baseARef   = useRef(0);
  const rafRef     = useRef<number|null>(null);
  const velRef     = useRef(0);
  const lastARef   = useRef(0);
  const lastTRef   = useRef(0);
  const momentRef  = useRef<ReturnType<typeof setInterval>|null>(null);

  // SVG center in page/screen coordinates — set once on layout
  const originRef  = useRef({ x: 0, y: 0 });

  // ── State (triggers re-render) ─────────────────────────────────────────────
  const [wheelRot,  setWheelRot]  = useState(initWheel);
  const [armAngle,  setArmAngle]  = useState(0);
  const [armNakIdx, setArmNakIdx] = useState(birthNakIdx >= 0 ? birthNakIdx : 0);

  // ── Animations ────────────────────────────────────────────────────────────
  const spinAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.timing(slideAnim,{ toValue:0, duration:600, easing:Easing.out(Easing.cubic), useNativeDriver:true }).start();
    Animated.timing(spinAnim, { toValue:1, duration:1400,easing:Easing.out(Easing.cubic), useNativeDriver:true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim,{toValue:1,duration:1600,useNativeDriver:true}),
      Animated.timing(pulseAnim,{toValue:0,duration:1600,useNativeDriver:true}),
    ])).start();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (momentRef.current) clearInterval(momentRef.current);
    };
  }, []);

  const flush = useCallback(() => {
    setWheelRot(wheelRef.current);
    setArmAngle(armRef.current);
    setArmNakIdx(computeNakIdx(armRef.current, wheelRef.current));
  }, []);

  const scheduledFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; flush(); });
  }, [flush]);

  const stopMomentum = useCallback(() => {
    if (momentRef.current) { clearInterval(momentRef.current); momentRef.current = null; }
  }, []);

  // ── PanResponder ──────────────────────────────────────────────────────────
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderTerminationRequest: () => false,

    onPanResponderGrant: (e) => {
      stopMomentum();
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

      const { pageX, pageY } = e.nativeEvent;
      const { x: ox, y: oy } = originRef.current;

      const angle = pageToAngle(pageX, pageY, ox, oy);
      startRef.current = angle;
      lastARef.current = angle;
      lastTRef.current = Date.now();
      velRef.current   = 0;

      // Decide: is user grabbing the knob/needle or the wheel?
      if (hitTestKnob(pageX, pageY, ox, oy, armRef.current)) {
        modeRef.current  = 'arm';
        baseARef.current = armRef.current;
      } else {
        modeRef.current  = 'wheel';
        baseWRef.current = wheelRef.current;
      }
    },

    onPanResponderMove: (e) => {
      const { pageX, pageY } = e.nativeEvent;
      const { x: ox, y: oy } = originRef.current;

      const angle = pageToAngle(pageX, pageY, ox, oy);

      // Angular delta, clamped to ±180 to avoid wrap-around jumps
      let delta = angle - startRef.current;
      if (delta >  180) delta -= 360;
      if (delta < -180) delta += 360;

      // Velocity tracking
      const now = Date.now(), dt = now - lastTRef.current;
      if (dt > 0) {
        let dA = angle - lastARef.current;
        if (dA >  180) dA -= 360;
        if (dA < -180) dA += 360;
        velRef.current = velRef.current * 0.5 + (dA / dt) * 0.5;
      }
      lastARef.current = angle;
      lastTRef.current = now;

      if (modeRef.current === 'arm') {
        // ARM drags → only arm moves, wheel frozen
        armRef.current = ((baseARef.current + delta) % 360 + 360) % 360;
      } else if (modeRef.current === 'wheel') {
        // WHEEL drags → only wheel moves, arm frozen
        wheelRef.current = ((baseWRef.current + delta) % 360 + 360) % 360;
      }

      scheduledFlush();
    },

    onPanResponderRelease: (e, gs) => {
      const moved = Math.sqrt(gs.dx*gs.dx + gs.dy*gs.dy);

      if (modeRef.current === 'arm') {
        // Snap arm to nearest nakshatra and open Oracle
        const idx = computeNakIdx(armRef.current, wheelRef.current);
        armRef.current = ((idx*SPAN + SPAN/2 + wheelRef.current) % 360 + 360) % 360;
        flush();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onOpenOracle(NAKSHATRAS[idx]);

      } else if (modeRef.current === 'wheel') {
        if (moved < 10) {
          // Tap → snap tapped segment to top
          const { pageX, pageY } = e.nativeEvent;
          const { x: ox, y: oy } = originRef.current;
          const dx = pageX - ox, dy = pageY - oy;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist >= INNER_R - 14 && dist <= OUTER_R + 14) {
            let raw = Math.atan2(dy, dx) * (180/Math.PI) + 90;
            raw = ((raw % 360) + 360) % 360;
            const data = ((raw - wheelRef.current) % 360 + 360) % 360;
            const idx  = Math.floor(data / SPAN) % 27;
            wheelRef.current = ((-(idx*SPAN + SPAN/2)) % 360 + 360) % 360;
            armRef.current   = ((idx*SPAN + SPAN/2 + wheelRef.current) % 360 + 360) % 360;
            flush();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        } else if (Math.abs(velRef.current) > 0.04) {
          // Momentum flick
          let v = velRef.current;
          momentRef.current = setInterval(() => {
            v *= 0.91;
            wheelRef.current = ((wheelRef.current + v*16) % 360 + 360) % 360;
            flush();
            if (Math.abs(v) < 0.008) {
              stopMomentum();
              const data = ((-wheelRef.current) % 360 + 360) % 360;
              const idx  = Math.floor(data / SPAN) % 27;
              wheelRef.current = ((-(idx*SPAN + SPAN/2)) % 360 + 360) % 360;
              armRef.current   = ((idx*SPAN + SPAN/2 + wheelRef.current) % 360 + 360) % 360;
              flush();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }, 16) as any;
        } else {
          flush();
        }
      }

      modeRef.current = 'none';
    },

    onPanResponderTerminate: () => { modeRef.current = 'none'; stopMomentum(); },
  })).current;

  // ── Interpolations ────────────────────────────────────────────────────────
  const opacity    = spinAnim.interpolate({ inputRange:[0,0.3], outputRange:[0,1], extrapolate:'clamp' });
  const pulseOuter = pulseAnim.interpolate({ inputRange:[0,1], outputRange:[0.04,0.20] });
  const pulseMoon  = pulseAnim.interpolate({ inputRange:[0,1], outputRange:[0.5,1.0] });

  const activeNak  = NAKSHATRAS[armNakIdx] ?? NAKSHATRAS[0];
  const PTR_TIP_Y  = CY - OUTER_R + 4;
  const PTR_BASE_Y = CY - OUTER_R - 16;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={{ transform:[{ translateY: slideAnim }] }}>

      {/* Label above wheel */}
      <View style={styles.label} pointerEvents="none">
        <Text style={[styles.labelName,{ color:activeNak.color }]}>{activeNak.name.toUpperCase()}</Text>
        <Text style={styles.labelSub}>{activeNak.lord}</Text>
      </View>

      <View style={styles.wrapper}>
        {/*
          Touch receiver View — MUST have explicit size = SVG_SIZE
          and we measure its screen position to get SVG center in page coords.
          Using pageX/pageY + stored origin is the ONLY reliable approach in RN.
        */}
        <View
          {...pan.panHandlers}
          style={{ width: SVG_SIZE, height: SVG_SIZE }}
          onLayout={() => {
            // Use a ref to this View to measure its absolute screen position
          }}
          ref={(v: any) => {
            if (v && v.measure) {
              // Measure immediately and cache — called once on mount (and on re-layout)
              v.measure((_x:number,_y:number,_w:number,_h:number,px:number,py:number) => {
                // px, py = top-left corner of View in screen coords
                // SVG center = px + CX, py + CY
                originRef.current = { x: px + CX, y: py + CY };
              });
            }
          }}
        >
          <Animated.View style={{ opacity }}>
            <Svg width={SVG_SIZE} height={SVG_SIZE}>
              <Defs>
                <RadialGradient id="cg" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"  stopColor="rgba(55,25,105,1)" />
                  <Stop offset="100%" stopColor="rgba(6,3,18,1)" />
                </RadialGradient>
                <RadialGradient id="bg" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"  stopColor="rgba(18,8,40,0.98)" />
                  <Stop offset="100%" stopColor="rgba(3,1,10,0.99)" />
                </RadialGradient>
              </Defs>

              <Circle cx={CX} cy={CY} r={OUTER_R+2} fill="url(#bg)" />

              {/* ══ WHEEL ══ */}
              <G rotation={wheelRot} origin={`${CX},${CY}`}>
                {NAKSHATRAS.map((nak,i) => (
                  <Path key={`c${i}`}
                    d={STATIC_PATHS[i].colorPath}
                    fill={hexToRgba(nak.color,0.50)}
                    stroke={hexToRgba(nak.color,0.12)}
                    strokeWidth={0.5}
                  />
                ))}
                <Circle cx={CX} cy={CY} r={COLOR_R} fill="none" stroke="rgba(201,168,76,0.14)" strokeWidth={0.8}/>
                <Circle cx={CX} cy={CY} r={INNER_R} fill="none" stroke="rgba(201,168,76,0.10)" strokeWidth={0.8}/>

                {NAKSHATRAS.map((nak,i) => {
                  const { mainPath, midRad, midAngle } = STATIC_PATHS[i];
                  const isBirth = i === birthNakIdx;
                  const isArm   = i === armNakIdx;
                  const fa = isArm ? 0.90 : 0.30;
                  const sc = isArm ? '#E8D97A' : isBirth ? '#2FBEBE' : hexToRgba(nak.color,0.18);
                  const sw = isArm ? 2.5 : isBirth ? 2.2 : 0.8;
                  const lR = (INNER_R+OUTER_R)/2;
                  const lX = CX + lR*Math.cos(midRad);
                  const lY = CY + lR*Math.sin(midRad);
                  const lRot = midAngle > 180 ? midAngle+180 : midAngle;
                  return (
                    <G key={nak.name}>
                      {isArm && <Path d={mainPath} fill="none" stroke="#E8D97A" strokeWidth={16} opacity={0.18}/>}
                      {isBirth && !isArm && <Path d={mainPath} fill="none" stroke="#2FBEBE" strokeWidth={14} opacity={0.16}/>}
                      <Path d={mainPath}
                        fill={hexToRgba(isArm?'#E8D97A':nak.color, fa)}
                        stroke={sc} strokeWidth={sw}
                      />
                      <SvgText x={lX} y={lY}
                        rotation={lRot} origin={`${lX},${lY}`}
                        fill={isArm?'rgba(235,220,110,1)':isBirth?'rgba(47,190,190,1)':'rgba(255,255,255,0.60)'}
                        fontSize="5.6" fontFamily="Orbitron_400Regular"
                        textAnchor="middle" alignmentBaseline="middle"
                      >
                        {nak.name.split(' ')[0].substring(0,5).toUpperCase()}
                      </SvgText>
                      <Circle
                        cx={CX+(COLOR_R+4)*Math.cos(midRad)}
                        cy={CY+(COLOR_R+4)*Math.sin(midRad)}
                        r={2} fill={hexToRgba(nak.color, isArm||isBirth?1:0.55)}
                      />
                    </G>
                  );
                })}
                <Circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke="rgba(201,168,76,0.22)" strokeWidth={1}/>
              </G>
              {/* ══ END WHEEL ══ */}

              {/* ── ARM + KNOB — independent rotation at SVG root level ── */}
              <G rotation={armAngle} origin={`${CX},${CY}`}>
                {/* Dashed stem inside ring */}
                <Line
                  x1={CX} y1={CY - CENTER_R - 6}
                  x2={CX} y2={CY - OUTER_R + 4}
                  stroke="rgba(201,168,76,0.55)"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
                {/* Solid needle outside ring → knob */}
                <Line
                  x1={CX} y1={CY - OUTER_R + 2}
                  x2={CX} y2={CY - KNOB_DIST + KNOB_R + 4}
                  stroke="#C9A84C"
                  strokeWidth={4}
                />
                {/* Wide invisible grab zone over needle (easy to touch) */}
                <Line
                  x1={CX} y1={CY - OUTER_R}
                  x2={CX} y2={CY - KNOB_DIST + KNOB_R + 4}
                  stroke="transparent"
                  strokeWidth={44}
                />
                {/* Knob outer pulse */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={KNOB_R + 14}
                  fill="rgba(201,168,76,0.07)" stroke="rgba(201,168,76,0.15)" strokeWidth={1}/>
                {/* Knob body */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={KNOB_R}
                  fill="rgba(8,3,20,0.97)" stroke="#C9A84C" strokeWidth={3}/>
                {/* Knob inner ring */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={KNOB_R - 6}
                  fill="none" stroke="rgba(201,168,76,0.35)" strokeWidth={1}/>
                {/* Knob center dot */}
                <Circle cx={CX} cy={CY - KNOB_DIST} r={5}
                  fill="#C9A84C" opacity={0.95}/>
                {/* Arrow tip */}
                <Polygon
                  points={`${CX},${CY-KNOB_DIST-KNOB_R-10} ${CX-7},${CY-KNOB_DIST-KNOB_R+6} ${CX+7},${CY-KNOB_DIST-KNOB_R+6}`}
                  fill="#C9A84C" opacity={0.92}
                />
              </G>

              {/* Pulse ring */}
              {birthNakIdx >= 0 && (
                <AnimatedCircle cx={CX} cy={CY} r={OUTER_R+16}
                  fill="none" stroke="#2FBEBE" strokeWidth={1.5} opacity={pulseOuter}/>
              )}

              {/* Fixed pointer at top */}
              <Polygon
                points={`${CX},${PTR_TIP_Y} ${CX-7},${PTR_BASE_Y} ${CX+7},${PTR_BASE_Y}`}
                fill="#C9A84C" opacity={0.95}
              />

              {/* Center disc */}
              <Circle cx={CX} cy={CY} r={CENTER_R+5} fill="url(#cg)" stroke="#C9A84C" strokeWidth={1}/>
            </Svg>
          </Animated.View>
        </View>

        {/* Center text */}
        <View style={styles.centerOverlay} pointerEvents="none">
          <Animated.Text style={[styles.moonGlyph,{opacity:pulseMoon}]}>☽</Animated.Text>
          <Text style={styles.centerName} numberOfLines={2}>{chart.nakshatra}</Text>
          <Text style={styles.centerPada}>PADA {chart.nakshatraPada}</Text>
          <Text style={styles.centerRashi}>Moon in {chart.moonRashi}</Text>
        </View>
      </View>

      {/* Bottom pill */}
      <BlurView intensity={18} tint="dark" style={styles.pill}>
        <View style={styles.pillLeft}>
          <Text style={[styles.pillName,{color:activeNak.color}]}>{activeNak.name}</Text>
          <Text style={styles.pillDetail}>
            Lord: <Text style={{color:activeNak.color}}>{activeNak.lord}</Text>
            {'  ·  '}{activeNak.type}
          </Text>
        </View>
        <Text style={styles.pillHint}>{'◉ DRAG\nKNOB'}</Text>
      </BlurView>

    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  label:       { alignItems:'center', marginBottom:4 },
  labelName:   { fontFamily:'Orbitron_400Regular',   fontSize:11, letterSpacing:2 },
  labelSub:    { fontFamily:'CormorantGaramond_400Regular_Italic', fontSize:11, color:'rgba(255,255,255,0.40)', marginTop:1 },
  wrapper:     { alignItems:'center', justifyContent:'center' },
  centerOverlay: {
    position:'absolute', alignItems:'center', justifyContent:'center',
    width:(CENTER_R+5)*2, height:(CENTER_R+5)*2, borderRadius:CENTER_R+5,
    pointerEvents:'none',
  },
  moonGlyph:  { fontSize:18, color:'#E8E8FF', textShadowColor:'rgba(255,255,255,0.7)', textShadowRadius:6, marginBottom:1 },
  centerName: { fontFamily:'CinzelDecorative_400Regular', fontSize:8, color:'#C9A84C', textAlign:'center', maxWidth:CENTER_R*1.6, lineHeight:11 },
  centerPada: { fontFamily:'Orbitron_400Regular', fontSize:6, color:'rgba(255,255,255,0.38)', letterSpacing:1, marginTop:2 },
  centerRashi:{ fontFamily:'CormorantGaramond_400Regular_Italic', fontSize:8, color:'rgba(232,232,255,0.45)', marginTop:1 },
  pill: {
    flexDirection:'row', alignItems:'center', justifyContent:'space-between',
    marginHorizontal:16, marginTop:10, paddingHorizontal:18, paddingVertical:13,
    borderRadius:18, borderWidth:1, borderColor:'rgba(201,168,76,0.20)', overflow:'hidden',
  },
  pillLeft:   { flex:1 },
  pillName:   { fontFamily:'CinzelDecorative_400Regular', fontSize:15, marginBottom:3 },
  pillDetail: { fontFamily:'CormorantGaramond_400Regular_Italic', color:'rgba(255,255,255,0.65)', fontSize:13 },
  pillHint:   { fontFamily:'Orbitron_400Regular', color:'rgba(201,168,76,0.45)', fontSize:7, letterSpacing:0.8, textAlign:'center', lineHeight:10 },
});
