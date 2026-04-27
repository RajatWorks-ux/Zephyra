import React, { useRef, useEffect } from 'react'
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

const ITEM_HEIGHT = 52
const VISIBLE_COUNT = 5

interface WheelPickerProps {
  data: string[]
  selectedIndex: number
  onSelect: (index: number) => void
  width?: number
}

export function WheelPicker({
  data,
  selectedIndex,
  onSelect,
  width = 80,
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  function snapToIndex(offsetY: number) {
    const index = Math.round(offsetY / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(index, data.length - 1))
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true })
    onSelect(clamped)
  }

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    snapToIndex(e.nativeEvent.contentOffset.y)
  }

  function handleScrollEndDrag(e: NativeSyntheticEvent<NativeScrollEvent>) {
    snapToIndex(e.nativeEvent.contentOffset.y)
  }

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.fadeTop} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled={true}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2),
        }}
      >
        {data.map((item, index) => (
          <View key={index} style={styles.item}>
            <Text
              style={[
                styles.itemText,
                index === selectedIndex && styles.selectedText,
              ]}
            >
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.fadeBottom} pointerEvents="none" />
      <View style={styles.centerLine} pointerEvents="none" />
    </View>
  )
}

const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT

const styles = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 17,
    color: Colors.textMuted,
  },
  selectedText: {
    color: Colors.starGold,
    fontSize: 20,
    fontFamily: Fonts.accentBold,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 2,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  centerLine: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.starGold + '60',
    zIndex: 5,
  },
})
