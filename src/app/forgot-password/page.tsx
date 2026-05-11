'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { MarketingBody } from '@/components/marketing/MarketingBody'
import { Logo } from '@/components/marketing/Logo'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
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

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 7H1M6 2L1 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ForgotPasswordPage() {
  const [formData, setFormData] = useState({ email: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

    const result = forgotPasswordSchema.safeParse(formData)
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

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        formData.email,
        {
          redirectTo: `${appUrl}/auth/callback?type=recovery`,
        }
      )

      if (resetError) {
        setError(resetError.message)
        setLoading(false)
        return
      }

      setSuccess(
        `Password reset link sent to ${formData.email}. Check your inbox and click the link to reset your password.`
      )
      setFormData({ email: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
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
                Reset password
              </h1>
              <p className="font-sans text-[15px] text-ink-2 leading-[1.6]">
                Enter your email address and we&apos;ll send you a link to reset your password.
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" aria-label="Reset password form">
              <div>
                <label htmlFor="email" className="block font-mono text-[11px] tracking-[0.06em] uppercase text-m-muted mb-2">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`w-full bg-paper-2 border border-rule text-ink placeholder:text-m-muted focus:border-ink focus:outline-none px-5 py-3.5 text-[15px] font-sans transition-colors ${errors.email ? 'border-severe' : ''}`}
                  disabled={loading || !!success}
                />
                {errors.email && <p className="text-[12px] text-severe mt-1.5 font-sans">{errors.email}</p>}
              </div>

              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full bg-ink text-paper font-sans font-medium text-[15px] px-6 py-4 transition-all hover:bg-signal disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-paper/30 border-t-paper rounded-full animate-spin" />
                    Sending link...
                  </span>
                ) : success ? (
                  'Link sent'
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            {/* Helpful info */}
            <div className="mt-8 p-5 border border-rule bg-paper-2">
              <p className="font-mono text-[10px] tracking-[0.1em] uppercase text-signal mb-2">Need help?</p>
              <p className="text-[13px] font-sans text-ink-2 leading-relaxed">
                We&apos;ll send you a secure password reset link via email. You&apos;ll be able to create a new password in a few minutes.
              </p>
            </div>

            {/* Back to login */}
            <div className="mt-8 flex items-center justify-center">
              <Link href="/login" className="inline-flex items-center gap-2 text-[14px] font-sans text-m-muted hover:text-signal transition-colors">
                <ArrowLeftIcon />
                Back to login
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingBody>
  )
}
