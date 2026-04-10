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

    // Primary auth strategy: getSession() reads from cookies (fast, no
    // network call), then getUser() verifies with the Supabase server.
    const init = async () => {
      try {
        // Step 1 — fast read from cookies
        const { data: { session } } = await supabase.auth.getSession()
        console.log('[useUser] getSession →', session ? 'has session' : 'no session')

        if (cancelled) return

        if (session?.user) {
          setUser(session.user)
          fetchProfile(session.user.id)
          // We have a session from cookies — mark loaded NOW so the
          // dashboard can start fetching data immediately.
          setLoading(false)

          // Step 2 — server verification in the background (refreshes
          // token if expired). Non-blocking — UI is already interactive.
          supabase.auth.getUser().then(({ data: { user: verifiedUser }, error }) => {
            if (cancelled) return
            console.log('[useUser] getUser →', verifiedUser ? verifiedUser.email : 'null', error?.message ?? '')
            if (verifiedUser) {
              setUser(verifiedUser)
              if (verifiedUser.id !== session?.user?.id) {
                fetchProfile(verifiedUser.id)
              }
            }
          })
          return // skip finally — loading already set false
        }

        // No session from cookies — try server verification
        const { data: { user: verifiedUser }, error } = await supabase.auth.getUser()
        console.log('[useUser] getUser →', verifiedUser ? verifiedUser.email : 'null', error?.message ?? '')

        if (cancelled) return

        if (verifiedUser) {
          setUser(verifiedUser)
          fetchProfile(verifiedUser.id)
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('[useUser] init error:', err)
      } finally {
        // Always set loading false — even if cancelled, the component
        // may still be mounted (React strict mode re-mount)
        if (!cancelled) setLoading(false)
      }
    }

    init()

    // Listen for SUBSEQUENT auth events (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useUser] onAuthStateChange →', event, session?.user?.email ?? 'no user')

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
    // Use replace so the user can't navigate back to a stale page.
    window.location.replace('/')
  }

  return { user, profile, loading, signOut, refreshProfile }
}
