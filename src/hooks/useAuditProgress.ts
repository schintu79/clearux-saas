'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Progressive audit progress hook.
 * Polls /api/audits/[id]/progress at intervals to get real-time stage/data updates.
 * Returns structured progress info the UI can use to show partial results.
 */

export interface AuditProgressData {
  status: string
  stage: string
  progress: number
  updatedAt: string
  data: {
    pagesCrawled: number
    hasCrawlSummary: boolean
    hasSpeedData: boolean
    findingsCount: number
    hasReport: boolean
    overallScore: number | null
    hasSentimentData: boolean
    hasHumanPerception: boolean
    hasIndustry: boolean
  }
  stages: {
    preflight: boolean
    crawling: boolean
    checking: boolean
    probing: boolean
    analysing: boolean
    reporting: boolean
    enriching: boolean
    complete: boolean
  }
}

interface UseAuditProgressOptions {
  /** Polling interval in ms (default: 2500) */
  interval?: number
  /** Whether to enable polling (default: true) */
  enabled?: boolean
}

export function useAuditProgress(
  auditId: string | null,
  options: UseAuditProgressOptions = {},
) {
  const { interval = 2500, enabled = true } = options
  const [data, setData] = useState<AuditProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const fetchProgress = useCallback(async () => {
    if (!auditId) return
    try {
      const res = await fetch(`/api/audits/${auditId}/progress`)
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setError('Unauthorized')
          return
        }
        return // Silently skip transient errors
      }
      const json = await res.json()
      if (mountedRef.current) {
        setData(json)
        setError(null)
      }
    } catch {
      // Network errors — silently skip, retry on next interval
    }
  }, [auditId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!auditId || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Fetch immediately, then poll
    fetchProgress()
    intervalRef.current = setInterval(fetchProgress, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [auditId, enabled, interval, fetchProgress])

  // Stop polling once complete or failed
  useEffect(() => {
    if (data && (data.status === 'completed' || data.status === 'failed')) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [data?.status])

  return { data, error, refetch: fetchProgress }
}
