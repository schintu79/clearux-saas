// ============================================================
// ClearUX — useUser Hook
// Provides reactive auth state (user + profile) in client
// components. Listens to Supabase auth state changes.
// ============================================================

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'
import { createBrowserSupabase } from '@/lib/supabase-ssr'

interface UseUserReturn {
  user:        User | null
  profile:     Profile | null
  loading:     boolean
  signOut:     () => Promise<void>
  refreshProfile: () => Promise<void>
}

// Helper: race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Auth request timed out')), ms)
    ),
  ])
}

export function useUser(): UseUserReturn {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // createBrowserSupabase() is already a singleton — same instance everywhere
  const supabase = createBrowserSupabase()

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) {
        console.warn('[useUser] fetchProfile error:', error.message)
      }
      setProfile(data)
    } catch (err) {
      console.error('[useUser] fetchProfile exception:', err)
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // Step 1 — fast read from cookies (no network call)
        const { data: { session } } = await supabase.auth.getSession()

        if (cancelled) return

        if (session?.user) {
          // We have a session — trust it immediately, mark loaded
          setUser(session.user)
          fetchProfile(session.user.id)
          setLoading(false)

          // Background verification (non-blocking, with timeout)
          withTimeout(supabase.auth.getUser(), 5000)
            .then(({ data: { user: verifiedUser } }) => {
              if (cancelled || !verifiedUser) return
              setUser(verifiedUser)
            })
            .catch(() => {
              // Timeout or error — session user is still valid
            })
          return
        }

        // No session — try getUser() with a timeout
        try {
          const { data: { user: verifiedUser } } = await withTimeout(
            supabase.auth.getUser(),
            5000
          )

          if (cancelled) return

          if (verifiedUser) {
            setUser(verifiedUser)
            fetchProfile(verifiedUser.id)
          } else {
            setUser(null)
            setProfile(null)
          }
        } catch {
          // Timed out or failed — no user
          if (!cancelled) {
            setUser(null)
            setProfile(null)
          }
        }
      } catch (err) {
        console.error('[useUser] init error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    // Safety valve: if loading is STILL true after 6 seconds, force it off.
    // This prevents infinite loading if Supabase is unreachable.
    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn('[useUser] safety timeout — forcing loading=false')
        return false
      })
    }, 6000)

    // Listen for SUBSEQUENT auth events (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip INITIAL_SESSION — we handle it above with getSession()+getUser()
        if (event === 'INITIAL_SESSION') return

        const newUser = session?.user ?? null
        setUser(newUser)
        if (newUser) {
          await fetchProfile(newUser.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      cancelled = true
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    // Clear local state immediately so the UI updates
    setUser(null)
    setProfile(null)

    try {
      const { error } = await supabase.auth.signOut()
      if (error) console.error('[useUser] signOut API error:', error)
    } catch (err) {
      console.warn('[useUser] signOut exception:', err)
    }

    // Hard redirect to fully clear cookies + server state.
    window.location.replace('/')
  }

  return { user, profile, loading, signOut, refreshProfile }
}
