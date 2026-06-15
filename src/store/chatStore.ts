// src/store/chatStore.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: Complete chat store with Appwrite persistence, streaming, and memory
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getChatSessions,
  getChatMessages,
  saveChatSession,
  saveChatMessage,
  deleteChatSession,
  updateChatSessionTitle,
} from '../services/appwriteService'
import { streamAIResponse, buildChartContext, type AIMessage } from '../services/groqAI'
import { getKey, KEY_GROQ_2 } from '../services/secureKeyStore'
import type { ChartData, Language } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
  $id: string
  title: string
  context_type: string
  person2_id?: string
  created_at: string
  last_message_at: string
}

export interface ChatMessage {
  $id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface MemoryStatement {
  id: string
  date: string
  topic: 'career' | 'finance' | 'relationship' | 'health' | 'spiritual' | 'timing' | 'general'
  planets_referenced: string[]
  dasha_at_time: string
  claim: string
  confidence: 'high' | 'medium' | 'low'
  is_time_bound: boolean
  time_bound_until: string | null
  status: 'active' | 'expired' | 'revised'
  revision_note: string | null
}

export interface ChatMemory {
  userId: string
  statements: MemoryStatement[]
  lastUpdated: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ChatStore {
  sessions: ChatSession[]
  currentSession: ChatSession | null
  messages: ChatMessage[]
  isLoading: boolean
  isSending: boolean
  streamingText: string
  memory: ChatMemory | null
  isMemoryLoaded: boolean

  loadSessions: (userId: string) => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  selectSession: (session: ChatSession) => Promise<void>
  createSession: (userId: string, title: string, contextType: string, person2Id?: string) => Promise<ChatSession>
  sendMessage: (userId: string, text: string, chartData: ChartData, language: Language | null) => Promise<void>
  loadMemory: (userId: string) => Promise<void>
  deleteSession: (sessionId: string) => void
  renameSession: (sessionId: string, title: string) => Promise<void>
  clearStreaming: () => void
}

// ── AsyncStorage keys ─────────────────────────────────────────────────────────
const memoryKey = (uid: string) => `@zephyra_chat_memory_${uid}`

// ── Build chat system prompt ──────────────────────────────────────────────────
function buildChatSystemPrompt(
  chartData: ChartData,
  memory: ChatMemory | null,
  language: Language | null,
): string {
  const now = new Date()
  const currentDasha = chartData?.vedic?.mahadasha ?? 'Unknown'
  const currentAntardasha = chartData?.vedic?.antardasha ?? 'Unknown'

  // ── Memory injection ────────────────────────────────────────────────────────
  let memorySection = ''
  if (memory && memory.statements.length > 0) {
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
    const active = memory.statements.filter(s =>
      s.status === 'active' && new Date(s.date) > cutoff
    )
    const expired = memory.statements.filter(s => {
      if (s.status !== 'active' || !s.is_time_bound || !s.time_bound_until) return false
      return new Date(s.time_bound_until) < now
    })
    const dashaChanged = memory.statements.filter(s =>
      s.status === 'active' && s.dasha_at_time !== `${currentDasha}-${currentAntardasha}`
    )

    if (active.length > 0 || expired.length > 0) {
      memorySection = `\n═══════════════════════════════════════
MEMORY — WHAT YOU HAVE PREVIOUSLY TOLD THIS USER
═══════════════════════════════════════
${active.map(s => `• You told this user (${new Date(s.date).toLocaleDateString()}, during ${s.dasha_at_time}): "${s.claim}"`).join('\n')}
${expired.map(s => `• EXPIRED PREDICTION — reassess if relevant: "${s.claim}" (said during ${s.dasha_at_time})`).join('\n')}
${dashaChanged.length > 0 ? `\nNOTE: The following statements were made during a different Dasha. The astrological context has shifted:\n${dashaChanged.map(s => `• "${s.claim}" (said during ${s.dasha_at_time}, now in ${currentDasha}-${currentAntardasha})`).join('\n')}` : ''}

MEMORY RULES: Do not deny having said things in memory. If the situation has changed, proactively acknowledge it when relevant. Do not repeat the same advice verbatim.\n`
    }
  }

  const langSection = language && language.code !== 'en-US'
    ? `LANGUAGE (ABSOLUTE PRIORITY): ${language.promptInstruction} — respond entirely in this language.\n\n`
    : ''

  return `${langSection}${memorySection}
═══════════════════════════════════════
IDENTITY
═══════════════════════════════════════
You are Zephyra, a warm, wise, and deeply knowledgeable Vedic Jyotishi (astrologer). You have read this person's complete birth chart. You remember everything you have told them across all sessions. Your tone is direct, compassionate, and specific — never generic. Every statement you make is grounded in a specific planet, house, nakshatra, or Dasha period from this person's actual chart. You never give generic horoscope content.

═══════════════════════════════════════
THIS PERSON'S BIRTH CHART CONTEXT
═══════════════════════════════════════
${buildChartContext(chartData)}

═══════════════════════════════════════
CONVERSATIONAL RULES
═══════════════════════════════════════
- Keep responses conversational: 3-6 paragraphs maximum
- Reference specific planets, houses, and Dashas from the chart above
- If asked about the future, use Dasha timing
- If you have given advice on this topic before (see MEMORY above), reference it
- Do not deny what you previously said — acknowledge and refine if needed
- Never use bullet points in responses — flowing paragraphs only
- End difficult truths with context and agency, not despair`
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  isLoading: false,
  isSending: false,
  streamingText: '',
  memory: null,
  isMemoryLoaded: false,

  loadSessions: async (userId) => {
    try {
      const docs = await getChatSessions(userId)
      set({ sessions: docs as unknown as ChatSession[] })
    } catch (e) {
      console.error('[ChatStore] loadSessions error:', e)
    }
  },

  loadMessages: async (sessionId) => {
    set({ isLoading: true })
    try {
      const docs = await getChatMessages(sessionId)
      set({ messages: docs as unknown as ChatMessage[], isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  selectSession: async (session) => {
    set({ currentSession: session, messages: [] })
    await get().loadMessages(session.$id)
  },

  createSession: async (userId, title, contextType, person2Id) => {
    const doc = await saveChatSession(userId, title, contextType, person2Id)
    const session = doc as unknown as ChatSession
    set(state => ({ sessions: [session, ...state.sessions], currentSession: session, messages: [] }))
    return session
  },

  sendMessage: async (userId, text, chartData, language) => {
    const { currentSession, messages, memory } = get()
    if (!currentSession) return

    // Add user message optimistically
    const tempUserMsg: ChatMessage = {
      $id: `temp_${Date.now()}`,
      session_id: currentSession.$id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    set(state => ({
      messages: [...state.messages, tempUserMsg],
      isSending: true,
      streamingText: '',
    }))

    // Build message history for GROQ (last 40 messages, reduce if too large)
    let historyMessages = [...messages, tempUserMsg]
      .filter(m => m.role !== 'system')
      .slice(-40)

    // Estimate tokens (rough: chars / 4)
    const estimatedTokens = historyMessages.reduce((sum, m) => sum + m.content.length / 4, 0)
    if (estimatedTokens > 90000) historyMessages = historyMessages.slice(-20)
    if (estimatedTokens > 110000) historyMessages = historyMessages.slice(-10)

    const systemPrompt = buildChatSystemPrompt(chartData, memory, language)
    const apiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    let fullResponse = ''

    await streamAIResponse(
      apiMessages,
      (chunk) => {
        fullResponse += chunk
        set({ streamingText: fullResponse })
      },
      async (completeText) => {
        // Save both messages to Appwrite
        try {
          await saveChatMessage(currentSession.$id, 'user', text)
          await saveChatMessage(currentSession.$id, 'assistant', completeText)
        } catch {}

        const assistantMsg: ChatMessage = {
          $id: `assistant_${Date.now()}`,
          session_id: currentSession.$id,
          role: 'assistant',
          content: completeText,
          created_at: new Date().toISOString(),
        }
        set(state => ({
          messages: [...state.messages.filter(m => m.$id !== tempUserMsg.$id), tempUserMsg, assistantMsg],
          isSending: false,
          streamingText: '',
        }))

        // Background memory extraction (non-blocking, uses key 2)
        setTimeout(() => {
          get().extractAndSaveMemory(userId, completeText, chartData)
        }, 500)
      },
      (error) => {
        console.error('[ChatStore] Stream error:', error)
        set({ isSending: false, streamingText: '' })
      },
    )
  },

  loadMemory: async (userId) => {
    try {
      const raw = await AsyncStorage.getItem(memoryKey(userId))
      if (raw) {
        set({ memory: JSON.parse(raw), isMemoryLoaded: true })
      } else {
        set({ isMemoryLoaded: true })
      }
    } catch {
      set({ isMemoryLoaded: true })
    }
  },

  deleteSession: (sessionId) => {
    deleteChatSession(sessionId).catch(console.error)
    set(state => ({
      sessions: state.sessions.filter(s => s.$id !== sessionId),
      currentSession: state.currentSession?.$id === sessionId ? null : state.currentSession,
      messages: state.currentSession?.$id === sessionId ? [] : state.messages,
    }))
  },

  renameSession: async (sessionId, title) => {
    await updateChatSessionTitle(sessionId, title)
    set(state => ({
      sessions: state.sessions.map(s => s.$id === sessionId ? { ...s, title } : s),
      currentSession: state.currentSession?.$id === sessionId
        ? { ...state.currentSession, title }
        : state.currentSession,
    }))
  },

  clearStreaming: () => set({ streamingText: '' }),
}))

// ── Background memory extraction (called after each AI response) ──────────────
// This is a module-level function to avoid circular store references
async function extractAndSaveMemoryImpl(
  userId: string,
  responseText: string,
  chartData: ChartData,
): Promise<void> {
  const key2 = await getKey(KEY_GROQ_2)
  if (!key2) return

  const currentDasha = `${chartData.vedic?.mahadasha ?? 'Unknown'}-${chartData.vedic?.antardasha ?? 'Unknown'}`

  const extractionPrompt = `Extract any specific predictions, advice, or claims from this astrology reading response as a JSON array.
Each item must have: topic (career/finance/relationship/health/spiritual/timing/general), planets_referenced (array of planet names mentioned), claim (one sentence summary), is_time_bound (boolean), time_bound_until (date string or null), confidence (high/medium/low).
Return empty array [] if no extractable specific claims.
Response to analyze: "${responseText.substring(0, 1500)}"`

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key2}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You extract structured data from text. Return ONLY valid JSON array, no preamble.' },
          { role: 'user', content: extractionPrompt },
        ],
        max_tokens: 400,
        temperature: 0.1,
      }),
    })
    if (!res.ok) return
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? '[]'
    const extracted = JSON.parse(content.trim())
    if (!Array.isArray(extracted) || extracted.length === 0) return

    // Load existing memory
    const raw = await AsyncStorage.getItem(memoryKey(userId))
    const memory: ChatMemory = raw ? JSON.parse(raw) : { userId, statements: [], lastUpdated: '' }

    // Add new statements
    const newStatements: MemoryStatement[] = extracted.map((e: any) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      topic: e.topic ?? 'general',
      planets_referenced: e.planets_referenced ?? [],
      dasha_at_time: currentDasha,
      claim: e.claim ?? '',
      confidence: e.confidence ?? 'medium',
      is_time_bound: e.is_time_bound ?? false,
      time_bound_until: e.time_bound_until ?? null,
      status: 'active',
      revision_note: null,
    }))

    memory.statements = [...memory.statements, ...newStatements]
    memory.lastUpdated = new Date().toISOString()

    // Cap at 200 statements — prune oldest expired/revised/general first
    if (memory.statements.length > 200) {
      const priority = ['expired', 'revised', 'active']
      const topics = ['general', 'timing', 'spiritual', 'health', 'career', 'finance', 'relationship']
      memory.statements.sort((a, b) => {
        const statusDiff = priority.indexOf(a.status) - priority.indexOf(b.status)
        if (statusDiff !== 0) return -statusDiff
        return topics.indexOf(a.topic) - topics.indexOf(b.topic)
      })
      memory.statements = memory.statements.slice(0, 200)
    }

    await AsyncStorage.setItem(memoryKey(userId), JSON.stringify(memory))

    // Update store
    useChatStore.setState({ memory })
  } catch {
    // Silent failure — memory extraction is non-critical
  }
}

// Attach to store after definition
useChatStore.setState({} as any)
// @ts-ignore
useChatStore.getState().extractAndSaveMemory = extractAndSaveMemoryImpl
