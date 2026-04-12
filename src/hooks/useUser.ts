// ============================================================
// ClearUX — useUser Hook
// Single source of auth truth. Used ONLY inside AuthProvider.
// All components use useAuth() from AuthContext.
// ============================================================

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'
import { createBrowserSupabase } from '@/lib/supabase-ssr'

interface UseUserReturn {
  user:            User | null
  profile:         Profile | null
  loading:         boolean
  signOut:         () => Promise<void>
  refreshProfile:  () => Promise<void>
}

export function useUser(): UseUserReturn {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const signingOut = useRef(false)

  const supabase = createBrowserSupabase()

  /* ── Profile fetch ───────────────────────────────────────── */
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    } catch {}
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  /* ── Initialise + listen ─────────────────────────────────── */
  useEffect(() => {
    let active = true

    // We rely on onAuthStateChange as the SINGLE source of truth.
    // It fires INITIAL_SESSION on mount, then SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return
        if (signingOut.current) return

        const currentUser = session?.user ?? null

        if (currentUser) {
          setUser(currentUser)
          setProfile(prev => prev?.id === currentUser.id ? prev : null)
          fetchProfile(currentUser.id)
        } else {
          setUser(null)
          setProfile(null)
        }

        setLoading(false)
      }
    )

    // Safety: force loading=false after 5s (covers edge cases)
    const safety = setTimeout(() => {
      if (active) {
        setLoading(prev => {
          if (prev) console.warn('[useUser] safety timeout')
          return false
        })
      }
    }, 5000)

    return () => {
      active = false
      clearTimeout(safety)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sign out ────────────────────────────────────────────── */
  const signOut = useCallback(async () => {
    signingOut.current = true
    setUser(null)
    setProfile(null)

    try {
      await supabase.auth.signOut()
    } catch {}

    // Hard redirect AFTER cookie is cleared
    window.location.replace('/')
  }, [supabase])

  return { user, profile, loading, signOut, refreshProfile }
}
