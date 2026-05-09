'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { useAuth } from '@/context/AuthContext'
import Navbar from '@/components/layout/Navbar'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-[#111114]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
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
      <div className="flex items-center justify-center min-h-screen bg-[#111114]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#111114] relative overflow-hidden">
      <Navbar />

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <img
          src="/gradients/bg-hero.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#111114] via-transparent to-[#111114]" />
      </div>

      {/* Content */}
      <section className="relative z-10 flex-1 flex items-center justify-center py-16 sm:py-24 px-6 sm:px-10">
        <div className="w-full max-w-xl">

          {/* Heading */}
          <div className="text-center mb-10">
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-white/60 mb-3">
              Sign in
            </p>
            <h1
              className="font-heading text-[2rem] sm:text-[2.75rem] font-bold text-white mb-3"
              style={{ lineHeight: '1.1' }}
            >
              Welcome <span className="text-lime-gradient">back.</span>
            </h1>
            <p className="text-base text-white/60 leading-relaxed">
              Sign in to access your audits, reports, and brand identities.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-8 sm:p-10">
            {error && (
              <div role="alert" aria-live="assertive" className="alert-error flex items-start gap-3 mb-6">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div role="status" aria-live="polite" className="alert-success flex items-start gap-3 mb-6">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Google OAuth */}
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 min-h-[52px] rounded-full border border-white/[0.10] bg-white/[0.04] hover:bg-white/[0.08] transition-colors text-base font-medium text-white disabled:opacity-50"
            >
              {oauthLoading === 'google' ? (
                <span className="spinner" />
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
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-white/60 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {/* Email form */}
            <form onSubmit={handleSubmit} className="space-y-5" aria-label="Sign in form">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  aria-required="true"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`w-full rounded-full bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/50 focus:border-white/20 focus:outline-none px-6 py-4 text-base font-body ${errors.email ? 'border-red-500/50' : ''}`}
                  disabled={loading}
                />
                {errors.email && <p className="text-xs text-red-400 mt-2">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-2">Password</label>
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
                    className={`w-full rounded-full bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/50 focus:border-white/20 focus:outline-none px-6 py-4 pr-12 text-base font-body ${errors.password ? 'border-red-500/50' : ''}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/70 transition-colors z-10 p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-400 mt-2">{errors.password}</p>}
              </div>

              <div className="flex items-center justify-end pt-1">
                <Link href="/forgot-password" className="text-sm text-white/60 hover:text-white/70 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group w-full inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-full bg-white text-[#111114] text-base font-medium transition-all hover:bg-white/90 min-h-[52px] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-white/50 leading-relaxed">
            Your audit results are private and encrypted. We never share your data.
          </p>

          {/* Sign up link */}
          <p className="mt-4 text-center text-sm text-white/60">
            Don&apos;t have an account?{' '}
            <Link
              href={pendingUrl ? `/register?url=${encodeURIComponent(pendingUrl)}` : '/register'}
              className="font-medium text-volt hover:underline transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
