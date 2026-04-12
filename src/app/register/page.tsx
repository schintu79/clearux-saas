'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Search, BarChart3, Zap, FileText, ArrowLeft } from 'lucide-react'
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

/* ── Rotating testimonials ────────────────────────────────── */
const testimonials = [
  {
    text: "ClearUX identified critical navigation issues we'd completely missed. The insights were actionable and prioritized perfectly.",
    name: 'Sarah Chen',
    role: 'Head of Product @ TechFlow',
  },
  {
    text: "We improved our conversion rate by 23% just by implementing the top 5 recommendations. Best ROI on any UX tool we've used.",
    name: 'Marcus Rivera',
    role: 'Growth Lead @ ShopBase',
  },
  {
    text: "The AI audit caught accessibility problems our manual review missed entirely. A game-changer for our compliance workflow.",
    name: 'Elena Kowalski',
    role: 'UX Director @ FinServe',
  },
  {
    text: "I run audits on every client project now before presenting. It adds so much credibility to my proposals.",
    name: 'David Park',
    role: 'Freelance UX Consultant',
  },
]

const valueProps = [
  {
    icon: Search,
    title: '56 UX Checkpoints',
    desc: 'Deep analysis across usability, conversion, accessibility, mobile, content and AI discoverability.',
  },
  {
    icon: Zap,
    title: 'Results in Minutes',
    desc: 'What takes consultants weeks, our AI delivers in under 10 minutes with professional-grade depth.',
  },
  {
    icon: BarChart3,
    title: 'Prioritised Action Plan',
    desc: 'Every finding ranked by severity and impact so you know exactly where to start.',
  },
  {
    icon: FileText,
    title: 'PDF & Word Reports',
    desc: 'Download beautifully formatted reports to share with stakeholders and your team.',
  },
]

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingUrl = searchParams.get('url')
  // Where to go after successful auth — if user came with a URL, go straight to new-audit
  const postAuthRedirect = pendingUrl
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
  const [activeTestimonial, setActiveTestimonial] = useState(0)

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

  // Rotate testimonials every 5s
  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial((i) => (i + 1) % testimonials.length), 5000)
    return () => clearInterval(t)
  }, [])

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
      <div className="mb-8">
        <h2 className="text-2xl font-manrope font-bold text-text mb-2">
          Create account
        </h2>
        <p className="text-sm text-muted">
          Join ClearUX to start auditing your UX
        </p>
      </div>

      {error && (
        <div className="alert-error flex items-start gap-3 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert-success flex items-start gap-3 mb-4">
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
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-surface-alt transition-colors text-sm font-medium text-text disabled:opacity-50"
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="label">Full Name</label>
          <input
            id="fullName"
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Sarah Chen"
            className={`input ${errors.fullName ? 'input-error' : ''}`}
            disabled={loading}
          />
          {errors.fullName && <p className="text-xs text-red-600 mt-1.5">{errors.fullName}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={`input ${errors.email ? 'input-error' : ''}`}
            disabled={loading}
          />
          {errors.email && <p className="text-xs text-red-600 mt-1.5">{errors.email}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              name="password"
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
                  <span className={`text-xs transition-colors ${check.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {errors.password && <p className="text-xs text-red-600 mt-1.5">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="label">Confirm Password</label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
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
                formData.password === formData.confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'
              }`}>
                {formData.password === formData.confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </span>
            </div>
          )}
          {errors.confirmPassword && <p className="text-xs text-red-600 mt-1.5">{errors.confirmPassword}</p>}
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
        <Link href={pendingUrl ? `/login?redirectTo=${encodeURIComponent(postAuthRedirect)}` : '/login'} className="font-semibold hover:underline transition-colors bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>
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
        <div className="flex-1 flex items-center justify-center px-4 py-10">
          {formContent}
        </div>
      </div>

      {/* ── DESKTOP: classic 2-panel layout ──────────────────── */}
      <div className="hidden lg:block">
        <div className="auth-page">
          {/* Left Panel — Value Props + Rotating Reviews */}
          <div className="auth-left relative z-0">
            <div className="auth-glow" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-10">
                <Link href="/" className="inline-block">
                  <h1 className="text-3xl font-manrope font-bold text-white">
                    Clear<span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-brand-text)' }}>UX</span>
                  </h1>
                </Link>
              </div>

              <div className="space-y-6 mb-auto">
                <h2 className="text-xl font-manrope font-semibold text-white">
                  Everything you need to ship better UX
                </h2>

                <div className="grid grid-cols-1 gap-5">
                  {valueProps.map((prop) => (
                    <div key={prop.title} className="flex gap-4 items-start">
                      <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <prop.icon size={22} className="text-white/80" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-white">{prop.title}</p>
                        <p className="text-sm text-white/65 leading-relaxed mt-0.5">{prop.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <div className="bg-white/8 border border-white/10 rounded-xl p-5 backdrop-blur-sm min-h-[140px] transition-all duration-500">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="text-yellow-400 text-sm">&#9733;</div>
                    ))}
                  </div>
                  <p className="text-sm text-white/90 mb-3 leading-relaxed">
                    &ldquo;{testimonials[activeTestimonial].text}&rdquo;
                  </p>
                  <p className="text-xs text-white/55">
                    {testimonials[activeTestimonial].name}, {testimonials[activeTestimonial].role}
                  </p>
                </div>

                <div className="flex justify-center gap-2 mt-3">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveTestimonial(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        i === activeTestimonial ? 'bg-white w-4' : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white transition-colors mt-6">
                <ArrowLeft size={16} /> Back to home
              </Link>
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
