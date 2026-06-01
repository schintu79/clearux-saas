'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  Scale,
  Heart,
  Accessibility,
  Brain,
  Eye,
  Target,
  Map,
  Type,
  MousePointerClick,
  Shield,
  Smartphone,
  Gauge,
  Search,
  ChevronDown,
  User,
  ExternalLink,
  FileSearch,
  LinkIcon,
  Share2,
  Keyboard,
  FileText,
  Code2,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import ScoreRing from '@/components/ui/ScoreRing'
import type { AuditFinding, Report } from '@/types/database'

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString))
}

function scoreColor(s: number) {
  if (s >= 70) return '[color:var(--ok)]'
  if (s >= 40) return 'text-amber-600 dark:text-amber-400'
  return '[color:var(--severe)]'
}

function scoreBgClass(s: number) {
  if (s >= 70) return '[background:var(--ok)]'
  if (s >= 40) return 'bg-amber-500'
  return '[background:var(--severe)]'
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent'
  if (s >= 75) return 'Good'
  if (s >= 60) return 'Decent'
  if (s >= 40) return 'Needs work'
  return 'Poor'
}

/* ── Pillar config ─────────────────────────────────────────── */

const CATEGORY_ICONS: React.ElementType[] = [
  Eye, Target, Map, Type,
  MousePointerClick, Shield, AlertTriangle, Heart,
  Accessibility, Brain, Sparkles, Smartphone,
  Gauge, Search, Zap, Globe,
  FileSearch, LinkIcon, Share2, Scale,
  Eye, Keyboard, FileText, Code2,
  Eye, MessageSquare, Target, CheckCircle2,
]

