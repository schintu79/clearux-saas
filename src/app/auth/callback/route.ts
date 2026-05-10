// ============================================================
// ClearUX — Auth Callback Route
// GET /auth/callback
//
// Supabase redirects here after:
//   - Email confirmation (on register)
//   - Password reset link clicks
//   - OAuth sign-in (if added later)
//
// Exchanges the one-time `code` for a session, then redirects.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code        = searchParams.get('code')
  const next        = searchParams.get('next') ?? '/dashboard'
  const type        = searchParams.get('type') // 'recovery' for password reset

  if (!code) {
    // No code — something went wrong with the email link
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] code exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // For password reset, send to the reset-password page
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // For email confirmation, send to dashboard (the user is now logged in)
  return response
}
