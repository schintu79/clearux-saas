// ============================================================
// ClearUX — Edge Middleware
// Rate limiting + route protection (auth guard)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ── Simple in-memory rate limiter (resets per cold start) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(
  ip: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key)
  }
}, 60_000)

// ── Route protection config ──
const PROTECTED_PATHS = ['/dashboard']
const RATE_LIMITED_API_PATHS = ['/api/audits', '/api/credits', '/api/stripe']

// ── Helper: create Supabase client in middleware context ──
function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Set cookie on the request so subsequent middleware reads get it
          request.cookies.set({ name, value, ...options })
          // Set cookie on the response so it reaches the browser
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // ── Rate limit API routes ──
  if (RATE_LIMITED_API_PATHS.some((p) => pathname.startsWith(p))) {
    const { allowed, remaining } = rateLimit(ip, 30, 60_000)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a moment.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
          },
        },
      )
    }

    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    return response
  }

  // ── Inngest route — no auth needed (has its own signing) ──
  if (pathname.startsWith('/api/inngest')) {
    return NextResponse.next()
  }

  // ── Auth guard for protected routes ──
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected) {
    const response = NextResponse.next()
    const supabase = createMiddlewareClient(request, response)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in → redirect to login with return URL
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(loginUrl)
      }

      return response
    } catch {
      // If Supabase call fails, redirect to login as a safety net
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
  ],
}
