// src/services/appwriteService.ts
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2: Replaces supabase.ts entirely
// YOUR Appwrite backend — hardcoded config, users never configure anything
// ─────────────────────────────────────────────────────────────────────────────

import { Client, Account, Databases, Storage, ID, Query } from 'appwrite'
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_DATABASE_ID,
  APPWRITE_STORAGE_BUCKET_ID,
  APPWRITE_CONFIGURED,
} from './appwriteConfig'
import type { ReadingSeed } from '../types'

// ── Singleton client ──────────────────────────────────────────────────────────
let _client: Client | null = null
let _account: Account | null = null
let _databases: Databases | null = null
let _storage: Storage | null = null

export class AppwriteNotConfiguredError extends Error {
  constructor() {
    super('Appwrite project ID not set. Please fill in appwriteConfig.ts')
    this.name = 'AppwriteNotConfiguredError'
  }
}

function getClient(): Client {
  if (!_client) {
    if (!APPWRITE_CONFIGURED) throw new AppwriteNotConfiguredError()
    _client = new Client()
    _client.setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID)
    _account = new Account(_client)
    _databases = new Databases(_client)
    _storage = new Storage(_client)
  }
  return _client
}

function getAccount(): Account {
  getClient()
  if (!_account) throw new AppwriteNotConfiguredError()
  return _account
}

function getDbs(): Databases {
  getClient()
  if (!_databases) throw new AppwriteNotConfiguredError()
  return _databases
}

// ── Upsert (Appwrite has no native upsert) ────────────────────────────────────
async function upsertByUserId(
  collectionId: string,
  userId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const dbs = getDbs()
  try {
    const res = await dbs.listDocuments(APPWRITE_DATABASE_ID, collectionId, [
      Query.equal('user_id', userId),
      Query.limit(1),
    ])
    if (res.documents.length > 0) {
      await dbs.updateDocument(APPWRITE_DATABASE_ID, collectionId, res.documents[0].$id, data)
    } else {
      await dbs.createDocument(APPWRITE_DATABASE_ID, collectionId, ID.unique(), { user_id: userId, ...data })
    }
  } catch (e) { throw e }
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════════════

export async function signUpWithEmail(email: string, password: string, name?: string) {
  const account = getAccount()
  await account.create(ID.unique(), email, password, name)
  return account.createEmailPasswordSession(email, password)
}

export async function signInWithEmail(email: string, password: string) {
  return getAccount().createEmailPasswordSession(email, password)
}

export async function signInWithPhone(phone: string) {
  return getAccount().createPhoneToken(ID.unique(), phone)
}

export async function verifyPhoneOTP(userId: string, secret: string) {
  return getAccount().createSession(userId, secret)
}

export async function getSession() {
  try { return await getAccount().getSession('current') }
  catch { return null }
}

export async function getUser() {
  try { return await getAccount().get() }
  catch { return null }
}

export async function signOut() {
  try { await getAccount().deleteSession('current') } catch {}
}

export async function requestPasswordReset(email: string, redirectUrl: string) {
  return getAccount().createRecovery(email, redirectUrl)
}

export async function updatePassword(password: string, oldPassword: string) {
  return getAccount().updatePassword(password, oldPassword)
}

export async function sendEmailVerification(redirectUrl: string) {
  return getAccount().createVerification(redirectUrl)
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILES
// ════════════════════════════════════════════════════════════════════════════

export async function getUserProfile(userId: string) {
  try { return await getDbs().getDocument(APPWRITE_DATABASE_ID, 'profiles', userId) }
  catch { return null }
}

export async function saveUserProfile(userId: string, data: Record<string, unknown>) {
  try { await getDbs().updateDocument(APPWRITE_DATABASE_ID, 'profiles', userId, data) }
  catch { await getDbs().createDocument(APPWRITE_DATABASE_ID, 'profiles', userId, { user_id: userId, ...data }) }
}

// ════════════════════════════════════════════════════════════════════════════
// BIRTH PROFILES
// ════════════════════════════════════════════════════════════════════════════

export async function getBirthProfile(userId: string) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'birth_profiles', [
    Query.equal('user_id', userId), Query.limit(1),
  ])
  return res.documents[0] ?? null
}

export async function saveBirthProfile(userId: string, data: Record<string, unknown>) {
  await upsertByUserId('birth_profiles', userId, data)
}

// ════════════════════════════════════════════════════════════════════════════
// READINGS
// ════════════════════════════════════════════════════════════════════════════

export async function getCachedReading(userId: string) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'readings', [
    Query.equal('user_id', userId), Query.limit(1),
  ])
  return res.documents[0] ?? null
}

export async function saveReading(userId: string, payload: Record<string, unknown>) {
  await upsertByUserId('readings', userId, payload)
}

export async function updateReadingSeed(userId: string, seed: ReadingSeed) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'readings', [
    Query.equal('user_id', userId), Query.limit(1),
  ])
  if (res.documents.length > 0) {
    await getDbs().updateDocument(APPWRITE_DATABASE_ID, 'readings', res.documents[0].$id, {
      reading_seed: JSON.stringify(seed),
    })
  }
}

// ════════════════════════════════════════════════════════════════════════════
// USER PREFERENCES
// ════════════════════════════════════════════════════════════════════════════

export async function getUserPreferences(userId: string) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'user_preferences', [
    Query.equal('user_id', userId), Query.limit(1),
  ])
  return res.documents[0] ?? null
}

export async function saveUserPreferences(userId: string, prefs: Record<string, unknown>) {
  await upsertByUserId('user_preferences', userId, prefs)
}

