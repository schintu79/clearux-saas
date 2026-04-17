'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Sparkles,
  Lock,
  ArrowRight,
  Shield,
  Eye,
  Target,
  AlertTriangle,
  CheckCircle2,
  Globe,
  Clock,
  Brain,
  Heart,
  Accessibility,
  Zap,
  ExternalLink,
  FileText,
  Download,
  Search,
  MousePointerClick,
  Smartphone,
  Type,
  Gauge,
  Map,
  Scale,
  Lightbulb,
} from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase-ssr'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ScoreRing from '@/components/ui/ScoreRing'

interface Audit {
  id: string
  url: string
  status: string
  overall_score: number | null
  created_at: string
  report_id?: string
}

interface Report {
  id: string
  executive_summary: string | null
  pillar_foundation: number | null
  pillar_experience: number | null
  pillar_inclusive: number | null
  pillar_future: number | null
  total_findings: number | null
}

interface Finding {
  id: string
  title: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
  recommendation: string
}

const auditCheckpoints = [
  'Checking navigation clarity & structure',
  'Evaluating page load performance',
  'Analysing mobile responsiveness',
  'Reviewing call-to-action effectiveness',
  'Assessing visual hierarchy',
  'Testing colour contrast & accessibility',
  'Evaluating content readability',
  'Reviewing trust signals & social proof',
  'Checking AI discoverability',
  'Analysing emotional design patterns',
]

const pillarConfig = [
  { key: 'pillar_foundation', label: 'Foundation', icon: Shield, color: 'from-blue-500 to-blue-600' },
  { key: 'pillar_experience', label: 'Human Experience', icon: Heart, color: 'from-rose-500 to-rose-600' },
  { key: 'pillar_inclusive', label: 'Inclusive Design', icon: Accessibility, color: 'from-purple-500 to-purple-600' },
  { key: 'pillar_future', label: 'Future Readiness', icon: Zap, color: 'from-amber-500 to-amber-600' },
]