const PILLAR_STYLE = [
  { name: 'Foundation', color: '#6366F1', gradient: 'from-[#6366F1] to-[#5A4D80]', bg: 'bg-[#6366F1]/10', text: 'text-[#6366F1]', Icon: Scale, range: [0, 4] as [number, number] },
  { name: 'Human Experience', color: '#EC4899', gradient: 'from-pink-500 to-pink-600', bg: 'bg-pink-500/10', text: 'text-pink-500', Icon: Heart, range: [4, 8] as [number, number] },
  { name: 'Inclusive Design', color: '#F59E0B', gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-500/10', text: 'text-amber-500', Icon: Accessibility, range: [8, 12] as [number, number] },
  { name: 'Future Readiness', color: 'var(--ok)', gradient: 'from-emerald-500 to-emerald-700', bg: 'bg-emerald-500/10', text: '[color:var(--ok)]', Icon: Brain, range: [12, 16] as [number, number] },
  { name: 'SEO Structure & Rules', color: '#10B981', gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10', text: 'text-emerald-500', Icon: FileSearch, range: [16, 20] as [number, number] },
  { name: 'Accessibility Readiness', color: '#14B8A6', gradient: 'from-teal-500 to-teal-600', bg: 'bg-teal-500/10', text: 'text-teal-500', Icon: ShieldCheck, range: [20, 24] as [number, number] },
  { name: 'Design Consistency', color: '#06B6D4', gradient: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-500/10', text: 'text-cyan-500', Icon: Eye, range: [24, 28] as [number, number] },
]

const SEVERITY_CONFIG = {
  critical: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Critical' },
  high: { dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', label: 'High' },
  medium: { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-500', label: 'Medium' },
  low: { dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400', label: 'Low' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pending payment', color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  payment_received: { label: 'Payment received', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  crawling: { label: 'Crawling', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  analysing: { label: 'Analysing', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  generating_report: { label: 'Generating report', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/10 [color:var(--ok)]' },
  failed: { label: 'Failed', color: 'bg-red-500/10 [color:var(--severe)]' },
}

/* ── Main page ─────────────────────────────────────────────── */

export default function AdminAuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audit, setAudit] = useState<any>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [findings, setFindings] = useState<AuditFinding[]>([])
  const [userProfile, setUserProfile] = useState<any>(null)
  const [expandedPillar, setExpandedPillar] = useState<number | null>(null)
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/audits/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then(d => {
        setAudit(d.audit)
        setReport(d.report)
        setFindings(d.findings || [])
        setUserProfile(d.userProfile)
      })
      .catch(() => setError('Failed to load audit'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div className="space-y-4">
        <Link href="/admin/audits" className="inline-flex items-center gap-2 text-sm text-[var(--m-muted)] hover:text-[var(--ink)] transition-colors">
          <ArrowLeft size={16} /> Back to audits
        </Link>
        <div className="text-center py-16">
          <AlertTriangle size={32} className="text-[var(--m-muted)] mx-auto mb-3" />
          <p className="text-[var(--m-muted)]">{error || 'Audit not found'}</p>
        </div>
      </div>
    )
  }

  const overall = report?.overall_score ?? 0
  const rawJson = report?.raw_json as any
  const categoryScores: Array<{ name: string; score: number; summary: string }> = rawJson?.categoryScores || []
  const topRecs: string[] = rawJson?.topRecommendations || (rawJson?.keyRecommendation ? [rawJson.keyRecommendation] : [])
  const selectedPillars: number[] | null = rawJson?.selectedPillars ?? audit?.selected_pillars ?? null
  const isPartialAudit = Array.isArray(selectedPillars) && selectedPillars.length < 4

  let domain = audit.product_url
  try { domain = new URL(audit.product_url).hostname.replace(/^www\./, '') } catch {}

  const statusMeta = STATUS_LABELS[audit.status] || { label: audit.status, color: 'bg-surface-alt text-[var(--m-muted)]' }

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  }

  // Build pillar data
  const pillarData = PILLAR_STYLE.map((style, i) => {
    const cats = categoryScores.slice(style.range[0], style.range[1]).filter(c => c.score >= 0)
    const avg = cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0
    const pillarFindings = findings.filter(f => {
      const catIdx = categoryScores.findIndex(c => {
        const words = c.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
        const text = `${f.title} ${f.description}`.toLowerCase()
        return words.some(w => text.includes(w))
      })
      return catIdx >= style.range[0] && catIdx < style.range[1]
    })
    const isAudited = !isPartialAudit || (selectedPillars?.includes(i) ?? true)
    return { ...style, avg, cats, pillarFindings, isAudited }
  })

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link href="/admin/audits" className="inline-flex items-center gap-2 text-sm text-[var(--m-muted)] hover:text-[var(--ink)] transition-colors">
        <ArrowLeft size={16} /> Back to audits
      </Link>

      {/* ── Header card ─────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--rule)]/30 dark:border-white/[0.06] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="h-1.5 bg-[var(--signal)]" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Score ring */}
            {audit.status === 'completed' && report && (
              <div className="flex-shrink-0">
                <ScoreRing score={overall} size={90} strokeWidth={5} />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-sans font-medium text-xl text-[var(--ink)] truncate">{domain}</h1>
                <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusMeta.color}`}>
                  {statusMeta.label}
                </span>
              </div>

              <p className="text-sm text-[var(--m-muted)] truncate mb-3">{audit.product_url}</p>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--m-muted)]">
                <span className="flex items-center gap-1.5">
                  <Clock size={12} />
                  {formatDate(audit.created_at)}
                </span>
                {audit.completed_at && (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 size={12} />
                    Completed {formatDate(audit.completed_at)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Globe size={12} />
                  {audit.pages_crawled || 0} pages
                </span>
                {audit.plan && (
                  <span className="capitalize">{audit.plan} plan</span>
                )}
                {isPartialAudit && (
                  <span className="text-[11px] bg-[var(--paper-2)] dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
                    {selectedPillars!.length} of {PILLAR_STYLE.length} modules
                  </span>
                )}
              </div>

              {/* User info */}
              {userProfile && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--paper-2)]/50 dark:bg-white/[0.03]">
                  <User size={14} className="text-[var(--m-muted)] flex-shrink-0" />
                  <span className="text-xs text-[var(--ink)] font-medium">{userProfile.full_name || userProfile.email}</span>
                  {userProfile.full_name && userProfile.email && (
                    <span className="text-xs text-[var(--m-muted)]">({userProfile.email})</span>
                  )}
                  {userProfile.plan && (
                    <span className="ml-auto text-[10px] font-medium uppercase text-[var(--m-muted)] bg-[var(--paper-2)] dark:bg-white/[0.06] px-2 py-0.5 rounded-full">{userProfile.plan}</span>
                  )}
                </div>
              )}
            </div>

            {/* Score + severity summary */}
            {audit.status === 'completed' && report && (
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className={`text-4xl font-medium font-sans ${scoreColor(overall)}`}>{overall}</p>
                <p className="text-xs text-[var(--m-muted)]">{scoreLabel(overall)}</p>
                <p className="text-xs text-[var(--m-muted)] mt-1">{report.total_issues} issues</p>
              </div>
            )}
          </div>

          {/* Severity pills */}
          {audit.status === 'completed' && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-[var(--rule)]/15 dark:border-white/[0.04]">
              {severityCounts.critical > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{severityCounts.critical} critical
                </span>
              )}
              {severityCounts.high > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{severityCounts.high} high
                </span>
              )}
              {severityCounts.medium > 0 && (
                <span className="text-[11px] text-[var(--m-muted)] bg-[var(--paper-2)] dark:bg-white/[0.06] px-2 py-0.5 rounded-full">{severityCounts.medium} medium</span>
              )}
              {severityCounts.low > 0 && (
                <span className="text-[11px] text-[var(--m-muted)] bg-[var(--paper-2)] dark:bg-white/[0.06] px-2 py-0.5 rounded-full">{severityCounts.low} low</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* If not completed, show status message */}
      {audit.status !== 'completed' && (
        <div className="text-center py-12 bg-[var(--card)] rounded-xl border border-[var(--rule)]/30 dark:border-white/[0.06]">
          {audit.status === 'failed' ? (
            <>
              <AlertTriangle size={32} className="[color:var(--severe)] mx-auto mb-3" />
              <p className="text-[var(--ink)] font-medium">This audit failed</p>
              {audit.error_message && <p className="text-sm text-[var(--m-muted)] mt-2">{audit.error_message}</p>}
            </>
          ) : (
            <>
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[var(--ink)] font-medium">Audit in progress</p>
              <p className="text-sm text-[var(--m-muted)] mt-1">Status: {statusMeta.label}</p>
            </>
          )}
        </div>
      )}

      {/* ── Report content ─────────────────────────────────── */}
      {audit.status === 'completed' && report && (
        <>
          {/* Executive Summary */}
          {report.executive_summary && (
            <div className="rounded-xl border border-[var(--rule)]/30 dark:border-white/[0.06] bg-[var(--card)] p-5 sm:p-6">
              <h2 className="font-sans font-medium text-lg text-[var(--ink)] mb-3">Executive Summary</h2>
              <div className="text-[var(--m-muted)] text-sm leading-relaxed whitespace-pre-line">
                {report.executive_summary}
              </div>
            </div>
          )}

          {/* Top Recommendations */}
          {topRecs.length > 0 && (
            <div className="p-5 rounded-xl border border-brand/20 dark:border-brand/10" style={{ background: 'var(--gradient-brand-subtle)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--signal)]">
                  <Zap size={14} className="text-white" />
                </div>
                <p className="text-sm font-medium text-[var(--ink)]">Top Priority Recommendations</p>
              </div>
              <div className="space-y-4">
                {topRecs.slice(0, 3).map((rec, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium text-surface mt-0.5 bg-[var(--signal)]">
                      {i + 1}
                    </span>
                    <p className="text-sm text-[var(--ink)] leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pillar Cards ──────────────────────────────── */}
          <div className="space-y-4">
            {pillarData.map((pillar, i) => {
              const PillarIcon = pillar.Icon
              const isExpanded = expandedPillar === i
              return (
                <div
                  key={i}
                  className={`rounded-xl border border-[var(--rule)]/30 dark:border-white/[0.06] bg-[var(--card)] overflow-hidden ${
                    !pillar.isAudited ? 'opacity-40' : ''
                  }`}
                >
                  {/* Pillar header */}
                  <button
                    onClick={() => setExpandedPillar(isExpanded ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-[var(--paper-2)]/30 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center`}>
                        <PillarIcon size={18} className="text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-[var(--ink)]">{pillar.name}</p>
                        <p className="text-xs text-[var(--m-muted)]">
                          {pillar.isAudited
                            ? `${pillar.cats.length} categories`
                            : 'Not audited'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`text-2xl font-medium font-sans ${pillar.isAudited ? scoreColor(pillar.avg) : 'text-[var(--m-muted)]'}`}>
                          {pillar.isAudited ? pillar.avg : '--'}
                        </p>
                        {pillar.isAudited && <p className="text-[10px] text-[var(--m-muted)]">{scoreLabel(pillar.avg)}</p>}
                      </div>
                      <ChevronDown size={16} className={`text-[var(--m-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded: category scores */}
                  {isExpanded && pillar.isAudited && (
                    <div className="px-5 pb-4 space-y-3 border-t border-[var(--rule)]/15 dark:border-white/[0.04] pt-4">
                      {pillar.cats.map((cat, j) => (
                        <div key={j}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-[var(--ink)] truncate flex-1">{cat.name}</span>
                            <span className={`text-sm font-medium flex-shrink-0 ${scoreColor(cat.score)}`}>{cat.score}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-border/15 dark:bg-white/[0.06] overflow-hidden mb-1">
                            <div className={`h-full rounded-full ${scoreBgClass(cat.score)}`} style={{ width: `${cat.score}%` }} />
                          </div>
                          {cat.summary && (
                            <p className="text-xs text-[var(--m-muted)] leading-relaxed">{cat.summary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Findings List ─────────────────────────────── */}
          {findings.length > 0 && (
            <div className="rounded-xl border border-[var(--rule)]/30 dark:border-white/[0.06] bg-[var(--card)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--rule)]/15 dark:border-white/[0.04]">
                <h2 className="font-sans font-medium text-lg text-[var(--ink)]">All Findings ({findings.length})</h2>
              </div>
              <div className="divide-y divide-border/10 dark:divide-white/[0.03]">
                {findings.map(f => {
                  const sev = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.medium
                  const isOpen = expandedFinding === f.id
                  return (
                    <div key={f.id}>
                      <button
                        onClick={() => setExpandedFinding(isOpen ? null : f.id)}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[var(--paper-2)]/30 dark:hover:bg-white/[0.02] transition-colors text-left"
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
                        <span className="text-sm text-[var(--ink)] flex-1 truncate">{f.title}</span>
                        <span className={`text-[10px] font-medium uppercase flex-shrink-0 ${sev.text}`}>{sev.label}</span>
                        {f.dismissed && (
                          <span className="text-[10px] text-[var(--m-muted)] bg-[var(--paper-2)] dark:bg-white/[0.06] px-1.5 py-0.5 rounded">Dismissed</span>
                        )}
                        {f.status && f.status !== 'open' && (
                          <span className="text-[10px] text-[var(--m-muted)] bg-[var(--paper-2)] dark:bg-white/[0.06] px-1.5 py-0.5 rounded capitalize">{f.status.replace(/_/g, ' ')}</span>
                        )}
                        {f.verification_status && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            f.verification_status === 'likely_fixed' ? 'bg-emerald-500/10 [color:var(--ok)]'
                            : f.verification_status === 'poorly_fixed' ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-red-500/10 text-red-500'
                          }`}>
                            {f.verification_status.replace(/_/g, ' ')}
                          </span>
                        )}
                        <ChevronDown size={14} className={`text-[var(--m-muted)] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 space-y-3">
                          <p className="text-sm text-[var(--m-muted)] leading-relaxed">{f.description}</p>
                          {f.evidence && (
                            <div className="p-3 rounded-lg bg-[var(--paper-2)]/50 dark:bg-white/[0.03]">
                              <p className="text-[10px] font-medium text-[var(--m-muted)] uppercase mb-1">Evidence</p>
                              <p className="text-xs text-[var(--ink)] leading-relaxed">{f.evidence}</p>
                            </div>
                          )}
                          {f.recommendation && (
                            <div className="p-3 rounded-lg bg-[var(--signal)]/5 dark:bg-[var(--signal)]/[0.04]">
                              <p className="text-[10px] font-medium text-[var(--signal)] uppercase mb-1">Recommendation</p>
                              <p className="text-xs text-[var(--ink)] leading-relaxed">{f.recommendation}</p>
                            </div>
                          )}
                          {f.page_url && (
                            <p className="text-xs text-[var(--m-muted)]">
                              Page: <a href={f.page_url} target="_blank" rel="noopener noreferrer" className="text-[var(--signal)] hover:underline">{f.page_url}</a>
                            </p>
                          )}
                          {f.estimated_impact && (
                            <p className="text-xs text-[var(--m-muted)]">Impact: {f.estimated_impact}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Raw JSON (debug) ─────────────────────────────── */}
      {rawJson && (
        <details className="rounded-xl border border-[var(--rule)]/30 dark:border-white/[0.06] bg-[var(--card)] overflow-hidden">
          <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-[var(--m-muted)] hover:text-[var(--ink)] transition-colors">
            Raw report JSON
          </summary>
          <pre className="px-5 pb-4 text-xs text-[var(--m-muted)] overflow-auto max-h-96">
            {JSON.stringify(rawJson, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