// ════════════════════════════════════════════════════════════════════════════
// CHAT SESSIONS + MESSAGES
// ════════════════════════════════════════════════════════════════════════════

export async function saveChatSession(userId: string, title: string, contextType: string, person2Id?: string) {
  return getDbs().createDocument(APPWRITE_DATABASE_ID, 'chat_sessions', ID.unique(), {
    user_id: userId, title, context_type: contextType,
    person2_id: person2Id ?? null,
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
  })
}

export async function getChatSessions(userId: string) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'chat_sessions', [
    Query.equal('user_id', userId), Query.orderDesc('last_message_at'), Query.limit(50),
  ])
  return res.documents
}

export async function deleteChatSession(sessionId: string) {
  const dbs = getDbs()
  const msgs = await dbs.listDocuments(APPWRITE_DATABASE_ID, 'chat_messages', [
    Query.equal('session_id', sessionId), Query.limit(500),
  ])
  await Promise.all(msgs.documents.map(m => dbs.deleteDocument(APPWRITE_DATABASE_ID, 'chat_messages', m.$id)))
  await dbs.deleteDocument(APPWRITE_DATABASE_ID, 'chat_sessions', sessionId)
}

export async function updateChatSessionTitle(sessionId: string, title: string) {
  return getDbs().updateDocument(APPWRITE_DATABASE_ID, 'chat_sessions', sessionId, { title })
}

export async function saveChatMessage(sessionId: string, role: string, content: string) {
  const now = new Date().toISOString()
  const msg = await getDbs().createDocument(APPWRITE_DATABASE_ID, 'chat_messages', ID.unique(), {
    session_id: sessionId, role, content, created_at: now,
  })
  try { await getDbs().updateDocument(APPWRITE_DATABASE_ID, 'chat_sessions', sessionId, { last_message_at: now }) } catch {}
  return msg
}

export async function getChatMessages(sessionId: string) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'chat_messages', [
    Query.equal('session_id', sessionId), Query.orderAsc('created_at'), Query.limit(500),
  ])
  return res.documents
}

// ════════════════════════════════════════════════════════════════════════════
// RELATIONSHIP PROFILES + COMPATIBILITY
// ════════════════════════════════════════════════════════════════════════════

export async function saveRelationshipProfile(userId: string, data: Record<string, unknown>) {
  return getDbs().createDocument(APPWRITE_DATABASE_ID, 'relationship_profiles', ID.unique(), {
    user_id: userId, ...data,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })
}

export async function getRelationshipProfiles(userId: string) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'relationship_profiles', [
    Query.equal('user_id', userId), Query.orderDesc('created_at'),
  ])
  return res.documents
}

export async function deleteRelationshipProfile(profileId: string, userId: string) {
  const dbs = getDbs()
  const res = await dbs.listDocuments(APPWRITE_DATABASE_ID, 'compatibility_results', [
    Query.equal('person2_id', profileId), Query.equal('user_id', userId),
  ])
  await Promise.all(res.documents.map(r => dbs.deleteDocument(APPWRITE_DATABASE_ID, 'compatibility_results', r.$id)))
  await dbs.deleteDocument(APPWRITE_DATABASE_ID, 'relationship_profiles', profileId)
}

export async function saveCompatibilityResult(userId: string, person2Id: string, result: Record<string, unknown>) {
  const dbs = getDbs()
  const existing = await dbs.listDocuments(APPWRITE_DATABASE_ID, 'compatibility_results', [
    Query.equal('user_id', userId), Query.equal('person2_id', person2Id), Query.limit(1),
  ])
  if (existing.documents.length > 0) {
    return dbs.updateDocument(APPWRITE_DATABASE_ID, 'compatibility_results', existing.documents[0].$id, { ...result, updated_at: new Date().toISOString() })
  }
  return dbs.createDocument(APPWRITE_DATABASE_ID, 'compatibility_results', ID.unique(), {
    user_id: userId, person2_id: person2Id, ...result,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  })
}

// ════════════════════════════════════════════════════════════════════════════
// READING HISTORY
// ════════════════════════════════════════════════════════════════════════════

export async function saveReadingHistoryLog(userId: string, entry: Record<string, unknown>) {
  return getDbs().createDocument(APPWRITE_DATABASE_ID, 'reading_history_log', ID.unique(), {
    user_id: userId, ...entry, generated_at: new Date().toISOString(),
  })
}

export async function getReadingHistory(userId: string) {
  const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'reading_history_log', [
    Query.equal('user_id', userId), Query.orderDesc('generated_at'), Query.limit(50),
  ])
  return res.documents
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN MESSAGES
// ════════════════════════════════════════════════════════════════════════════

export async function getAdminMessages() {
  try {
    const res = await getDbs().listDocuments(APPWRITE_DATABASE_ID, 'admin_messages', [
      Query.equal('is_sent', true), Query.orderDesc('sent_at'), Query.limit(20),
    ])
    return res.documents
  } catch { return [] }
}

export async function markMessageRead(userId: string, messageId: string) {
  return getDbs().createDocument(APPWRITE_DATABASE_ID, 'admin_message_reads', ID.unique(), {
    user_id: userId, message_id: messageId, read_at: new Date().toISOString(),
  })
}

export async function savePollResponse(userId: string, messageId: string, optionIndex: number) {
  return getDbs().createDocument(APPWRITE_DATABASE_ID, 'poll_responses', ID.unique(), {
    user_id: userId, message_id: messageId, option_index: optionIndex,
    created_at: new Date().toISOString(),
  })
}