export default function PreviewPage() {
  const params = useParams()
  const auditId = params?.id as string
  const supabaseRef = useRef<ReturnType<typeof createBrowserSupabase> | null>(null)
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [audit, setAudit] = useState<Audit | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentCheckpointIndex, setCurrentCheckpointIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  const initializeSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserSupabase()
    }
    return supabaseRef.current
  }, [])

  const fetchAuditData = useCallback(async () => {
    if (!auditId) return

    const supabase = initializeSupabase()

    try {
      // Fetch audit
      const { data: auditData, error: auditError } = await supabase
        .from('audits')
        .select('id, url, status, overall_score, created_at, report_id')
        .eq('id', auditId)
        .eq('preview_mode', true)
        .single()

      if (auditError) {
        setError('Audit not found or access denied.')
        setLoading(false)
        return
      }

      setAudit(auditData)

      // Check if still processing
      if (auditData.status !== 'completed') {
        setIsProcessing(true)
        setProgress(Math.min(progress + 20, 90))
        setCurrentCheckpointIndex((prev) => (prev + 1) % auditCheckpoints.length)
        // Poll again in 5 seconds
        pollTimeoutRef.current = setTimeout(() => {
          fetchAuditData()
        }, 5000)
        return
      }

      // Fetch report if audit is complete
      if (auditData.report_id) {
        const { data: reportData, error: reportError } = await supabase
          .from('reports')
          .select('*')
          .eq('id', auditData.report_id)
          .single()

        if (!reportError && reportData) {
          setReport(reportData)
        }
      }

      // Fetch findings
      const { data: findingsData, error: findingsError } = await supabase
        .from('findings')
        .select('*')
        .eq('audit_id', auditId)

      if (!findingsError && findingsData) {
        setFindings(findingsData)
      }

      setIsProcessing(false)
      setProgress(100)
      setLoading(false)
    } catch (err) {
      setError('Failed to fetch audit data.')
      setLoading(false)
    }
  }, [auditId, initializeSupabase, progress])

  useEffect(() => {
    fetchAuditData()

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
    }
  }, [fetchAuditData])

  // Animate checkpoint cycling during processing
  useEffect(() => {
    if (!isProcessing) return

    const checkpointInterval = setInterval(() => {
      setCurrentCheckpointIndex((prev) => (prev + 1) % auditCheckpoints.length)
    }, 2000)

    return () => clearInterval(checkpointInterval)
  }, [isProcessing])

  if (loading && !audit) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-off">
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-brand opacity-20" />
              </div>
              <p className="font-body text-text">Loading audit...</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-off">
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <AlertTriangle className="mb-4 h-12 w-12 text-red-500 opacity-50" />
              <p className="font-body text-text">{error}</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (!audit) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-off">
          <div className="flex items-center justify-center py-32">
            <p className="font-body text-text">Audit not found.</p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // Processing state
  if (isProcessing) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-off">
          <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-xl border border-border bg-card p-8 sm:p-12">
              <div className="mb-8 text-center">
                <h1 className="font-heading text-2xl font-semibold text-text sm:text-3xl">
                  Auditing Your Website
                </h1>
                <p className="mt-2 font-body text-sm text-muted">{audit.url}</p>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-body text-xs font-medium text-muted">Progress</span>
                  <span className="font-body text-xs font-medium text-muted">{Math.min(progress, 90)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    style={{
                      width: `${Math.min(progress, 90)}%`,
                    }}
                    className="h-full bg-brand rounded-full transition-all duration-500"
                  />
                </div>
              </div>

              {/* Checkpoints */}
              <div className="space-y-4">
                {['Queued', 'Crawling', 'Analysing', 'Report', 'Done'].map((step, idx) => {
                  const stepProgress = (idx + 1) / 5
                  const isActive = progress / 100 >= stepProgress
                  const isPending = progress / 100 < stepProgress

                  return (
                    <div key={step} className="flex items-start gap-3">
                      <div className="mt-1 flex-shrink-0">
                        {isActive ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : isPending ? (
                          <div className="h-5 w-5 rounded-full border-2 border-border" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-border" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-body text-sm font-medium ${isActive ? 'text-text' : 'text-muted'}`}>
                          {step}
                        </p>
                        {isActive && !isPending && idx < 4 && (
                          <p className="mt-1 font-body text-xs text-muted">{auditCheckpoints[currentCheckpointIndex]}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="mt-8 text-center font-body text-xs text-muted">
                This usually takes 2-3 minutes. We're running a thorough analysis...
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // Completed state
  const severityCounts = {
    CRITICAL: findings.filter((f) => f.severity === 'CRITICAL').length,
    HIGH: findings.filter((f) => f.severity === 'HIGH').length,
    MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
    LOW: findings.filter((f) => f.severity === 'LOW').length,
  }

  const executiveSummary =
    report?.executive_summary ?
      report.executive_summary.split('.').slice(0, 2).join('.') + '...'
    : 'Audit completed. Review the full report for comprehensive findings.'

  const score = audit.overall_score ?? 0

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-off">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted" />
              <a
                href={audit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-sm text-muted hover:text-text"
              >
                {audit.url}
                <ExternalLink className="mb-0.5 ml-1 inline-block h-3 w-3" />
              </a>
            </div>
            <h1 className="font-heading text-3xl font-semibold text-text sm:text-4xl">
              Your Free UX Audit Preview
            </h1>
            <p className="mt-2 font-body text-sm text-muted">
              See how your website performs on user experience essentials.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          {/* Overall Score + Severity Breakdown */}
          <div className="mb-12 grid gap-8 lg:grid-cols-5">
            {/* Score Ring */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-center">
                <ScoreRing score={score} size={200} />
              </div>
              <p className="mt-4 text-center font-body text-xs text-muted">Overall UX Score</p>
            </div>

            {/* Severity Breakdown */}
            <div className="space-y-3 lg:col-span-3">
              <h3 className="font-heading text-sm font-semibold text-text">Issues Found</h3>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="font-body text-sm text-text">
                  <span className="font-semibold text-red-500">{severityCounts.CRITICAL}</span>
                  <span className="text-muted"> Critical</span>
                  <span className="mx-1 text-border">·</span>
                  <span className="font-semibold text-orange-500">{severityCounts.HIGH}</span>
                  <span className="text-muted"> High</span>
                  <span className="mx-1 text-border">·</span>
                  <span className="font-semibold text-yellow-500">{severityCounts.MEDIUM}</span>
                  <span className="text-muted"> Medium</span>
                  <span className="mx-1 text-border">·</span>
                  <span className="font-semibold text-blue-500">{severityCounts.LOW}</span>
                  <span className="text-muted"> Low</span>
                </p>
              </div>
              <p className="font-body text-xs text-muted">
                Total of {findings.length} finding{findings.length !== 1 ? 's' : ''} across your site
              </p>
            </div>
          </div>

          {/* Pillar Scores */}
          <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pillarConfig.map(({ key, label, icon: Icon }) => {
              const scoreKey = key as keyof Report
              const pillarScore = report?.[scoreKey] ?? 0

              return (
                <div
                  key={key}
                  className="rounded-lg border border-border bg-card p-6 transition-all hover:border-text/20"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-text opacity-60" />
                    <p className="font-body text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
                  </div>
                  <p className="font-heading text-3xl font-semibold text-text">{Math.round(Number(pillarScore))}</p>
                </div>
              )
            })}
          </div>

          {/* Executive Summary */}
          <div className="mb-12 rounded-lg border border-border bg-card p-6 sm:p-8">
            <h3 className="font-heading text-lg font-semibold text-text">Executive Summary</h3>
            <p className="mt-3 font-body text-sm leading-relaxed text-text">{executiveSummary}</p>
          </div>

          {/* Paywall CTA Card */}
          <div className="mb-12 rounded-xl border border-border/50 bg-gradient-to-br from-text/5 to-text/2 p-8 sm:p-12">
            <div className="mx-auto max-w-xl text-center">
              <div className="mb-4 inline-flex items-center justify-center rounded-full bg-brand/10 p-3">
                <Sparkles className="h-6 w-6 text-brand" />
              </div>
              <h2 className="font-heading text-2xl font-semibold text-text sm:text-3xl">
                Unlock Your Full Audit
              </h2>
              <p className="mt-3 font-body text-sm text-muted">
                Get the complete audit with all findings, recommendations, and downloadable reports.
              </p>

              <div className="mt-6 space-y-3">
                <Link
                  href={`/register?redirect=/dashboard/audits/${auditId}&claim=${auditId}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-body text-sm font-semibold bg-brand text-surface dark:text-[#111111] transition-all hover:shadow-lg active:scale-95"
                >
                  Unlock Full Audit — $99
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/login?redirect=/dashboard/audits/${auditId}&claim=${auditId}`}
                  className="block rounded-lg border border-border px-6 py-3 font-body text-sm font-semibold text-text transition-all hover:bg-card active:scale-95"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </div>
          </div>

          {/* Blurred Findings Section */}
          <div className="relative mb-12">
            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-off via-transparent to-transparent" />

            {/* Blurred content */}
            <div className="select-none" style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}>
              <h3 className="font-heading text-lg font-semibold text-text">Detailed Findings</h3>

              <div className="mt-6 space-y-4">
                {findings.slice(0, 4).map((finding) => {
                  const severityConfig = {
                    CRITICAL: { color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertTriangle },
                    HIGH: { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: AlertTriangle },
                    MEDIUM: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', icon: AlertTriangle },
                    LOW: { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: AlertTriangle },
                  }

                  const config = severityConfig[finding.severity] || severityConfig.LOW
                  const SeverityIcon = config.icon

                  return (
                    <div key={finding.id} className={`rounded-lg border border-border ${config.bg} p-4`}>
                      <div className="flex items-start gap-3">
                        <SeverityIcon className={`mt-1 h-4 w-4 flex-shrink-0 ${config.color}`} />
                        <div className="flex-1">
                          <h4 className="font-body font-medium text-text">{finding.title}</h4>
                          <p className="mt-1 font-body text-xs text-muted opacity-50">{finding.description}</p>
                          <p className="mt-2 font-body text-xs text-muted opacity-40">
                            Recommendation: {finding.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Lock overlay */}
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="rounded-lg bg-card/80 px-6 py-4 text-center backdrop-blur-md">
                <Lock className="mx-auto mb-2 h-6 w-6 text-muted" />
                <p className="font-body text-sm font-medium text-text">Findings locked</p>
                <p className="font-body text-xs text-muted">Unlock to see detailed recommendations</p>
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="rounded-lg border border-border bg-card p-8 text-center sm:p-12">
            <h3 className="font-heading text-xl font-semibold text-text sm:text-2xl">
              Ready to fix these issues?
            </h3>
            <p className="mt-2 font-body text-sm text-muted">
              Get actionable recommendations and priority rankings for every finding.
            </p>
            <Link
              href={`/register?redirect=/dashboard/audits/${auditId}&claim=${auditId}`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-body text-sm font-semibold bg-brand text-surface dark:text-[#111111] transition-all hover:shadow-lg active:scale-95"
            >
              Get Full Audit
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
