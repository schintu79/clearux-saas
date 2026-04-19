'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Search, BarChart3, Zap, FileText, ArrowRight, ArrowLeft } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { useAuth } from '@/context/AuthContext'
import Navbar from '@/components/layout/Navbar'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { z } from 'zod'

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/* ── Password requirement checks ──────────────────────────── */
function getPasswordChecks(pw: string) {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', met: /[a-z]/.test(pw) },
    { label: 'One number', met: /\d/.test(pw) },
  ]
}

const valueProps = [
  {
    icon: Search,
    title: '64 Checkpoints, 16 Categories',
    desc: 'Accessibility, ethical UX, AI readiness, conversion psychology — the blind spots other tools miss.',
  },
  {
    icon: Zap,
    title: 'Full Report in Minutes',
    desc: 'What takes consultants 2-4 weeks at $5k-15k, delivered in under 10 minutes.',
  },
  {
    icon: BarChart3,
    title: 'Impact-Ranked Findings',
    desc: 'Every issue scored by severity and business impact. Your team knows exactly where to start.',
  },
  {
    icon: FileText,
    title: 'PDF & Word Downloads',
    desc: 'Professional reports ready to share with stakeholders, clients, or your dev team.',
  },
]

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingUrl = searchParams.get('url')
  const redirectToParam = searchParams.get('redirect')
  const claimParam = searchParams.get('claim')
  // Where to go after successful auth — if user came with a URL, go straight to new-audit
  // If a redirect was specified (e.g. from preview page), use that
  const postAuthRedirect = redirectToParam
    ? (claimParam ? `${redirectToParam}?claim=${claimParam}` : redirectToParam)
    : pendingUrl
      ? `/dashboard/new-audit?url=${encodeURIComponent(pendingUrl)}`
      : '/dashboard'
  const { user: authUser, loading: authLoading } = useAuth()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null)
    setOauthLoading(provider)
    try {
      const supabase = createBrowserSupabase()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(postAuthRedirect)}`,
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

  const passwordChecks = getPasswordChecks(formData.password)

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

    const result = registerSchema.safeParse(formData)
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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName },
          emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(postAuthRedirect)}`,
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      setSuccess('Account created! Check your email to confirm your address before signing in.')
      setFormData({ fullName: '', email: '', password: '', confirmPassword: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  // If already logged in, redirect to post-auth destination
  useEffect(() => {
    if (!authLoading && authUser) {
      router.replace(postAuthRedirect)
    }
  }, [authLoading, authUser, postAuthRedirect, router])

  // Show loading while checking auth state
  if (authLoading || authUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  /* ── Shared form JSX ─────────────────────────────────────── */
  const formContent = (
    <div className="w-full max-w-[380px]">
      <div className="mb-6">
        <h2 className="text-2xl font-heading font-semibold text-text mb-1.5">
          Start Your Free UX Audit
        </h2>
        <p className="text-sm text-muted">
          {pendingUrl
            ? 'Create your account to run your first audit \u2014 free, no credit card required.'
            : 'Sign up to get consultant-grade UX insights in under 10 minutes.'}
        </p>
        <p className="text-xs text-muted/60 mt-2">
          64-point analysis · Actionable findings · Impact-ranked recommendations
        </p>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="alert-error flex items-start gap-3 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" aria-live="polite" className="alert-success flex items-start gap-3 mb-4">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ── Social sign-up buttons ── */}
      <div className="space-y-3 mb-6">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          disabled={!!oauthLoading || loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[48px] rounded-xl bg-text/[0.03] hover:bg-text/[0.06] transition-colors text-[15px] font-medium text-text disabled:opacity-50"
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
      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted font-medium">or sign up with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create account form">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="label">Full Name</label>
          <input
            id="fullName"
            type="text"
            name="fullName"
            autoComplete="name"
            aria-required="true"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Sarah Chen"
            className={`input ${errors.fullName ? 'input-error' : ''}`}
            disabled={loading}
          />
          {errors.fullName && <p className="text-xs text-[#EF4444] mt-1.5">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            aria-required="true"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={`input ${errors.email ? 'input-error' : ''}`}
            disabled={loading}
          />
          {errors.email && <p className="text-xs text-[#EF4444] mt-1.5">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              aria-required="true"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a strong password"
              className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors z-10 p-1"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Password Strength Signifiers */}
          {formData.password.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {passwordChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    check.met ? 'bg-emerald-500' : 'bg-border'
                  }`}>
                    {check.met && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </div>
                  <span className={`text-xs transition-colors ${check.met ? 'text-[#22C55E]' : 'text-muted'}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {errors.password && <p className="text-xs text-[#EF4444] mt-1.5">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="label">Confirm Password</label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              aria-required="true"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              className={`input pr-10 ${errors.confirmPassword ? 'input-error' : ''}`}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors z-10 p-1"
              tabIndex={-1}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {formData.confirmPassword.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                formData.password === formData.confirmPassword ? 'bg-emerald-500' : 'bg-border'
              }`}>
                {formData.password === formData.confirmPassword && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <span className={`text-xs transition-colors ${
                formData.password === formData.confirmPassword ? 'text-[#22C55E]' : 'text-muted'
              }`}>
                {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </span>
            </div>
          )}
          {errors.confirmPassword && <p className="text-xs text-[#EF4444] mt-1.5">{errors.confirmPassword}</p>}
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner" />
              Creating account...
            </span>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href={pendingUrl ? `/login?redirectTo=${encodeURIComponent(postAuthRedirect)}` : '/login'} className="font-semibold hover:underline transition-colors text-text">
          Sign in
        </Link>
      </div>
    </div>
  )

  return (
    <>
      {/* ── MOBILE / TABLET: Navbar + full-width form ────────── */}
      <div className="lg:hidden min-h-screen bg-surface flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {formContent}
        </div>
        {/* Mobile footer nav */}
        <div className="border-t border-border/30 dark:border-white/[0.06] px-4 py-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted">
            <Link href="/" className="hover:text-text transition-colors font-medium flex items-center gap-1">
              <ArrowLeft size={12} /> Back to Home
            </Link>
            <span className="text-border">|</span>
            <Link href="/pricing" className="hover:text-text transition-colors">Pricing</Link>
            <span className="text-border">|</span>
            <Link href="/about" className="hover:text-text transition-colors">About</Link>
            <span className="text-border">|</span>
            <Link href="/faq" className="hover:text-text transition-colors">FAQ</Link>
            <span className="text-border">|</span>
            <Link href="/contact" className="hover:text-text transition-colors">Contact</Link>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: classic 2-panel layout ──────────────────── */}
      <div className="hidden lg:block">
        <div className="auth-page">
          {/* Left Panel — Value Props */}
          <div className="auth-left relative z-0">
            <div className="auth-glow" />

            {/* Subtle lime scribble accent — top-right */}
            <svg className="absolute top-16 right-10 opacity-[0.07] pointer-events-none" width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="50" stroke="#B9FF66" strokeWidth="1.5" strokeDasharray="6 8" />
              <circle cx="60" cy="60" r="30" stroke="#B9FF66" strokeWidth="1" strokeDasharray="4 6" />
            </svg>

            {/* Subtle lime scribble accent — bottom-left */}
            <svg className="absolute bottom-20 left-8 opacity-[0.06] pointer-events-none" width="80" height="80" viewBox="0 0 80 80" fill="none">
              <path d="M10 70 Q 40 10, 70 70" stroke="#B9FF66" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              <path d="M20 65 Q 40 20, 60 65" stroke="#B9FF66" strokeWidth="1" fill="none" strokeLinecap="round" />
            </svg>

            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-10">
                <Link href="/" className="inline-block">
                  <span className="font-heading text-3xl font-bold tracking-tight text-white">ClearUX</span>
                </Link>
              </div>

              <div className="mb-auto">
                <h2 className="text-2xl font-heading font-semibold text-white mb-2">
                  {pendingUrl ? 'Your free audit is one step away' : 'Start your free audit'}
                </h2>
                <p className="text-sm text-white/65 leading-relaxed max-w-[320px]">
                  No credit card required. Get consultant-grade UX insights in under 10 minutes.
                </p>

                {pendingUrl && (
                  <div className="mt-4 rounded-lg bg-white/[0.04] px-4 py-2.5">
                    <p className="text-[11px] text-white/50 font-medium truncate">Auditing: {pendingUrl}</p>
                  </div>
                )}

                <div className="mt-8 space-y-5">
                  {valueProps.map((prop) => (
                    <div key={prop.title} className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <prop.icon size={22} className="text-white/70" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-white/80">{prop.title}</p>
                        <p className="text-[13px] text-white/50 leading-relaxed mt-0.5">{prop.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <div className="bg-white/[0.04] rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-lg font-bold text-white">64</p>
                  <p className="text-xs text-white/55 uppercase tracking-wide">Checkpoints</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-lg font-bold text-white">16</p>
                  <p className="text-xs text-white/55 uppercase tracking-wide">Categories</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-lg font-bold text-white">&lt; 10 min</p>
                  <p className="text-xs text-white/55 uppercase tracking-wide">Per audit</p>
                </div>
              </div>

              {/* Secondary CTA */}
              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                <p className="text-xs text-white/35 mb-3">Not ready to sign up?</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/about" className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors">
                    How it works <ArrowRight size={14} />
                  </Link>
                  <span className="text-white/15">|</span>
                  <Link href="/pricing" className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors">
                    Pricing <ArrowRight size={14} />
                  </Link>
                  <span className="text-white/15">|</span>
                  <Link href="/faq" className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors">
                    FAQ <ArrowRight size={14} />
                  </Link>
                  <span className="text-white/15">|</span>
                  <Link href="/contact" className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors">
                    Contact <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel — Form */}
          <div className="auth-right">
            <div className="absolute top-4 right-4">
              <ThemeToggle variant="icon" />
            </div>
            <div className="auth-form-wrap">
              {formContent}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
