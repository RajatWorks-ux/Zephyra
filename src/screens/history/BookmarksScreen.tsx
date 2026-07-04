// src/screens/history/BookmarksScreen.tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, Dimensions,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { Swipeable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '../../store/authStore'
import { useAudioStore } from '../../store/audioStore'
import { speakText } from '../../services/audioService'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import type { BookmarkItem } from '../../types'

const TOPIC_FILTERS = ['All','Career','Love','Spiritual','Finance','Health']

export function BookmarksScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { session } = useAuthStore()
  const { selectedVoice, setIsPlaying } = useAudioStore()
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [search, setSearch] = useState('')
  const [activeTopic, setActiveTopic] = useState('All')

  const storageKey = `@zephyra_bookmarks_${session?.user?.id}`

  useEffect(() => { loadBookmarks() }, [])

  async function loadBookmarks() {
    try {
      const raw = await AsyncStorage.getItem(storageKey)
      if (raw) setBookmarks(JSON.parse(raw))
    } catch {}
  }

  async function deleteBookmark(id: string) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    Alert.alert('Remove Bookmark', 'Delete this saved insight?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updated = bookmarks.filter(b => b.id !== id)
          setBookmarks(updated)
          await AsyncStorage.setItem(storageKey, JSON.stringify(updated))
        }
      },
    ])
  }

  async function handleSpeak(text: string) {
    setIsPlaying(true)
    await speakText(text, 'en-US', selectedVoice)
    setIsPlaying(false)
  }

  const filtered = bookmarks.filter(b => {
    const matchSearch = !search || b.text.toLowerCase().includes(search.toLowerCase())
    const matchTopic = activeTopic === 'All' || b.topic?.toLowerCase() === activeTopic.toLowerCase()
    return matchSearch && matchTopic
  }).sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  function renderRightActions(id: string) {
    return (
      <TouchableOpacity
        style={st.deleteAction}
        onPress={() => deleteBookmark(id)}
      >
        <Text style={st.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    )
  }

  function renderItem({ item }: { item: BookmarkItem }) {
    const date = new Date(item.savedAt)
    const dateStr = `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

    return (
      <Swipeable renderRightActions={() => renderRightActions(item.id)} overshootRight={false}>
        <BlurView intensity={12} tint="dark" style={st.card}>
          <View style={st.cardHeader}>
            <Text style={st.sourceLabel}>{item.source}</Text>
            <View style={st.cardHeaderRight}>
              <TouchableOpacity
                onLongPress={() => handleSpeak(item.text)}
                onPress={() => handleSpeak(item.text)}
                style={st.speakBtn}
              >
                <Text style={st.speakIcon}>◎</Text>
              </TouchableOpacity>
              <Text style={st.dateText}>{dateStr}</Text>
            </View>
          </View>
          <Text style={st.bookmarkText}>{item.text}</Text>
          {item.topic && item.topic !== 'general' && (
            <View style={st.topicPill}>
              <Text style={st.topicPillText}>{item.topic}</Text>
            </View>
          )}
        </BlurView>
      </Swipeable>
    )
  }

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.4)', 'rgba(5,5,15,0.92)']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Saved Insights</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={st.searchWrap}>
        <BlurView intensity={15} tint="dark" style={st.searchBar}>
          <Text style={st.searchIcon}>⌕</Text>
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="Search bookmarks..." placeholderTextColor={Colors.textMuted}
            style={st.searchInput}
          />
        </BlurView>
      </View>

      {/* Topic filters */}
      <FlatList
        horizontal data={TOPIC_FILTERS} keyExtractor={i => i}
        showsHorizontalScrollIndicator={false}
        style={st.filterBar}
        contentContainerStyle={st.filterContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setActiveTopic(item) }}
            style={[st.filterPill, activeTopic === item && st.filterPillActive]}
          >
            <Text style={[st.filterText, activeTopic === item && st.filterTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={st.empty}>
            <Text style={st.emptyIcon}>◎</Text>
            <Text style={st.emptyTitle}>No saved insights yet</Text>
            <Text style={st.emptySub}>Long-press any reading section or chat message to save it here</Text>
          </View>
        }
      />
    </View>
  )
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: '#C9A84C' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: '#C9A84C' },
  searchWrap: { paddingHorizontal: 16, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 10 },
  searchIcon: { fontSize: 18, color: Colors.textMuted },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: '#E8E8FF' },
  filterBar: { flexGrow: 0, marginBottom: 10 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  filterPillActive: { backgroundColor: 'rgba(201,168,76,0.15)', borderColor: '#C9A84C' },
  filterText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  filterTextActive: { color: '#C9A84C', fontFamily: Fonts.bodySemiBold },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: 16, padding: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sourceLabel: { fontFamily: Fonts.body, fontSize: 10, color: '#7B2FBE', letterSpacing: 0.5 },
  dateText: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  speakBtn: { padding: 4 },
  speakIcon: { fontSize: 14, color: Colors.textMuted },
  bookmarkText: { fontFamily: Fonts.body, fontSize: 14, color: '#E8E8FF', lineHeight: 22 },
  topicPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(123,47,190,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(123,47,190,0.35)' },
  topicPillText: { fontFamily: Fonts.body, fontSize: 10, color: '#B090FF' },
  deleteAction: { backgroundColor: '#FF4444', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 16, marginLeft: 8 },
  deleteActionText: { fontFamily: Fonts.bodySemiBold, fontSize: 13, color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { fontSize: 40, color: 'rgba(201,168,76,0.25)' },
  emptyTitle: { fontFamily: Fonts.heading, fontSize: 16, color: '#C9A84C' },
  emptySub: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
})
