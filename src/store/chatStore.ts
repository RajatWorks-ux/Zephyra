// src/store/chatStore.ts — PHASE 2 — Supabase backend
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getChatSessions, getChatMessages, saveChatSession,
  saveChatMessage, deleteChatSession, updateChatSessionTitle,
} from '../services/supabase'
import { streamAIResponse, buildChartContext, type AIMessage } from '../services/groqAI'
import { getKey, KEY_GROQ_2 } from '../services/secureKeyStore'
import type { ChartData, Language } from '../types'

export interface ChatSession {
  id: string; title: string; context_type: string; person2_id?: string
  created_at: string; last_message_at: string
}
export interface ChatMessage {
  id: string; session_id: string; role: 'user' | 'assistant' | 'system'
  content: string; created_at: string
}
export interface MemoryStatement {
  id: string; date: string; topic: string; planets_referenced: string[]
  dasha_at_time: string; claim: string; confidence: string
  is_time_bound: boolean; time_bound_until: string | null
  status: 'active' | 'expired' | 'revised'; revision_note: string | null
}
export interface ChatMemory {
  userId: string; statements: MemoryStatement[]; lastUpdated: string
}

const memKey = (uid: string) => `@zephyra_chat_memory_${uid}`

function buildChatSystemPrompt(chartData: ChartData, memory: ChatMemory | null, language: Language | null): string {
  const currentDasha = chartData?.vedic?.mahadasha ?? 'Unknown'
  const currentAntardasha = chartData?.vedic?.antardasha ?? 'Unknown'
  let memorySection = ''
  if (memory?.statements?.length) {
    const now = new Date()
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const active = memory.statements.filter(s => s.status === 'active' && new Date(s.date) > cutoff)
    const expired = memory.statements.filter(s => s.status === 'active' && s.is_time_bound && s.time_bound_until && new Date(s.time_bound_until) < now)
    if (active.length || expired.length) {
      memorySection = `\nMEMORY — WHAT YOU HAVE PREVIOUSLY TOLD THIS USER:\n${active.map(s => `• (${new Date(s.date).toLocaleDateString()}, during ${s.dasha_at_time}): "${s.claim}"`).join('\n')}\n${expired.map(s => `• EXPIRED PREDICTION — reassess: "${s.claim}"`).join('\n')}\n\nDo not deny memory. Acknowledge shifts proactively when relevant.\n`
    }
  }
  const langSection = language && language.code !== 'en-US' ? `LANGUAGE (ABSOLUTE PRIORITY): ${language.promptInstruction}\n\n` : ''
  return `${langSection}${memorySection}\nYou are Zephyra, a warm, wise Vedic Jyotishi. You have read this person's complete birth chart. Every statement is grounded in specific planets, houses, nakshatras, or Dashas — never generic.\n\nCHART CONTEXT:\n${buildChartContext(chartData)}\n\nCONVERSATIONAL RULES:\n- 3-6 paragraphs max. Reference specific chart placements.\n- No bullet points. Flowing paragraphs only.\n- If you have given advice before, reference it from memory.`
}

interface ChatStore {
  sessions: ChatSession[]; currentSession: ChatSession | null
  messages: ChatMessage[]; isLoading: boolean; isSending: boolean
  streamingText: string; memory: ChatMemory | null; isMemoryLoaded: boolean
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

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [], currentSession: null, messages: [], isLoading: false,
  isSending: false, streamingText: '', memory: null, isMemoryLoaded: false,

  loadSessions: async (userId) => {
    try {
      const { data } = await getChatSessions(userId)
      set({ sessions: (data ?? []) as unknown as ChatSession[] })
    } catch (e) { console.error('[ChatStore] loadSessions:', e) }
  },

  loadMessages: async (sessionId) => {
    set({ isLoading: true })
    try {
      const { data } = await getChatMessages(sessionId)
      set({ messages: (data ?? []) as unknown as ChatMessage[], isLoading: false })
    } catch { set({ isLoading: false }) }
  },

  selectSession: async (session) => {
    set({ currentSession: session, messages: [] })
    await get().loadMessages(session.id)
  },

  createSession: async (userId, title, contextType, person2Id) => {
    const { data } = await saveChatSession(userId, title, contextType, person2Id)
    const session = data as unknown as ChatSession
    set(state => ({ sessions: [session, ...state.sessions], currentSession: session, messages: [] }))
    return session
  },

