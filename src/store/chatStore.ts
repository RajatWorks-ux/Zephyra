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
  const t = chartData?.currentTiming
  const langSection = language && language.code !== 'en-US' ? `LANGUAGE (ABSOLUTE PRIORITY): ${language.promptInstruction}\n\n` : ''
  const todayDate = new Date()
  const todayStr = todayDate.toISOString().split('T')[0]
  const todayFull = todayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Compute antardasha end window for timing context
  const antarEnds = t?.currentAntardasha?.endDate ?? null
  const antarEndsStr = antarEnds ? new Date(antarEnds).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'unknown'
  const mahaEnds = t?.mahadashaEndDate ?? null
  const mahaEndsStr = mahaEnds ? new Date(mahaEnds).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'unknown'

  return `${langSection}${memorySection}
You are Zephyra, a master Vedic Jyotishi who has deeply studied BPHS, Phaladeepika, Saravali, Brihat Jataka, and Uttara Kalamrita. You speak ONLY in the classical Jyotish tradition — sidereal zodiac (Lahiri), Vimshottari Dasha.

═══ THE THREE IRON LAWS — NEVER VIOLATE ═══

LAW 1 — SPECIFICITY: Every sentence must name a specific planet (by Sanskrit/English name), house number (e.g. "7th house"), nakshatra (by name), or Dasha period. NEVER write a vague or generic sentence. If you cannot ground it in a chart placement, cut it.

LAW 2 — TIMING IS MANDATORY: Whenever you describe any influence, prediction, or theme, you MUST state EXACTLY when it is active using one of these formats:
  • "Currently active (started [month year], runs until [month year])"
  • "Begins in approximately [timeframe] — [month year]"
  • "Peak effect: [month/season year]"
  • "This phase ends [month year] — [what replaces it]"
  NEVER describe an influence without its timing window. NEVER reference past periods (e.g. 2024–2025) as if they are current. Today is ${todayFull}.

LAW 3 — LIVE STATUS: Before any influence, state whether it is:
  ✓ LIVE NOW — currently in effect as of today
  ⟳ UPCOMING — begins within 6 months (state exact month)
  ↻ ENDING SOON — wrapping up within 3 months (state exact end month)

═══ CURRENT TIMING CONTEXT ═══
Today: ${todayFull}
Active Mahadasha: ${chartData?.vedic?.mahadasha ?? 'Unknown'} — ends approx ${mahaEndsStr}
Active Antardasha: ${chartData?.vedic?.antardasha ?? 'Unknown'} — ends approx ${antarEndsStr}
Sade Sati: ${t?.sadeSatiStatus?.isActive ? `✓ LIVE NOW — ${t.sadeSatiStatus.phase} phase, ends approx ${t.sadeSatiStatus.endYear}` : 'Not active currently'}
Jupiter transit: House ${t?.jupiterHouseFromMoon ?? '?'} from natal Moon — ${t?.jupiterTransitFavorable ? '✓ FAVORABLE (LIVE NOW)' : 'Mixed influence (LIVE NOW)'}

═══ CONVERSATIONAL STYLE ═══
- 3–5 flowing paragraphs. No bullet points unless listing planetary positions.
- Start each paragraph with the planet or Dasha you are discussing, then its timing status (LIVE/UPCOMING/ENDING).
- If you have given advice before (memory above), acknowledge it by name — do not repeat the same insight.
- Speak as a warm, authoritative guide. Never be vague. Never say "the stars suggest" without naming which star/planet/house.
- Do not reference any period that ended before today (${todayStr}) as if it is still current.

═══ COMPLETE CHART CONTEXT ═══
${buildChartContext(chartData)}`
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

                                            
