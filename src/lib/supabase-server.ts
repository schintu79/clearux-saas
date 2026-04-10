// ============================================================
// ClearUX — Supabase Server Clients
// These use next/headers — only import in Server Components,
// API routes, and Server Actions. NEVER in 'use client' files.
// ============================================================

import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createRawClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── Server client (Server Components, Server Actions) ────────
// Reads and writes cookies via Next.js cookies() API.
export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createSSRClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })
}

// ── Middleware client (middleware.ts) ────────────────────────
// Takes request/response objects instead of cookies().
export function createMiddlewareSupabase(
  request:  Request,
  response: Response
) {
  return createSSRClient(url, anon, {
    cookies: {
      get(name: string) {
        return request.headers.get('cookie')?.match(
          new RegExp(`(?:^|; )${name}=([^;]*)`)
        )?.[1]
      },
      set(name: string, value: string, options: CookieOptions) {
        response.headers.append(
          'Set-Cookie',
          `${name}=${value}; Path=/; ${options.httpOnly ? 'HttpOnly;' : ''} ${options.secure ? 'Secure;' : ''} SameSite=${options.sameSite ?? 'Lax'}`
        )
      },
      remove(name: string, options: CookieOptions) {
        response.headers.append(
          'Set-Cookie',
          `${name}=; Path=/; Max-Age=0`
        )
      },
    },
  })
}

// ── Service role client (API routes, webhook, audit engine) ──
// Bypasses RLS. NEVER use client-side.
export function createServiceSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

  return createRawClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
