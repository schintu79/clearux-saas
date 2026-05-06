'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

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

    // Validate
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
      <div className="auth-page">
        <div className="auth-left relative z-0">
          <div className="auth-glow" />
          <div className="relative z-10 flex flex-col">
            <div className="mb-16">
              <h1 className="text-3xl font-heading font-medium text-white mb-3">
                ClearUX
              </h1>
              <p className="text-sm text-white/80 opacity-85">
                Expert UX audits powered by AI. Discover usability issues in minutes — not weeks.
              </p>
            </div>
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-form-wrap">
            <div className="flex items-center justify-center gap-2">
              <span className="spinner" />
              <p className="text-sm text-white/50">Verifying reset link...</p>
            </div>
          </div>
        </div>
      </div>
    )
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
              <h3 className="text-sm font-medium text-white mb-2">Security matters</h3>
              <p className="text-xs text-white/80 opacity-80">
                Choose a strong password with at least 8 characters, including a mix of letters, numbers, and symbols for maximum protection.
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
              Create new password
            </h2>
            <p className="text-sm text-white/50">
              Set a strong password to secure your account
            </p>
          </div>

          {isValidSession ? (
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

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="label">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                    disabled={loading || !!success}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    disabled={loading || !!success}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1.5">{errors.password}</p>
                )}
              </div>

              {/* Confirm Password Field */}
              <div>
                <label htmlFor="confirmPassword" className="label">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`input pr-10 ${errors.confirmPassword ? 'input-error' : ''}`}
                    disabled={loading || !!success}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    disabled={loading || !!success}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-600 mt-1.5">{errors.confirmPassword}</p>
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
                    Resetting password...
                  </span>
                ) : success ? (
                  'Password reset'
                ) : (
                  'Reset password'
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="alert-error flex items-start gap-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <Link href="/forgot-password" className="btn-primary block text-center">
                Request new reset link
              </Link>
            </div>
          )}

          {/* Back to Login Link */}
          {isValidSession && (
            <div className="mt-6 flex items-center justify-center">
              <Link href="/login" className="btn-ghost flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
