'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Shield, Clock, TrendingUp, ArrowLeft } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { useAuth } from '@/context/AuthContext'
import Navbar from '@/components/layout/Navbar'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const kspItems = [
  { icon: TrendingUp, text: 'Your audits and reports are waiting for you' },
  { icon: Clock, text: 'Credits never expire — use them anytime' },
  { icon: Shield, text: 'Your data is always safe and encrypted' },
]

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
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

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (!authLoading && authUser) {
      router.replace(redirectTo)
    }
  }, [authLoading, authUser, redirectTo, router])

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
          Sign in
        </h2>
        <p className="text-sm text-muted">
          Enter your credentials to access your dashboard
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

      {/* ── Social sign-in buttons ── */}
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
        <span className="text-xs text-muted font-medium">or sign in with email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
              placeholder="Enter your password"
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
          {errors.password && <p className="text-xs text-red-600 mt-1.5">{errors.password}</p>}
        </div>

        {/* Forgot Password */}
        <div className="text-right">
          <Link href="/forgot-password" className="btn-ghost text-xs">
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner" />
              Signing in...
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-accent font-semibold hover:underline transition-colors">
          Sign up
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
          {/* Left Panel — Welcome Back */}
          <div className="auth-left relative z-0">
            <div className="auth-glow" />
            <div className="relative z-10 flex flex-col h-full">
              <div className="mb-10">
                <Link href="/" className="inline-block">
                  <h1 className="text-3xl font-manrope font-bold text-white">
                    Clear<span className="text-accent">UX</span>
                  </h1>
                </Link>
              </div>

              <div className="mb-auto">
                <h2 className="text-2xl font-manrope font-bold text-white mb-2">
                  Welcome back
                </h2>
                <p className="text-sm text-white/70 leading-relaxed max-w-[320px]">
                  Pick up right where you left off. Your UX insights are ready and waiting.
                </p>

                <div className="mt-8 space-y-5">
                  {kspItems.map((item) => (
                    <div key={item.text} className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                        <item.icon size={22} className="text-accent" />
                      </div>
                      <p className="text-base font-semibold text-white/85">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <div className="bg-white/8 border border-white/10 rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-lg font-bold text-white">56</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wide">Checkpoints</p>
                </div>
                <div className="bg-white/8 border border-white/10 rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-lg font-bold text-white">13</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wide">Categories</p>
                </div>
                <div className="bg-white/8 border border-white/10 rounded-lg px-4 py-3 flex-1 text-center">
                  <p className="text-lg font-bold text-white">&lt; 10 min</p>
                  <p className="text-[10px] text-white/50 uppercase tracking-wide">Per audit</p>
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
