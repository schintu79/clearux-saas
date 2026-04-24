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
import { createServiceSupabase } from '@/lib/supabase-server'
import { sendWelcomeEmail } from '@/lib/audit-engine/email'

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

  // Populate profile from provider metadata + send welcome email for new users
  // Uses service role client to bypass RLS
  const user = sessionData?.session?.user
  if (user) {
    try {
      const db = createServiceSupabase()
      const { data: existingProfile } = await db
        .from('profiles')
        .select('full_name, audit_count, welcome_email_sent, marketing_emails')
        .eq('id', user.id)
        .single()

      // Update profile with OAuth metadata if name is missing
      const fullName = user.user_metadata?.full_name
        || user.user_metadata?.name
        || null
      const avatarUrl = user.user_metadata?.avatar_url
        || user.user_metadata?.picture
        || null
      const marketingEmails = user.user_metadata?.marketing_emails === true

      if (!existingProfile?.full_name && (fullName || avatarUrl)) {
        await db
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            ...(fullName ? { full_name: fullName } : {}),
            ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
            marketing_emails: marketingEmails,
          } as any, { onConflict: 'id' })
      } else if (marketingEmails && !existingProfile?.marketing_emails) {
        // Persist marketing consent even if profile already has a name
        await db
          .from('profiles')
          .update({ marketing_emails: true } as any)
          .eq('id', user.id)
      }

      // Send welcome email if not already sent
      // The DB trigger creates the profile before this runs, so we use
      // a dedicated flag instead of checking if the profile exists.
      const alreadySent = (existingProfile as any)?.welcome_email_sent === true
      if (!alreadySent && user.email) {
        try {
          const name = existingProfile?.full_name || fullName || null
          await sendWelcomeEmail(user.email, name)
          // Mark as sent so we never send it again
          await db
            .from('profiles')
            .update({ welcome_email_sent: true } as any)
            .eq('id', user.id)
        } catch (emailErr) {
          console.warn('[auth/callback] welcome email failed (non-fatal):', emailErr)
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
