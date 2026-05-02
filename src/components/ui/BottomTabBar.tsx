import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'

const TABS = [
  { name: 'HomeTab', label: 'Home', symbol: '⊙' },
  { name: 'ChartsTab', label: 'Charts', symbol: '◎' },
  { name: 'ChatTab', label: 'Oracle', symbol: '◈' },
  { name: 'ForecastTab', label: 'Forecast', symbol: '◐' },
  { name: 'ProfileTab', label: 'Profile', symbol: '◉' },
]

export function BottomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      {/* Gold top border line */}
      <View style={styles.topBorder} />

      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(5,5,15,0.0)', 'rgba(5,5,15,0.7)']}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.tabRow}>
        {TABS.map((tab, i) => {
          const isFocused = state.index === i

          function handlePress() {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            const event = navigation.emit({ type: 'tabPress', target: state.routes[i].key, canPreventDefault: true })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(state.routes[i].name)
            }
          }

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={handlePress}
              activeOpacity={0.7}
            >
              {/* Active indicator dot above */}
              <View style={[styles.activeDot, { opacity: isFocused ? 1 : 0 }]}>
                <LinearGradient
                  colors={['#C9A84C', '#FFD700']}
                  style={styles.activeDotGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>

              <Text style={[styles.symbol, isFocused ? styles.symbolActive : styles.symbolInactive]}>
                {tab.symbol}
              </Text>
              <Text style={[styles.label, isFocused ? styles.labelActive : styles.labelInactive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.2)',
    zIndex: 10,
  },
  tabRow: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingBottom: 4,
    zIndex: 5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  activeDot: {
    width: 20,
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginBottom: 2,
  },
  activeDotGrad: { flex: 1 },
  symbol: {
    fontSize: 18,
  },
  symbolActive: {
    color: '#C9A84C',
    textShadowColor: '#C9A84C80',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  symbolInactive: {
    color: 'rgba(255,255,255,0.3)',
  },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: '#C9A84C',
  },
  labelInactive: {
    color: 'rgba(255,255,255,0.25)',
  },
})
