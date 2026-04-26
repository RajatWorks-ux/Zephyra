import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet, Dimensions } from 'react-native'

const { width, height } = Dimensions.get('window')
const STAR_COUNT = 80

interface Star {
  x: number
  y: number
  size: number
  opacity: Animated.Value
  duration: number
}

function generateStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 2.5 + 0.5,
    opacity: new Animated.Value(Math.random() * 0.6 + 0.1),
    duration: Math.random() * 3000 + 2000,
  }))
}

const stars = generateStars()

export function StarField() {
  const animations = useRef<Animated.CompositeAnimation[]>([])

  useEffect(() => {
    stars.forEach((star) => {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.9 + 0.1,
            duration: star.duration,
            useNativeDriver: true,
          }),
          Animated.timing(star.opacity, {
            toValue: Math.random() * 0.2,
            duration: star.duration,
            useNativeDriver: true,
          }),
        ])
      )
      anim.start()
      animations.current.push(anim)
    })

    return () => {
      animations.current.forEach((a) => a.stop())
    }
  }, [])

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {stars.map((star, i) => (
        <Animated.View
          key={i}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    backgroundColor: '#E8E8FF',
  },
})