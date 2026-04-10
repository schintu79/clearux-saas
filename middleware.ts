// ============================================================
// ClearUX — Next.js Middleware
// Runs on every request. Handles:
//   - Redirecting unauthenticated users away from /dashboard
//   - Redirecting authenticated users away from /login /register
//   - Refreshing Supabase session cookies automatically
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  // Create Supabase client that can read/write cookies via middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set on both request and response so the session is refreshed
          request.cookies.set({ name, value, ...options })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // IMPORTANT: always call getUser() in middleware — this refreshes
  // the session token if it has expired. Never use getSession() here.
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage      = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password')
  const isDashboardPage = pathname.startsWith('/dashboard')

  // Unauthenticated user trying to access dashboard → redirect to login
  if (!user && isDashboardPage) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Authenticated user trying to access auth pages → redirect to dashboard
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Run on all routes except static files, images, and API routes
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
