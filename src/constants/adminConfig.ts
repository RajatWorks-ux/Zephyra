// src/constants/adminConfig.ts
//
// This makes admin access work on ANY device — but only for you.
// Face ID by itself only proves "the owner of THIS device" — it can't know
// who you are across different phones. This account check is what makes it
// "only me" everywhere: even if someone installs the app on their own phone
// with their own face enrolled, they still are not logged into YOUR account,
// so the 7-tap gesture does nothing for them.
//
// SETUP (do this once):
//   1. In src/store/authStore.ts, set SKIP_LOGIN = false and sign in for real
//      with the account you'll always use.
//   2. Log `session.user.id` once after signing in — it's a UUID.
//   3. Paste that UUID below.
//   4. Set DEV_MODE_ALWAYS_ALLOW to false.

export const DEVELOPER_USER_ID = 'PASTE_YOUR_REAL_SUPABASE_USER_UUID_HERE'

// true = admin flow works for you right now while still in mock/dev login.
// Set to false once DEVELOPER_USER_ID above is filled in with your real ID.
export const DEV_MODE_ALWAYS_ALLOW = true

export function isDeveloperAccount(userId: string | undefined | null): boolean {
  if (DEV_MODE_ALWAYS_ALLOW) return true
  if (!userId) return false
  return userId === DEVELOPER_USER_ID
}
