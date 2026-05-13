'use client';

import React, { Suspense, useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Zap,
  Trash2,
  Globe,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSearch,
  Search,
  Loader2,
  Eye,
  Target,
  Map,
  MousePointerClick,
  Smartphone,
  Shield,
  Type,
  Gauge,
  Brain,
  ExternalLink,
  Heart,
  Users,
  ChevronDown,
  TrendingUp,
  Scale,
  Lightbulb,
  Accessibility,
  Share2,
  LinkIcon,
  RefreshCw,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  MoreVertical,
  X,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ScoreRing from '@/components/ui/ScoreRing';
import type {
  AuditWithReport,
  AuditFinding,
  FindingSeverity,
  Report,
} from '@/types/database';
import { getUILabels, getReportLabels, getCategoryNames, getPillarNames, getScoreLabel, getSeverityLabel, getLocale, type UILabels } from '@/lib/languages';
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints';
import BrandAuditDetail from '@/components/dashboard/BrandAuditDetail';
import clsx from 'clsx';
import { matchFindingToCategory } from '@/lib/audit-engine/pipeline/category-keywords';

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function formatUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/* ── Module configuration ─────────────────────────────────── */
// Must match the 24 categories in analyzer.ts exactly (4 per module, 6 modules)

/* Category icons in index order (must match the 24 categories in analyzer.ts) */
const CATEGORY_ICONS: React.ElementType[] = [
  Eye, Target, Map, Type,                          // Foundation (0-3)
  MousePointerClick, Shield, AlertTriangle, Heart,  // Human Experience (4-7)
  Accessibility, Brain, Sparkles, Smartphone,       // Inclusive Design (8-11)
  Gauge, Search, Zap, Globe,                        // Future Readiness (12-15)
  FileSearch, LinkIcon, Share2, Scale,              // SEO Structure & Rules (16-19)
  Eye, MessageSquare, Target, CheckCircle2,         // Brand Consistency (20-23)
];

/* Module tint colors for hero card dots and pillar sections */
const MODULE_TINTS = [
  { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.04)', border: 'rgba(59, 130, 246, 0.12)' },  // Foundation — blue
  { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.04)', border: 'rgba(236, 72, 153, 0.12)' },  // Human Experience — pink
  { dot: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.04)', border: 'rgba(139, 92, 246, 0.12)' },  // Inclusive Design — violet
  { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.04)', border: 'rgba(245, 158, 11, 0.12)' },  // Future Readiness — amber
  { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.04)', border: 'rgba(16, 185, 129, 0.12)' },  // SEO — emerald
  { dot: '#06B6D4', bg: 'rgba(6, 182, 212, 0.04)', border: 'rgba(6, 182, 212, 0.12)' },    // Brand — cyan
];

/* Pillar visual config — v2 token-based, uniform across all modules */
const PILLAR_STYLE = [
  { range: [0, 4] as [number, number] },
  { range: [4, 8] as [number, number] },
  { range: [8, 12] as [number, number] },
  { range: [12, 16] as [number, number] },
  { range: [16, 20] as [number, number] },
  { range: [20, 24] as [number, number] },
];

/** Build full PILLAR_CONFIG with translated names */
function buildPillarConfig(lang: string) {
  const pillarNames = getPillarNames(lang);
  const categoryNames = getCategoryNames(lang);
  return PILLAR_STYLE.map((style, i) => ({
    ...style,
    name: pillarNames[i],
    categories: categoryNames.slice(style.range[0], style.range[1]).map((name, j) => ({
      name,
      Icon: CATEGORY_ICONS[style.range[0] + j],
    })),
  }));
}

function getCategoryIcon(name: string, index?: number): React.ElementType {
  if (index !== undefined && index >= 0 && index < CATEGORY_ICONS.length) {
    return CATEGORY_ICONS[index];
  }
  return Sparkles;
}

function getPillarForCategory(index: number, pillarConfig: ReturnType<typeof buildPillarConfig>) {
  for (const pillar of pillarConfig) {
    if (index >= pillar.range[0] && index < pillar.range[1]) return pillar;
  }
  return pillarConfig[0];
}

function buildSeverityConfig(L: UILabels) {
  return {
    critical: {
      badge: 'danger' as const,
      label: L.severityCritical,
      bg: 'bg-paper',
      border: 'border-rule',
      dot: 'bg-severe',
      text: 'text-severe',
      impactBg: 'bg-severe/5',
    },
    high: {
      badge: 'failed' as const,
      label: L.severityHigh,
      bg: 'bg-paper',
      border: 'border-rule',
      dot: 'bg-warn',
      text: 'text-warn',
      impactBg: 'bg-warn/5',
    },
    medium: {
      badge: 'pending' as const,
      label: L.severityMedium,
      bg: 'bg-paper',
      border: 'border-rule',
      dot: 'bg-signal',
      text: 'text-signal',
      impactBg: 'bg-signal/5',
    },
    low: {
      badge: 'active' as const,
      label: L.severityLow,
      bg: 'bg-paper',
      border: 'border-rule',
      dot: 'bg-ok',
      text: 'text-ok',
      impactBg: 'bg-ok/5',
    },
  };
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-ok';
  if (s >= 40) return 'text-warn';
  return 'text-severe';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-ok';
  if (s >= 40) return 'bg-warn';
  return 'bg-severe';
}

function buildStatusMeta(L: UILabels): Record<
  string,
  { label: string; color: string; icon: React.ElementType; description: string }
> {
  return {
    pending_payment: { label: L.statusAwaitingPayment, color: 'pending', icon: Clock, description: L.descAwaitingPayment },
    payment_received: { label: L.statusPaymentConfirmed, color: 'active', icon: CheckCircle2, description: L.descPaymentConfirmed },
    crawling: { label: L.statusCrawling, color: 'active', icon: Globe, description: L.descCrawling },
    analysing: { label: L.statusAnalysing, color: 'active', icon: Sparkles, description: L.descAnalysing },
    generating_report: { label: L.statusGeneratingReport, color: 'active', icon: FileSearch, description: L.descGeneratingReport },
    completed: { label: L.statusCompleted, color: 'completed', icon: CheckCircle2, description: L.descCompleted },
    failed: { label: L.statusFailed, color: 'failed', icon: AlertTriangle, description: L.descFailed },
  };
}

function buildProgressSteps(L: UILabels) {
  return [
    { key: 'payment_received', label: L.stepPayment },
    { key: 'crawling', label: L.stepCrawling },
    { key: 'analysing', label: L.stepAnalysing },
    { key: 'generating_report', label: L.stepReport },
    { key: 'completed', label: L.stepDone },
  ];
}

/* ── Rotating checkpoint labels ─────────────────────────── */
const auditCheckpoints = [
  'Checking navigation clarity & structure',
  'Evaluating page load performance',
  'Analysing mobile responsiveness',
  'Reviewing call-to-action effectiveness',
  'Assessing visual hierarchy',
  'Testing colour contrast & accessibility',
  'Checking form usability & validation',
  'Evaluating content readability',
  'Analysing search functionality',
  'Reviewing error handling & messaging',
  'Checking image optimisation',
  'Evaluating link consistency',
  'Analysing typography & spacing',
  'Reviewing onboarding experience',
  'Checking cart & checkout flow',
  'Evaluating trust signals & social proof',
  'Analysing breadcrumb navigation',
  'Reviewing footer content & links',
  'Checking ARIA labels & screen readers',
  'Evaluating keyboard navigation',
  'Analysing page title & meta structure',
  'Reviewing heading hierarchy (H1–H6)',
  'Checking button sizing & tap targets',
  'Evaluating scroll behaviour & anchors',
  'Analysing 404 & empty state handling',
  'Reviewing input field labelling',
  'Checking consistent branding',
  'Evaluating testimonial & review quality',
  'Analysing pricing page clarity',
  'Reviewing signup & login friction',
  'Checking cookie consent patterns',
  'Scanning for confirmshaming & dark patterns',
  'Evaluating urgency & scarcity patterns',
  'Reviewing cancellation flow transparency',
  'Checking hidden fee disclosure',
  'Analysing emotional tone of error messages',
  'Evaluating psychological safety of checkout',
  'Reviewing cognitive load & clutter',
  'Checking neurodiversity-friendly fonts & spacing',
  'Analysing digital wellbeing patterns',
  'Reviewing age-inclusive design elements',
  'Evaluating touch target sizes (44px+)',
  'Analysing colour contrast ratios (WCAG AA)',
  'Reviewing structured data & schema markup',
  'Checking LLM discoverability (AI readiness)',
  'Evaluating AI agent navigation capability',
  'Analysing cultural sensitivity of design',
  'Reviewing RTL & internationalisation readiness',
  'Checking date & currency localisation',
  'Evaluating whitespace & layout balance',
  'Analysing cross-browser compatibility',
  'Reviewing cookie consent & privacy',
  'Checking AI discoverability (LLM readiness)',
  'Evaluating semantic HTML structure',
  'Analysing internal linking strategy',
  'Checking progressive disclosure patterns',
];

function getStepIndex(status: string, steps: ReturnType<typeof buildProgressSteps>) {
  return steps.findIndex((s) => s.key === status);
}

/* ── Rotating checkpoint text ─────────────────────────────── */
function RotatingCheckpoints() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % auditCheckpoints.length);
        setFade(true);
      }, 300);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-5 text-center">
      <p
        className={`text-sm font-medium text-ink transition-opacity duration-300 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {auditCheckpoints[idx]}...
      </p>
    </div>
  );
}

/* ── Collapsible Finding Card ─────────────────────────────── */
/* ── Checkpoint Health — pass/fail per category ─────────── */
function CheckpointHealth({ categoryScores, findings }: {
  categoryScores: Array<{ name: string; score: number; summary: string }>;
  findings: AuditFinding[];
}) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  if (categoryScores.length === 0) return null;

  // Map findings to categories by keyword matching
  const findingsByCategory: Record<string, AuditFinding[]> = {};
  for (const cat of categoryScores) findingsByCategory[cat.name] = [];
  for (const f of findings) {
    let matched = false;
    for (const cat of categoryScores) {
      const words = cat.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3);
      const text = `${f.title} ${f.description}`.toLowerCase();
      if (words.some(w => text.includes(w))) {
        findingsByCategory[cat.name].push(f);
        matched = true;
        break;
      }
    }
    if (!matched && categoryScores.length > 0) {
      // Distribute by sort order
      const catIdx = Math.min(Math.floor(f.sort_order / Math.max(1, findings.length / categoryScores.length)), categoryScores.length - 1);
      findingsByCategory[categoryScores[catIdx].name]?.push(f);
    }
  }

  return (
    <div className="mb-6 border border-rule overflow-hidden bg-paper">
      <div className="px-5 py-3.5 border-b border-rule/60 bg-paper-2/40">
        <div className="flex items-center gap-2">
          <h3 className="font-mono text-[11px] tracking-[0.1em] uppercase text-m-muted">{categoryScores.length * 4}-Checkpoint health</h3>
          <span className="text-[11px] font-mono text-m-muted ml-auto tracking-[0.06em] uppercase">
            {findings.filter(f => !f.dismissed).length} issues · {categoryScores.length} categories
          </span>
        </div>
      </div>
      <div className="divide-y divide-rule/60">
        {categoryScores.map((cat, catIdx) => {
          const checkpoints = CHECKPOINT_LABELS[cat.name] || ['Check 1', 'Check 2', 'Check 3', 'Check 4'];
          const catFindings = findingsByCategory[cat.name] || [];
          const failCount = Math.min(catFindings.length, checkpoints.length);
          const passCount = checkpoints.length - failCount;
          const isExpanded = expandedCat === cat.name;

          return (
            <div key={catIdx}>
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat.name)}
                className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-paper-2 transition-colors text-left"
              >
                <span className={`text-[11px] font-mono font-medium w-6 text-right ${scoreColor(cat.score)}`}>{cat.score}</span>
                <span className="text-[11px] font-medium text-ink flex-1 truncate">{cat.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {passCount > 0 && <span className="text-[11px] font-mono font-medium text-ok">{passCount} pass</span>}
                  {failCount > 0 && <span className="text-[11px] font-mono font-medium text-severe">{failCount} fail</span>}
                </div>
                <ChevronDown size={12} className={`text-m-muted flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && (
                <div className="px-5 pb-3 space-y-1.5">
                  {checkpoints.map((checkpoint, i) => {
                    const hasFinding = i < failCount;
                    const finding = hasFinding ? catFindings[i] : null;
                    return (
                      <div key={i} className={`flex items-start gap-2.5 py-1.5 px-3 rounded-lg ${hasFinding ? 'bg-severe/5' : 'bg-ok/5'}`}>
                        {hasFinding ? (
                          <AlertTriangle size={11} className="text-severe flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 size={11} className="text-ok flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium ${hasFinding ? 'text-severe' : 'text-ok'}`}>
                            {checkpoint}
                          </p>
                          {finding && (
                            <p className="text-[11px] text-m-muted mt-0.5 line-clamp-1">{finding.title}</p>
                          )}
                        </div>
                        <span className={`text-[11px] font-mono font-medium flex-shrink-0 ${hasFinding ? 'text-severe' : 'text-ok'}`}>
                          {hasFinding ? 'Fail' : 'Pass'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Score Over Time — collapsible line chart, closed by default ── */
function ScoreOverTime({ productUrl, currentAuditId, currentScore }: { productUrl: string; currentAuditId: string; currentScore?: number }) {
  const router = useRouter();
  const [trend, setTrend] = useState<Array<{ auditId: string; date: string; overallScore: number }>>([]);
  const [improvement, setImprovement] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  let domain = '';
  try { domain = new URL(productUrl.startsWith('http') ? productUrl : `https://${productUrl}`).hostname.replace(/^www\./, ''); } catch {}

  useEffect(() => {
    fetch(`/api/audits/score-trend?url=${encodeURIComponent(productUrl)}`)
      .then(r => r.json())
      .then(d => {
        if (d.trend && d.trend.length > 1) {
          // Override current audit's score with the calculated score from category averages
          // to avoid discrepancy between hero card and trend chart
          const corrected = currentScore != null
            ? d.trend.map((t: any) => t.auditId === currentAuditId ? { ...t, overallScore: currentScore } : t)
            : d.trend;
          setTrend(corrected);
          // Recalculate improvement with corrected scores
          const imp = corrected.length >= 2
            ? corrected[corrected.length - 1].overallScore - corrected[corrected.length - 2].overallScore
            : 0;
          setImprovement(imp);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productUrl]);

  if (loading || trend.length < 2) return null;

  const W = 480, H = 140, PAD_L = 34, PAD_R = 16, PAD_T = 20, PAD_B = 26;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const minScore = Math.max(0, Math.min(...trend.map(t => t.overallScore)) - 10);
  const maxScore = Math.min(100, Math.max(...trend.map(t => t.overallScore)) + 10);
  const range = maxScore - minScore || 1;

  const points = trend.map((t, i) => ({
    x: PAD_L + (trend.length === 1 ? chartW / 2 : (i / (trend.length - 1)) * chartW),
    y: PAD_T + chartH - ((t.overallScore - minScore) / range) * chartH,
    score: t.overallScore,
    date: t.date,
    auditId: t.auditId,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${PAD_T + chartH} L ${points[0].x} ${PAD_T + chartH} Z`;

  const gridLines = 3;
  const gridScores = Array.from({ length: gridLines + 1 }, (_, i) => Math.round(minScore + (range * i) / gridLines));

  return (
    <div className="mb-6 border border-rule overflow-hidden bg-paper">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-paper-2 transition-colors"
      >
        <TrendingUp size={14} className="text-signal flex-shrink-0" />
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-ink">Score over time</span>
          <span className="text-[11px] font-mono text-m-muted ml-2 tracking-[0.06em] uppercase">{trend.length} audits · {domain}</span>
        </div>
        {improvement !== 0 && (
          <span className={`text-xs font-mono font-medium ${improvement > 0 ? 'text-ok' : 'text-severe'}`}>
            {improvement > 0 ? '+' : ''}{improvement} pts
          </span>
        )}
        <ChevronDown size={14} className={`text-m-muted flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded chart */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-rule">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {/* Grid */}
            {gridScores.map((s, i) => {
              const y = PAD_T + chartH - ((s - minScore) / range) * chartH;
              return (
                <g key={i}>
                  <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
                  <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="8" fill="var(--m-muted)" fontFamily="var(--font-inter)">{s}</text>
                </g>
              );
            })}

            {/* Area fill */}
            <defs>
              <linearGradient id="auditScoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaD} fill="url(#auditScoreAreaGrad)" />

            {/* Line */}
            <path d={pathD} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Hover hit areas + points */}
            {points.map((p, i) => {
              const isHovered = hoveredIdx === i;
              const isCurrent = trend[i].auditId === currentAuditId;
              const isLast = i === points.length - 1;
              const showLabel = isHovered || isLast;
              return (
                <g key={i}>
                  <circle
                    cx={p.x} cy={p.y} r="14" fill="transparent"
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    onClick={() => router.push(`/dashboard/audits/${p.auditId}`)}
                    style={{ cursor: 'pointer' }}
                  />
                  <circle
                    cx={p.x} cy={p.y}
                    r={isHovered ? 5 : isCurrent ? 4 : 3}
                    fill={isHovered ? '#6366F1' : isCurrent ? '#6366F1' : 'var(--paper)'}
                    stroke="#6366F1"
                    strokeWidth="2"
                    className="transition-all duration-150"
                    style={{ pointerEvents: 'none' }}
                  />
                  {showLabel && (
                    <g style={{ pointerEvents: 'none' }}>
                      <rect x={p.x - 13} y={p.y - 20} width="26" height="14" rx="4" fill="#6366F1" />
                      <text x={p.x} y={p.y - 10.5} textAnchor="middle" fontSize="8" fontWeight="500" fill="white" fontFamily="var(--font-inter)">{p.score}</text>
                    </g>
                  )}
                  {isCurrent && !isHovered && (
                    <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize="7" fontWeight="500" fill="#6366F1" fontFamily="var(--font-inter)">now</text>
                  )}
                </g>
              );
            })}

            {/* X-axis date labels */}
            {points.map((p, i) => {
              if (trend.length > 6 && i !== 0 && i !== trend.length - 1 && i !== Math.floor(trend.length / 2)) return null;
              const d = new Date(p.date);
              const label = `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
              return (
                <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="7.5" fill="var(--m-muted)" fontFamily="var(--font-inter)">{label}</text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

const FINDING_STATUSES = [
  { key: 'open', label: 'Open', color: 'text-m-muted', bg: 'bg-paper-2', dot: 'bg-m-muted' },
  { key: 'in_progress', label: 'In Progress', color: 'text-warn', bg: 'bg-warn/5', dot: 'bg-warn' },
  { key: 'fixed', label: 'Fixed', color: 'text-ok', bg: 'bg-ok/5', dot: 'bg-ok' },
  { key: 'backlog', label: 'Backlog', color: 'text-signal', bg: 'bg-signal/5', dot: 'bg-signal' },
] as const;

function FindingCard({ finding, pillarColor, categoryName, pillarName, sevConfig, onScoreUpdate }: { finding: AuditFinding; pillarColor: string; categoryName?: string; pillarName?: string; sevConfig: ReturnType<typeof buildSeverityConfig>; onScoreUpdate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(finding.status || 'open');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(finding.dismissed || false);
  const [showDismissForm, setShowDismissForm] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const sev = sevConfig[finding.severity] || sevConfig.medium;

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    const previousStatus = status;
    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus as any);
        // Always refresh data after status change — the server recalculates
        // scores when status changes to/from "fixed" and updates raw_json
        if (onScoreUpdate) {
          onScoreUpdate();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error('Status update failed:', err);
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
    setStatusUpdating(false);
  };

  const handleDismiss = async () => {
    if (!dismissReason.trim()) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true, dismissal_reason: dismissReason }),
      });
      if (res.ok) {
        setDismissed(true);
        setShowDismissForm(false);
        // Dismissal also recalculates score — refresh
        if (onScoreUpdate) onScoreUpdate();
      }
    } catch {}
    setStatusUpdating(false);
  };

  if (dismissed) {
    return (
      <div className="rounded-xl border border-rule/20 bg-paper p-3 opacity-60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rule flex-shrink-0" />
          <span className="text-xs text-m-muted line-through flex-1">{finding.title}</span>
          <span className="text-[11px] font-mono text-m-muted bg-paper-2 px-2 py-0.5 rounded-full tracking-[0.06em] uppercase">Dismissed</span>
        </div>
        {finding.dismissal_reason && (
          <p className="text-[11px] text-m-muted mt-1 ml-4">{finding.dismissal_reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${sev.border} bg-paper overflow-hidden transition-all shadow-sm`}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3.5 p-4 text-left hover:bg-black/[0.02] transition-colors"
        aria-expanded={open}
      >
        <span className="mt-1.5"><span className={`block w-2 h-2 rounded-full ${sev.dot}`} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[11px] font-mono font-medium uppercase tracking-[0.06em] ${sev.text}`}>
              {sev.label}
            </span>
            {(finding as any).verification_status === 'likely_fixed' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-ok bg-ok/10 px-2 py-0.5 tracking-[0.06em] uppercase">
                <Eye size={10} />
                Likely fixed
              </span>
            )}
            {(finding as any).verification_status === 'poorly_fixed' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-severe bg-severe/10 px-2 py-0.5 tracking-[0.06em] uppercase">
                <AlertTriangle size={10} />
                Poorly fixed
              </span>
            )}
            {finding.page_url && (
              <a
                href={finding.page_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-m-muted hover:text-signal transition-colors max-w-[260px] truncate"
                title={finding.page_url}
              >
                <ExternalLink size={10} className="flex-shrink-0" />
                {(() => {
                  try {
                    const u = new URL(finding.page_url);
                    const path = u.pathname + u.search;
                    return u.hostname + (path === '/' ? '' : path);
                  } catch { return finding.page_url; }
                })()}
              </a>
            )}
          </div>
          <h4 className="font-sans font-medium text-ink text-[14px] leading-[1.45]">{finding.title}</h4>
          {/* Metadata line — module · category · page */}
          <div className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase mt-1.5 flex items-center gap-0 flex-wrap">
            {pillarName && (
              <>
                <span>Module: {pillarName}</span>
                {categoryName && <span className="mx-1.5 opacity-40">·</span>}
              </>
            )}
            {categoryName && (
              <>
                <span>Category: {categoryName}</span>
                {finding.page_url && <span className="mx-1.5 opacity-40">·</span>}
              </>
            )}
            {finding.page_url && (
              <span>Page: {(() => {
                try {
                  const u = new URL(finding.page_url);
                  return u.pathname + (u.search || '');
                } catch { return finding.page_url; }
              })()}</span>
            )}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-m-muted flex-shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded detail — 3-panel layout: Issue / Fix / Impact */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-rule mx-4 space-y-3">

          {/* AI Verification Note — Likely Fixed */}
          {(finding as any).verification_status === 'likely_fixed' && (finding as any).verification_note && (
            <div className="flex items-start gap-2.5 p-3 bg-ok/5 border border-ok/15 mt-3">
              <Eye size={14} className="text-ok flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono font-medium text-ink mb-0.5 tracking-[0.06em] uppercase">AI verification</p>
                <p className="text-[13px] text-ok leading-[1.65]">
                  {(finding as any).verification_note}
                </p>
                <p className="text-[11px] text-m-muted mt-1">
                  Mark this finding as &quot;Fixed&quot; to confirm and update your score.
                </p>
              </div>
            </div>
          )}

          {/* AI Verification Note — Poorly Fixed */}
          {(finding as any).verification_status === 'poorly_fixed' && (finding as any).verification_note && (
            <div className="flex items-start gap-2.5 p-3 bg-severe/5 border border-severe/15 mt-3">
              <AlertTriangle size={14} className="text-severe flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-mono font-medium text-ink mb-0.5 tracking-[0.06em] uppercase">Regression detected</p>
                <p className="text-[13px] text-severe leading-[1.65]">
                  {(finding as any).verification_note}
                </p>
                <p className="text-[11px] text-m-muted mt-1">
                  The attempted fix introduced new issues. Review and address the regression to improve your score.
                </p>
              </div>
            </div>
          )}

          {/* AI vs Human Interpretation — Phase 2: AI X-Ray */}
          {(finding as any).ai_interpretation && (finding as any).human_interpretation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-rule overflow-hidden mt-3">
              {/* AI Interpretation */}
              <div className="p-4 border-b md:border-b-0 md:border-r border-rule bg-[var(--color-signal)]/[0.03]">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={13} className="text-signal" />
                  <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">How AI reads this</p>
                </div>
                <p className="text-ink-2 text-[13px] leading-[1.65]">
                  {(finding as any).ai_interpretation}
                </p>
              </div>
              {/* Human Interpretation */}
              <div className="p-4 bg-[var(--color-ok)]/[0.03]">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={13} className="text-ok" />
                  <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">How a human sees this</p>
                </div>
                <p className="text-ink-2 text-[13px] leading-[1.65]">
                  {(finding as any).human_interpretation}
                </p>
              </div>
            </div>
          )}

          {/* 3-Panel Grid: Issue / Fix / Impact */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-rule overflow-hidden mt-3">
            {/* Panel 1: Issue */}
            <div className="p-4 border-b md:border-b-0 md:border-r border-rule">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className={sev.text} />
                <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">Issue</p>
              </div>
              <p className="text-ink-2 text-[13px] leading-[1.65]">
                {finding.description}
              </p>
              {finding.target_element && (
                <div className="mt-2.5 px-2.5 py-1.5 bg-paper-2 border border-rule font-mono text-[11px] text-m-muted overflow-x-auto">
                  {finding.target_element}
                </div>
              )}
            </div>

            {/* Panel 2: Fix */}
            <div className="p-4 border-b md:border-b-0 md:border-r border-rule bg-signal/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={13} className="text-signal" />
                <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">How to fix</p>
              </div>
              <p className="text-ink-2 text-[13px] leading-[1.65]">
                {finding.recommendation || 'No specific recommendation provided.'}
              </p>
            </div>

            {/* Panel 3: Impact */}
            <div className="p-4 bg-ok/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={13} className="text-ok" />
                <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">Impact</p>
              </div>
              <p className="text-ink-2 text-[13px] leading-[1.65]">
                {finding.estimated_impact || 'Fixing this issue will improve overall UX quality and reduce user friction.'}
              </p>
            </div>
          </div>

          {/* Screenshot with highlighted element */}
          {finding.screenshot_url && (
            <div className="overflow-hidden border border-rule">
              <div className="px-3 py-2 bg-paper-2 border-b border-rule flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                <span className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">Visual evidence</span>
                {finding.page_url && (
                  <span className="text-[11px] text-m-muted ml-auto font-mono truncate max-w-[200px]">
                    {(() => { try { const u = new URL(finding.page_url); return u.pathname + u.search; } catch { return finding.page_url; } })()}
                  </span>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={finding.screenshot_url}
                alt={`Screenshot showing: ${finding.title}`}
                className="w-full max-h-80 object-contain bg-paper-2"
                loading="lazy"
              />
            </div>
          )}

          {/* Status toggle + Dismiss */}
          <div className="mt-1 p-3 bg-paper-2 border border-rule">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-medium text-ink uppercase tracking-[0.06em]">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {FINDING_STATUSES.map((s) => {
                  const active = status === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(s.key)}
                      disabled={statusUpdating}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-3 py-1.5 transition-all tracking-[0.04em] ${
                        active ? `${s.bg} ${s.color} border border-current/20` : 'text-m-muted hover:bg-paper-2'
                      } disabled:opacity-50`}
                    >
                      <span className={`w-2 h-2 rounded-full ${active ? s.dot : 'bg-border'}`} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setShowDismissForm(!showDismissForm)}
                  className="text-[11px] font-mono font-medium text-m-muted hover:text-severe px-2 py-1 hover:bg-severe/5 transition-colors tracking-[0.06em] uppercase"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>

          {/* Dismiss form */}
          {showDismissForm && (
            <div className="mt-2 p-3 bg-severe/5 border border-severe/15">
              <p className="text-[11px] font-medium text-ink mb-2">Why are you dismissing this? (The AI will skip it on re-audits)</p>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g. This is addressed on our About page, or: This is intentional for our target audience..."
                className="w-full px-3 py-2 text-xs border border-rule bg-paper text-ink placeholder:text-m-muted focus:outline-none focus:border-signal resize-none"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleDismiss}
                  disabled={statusUpdating || !dismissReason.trim()}
                  className="text-[11px] font-mono font-medium text-paper px-3 py-1.5 bg-severe hover:opacity-90 transition-colors disabled:opacity-50 tracking-[0.06em] uppercase"
                >
                  Dismiss and skip on re-audit
                </button>
                <button
                  onClick={() => setShowDismissForm(false)}
                  className="text-[11px] font-mono font-medium text-m-muted px-3 py-1.5 hover:bg-paper-2 transition-colors tracking-[0.06em] uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Expandable category summary ─────────────────────────── */
function ExpandableSummary({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <p
      onClick={() => setExpanded(!expanded)}
      className={`text-xs leading-relaxed cursor-pointer text-m-muted hover:text-ink transition-colors ${expanded ? '' : 'line-clamp-2'}`}
      title={expanded ? 'Click to collapse' : 'Click to read more'}
    >
      {text}
    </p>
  );
}

/* ── Pillar Section ───────────────────────────────────────── */
const PILLAR_ICONS: React.ElementType[] = [Scale, Heart, Accessibility, Brain, FileSearch, Eye];

function PillarSection({
  pillar,
  pillarIndex,
  categoryScores,
  findings,
  lang,
  onScoreUpdate,
}: {
  pillar: ReturnType<typeof buildPillarConfig>[number];
  pillarIndex: number;
  categoryScores: Array<{ name: string; score: number; summary: string }>;
  findings: AuditFinding[];
  lang: string;
  onScoreUpdate?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const L = getUILabels(lang);
  const pillarCats = categoryScores.filter((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
  const avgScore = pillarCats.length > 0
    ? Math.round(pillarCats.reduce((sum, c) => sum + c.score, 0) / pillarCats.length)
    : 0;
  const tint = MODULE_TINTS[pillarIndex] || MODULE_TINTS[0];

  // Group findings by category — use explicit category_index when available, fall back to keyword matching
  const findingsByCategory: Record<string, AuditFinding[]> = {};

  if (pillarCats.length > 0) {
    const allCatNames = categoryScores.map(c => c.name);
    for (const f of findings) {
      let bestCatIdx: number;
      if ((f as any).category_index != null) {
        // Explicit category — no guessing
        bestCatIdx = (f as any).category_index;
      } else {
        // Legacy fallback: keyword matching
        const text = `${f.title} ${f.description} ${f.recommendation || ''}`;
        bestCatIdx = matchFindingToCategory(text, allCatNames);
      }
      // Find which pillar category this maps to
      const matchedCat = pillarCats.find((_, relIdx) => {
        const absIdx = pillar.range[0] + relIdx;
        return absIdx === bestCatIdx;
      });
      const catName = matchedCat?.name || pillarCats[0].name;
      if (!findingsByCategory[catName]) findingsByCategory[catName] = [];
      findingsByCategory[catName].push(f);
    }
  } else {
    // No category scores for this pillar — group all under a generic key
    if (findings.length > 0) {
      findingsByCategory[pillar.name] = [...findings];
    }
  }

  const totalFindings = findings.length;

  return (
    <div className="mb-6 rounded-xl overflow-hidden" style={{ background: tint.bg, border: `1px solid ${tint.border}` }}>
      {/* Module header — clickable toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity"
      >
        {React.createElement(PILLAR_ICONS[pillarIndex] || Scale, { size: 18, className: 'flex-shrink-0', style: { color: tint.dot } })}
        <div className="flex-1 min-w-0">
          <h2 className="font-sans font-medium text-[15px] text-ink truncate">{pillar.name}</h2>
          <p className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">
            {pillarCats.length} categories{totalFindings > 0 ? ` · ${totalFindings} finding${totalFindings !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0 mr-2">
          <p className={`font-mono text-[22px] font-medium ${scoreColor(avgScore)}`}>{avgScore}</p>
          <p className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">/100</p>
        </div>
        <ChevronDown size={16} className={`text-m-muted flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${tint.border}` }}>
          {/* Category score bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {pillarCats.map((cat, relIdx) => (
              <div
                key={relIdx}
                className={`flex items-center gap-4 px-5 py-3.5 ${relIdx % 2 === 0 && pillarCats.length > 1 ? 'sm:border-r' : ''}`}
                style={{ borderBottom: `1px solid ${tint.border}`, borderRightColor: tint.border }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-sans font-medium text-ink mb-1">{cat.name}</p>
                  <div className="w-full h-[3px] rounded-full" style={{ background: `${tint.dot}15` }}>
                    <div className="h-full rounded-full" style={{ width: `${cat.score}%`, background: tint.dot, opacity: 0.6 }} />
                  </div>
                </div>
                <span className={`font-mono text-[15px] font-medium flex-shrink-0 ${scoreColor(cat.score)}`}>
                  {cat.score}
                </span>
              </div>
            ))}
          </div>

          {/* Findings grouped by category (names already shown in score bars above) */}
          {Object.entries(findingsByCategory).map(([catName, catFindings]) => {
            if (catFindings.length === 0) return null;
            const sorted = [...catFindings].sort((a, b) => {
              const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
              return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
            });

            return (
              <div key={catName} className="px-5 py-4" style={{ borderTop: `1px solid ${tint.border}` }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tint.dot }} />
                  <h3 className="font-sans font-medium text-[13px] text-ink">
                    {catName}
                  </h3>
                  <span className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">
                    {catFindings.length} finding{catFindings.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {sorted.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} pillarColor="text-signal" categoryName={catName} pillarName={pillar.name} sevConfig={buildSeverityConfig(getUILabels(lang))} onScoreUpdate={onScoreUpdate} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Component ───────────────────────────────────────────── */

const AuditDetailInner = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id: auditId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();

  const [audit, setAudit] = useState<AuditWithReport | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [auditPages, setAuditPages] = useState<Array<{ url: string; title: string | null; status_code: number | null; load_time_ms: number | null; screenshot_url: string | null; is_mobile_friendly: boolean | null }>>([]);
  const [siblingCount, setSiblingCount] = useState(0); // other audits for same domain
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'pages' | 'ai_xray'>('overview');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [verificationAlertDismissed, setVerificationAlertDismissed] = useState(false);
  const [aiCitations, setAiCitations] = useState<any[]>([]);
  const [fixPlaybooks, setFixPlaybooks] = useState<any[]>([]);
  const [llmProbeResults, setLlmProbeResults] = useState<any[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false); // Once true, never revert to in-progress UI
  const highestStatusRef = useRef(0); // Track forward-only status progression
  const scoreCardRef = useRef<HTMLDivElement>(null);
  const [showStickyScore, setShowStickyScore] = useState(false);

  const isPaymentReturn = searchParams.get('payment') === 'success';
  const claimAuditId = searchParams.get('claim');

  // ── Claim free preview audit if `claim` param is present ──
  useEffect(() => {
    if (!user || !claimAuditId) return;
    let cancelled = false;
    const claimAudit = async () => {
      try {
        const res = await fetch('/api/free-audit/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_id: claimAuditId }),
        });
        if (res.ok && !cancelled) {
          // Re-fetch to show the now-claimed audit
          fetchAuditDetail();
        }
      } catch (err) {
        console.error('[AuditDetail] Claim error:', err);
      }
    };
    claimAudit();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, claimAuditId]);

  // ── Fetch audit data ──────────────────────────────────
  const fetchAuditDetail = useCallback(
    async (silent = false) => {
      if (!user) return null;

      try {
        const supabase = createBrowserSupabase();

        const { data: auditData, error: auditError } = await supabase
          .from('audits')
          .select('*')
          .eq('id', auditId)
          .single();

        if (auditError) throw auditError;
        if (!auditData) throw new Error('Audit not found');

        // Check if this audit has siblings (other audits for the same domain)
        try {
          const domain = new URL(auditData.product_url).hostname.replace(/^www\./, '');
          const { count } = await supabase
            .from('audits')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .neq('id', auditId)
            .ilike('product_url', `%${domain}%`);
          setSiblingCount(count || 0);
        } catch { setSiblingCount(0); }

        let reportData = null;
        if (auditData.status === 'completed') {
          const { data: r } = await supabase
            .from('reports')
            .select('*')
            .eq('audit_id', auditId)
            .maybeSingle();
          reportData = r;
        }

        const combined = {
          ...auditData,
          report: reportData || null,
          payment: null,
        } as AuditWithReport;

        // Forward-only status guard — never let UI regress to an earlier stage
        // (e.g. Inngest step replays can briefly report stale statuses)
        const STATUS_ORDER: Record<string, number> = {
          pending_payment: 0,
          payment_received: 1,
          crawling: 2,
          analysing: 3,
          generating_report: 4,
          completed: 5,
          failed: 5,
        };
        const newLevel = STATUS_ORDER[auditData.status] ?? 0;
        if (newLevel < highestStatusRef.current) {
          // DB reported a stale/regressed status — ignore it
          return Object.entries(STATUS_ORDER).find(([, v]) => v === highestStatusRef.current)?.[0] || auditData.status;
        }
        highestStatusRef.current = newLevel;
        if (auditData.status === 'completed') {
          completedRef.current = true;
        }

        setAudit(combined);

        if (auditData.status === 'completed') {
          const [findingsRes, pagesRes] = await Promise.all([
            supabase
              .from('audit_findings')
              .select('*')
              .eq('audit_id', auditId)
              .order('severity', { ascending: true })
              .order('sort_order', { ascending: true }),
            supabase
              .from('audit_pages')
              .select('*')
              .eq('audit_id', auditId)
              .order('crawled_at', { ascending: true }),
          ]);
          // Enrich findings with verification data from report raw_json
          // (fallback for when DB columns don't exist yet)
          let enrichedFindings = findingsRes.data || [];
          const verResults = (reportData?.raw_json as any)?.verificationResults as Array<{ findingId: string; status: string; note: string }> | undefined;
          if (verResults && verResults.length > 0) {
            const verMap: Record<string, { findingId: string; status: string; note: string }> = {};
            for (const v of verResults) verMap[v.findingId] = v;
            enrichedFindings = enrichedFindings.map((f: any) => {
              const vr = verMap[f.id];
              if (vr && !f.verification_status) {
                return { ...f, verification_status: vr.status, verification_note: vr.note };
              }
              return f;
            });
          }
          setFindings(enrichedFindings);
          setAuditPages(pagesRes.data || []);

          // Fetch AI X-Ray data (citations, playbooks, LLM probes) — non-blocking
          Promise.all([
            supabase.from('ai_citations').select('*').eq('audit_id', auditId).order('created_at'),
            supabase.from('fix_playbooks').select('*').eq('audit_id', auditId).order('priority'),
            supabase.from('llm_probe_results').select('*').eq('audit_id', auditId).order('created_at'),
          ]).then(([citRes, pbRes, probeRes]) => {
            if (citRes.data) setAiCitations(citRes.data);
            if (pbRes.data) setFixPlaybooks(pbRes.data);
            if (probeRes.data) setLlmProbeResults(probeRes.data);
          }).catch(() => {});
        }

        if (!silent) setLoading(false);
        return auditData.status;
      } catch (err) {
        console.error('[AuditDetail] Error:', err);
        if (!silent) {
          setError('Failed to load audit details');
          setLoading(false);
        }
        return null;
      }
    },
    [user, auditId],
  );

  // ── Initial fetch
  useEffect(() => {
    if (userLoading) return;
    if (!user) { setLoading(false); return; }
    fetchAuditDetail();
  }, [user, userLoading, fetchAuditDetail]);

  // ── Payment verification + polling
  useEffect(() => {
    if (!user || !isPaymentReturn) return;
    let active = true;

    const verifyAndPoll = async () => {
      await new Promise((r) => setTimeout(r, 2000));
      if (!active || completedRef.current) return;
      const status = await fetchAuditDetail(true);

      if (status === 'pending_payment') {
        setVerifying(true);
        try {
          const res = await fetch('/api/stripe/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audit_id: auditId }),
          });
          const data = await res.json();
          console.log('[AuditDetail] Verify result:', data);
          if (active) await fetchAuditDetail();
        } catch (err) {
          console.error('[AuditDetail] Verify error:', err);
        } finally {
          if (active) setVerifying(false);
        }
      }

      if (active && !completedRef.current) {
        pollRef.current = setInterval(async () => {
          if (!active || completedRef.current) return;
          const s = await fetchAuditDetail(true);
          if (s === 'completed' || s === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }, 5000);
      }
    };

    verifyAndPoll();
    return () => { active = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, isPaymentReturn, fetchAuditDetail, auditId]);

  // ── Poll for in-progress audits
  // Use a ref to track whether we should poll, avoiding re-runs on status changes
  const shouldPollRef = useRef(false);
  useEffect(() => {
    if (!audit) return;
    const inProgress = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
    shouldPollRef.current = inProgress && !completedRef.current;
  }, [audit?.status]);

  useEffect(() => {
    if (isPaymentReturn) return;
    if (!audit) return;
    if (completedRef.current) return;
    const inProgress = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
    if (!inProgress) return;

    // Only start polling once, don't restart on status changes
    if (pollRef.current) return;

    pollRef.current = setInterval(async () => {
      if (completedRef.current || !shouldPollRef.current) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }
      const s = await fetchAuditDetail(true);
      if (s === 'completed' || s === 'failed') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    }, 4000);

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [audit?.id, isPaymentReturn, fetchAuditDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sticky score bar: show when hero score card scrolls out of view
  useEffect(() => {
    const el = scoreCardRef.current;
    if (!el) return;
    // The dashboard content scrolls inside <main id="main-content">, not the window
    const scrollRoot = document.getElementById('main-content') || null;
    if (!scrollRoot) return;
    // Use scroll event listener as a reliable fallback — IntersectionObserver
    // with a non-viewport root inside nested overflow containers can be unreliable
    const checkVisibility = () => {
      const rootRect = scrollRoot.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      // Show sticky when the score card's bottom is above the scroll container's top
      setShowStickyScore(elRect.bottom < rootRect.top + 10);
    };
    scrollRoot.addEventListener('scroll', checkVisibility, { passive: true });
    checkVisibility(); // Initial check
    return () => scrollRoot.removeEventListener('scroll', checkVisibility);
  }, [audit?.status]);

  // ── Handlers
  const isPaidAudit = audit?.status === 'failed' || audit?.status === 'completed' ||
    ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit?.status || '');

  const handleDelete = async () => {
    if (!audit || !auditId) return;
    const msg = isPaidAudit
      ? 'Delete this audit? Your payment will be kept as a credit for a future audit.'
      : 'Delete this audit? This cannot be undone.';
    if (!confirm(msg)) return;

    setDeleting(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.from('audits').delete().eq('id', auditId);
      if (error) throw error;
      router.push('/dashboard');
    } catch (err) {
      console.error('Error deleting audit:', err);
      alert('Failed to delete audit');
      setDeleting(false);
    }
  };

  const handleRetry = async () => {
    if (!audit || !auditId) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');
      await fetchAuditDetail();
      pollRef.current = setInterval(async () => {
        const s = await fetchAuditDetail(true);
        if (s === 'completed' || s === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    } catch (err) {
      console.error('Error retrying audit:', err);
      alert(err instanceof Error ? err.message : 'Failed to retry audit');
    } finally {
      setRetrying(false);
    }
  };

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleRevokeShare = async () => {
    if (!audit || !auditId) return;
    if (!confirm('Revoke the share link? Anyone with the link will no longer be able to view this audit.')) return;
    try {
      await fetch(`/api/audits/${auditId}/share`, { method: 'DELETE' });
      setShareUrl(null);
      setMenuOpen(false);
    } catch {}
  };

  const handleShare = async () => {
    if (!audit || !auditId) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/share`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.share_url) {
        setShareUrl(data.share_url);
        await navigator.clipboard.writeText(data.share_url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      }
    } catch {}
    setShareLoading(false);
  };

  const handleRestart = async () => {
    if (!audit || !auditId) return;
    if (!confirm('Restart this audit from scratch? This will re-crawl and re-analyse the website.')) return;
    setRestarting(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/restart`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restart failed');
      await fetchAuditDetail();
      pollRef.current = setInterval(async () => {
        const s = await fetchAuditDetail(true);
        if (s === 'completed' || s === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restart audit');
    } finally {
      setRestarting(false);
    }
  };

  const handlePayNow = async () => {
    if (!audit) return;
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: audit.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to create checkout session');
    } catch {
      alert('Failed to start checkout');
    }
  };

  /* ── Loading states ────────────────────────────────────── */
  if (userLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="h-5 w-20 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-paper-2 rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-paper-2 rounded animate-pulse mb-8" />
        <div className="h-48 bg-paper-2 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-4">
        <Link href="/dashboard/audits" className="inline-flex items-center gap-1.5 text-sm text-m-muted hover:text-ink transition-colors">
          <ArrowLeft size={16} />
          Back to Audits
        </Link>
        <div className="p-6 rounded-xl bg-red-50 border border-red-200">
          <p className="text-red-800 text-sm">{error || 'Audit not found'}</p>
        </div>
      </div>
    );
  }

  /* ── Brand identity audit → dedicated component ───────── */
  if (audit.audit_type === 'brand_identity' && user) {
    return <BrandAuditDetail auditId={auditId} user={{ id: user.id }} />;
  }

  /* ── Derived state ─────────────────────────────────────── */
  const report = audit.report as Report | null;
  const auditLang = (audit as any).language || 'en';
  const L = getUILabels(auditLang);
  const PILLAR_CONFIG = buildPillarConfig(auditLang);
  const severityConfig = buildSeverityConfig(L);
  const statusMeta = buildStatusMeta(L);
  const progressSteps = buildProgressSteps(L);

  const meta = statusMeta[audit.status] || statusMeta.pending_payment;
  const StatusIcon = meta.icon;
  const isCompleted = audit.status === 'completed';
  const isInProgress = ['crawling', 'analysing', 'generating_report', 'payment_received'].includes(audit.status);
  const canDelete = audit.status === 'pending_payment';
  const currentStepIdx = getStepIndex(audit.status, progressSteps);

  // Parse category scores from report
  const rawJson = report?.raw_json as any;
  const categoryScores: Array<{ name: string; score: number; summary: string }> =
    rawJson?.categoryScores && Array.isArray(rawJson.categoryScores) ? rawJson.categoryScores : [];

  // Selected pillars from report (null = all 4)
  const auditSelectedPillars: number[] | null = rawJson?.selectedPillars ?? (audit as any)?.selected_pillars ?? null;
  const auditSelectedModules: string[] | null = rawJson?.selectedModules ?? (audit as any)?.selected_modules ?? null;
  // Module slug order must match PILLAR_STYLE order
  const MODULE_SLUG_ORDER = ['foundation', 'human_experience', 'inclusive_design', 'future_readiness', 'seo_structure', 'brand_consistency'];
  // Total possible modules: 6 (or 5 if brand_consistency not applicable)
  const totalModuleCount = PILLAR_STYLE.length; // 6
  // Count pillars that actually have category score data
  const pillarsWithData = PILLAR_STYLE.filter(p =>
    categoryScores.some((_, idx) => idx >= p.range[0] && idx < p.range[1])
  ).length;
  const activeModuleCount = auditSelectedModules
    ? Math.min(auditSelectedModules.length, pillarsWithData)
    : (auditSelectedPillars ? Math.min(auditSelectedPillars.length, pillarsWithData) : pillarsWithData);
  const isPartialAudit = activeModuleCount < totalModuleCount;

  // ALWAYS calculate overall score from category data (don't trust stored value)
  const calculatedOverallScore = categoryScores.length > 0
    ? Math.round(categoryScores.reduce((s, c) => s + c.score, 0) / categoryScores.length)
    : (report?.overall_score ?? 0);

  // Severity counts
  const severityCounts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  // Assign findings to modules — use explicit category_index, fall back to keyword matching
  function assignFindingsToPillars() {
    const perPillar: Record<string, AuditFinding[]> = {};
    for (const p of PILLAR_CONFIG) perPillar[p.name] = [];

    const catNames = categoryScores.map(c => c.name);

    for (const f of findings) {
      let bestCatIdx: number;
      if ((f as any).category_index != null) {
        bestCatIdx = (f as any).category_index;
      } else {
        const text = `${f.title} ${f.description} ${f.recommendation || ''}`;
        bestCatIdx = matchFindingToCategory(text, catNames);
      }
      const pillar = getPillarForCategory(bestCatIdx, PILLAR_CONFIG);
      perPillar[pillar.name].push(f);
    }

    return perPillar;
  }

  const findingsByPillar = assignFindingsToPillars();

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 relative">
      {/* ── Sticky Score Bar — sticks to top of main scroll area ── */}
      {isCompleted && (
        <div className={`sticky top-0 z-40 -mx-4 mb-0 transition-all duration-200 ${showStickyScore ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden'}`}>
          <div className="border-b border-rule/30 bg-paper/95 backdrop-blur-md">
            <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white ${
                  calculatedOverallScore >= 70 ? '[background:var(--ok)]' : calculatedOverallScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                  {calculatedOverallScore}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{formatUrl(audit.product_url || '')}</p>
                  <p className="text-[11px] text-m-muted">{getScoreLabel(calculatedOverallScore, auditLang)}</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                {PILLAR_CONFIG.map((pillar, pIdx) => {
                  const pillarCats = categoryScores.filter((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
                  const avg = pillarCats.length > 0
                    ? Math.round(pillarCats.reduce((s, c) => s + c.score, 0) / pillarCats.length)
                    : 0;
                  const hasData = pillarCats.length > 0;
                  const wasAudited = hasData && (!isPartialAudit || (auditSelectedModules ? auditSelectedModules.includes(MODULE_SLUG_ORDER[pIdx]) : (auditSelectedPillars?.includes(pIdx) ?? true)));
                  return (
                    <div key={pillar.name} className={`flex items-center gap-1 ${!wasAudited ? 'opacity-30' : ''}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${scoreBg(avg)}`} />
                      {wasAudited ? (
                        <span className={`text-xs font-medium ${scoreColor(avg)}`}>{avg}</span>
                      ) : (
                        <span className="text-xs text-m-muted">--</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back — if audit belongs to a domain group (siblings), go to dedicated domain page; otherwise just back to list */}
      <Link
        href={siblingCount > 0 ? `/dashboard/audits/site/${encodeURIComponent(formatUrl(audit.product_url || ''))}` : '/dashboard/audits'}
        className="inline-flex items-center gap-1.5 text-sm text-m-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {siblingCount > 0 ? `Back to ${formatUrl(audit.product_url || '')} Audits` : 'Back to Audits'}
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium font-sans text-ink mb-1 truncate">
            {formatUrl(audit.product_url || '')}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-m-muted text-sm">{formatDate(audit.created_at)}</p>
            {(audit as any).depth_mode === 'deep' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-signal bg-signal/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                <Search size={10} />
                Deep Mode
              </span>
            )}
            <a
              href={audit.product_url || ''}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-signal hover:text-signal/80 transition-colors"
            >
              <ExternalLink size={11} />
              Visit site
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-m-muted hover:text-ink hover:bg-paper-2 transition-colors"
            aria-label="Audit settings"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-[100] w-52 rounded-xl border border-rule/40 bg-paper py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {isCompleted && (
                <>
                  <button
                    onClick={() => { handleShare(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors"
                  >
                    <Share2 size={13} className="text-m-muted" />
                    {shareUrl ? 'Copy share link' : 'Create share link'}
                  </button>
                  {(shareUrl || (audit as any).share_enabled) && (
                    <button
                      onClick={handleRevokeShare}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LinkIcon size={13} />
                      Revoke share link
                    </button>
                  )}
                  <div className="my-1.5 h-px bg-rule/30" />
                </>
              )}
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors"
              >
                <RefreshCw size={13} className="text-m-muted" />
                Re-audit this site
                <span className="ml-auto text-[11px] text-m-muted">1 credit</span>
              </Link>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors"
              >
                <Search size={13} className="text-m-muted" />
                Dig Deeper (find new issues)
                <span className="ml-auto text-[11px] text-m-muted">1 credit</span>
              </Link>
              <button
                onClick={() => { handleRestart(); setMenuOpen(false); }}
                disabled={restarting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors disabled:opacity-50"
              >
                <Zap size={13} className="text-m-muted" />
                Restart audit
              </button>
              <div className="my-1.5 h-px bg-rule/30" />
              <button
                onClick={() => { handleDelete(); setMenuOpen(false); }}
                disabled={deleting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                Delete audit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Payment return: verifying ──────────────────────── */}
      {isPaymentReturn && verifying && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="text-signal animate-spin" />
            <div>
              <p className="font-medium text-ink">Confirming your payment...</p>
              <p className="text-sm text-m-muted">This only takes a moment.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Pending payment ────────────────────────────────── */}
      {audit.status === 'pending_payment' && !verifying && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                <Clock size={20} className="text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-ink">Payment required</p>
                <p className="text-sm text-m-muted">Complete payment to start the audit.</p>
              </div>
            </div>
            <button
              onClick={handlePayNow}
              className="inline-flex items-center gap-2 text-sm font-medium bg-signal text-paper px-6 py-2.5 rounded-lg transition-all hover:brightness-110"
            >
              Pay Now
            </button>
          </div>
        </Card>
      )}

      {/* ── In progress: progress bar ──────────────────────── */}
      {isInProgress && !verifying && (
        <Card className="mb-6">
          <div className="flex items-center gap-3 mb-5">
            <StatusIcon size={20} className="text-signal" />
            <div>
              <p className="font-medium text-ink">{meta.label}</p>
              <p className="text-sm text-m-muted">{meta.description}</p>
            </div>
            <Loader2 size={16} className="text-signal animate-spin ml-auto" />
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-1">
            {progressSteps.map((step, idx) => {
              const isActive = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={clsx(
                        'w-full h-2 rounded-full transition-colors',
                        isActive ? 'bg-signal' : 'bg-paper-2',
                        isCurrent && 'animate-pulse',
                      )}
                    />
                    <p className={clsx('text-xs font-medium mt-1.5', isActive ? 'text-signal' : 'text-m-muted')}>
                      {step.label}
                    </p>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <RotatingCheckpoints />
          <p className="text-sm text-m-muted mt-2 text-center">
            This page updates automatically. No need to refresh.
          </p>

          {/* Restart button if stuck */}
          {audit.updated_at && (Date.now() - new Date(audit.updated_at).getTime() > 3 * 60 * 1000) && (
            <div className="mt-4 pt-3 border-t border-rule flex items-center justify-between">
              <p className="text-xs text-m-muted">Taking longer than expected?</p>
              <button
                onClick={handleRestart}
                disabled={restarting}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-signal text-paper px-4 py-2.5 rounded-lg transition-all disabled:opacity-60 hover:brightness-110"
              >
                {restarting ? (
                  <><Loader2 size={13} className="animate-spin" /> Restarting...</>
                ) : (
                  <><Zap size={13} /> Restart Audit</>
                )}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── Failed state ───────────────────────────────────── */}
      {audit.status === 'failed' && (
        <div className="mb-6 p-5 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-900">Audit failed</p>
              <p className="text-sm text-red-700 mt-1">
                {audit.crawl_error || 'Something went wrong during processing.'}
              </p>
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/8 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-xs font-medium text-emerald-800">
                    No credits were used for this audit
                  </p>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5 ml-[22px]">
                  Your credit has been automatically refunded. You can restart the audit at no extra cost.
                </p>
              </div>
              <div className="flex items-center gap-2.5 mt-4">
                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="inline-flex items-center gap-1.5 text-sm font-medium bg-signal text-paper px-5 py-2.5 rounded-lg transition-all disabled:opacity-60 hover:brightness-110"
                >
                  {restarting ? (
                    <><Loader2 size={14} className="animate-spin" /> Restarting...</>
                  ) : (
                    <><Zap size={14} /> Restart Audit</>
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-m-muted hover:text-red-600 px-3 py-2.5 rounded-xl border border-rule hover:border-red-300 transition-colors disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          COMPLETED: FULL RESULTS
          ═══════════════════════════════════════════════════════ */}
      {isCompleted && report && (
        <>
          {/* ── Hero Score Card ─────────────────────────────── */}
          <div ref={scoreCardRef} className="border border-rule overflow-hidden mb-6 bg-paper">
            <div className="p-6 sm:p-8">
              {/* Mobile: centered stack — Desktop: horizontal row */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Score ring */}
                <div className="flex-shrink-0">
                  <ScoreRing score={calculatedOverallScore} size={110} strokeWidth={7} />
                </div>

                {/* Score details */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                    <h2 className="font-sans text-[22px] text-ink font-medium tracking-[-0.01em]">{formatUrl(audit.product_url || '')}</h2>
                  </div>
                  <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-1">
                    {findings.length} findings · {activeModuleCount} modules{isPartialAudit ? ` of ${totalModuleCount}` : ''}
                  </p>

                  {/* Module mini-scores with colored dots */}
                  {categoryScores.length > 0 && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                      {PILLAR_CONFIG.map((pillar, idx) => {
                        const cats = categoryScores.filter((_, i) => i >= pillar.range[0] && i < pillar.range[1]);
                        if (cats.length === 0) return null;
                        const avg = Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length);
                        return (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODULE_TINTS[idx].dot }} />
                            <span className="text-xs text-m-muted">{pillar.name}</span>
                            <span className={`text-xs font-medium ${scoreColor(avg)}`}>{avg}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Severity counts */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                    {severityCounts.critical > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-severe">
                        <span className="w-2 h-2 rounded-full bg-severe" /> {severityCounts.critical} critical
                      </span>
                    )}
                    {severityCounts.high > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-warn">
                        <span className="w-2 h-2 rounded-full bg-warn" /> {severityCounts.high} high
                      </span>
                    )}
                    {(severityCounts.medium + severityCounts.low) > 0 && (
                      <span className="text-[11px] font-mono text-m-muted tracking-[0.06em] uppercase">
                        {severityCounts.medium + severityCounts.low} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>
            {/* Action strip */}
            <div className="border-t border-rule px-6 sm:px-8 py-4 flex flex-wrap gap-2.5">
              <a href={`/api/reports/${auditId}/pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors">
                <Download size={13} /> PDF
              </a>
              <a href={`/api/reports/${auditId}/docx`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors">
                <Download size={13} /> Word
              </a>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors"
              >
                <RefreshCw size={13} /> Re-audit
              </Link>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                className="flex items-center gap-2 border border-signal/30 text-signal text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-signal/5 transition-colors"
              >
                <Search size={13} /> Dig deeper
              </Link>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors disabled:opacity-50"
              >
                {shareCopied ? <><Check size={13} className="text-ok" /> Copied</> : <><Share2 size={13} /> Share</>}
              </button>
            </div>
          </div>

          {/* ── Score Over Time (line chart — shows when there are multiple audits of the same URL) ── */}
          <ScoreOverTime productUrl={audit.product_url || ''} currentAuditId={auditId} currentScore={calculatedOverallScore} />

          {/* ── Improvement tip ─────────────────────────────── */}
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-signal/5 border border-signal/20">
            <RefreshCw size={15} className="text-signal flex-shrink-0" />
            <p className="text-xs text-m-muted">
              <span className="font-medium text-ink">Track your progress</span> — update finding statuses as you fix them, dismiss false positives with a reason, then re-audit to compare your score.
            </p>
          </div>

          {/* ── Page Screenshot ────────────────────────────── */}
          {auditPages[0]?.screenshot_url && (
            <div className="mb-6 rounded-lg overflow-hidden border border-rule/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={auditPages[0].screenshot_url}
                alt="Website overview"
                className="w-full h-auto max-h-96 object-cover object-top"
                loading="lazy"
              />
              <div className="px-4 py-2 bg-paper border-t border-rule/20">
                <p className="text-xs text-m-muted">{L.homepageCaptured}</p>
              </div>
            </div>
          )}

          {/* ── Tab Navigation ─────────────────────────────── */}
          <div className="flex items-center gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--paper-2)' }}>
            {(['overview', 'findings', 'pages', 'ai_xray'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const label = tab === 'overview' ? L.tabOverview
                : tab === 'findings' ? L.tabFindings
                : tab === 'pages' ? L.tabPages
                : 'AI X-Ray';
              const count = tab === 'findings' ? findings.length
                : tab === 'pages' ? auditPages.length
                : null;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 flex items-center justify-center gap-2 text-[13px] font-medium py-2.5 rounded-lg transition-all"
                  style={{
                    color: isActive ? 'var(--ink)' : 'var(--m-muted)',
                    background: isActive ? 'var(--card)' : 'transparent',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <span>{label}</span>
                  {count !== null && count > 0 && (
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded-full leading-none"
                      style={{
                        background: isActive ? 'var(--paper-2)' : 'var(--paper-3)',
                        color: 'var(--m-muted)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── TAB: Overview ──────────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              {/* Verification alerts — baseline re-audit feedback */}
              {!verificationAlertDismissed && rawJson?.verificationSummary && (
                <>
                  {/* "Nothing changed" alert */}
                  {rawJson.verificationSummary.nothingChanged && (
                    <div className="mb-4 p-4 rounded-xl bg-paper-2 border border-rule/40 flex items-start gap-3">
                      <Info size={16} className="text-m-muted flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink mb-0.5">No changes detected</p>
                        <p className="text-xs text-m-muted leading-relaxed">
                          Nothing has changed compared to the latest audit. Your score remains the same.
                          To improve, address open findings and mark them as fixed, or run a Deep Mode audit to discover new insights.
                        </p>
                      </div>
                      <button
                        onClick={() => setVerificationAlertDismissed(true)}
                        className="text-m-muted hover:text-ink transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* "Likely fixed findings detected" alert — count from actual findings for accuracy */}
                  {(() => {
                    const likelyCount = findings.filter((f: any) => f.verification_status === 'likely_fixed').length;
                    if (likelyCount === 0) return null;
                    return (
                      <div className="mb-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-3">
                        <Eye size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink mb-0.5">
                            {likelyCount} finding{likelyCount > 1 ? 's' : ''} may have been fixed
                          </p>
                          <p className="text-xs text-m-muted leading-relaxed">
                            Our AI scanned the live site and detected changes that suggest {likelyCount > 1 ? 'these issues have' : 'this issue has'} been addressed.
                            Look for the &quot;Likely Fixed&quot; badge on findings below. Confirm the fix to update your score.
                          </p>
                        </div>
                        <button
                          onClick={() => setVerificationAlertDismissed(true)}
                          className="text-m-muted hover:text-ink transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })()}

                  {/* "Poorly fixed findings detected" alert — count from actual findings for accuracy */}
                  {(() => {
                    const poorlyCount = findings.filter((f: any) => f.verification_status === 'poorly_fixed').length;
                    if (poorlyCount === 0) return null;
                    return (
                      <div className="mb-4 p-4 rounded-xl bg-red-50/60 border border-red-200/40 flex items-start gap-3">
                        <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink mb-0.5">
                            {poorlyCount} finding{poorlyCount > 1 ? 's' : ''} poorly fixed
                          </p>
                          <p className="text-xs text-m-muted leading-relaxed">
                            Our AI detected that {poorlyCount > 1 ? 'these fixes' : 'this fix'} may have introduced new issues or made things worse.
                            Look for the &quot;Poorly Fixed&quot; badge on findings below and review the AI notes for guidance.
                          </p>
                        </div>
                        <button
                          onClick={() => setVerificationAlertDismissed(true)}
                          className="text-m-muted hover:text-ink transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Top Priority Recommendations — shown first for immediate actionability */}
              {(rawJson?.topRecommendations?.length > 0 || rawJson?.keyRecommendation) && (
                <div className="mb-6 p-5 rounded-xl border border-rule bg-card">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-signal">
                      <Zap size={14} className="text-paper" />
                    </div>
                    <p className="text-sm font-medium text-ink">{getReportLabels(auditLang).topPriorityRecommendations}</p>
                  </div>
                  <div className="space-y-3">
                    {(rawJson.topRecommendations || [rawJson.keyRecommendation]).filter(Boolean).map((rec: string, i: number) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium bg-signal text-paper mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm text-ink leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {report.executive_summary && (
                <div className="rounded-xl border border-rule bg-card p-6 mb-6">
                  <h2 className="font-sans font-medium text-lg text-ink mb-3">{getReportLabels(auditLang).executiveSummary}</h2>
                  <div className="text-m-muted text-sm leading-relaxed whitespace-pre-line">
                    {report.executive_summary}
                  </div>

                  {/* Research note */}
                  <div className="mt-4 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-paper-2/60 border border-rule/30">
                    <Lightbulb size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-m-muted leading-relaxed">
                      {L.qualitativeNote}
                    </p>
                  </div>
                </div>
              )}

              {/* Module Sections with scores and findings */}
              {categoryScores.length > 0 && PILLAR_CONFIG.map((pillar, pillarIdx) => {
                // Skip modules that have no category scores (e.g. old audits with only 24 categories)
                const hasCats = categoryScores.some((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
                const hasFindings = (findingsByPillar[pillar.name] || []).length > 0;
                if (!hasCats && !hasFindings) return null;
                return (
                  <PillarSection
                    key={pillar.name}
                    pillar={pillar}
                    pillarIndex={pillarIdx}
                    categoryScores={categoryScores}
                    findings={findingsByPillar[pillar.name] || []}
                    lang={auditLang}
                    onScoreUpdate={() => fetchAuditDetail(true)}
                  />
                );
              })}

              {/* Checkpoint Health — category-level pass/fail summary */}
              <CheckpointHealth categoryScores={categoryScores} findings={findings} />

              {/* AI transparency note */}
              <div className="mb-6 px-4 py-3 rounded-xl bg-paper-2/40 border border-rule/15">
                <p className="text-[11px] text-m-muted/70 leading-relaxed">
                  <span className="font-medium text-m-muted">About this audit</span> — This report was generated by AI analysing your publicly visible page content across up to 6 modules and 24 categories. It cannot test JavaScript interactions, real load times, or content behind authentication. For accessibility compliance and security-critical findings, we recommend pairing these results with manual review. Dismiss any finding that doesn&apos;t apply to your context — the AI will learn from your feedback on re-audits.
                </p>
              </div>

              {/* Fallback if no category scores */}
              {categoryScores.length === 0 && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                    {[
                      { score: report.ux_score, label: 'UX' },
                      { score: report.conversion_score, label: 'Conversion' },
                      { score: report.mobile_score, label: 'Mobile' },
                      { score: report.ai_discoverability_score, label: 'AI Ready' },
                      { score: report.content_score, label: 'Content' },
                    ].map((item, idx) =>
                      item.score != null && (
                        <div key={idx} className="bg-paper border border-rule/30 rounded-xl flex flex-col items-center py-4 px-3">
                          <ScoreRing score={item.score} size={72} strokeWidth={5} />
                          <p className="text-xs text-m-muted font-medium mt-2">{item.label}</p>
                        </div>
                      ),
                    )}
                  </div>

                  {/* AI Visibility Score breakdown */}
                  {(() => {
                    const aiVis = (report.raw_json as any)?.aiVisibilityBreakdown;
                    if (!aiVis) return null;
                    const bars = [
                      { label: 'LLM knowledge accuracy', value: aiVis.llmAccuracy, desc: 'How accurately AI describes your site' },
                      { label: 'Structured data coverage', value: aiVis.structuredData, desc: 'JSON-LD completeness for rich results' },
                      { label: 'Content extractability', value: aiVis.contentExtractability, desc: 'How well AI can read your pages' },
                      { label: 'Crawl infrastructure', value: aiVis.crawlInfrastructure, desc: 'robots.txt, llms.txt, ai-plugin.json' },
                    ];
                    return (
                      <div className="bg-paper border border-rule/30 rounded-xl p-5 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Brain size={16} className="text-signal" />
                          <h3 className="text-sm font-heading font-semibold text-ink">AI visibility breakdown</h3>
                          <span className="ml-auto text-lg font-heading font-bold text-ink">{aiVis.overall}<span className="text-sm text-m-muted font-normal">/100</span></span>
                        </div>
                        <div className="space-y-3">
                          {bars.map((bar, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-m-muted">{bar.label}</span>
                                <span className="text-xs font-mono font-medium text-ink">{bar.value}</span>
                              </div>
                              <div className="h-1.5 bg-rule/20 rounded-full overflow-hidden">
                                <div
                                  className={clsx(
                                    'h-full rounded-full transition-all duration-500',
                                    bar.value >= 70 ? 'bg-ok' : bar.value >= 40 ? 'bg-warn' : 'bg-crit',
                                  )}
                                  style={{ width: `${bar.value}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-m-muted/60 mt-0.5">{bar.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Simple severity-grouped findings */}
                  {findings.length > 0 && (
                    <div className="space-y-3">
                      {findings.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} pillarColor="text-signal" sevConfig={severityConfig} onScoreUpdate={() => fetchAuditDetail(true)} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── TAB: All Findings (flat list, sortable) ────── */}
          {activeTab === 'findings' && (
            <div className="space-y-2">
              {findings.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 size={32} className="[color:var(--ok)] mx-auto mb-3" />
                  <p className="text-ink font-medium">{L.noIssuesFound}</p>
                  <p className="text-sm text-m-muted mt-1">{L.noIssuesDescription}</p>
                </div>
              ) : (
                (['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                  const items = findings.filter((f) => f.severity === severity);
                  if (items.length === 0) return null;
                  const config = severityConfig[severity];
                  return (
                    <div key={severity} className="mb-4">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                        <span className={`text-sm font-medium ${config.text}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-m-muted">
                          {items.length} issue{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map((finding) => (
                          <FindingCard key={finding.id} finding={finding} pillarColor="text-signal" sevConfig={severityConfig} onScoreUpdate={() => fetchAuditDetail(true)} />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TAB: Pages ─────────────────────────────────── */}
          {activeTab === 'pages' && (
            <div>
              <p className="text-sm text-m-muted mb-4">
                {auditPages.length} {L.pagesCrawled}
              </p>
              <div className="bg-paper border border-rule/30 rounded-lg overflow-hidden divide-y divide-rule/30">
                {auditPages.map((pg, idx) => {
                  const readability = (pg as any).ai_readability as any;
                  const aiStatus = readability?.status as string | undefined;
                  const aiScore = readability?.overallScore as number | undefined;
                  return (
                  <div key={idx}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-paper-2/50 transition-colors">
                      <span className="text-xs text-m-muted w-6 text-right flex-shrink-0 font-mono">{idx + 1}</span>
                      <Globe size={14} className="text-m-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {pg.title && (
                          <p className="text-sm font-medium text-ink truncate">{pg.title}</p>
                        )}
                        <a
                          href={pg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-signal hover:text-signal/80 hover:underline truncate block"
                        >
                          {pg.url}
                        </a>
                      </div>
                      {/* AI readability indicator */}
                      {aiStatus && (
                        <span className={clsx(
                          'inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded tracking-[0.04em]',
                          aiStatus === 'green' && 'text-ok bg-ok/10',
                          aiStatus === 'amber' && 'text-warn bg-warn/10',
                          aiStatus === 'red' && 'text-crit bg-crit/10',
                        )}>
                          <Brain size={10} /> AI {aiScore ?? 0}%
                        </span>
                      )}
                      {pg.is_mobile_friendly === true && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ok bg-ok/10 px-1.5 py-0.5 rounded tracking-[0.04em]">
                          <Smartphone size={10} /> Mobile OK
                        </span>
                      )}
                      {pg.is_mobile_friendly === false && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-warn bg-warn/10 px-1.5 py-0.5 rounded tracking-[0.04em]">
                          <Smartphone size={10} /> Mobile issues
                        </span>
                      )}
                      {pg.status_code && pg.status_code !== 200 && (
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded text-orange-600 bg-orange-50">
                          {pg.status_code}
                        </span>
                      )}
                    </div>
                    {/* AI readability detail — what AI can/cannot extract */}
                    {readability && (
                      <div className="px-4 pb-3 pt-0 ml-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {readability.extractable?.length > 0 && (
                            <div className="text-xs">
                              <p className="text-ok font-medium mb-1 flex items-center gap-1">
                                <CheckCircle2 size={11} /> AI can extract
                              </p>
                              <ul className="text-m-muted space-y-0.5 ml-4">
                                {(readability.extractable as string[]).slice(0, 6).map((item: string, i: number) => (
                                  <li key={i} className="list-disc">{item}</li>
                                ))}
                                {readability.extractable.length > 6 && (
                                  <li className="text-m-muted/60">+{readability.extractable.length - 6} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                          {readability.missing?.length > 0 && (
                            <div className="text-xs">
                              <p className="text-warn font-medium mb-1 flex items-center gap-1">
                                <AlertTriangle size={11} /> AI misses
                              </p>
                              <ul className="text-m-muted space-y-0.5 ml-4">
                                {(readability.missing as string[]).slice(0, 6).map((item: string, i: number) => (
                                  <li key={i} className="list-disc">{item}</li>
                                ))}
                                {readability.missing.length > 6 && (
                                  <li className="text-m-muted/60">+{readability.missing.length - 6} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB: AI X-Ray ──────────────────────────────── */}
          {activeTab === 'ai_xray' && (
            <div className="space-y-6">

              {/* LLM Probe Results — What AI knows about your site */}
              {llmProbeResults.length > 0 && (
                <div className="bg-paper border border-rule/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-rule/30 flex items-center gap-2">
                    <Brain size={16} className="text-signal" />
                    <h3 className="text-sm font-heading font-semibold text-ink">What AI knows about your site</h3>
                    <span className="ml-auto text-xs text-m-muted font-mono">{llmProbeResults.length} questions</span>
                  </div>
                  <div className="divide-y divide-rule/20">
                    {llmProbeResults.map((probe: any, i: number) => {
                      const accColor = probe.accuracy === 'accurate' ? 'text-ok bg-ok/10'
                        : probe.accuracy === 'partial' ? 'text-warn bg-warn/10'
                        : probe.accuracy === 'hallucinated' ? 'text-crit bg-crit/10'
                        : probe.accuracy === 'inaccurate' ? 'text-crit bg-crit/10'
                        : 'text-m-muted bg-off';
                      return (
                        <div key={i} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="text-sm font-medium text-ink">{probe.question}</p>
                            <span className={`text-[11px] font-mono px-2 py-0.5 rounded flex-shrink-0 ${accColor}`}>
                              {probe.accuracy || 'pending'}
                            </span>
                          </div>
                          <p className="text-[13px] text-ink-2 leading-relaxed">{probe.answer}</p>
                          {probe.accuracy_note && (
                            <p className="text-xs text-m-muted mt-1.5">{probe.accuracy_note}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Citation Audit — What gets cited vs. ignored */}
              {aiCitations.length > 0 && (
                <div className="bg-paper border border-rule/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-rule/30 flex items-center gap-2">
                    <FileSearch size={16} className="text-signal" />
                    <h3 className="text-sm font-heading font-semibold text-ink">AI citation audit</h3>
                    <span className="ml-auto text-xs text-m-muted font-mono">
                      {aiCitations.filter((c: any) => c.citation_type !== 'ignored').length} cited / {aiCitations.filter((c: any) => c.citation_type === 'ignored').length} ignored
                    </span>
                  </div>
                  <div className="divide-y divide-rule/20">
                    {aiCitations.map((cit: any, i: number) => (
                      <div key={i} className="px-5 py-3 flex items-start gap-3">
                        {cit.citation_type === 'ignored' ? (
                          <AlertTriangle size={13} className="text-warn mt-0.5 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 size={13} className="text-ok mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-ink">{cit.ai_context}</p>
                          {cit.cited_text && (
                            <p className="text-xs text-m-muted mt-0.5 truncate">{cit.cited_text}</p>
                          )}
                          {cit.page_url && (
                            <a href={cit.page_url} target="_blank" rel="noopener noreferrer" className="text-xs text-signal hover:underline mt-0.5 inline-flex items-center gap-1">
                              <ExternalLink size={10} /> {cit.page_url}
                            </a>
                          )}
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${
                          cit.citation_type === 'direct_quote' ? 'text-ok bg-ok/10' :
                          cit.citation_type === 'paraphrase' ? 'text-signal bg-signal/10' :
                          cit.citation_type === 'ignored' ? 'text-warn bg-warn/10' :
                          'text-m-muted bg-off'
                        }`}>
                          {cit.citation_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fix Playbooks — Copy-paste code snippets */}
              {fixPlaybooks.length > 0 && (
                <div className="bg-paper border border-rule/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-rule/30 flex items-center gap-2">
                    <Zap size={16} className="text-signal" />
                    <h3 className="text-sm font-heading font-semibold text-ink">Fix playbooks</h3>
                    <span className="ml-auto text-xs text-m-muted font-mono">{fixPlaybooks.length} snippets</span>
                  </div>
                  <div className="divide-y divide-rule/20">
                    {fixPlaybooks.map((pb: any, i: number) => (
                      <div key={i} className="px-5 py-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-mono text-signal bg-signal/10 px-1.5 py-0.5 rounded">{pb.playbook_type}</span>
                          <h4 className="text-sm font-medium text-ink">{pb.title}</h4>
                        </div>
                        {pb.description && (
                          <p className="text-xs text-m-muted mb-3">{pb.description}</p>
                        )}
                        <div className="relative">
                          <pre className="bg-paper-2 border border-rule/30 rounded-lg p-4 text-xs font-mono text-ink-2 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                            {pb.code_snippet}
                          </pre>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(pb.code_snippet);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded bg-card border border-rule/30 text-m-muted hover:text-ink transition-colors"
                            title="Copy to clipboard"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {llmProbeResults.length === 0 && aiCitations.length === 0 && fixPlaybooks.length === 0 && (
                <div className="text-center py-12">
                  <Brain size={32} className="mx-auto text-m-muted mb-3 opacity-40" />
                  <p className="text-sm text-m-muted">AI X-Ray data will appear here after your next audit.</p>
                  <p className="text-xs text-m-muted/60 mt-1">Includes LLM probe results, citation audit, and fix playbooks.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Bottom action bar ────────────────────────── */}
          <div className="mt-8 mb-4">
            <div className="rounded-xl border border-rule bg-card p-5 max-w-3xl mx-auto">
              <div className="flex flex-wrap justify-center gap-2.5">
                <a
                  href={`/api/reports/${auditId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors whitespace-nowrap"
                  style={{ color: 'var(--ink)', fontSize: '13px', fontWeight: 600 }}
                >
                  <Download size={14} strokeWidth={2} /> PDF Report
                </a>
                <a
                  href={`/api/reports/${auditId}/docx`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors whitespace-nowrap"
                  style={{ color: 'var(--ink)', fontSize: '13px', fontWeight: 600 }}
                >
                  <Download size={14} strokeWidth={2} /> Word Report
                </a>
                <Link
                  href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                  className="flex items-center justify-center gap-2 bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors whitespace-nowrap"
                  style={{ color: 'var(--ink)', fontSize: '13px', fontWeight: 600 }}
                >
                  <RefreshCw size={14} strokeWidth={2} /> Re-audit
                </Link>
                <Link
                  href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                  className="flex items-center justify-center gap-2 border border-signal/30 rounded-lg px-4 py-2.5 hover:bg-signal/5 transition-colors whitespace-nowrap"
                  style={{ color: 'var(--signal)', fontSize: '13px', fontWeight: 600 }}
                >
                  <Search size={14} strokeWidth={2} /> Dig deeper
                </Link>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="flex items-center justify-center gap-2 bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors disabled:opacity-50 whitespace-nowrap"
                  style={{ color: 'var(--ink)', fontSize: '13px', fontWeight: 600 }}
                >
                  {shareCopied ? <><Check size={14} strokeWidth={2} className="text-ok" /> Copied</> : <><Share2 size={14} strokeWidth={2} /> Share</>}
                </button>
              </div>
              <p className="text-center text-[11px] text-m-muted mt-3">1 credit per audit</p>
              {shareUrl && (
                <p className="text-center text-[11px] text-m-muted mt-1">
                  Share link: <span className="font-mono text-signal">{shareUrl}</span>
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Wrap in Suspense — required by Next.js for useSearchParams()
const AuditDetailPage = (props: { params: Promise<{ id: string }> }) => (
  <Suspense
    fallback={
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="h-5 w-20 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-paper-2 rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-paper-2 rounded animate-pulse mb-8" />
        <div className="h-48 bg-paper-2 rounded-xl animate-pulse" />
      </div>
    }
  >
    <AuditDetailInner {...props} />
  </Suspense>
);

export default AuditDetailPage;
