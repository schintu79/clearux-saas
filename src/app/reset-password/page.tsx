'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Logo } from '@/components/marketing/Logo'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

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

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 7H1M6 2L1 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)
  const [sessionChecking, setSessionChecking] = useState(true)

  // Verify user has a valid session (came from reset email)
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createBrowserSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Invalid or expired reset link. Please request a new password reset.')
      } else {
        setIsValidSession(true)
      }
      setSessionChecking(false)
    }
    checkSession()
  }, [])

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

    const result = resetPasswordSchema.safeParse(formData)
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.password,
      })

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      setSuccess('Password reset successfully! Redirecting to dashboard...')
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  if (sessionChecking) {
    return (
      <MarketingBody>
        <div className="min-h-screen flex flex-col bg-paper">
          <header className="py-6 px-8 max-sm:px-5">
            <Logo size={26} />
          </header>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-rule border-t-ink rounded-full animate-spin" />
              <p className="text-[14px] font-sans text-m-muted">Verifying reset link...</p>
            </div>
          </div>
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
              <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-signal mb-4 block">Account recovery</span>
              <h1 className="font-serif font-normal text-ink leading-[0.96] tracking-[-0.02em] mb-3" style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
                Create new password
              </h1>
              <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">
                Set a strong password to secure your account.
              </p>
            </div>

            {isValidSession ? (
              <>
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5" aria-label="Create new password form">
                  <div>
                    <label htmlFor="password" className="block font-mono text-[11px] tracking-[0.06em] uppercase text-m-muted mb-2">New Password</label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="At least 8 characters"
                        className={`w-full bg-paper-2 border border-rule text-ink placeholder:text-m-muted focus:border-ink focus:outline-none px-5 py-3.5 pr-12 text-[15px] font-sans transition-colors ${errors.password ? 'border-severe' : ''}`}
                        disabled={loading || !!success}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-m-muted hover:text-ink transition-colors"
                        disabled={loading || !!success}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {errors.password && <p className="text-[12px] text-severe mt-1.5 font-sans">{errors.password}</p>}
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block font-mono text-[11px] tracking-[0.06em] uppercase text-m-muted mb-2">Confirm Password</label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="Repeat your password"
                        className={`w-full bg-paper-2 border border-rule text-ink placeholder:text-m-muted focus:border-ink focus:outline-none px-5 py-3.5 pr-12 text-[15px] font-sans transition-colors ${errors.confirmPassword ? 'border-severe' : ''}`}
                        disabled={loading || !!success}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-m-muted hover:text-ink transition-colors"
                        disabled={loading || !!success}
                      >
                        {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-[12px] text-severe mt-1.5 font-sans">{errors.confirmPassword}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !!success}
                    className="w-full bg-ink text-paper font-sans font-medium text-[15px] px-6 py-4 transition-all hover:bg-signal disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                        Resetting password...
                      </span>
                    ) : success ? (
                      'Password reset'
                    ) : (
                      'Reset password'
                    )}
                  </button>
                </form>

                {/* Helpful info */}
                <div className="mt-8 p-5 border border-rule bg-paper-2">
                  <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-signal mb-2">Security</p>
                  <p className="text-[13px] font-sans text-ink-2 leading-relaxed">
                    Choose a strong password with at least 8 characters, including a mix of letters, numbers, and symbols.
                  </p>
                </div>

                {/* Back to login */}
                <div className="mt-8 flex items-center justify-center">
                  <Link href="/login" className="inline-flex items-center gap-2 text-[14px] font-sans text-m-muted hover:text-signal transition-colors">
                    <ArrowLeftIcon />
                    Back to login
                  </Link>
                </div>
              </>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-3 p-4 border border-severe/30 bg-severe/5 font-sans text-[14px] text-ink-2">
                  <AlertIcon />
                  <span>{error}</span>
                </div>
                <Link href="/forgot-password" className="block w-full bg-ink text-paper font-sans font-medium text-[15px] px-6 py-4 text-center transition-all hover:bg-signal">
                  Request new reset link
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </MarketingBody>
  )
}
