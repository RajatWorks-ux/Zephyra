// src/hooks/useVideoSource.ts
// ─────────────────────────────────────────────────────────────────────────────
// Hook: returns the correct video source (R2 URI or local asset)
// Falls back to local if R2 fails
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { getVideoSource, reportR2Failure } from '../services/videoService'
import { Videos } from '../constants/videos'

const LOCAL_FALLBACKS: Record<string, any> = {
  splashBg: Videos.splashBg,
  onboarding1: Videos.onboarding1,
  onboarding2: Videos.onboarding2,
  onboarding3: Videos.onboarding3,
  signInBg: Videos.signInBg,
  forecastBg: Videos.forecastBg,
  chartsBg: Videos.chartsBg,
}

export function useVideoSource(videoName: string): {
  source: { uri: string } | number
  isRemote: boolean
  onError: () => void
} {
  const localFallback = LOCAL_FALLBACKS[videoName] ?? Videos.splashBg
  const [source, setSource] = useState<{ uri: string } | number>(localFallback)
  const [isRemote, setIsRemote] = useState(false)

  useEffect(() => {
    let mounted = true
    getVideoSource(videoName).then(src => {
      if (!mounted) return
      setSource(src)
      setIsRemote(typeof src === 'object' && !!src.uri)
    })
    return () => { mounted = false }
  }, [videoName])

  const onError = () => {
    reportR2Failure()
    setSource(localFallback)
    setIsRemote(false)
  }

  return { source, isRemote, onError }
}

