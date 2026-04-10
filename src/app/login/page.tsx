'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Shield, Clock, TrendingUp, ArrowLeft } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
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
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

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
      // Hard redirect ensures cookies are fully set before the dashboard loads.
      // This prevents the "flash of unauthenticated" state.
      window.location.replace(redirectTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Left Panel — Welcome Back */}
      <div className="auth-left relative z-0">
        <div className="auth-glow" />
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="mb-10">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-manrope font-bold text-white">
                Clear<span className="text-accent">UX</span>
              </h1>
            </Link>
          </div>

          {/* Welcome */}
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

          {/* Stat badges */}
          <div className="flex gap-4 mt-8">
            <div className="bg-white/8 border border-white/10 rounded-lg px-4 py-3 flex-1 text-center">
              <p className="text-lg font-bold text-white">48</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Checkpoints</p>
            </div>
            <div className="bg-white/8 border border-white/10 rounded-lg px-4 py-3 flex-1 text-center">
              <p className="text-lg font-bold text-white">48</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Checkpoints</p>
            </div>
            <div className="bg-white/8 border border-white/10 rounded-lg px-4 py-3 flex-1 text-center">
              <p className="text-lg font-bold text-white">12</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Categories</p>
            </div>
            <div className="bg-white/8 border border-white/10 rounded-lg px-4 py-3 flex-1 text-center">
              <p className="text-lg font-bold text-white">&lt; 10 min</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Per audit</p>
            </div>
          </div>

          {/* Back to Home */}
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
        {/* Mobile / tablet logo (shown when left panel is hidden) */}
        <div className="lg:hidden w-full mb-6">
          <Link href="/">
            <span className="text-2xl font-manrope font-bold text-text">Clear<span className="text-accent">UX</span></span>
          </Link>
        </div>
        <div className="auth-form-wrap">
          <div className="mb-8">
            <h2 className="text-2xl font-manrope font-bold text-text mb-2">
              Sign in
            </h2>
            <p className="text-sm text-muted">
              Enter your credentials to access your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="alert-error flex items-start gap-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert-success flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

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
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                  disabled={loading}
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

          {/* Mobile/tablet back to home */}
          <div className="lg:hidden mt-4 text-center">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text transition-colors">
              <ArrowLeft size={13} /> Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
