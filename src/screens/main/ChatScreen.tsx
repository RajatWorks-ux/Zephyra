// src/screens/main/ChatScreen.tsx — PHASE 2 FULL BUILD
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  Alert, Dimensions, ScrollView,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useChatStore, type ChatMessage, type ChatSession } from '../../store/chatStore'
import { useReadingStore } from '../../store/readingStore'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

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
      <BlurView intensity={isUser ? 15 : 12} tint="dark" style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={styles.bubbleText}>{message.content}</Text>
        {isStreaming && (
          <View style={styles.streamingDots}>
            {[0, 1, 2].map(i => (
              <StreamDot key={i} delay={i * 100} />
            ))}
          </View>
        )}
        <Text style={styles.bubbleTime}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </BlurView>
    </View>
  )
}

function StreamDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return <Animated.View style={[styles.streamDot, { transform: [{ translateY: anim }] }]} />
}

// ── Session drawer ─────────────────────────────────────────────────────────────
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
  return (
    <View style={styles.drawerOverlay}>
      <TouchableOpacity style={styles.drawerDismiss} onPress={onClose} activeOpacity={1} />
      <BlurView intensity={30} tint="dark" style={styles.drawer}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>Your Conversations</Text>
          <TouchableOpacity onPress={onNew} style={styles.drawerNewBtn}>
            <Text style={styles.drawerNewText}>+ New</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={sessions}
          keyExtractor={s => s.id}
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
            >
              <View style={styles.sessionDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.sessionDate}>
                  {new Date(item.last_message_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyDrawer}>No conversations yet</Text>}
        />
      </BlurView>
    </View>
  )
}

// ── Main ChatScreen ────────────────────────────────────────────────────────────
export function ChatScreen() {
  const { session } = useAuthStore()
  const { chartData } = useReadingStore()
  const { currentLanguage } = useSettingsStore()
  const {
    sessions, currentSession, messages, isLoading, isSending, streamingText,
    loadSessions, selectSession, createSession, sendMessage, deleteSession, loadMemory,
  } = useChatStore()

  const [inputText, setInputText] = useState('')
  const [showDrawer, setShowDrawer] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const statusAnim = useRef(new Animated.Value(1)).current
  const userId = session?.user?.id ?? 'mock-user-001'

  useEffect(() => {
    loadSessions(userId)
    loadMemory(userId)
  }, [userId])

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
    if (!text || isSending || !chartData) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setInputText('')

    let session_id = currentSession
    if (!session_id) {
      session_id = await createSession(userId, text.slice(0, 40) || 'New Chat', 'personal')
    }
    await sendMessage(userId, text, chartData, currentLanguage)
  }

  const handleSuggestion = (text: string) => {
    setInputText(text)
  }

  const handleNewSession = async () => {
    const title = `Chat ${new Date().toLocaleDateString()}`
    await createSession(userId, title, 'personal')
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

  return (
    <View style={styles.root}>
      {/* Background */}
      <Video
        source={Videos.signInBg}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        isLooping shouldPlay isMuted
        onError={() => {}}
      />
      <LinearGradient
        colors={['rgba(5,5,15,0.45)', 'rgba(5,5,15,0.92)']}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
          {/* Header */}
          <BlurView intensity={20} tint="dark" style={styles.header}>
            <View style={styles.headerLeft}>
              <LinearGradient colors={['#7C3AED', '#C9A84C']} style={styles.avatarCircle}>
                <Text style={styles.avatarSymbol}>◈</Text>
              </LinearGradient>
              <View>
                <Text style={styles.headerName}>Zephyra</Text>
                <Animated.View style={{ opacity: statusAnim }}>
                  <Text style={[styles.headerStatus, { color: isSending ? '#FF8C00' : '#44FF88' }]}>
                    {isSending ? '✦ Reading the cosmos...' : '✦ Online'}
                  </Text>
                </Animated.View>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowDrawer(true)} style={styles.menuBtn}>
              <Text style={styles.menuIcon}>≡</Text>
            </TouchableOpacity>
          </BlurView>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            keyExtractor={m => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messagesList}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isStreaming={item.id === 'streaming'}
              />
            )}
            ListEmptyComponent={
              showWelcome ? (
                <View style={styles.welcomeWrap}>
                  <BlurView intensity={15} tint="dark" style={styles.welcomeCard}>
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
          <BlurView intensity={25} tint="dark" style={styles.inputWrap}>
            <TextInput
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
              style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnOff]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSending || !chartData}
            >
              {isSending
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
    paddingHorizontal: 16, height: 72, borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,0.1)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarSymbol: { fontSize: 20, color: '#fff' },
  headerName: { fontFamily: Fonts.heading, fontSize: 16, color: Colors.agedGold },
  headerStatus: { fontFamily: Fonts.body, fontSize: 11, marginTop: 2 },
  menuBtn: { padding: 8 },
  menuIcon: { fontSize: 22, color: Colors.textSecondary },
  messagesList: { paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 24 },
  bubbleRow: { marginVertical: 5, maxWidth: '85%' },
  bubbleRowUser: { alignSelf: 'flex-end' },
  bubbleRowBot: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 20, padding: 12, overflow: 'hidden',
    borderWidth: 1,
  },
  bubbleUser: {
    borderTopRightRadius: 4,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  bubbleBot: {
    borderTopLeftRadius: 4,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  bubbleText: { fontFamily: Fonts.body, fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  bubbleTime: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 6, textAlign: 'right' },
  streamingDots: { flexDirection: 'row', gap: 4, marginTop: 8 },
  streamDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#7C3AED' },
  systemBubble: {
    alignSelf: 'center', backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginVertical: 8,
  },
  systemText: { fontFamily: Fonts.mystical, fontSize: 12, color: Colors.agedGold, textAlign: 'center' },
  welcomeWrap: { flex: 1, padding: 20, paddingTop: 40 },
  welcomeCard: {
    borderRadius: 24, padding: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)',
  },
  welcomeSymbol: { fontSize: 40, color: Colors.nebulaCyan, textAlign: 'center', marginBottom: 14 },
  welcomeTitle: { fontFamily: Fonts.heading, fontSize: 18, color: Colors.agedGold, textAlign: 'center', marginBottom: 12 },
  welcomeSub: { fontFamily: Fonts.mystical, fontSize: 16, color: Colors.textSecondary, textAlign: 'center', lineHeight: 26, marginBottom: 20 },
  chips: { marginTop: 4 },
  chip: {
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, marginRight: 10,
    backgroundColor: 'rgba(201,168,76,0.06)',
  },
  chipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.agedGold },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12,
    paddingVertical: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: 'rgba(201,168,76,0.1)',
    minHeight: 64, marginBottom: 80,
  },
  input: {
    flex: 1, fontFamily: Fonts.body, fontSize: 15, color: Colors.textPrimary,
    maxHeight: 120, paddingVertical: 8, paddingRight: 12, lineHeight: 22,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginBottom: 2 },
  sendBtnOff: { opacity: 0.4 },
  sendBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  // Drawer
  drawerOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 100 },
  drawerDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: { width: width * 0.78, overflow: 'hidden' },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 64, borderBottomWidth: 1, borderBottomColor: 'rgba(201,168,76,0.1)',
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
  emptyDrawer: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
})
