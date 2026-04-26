import React from 'react'
import { View, StyleSheet, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { StarField } from './StarField'
import { Colors } from '../../constants/colors'

interface ScreenWrapperProps {
  children: React.ReactNode
  withStars?: boolean
  edges?: ('top' | 'bottom' | 'left' | 'right')[]
}

export function ScreenWrapper({
  children,
  withStars = true,
  edges = ['top', 'bottom'],
}: ScreenWrapperProps) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <LinearGradient
        colors={[Colors.background, '#0A0A20', Colors.background]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {withStars && <StarField />}
      <SafeAreaView style={styles.safeArea} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
})