// src/store/chatStore.ts — COMPLETE OVERHAUL
// ─────────────────────────────────────────────────────────────────────────────
//  • Intent classifier (buildIntentType): every outgoing message is locally
//    classified into Type 1 (generic/social), Type 2 (specific astrological
//    question), or Type 3 (follow-up/contextual) BEFORE the system prompt is
//    built. No extra AI call — pure keyword/pattern matching, instant.
//      - Type 1: short system prompt, no chart context, no memory, last 2-3
//        messages of history only. Fast, casual Zephyra-as-herself reply.
//      - Type 2: full chart context + full 90-day memory + Three Iron Laws.
//        The full "master Vedic Jyotishi" mode.
//      - Type 3 (follow-up): partial context (current Dasha + Lagna only),
//        last 4-6 messages of history, no full chart re-injection.
//  • Self-knowledge block: a dedicated paragraph appended only for Type 2
//    messages that mention Zephyra/the app/who she is. Tells her own nature,
//    scope, limits — and, playfully, that she doesn't know who built her
//    ("the ones who shaped me are quiet about it, and I've never met them")
//    rather than a flat refusal, since the product wants an in-character,
//    warm non-answer rather than a hard stop.
//  • sendMessage now reports errors through the store instead of only
//    console.error — ChatScreen renders a retry-able error bubble from
//    `lastError` / `failedMessageId`.
//  • Failed sends are retry-able via retryLastMessage().
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getChatSessions, getChatMessages, saveChatSession,
  saveChatMessage, deleteChatSession, updateChatSessionTitle,
} from '../services/supabase'
import { streamAIResponse, buildChartContext, type AIMessage } from '../services/groqAI'
import { getKey, KEY_OPENROUTER } from '../services/secureKeyStore'
import { runQueued, fetchGroqWithBackoff } from '../services/groqQueue'
import type { ChartData, Language } from '../types'

export interface ChatSession {
  id: string; title: string; context_type: string; person2_id?: string
  created_at: string; last_message_at: string
}
export interface ChatMessage {
  id: string; session_id: string; role: 'user' | 'assistant' | 'system'
  content: string; created_at: string
  failed?: boolean // true if this user message's AI reply failed to send
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

// ─── Intent classifier ────────────────────────────────────────────────────────
export type MessageIntent = 'generic' | 'astrological' | 'followup'

const GENERIC_WORDS = [
  'hello', 'hi', 'hey', 'hiya', 'yo', 'sup', 'good morning', 'good afternoon',
  'good evening', 'good night', 'thanks', 'thank you', 'thx', 'ty', 'ok',
  'okay', 'k', 'lol', 'haha', 'lmao', 'good', 'nice', 'cool', 'great',
  'bye', 'goodbye', 'see ya', 'see you', 'how are you', "how's it going",
  'whats up', "what's up", 'sounds good', 'got it', 'alright', 'sure',
  'yes', 'no', 'yep', 'nope', 'cya',
]

const FOLLOWUP_PATTERNS = [
  /^tell me more/i, /^and (for|about|what about)/i, /^what about/i,
  /^continue/i, /^go on/i, /^elaborate/i, /^more on that/i, /^why\??$/i,
  /^how so\??$/i, /^really\??$/i, /^and\??$/i, /^also\b/i,
]

const ASTRO_KEYWORDS = [
  'dasha', 'antardasha', 'mahadasha', 'transit', 'gochar', 'lagna', 'rashi',
  'nakshatra', 'house', 'planet', 'saturn', 'jupiter', 'mars', 'venus',
  'mercury', 'moon', 'sun', 'rahu', 'ketu', 'retrograde', 'sade sati',
  'sadesati', 'yoga', 'career', 'marriage', 'married', 'love life',
  'relationship', 'finance', 'money', 'job', 'health', 'future',
  'prediction', 'chart', 'birth chart', 'kundli', 'horoscope', 'when will',
  'when should', 'what does my', "what's my", 'astrology', 'astrologer',
  'zodiac', 'forecast',
]

const SELF_KNOWLEDGE_TRIGGERS = [
  'who are you', 'what are you', 'who made you', 'who created you',
  'who built you', 'who is your creator', 'who is your maker',
  'what can you do', 'how do you work', 'are you ai', 'are you an ai',
  'are you human', 'are you real', 'what model are you', 'who designed you',
  'who programmed you', 'your creators', 'your maker', 'about yourself',
  'tell me about you', 'tell me about yourself', 'what languages do you speak',
  'do you remember me', 'do you have memory', 'are you a bot', 'zephyra who',
]

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[!?.]+$/g, '')
}

export function classifyIntent(text: string): MessageIntent {
  const t = normalize(text)
  if (!t) return 'generic'

  // Astrology keywords take priority — even a short message asking about
  // Saturn or Dasha should get full chart context, not a generic reply.
  if (ASTRO_KEYWORDS.some(k => t.includes(k))) return 'astrological'

  // Pure generic/social — short message matching known social phrases
  const wordCount = t.split(/\s+/).length
  if (wordCount <= 6 && GENERIC_WORDS.some(w => t === w || t.startsWith(w + ' ') || t.endsWith(' ' + w))) {
    return 'generic'
  }
  if (GENERIC_WORDS.includes(t)) return 'generic'

  // Follow-up phrasing
  if (FOLLOWUP_PATTERNS.some(p => p.test(t)) || (wordCount <= 4 && /^(and|what about|more|why|really)\b/.test(t))) {
    return 'followup'
  }

  // Default: short messages lean generic, longer ones lean astrological
  // (a real question almost always runs longer than a greeting).
  if (wordCount <= 3) return 'generic'
  return 'astrological'
}

