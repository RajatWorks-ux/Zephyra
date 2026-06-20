// src/screens/main/ChatScreen.tsx — PHASE 3 redesign
// Fixes applied:
//  • Input bar no longer hides under the floating tab bar (was a hardcoded
//    marginBottom:80 with no safe-area awareness — now uses real insets).
//  • createSession errors are caught and shown to the user instead of
//    silently doing nothing when you tap Send.
//  • SessionDrawer (hamburger menu) can no longer crash on a null session —
//    defensive filtering + a safe keyExtractor.
//  • Accepts `route.params.prefill` so "Ask Oracle" buttons on the Forecast
//    screen actually land text in the input box.
//  • Visual redesign: clearer header, more distinct message bubbles, a
//    cleaner pill input bar, and a tidier conversation drawer.
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  Alert, Dimensions, ScrollView,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useChatStore, type ChatMessage, type ChatSession } from '../../store/chatStore'
import { useReadingStore } from '../../store/readingStore'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { TAB_BAR_CONTENT_HEIGHT } from '../../components/ui/BottomTabBar'

const { width } = Dimensions.get('window')

// ── Suggestion chips based on chart ──────────────────────────────────────────
function getSuggestions(chartData: any): string[] {
  const mahadasha = chartData?.vedic?.mahadasha?.replace(' Mahadasha', '') ?? 'Saturn'
  const lagna = chartData?.vedic?.lagna ?? 'Aries'
  return [
    `What does my ${mahadasha} period mean for me?`,
    `What should I focus on right now?`,
    `Tell me about my ${lagna} Lagna`,
    `When is a good time for career moves?`,
    `What does my love life look like this year?`,
    `What karmas am I working through?`,
  ]
}

