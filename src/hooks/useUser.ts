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
  signOut:     () => void
  refreshProfile: () => Promise<void>
}

export function useUser(): UseUserReturn {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const signingOut = useRef(false)

  const supabase = createBrowserSupabase()

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) console.warn('[useUser] fetchProfile error:', error.message)
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
        // Fast read from cookies — no network call
        const { data: { session } } = await supabase.auth.getSession()

        if (cancelled) return

        if (session?.user) {
          setUser(session.user)
          fetchProfile(session.user.id)
          setLoading(false)

          // Background server verification (non-blocking)
          supabase.auth.getUser()
            .then(({ data: { user: verified } }) => {
              if (cancelled || !verified) return
              setUser(verified)
            })
            .catch(() => {})
          return
        }

        // No session — mark as not authenticated
        setUser(null)
        setProfile(null)
      } catch (err) {
        console.error('[useUser] init error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    // Safety: force loading=false after 4 seconds no matter what
    const safety = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('[useUser] safety timeout')
        return false
      })
    }, 4000)

    // Listen for auth changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return
        // Ignore auth changes during sign-out (we handle redirect ourselves)
        if (signingOut.current) return

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
      clearTimeout(safety)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = () => {
    // Mark as signing out so onAuthStateChange doesn't interfere
    signingOut.current = true

    // Redirect IMMEDIATELY — don't wait for Supabase
    window.location.replace('/')

    // Fire-and-forget the actual sign-out
    supabase.auth.signOut().catch(() => {})
  }

  return { user, profile, loading, signOut, refreshProfile }
}