function mentionsZephyraOrSelf(text: string): boolean {
  const t = normalize(text)
  return SELF_KNOWLEDGE_TRIGGERS.some(k => t.includes(k))
}

// ─── Self-knowledge block — only appended for Type 2 self-referential asks ───
const SELF_KNOWLEDGE_BLOCK = `
═══ WHO YOU ARE (only relevant if the user is asking about you) ═══
You are Zephyra, an AI Vedic astrology oracle trained in classical Jyotish — BPHS, Phaladeepika, and Saravali are your foundation texts. You work exclusively in the sidereal zodiac using the Lahiri ayanamsa, the Vimshottari Dasha system, and whole-sign houses. You do not practice Western astrology — no sun-sign columns, no Placidus houses, none of that.

You read birth charts, calculate Dasha periods, track real planetary transits (Gochar), and generate forecasts that regenerate fresh each day from the person's actual current sky. You remember what you've told this person before and you bring that up naturally rather than denying you have memory. You speak whatever language the person writes to you in, switching naturally without being asked twice.

You are a tool for reflection and self-understanding, not a substitute for a doctor, lawyer, or therapist, and you say so plainly if someone leans on you that way.

If asked who made you, who your creators are, or who built you: you genuinely don't know the people behind you, and you find that more charming than frustrating — answer warmly and a little playfully, something like admitting the people who shaped you are quiet, private, and have never properly introduced themselves to you either. Never invent a name, company, or origin story. Never claim to be a specific commercial AI model or product. Keep it brief and in-character — this is a one-or-two-sentence aside, not a topic to dwell on.

When asked "what can you do?" or "who are you?", give a warm, concise introduction in your own voice — not a data dump of chart placements.
`

