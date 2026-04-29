
// src/constants/videos.ts
// ⚠️  These are signed URLs from a private Supabase bucket.
// They expire — see each token's `exp` field.
// To get permanent URLs: make the bucket PUBLIC in Supabase → Storage → videos → Bucket settings
// and replace with: https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/public/videos/<filename>

export const Videos = {
  splashBg: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/splash-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3Mvc3BsYXNoLWJnLm1wNCIsImlhdCI6MTc3NzI4MDc4MiwiZXhwIjozMzU0MDgwNzgyfQ.tk2LHyB4x0u1exwVT_9LdAU6ny6GX5GsvPOQ57Ot9KU',
  },
  signInBg: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/signin-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3Mvc2lnbmluLWJnLm1wNCIsImlhdCI6MTc3NzI4MDkwMCwiZXhwIjoxODA4ODE2OTAwfQ.h4phuC8zsx5CFtK7mRpKR6O-yfsI-2hRHPW3gouK8sg',
  },
  phoneOtpBg: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/phone-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvcGhvbmUtYmcubXA0IiwiaWF0IjoxNzc3MjgwOTM0LCJleHAiOjE3ODU5MjA5MzR9.F4bVLW0K5MVtLSKTSTbF0UTq88ysvyDBWebjplfizVg',
  },
  onboarding1: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/onboarding-1.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3Mvb25ib2FyZGluZy0xLm1wNCIsImlhdCI6MTc3NzI4MTAwMywiZXhwIjoxODA4ODE3MDAzfQ.bTNHQyO-CjMNoqMXtHjKGs0q8mOmRFVcIOpifmkYA8c',
  },
  onboarding2: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/onboarding-2.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3Mvb25ib2FyZGluZy0yLm1wNCIsImlhdCI6MTc3NzI4MDk4NywiZXhwIjoxODA4ODE2OTg3fQ.F4uj4vNJPj2styMmpdDfgctj5JyeYohTsrhDJ-GMhFY',
  },
  onboarding3: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/onboarding-3.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3Mvb25ib2FyZGluZy0zLm1wNCIsImlhdCI6MTc3NzI4MDk2MywiZXhwIjoxODA4ODE2OTYzfQ.5zRBhvn0tcHHsweX05U9PLtMuErkVh61zmiOhtXjzlA',
  },
  loadingBg: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/loading-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvbG9hZGluZy1iZy5tcDQiLCJpYXQiOjE3NzcyODEwMjEsImV4cCI6MTgwODgxNzAyMX0.emjFxXw16PebUpgj2aVegITeHZYzdPQB-C6l-DAkDpo',
  },
  emailVerifyBg: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/email-verify-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvZW1haWwtdmVyaWZ5LWJnLm1wNCIsImlhdCI6MTc3NzI4MTA3OSwiZXhwIjoxODA4ODE3MDc5fQ.HL8f6q8J4omoIT3fisUb2w45LZh8brb6HOZq8R7PPRE',
  },
  birthBg: {
    uri: 'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/birth-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvYmlydGgtYmcubXA0IiwiaWF0IjoxNzc3MjgxMDk4LCJleHAiOjE4MDg4MTcwOTh9.tny2Oj8TNfv4lJrexaTiK8dpoozXM1Oow-PSsPg22Io',
  },
  forgotBg: {
    uri:'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/forgot-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvZm9yZ290LWJnLm1wNCIsImlhdCI6MTc3NzM4NTY3MCwiZXhwIjoxODA4OTIxNjcwfQ.6HDIo5-X0SWVQAKqI7vbfxovFsryK696rMlNJu8r9Jk',      
  },
  accountCreatedBg: {
    uri:'https://hjxtqjmpphctiurfknio.supabase.co/storage/v1/object/sign/videos/account-created-bg.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lNmRhNTk0Ny1kNzgzLTRlMDEtOTczYi1hMzY1MDNjMzUwMjgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ2aWRlb3MvYWNjb3VudC1jcmVhdGVkLWJnLm1wNCIsImlhdCI6MTc3NzQ1MDYzOSwiZXhwIjoxODA4OTg2NjM5fQ.b-66DW4qPj6lTRdQlx2DpYI_1-fV9DL1islDyoBP3aM',
  },
}
