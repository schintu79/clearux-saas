// ============================================================
// ClearUX — Supabase Client
// One client for browser, one for server (service role).
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { AuditStatus } from '@/types/database'

// ── Environment variables ─────────────────────────────────────
// Add these to .env.local:
//
// NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
// NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
// SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  ← server only, never expose

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Browser client (uses anon key, respects RLS) ──────────────
// Use this in React components and client-side code.

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ── Server client (uses service role, bypasses RLS) ──────────
// Use this ONLY in API routes, webhook handlers, and the audit
// engine — never in client-side code.

export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken:  false,
      persistSession:    false,
      detectSessionInUrl: false,
    }
  })
}

// ── Helper: get current user (server-side) ───────────────────

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ── Helper: get profile for current user ─────────────────────

export async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data
}

// ── Helper: log an audit pipeline event ──────────────────────

export async function logAuditEvent(
  auditId:  string,
  event:    string,
  status:   'info' | 'success' | 'error' | 'warning' = 'info',
  message?: string,
  metadata: Record<string, unknown> = {}
) {
  const db = createServerClient()
  await db.from('audit_logs').insert({
    audit_id: auditId,
    event,
    status,
    message:  message ?? null,
    metadata,
  })
}

// ── Helper: update audit status ──────────────────────────────

export async function updateAuditStatus(
  auditId: string,
  status:  AuditStatus,
  extra:   Record<string, unknown> = {}
) {
  const db = createServerClient()
  const { error } = await db
    .from('audits')
    .update({ status, ...extra })
    .eq('id', auditId)

  if (error) {
    await logAuditEvent(auditId, 'status_update_failed', 'error', error.message)
    throw error
  }

  await logAuditEvent(auditId, `status_changed_to_${status}`, 'info')
}