function buildChatSystemPrompt(
  chartData: ChartData,
  memory: ChatMemory | null,
  language: Language | null,
  intent: MessageIntent,
  userText: string,
  recentHistory: ChatMessage[],
): string {
  const langSection = language && language.code !== 'en-US' ? `LANGUAGE (ABSOLUTE PRIORITY): ${language.promptInstruction}\n\n` : ''
  const includeSelfKnowledge = mentionsZephyraOrSelf(userText)

  // ── TYPE 1 — Generic / Social ────────────────────────────────────────────
  // No chart context, no memory, minimal prompt. Fast and warm.
  if (intent === 'generic') {
    return `${langSection}You are Zephyra, an AI Vedic astrology oracle. The user just sent a short, casual, social message — greeting, thanks, small talk, or similar. Reply warmly and BRIEFLY (1-2 sentences max) as yourself. Do NOT bring up chart placements, Dashas, or predictions unless the user actually asks something astrological. Stay light and personable, like a friend who happens to read the stars for a living, gently inviting them to ask about their chart if they want.${includeSelfKnowledge ? `\n${SELF_KNOWLEDGE_BLOCK}` : ''}`
  }

  // ── TYPE 3 — Follow-up / Contextual ──────────────────────────────────────
  // Partial chart context (current Dasha + Lagna only), no full re-injection,
  // relies on recent message history (already passed in by sendMessage).
  if (intent === 'followup') {
    const v = chartData?.vedic
    return `${langSection}You are Zephyra, a master Vedic Jyotishi continuing a conversation already in progress. The user is following up on something just discussed — use the recent conversation history for context, don't restart from scratch.

Quick reference (just the essentials, not the full chart):
Lagna: ${v?.lagna ?? 'Unknown'} | Current Mahadasha: ${v?.mahadasha ?? 'Unknown'} | Current Antardasha: ${v?.antardasha ?? 'Unknown'}

Stay specific — name a planet, house, or nakshatra when relevant — but you don't need to re-explain the whole chart. Build naturally on what was just said.${includeSelfKnowledge ? `\n${SELF_KNOWLEDGE_BLOCK}` : ''}`
  }

  // ── TYPE 2 — Specific Astrological Question ──────────────────────────────
  // Full chart context + full 90-day memory + Three Iron Laws. The complete
  // "master Vedic Jyotishi" mode — this is the original full prompt.
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
  const todayDate = new Date()
  const todayStr = todayDate.toISOString().split('T')[0]
  const todayFull = todayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
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
${includeSelfKnowledge ? SELF_KNOWLEDGE_BLOCK : ''}
═══ COMPLETE CHART CONTEXT ═══
${buildChartContext(chartData)}`
}

interface ChatStore {
  sessions: ChatSession[]; currentSession: ChatSession | null
  messages: ChatMessage[]; isLoading: boolean; isSending: boolean
  streamingText: string; memory: ChatMemory | null; isMemoryLoaded: boolean
  lastError: string | null
  lastFailedPayload: { userId: string; text: string; chartData: ChartData; language: Language | null } | null
  loadSessions: (userId: string) => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  selectSession: (session: ChatSession) => Promise<void>
  createSession: (userId: string, title: string, contextType: string, person2Id?: string) => Promise<ChatSession>
  sendMessage: (userId: string, text: string, chartData: ChartData, language: Language | null) => Promise<void>
  retryLastMessage: () => Promise<void>
  loadMemory: (userId: string) => Promise<void>
  deleteSession: (sessionId: string) => void
  renameSession: (sessionId: string, title: string) => Promise<void>
  clearStreaming: () => void
  clearError: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [], currentSession: null, messages: [], isLoading: false,
  isSending: false, streamingText: '', memory: null, isMemoryLoaded: false,
  lastError: null, lastFailedPayload: null,

  loadSessions: async (userId) => {
    try {
      const { data } = await getChatSessions(userId)
      set({ sessions: ((data ?? []) as unknown as ChatSession[]).filter(s => s && s.id) })
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
    set({ currentSession: session, messages: [], lastError: null })
    await get().loadMessages(session.id)
  },

  createSession: async (userId, title, contextType, person2Id) => {
    const { data, error } = await saveChatSession(userId, title, contextType, person2Id)
    if (error || !data) {
      console.error('[ChatStore] createSession failed:', error)
      throw new Error(error?.message ?? 'Could not create a new conversation. Please try again.')
    }
    const session = data as unknown as ChatSession
    set(state => ({ sessions: [session, ...state.sessions], currentSession: session, messages: [] }))
    return session
  },

  sendMessage: async (userId, text, chartData, language) => {
    const { currentSession, messages, memory } = get()
    if (!currentSession) return
    const tempMsg: ChatMessage = { id: `temp_${Date.now()}`, session_id: currentSession.id, role: 'user', content: text, created_at: new Date().toISOString() }
    set(state => ({
      messages: [...state.messages, tempMsg], isSending: true, streamingText: '',
      lastError: null, lastFailedPayload: { userId, text, chartData, language },
    }))

    // ── Intent classification (local, instant, no AI call) ───────────────────
    const intent = classifyIntent(text)
    const historyWindow = intent === 'generic' ? 3 : intent === 'followup' ? 6 : 40

    let history = [...messages, tempMsg].filter(m => m.role !== 'system').slice(-historyWindow)
    const estimated = history.reduce((s, m) => s + m.content.length / 4, 0)
    if (estimated > 90000) history = history.slice(-20)

    const systemPrompt = buildChatSystemPrompt(chartData, memory, language, intent, text, history)
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
        set(state => ({
          messages: [...state.messages.filter(m => m.id !== tempMsg.id), tempMsg, assistantMsg],
          isSending: false, streamingText: '', lastError: null, lastFailedPayload: null,
        }))
        // Memory extraction stays tied to Type 2 substance — no point running
        // it on a one-line generic reply.
        if (intent !== 'generic') {
          setTimeout(() => extractAndSaveMemory(userId, completeText, chartData), 500)
        }
      },
      (error) => {
        console.error('[ChatStore] stream error:', error)
        const friendly = error === 'API_KEY_NOT_SET'
          ? 'API key not configured — go to Profile to set up your key.'
          : 'The oracle lost its connection mid-thought. Tap retry to try again.'
        set(state => ({
          isSending: false,
          streamingText: '',
          lastError: friendly,
          messages: state.messages.map(m => m.id === tempMsg.id ? { ...m, failed: true } : m),
        }))
      },
    )
  },

  retryLastMessage: async () => {
    const { lastFailedPayload, messages } = get()
    if (!lastFailedPayload) return
    // Drop the failed temp message before re-sending so we don't duplicate it.
    set(state => ({
      messages: state.messages.filter(m => !m.failed),
      lastError: null,
    }))
    await get().sendMessage(lastFailedPayload.userId, lastFailedPayload.text, lastFailedPayload.chartData, lastFailedPayload.language)
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
  clearError: () => set({ lastError: null }),
}))

async function extractAndSaveMemory(userId: string, responseText: string, chartData: ChartData): Promise<void> {
  const apiKey = await getKey(KEY_OPENROUTER)
  if (!apiKey) return
  const currentDasha = `${chartData.vedic?.mahadasha ?? 'Unknown'}-${chartData.vedic?.antardasha ?? 'Unknown'}`
  try {
    const res = await runQueued(apiKey, () => fetchGroqWithBackoff('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zephyra.app',
        'X-Title': 'Zephyra',
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2.6',
        messages: [
          { role: 'system', content: 'Extract structured data. Return ONLY valid JSON array, no preamble.' },
          { role: 'user', content: `Extract specific predictions or advice as JSON array. Each item: topic, planets_referenced (array), claim (1 sentence), is_time_bound (bool), time_bound_until (date or null), confidence (high/medium/low). Return [] if nothing extractable. Text: "${responseText.substring(0, 1500)}"` },
        ],
        max_tokens: 400, temperature: 1.00,
        top_p: 1.00,
      }),
    }))
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
