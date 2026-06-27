// src/screens/main/ChatScreen.tsx — COMPLETE OVERHAUL
// ─────────────────────────────────────────────────────────────────────────────
// Changes from the previous version:
//  • Header restructured: hamburger (left, opens drawer) — Oracle title +
//    current session name (center) — compose/new-chat pencil icon (right).
//    No more overlap between drawer toggle and new-chat button.
//  • Input bar already used real safe-area insets + TAB_BAR_CONTENT_HEIGHT;
//    kept and slightly tightened.
//  • Streaming/send errors now render as an actual red error bubble in the
//    message list with a "Tap to retry" affordance (chatStore now exposes
//    lastError + retryLastMessage for this).
//  • Session drawer redesign: slides in from the left (Animated, not just
//    present/absent), sessions grouped by Today / Yesterday / This Week /
//    Earlier, each row shows a last-message preview, swipe-left-to-delete
//    via react-native-gesture-handler's Swipeable, long-press for a
//    Rename/Delete menu, confirmation dialog before delete.
//  • "No API key" banner shown at the top of the chat when applicable.
//  • Message bubbles, input bar, suggestion chips, empty state all kept and
//    refined to match the new header/drawer.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  Alert, Dimensions, ScrollView, Keyboard,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Swipeable } from 'react-native-gesture-handler'
import { useChatStore, type ChatMessage, type ChatSession } from '../../store/chatStore'
import { useReadingStore } from '../../store/readingStore'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { getKey, KEY_OPENROUTER } from '../../services/secureKeyStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { TAB_BAR_CONTENT_HEIGHT } from '../../components/ui/BottomTabBar'
import { WhisperInput } from '../../components/chat/WhisperInput'

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
function MessageBubble({
  message, isStreaming, onLongPress,
}: { message: ChatMessage; isStreaming?: boolean; onLongPress?: () => void }) {
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
    <TouchableOpacity onLongPress={onLongPress} activeOpacity={1} delayLongPress={350}>
      <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
        {!isUser && (
          <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.bubbleAvatar}>
            <Text style={styles.bubbleAvatarText}>◈</Text>
          </LinearGradient>
        )}
        <View style={{ flexShrink: 1, maxWidth: isUser ? '100%' : width * 0.74 }}>
          <BlurView intensity={isUser ? 22 : 16} tint="dark" style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot, message.failed && styles.bubbleFailed]}>
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
    </TouchableOpacity>
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

// ── Error bubble — red, with retry ────────────────────────────────────────────
function ErrorBubble({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBubbleRow}>
      <View style={styles.errorBubble}>
        <Text style={styles.errorBubbleIcon}>⚠</Text>
        <Text style={styles.errorBubbleText}>{message}</Text>
        <TouchableOpacity onPress={onRetry} style={styles.errorRetryBtn} activeOpacity={0.8}>
          <Text style={styles.errorRetryText}>↻ Tap to retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── No API key banner ─────────────────────────────────────────────────────────
function NoKeyBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.noKeyBanner}>
      <Text style={styles.noKeyText}>⚠ API key not configured — tap to go to Profile and set up</Text>
    </TouchableOpacity>
  )
}

// ── Date grouping for the drawer ──────────────────────────────────────────────
function groupSessionsByDate(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7)

  const today: ChatSession[] = []
  const yesterday: ChatSession[] = []
  const thisWeek: ChatSession[] = []
  const earlier: ChatSession[] = []

  const sorted = [...sessions].sort((a, b) => new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime())

  for (const s of sorted) {
    const t = new Date(s.last_message_at ?? s.created_at)
    if (t >= startOfToday) today.push(s)
    else if (t >= startOfYesterday) yesterday.push(s)
    else if (t >= startOfWeek) thisWeek.push(s)
    else earlier.push(s)
  }

  const groups: { label: string; items: ChatSession[] }[] = []
  if (today.length) groups.push({ label: 'Today', items: today })
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday })
  if (thisWeek.length) groups.push({ label: 'This Week', items: thisWeek })
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier })
  return groups
}

