// src/services/appwriteConfig.ts
// ─────────────────────────────────────────────────────────────────────────────
// YOUR APPWRITE CONFIGURATION — hardcoded, not visible to users
// After you create your Appwrite project, fill in these values.
// Users never see these — they are part of your app bundle.
// ─────────────────────────────────────────────────────────────────────────────

// HOW TO GET THESE VALUES:
// 1. Go to cloud.appwrite.io → login
// 2. Click your Zephyra project
// 3. The Project ID is shown at the top of the dashboard
// 4. Click "Databases" in left sidebar → your database ID is shown there

export const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1'  // Always this for Appwrite Cloud
export const APPWRITE_PROJECT_ID = 'YOUR_PROJECT_ID_HERE'        // ← FILL THIS IN (e.g. "6847abc123")
export const APPWRITE_DATABASE_ID = 'YOUR_DATABASE_ID_HERE'      // ← FILL THIS IN (e.g. "ZephyraDB")
export const APPWRITE_STORAGE_BUCKET_ID = 'avatars'              // ← optional, for profile pictures

// ── Check if configured ───────────────────────────────────────────────────────
export const APPWRITE_CONFIGURED =
  !APPWRITE_PROJECT_ID.includes('YOUR_PROJECT_ID_HERE') &&
  !APPWRITE_DATABASE_ID.includes('YOUR_DATABASE_ID_HERE')