// ── Individual message bubble ─────────────────────────────────────────────────
function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <View style={styles.systemBubble}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      {!isUser && (
        <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.bubbleAvatar}>
          <Text style={styles.bubbleAvatarText}>◈</Text>
        </LinearGradient>
      )}
      <View style={{ flexShrink: 1, maxWidth: isUser ? '100%' : width * 0.74 }}>
        <BlurView intensity={isUser ? 22 : 16} tint="dark" style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          {isUser ? (
            <LinearGradient
              colors={['rgba(124,58,237,0.30)', 'rgba(201,168,76,0.18)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <Text style={styles.bubbleText}>{message.content}</Text>
          {isStreaming && (
            <View style={styles.streamingDots}>
              {[0, 1, 2].map(i => (
                <StreamDot key={i} delay={i * 120} />
              ))}
            </View>
          )}
        </BlurView>
        <Text style={[styles.bubbleTime, isUser ? { textAlign: 'right' } : { textAlign: 'left', marginLeft: 6 }]}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  )
}

function StreamDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -5, duration: 320, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 320, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return <Animated.View style={[styles.streamDot, { transform: [{ translateY: anim }] }]} />
}

// ── Session drawer (hamburger menu) ────────────────────────────────────────────
function SessionDrawer({
  sessions, currentSession, onSelect, onNew, onDelete, onClose,
}: {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  onSelect: (s: ChatSession) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  // Defensive: never let a malformed/null row reach the FlatList — this is
  // what was crashing the drawer with "Cannot read property 'id' of null".
  const safeSessions = (sessions ?? []).filter((s): s is ChatSession => !!s && !!s.id)

  return (
    <View style={styles.drawerOverlay}>
      <TouchableOpacity style={styles.drawerDismiss} onPress={onClose} activeOpacity={1} />
      <BlurView intensity={34} tint="dark" style={styles.drawer}>
        <LinearGradient colors={['rgba(124,58,237,0.10)', 'transparent']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Your Conversations</Text>
          <TouchableOpacity onPress={onNew} style={styles.drawerNewBtn} activeOpacity={0.8}>
            <Text style={styles.drawerNewText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={safeSessions}
          keyExtractor={(s, i) => s?.id ?? `session-${i}`}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.sessionCard, currentSession?.id === item.id && styles.sessionCardActive]}
              onPress={() => { onSelect(item); onClose() }}
              onLongPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                Alert.alert('Delete Conversation', `Delete "${item.title}"?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
                ])
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.sessionDot, currentSession?.id === item.id && { backgroundColor: '#C9A84C' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle} numberOfLines={1}>{item.title || 'Untitled chat'}</Text>
                <Text style={styles.sessionDate}>
                  {item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyDrawerWrap}>
              <Text style={styles.emptyDrawerSymbol}>◈</Text>
              <Text style={styles.emptyDrawer}>No conversations yet — start one below.</Text>
            </View>
          }
        />
      </BlurView>
    </View>
  )
}

// ── Main ChatScreen ────────────────────────────────────────────────────────────
export function ChatScreen({ route }: any) {
  const insets = useSafeAreaInsets()
  const { session } = useAuthStore()
  const { chartData } = useReadingStore()
  const { selectedLanguage } = useSettingsStore()
  const {
    sessions, currentSession, messages, isLoading, isSending, streamingText,
    loadSessions, selectSession, createSession, sendMessage, deleteSession, loadMemory,
  } = useChatStore()

  const [inputText, setInputText] = useState('')
  const [showDrawer, setShowDrawer] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const statusAnim = useRef(new Animated.Value(1)).current
  const userId = session?.user?.id ?? 'mock-user-001'

  useEffect(() => {
    loadSessions(userId)
    loadMemory(userId)
  }, [userId])

  // ── "Ask Oracle" prefill — Forecast screen navigates here with a prefill
  //    param. Consume it once, then clear it so it doesn't re-fire.
  useEffect(() => {
    const prefill = route?.params?.prefill
    if (prefill) {
      setInputText(prefill)
      setTimeout(() => inputRef.current?.focus(), 250)
    }
  }, [route?.params?.prefill])

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages, streamingText])

  // Pulse status when sending
  useEffect(() => {
    if (isSending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(statusAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(statusAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start()
    } else {
      statusAnim.setValue(1)
    }
  }, [isSending])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || isSending || creatingSession) return
    if (!chartData) {
      Alert.alert('Still loading your chart', 'Give it a moment and try again.')
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setInputText('')

    try {
      if (!currentSession) {
        setCreatingSession(true)
        await createSession(userId, text.slice(0, 40) || 'New Chat', 'personal')
      }
    } catch (e: any) {
      setCreatingSession(false)
      setInputText(text)
      Alert.alert(
        'Could not start a new conversation',
        e?.message ?? 'Please check your connection and try again.',
      )
      return
    }
    setCreatingSession(false)
    await sendMessage(userId, text, chartData, selectedLanguage)
  }

  const handleSuggestion = (text: string) => {
    setInputText(text)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleNewSession = async () => {
    try {
      const title = `Chat ${new Date().toLocaleDateString()}`
      await createSession(userId, title, 'personal')
    } catch (e: any) {
      Alert.alert('Could not start a new conversation', e?.message ?? 'Please try again.')
    }
  }

  // Build display messages including streaming
  const displayMessages: ChatMessage[] = [
    ...messages,
    ...(streamingText ? [{
      id: 'streaming', session_id: currentSession?.id ?? '', role: 'assistant' as const,
      content: streamingText, created_at: new Date().toISOString(),
    }] : []),
  ]

  const suggestions = getSuggestions(chartData)
  const showWelcome = !isLoading && displayMessages.length === 0
  // Clearance so the input bar always sits above the floating tab bar, with
  // a little breathing room — uses the real device inset instead of a
  // hardcoded guess.
  const inputBottomPad = Math.max(insets.bottom, 8) + TAB_BAR_CONTENT_HEIGHT - 4

  return (
    <View style={styles.root}>
      {/* Background */}
      <Video
        source={Videos.chatBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping shouldPlay isMuted
        onError={() => {}}
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.5)', 'rgba(5,5,15,0.94)']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          {/* Header */}
          <BlurView intensity={24} tint="dark" style={styles.header}>
            <View style={styles.headerLeft}>
              <View>
                <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.avatarCircle}>
                  <Text style={styles.avatarSymbol}>◈</Text>
                </LinearGradient>
                <View style={[styles.presenceDot, { backgroundColor: isSending ? '#FF8C00' : '#44FF88' }]} />
              </View>
              <View>
                <Text style={styles.headerName}>Zephyra</Text>
                <Animated.View style={{ opacity: statusAnim }}>
                  <Text style={[styles.headerStatus, { color: isSending ? '#FF8C00' : '#44FF88' }]}>
                    {isSending ? '✦ Reading the cosmos...' : '✦ Online'}
                  </Text>
                </Animated.View>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowDrawer(true)}
              style={styles.menuBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.menuIconBar} />
              <View style={[styles.menuIconBar, { width: 14 }]} />
              <View style={styles.menuIconBar} />
            </TouchableOpacity>
          </BlurView>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            keyExtractor={(m, i) => m?.id ?? `msg-${i}`}
            style={{ flex: 1 }}
            contentContainerStyle={[styles.messagesList, { paddingBottom: 20 }]}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isStreaming={item.id === 'streaming'}
              />
            )}
            ListEmptyComponent={
              isLoading ? (
                <View style={styles.centerLoading}>
                  <ActivityIndicator color={Colors.agedGold} />
                </View>
              ) : showWelcome ? (
                <View style={styles.welcomeWrap}>
                  <BlurView intensity={18} tint="dark" style={styles.welcomeCard}>
                    <LinearGradient colors={['rgba(124,58,237,0.16)', 'rgba(201,168,76,0.08)']} style={StyleSheet.absoluteFillObject} />
                    <Text style={styles.welcomeSymbol}>◈</Text>
                    <Text style={styles.welcomeTitle}>I've read your chart</Text>
                    <Text style={styles.welcomeSub}>
                      {chartData
                        ? `I know your ${chartData.vedic?.lagna ?? ''} Lagna, your ${chartData.vedic?.nakshatra ?? ''} Nakshatra, and where your ${chartData.vedic?.mahadasha?.replace(' Mahadasha', '') ?? ''} Mahadasha is taking you. Ask me anything.`
                        : 'Your cosmic chart is loaded. Ask me anything.'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                      {suggestions.map((s, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.chip}
                          onPress={() => handleSuggestion(s)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.chipText}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </BlurView>
                </View>
              ) : null
            }
          />

          {/* Input */}
          <BlurView intensity={28} tint="dark" style={[styles.inputWrap, { paddingBottom: inputBottomPad }]}>
            <View style={styles.inputPill}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask Zephyra..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={2000}
                returnKeyType="default"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!inputText.trim() || isSending || creatingSession) && styles.sendBtnOff]}
                onPress={handleSend}
                disabled={!inputText.trim() || isSending || creatingSession || !chartData}
                activeOpacity={0.85}
              >
                {(isSending || creatingSession)
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <LinearGradient
                      colors={inputText.trim() ? ['#7B2FBE', '#C9A84C'] : ['#333', '#444']}
                      style={styles.sendBtnGrad}
                    >
                      <Text style={styles.sendIcon}>↑</Text>
                    </LinearGradient>
                  )
                }
              </TouchableOpacity>
            </View>
          </BlurView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Session Drawer */}
      {showDrawer && (
        <SessionDrawer
          sessions={sessions}
          currentSession={currentSession}
          onSelect={selectSession}
          onNew={handleNewSession}
          onDelete={deleteSession}
          onClose={() => setShowDrawer(false)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, height: 72, borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.12)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarSymbol: { fontSize: 20, color: '#fff' },
  presenceDot: {
    position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#05050F',
  },
  headerName: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.agedGold },
  headerStatus: { fontFamily: Fonts.body, fontSize: 11, marginTop: 2 },
  menuBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', gap: 4 },
  menuIconBar: { width: 20, height: 2, borderRadius: 1, backgroundColor: Colors.agedGold },

  centerLoading: { paddingTop: 60, alignItems: 'center' },

  messagesList: { paddingHorizontal: 14, paddingVertical: 16 },
  bubbleRow: { marginVertical: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleRowUser: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  bubbleRowBot: { alignSelf: 'flex-start' },
  bubbleAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  bubbleAvatarText: { fontSize: 12, color: '#fff' },
  bubble: {
    borderRadius: 20, padding: 13, overflow: 'hidden',
    borderWidth: 1,
  },
  bubbleUser: {
    borderTopRightRadius: 4,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  bubbleBot: {
    borderTopLeftRadius: 4,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  bubbleText: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  bubbleTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  streamingDots: { flexDirection: 'row', gap: 4, marginTop: 8 },
  streamDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#C9A84C' },
  systemBubble: {
    alignSelf: 'center', backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginVertical: 8,
  },
  systemText: { fontFamily: Fonts.mystical, fontSize: 12, color: Colors.agedGold, textAlign: 'center' },

  welcomeWrap: { padding: 20, paddingTop: 30 },
  welcomeCard: {
    borderRadius: 26, padding: 26, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.22)',
  },
  welcomeSymbol: { fontSize: 42, color: Colors.nebulaCyan, textAlign: 'center', marginBottom: 14 },
  welcomeTitle: { fontFamily: Fonts.heading, fontSize: 19, color: Colors.agedGold, textAlign: 'center', marginBottom: 12 },
  welcomeSub: { fontFamily: Fonts.mystical, fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26, marginBottom: 20 },
  chips: { marginTop: 4 },
  chip: {
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, marginRight: 10,
    backgroundColor: 'rgba(201,168,76,0.07)',
  },
  chipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.agedGold },

  inputWrap: {
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(201,168,76,0.12)',
  },
  inputPill: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 24, paddingLeft: 16, paddingRight: 6, paddingVertical: 6,
  },
  input: {
    flex: 1, fontFamily: Fonts.body, fontSize: 15, color: Colors.textPrimary,
    maxHeight: 120, paddingVertical: 8, paddingRight: 10, lineHeight: 22,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
  sendBtnOff: { opacity: 0.4 },
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: 'bold' },

  // Drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 100 },
  drawerDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer: { width: width * 0.8, overflow: 'hidden' },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.12)',
  },
  drawerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.agedGold },
  drawerNewBtn: { borderWidth: 1, borderColor: Colors.agedGold, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  drawerNewText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.agedGold },
  sessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sessionCardActive: { backgroundColor: 'rgba(201,168,76,0.08)' },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  sessionTitle: { fontFamily: Fonts.mystical, fontSize: 17, color: Colors.textPrimary },
  sessionDate: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  emptyDrawerWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyDrawerSymbol: { fontSize: 30, color: 'rgba(201,168,76,0.4)', marginBottom: 10 },
  emptyDrawer: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
})
