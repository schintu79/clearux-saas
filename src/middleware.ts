// ============================================================
// ClearUX — Edge Middleware
// Rate limiting + route protection
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

// ── Simple in-memory rate limiter (resets per cold start) ──
// For production at scale, switch to Vercel KV or Upstash Redis.
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
const PROTECTED_PATHS = ['/dashboard', '/api/audits', '/api/credits']
const AUTH_PATHS = ['/login', '/register']
const RATE_LIMITED_API_PATHS = ['/api/audits', '/api/credits', '/api/stripe']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  // ── Rate limit API routes ──
  if (RATE_LIMITED_API_PATHS.some((p) => pathname.startsWith(p))) {
    // 30 requests per minute per IP for API routes
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

    // Add rate limit headers to response
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    return response
  }

  // ── Inngest route — no auth needed (has its own signing) ──
  if (pathname.startsWith('/api/inngest')) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  // Match API routes and dashboard pages
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
  ],
}