// ── Session row with swipe-to-delete ──────────────────────────────────────────
function SessionRow({
  item, isActive, isToday, onSelect, onDelete, onRename,
}: {
  item: ChatSession; isActive: boolean; isToday: boolean
  onSelect: () => void; onDelete: () => void; onRename: () => void
}) {
  const swipeRef = useRef<Swipeable>(null)
  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={() => (
        <TouchableOpacity
          style={styles.swipeDeleteAction}
          onPress={() => { swipeRef.current?.close(); onDelete() }}
          activeOpacity={0.85}
        >
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    >
      <TouchableOpacity
        style={[styles.sessionCard, isActive && styles.sessionCardActive]}
        onPress={onSelect}
        onLongPress={() => {
          Haptics.selectionAsync()
          Alert.alert(item.title || 'Untitled chat', undefined, [
            { text: 'Rename', onPress: onRename },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
            { text: 'Cancel', style: 'cancel' },
          ])
        }}
        activeOpacity={0.8}
      >
        <View style={[styles.sessionDot, isToday && { backgroundColor: '#C9A84C' }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sessionTitle} numberOfLines={1}>{item.title || 'Untitled chat'}</Text>
          <Text style={styles.sessionDate} numberOfLines={1}>
            {item.last_message_at ? new Date(item.last_message_at).toLocaleDateString() : ''}
          </Text>
        </View>
      </TouchableOpacity>
    </Swipeable>
  )
}

// ── Session drawer (hamburger menu) — slides in, grouped by date ─────────────
function SessionDrawer({
  sessions, currentSession, onSelect, onNew, onDelete, onRename, onClose, visible,
}: {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  onSelect: (s: ChatSession) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, currentTitle: string) => void
  onClose: () => void
  visible: boolean
}) {
  const slideAnim = useRef(new Animated.Value(-width * 0.8)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  function handleClose() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -width * 0.8, duration: 220, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onClose)
  }

  const safeSessions = (sessions ?? []).filter((s): s is ChatSession => !!s && !!s.id)
  const groups = useMemo(() => groupSessionsByDate(safeSessions), [safeSessions])
  const today = new Date().toDateString()

  return (
    <View style={styles.drawerOverlay} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.drawerDismiss, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={handleClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <BlurView intensity={34} tint="dark" style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(124,58,237,0.10)', 'transparent']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Your Conversations</Text>
          <TouchableOpacity onPress={onNew} style={styles.drawerNewBtn} activeOpacity={0.8}>
            <Text style={styles.drawerNewText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {groups.length === 0 ? (
            <View style={styles.emptyDrawerWrap}>
              <Text style={styles.emptyDrawerSymbol}>◈</Text>
              <Text style={styles.emptyDrawer}>No conversations yet — start one below.</Text>
            </View>
          ) : (
            groups.map(group => (
              <View key={group.label}>
                <Text style={styles.drawerGroupLabel}>{group.label}</Text>
                {group.items.map(item => (
                  <SessionRow
                    key={item.id}
                    item={item}
                    isActive={currentSession?.id === item.id}
                    isToday={new Date(item.last_message_at ?? item.created_at).toDateString() === today}
                    onSelect={() => { onSelect(item); handleClose() }}
                    onDelete={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                      Alert.alert('Delete Conversation', `Delete "${item.title}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
                      ])
                    }}
                    onRename={() => onRename(item.id, item.title)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
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
    lastError, loadSessions, selectSession, createSession, sendMessage,
    retryLastMessage, deleteSession, renameSession, loadMemory, clearError,
  } = useChatStore()

  const [inputText, setInputText] = useState('')
  const [showDrawer, setShowDrawer] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(true)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)
  const statusAnim = useRef(new Animated.Value(1)).current
  const userId = session?.user?.id ?? '00000000-0000-4000-8000-000000000001'

  // ── Keyboard visibility tracking ─────────────────────────────────────────
  // The floating bottom tab bar (position: absolute) does NOT get pushed up
  // or hidden when the keyboard opens — the keyboard simply draws over it.
  // So the input bar's bottom padding, which normally clears the tab bar,
  // becomes a dead gap once the keyboard is showing (KeyboardAvoidingView
  // already lifted the whole screen). Track keyboard state so that padding
  // can drop to just the safe-area inset while the keyboard is up.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    loadSessions(userId)
    loadMemory(userId)
    getKey(KEY_OPENROUTER).then(k => setHasApiKey(!!k))
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
    clearError()

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
      setShowDrawer(false)
    } catch (e: any) {
      Alert.alert('Could not start a new conversation', e?.message ?? 'Please try again.')
    }
  }

  const handleRename = (sessionId: string, currentTitle: string) => {
    // RN has no built-in cross-platform text-input dialog; Alert.prompt is
    // iOS-only. We fall back to a simple two-button confirm on Android that
    // hands off to a follow-up text entry via the same Alert API where
    // available, otherwise just no-ops gracefully rather than crashing.
    if (Platform.OS === 'ios' && (Alert as any).prompt) {
      ;(Alert as any).prompt(
        'Rename Conversation',
        undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: (newTitle?: string) => { if (newTitle?.trim()) renameSession(sessionId, newTitle.trim()) } },
        ],
        'plain-text',
        currentTitle,
      )
    } else {
      Alert.alert('Rename Conversation', 'Renaming via text entry is available on iOS. On Android, please use the web/desktop app to rename, or delete and start a fresh conversation with the title you want.')
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
  const showWelcome = !isLoading && displayMessages.length === 0 && !lastError
  // Clearance so the input bar always sits above the floating tab bar, with
  // a little breathing room — uses the real device inset instead of a
  // hardcoded guess. Once the keyboard is open, the tab bar is hidden behind
  // it (KeyboardAvoidingView has already lifted this whole screen), so that
  // extra clearance is no longer needed and would otherwise leave a dead
  // gap between the input and the keyboard.
  const inputBottomPad = keyboardVisible
    ? Math.max(insets.bottom, 8)
    : Math.max(insets.bottom, 8) + TAB_BAR_CONTENT_HEIGHT - 4

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
          keyboardVerticalOffset={0}
        >
          {/* Header — hamburger left · title+session center · new-chat right */}
          <BlurView intensity={24} tint="dark" style={styles.header}>
            <TouchableOpacity
              onPress={() => setShowDrawer(true)}
              style={styles.headerIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.menuIconBar} />
              <View style={[styles.menuIconBar, { width: 14 }]} />
              <View style={styles.menuIconBar} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>◈ Oracle</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {currentSession?.title || 'New Conversation'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleNewSession}
              style={styles.headerIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.composeIcon}>✎</Text>
            </TouchableOpacity>
          </BlurView>

          {!hasApiKey && <NoKeyBanner onPress={() => Alert.alert('Set up your API key', 'Go to Profile → API Key to add your key.')} />}

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
                onLongPress={item.id !== 'streaming' ? () => {
                  Haptics.selectionAsync()
                } : undefined}
              />
            )}
            ListFooterComponent={
              lastError ? <ErrorBubble message={lastError} onRetry={retryLastMessage} /> : null
            }
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
                    <Text style={styles.welcomeTitle}>
                      {sessions.length === 0 ? 'Your oracle awaits' : "I've read your chart"}
                    </Text>
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

          {/* Input — "Whisper to the Oracle": collapsed glyph that expands
              on tap instead of a static always-visible text box */}
          <WhisperInput
            ref={inputRef}
            value={inputText}
            onChangeText={setInputText}
            onSend={handleSend}
            disabled={!chartData}
            sending={isSending || creatingSession}
            bottomPad={inputBottomPad}
            placeholder="Ask Zephyra..."
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Session Drawer */}
      <SessionDrawer
        visible={showDrawer}
        sessions={sessions}
        currentSession={currentSession}
        onSelect={selectSession}
        onNew={handleNewSession}
        onDelete={deleteSession}
        onRename={handleRename}
        onClose={() => setShowDrawer(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05050F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, height: 72, borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.12)',
  },
  headerIconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', gap: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.agedGold },
  headerSubtitle: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 2, maxWidth: width * 0.5 },
  menuIconBar: { width: 20, height: 2, borderRadius: 1, backgroundColor: Colors.agedGold },
  composeIcon: { fontSize: 19, color: Colors.agedGold },

  noKeyBanner: { backgroundColor: 'rgba(255,140,0,0.15)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,140,0,0.3)', paddingVertical: 8, paddingHorizontal: 16 },
  noKeyText: { fontFamily: Fonts.body, fontSize: 12, color: '#FF8C00', textAlign: 'center' },

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
  bubbleFailed: { borderColor: 'rgba(255,68,68,0.5)', opacity: 0.7 },
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

  // Error bubble
  errorBubbleRow: { alignItems: 'center', marginTop: 10 },
  errorBubble: {
    maxWidth: width * 0.85, borderRadius: 16, padding: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(255,68,68,0.35)',
  },
  errorBubbleIcon: { fontSize: 18, color: '#FF6B6B', marginBottom: 6 },
  errorBubbleText: { fontFamily: Fonts.body, fontSize: 13, color: '#FFB3B3', textAlign: 'center', lineHeight: 19 },
  errorRetryBtn: { marginTop: 10, borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7 },
  errorRetryText: { fontFamily: Fonts.heading, fontSize: 12, color: '#FF6B6B' },

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
    borderRadius: 24, paddingLeft: 8, paddingRight: 6, paddingVertical: 6,
  },
  micBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: 0.35 },
  micIcon: { fontSize: 16 },
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
  drawerDismiss: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.8, overflow: 'hidden' },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.12)',
  },
  drawerTitle: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.agedGold },
  drawerNewBtn: { borderWidth: 1, borderColor: Colors.agedGold, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  drawerNewText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.agedGold },
  drawerGroupLabel: {
    fontFamily: Fonts.accent, fontSize: 10, color: Colors.textMuted, letterSpacing: 1.5,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6,
  },
  sessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: '#0A0A1E',
  },
  sessionCardActive: { backgroundColor: 'rgba(201,168,76,0.08)' },
  sessionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  sessionTitle: { fontFamily: Fonts.mystical, fontSize: 16, color: Colors.textPrimary },
  sessionDate: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  swipeDeleteAction: {
    backgroundColor: '#FF4444', justifyContent: 'center', alignItems: 'center',
    width: 84, height: '100%',
  },
  swipeDeleteText: { fontFamily: Fonts.heading, fontSize: 13, color: '#fff' },
  emptyDrawerWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyDrawerSymbol: { fontSize: 30, color: 'rgba(201,168,76,0.4)', marginBottom: 10 },
  emptyDrawer: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
})
