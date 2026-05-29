'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface ActivityLogEntry {
  id: string
  event: string
  status: 'info' | 'success' | 'error' | 'warning'
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

interface UseAuditActivityOptions {
  interval?: number
  enabled?: boolean
}

/**
 * Polls /api/audits/[id]/activity for live log entries.
 * Uses incremental fetching (after= param) to only get new entries.
 */
export function useAuditActivity(
  auditId: string | null,
  options: UseAuditActivityOptions = {},
) {
  const { interval = 2500, enabled = true } = options
  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const lastTimestampRef = useRef<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const fetchActivity = useCallback(async () => {
    if (!auditId) return
    try {
      const params = new URLSearchParams()
      if (lastTimestampRef.current) {
        params.set('after', lastTimestampRef.current)
      }
      const url = `/api/audits/${auditId}/activity${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return

      const json = await res.json()
      const newEntries: ActivityLogEntry[] = json.logs ?? []

      if (newEntries.length > 0 && mountedRef.current) {
        lastTimestampRef.current = newEntries[newEntries.length - 1].createdAt
        setEntries(prev => {
          const existingIds = new Set(prev.map(e => e.id))
          const unique = newEntries.filter(e => !existingIds.has(e.id))
          return [...prev, ...unique]
        })
      }
      if (mountedRef.current) setLoading(false)
    } catch {
      // Silently skip
    }
  }, [auditId])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Reset when audit changes
  useEffect(() => {
    setEntries([])
    lastTimestampRef.current = null
    setLoading(true)
  }, [auditId])

  useEffect(() => {
    if (!auditId || !enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    fetchActivity()
    intervalRef.current = setInterval(fetchActivity, interval)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [auditId, enabled, interval, fetchActivity])

  return { entries, loading }
}
