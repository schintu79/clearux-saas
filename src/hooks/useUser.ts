// ============================================================
// ClearUX — useUser Hook
// Provides reactive auth state (user + profile) in client
// components. ONLY used inside AuthProvider — all components
// should call useAuth() from AuthContext instead.
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
  const mounted = useRef(true)

  const supabase = createBrowserSupabase()

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) console.warn('[useUser] fetchProfile error:', error.message)
      if (mounted.current) setProfile(data)
    } catch (err) {
      console.error('[useUser] fetchProfile exception:', err)
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  useEffect(() => {
    mounted.current = true

    const init = async () => {
      try {
        // Step 1: Quick check — is there even a session cookie?
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          // No session cookie at all — definitely not logged in
          if (mounted.current) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        // Step 2: Session cookie exists — verify it's still valid with the server.
        // This is the ONLY place we set user state. No optimistic stale state.
        const { data: { user: verified }, error } = await supabase.auth.getUser()

        if (!mounted.current) return

        if (verified) {
          // Valid session — set user and fetch profile
          setUser(verified)
          fetchProfile(verified.id)
        } else {
          // Stale session cookie — clear everything
          console.warn('[useUser] stale session detected, clearing')
          setUser(null)
          setProfile(null)
          // Clean up the stale cookie silently
          supabase.auth.signOut().catch(() => {})
        }
      } catch (err) {
        console.error('[useUser] init error:', err)
        if (mounted.current) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted.current) setLoading(false)
      }
    }

    init()

    // Safety: force loading=false after 5 seconds (network issues, etc.)
    const safety = setTimeout(() => {
      if (mounted.current) {
        setLoading(prev => {
          if (prev) console.warn('[useUser] safety timeout — forcing loading=false')
          return false
        })
      }
    }, 5000)

    // Listen for auth changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return
        if (signingOut.current) return
        if (!mounted.current) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

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
      mounted.current = false
      clearTimeout(safety)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    // Mark as signing out so onAuthStateChange doesn't interfere
    signingOut.current = true

    // Clear state immediately for instant UI feedback
    setUser(null)
    setProfile(null)

    try {
      // Wait for Supabase to clear the session cookie on the server
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('[useUser] signOut error:', err)
    }

    // Only redirect AFTER the session is fully cleared
    window.location.replace('/')
  }

  return { user, profile, loading, signOut, refreshProfile }
}
