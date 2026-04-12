// ============================================================
// ClearUX — Auth Context
// Single source of truth for auth state across the dashboard.
// Prevents multiple useUser() calls from creating race conditions.
// ============================================================

'use client'

import React, { createContext, useContext } from 'react'
import { useUser } from '@/hooks/useUser'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signOut: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useUser()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
