// src/components/ui/WheelPicker.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// FIX: Lag/stuck during time-picking on Android (Termux / Expo Go).
//
// ROOT CAUSE of the original bug:
//   Both onScrollEndDrag AND onMomentumScrollEnd called snapToIndex(), which
//   calls scrollTo().  When both fired in quick succession (< 100 ms apart)
//   they issued two competing scrollTo() calls.  Each one interrupted the
//   other's animation and left the list visually stuck mid-item.
//
// SOLUTION — two-guard system:
//   1. pendingSnap timeout (80 ms):
//      onScrollEndDrag arms a 80 ms deferred snap.  If the user did a real
//      fling, onMomentumScrollEnd fires within those 80 ms, cancels the
//      deferred snap and handles it cleanly.  If there was no momentum (slow
//      drag on Android), the deferred snap fires after 80 ms — guaranteed.
//
//   2. snapLock ref:
//      Once a snap is in progress, snapLock = true for 400 ms.  Any
//      stray momentum-end or drag-end event arriving during the scroll
//      animation is silently dropped.  This eliminates the double-snap jitter.
// ═══════════════════════════════════════════════════════════════════════════════

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
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT

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

  // ── Guard 1: lock prevents concurrent/overlapping programmatic scrollTo calls ─
  const snapLock = useRef(false)

  // ── Guard 2: deferred snap — allows momentum to cancel a drag-end snap ────────
  const pendingSnap = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Scroll to initial position on mount with no visible animation
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      })
    }, 150)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Core snap ──────────────────────────────────────────────────────────────────
  // Rounds raw scroll offset to the nearest item, animates to it, and
  // notifies the parent.  The 400 ms lock covers the animation duration.
  function snapToIndex(rawOffsetY: number) {
    if (snapLock.current) return
    snapLock.current = true

    const index = Math.round(rawOffsetY / ITEM_HEIGHT)
    const clamped = Math.max(0, Math.min(index, data.length - 1))

    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true })
    onSelect(clamped)

    // Release lock after the animation completes (~300 ms) + small buffer
    setTimeout(() => {
      snapLock.current = false
    }, 400)
  }

  // ── Drag ends (finger lifts) ───────────────────────────────────────────────────
  // Arm a deferred snap.  If momentum fires within 80 ms it will cancel this.
  // If no momentum (slow drag, Android), this fires after 80 ms — guaranteed.
  function handleScrollEndDrag(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = e.nativeEvent.contentOffset.y

    if (pendingSnap.current) clearTimeout(pendingSnap.current)

    pendingSnap.current = setTimeout(() => {
      pendingSnap.current = null
      snapToIndex(offsetY)
    }, 80)
  }

  // ── Momentum ends (fling decelerates) ─────────────────────────────────────────
  // Cancel the pending drag-end snap so exactly ONE snap happens per gesture.
  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pendingSnap.current) {
      clearTimeout(pendingSnap.current)
      pendingSnap.current = null
    }
    snapToIndex(e.nativeEvent.contentOffset.y)
  }

  return (
    <View style={[styles.container, { width }]}>
      {/* Fade overlay — visual only, passes touches through */}
      <View style={styles.fadeTop} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled={true}
        scrollEventThrottle={16}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
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
      {/* Selection band */}
      <View style={styles.centerLine} pointerEvents="none" />
    </View>
  )
}

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
