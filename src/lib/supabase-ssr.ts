// ============================================================
// ClearUX — Supabase Browser Client (Singleton)
// Safe to import in 'use client' components.
// Returns the SAME client instance every time to prevent
// auth cookie lock contention across concurrent requests.
// ============================================================

import { createBrowserClient } from '@supabase/ssr'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let _instance: ReturnType<typeof createBrowserClient> | null = null

// ── Browser client (React components, client hooks) ──────────
export function createBrowserSupabase() {
  if (!_instance) {
    _instance = createBrowserClient(url, anon)
  }
  return _instance
}
