// src/components/relationship/CompatibilityScoreRing.tsx
import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Fonts } from '../../constants/fonts'

interface Props { score: number; size?: number; showLabel?: boolean }

export function CompatibilityScoreRing({ score, size = 80, showLabel = true }: Props) {
  const anim = useRef(new Animated.Value(0)).current
  const strokeWidth = size * 0.09
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const color = score >= 75 ? '#44FF88' : score >= 50 ? '#C9A84C' : score >= 30 ? '#FF9944' : '#FF4444'

  useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, { toValue: score / 100, duration: 1400, useNativeDriver: false, delay: 200 }).start()
  }, [score])

  const AnimatedCircle = Animated.createAnimatedComponent(Circle)
  const strokeDashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        {/* Track */}
        <Circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth} fill="none" />
        {/* Animated fill */}
        <AnimatedCircle cx={size/2} cy={size/2} r={radius} stroke={color}
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
        />
      </Svg>
      <Text style={{ fontFamily: Fonts.heading, fontSize: size * 0.22, color }}>{score}</Text>
      {showLabel && <Text style={{ fontFamily: Fonts.body, fontSize: size * 0.1, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>/ 100</Text>}
    </View>
  )
}
