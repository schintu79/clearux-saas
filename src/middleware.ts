// ============================================================
// ClearUX — Middleware
// Rate limiting + route protection (auth guard)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// ── Simple in-memory rate limiter (resets per cold start) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
let lastCleanup = Date.now()

function rateLimit(
  ip: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now()

  // Clean up expired entries inline (every 60s)
  if (now - lastCleanup > 60_000) {
    lastCleanup = now
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }

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

// ── Route protection config ──
const PROTECTED_PATHS = ['/dashboard', '/admin']
const RATE_LIMITED_API_PATHS = ['/api/audits', '/api/credits', '/api/stripe']

// ── Helper: create Supabase client in proxy context ──
function createProxyClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
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

  // ── Refresh Supabase session for ALL page routes ──
  // This ensures the auth cookie stays fresh on marketing pages too,
  // so the Navbar correctly shows the logged-in state everywhere.
  const response = NextResponse.next()
  const supabase = createProxyClient(request, response)

  try {
    const { data: { session } } = await supabase.auth.getSession()

    // ── Auth guard for protected routes ──
    const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

    if (isProtected && !session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(loginUrl)
    }

    return response
  } catch {
    return response
  }
}

export const config = {
  // Run on all page routes so Supabase session is refreshed everywhere.
  // Exclude static assets and Next.js internals.
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
