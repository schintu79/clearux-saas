'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

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

    // Validate
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
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left relative z-0">
        <div className="auth-glow" />
        <div className="relative z-10 flex flex-col">
          {/* Logo & Tagline */}
          <div className="mb-16">
            <h1 className="text-3xl font-heading font-medium text-white mb-3">
              ClearUX
            </h1>
            <p className="text-sm text-white/80 opacity-85">
              Expert UX audits powered by AI. Discover usability issues in minutes — not weeks.
            </p>
          </div>

          {/* Info Card */}
          <div className="mt-auto">
            <div className="bg-white bg-opacity-8 border border-white border-opacity-10 rounded-xl p-6 backdrop-blur-sm">
              <h3 className="text-sm font-medium text-white mb-2">Need help?</h3>
              <p className="text-xs text-white/80 opacity-80">
                We'll send you a secure password reset link via email. You'll be able to create a new password in just a few minutes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="mb-8">
            <h2 className="text-2xl font-heading font-medium text-white mb-2">
              Reset password
            </h2>
            <p className="text-sm text-white/50">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="alert-error flex items-start gap-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Alert */}
            {success && (
              <div className="alert-success flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className={`input ${errors.email ? 'input-error' : ''}`}
                disabled={loading || !!success}
              />
              {errors.email && (
                <p className="text-xs text-red-600 mt-1.5">{errors.email}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !!success}
              className="btn-primary"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner" />
                  Sending link...
                </span>
              ) : success ? (
                'Link sent'
              ) : (
                'Send reset link'
              )}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-6 flex items-center justify-center">
            <Link href="/login" className="btn-ghost flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
