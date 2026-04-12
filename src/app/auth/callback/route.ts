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

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] code exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // For OAuth sign-ins, populate profile from provider metadata if needed
  const user = sessionData?.session?.user
  if (user) {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // If profile has no name, populate from OAuth provider metadata
      if (!existingProfile?.full_name) {
        const fullName = user.user_metadata?.full_name
          || user.user_metadata?.name
          || null
        const avatarUrl = user.user_metadata?.avatar_url
          || user.user_metadata?.picture
          || null

        if (fullName || avatarUrl) {
          await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              ...(fullName ? { full_name: fullName } : {}),
              ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            }, { onConflict: 'id' })
        }
      }
    } catch (err) {
      // Non-critical — don't block the redirect
      console.warn('[auth/callback] profile update failed:', err)
    }
  }

  // For password reset, send to the reset-password page
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // For email confirmation or OAuth, send to dashboard (the user is now logged in)
  return response
}
