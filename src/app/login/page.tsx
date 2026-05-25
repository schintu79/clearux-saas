'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { useAuth } from '@/context/AuthContext'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Logo } from '@/components/marketing/Logo'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  return (
    <Suspense fallback={
      <MarketingBody>
        <div className="flex items-center justify-center min-h-screen bg-paper">
          <div className="w-6 h-6 border-2 border-rule border-t-ink rounded-full animate-spin" />
        </div>
      </MarketingBody>
    }>
      <LoginContent />
    </Suspense>
  )
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
      <circle cx="8" cy="8" r="7" stroke="var(--severe)" strokeWidth="1.5" fill="none" />
      <path d="M8 5v3.5" stroke="var(--severe)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="var(--severe)" />
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5">
      <circle cx="8" cy="8" r="7" stroke="var(--ok)" strokeWidth="1.5" fill="none" />
      <path d="M5 8.5L7 10.5L11 6" stroke="var(--ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingUrl = searchParams.get('url')
  const redirectParam = searchParams.get('redirect')
  const claimParam = searchParams.get('claim')
  const redirectTo = searchParams.get('redirectTo')
    || (redirectParam ? (claimParam ? `${redirectParam}?claim=${claimParam}` : redirectParam) : null)
    || (pendingUrl ? `/dashboard/new-audit?url=${encodeURIComponent(pendingUrl)}` : '/dashboard')
  const { user: authUser, loading: authLoading } = useAuth()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null)
    setOauthLoading(provider)
    try {
      const supabase = createBrowserSupabase()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (oauthError) {
        setError(oauthError.message)
        setOauthLoading(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setOauthLoading(null)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setErrors({})

    const result = loginSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        const path = err.path[0] as string
        fieldErrors[path] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserSupabase()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (authError) {
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Email or password is incorrect'
            : authError.message
        )
        setLoading(false)
        return
      }

      setSuccess('Logging in...')
      window.location.replace(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && authUser) {
      router.replace(redirectTo)
    }
  }, [authLoading, authUser, redirectTo, router])

  if (authLoading || authUser) {
    return (
      <MarketingBody>
        <div className="flex items-center justify-center min-h-screen bg-paper">
          <div className="w-6 h-6 border-2 border-rule border-t-ink rounded-full animate-spin" />
        </div>
      </MarketingBody>
    )
  }

  return (
    <MarketingBody>
      <div className="min-h-screen flex flex-col bg-paper">
        {/* Header */}
        <header className="py-6 px-8 max-sm:px-5">
          <Logo size={26} />
        </header>

        {/* Content */}
        <section className="flex-1 flex items-center justify-center px-8 pb-16 max-sm:px-5">
          <div className="w-full max-w-[460px]">
            {/* Heading */}
            <div className="mb-10">
              <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-4 block">Sign in</span>
              <h1 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-3" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
                Welcome back.
              </h1>
              <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">
                Sign in to access your audits, reports, and brand identities.
              </p>
            </div>

            {/* Alerts */}
            {error && (
              <div role="alert" aria-live="assertive" className="flex items-start gap-3 mb-6 p-4 border border-severe/30 bg-severe/5 font-sans text-[14px] text-ink-2">
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div role="status" aria-live="polite" className="flex items-start gap-3 mb-6 p-4 border border-ok/30 bg-ok/5 font-sans text-[14px] text-ink-2">
                <SuccessIcon />
                <span>{success}</span>
              </div>
            )}

            {/* Trust reassurance — above form for security-conscious users */}
            <p className="mb-8 text-[12px] font-sans text-m-muted leading-relaxed border border-rule/50 px-4 py-3 bg-paper-2">
              Your data stays yours. Audit results are encrypted and private. We never sell or share your information.{' '}
              <Link href="/privacy" className="underline hover:text-ink transition-colors">Privacy policy</Link>
            </p>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 border border-rule bg-paper hover:bg-paper-2 transition-colors text-[15px] font-sans font-medium text-ink disabled:opacity-50"
            >
              {oauthLoading === 'google' ? (
                <div className="w-5 h-5 border-2 border-rule border-t-ink rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-rule" />
              <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-m-muted">or</span>
              <div className="flex-1 h-px bg-rule" />
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-5" aria-label="Sign in form">
              <div>
                <label htmlFor="email" className="block font-mono text-[11px] tracking-[0.06em] uppercase text-m-muted mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  aria-required="true"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`w-full bg-paper-2 border border-rule text-ink placeholder:text-m-muted focus:border-ink focus:outline-none px-5 py-3.5 text-[15px] font-sans transition-colors ${errors.email ? 'border-severe' : ''}`}
                  disabled={loading}
                />
                {errors.email && <p className="text-[12px] text-severe mt-1.5 font-sans">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block font-mono text-[11px] tracking-[0.06em] uppercase text-m-muted mb-2">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    aria-required="true"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className={`w-full bg-paper-2 border border-rule text-ink placeholder:text-m-muted focus:border-ink focus:outline-none px-5 py-3.5 pr-12 text-[15px] font-sans transition-colors ${errors.password ? 'border-severe' : ''}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-m-muted hover:text-ink transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {errors.password && <p className="text-[12px] text-severe mt-1.5 font-sans">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-end">
                <Link href="/forgot-password" className="text-[13px] font-sans text-m-muted hover:text-signal transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full flex items-center justify-center gap-2 bg-ink text-paper font-sans font-medium text-[15px] px-6 py-4 transition-all hover:bg-signal disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRightIcon />
                  </>
                )}
              </button>
            </form>

            {/* Google OAuth note */}
            <p className="mt-8 text-center text-[12px] font-sans text-m-muted leading-relaxed">
              Google sign-in only accesses your email address. No other data is shared.
            </p>

            {/* Sign up link */}
            <p className="mt-4 text-center text-[14px] font-sans text-ink-2">
              Don&apos;t have an account?{' '}
              <Link
                href={pendingUrl ? `/register?url=${encodeURIComponent(pendingUrl)}` : '/register'}
                className="font-medium text-ink underline decoration-signal decoration-2 underline-offset-2 hover:text-signal transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </section>
      </div>
    </MarketingBody>
  )
}