  sendMessage: async (userId, text, chartData, language) => {
    const { currentSession, messages, memory } = get()
    if (!currentSession) return
    const tempMsg: ChatMessage = { id: `temp_${Date.now()}`, session_id: currentSession.id, role: 'user', content: text, created_at: new Date().toISOString() }
    set(state => ({ messages: [...state.messages, tempMsg], isSending: true, streamingText: '' }))

    let history = [...messages, tempMsg].filter(m => m.role !== 'system').slice(-40)
    const estimated = history.reduce((s, m) => s + m.content.length / 4, 0)
    if (estimated > 90000) history = history.slice(-20)

    const systemPrompt = buildChatSystemPrompt(chartData, memory, language)
    const apiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]
    let fullResponse = ''

    await streamAIResponse(apiMessages,
      (chunk) => { fullResponse += chunk; set({ streamingText: fullResponse }) },
      async (completeText) => {
        try {
          await saveChatMessage(currentSession.id, 'user', text)
          await saveChatMessage(currentSession.id, 'assistant', completeText)
        } catch {}
        const assistantMsg: ChatMessage = { id: `assistant_${Date.now()}`, session_id: currentSession.id, role: 'assistant', content: completeText, created_at: new Date().toISOString() }
        set(state => ({ messages: [...state.messages.filter(m => m.id !== tempMsg.id), tempMsg, assistantMsg], isSending: false, streamingText: '' }))
        setTimeout(() => extractAndSaveMemory(userId, completeText, chartData), 500)
      },
      (error) => { console.error('[ChatStore] stream error:', error); set({ isSending: false, streamingText: '' }) },
    )
  },

  loadMemory: async (userId) => {
    try {
      const raw = await AsyncStorage.getItem(memKey(userId))
      set({ memory: raw ? JSON.parse(raw) : null, isMemoryLoaded: true })
    } catch { set({ isMemoryLoaded: true }) }
  },

  deleteSession: (sessionId) => {
    deleteChatSession(sessionId).catch(console.error)
    set(state => ({
      sessions: state.sessions.filter(s => s.id !== sessionId),
      currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
      messages: state.currentSession?.id === sessionId ? [] : state.messages,
    }))
  },

  renameSession: async (sessionId, title) => {
    await updateChatSessionTitle(sessionId, title)
    set(state => ({
      sessions: state.sessions.map(s => s.id === sessionId ? { ...s, title } : s),
      currentSession: state.currentSession?.id === sessionId ? { ...state.currentSession!, title } : state.currentSession,
    }))
  },

  clearStreaming: () => set({ streamingText: '' }),
}))

async function extractAndSaveMemory(userId: string, responseText: string, chartData: ChartData): Promise<void> {
  const key2 = await getKey(KEY_GROQ_2)
  if (!key2) return
  const currentDasha = `${chartData.vedic?.mahadasha ?? 'Unknown'}-${chartData.vedic?.antardasha ?? 'Unknown'}`
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key2}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Extract structured data. Return ONLY valid JSON array, no preamble.' },
          { role: 'user', content: `Extract specific predictions or advice as JSON array. Each item: topic, planets_referenced (array), claim (1 sentence), is_time_bound (bool), time_bound_until (date or null), confidence (high/medium/low). Return [] if nothing extractable. Text: "${responseText.substring(0, 1500)}"` },
        ],
        max_tokens: 400, temperature: 0.1,
      }),
    })
    if (!res.ok) return
    const data = await res.json()
    const extracted = JSON.parse(data?.choices?.[0]?.message?.content ?? '[]')
    if (!Array.isArray(extracted) || !extracted.length) return
    const raw = await AsyncStorage.getItem(memKey(userId))
    const memory: ChatMemory = raw ? JSON.parse(raw) : { userId, statements: [], lastUpdated: '' }
    const newStatements: MemoryStatement[] = extracted.map((e: any) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(), topic: e.topic ?? 'general',
      planets_referenced: e.planets_referenced ?? [], dasha_at_time: currentDasha,
      claim: e.claim ?? '', confidence: e.confidence ?? 'medium',
      is_time_bound: e.is_time_bound ?? false, time_bound_until: e.time_bound_until ?? null,
      status: 'active', revision_note: null,
    }))
    memory.statements = [...memory.statements, ...newStatements].slice(-200)
    memory.lastUpdated = new Date().toISOString()
    await AsyncStorage.setItem(memKey(userId), JSON.stringify(memory))
    useChatStore.setState({ memory })
  } catch {}
                           }

