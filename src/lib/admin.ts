// ============================================================
// ClearUX — Admin Utilities
// Shared helpers for admin route protection and role checks.
// ============================================================

import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export type AdminRole = 'admin' | 'super_admin'

/**
 * Verifies the current user is an admin (admin or super_admin).
 * Returns the user, their profile, and the service-role DB client.
 * Returns a NextResponse error if unauthorized.
 */
export async function requireAdmin() {
  const supabase = await createServerSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const db = createServiceSupabase()
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  }

  const role = (profile as any).role as string
  if (role !== 'admin' && role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 }) }
  }

  return { user, profile: profile as any, db, role }
}

/**
 * Verifies the current user is a super_admin.
 */
export async function requireSuperAdmin() {
  const result = await requireAdmin()
  if ('error' in result && result.error) return result

  if (result.role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden — super admin access required' }, { status: 403 }) }
  }

  return result
}
