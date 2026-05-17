'use client';

import React, { Suspense, useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
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
  ArrowRight,
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
import { type CockpitSeverity, type ModuleScore } from '@/components/dashboard/AuditCockpit';
import { groupFindingsForDisplay, type GroupedFinding } from '@/lib/audit-findings-presentation';
import clsx from 'clsx';
import { matchFindingToCategory } from '@/lib/audit-engine/pipeline/category-keywords';
import { writeSelection } from '@/lib/dashboard/brand-selection';

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
    <div className="mb-6 border border-rule overflow-hidden bg-card">
      <div className="px-5 py-3.5 border-b border-rule/60 bg-paper-2/40">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.04em] uppercase text-m-muted">{categoryScores.length * 4}-Checkpoint health</h3>
          <span className="text-[11px] font-medium text-m-muted ml-auto tracking-[0.03em] uppercase">
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
                <span className={`text-[11px] font-semibold w-6 text-right ${scoreColor(cat.score)}`}>{cat.score}</span>
                <span className="text-[11px] font-medium text-ink flex-1 truncate">{cat.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {passCount > 0 && <span className="text-[11px] font-semibold text-ok">{passCount} pass</span>}
                  {failCount > 0 && <span className="text-[11px] font-semibold text-severe">{failCount} fail</span>}
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
                        <span className={`text-[11px] font-semibold flex-shrink-0 ${hasFinding ? 'text-severe' : 'text-ok'}`}>
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
    <div className="mb-6 border border-rule overflow-hidden bg-card">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-paper-2 transition-colors"
      >
        <TrendingUp size={14} className="text-signal flex-shrink-0" />
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-ink">Score over time</span>
          <span className="text-[11px] font-medium text-m-muted ml-2 tracking-[0.03em] uppercase">{trend.length} audits · {domain}</span>
        </div>
        {improvement !== 0 && (
          <span className={`text-xs font-semibold ${improvement > 0 ? 'text-ok' : 'text-severe'}`}>
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

function FindingCard({ finding, pillarColor, categoryName, pillarName, pillarIndex, sevConfig, onScoreUpdate }: { finding: AuditFinding; pillarColor: string; categoryName?: string; pillarName?: string; pillarIndex?: number; sevConfig: ReturnType<typeof buildSeverityConfig>; onScoreUpdate?: () => void }) {
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
          <span className="text-[11px] font-medium text-m-muted bg-paper-2 px-2 py-0.5 rounded-full tracking-[0.03em] uppercase">Dismissed</span>
        </div>
        {finding.dismissal_reason && (
          <p className="text-[11px] text-m-muted mt-1 ml-4">{finding.dismissal_reason}</p>
        )}
      </div>
    );
  }

  const activeStatus = FINDING_STATUSES.find(s => s.key === status);

  const tint = pillarIndex != null ? MODULE_TINTS[pillarIndex] : null;

  const accentColor = tint?.dot || 'var(--rule)';
  const hasEvidence = Boolean(finding.target_element && finding.target_element.trim());
  const hasRecommendation = Boolean(finding.recommendation && finding.recommendation.trim());
  const hasImpact = Boolean(finding.estimated_impact && finding.estimated_impact.trim());

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={tint
        ? { background: tint.bg, border: `1px solid ${tint.border}`, borderLeft: `3px solid ${accentColor}` }
        : { background: '#ffffff', border: '1px solid var(--rule)', borderLeft: '3px solid var(--signal)' }}
    >
      {/* Header — always visible */}
      <div className="flex items-start gap-3 p-4">
        {/* Main content — clickable to expand */}
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 min-w-0 text-left"
          aria-expanded={open}
        >
          {/* Pill row: severity · module · category · verification */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span
              className={clsx(
                'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-full',
                sev.text,
              )}
              style={{ background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
              {sev.label}
            </span>
            {pillarName && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-full"
                style={{ background: tint ? `${tint.dot}15` : 'var(--paper-2)', color: tint?.dot || 'var(--m-muted)' }}
                title={pillarName}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                {pillarName}
              </span>
            )}
            {categoryName && (
              <span className="inline-flex items-center text-[10px] font-medium text-m-muted px-1.5 py-0.5 rounded-full bg-paper-2 tracking-[0.03em]">
                {categoryName}
              </span>
            )}
            {(finding as any).verification_status === 'likely_fixed' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ok bg-ok/10 px-1.5 py-0.5 rounded-full tracking-[0.03em] uppercase">
                <Eye size={9} /> Likely fixed
              </span>
            )}
            {(finding as any).verification_status === 'poorly_fixed' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-severe bg-severe/10 px-1.5 py-0.5 rounded-full tracking-[0.03em] uppercase">
                <AlertTriangle size={9} /> Poorly fixed
              </span>
            )}
          </div>
          <h4 className="font-sans font-medium text-ink text-[14px] leading-[1.45]">{finding.title}</h4>
          {finding.page_url && (
            <span className="inline-flex items-center gap-1 text-[11px] text-m-muted mt-1 max-w-full truncate">
              <ExternalLink size={9} className="flex-shrink-0" />
              {(() => {
                try {
                  const u = new URL(finding.page_url);
                  const path = u.pathname + u.search;
                  return u.hostname + (path === '/' ? '' : path);
                } catch { return finding.page_url; }
              })()}
            </span>
          )}
        </button>

        {/* Right side: status + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status badge — always visible */}
          <div className="relative group">
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              className={clsx(
                'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all',
                activeStatus ? `${activeStatus.bg} ${activeStatus.color}` : 'bg-paper-2 text-m-muted',
              )}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeStatus?.dot || 'bg-m-muted'}`} />
              {activeStatus?.label || 'Open'}
            </button>
          </div>
          <button onClick={() => setOpen(!open)} className="p-1 -mr-1" aria-label={open ? 'Collapse' : 'Expand'}>
            <ChevronDown
              size={14}
              className={`text-m-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-rule/40">

          {/* AI Verification Note — Likely Fixed */}
          {(finding as any).verification_status === 'likely_fixed' && (finding as any).verification_note && (
            <div className="flex items-start gap-2.5 px-5 py-3.5 bg-ok/5 border-b border-ok/15">
              <Eye size={14} className="text-ok flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-ink mb-0.5 tracking-[0.03em] uppercase">AI verification</p>
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
            <div className="flex items-start gap-2.5 px-5 py-3.5 bg-severe/5 border-b border-severe/15">
              <AlertTriangle size={14} className="text-severe flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-semibold text-ink mb-0.5 tracking-[0.03em] uppercase">Regression detected</p>
                <p className="text-[13px] text-severe leading-[1.65]">
                  {(finding as any).verification_note}
                </p>
                <p className="text-[11px] text-m-muted mt-1">
                  The attempted fix introduced new issues. Review and address the regression to improve your score.
                </p>
              </div>
            </div>
          )}

          {/* AI vs Human Interpretation */}
          {(finding as any).ai_interpretation && (finding as any).human_interpretation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b border-rule/40">
              <div className="p-4 border-b md:border-b-0 md:border-r border-rule/40">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={12} className="text-signal" />
                  <p className="text-[10px] font-semibold text-m-muted tracking-[0.04em] uppercase">How AI reads this</p>
                </div>
                <p className="text-ink-2 text-[13px] leading-[1.7]">
                  {(finding as any).ai_interpretation}
                </p>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={12} className="text-ok" />
                  <p className="text-[10px] font-semibold text-m-muted tracking-[0.04em] uppercase">How a human sees this</p>
                </div>
                <p className="text-ink-2 text-[13px] leading-[1.7]">
                  {(finding as any).human_interpretation}
                </p>
              </div>
            </div>
          )}

          {/* Why it matters / Evidence / Recommended fix / Business impact */}
          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* Panel 1: Why it matters */}
            <div className="p-4 border-b md:border-b-0 md:border-r border-rule/40">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} className={sev.text} />
                <p className="text-[10px] font-semibold text-m-muted tracking-[0.04em] uppercase">Why it matters</p>
              </div>
              <p className="text-ink-2 text-[13px] leading-[1.7]">
                {finding.description}
              </p>
            </div>

            {/* Panel 2: Recommended fix */}
            <div
              className="p-4 border-b md:border-b-0 md:border-r border-rule/40"
              style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={12} className="text-signal" />
                <p className="text-[10px] font-semibold text-signal tracking-[0.04em] uppercase">Recommended fix</p>
              </div>
              {hasRecommendation ? (
                <p className="text-ink text-[13px] leading-[1.7] font-medium">
                  {finding.recommendation}
                </p>
              ) : (
                <p className="text-m-muted text-[12px] leading-[1.7] italic">
                  No specific fix captured — review against the category guidance and apply best practice.
                </p>
              )}
            </div>

            {/* Panel 3: Business impact */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={12} className="text-ok" />
                <p className="text-[10px] font-semibold text-m-muted tracking-[0.04em] uppercase">
                  {hasImpact ? 'Business impact' : 'Impact'}
                </p>
              </div>
              {hasImpact ? (
                <p className="text-ink-2 text-[13px] leading-[1.7]">
                  {finding.estimated_impact}
                </p>
              ) : (
                <p className="text-m-muted text-[12px] leading-[1.7] italic">
                  Business impact not captured for this finding.
                </p>
              )}
            </div>
          </div>

          {/* Evidence row — full width, only when target_element exists */}
          {hasEvidence && (
            <div className="border-t border-rule/40 px-4 py-3 bg-paper-2/40">
              <div className="flex items-center gap-2 mb-1.5">
                <FileSearch size={12} className="text-m-muted" />
                <p className="text-[10px] font-semibold text-m-muted tracking-[0.04em] uppercase">Evidence</p>
              </div>
              <div className="px-2.5 py-1.5 bg-card rounded border border-rule/40 font-mono text-[11px] text-ink-2 overflow-x-auto">
                {finding.target_element}
              </div>
            </div>
          )}

          {/* Screenshot */}
          {finding.screenshot_url && (
            <div className="border-t border-rule/40">
              <div className="px-4 py-2 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                <span className="text-[10px] font-semibold text-m-muted tracking-[0.04em] uppercase">Visual evidence</span>
                {finding.page_url && (
                  <span className="text-[10px] text-m-muted/60 ml-auto truncate max-w-[200px]">
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

          {/* Status toolbar — prominent, always visible when expanded */}
          <div className="border-t border-rule/40 px-4 py-3 bg-paper-2/50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold text-m-muted uppercase tracking-[0.04em] mr-1">Status</span>
              <div className="flex flex-wrap gap-1">
                {FINDING_STATUSES.map((s) => {
                  const active = status === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(s.key)}
                      disabled={statusUpdating}
                      className={clsx(
                        'inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all',
                        active
                          ? `${s.bg} ${s.color} ring-1 ring-current/20`
                          : 'text-m-muted hover:bg-paper-2 hover:text-ink',
                        'disabled:opacity-50',
                      )}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? s.dot : 'bg-border'}`} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto">
                <button
                  onClick={() => setShowDismissForm(!showDismissForm)}
                  className="text-[11px] font-medium text-m-muted hover:text-severe px-2.5 py-1.5 rounded-full hover:bg-severe/5 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>

          {/* Dismiss form */}
          {showDismissForm && (
            <div className="border-t border-severe/15 px-4 py-3 bg-severe/5">
              <p className="text-[11px] font-medium text-ink mb-2">Why are you dismissing this? (The AI will skip it on re-audits)</p>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g. This is addressed on our About page, or: This is intentional for our target audience..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-rule bg-paper text-ink placeholder:text-m-muted focus:outline-none focus:ring-1 focus:ring-signal resize-none"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleDismiss}
                  disabled={statusUpdating || !dismissReason.trim()}
                  className="text-[11px] font-semibold text-paper px-3 py-1.5 rounded-full bg-severe hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  Dismiss and skip on re-audit
                </button>
                <button
                  onClick={() => setShowDismissForm(false)}
                  className="text-[11px] font-medium text-m-muted px-3 py-1.5 rounded-full hover:bg-paper-2 transition-colors"
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
  defaultExpanded = true,
}: {
  pillar: ReturnType<typeof buildPillarConfig>[number];
  pillarIndex: number;
  categoryScores: Array<{ name: string; score: number; summary: string }>;
  findings: AuditFinding[];
  lang: string;
  onScoreUpdate?: () => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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
          <p className="text-[10px] font-medium text-m-muted tracking-[0.03em] uppercase">
            {pillarCats.length} categories{totalFindings > 0 ? ` · ${totalFindings} finding${totalFindings !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0 mr-2">
          <p className={`text-[22px] font-bold ${scoreColor(avgScore)}`}>{avgScore}</p>
          <p className="text-[10px] font-medium text-m-muted tracking-[0.03em] uppercase">/100</p>
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
                <span className={`text-[15px] font-bold flex-shrink-0 ${scoreColor(cat.score)}`}>
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
                  <span className="text-[10px] font-medium text-m-muted tracking-[0.03em] uppercase">
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
  const [auditPages, setAuditPages] = useState<Array<{ url: string; title: string | null; status_code: number | null; load_time_ms: number | null; screenshot_url: string | null; is_mobile_friendly: boolean | null; viewport_meta: string | null; content_text: string | null; ai_readability: any | null }>>([]);
  const [siblingCount, setSiblingCount] = useState(0); // other audits for same domain
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  type AuditTab = 'overview' | 'summary' | 'findings' | 'pages' | 'responsive' | 'ai_xray' | 'intelligence' | 'brand_identity' | 'brand_audit';
  const VALID_TABS: AuditTab[] = ['overview', 'summary', 'findings', 'pages', 'responsive', 'ai_xray', 'intelligence', 'brand_identity', 'brand_audit'];
  const initialTabFromHash = ((): AuditTab => {
    if (typeof window === 'undefined') return 'overview';
    const h = (window.location.hash || '').replace(/^#/, '');
    return (VALID_TABS as string[]).includes(h) ? (h as AuditTab) : 'overview';
  })();
  const [activeTab, setActiveTab] = useState<AuditTab>(initialTabFromHash);

  // Keep activeTab in sync with URL hash so the sidebar deep-links work
  // (e.g. /dashboard/audits/<id>#findings) and back/forward navigation works.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const h = (window.location.hash || '').replace(/^#/, '');
      if ((VALID_TABS as string[]).includes(h)) setActiveTab(h as AuditTab);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const current = (window.location.hash || '').replace(/^#/, '');
    if (current !== activeTab) {
      const target = (activeTab === 'overview' || activeTab === 'summary') ? '' : `#${activeTab}`;
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${target}`);
    }
  }, [activeTab]);
  // Cockpit-driven filters: click a severity chip or module bar to narrow the
  // Findings tab. Always toggle (click again = clear). Filters persist across
  // tab switches so the user can drill from cockpit → findings naturally.
  const [filterSeverity, setFilterSeverity] = useState<CockpitSeverity | null>(null);
  const [filterModuleIndex, setFilterModuleIndex] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [xrayCopied, setXrayCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const copySection = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(key);
    setTimeout(() => setCopiedSection(null), 2000);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [verificationAlertDismissed, setVerificationAlertDismissed] = useState(false);
  // Persist verification alert dismissal in the report's raw_json so it
  // stays hidden across page reloads and sessions.
  const dismissVerificationAlerts = useCallback(async () => {
    setVerificationAlertDismissed(true);
    try {
      const supabase = createBrowserSupabase();
      const { data: report } = await supabase.from('reports').select('id, raw_json').eq('audit_id', auditId).single();
      if (report) {
        const updated = { ...(report.raw_json as any || {}), verificationAlertsDismissed: true };
        await supabase.from('reports').update({ raw_json: updated }).eq('id', report.id);
      }
    } catch {}
  }, [auditId]);
  const [aiCitations, setAiCitations] = useState<any[]>([]);
  const [fixPlaybooks, setFixPlaybooks] = useState<any[]>([]);
  const [llmProbeResults, setLlmProbeResults] = useState<any[]>([]);
  const [intelligenceData, setIntelligenceData] = useState<any>(null);
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

        // Sync the global brand/site selection to this audit's identity
        // so the sidebar selector + topbar "Viewing X" mirror the audit
        // the operator just opened. Without this, clicking a supabase.com
        // audit while the selector is on clearux.ai would leave the
        // selector on clearux.ai and the audit body on supabase.com —
        // the divergence reported in the bug.
        try {
          if ((auditData as any).audit_type === 'brand_identity' && (auditData as any).brand_identity_id) {
            writeSelection({ kind: 'brand', brandId: (auditData as any).brand_identity_id });
          } else if (auditData.product_url) {
            const host = new URL(auditData.product_url).hostname.replace(/^www\./, '');
            if (host) writeSelection({ kind: 'site', host });
          }
        } catch {}

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

          // Fetch Intelligence Layer data — non-blocking
          fetch(`/api/audits/intelligence?audit_id=${auditId}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) setIntelligenceData(data); })
            .catch(() => {});
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
    // Retry briefly — the ref may not be attached on the first render cycle
    // when report data arrives slightly after status changes to completed
    let retryTimer: NodeJS.Timeout | null = null;
    let cleanupScroll: (() => void) | null = null;

    const attach = () => {
      const el = scoreCardRef.current;
      if (!el) return false;
      const scrollRoot = document.getElementById('main-content');
      if (!scrollRoot) return false;

      const checkVisibility = () => {
        const rootRect = scrollRoot.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        setShowStickyScore(elRect.bottom < rootRect.top + 10);
      };
      scrollRoot.addEventListener('scroll', checkVisibility, { passive: true });
      checkVisibility();
      cleanupScroll = () => scrollRoot.removeEventListener('scroll', checkVisibility);
      return true;
    };

    if (!attach()) {
      // Ref not ready yet — retry a few times
      let attempts = 0;
      retryTimer = setInterval(() => {
        attempts++;
        if (attach() || attempts >= 10) {
          if (retryTimer) clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 100);
    }

    return () => {
      if (retryTimer) clearInterval(retryTimer);
      if (cleanupScroll) cleanupScroll();
    };
  }, [audit?.status, audit?.report]);

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

  // Restore persisted verification alert dismissal.
  // NOTE: This hook must stay above the early returns below (loading / error /
  // brand_identity) so React always sees the same hook order between renders.
  // React production error #310 fires when a hook is registered on one render
  // but skipped by an early return on the next.
  const persistedVerificationDismissed = ((audit?.report as Report | null)?.raw_json as any)?.verificationAlertsDismissed;
  useEffect(() => {
    if (persistedVerificationDismissed) setVerificationAlertDismissed(true);
  }, [persistedVerificationDismissed]);

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

  // Parse audit limitations (transparency alerts)
  const auditLimitations: Array<{ id: string; title: string; description: string; tab?: string }> =
    rawJson?.auditLimitations && Array.isArray(rawJson.auditLimitations) ? rawJson.auditLimitations : [];

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

  /* ── Cockpit-friendly derived data ─────────────────────────
   * - findingModuleIndex: per-finding module (0..5) for filtering + queue.
   * - cockpitModules: module-level score bars (with audited flag).
   * - rankedFindings: top fix queue, severity-weighted, with priority bucket.
   * - filteredFindings: applied to the Findings tab.
   */
  const catNamesForModule = categoryScores.map(c => c.name);
  function findingModuleIndex(f: AuditFinding): number {
    let catIdx: number;
    if ((f as any).category_index != null) {
      catIdx = (f as any).category_index;
    } else {
      catIdx = matchFindingToCategory(`${f.title} ${f.description} ${f.recommendation || ''}`, catNamesForModule);
    }
    for (let i = 0; i < PILLAR_STYLE.length; i++) {
      const p = PILLAR_STYLE[i];
      if (catIdx >= p.range[0] && catIdx < p.range[1]) return i;
    }
    return 0;
  }

  const cockpitModules: ModuleScore[] = PILLAR_CONFIG.map((pillar, idx) => {
    const cats = categoryScores.filter((_, i) => i >= pillar.range[0] && i < pillar.range[1]);
    const audited = cats.length > 0 && (!isPartialAudit || (auditSelectedModules ? auditSelectedModules.includes(MODULE_SLUG_ORDER[idx]) : (auditSelectedPillars?.includes(idx) ?? true)));
    const avg = cats.length > 0
      ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length)
      : 0;
    return {
      index: idx,
      name: pillar.name,
      score: avg,
      dot: MODULE_TINTS[idx]?.dot || 'var(--m-muted)',
      audited,
    };
  });

  // Filters applied to the Findings tab. The Overview tab still shows the full
  // breakdown — filters are most useful on the flat list.
  const filteredFindings = findings.filter((f) => {
    if (filterSeverity && f.severity !== filterSeverity) return false;
    if (filterModuleIndex != null && findingModuleIndex(f) !== filterModuleIndex) return false;
    return true;
  });

  // Consolidate near-duplicate findings for display only. The grouping never
  // mutates DB records or hides individual findings from the engine: each
  // group still tracks every member finding and exposes a "primary" record
  // for status / dismiss actions.
  const groupedFilteredFindings: GroupedFinding[] = groupFindingsForDisplay(
    filteredFindings,
    findingModuleIndex,
  );

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
          {/* ── Hero Score Card + Score Over Time + Tip — only on Summary/Overview tab ── */}
          {(activeTab === 'overview' || activeTab === 'summary') && <>
          <div ref={scoreCardRef} className="border border-rule overflow-hidden mb-6 bg-card">
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
                  <p className="text-[11px] font-medium text-m-muted tracking-[0.03em] uppercase mb-1">
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
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.03em] uppercase text-severe">
                        <span className="w-2 h-2 rounded-full bg-severe" /> {severityCounts.critical} critical
                      </span>
                    )}
                    {severityCounts.high > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.03em] uppercase text-warn">
                        <span className="w-2 h-2 rounded-full bg-warn" /> {severityCounts.high} high
                      </span>
                    )}
                    {(severityCounts.medium + severityCounts.low) > 0 && (
                      <span className="text-[11px] font-medium text-m-muted tracking-[0.03em] uppercase">
                        {severityCounts.medium + severityCounts.low} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>
            {/* Action strip */}
            <div className="border-t border-rule px-6 sm:px-8 py-4 flex flex-wrap gap-2.5">
              <a href={`/api/reports/${auditId}/pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-semibold tracking-[0.03em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors">
                <Download size={13} /> PDF
              </a>
              <a href={`/api/reports/${auditId}/docx`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-semibold tracking-[0.03em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors">
                <Download size={13} /> Word
              </a>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-semibold tracking-[0.03em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors"
              >
                <RefreshCw size={13} /> Re-audit
              </Link>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                className="flex items-center gap-2 border border-signal/30 text-signal text-[11px] font-semibold tracking-[0.03em] uppercase px-4 py-2 rounded-lg hover:bg-signal/5 transition-colors"
              >
                <Search size={13} /> Dig deeper
              </Link>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-semibold tracking-[0.03em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors disabled:opacity-50"
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
          </>}

          {/* ── Tab Navigation — mobile-only fallback. The desktop sidebar
              owns feature navigation; on small screens (where the sidebar
              collapses to a drawer) we still need an inline switcher so the
              user can move between Overview/Findings/Pages without opening
              the menu. ─────────────────────────────────────────────── */}
          <div className={`md:hidden mb-6 sticky z-30 -mx-4 px-4 py-2 bg-paper/95 backdrop-blur-md transition-all duration-200 ${showStickyScore ? 'top-[57px] shadow-sm border-b border-rule/40' : 'top-0 border-b border-rule/30'}`}>
            <nav
              className="flex gap-1 p-1 rounded-xl border border-rule bg-card overflow-x-auto"
              role="tablist"
              aria-label="Audit sections"
            >
              {(['overview', 'findings', 'pages', 'responsive', 'ai_xray', 'intelligence'] as const).map((tab) => {
                const isActive = activeTab === tab;
                const label = tab === 'overview' ? L.tabOverview
                  : tab === 'findings' ? L.tabFindings
                  : tab === 'pages' ? L.tabPages
                  : tab === 'responsive' ? 'Responsive'
                  : tab === 'ai_xray' ? 'AI Readability'
                  : 'Intelligence';
                const responsiveFindings = findings.filter((f: any) => {
                  const t = (f.title || '').toLowerCase();
                  return t.includes('viewport') || t.includes('responsive') || t.includes('mobile') || t.includes('touch target') || t.includes('text too small') || t.includes('overflow') || t.includes('navigation not adapted');
                });
                const count = tab === 'findings' ? findings.length
                  : tab === 'pages' ? auditPages.length
                  : tab === 'responsive' ? responsiveFindings.length
                  : null;
                const TabIcon = tab === 'overview' ? BarChart3
                  : tab === 'findings' ? AlertTriangle
                  : tab === 'pages' ? Globe
                  : tab === 'responsive' ? Smartphone
                  : tab === 'ai_xray' ? Brain
                  : Sparkles;
                return (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabpanel-${tab}`}
                    id={`tab-${tab}`}
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      'flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold rounded-lg transition-all whitespace-nowrap',
                      isActive
                        ? 'bg-paper text-ink shadow-sm ring-1 ring-rule/60'
                        : 'text-m-muted hover:text-ink hover:bg-paper/60',
                    )}
                  >
                    <TabIcon size={15} className={isActive ? 'text-signal' : 'text-m-muted'} />
                    <span>{label}</span>
                    {count !== null && count > 0 && (
                      <span
                        className={clsx(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center',
                          isActive ? 'bg-signal text-white' : 'bg-paper-2 text-m-muted',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ── Tab page header ──────────────────────────────── */}
          {(() => {
            const tabMeta: Record<string, { icon: React.ElementType; title: string }> = {
              overview: { icon: BarChart3, title: 'Summary' },
              summary: { icon: BarChart3, title: 'Summary' },
              findings: { icon: AlertTriangle, title: 'Findings' },
              pages: { icon: Globe, title: 'Pages' },
              responsive: { icon: Smartphone, title: 'Responsive' },
              ai_xray: { icon: Brain, title: 'AI Readability' },
              intelligence: { icon: Sparkles, title: 'Intelligence' },
            };
            const meta = tabMeta[activeTab];
            if (!meta) return null;
            const TabIcon = meta.icon;
            return (
              <div className="flex items-center gap-3 mb-6">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                  <TabIcon size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                </span>
                <h2 className="font-sans text-xl font-semibold" style={{ color: 'var(--ink)' }}>{meta.title}</h2>
              </div>
            );
          })()}

          {/* ── TAB: Overview / Summary ──────────────────────────────── */}
          {(activeTab === 'overview' || activeTab === 'summary') && (
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
                        onClick={dismissVerificationAlerts}
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
                          onClick={dismissVerificationAlerts}
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
                          onClick={dismissVerificationAlerts}
                          className="text-m-muted hover:text-ink transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Transparency alerts — inform user about engine limitations */}
              {auditLimitations.filter(l => !l.tab).length > 0 && (
                <div className="mb-4 space-y-2">
                  {auditLimitations.filter(l => !l.tab).map((limitation) => (
                    <div key={limitation.id} className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-3">
                      <Info size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink mb-0.5">{limitation.title}</p>
                        <p className="text-xs text-m-muted leading-relaxed">{limitation.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Top Priority Recommendations — shown first for immediate actionability */}
              {(rawJson?.topRecommendations?.length > 0 || rawJson?.keyRecommendation) && (
                <div className="mb-6 rounded-xl border border-rule bg-card overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-5 py-4 border-b border-rule/40"
                    style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)' }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-signal">
                      <Zap size={13} className="text-paper" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{getReportLabels(auditLang).topPriorityRecommendations}</p>
                      <p className="text-[11px] text-m-muted">Ship these first — ranked by business impact, fix effort, and evidence strength.</p>
                    </div>
                    <span className="text-[10px] font-semibold text-signal bg-signal/10 px-2 py-0.5 rounded-full tracking-[0.04em] uppercase">
                      {(rawJson.topRecommendations || [rawJson.keyRecommendation]).filter(Boolean).length} actions
                    </span>
                  </div>
                  <div className="divide-y divide-rule/30">
                    {(rawJson.topRecommendations || [rawJson.keyRecommendation]).filter(Boolean).map((rec: string, i: number) => (
                      <div key={i} className="flex gap-4 items-start px-5 py-4 hover:bg-paper-2/50 transition-colors group">
                        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold bg-signal text-paper">
                            {i + 1}
                          </span>
                          <span className="text-[9px] font-semibold text-m-muted tracking-[0.04em] uppercase">Priority</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Lightbulb size={11} className="text-signal" />
                            <span className="text-[10px] font-semibold text-signal tracking-[0.04em] uppercase">Recommended fix</span>
                          </div>
                          <p className="text-[13px] text-ink leading-[1.7] font-medium">{rec}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {report.executive_summary && (
                <div className="rounded-xl border border-rule bg-card overflow-hidden mb-6">
                  <div className="px-5 py-4 border-b border-rule/40">
                    <h2 className="font-sans font-medium text-[15px] text-ink">{getReportLabels(auditLang).executiveSummary}</h2>
                  </div>
                  <div className="px-5 py-4">
                    <div className="text-m-muted text-[13px] leading-[1.7] whitespace-pre-line">
                      {report.executive_summary}
                    </div>
                    <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-paper-2/60 border border-rule/30">
                      <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-m-muted leading-relaxed">
                        {L.qualitativeNote}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Module Grid — 2×3 overview cards */}
              {categoryScores.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {PILLAR_CONFIG.map((pillar, pillarIdx) => {
                    const pillarCats = categoryScores.filter((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
                    if (pillarCats.length === 0) return null;
                    const avgScore = Math.round(pillarCats.reduce((sum, c) => sum + c.score, 0) / pillarCats.length);
                    const tint = MODULE_TINTS[pillarIdx] || MODULE_TINTS[0];
                    const PIcon = PILLAR_ICONS[pillarIdx] || Scale;
                    const pillarFindings = findingsByPillar[pillar.name] || [];
                    const findingCount = pillarFindings.length;

                    return (
                      <button
                        key={pillar.name}
                        onClick={() => setActiveTab('findings')}
                        className="text-left rounded-xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 group"
                        style={{ background: tint.bg, border: `1px solid ${tint.border}` }}
                      >
                        {/* Module header */}
                        <div className="flex items-center gap-3 px-5 py-4">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${tint.dot}15` }}>
                            <PIcon size={16} style={{ color: tint.dot }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-sans font-medium text-[14px] text-ink truncate">{pillar.name}</h3>
                            {findingCount > 0 && (
                              <span className="text-[11px] text-m-muted">
                                {findingCount} finding{findingCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-[24px] font-bold leading-none ${scoreColor(avgScore)}`}>{avgScore}</p>
                            <p className="text-[10px] text-m-muted mt-0.5">/100</p>
                          </div>
                        </div>

                        {/* Category scores */}
                        <div className="px-5 pb-4 space-y-2" style={{ borderTop: `1px solid ${tint.border}` }}>
                          <div className="pt-3" />
                          {pillarCats.map((cat, relIdx) => {
                            const CatIcon = CATEGORY_ICONS[pillar.range[0] + relIdx] || Sparkles;
                            return (
                              <div key={relIdx} className="flex items-center gap-2.5">
                                <CatIcon size={13} className="flex-shrink-0 text-m-muted" />
                                <span className="flex-1 text-[13px] text-ink truncate">{cat.name}</span>
                                <div className="w-16 h-[3px] rounded-full flex-shrink-0" style={{ background: `${tint.dot}15` }}>
                                  <div className="h-full rounded-full" style={{ width: `${cat.score}%`, background: tint.dot, opacity: 0.55 }} />
                                </div>
                                <span className={`text-[13px] font-semibold w-7 text-right flex-shrink-0 ${scoreColor(cat.score)}`}>{cat.score}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-2.5 flex items-center justify-end gap-1 text-[11px] font-medium group-hover:gap-2 transition-all" style={{ borderTop: `1px solid ${tint.border}`, color: tint.dot }}>
                          View findings
                          <ArrowRight size={12} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

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
                        <div key={idx} className="bg-card border border-rule/30 rounded-xl flex flex-col items-center py-4 px-3">
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
                      <div className="bg-card border border-rule/30 rounded-xl p-5 mb-6">
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
                                <span className="text-xs font-semibold text-ink">{bar.value}</span>
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
              {/* Compact severity summary — quick at-a-glance counts + filter shortcuts */}
              {findings.length > 0 && (
                <div className="mb-3 rounded-xl border border-rule bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-rule/40 flex items-center gap-2 flex-wrap">
                    <FileSearch size={14} className="text-signal" />
                    <h3 className="text-sm font-medium text-ink">All findings</h3>
                    <span className="text-[11px] font-medium text-m-muted tracking-[0.03em] uppercase">
                      {findings.filter(f => !f.dismissed).length} active{findings.length !== findings.filter(f => !f.dismissed).length ? ` · ${findings.length - findings.filter(f => !f.dismissed).length} dismissed` : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-rule/30">
                    {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                      const count = findings.filter((f) => f.severity === sev && !f.dismissed).length;
                      const cfg = severityConfig[sev];
                      const active = filterSeverity === sev;
                      return (
                        <button
                          key={sev}
                          onClick={() => setFilterSeverity(active ? null : sev)}
                          className={clsx(
                            'px-4 py-3 text-left transition-colors hover:bg-paper-2',
                            active && 'bg-paper-2',
                          )}
                          aria-pressed={active}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            <span className={`text-[10px] font-semibold uppercase tracking-[0.04em] ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <p className={`text-[20px] font-bold leading-none ${count === 0 ? 'text-m-muted' : cfg.text}`}>
                            {count}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active filter banner — driven by cockpit clicks */}
              {(filterSeverity || filterModuleIndex != null) && (
                <div
                  className="mb-3 px-4 py-2.5 rounded-lg flex items-center gap-2 flex-wrap"
                  style={{ background: 'color-mix(in srgb, var(--signal) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 18%, transparent)' }}
                  data-testid="findings-filter-banner"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-signal">
                    Filtered
                  </span>
                  {filterSeverity && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-card border border-rule/40">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: filterSeverity === 'critical' ? 'var(--severe)' : filterSeverity === 'high' ? 'var(--warn)' : filterSeverity === 'medium' ? 'var(--signal)' : 'var(--ok)' }} />
                      {filterSeverity.charAt(0).toUpperCase() + filterSeverity.slice(1)} severity
                    </span>
                  )}
                  {filterModuleIndex != null && cockpitModules[filterModuleIndex] && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-card border border-rule/40">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cockpitModules[filterModuleIndex].dot }} />
                      {cockpitModules[filterModuleIndex].name}
                    </span>
                  )}
                  <span className="text-[11px] text-m-muted">
                    {filteredFindings.length} of {findings.length} findings
                  </span>
                  <button
                    onClick={() => { setFilterSeverity(null); setFilterModuleIndex(null); }}
                    className="ml-auto text-[11px] font-medium text-signal hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {findings.length === 0 ? (
                <div className="rounded-xl border border-rule bg-card text-center py-14 px-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ok/10 mb-3">
                    <CheckCircle2 size={22} className="[color:var(--ok)]" />
                  </div>
                  <p className="text-ink font-medium text-[15px]">{L.noIssuesFound}</p>
                  <p className="text-sm text-m-muted mt-1 max-w-md mx-auto">{L.noIssuesDescription}</p>
                </div>
              ) : filteredFindings.length === 0 ? (
                <div className="rounded-xl border border-rule bg-card text-center py-12 px-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-paper-2 mb-3">
                    <Search size={20} className="text-m-muted" />
                  </div>
                  <p className="text-ink font-medium">No findings match this filter</p>
                  <p className="text-sm text-m-muted mt-1">Clear the filter to see all findings, or try a different combination.</p>
                  <button
                    onClick={() => { setFilterSeverity(null); setFilterModuleIndex(null); }}
                    className="mt-4 text-[12px] font-medium text-signal hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                (['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                  const items = groupedFilteredFindings.filter((g) => g.primary.severity === severity);
                  if (items.length === 0) return null;
                  const config = severityConfig[severity];
                  const totalMembers = items.reduce((s, g) => s + g.members.length, 0);
                  return (
                    <div key={severity} className="mb-5">
                      <div className="flex items-center gap-2 mb-2.5 px-1">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] px-2 py-0.5 rounded-full',
                            config.text,
                          )}
                          style={{ background: 'color-mix(in srgb, currentColor 10%, transparent)' }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                          {config.label}
                        </span>
                        <span className="text-[11px] text-m-muted font-medium tracking-[0.03em] uppercase">
                          {items.length} issue{items.length !== 1 ? 's' : ''}
                          {totalMembers > items.length ? ` · ${totalMembers} records` : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map((group) => {
                          const finding = group.primary;
                          return (
                            <div key={finding.id} id={`finding-${finding.id}`} className="rounded-xl transition-shadow">
                              {group.isConsolidated && (
                                <div
                                  className="rounded-t-xl px-4 py-2.5 flex items-center gap-2 flex-wrap text-[11px]"
                                  style={{
                                    background: 'color-mix(in srgb, var(--signal) 5%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--signal) 18%, transparent)',
                                    borderBottom: 'none',
                                  }}
                                  data-testid="consolidated-finding-banner"
                                >
                                  <span className="font-semibold tracking-[0.04em] uppercase text-signal">
                                    Affects {group.affectedModuleIndices.length} module
                                    {group.affectedModuleIndices.length === 1 ? '' : 's'}
                                  </span>
                                  {group.affectedModuleIndices.map((idx) => {
                                    const mod = cockpitModules[idx];
                                    if (!mod) return null;
                                    return (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-card border border-rule/40 text-m-muted font-medium"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: mod.dot }} />
                                        {mod.name}
                                      </span>
                                    );
                                  })}
                                  <span className="ml-auto text-m-muted font-medium tracking-[0.03em] uppercase">
                                    {group.members.length} similar finding
                                    {group.members.length === 1 ? '' : 's'} grouped
                                    {group.affectedPages.length > 1
                                      ? ` · ${group.affectedPages.length} pages`
                                      : ''}
                                  </span>
                                </div>
                              )}
                              <FindingCard
                                finding={finding}
                                pillarColor="text-signal"
                                sevConfig={severityConfig}
                                onScoreUpdate={() => fetchAuditDetail(true)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TAB: Pages ─────────────────────────────────── */}
          {activeTab === 'pages' && (() => {
            // Honest empty state — page-level evidence missing
            if (auditPages.length === 0) {
              return (
                <div className="rounded-xl border border-rule bg-card p-6">
                  <div className="flex items-start gap-3">
                    <Info size={16} className="text-m-muted flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-ink mb-1">Page-level evidence was not captured for this audit</p>
                      <p className="text-[12px] text-m-muted leading-relaxed mb-3">
                        This audit didn't store per-page data, so we can't show URLs, mobile-friendliness, or AI-readability here. Findings on other tabs are still valid.
                      </p>
                      <p className="text-[12px] text-ink-2 leading-relaxed">
                        To see page-level evidence, re-run this audit from the audit menu (Re-audit) — newer audits capture and persist per-page detail.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // Summary metrics — derived only from data we actually have.
            const mobileChecked = auditPages.filter(p => p.is_mobile_friendly !== null);
            const mobileFriendlyCount = mobileChecked.filter(p => p.is_mobile_friendly === true).length;
            const mobileIssueCount = mobileChecked.filter(p => p.is_mobile_friendly === false).length;
            const aiPages = auditPages.filter(p => (p as any).ai_readability?.overallScore != null);
            const avgAi = aiPages.length > 0
              ? Math.round(aiPages.reduce((s, p) => s + ((p as any).ai_readability.overallScore || 0), 0) / aiPages.length)
              : null;
            const brokenCount = auditPages.filter(p => p.status_code && p.status_code >= 400).length;
            type Card = { label: string; value: React.ReactNode; sub?: string; tone?: 'warn' | 'severe' | 'ok' };
            const cards: Card[] = [
              { label: 'Pages checked', value: auditPages.length },
            ];
            if (mobileChecked.length > 0) {
              cards.push({
                label: 'Mobile-friendly',
                value: <>{mobileFriendlyCount}<span className="text-[12px] font-medium text-m-muted">/{mobileChecked.length}</span></>,
                sub: mobileIssueCount > 0 ? `${mobileIssueCount} with issues` : 'All clear',
                tone: mobileIssueCount > 0 ? 'warn' : 'ok',
              });
            }
            if (avgAi != null) {
              cards.push({
                label: 'Avg AI readability',
                value: <>{avgAi}<span className="text-[12px] font-medium text-m-muted">%</span></>,
                sub: `${aiPages.length} of ${auditPages.length} scored`,
                tone: avgAi >= 70 ? 'ok' : avgAi >= 40 ? 'warn' : 'severe',
              });
            }
            if (brokenCount > 0) {
              cards.push({
                label: 'Broken / errors',
                value: brokenCount,
                sub: 'HTTP 4xx / 5xx',
                tone: 'severe',
              });
            }

            return (
            <div className="space-y-5">
              {/* Summary cards — only metrics derived from real data */}
              <div className={clsx('grid gap-3', cards.length === 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-4')}>
                {cards.map((c) => (
                  <div key={c.label} className="rounded-xl border border-rule bg-card p-4">
                    <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-m-muted">{c.label}</p>
                    <p className={clsx(
                      'text-[22px] font-bold mt-1 leading-none',
                      c.tone === 'severe' ? 'text-severe' : c.tone === 'warn' ? 'text-warn' : 'text-ink',
                    )}>{c.value}</p>
                    {c.sub && <p className="text-[11px] text-m-muted mt-1.5">{c.sub}</p>}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-rule bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-rule/40 flex items-center gap-2">
                <Globe size={16} className="text-m-muted" />
                <h3 className="text-sm font-heading font-semibold text-ink">Pages</h3>
                <span className="ml-auto text-xs text-m-muted font-medium">{auditPages.length} {L.pagesCrawled}</span>
              </div>
              <div className="divide-y divide-rule/30">
                {auditPages.map((pg, idx) => {
                  const readability = (pg as any).ai_readability as any;
                  const aiStatus = readability?.status as string | undefined;
                  const aiScore = readability?.overallScore as number | undefined;
                  return (
                  <div key={idx}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-paper-2/50 transition-colors">
                      <span className="text-xs text-m-muted w-6 text-right flex-shrink-0 font-medium">{idx + 1}</span>
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
                      {/* AI readability indicator — colored by score severity */}
                      {(aiStatus || aiScore != null) && (() => {
                        const score = aiScore ?? 0;
                        const colorClass = aiStatus === 'green' || (!aiStatus && score >= 70)
                          ? 'text-ok bg-ok/10'
                          : aiStatus === 'amber' || (!aiStatus && score >= 40)
                          ? 'text-warn bg-warn/10'
                          : 'text-severe bg-severe/10';
                        return (
                          <span className={clsx(
                            'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full tracking-[0.02em]',
                            colorClass,
                          )}>
                            <Brain size={10} /> AI {score}%
                          </span>
                        );
                      })()}
                      {pg.is_mobile_friendly === true && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ok bg-ok/10 px-2 py-0.5 rounded-full tracking-[0.02em]">
                          <Smartphone size={10} /> Mobile OK
                        </span>
                      )}
                      {pg.is_mobile_friendly === false && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-warn bg-warn/10 px-2 py-0.5 rounded-full tracking-[0.02em]">
                          <Smartphone size={10} /> Mobile issues
                        </span>
                      )}
                      {pg.status_code && pg.status_code !== 200 && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded text-orange-600 bg-orange-50">
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
                        {/* Copy button — copies page + issues for fixing */}
                        {readability.missing?.length > 0 && (
                          <button
                            onClick={() => {
                              const missingList = (readability.missing as string[]).map((m: string) => `- ${m}`).join('\n');
                              const text = `Page: ${pg.url}\n\nAI cannot read the following on this page:\n${missingList}\n\nThese items need to be added or fixed so AI models can extract them.`;
                              copySection(`page-${idx}`, text);
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-m-muted hover:text-ink bg-paper-2/60 hover:bg-paper-2 border border-rule/30 rounded-lg px-2.5 py-1.5 transition-colors"
                          >
                            {copiedSection === `page-${idx}` ? (
                              <><Check size={11} className="text-ok" /> Copied</>
                            ) : (
                              <><Copy size={11} /> Copy issues</>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              </div>
            </div>
            );
          })()}

          {/* ── TAB: Responsive ───────────────────────────── */}
          {activeTab === 'responsive' && (() => {
            // Filter responsive-related findings using same heuristic as the tab count.
            const responsiveFindings = findings.filter((f: any) => {
              const t = (f.title || '').toLowerCase();
              const d = (f.description || '').toLowerCase();
              return t.includes('viewport') || t.includes('responsive') || t.includes('mobile') || t.includes('touch target') || t.includes('text too small') || t.includes('overflow') || t.includes('navigation not adapted') || d.includes('viewport') || d.includes('responsive design');
            });

            // Buckets by viewport based on title/description text. Mobile/tablet/desktop only — we don't claim 4 distinct test runs.
            const matchVp = (f: any, keys: string[]) => {
              const text = `${f.title} ${f.description}`.toLowerCase();
              return keys.some(k => text.includes(k));
            };
            const mobileIssues = responsiveFindings.filter((f: any) => matchVp(f, ['mobile', '375', 'touch target', 'text too small']));
            const tabletIssues = responsiveFindings.filter((f: any) => matchVp(f, ['tablet', '768']));
            const desktopIssues = responsiveFindings.filter((f: any) => matchVp(f, ['desktop', '1440', '1024']));
            const assigned = new Set([...mobileIssues, ...tabletIssues, ...desktopIssues].map((f: any) => f.id));
            const generalIssues = responsiveFindings.filter((f: any) => !assigned.has(f.id));

            const mobilePages = auditPages.filter(p => p.is_mobile_friendly !== null);
            const mobileFriendlyCount = mobilePages.filter(p => p.is_mobile_friendly).length;
            const pagesWithViewportMeta = auditPages.filter(p => p.viewport_meta && p.viewport_meta.length > 0).length;
            const hasResponsiveSignal = responsiveFindings.length > 0 || mobilePages.length > 0;

            const ViewportRow = ({ label, width, count, items }: { label: string; width: string; count: number; items: typeof responsiveFindings }) => {
              const status = count === 0 ? 'No issues captured' : `${count} issue${count !== 1 ? 's' : ''}`;
              const statusClass = count === 0 ? 'text-m-muted' : 'text-warn';
              return (
                <div className="rounded-xl border border-rule bg-card overflow-hidden">
                  <div className="px-5 py-3.5 flex items-center gap-3 border-b border-rule/40">
                    <span className="text-m-muted"><Smartphone size={15} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{label}</p>
                      <p className="text-[11px] text-m-muted">{width}</p>
                    </div>
                    <span className={`text-[12px] font-semibold ${statusClass}`}>{status}</span>
                  </div>
                  {items.length > 0 && (
                    <div className="divide-y divide-rule/30">
                      {items.map((f: any) => (
                        <div key={f.id} className="px-5 py-3">
                          <div className="flex items-start gap-2.5">
                            <span className="w-1 h-1 rounded-full bg-warn mt-2 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-ink mb-0.5">{f.title}</p>
                              {f.description && <p className="text-[12px] text-m-muted leading-relaxed">{f.description}</p>}
                              {f.recommendation && (
                                <p className="text-[12px] text-ink-2 mt-1.5 leading-relaxed">
                                  <span className="font-semibold text-ink">Fix: </span>{f.recommendation}
                                </p>
                              )}
                              {f.page_url && (
                                <p className="text-[11px] text-m-muted/70 mt-1 truncate">{f.page_url}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <div className="space-y-5">
                {/* Transparency alerts */}
                {auditLimitations.filter(l => l.tab === 'responsive').map((limitation) => (
                  <div key={limitation.id} className="p-4 rounded-xl bg-paper-2 border border-rule/40 flex items-start gap-3">
                    <Info size={15} className="text-m-muted flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink mb-0.5">{limitation.title}</p>
                      <p className="text-xs text-m-muted leading-relaxed">{limitation.description}</p>
                    </div>
                  </div>
                ))}

                {/* Summary card — muted, scannable */}
                <div className="rounded-xl border border-rule bg-card p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <Smartphone size={16} className="text-m-muted flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-heading font-semibold text-ink mb-0.5">Responsive design summary</h3>
                      <p className="text-[12px] text-m-muted leading-relaxed">What we captured about how this site adapts to different screen sizes.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="p-3 rounded-lg border border-rule/60 bg-paper">
                      <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-m-muted">Pages checked</p>
                      <p className="text-[18px] font-bold text-ink mt-1">{auditPages.length}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-rule/60 bg-paper">
                      <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-m-muted">With viewport meta</p>
                      <p className="text-[18px] font-bold text-ink mt-1">{pagesWithViewportMeta}<span className="text-[12px] font-medium text-m-muted">/{auditPages.length}</span></p>
                    </div>
                    <div className="p-3 rounded-lg border border-rule/60 bg-paper">
                      <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-m-muted">Responsive issues</p>
                      <p className={`text-[18px] font-bold mt-1 ${responsiveFindings.length === 0 ? 'text-ink' : 'text-warn'}`}>{responsiveFindings.length}</p>
                    </div>
                  </div>
                  {mobilePages.length > 0 && (
                    <p className="text-[12px] text-m-muted mt-3">
                      <span className="font-semibold text-ink">{mobileFriendlyCount}/{mobilePages.length}</span> pages reported mobile-friendly by Lighthouse.
                    </p>
                  )}
                </div>

                {/* Honest empty state — when no responsive-specific findings */}
                {!hasResponsiveSignal && (
                  <div className="rounded-xl border border-rule bg-card p-5">
                    <div className="flex items-start gap-3">
                      <Info size={15} className="text-m-muted flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-ink mb-1">No responsive-specific issues captured</p>
                        <p className="text-[12px] text-m-muted leading-relaxed mb-3">
                          The audit didn't surface any findings tied to viewport, touch targets, mobile layout, or text size. That doesn't guarantee the site is responsive — it means automated checks didn't catch anything obvious.
                        </p>
                        <p className="text-[12px] font-semibold text-ink mb-1.5">Verify manually:</p>
                        <ul className="space-y-1 text-[12px] text-ink-2 leading-relaxed">
                          <li className="flex items-start gap-2"><span className="text-m-muted mt-0.5">•</span><span>Open the site on a real phone and check that the main flow (read, sign up, buy) works without horizontal scrolling.</span></li>
                          <li className="flex items-start gap-2"><span className="text-m-muted mt-0.5">•</span><span>Use Chrome DevTools device emulation to inspect 375px and 768px breakpoints for layout shifts.</span></li>
                          <li className="flex items-start gap-2"><span className="text-m-muted mt-0.5">•</span><span>Tap interactive elements with your thumb — buttons and links should be at least 44×44px.</span></li>
                          <li className="flex items-start gap-2"><span className="text-m-muted mt-0.5">•</span><span>Confirm key images and tables don't overflow the screen on narrow viewports.</span></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Viewport sections — only render rows for buckets with data, or a compact row showing "no issues captured" */}
                {hasResponsiveSignal && (
                  <div className="space-y-3">
                    <ViewportRow label="Mobile" width="375 px" count={mobileIssues.length} items={mobileIssues} />
                    <ViewportRow label="Tablet" width="768 px" count={tabletIssues.length} items={tabletIssues} />
                    <ViewportRow label="Desktop" width="1024 / 1440 px" count={desktopIssues.length} items={desktopIssues} />
                  </div>
                )}

                {/* General responsive findings — not attributed to a viewport */}
                {generalIssues.length > 0 && (
                  <div className="rounded-xl border border-rule bg-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-rule/40 flex items-center gap-2">
                      <Smartphone size={15} className="text-m-muted" />
                      <h3 className="text-[13px] font-semibold text-ink">Other responsive findings</h3>
                      <span className="ml-auto text-[11px] text-m-muted font-medium">{generalIssues.length}</span>
                    </div>
                    <div className="divide-y divide-rule/30">
                      {generalIssues.map((f: any) => (
                        <div key={f.id} className="px-5 py-3">
                          <p className="text-[13px] font-medium text-ink mb-0.5">{f.title}</p>
                          {f.description && <p className="text-[12px] text-m-muted leading-relaxed">{f.description}</p>}
                          {f.recommendation && (
                            <p className="text-[12px] text-ink-2 mt-1.5 leading-relaxed">
                              <span className="font-semibold text-ink">Fix: </span>{f.recommendation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-page mobile status — kept, but neutral palette */}
                {mobilePages.length > 0 && (
                  <div className="rounded-xl border border-rule bg-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-rule/40 flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-m-muted" />
                      <h3 className="text-[13px] font-semibold text-ink">Per-page mobile status</h3>
                      <span className="ml-auto text-[11px] text-m-muted font-medium">{mobileFriendlyCount}/{mobilePages.length} ok</span>
                    </div>
                    <div className="divide-y divide-rule/30">
                      {mobilePages.map((page, i) => (
                        <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                          {page.is_mobile_friendly ? (
                            <CheckCircle2 size={13} className="text-ok flex-shrink-0" />
                          ) : (
                            <AlertTriangle size={13} className="text-warn flex-shrink-0" />
                          )}
                          <span className="text-[12px] text-ink flex-1 truncate">{page.url}</span>
                          <span className={`text-[11px] font-medium ${page.is_mobile_friendly ? 'text-ok' : 'text-warn'}`}>
                            {page.is_mobile_friendly ? 'Mobile-friendly' : 'Needs review'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── TAB: AI X-Ray ──────────────────────────────── */}
          {activeTab === 'ai_xray' && (
            <div className="space-y-6">

              {/* What AI bots see — raw text + interpretation */}
              {auditPages.length > 0 && auditPages.some(p => p.content_text) && (
                <div className="bg-card border border-rule/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-rule/30 flex items-center gap-2">
                    <Eye size={16} className="text-signal" />
                    <h3 className="text-sm font-heading font-semibold text-ink">What AI bots see</h3>
                    <span className="ml-auto text-xs text-m-muted font-medium">{auditPages.filter(p => p.content_text).length} pages crawled</span>
                  </div>
                  <div className="px-5 py-3 border-b border-rule/20 bg-paper-2/30">
                    <p className="text-[11px] text-m-muted leading-relaxed">
                      This is the raw text AI crawlers extract from your pages — stripped of HTML, scripts, and styling. If important content is missing here, AI models can&apos;t see it either.
                    </p>
                  </div>
                  <div className="divide-y divide-rule/20">
                    {auditPages.filter(p => p.content_text).map((page, i) => {
                      const readability = page.ai_readability as any;
                      const score = readability?.overallScore as number | undefined;
                      const status = readability?.status as string | undefined;
                      const extractable = (readability?.extractable as string[]) || [];
                      const missing = (readability?.missing as string[]) || [];
                      const textPreview = (page.content_text || '').slice(0, 800);
                      const wordCount = (page.content_text || '').split(/\s+/).filter(Boolean).length;
                      return (
                        <details key={i} className="group">
                          <summary className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-paper-2/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              status === 'green' ? '[background:var(--ok)]' : status === 'amber' ? 'bg-amber-400' : 'bg-red-400'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-ink truncate">{page.title || page.url}</p>
                              <p className="text-[11px] text-m-muted truncate">{page.url}</p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className="text-[11px] text-m-muted">{wordCount.toLocaleString()} words</span>
                              {score !== undefined && (
                                <span className={`text-sm font-bold ${score >= 70 ? 'text-ok' : score >= 40 ? 'text-warn' : 'text-severe'}`}>{score}</span>
                              )}
                              <ChevronDown size={14} className="text-m-muted group-open:rotate-180 transition-transform" />
                            </div>
                          </summary>
                          <div className="px-5 pb-4">
                            {/* Extractability checklist */}
                            {(extractable.length > 0 || missing.length > 0) && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {extractable.map(item => (
                                  <span key={item} className="inline-flex items-center gap-1 text-[10px] font-medium text-ok bg-ok/10 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 size={9} /> {item}
                                  </span>
                                ))}
                                {missing.map((item: string) => {
                                  const missingFixMap: Record<string, string> = {
                                    'meta description': 'Add a <meta name="description"> tag with a concise summary of the page content',
                                    'og:title': 'Add <meta property="og:title"> for social sharing and AI previews',
                                    'og:description': 'Add <meta property="og:description"> for social sharing and AI previews',
                                    'og:image': 'Add <meta property="og:image"> with a representative image URL',
                                    'canonical': 'Add <link rel="canonical"> to prevent duplicate content issues',
                                    'h1': 'Add a single <h1> heading that describes the main topic of the page',
                                    'structured data': 'Add JSON-LD structured data to help AI understand your content type',
                                    'alt text': 'Add descriptive alt attributes to all <img> elements',
                                    'lang': 'Add a lang attribute to your <html> tag (e.g., lang="en")',
                                  };
                                  const fixTip = Object.entries(missingFixMap).find(([k]) => item.toLowerCase().includes(k))?.[1];
                                  return (
                                    <span key={item} className="inline-flex items-center gap-1 text-[10px] font-medium text-severe bg-severe/10 px-2 py-0.5 rounded-full" title={fixTip || `Add ${item} to this page`}>
                                      <AlertTriangle size={9} /> {item}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            {/* Fix recommendations for missing items */}
                            {missing.length > 0 && (
                              <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5 mb-3">
                                <p className="text-[11px] font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                                  <Lightbulb size={11} className="text-emerald-600 dark:text-emerald-400" />
                                  Fix {missing.length} missing {missing.length === 1 ? 'signal' : 'signals'} on this page
                                </p>
                                <ul className="space-y-1">
                                  {missing.map((item: string) => {
                                    const missingFixMap2: Record<string, string> = {
                                      'meta description': 'Add a <meta name="description" content="..."> tag with a concise page summary',
                                      'og:title': 'Add <meta property="og:title" content="..."> for social/AI previews',
                                      'og:description': 'Add <meta property="og:description" content="..."> for social/AI previews',
                                      'og:image': 'Add <meta property="og:image" content="https://..."> with a representative image',
                                      'canonical': 'Add <link rel="canonical" href="..."> to prevent duplicate content issues',
                                      'h1': 'Add a single <h1> heading that describes the main topic of this page',
                                      'structured data': 'Add JSON-LD structured data — see Fix playbooks below for templates',
                                      'alt text': 'Add descriptive alt attributes to all <img> elements on this page',
                                      'lang': 'Add lang="en" (or your language) to the <html> tag',
                                    };
                                    const fixTip2 = Object.entries(missingFixMap2).find(([k]) => item.toLowerCase().includes(k))?.[1] || `Add ${item} to this page`;
                                    return (
                                      <li key={item} className="text-[10px] text-ink-2 leading-relaxed flex items-start gap-1.5">
                                        <ArrowRight size={8} className="text-ok flex-shrink-0 mt-[3px]" />
                                        <span><span className="font-medium text-ink">{item}:</span> {fixTip2}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {/* Raw extracted text */}
                            <div className="rounded-lg border border-rule/30 bg-paper p-4 max-h-[300px] overflow-y-auto">
                              <p className="text-[10px] font-semibold text-m-muted uppercase tracking-wide mb-2">Raw text (what bots read)</p>
                              <p className="text-xs text-ink-2 leading-relaxed whitespace-pre-line font-mono">
                                {textPreview}{(page.content_text || '').length > 800 && '...'}
                              </p>
                            </div>
                            {/* Structured data types found */}
                            {readability?.structuredDataTypes?.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="text-[10px] text-m-muted font-medium mr-1">Structured data:</span>
                                {readability.structuredDataTypes.map((t: string) => (
                                  <span key={t} className="text-[10px] font-medium text-signal bg-signal/10 px-2 py-0.5 rounded-full">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Visibility Breakdown — Composite score card */}
              {(() => {
                const aiVis = (report.raw_json as any)?.aiVisibilityBreakdown;
                if (!aiVis) return null;
                const bars = [
                  { label: 'LLM knowledge accuracy', value: aiVis.llmAccuracy, desc: 'How accurately AI describes your site',
                    fixes: aiVis.llmAccuracy < 70 ? [
                      'Add Organization and WebSite JSON-LD to your homepage so AI models know your brand name, description, and URL',
                      'Ensure every page has a unique, descriptive <title> and <meta description> that matches your actual content',
                      'Add an llms.txt file to your domain root — this gives AI crawlers a structured summary of your site',
                      'Avoid JavaScript-only rendering for key content; AI crawlers often can\'t execute JS',
                    ] : [] },
                  { label: 'Structured data coverage', value: aiVis.structuredData, desc: 'JSON-LD completeness for rich results',
                    fixes: aiVis.structuredData < 70 ? [
                      'Add Organization JSON-LD to your homepage with name, logo, URL, and social profiles',
                      'Add WebSite JSON-LD with a SearchAction so AI can understand your site structure',
                      'Add BreadcrumbList JSON-LD to inner pages to show page hierarchy',
                      'Check the Fix playbooks section below for ready-to-use code snippets',
                    ] : [] },
                  { label: 'Content extractability', value: aiVis.contentExtractability, desc: 'How well AI can read your pages',
                    fixes: aiVis.contentExtractability < 70 ? [
                      'Use semantic HTML elements (<article>, <main>, <nav>, <header>) instead of generic <div> containers',
                      'Add alt text to all images — AI crawlers rely on this to understand visual content',
                      'Ensure headings follow a logical hierarchy (h1 > h2 > h3) on every page',
                      'Move critical content out of iframes, canvas elements, and dynamically-loaded modals',
                    ] : [] },
                  { label: 'Crawl infrastructure', value: aiVis.crawlInfrastructure, desc: 'robots.txt, llms.txt, ai-plugin.json',
                    fixes: aiVis.crawlInfrastructure < 70 ? [
                      'Create a robots.txt that explicitly allows AI crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot)',
                      'Add an llms.txt file at your domain root with a summary of your site and key pages',
                      'Ensure your sitemap.xml is referenced in robots.txt and lists all important pages',
                      'Check the Fix playbooks section below for ready-to-use templates',
                    ] : [] },
                ];
                return (
                  <div className="bg-card border border-rule/30 rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Brain size={16} className="text-signal" />
                      <h3 className="text-sm font-heading font-semibold text-ink">AI visibility score</h3>
                      <span className="ml-auto text-lg font-heading font-bold text-ink">{aiVis.overall}<span className="text-sm text-m-muted font-normal">/100</span></span>
                    </div>
                    <div className="space-y-3">
                      {bars.map((bar, bi) => (
                        <div key={bi}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-m-muted">{bar.label}</span>
                            <span className="text-xs font-semibold text-ink">{bar.value}</span>
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
                          {bar.fixes.length > 0 && (
                            <div className="mt-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5">
                              <p className="text-[11px] font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                                <Lightbulb size={11} className="text-emerald-600 dark:text-emerald-400" />
                                How to improve
                              </p>
                              <ul className="space-y-1">
                                {bar.fixes.map((fix, fi) => (
                                  <li key={fi} className="text-[11px] text-ink-2 leading-relaxed flex items-start gap-1.5">
                                    <ArrowRight size={9} className="text-ok flex-shrink-0 mt-[3px]" />
                                    {fix}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Structured Data Health — detected vs missing */}
              {(() => {
                // Collect all structured data types from all pages
                const allSdTypes: string[] = [];
                for (const page of auditPages) {
                  const r = page.ai_readability as any;
                  if (r?.structuredDataTypes) {
                    for (const t of r.structuredDataTypes) {
                      if (!allSdTypes.includes(t)) allSdTypes.push(t);
                    }
                  }
                }
                // Also check from raw_json head tags
                const rawHeadTags = (report.raw_json as any)?.headTags;
                if (rawHeadTags) {
                  const entries = Array.isArray(rawHeadTags) ? rawHeadTags : [rawHeadTags];
                  for (const entry of entries) {
                    const jsonLd = entry?.jsonLd || entry?.headTags?.jsonLd;
                    if (jsonLd && Array.isArray(jsonLd)) {
                      for (const item of jsonLd) {
                        if (item['@graph'] && Array.isArray(item['@graph'])) {
                          for (const g of item['@graph']) {
                            const types = Array.isArray(g['@type']) ? g['@type'] : [g['@type']];
                            for (const t of types) if (t && !allSdTypes.includes(String(t))) allSdTypes.push(String(t));
                          }
                        }
                        if (item['@type']) {
                          const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
                          for (const t of types) if (t && !allSdTypes.includes(String(t))) allSdTypes.push(String(t));
                        }
                      }
                    }
                  }
                }
                const recommended = ['Organization', 'WebSite', 'BreadcrumbList', 'FAQPage', 'Product', 'LocalBusiness', 'Article'];
                const hasLlmsTxt = (report.raw_json as any)?.aiDiscovery?.summary?.hasLlmsTxt || false;
                const hasRobotsTxt = (report.raw_json as any)?.aiDiscovery?.summary?.hasRobotsTxt || false;
                const hasAiPlugin = (report.raw_json as any)?.aiDiscovery?.summary?.hasAiPlugin || false;
                if (allSdTypes.length === 0 && !hasLlmsTxt && !hasRobotsTxt) return null;
                return (
                  <div className="bg-card border border-rule/30 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-rule/30 flex items-center gap-2">
                      <FileSearch size={16} className="text-signal" />
                      <h3 className="text-sm font-heading font-semibold text-ink">AI infrastructure health</h3>
                      <span className="ml-auto text-xs text-m-muted font-medium">{allSdTypes.length} types detected</span>
                    </div>
                    <div className="p-5">
                      {/* Discovery files */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                          { label: 'robots.txt', found: hasRobotsTxt,
                            fix: 'Create a robots.txt file at your domain root that allows AI crawlers. See the Fix playbooks section below for a ready-to-use template.' },
                          { label: 'llms.txt', found: hasLlmsTxt,
                            fix: 'Create an llms.txt file at your domain root (/llms.txt) with a markdown summary of your site, key pages, and contact info. See Fix playbooks below for a pre-filled template.' },
                          { label: 'ai-plugin.json', found: hasAiPlugin,
                            fix: 'Create a /.well-known/ai-plugin.json file to help AI assistants discover your site\'s API and capabilities. This follows the OpenAI plugin manifest standard.' },
                        ].map(f => (
                          <div key={f.label} className="flex flex-col">
                            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${f.found ? 'border-ok/20 bg-ok/5' : 'border-rule/30 bg-paper'}`}>
                              {f.found ? <CheckCircle2 size={13} className="text-ok flex-shrink-0" /> : <AlertTriangle size={13} className="text-m-muted flex-shrink-0" />}
                              <span className={`text-[12px] font-medium ${f.found ? 'text-ok' : 'text-m-muted'}`}>{f.label}</span>
                            </div>
                            {!f.found && (
                              <p className="text-[10px] text-ink-2 leading-relaxed mt-1.5 px-1">{f.fix}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Structured data types */}
                      <p className="text-[11px] font-semibold text-m-muted uppercase tracking-wide mb-2">Structured data (JSON-LD)</p>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {allSdTypes.map(t => (
                          <span key={t} className="inline-flex items-center gap-1 text-[11px] font-medium text-ok bg-ok/10 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={9} /> {t}
                          </span>
                        ))}
                      </div>
                      {/* Recommended but missing */}
                      {(() => {
                        const missingRec = recommended.filter(r => !allSdTypes.some(t => t.toLowerCase() === r.toLowerCase()));
                        if (missingRec.length === 0) return null;
                        const typeFixMap: Record<string, string> = {
                          'Organization': 'Add to your homepage <head>. Tells AI your brand name, logo, URL, and social profiles.',
                          'WebSite': 'Add to your homepage <head>. Enables sitelinks search box and helps AI understand your site structure.',
                          'BreadcrumbList': 'Add to inner pages. Shows the navigation path (Home > Section > Page) to AI and search engines.',
                          'FAQPage': 'Add to any page with Q&A content. Helps AI surface your answers directly in search results.',
                          'Product': 'Add to product pages. Includes name, price, availability, and reviews for rich results.',
                          'LocalBusiness': 'Add to your homepage if you have a physical location. Includes address, hours, and contact info.',
                          'Article': 'Add to blog posts and articles. Includes author, date, headline for news and article rich results.',
                        };
                        return (
                          <>
                            <p className="text-[11px] font-semibold text-m-muted uppercase tracking-wide mb-2 mt-3">Recommended (not found)</p>
                            <div className="space-y-2">
                              {missingRec.map(t => (
                                <div key={t} className="flex items-start gap-2.5 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5">
                                  <Lightbulb size={12} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-[1px]" />
                                  <div className="min-w-0">
                                    <span className="text-[11px] font-semibold text-ink">{t}</span>
                                    <p className="text-[10px] text-ink-2 leading-relaxed mt-0.5">{typeFixMap[t] || 'Add this structured data type to improve AI understanding of your content.'}</p>
                                    {fixPlaybooks.some((pb: any) => pb.title?.toLowerCase().includes(t.toLowerCase())) && (
                                      <p className="text-[10px] text-signal font-medium mt-1 flex items-center gap-1">
                                        <ArrowDown size={9} />
                                        Ready-to-use code available in Fix playbooks below
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}

              {/* LLM Probe Results — What AI knows about your site */}
              {llmProbeResults.length > 0 && (
                <div className="bg-card border border-rule/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-rule/30 flex items-center gap-2">
                    <Brain size={16} className="text-signal" />
                    <h3 className="text-sm font-heading font-semibold text-ink">What AI knows about your site</h3>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-m-muted font-medium">{llmProbeResults.length} questions</span>
                      <button
                        onClick={() => {
                          const lines: string[] = [`What AI knows about your site — ${audit.product_url || 'Unknown'}\n`];
                          const successful = (llmProbeResults as any[]).filter(p => !p.answer?.startsWith('[Probe failed'));
                          const failed = (llmProbeResults as any[]).filter(p => p.answer?.startsWith('[Probe failed'));
                          const accurateCount = successful.filter(p => p.accuracy === 'accurate').length;
                          const partialCount = successful.filter(p => p.accuracy === 'partial').length;
                          const inaccurateCount = successful.filter(p => p.accuracy === 'inaccurate' || p.accuracy === 'hallucinated').length;
                          if (successful.length > 0) {
                            lines.push(`Summary: ${accurateCount} correct, ${partialCount} partially correct, ${inaccurateCount} incorrect out of ${successful.length} questions\n`);
                            for (const p of successful) {
                              const gradeLabel = p.accuracy === 'accurate' ? 'Correct' : p.accuracy === 'partial' ? 'Partially correct' : p.accuracy === 'hallucinated' ? 'Fabricated' : p.accuracy === 'inaccurate' ? 'Incorrect' : p.accuracy === 'no_data' ? 'No data' : 'Pending';
                              lines.push(`Q: ${p.question}`);
                              lines.push(`A: ${p.answer}`);
                              lines.push(`Grade: ${gradeLabel}${p.accuracy_note ? ` — ${p.accuracy_note}` : ''}\n`);
                            }
                          }
                          if (failed.length > 0) lines.push(`Note: ${failed.length} probe(s) failed. Re-run the audit to retry.\n`);
                          copySection('probes', lines.join('\n'));
                        }}
                        className={clsx(
                          'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition-colors',
                          copiedSection === 'probes' ? 'text-ok bg-ok/5 border-ok/20' : 'text-m-muted bg-paper border-rule hover:bg-paper-2 hover:text-ink',
                        )}
                      >
                        {copiedSection === 'probes' ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                      </button>
                    </span>
                  </div>
                  <div className="divide-y divide-rule/20">
                    {llmProbeResults.map((probe: any, i: number) => {
                      const accColor = probe.accuracy === 'accurate' ? 'text-ok bg-ok/10'
                        : probe.accuracy === 'partial' ? 'text-warn bg-warn/10'
                        : probe.accuracy === 'hallucinated' ? 'text-severe bg-severe/10'
                        : probe.accuracy === 'inaccurate' ? 'text-severe bg-severe/10'
                        : probe.accuracy === 'no_data' ? 'text-m-muted bg-paper-2'
                        : 'text-m-muted bg-paper-2';
                      const accLabel = probe.accuracy === 'accurate' ? 'Correct'
                        : probe.accuracy === 'partial' ? 'Partial'
                        : probe.accuracy === 'hallucinated' ? 'Fabricated'
                        : probe.accuracy === 'inaccurate' ? 'Incorrect'
                        : probe.accuracy === 'no_data' ? 'No data'
                        : 'Pending';
                      return (
                        <div key={i} className="px-5 py-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className="text-[13px] font-medium text-ink">{probe.question}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${accColor}`}>
                              {accLabel}
                            </span>
                          </div>
                          <p className="text-[13px] text-ink-2 leading-[1.7]">{probe.answer}</p>
                          {probe.accuracy_note && (
                            <p className="text-[11px] text-m-muted mt-1.5">{probe.accuracy_note}</p>
                          )}
                          {(probe.accuracy === 'inaccurate' || probe.accuracy === 'hallucinated' || probe.accuracy === 'partial') && (
                            <div className="mt-2.5 rounded-lg border border-rule bg-card px-3 py-2">
                              <p className="text-[11px] font-semibold text-ink mb-1 flex items-center gap-1.5">
                                <Lightbulb size={11} className="text-signal" />
                                How to fix this
                              </p>
                              <p className="text-[11px] text-ink-2 leading-relaxed">
                                {probe.accuracy === 'hallucinated'
                                  ? 'AI is making up information about your site. Add explicit, factual content to your homepage and key pages that directly answers this question. Use JSON-LD structured data (Organization, WebSite) to provide authoritative facts that AI models will reference instead of guessing.'
                                  : probe.accuracy === 'inaccurate'
                                  ? 'AI has outdated or wrong information. Update your meta description and page content to clearly state the correct answer. Adding structured data (JSON-LD) gives AI models a machine-readable source of truth that takes priority over inferred content.'
                                  : 'AI has partial knowledge. Expand your content to fully answer this question — add it to your homepage, about page, or FAQ. Structured data and an llms.txt file help AI models find complete, accurate information about your site.'
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Citation Audit — What gets cited vs. ignored */}
              {aiCitations.length > 0 && (
                <div className="bg-card border border-rule/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-rule/30 flex items-center gap-2">
                    <FileSearch size={16} className="text-signal" />
                    <h3 className="text-sm font-heading font-semibold text-ink">AI citation audit</h3>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-m-muted font-medium">
                        {aiCitations.filter((c: any) => c.citation_type !== 'ignored').length} cited / {aiCitations.filter((c: any) => c.citation_type === 'ignored').length} ignored
                      </span>
                      <button
                        onClick={() => {
                          const lines: string[] = [`AI citation audit — ${audit.product_url || 'Unknown'}\n`];
                          const direct = (aiCitations as any[]).filter(c => c.citation_type === 'direct_quote');
                          const ignored = (aiCitations as any[]).filter(c => c.citation_type === 'ignored');
                          lines.push(`Found ${direct.length} direct citations and ${ignored.length} ignored pages\n`);
                          for (const c of aiCitations as any[]) {
                            const typeLabel = c.citation_type === 'direct_quote' ? 'Cited' : c.citation_type === 'ignored' ? 'Ignored' : c.citation_type;
                            lines.push(`[${typeLabel}] ${c.ai_context}${c.page_url ? ` (${c.page_url})` : ''}`);
                          }
                          copySection('citations', lines.join('\n'));
                        }}
                        className={clsx(
                          'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition-colors',
                          copiedSection === 'citations' ? 'text-ok bg-ok/5 border-ok/20' : 'text-m-muted bg-paper border-rule hover:bg-paper-2 hover:text-ink',
                        )}
                      >
                        {copiedSection === 'citations' ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                      </button>
                    </span>
                  </div>
                  <div className="divide-y divide-rule/20">
                    {aiCitations.map((cit: any, i: number) => (
                      <div key={i} className="px-5 py-3">
                        <div className="flex items-start gap-3">
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
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                            cit.citation_type === 'direct_quote' ? 'text-ok bg-ok/10' :
                            cit.citation_type === 'paraphrase' ? 'text-signal bg-signal/10' :
                            cit.citation_type === 'ignored' ? 'text-warn bg-warn/10' :
                            'text-m-muted bg-paper-2'
                          }`}>
                            {cit.citation_type}
                          </span>
                        </div>
                        {cit.citation_type === 'ignored' && (
                          <div className="mt-2 ml-[25px] rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                            <p className="text-[11px] text-ink-2 leading-relaxed flex items-start gap-1.5">
                              <Lightbulb size={10} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-[2px]" />
                              This page is not being cited by AI. Improve its visibility by adding a clear meta description, structured data (JSON-LD), and ensuring the content is in semantic HTML — not hidden in JavaScript or iframes.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fix Playbooks — Copy-paste code snippets */}
              {fixPlaybooks.length > 0 && (
                <div className="bg-card border-2 border-signal/30 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-signal/20 bg-signal/[0.03] flex items-center gap-2">
                    <Zap size={16} className="text-signal" />
                    <h3 className="text-sm font-heading font-semibold text-ink">Fix playbooks</h3>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-m-muted font-medium">{fixPlaybooks.length} snippets</span>
                      <button
                        onClick={() => {
                          const lines: string[] = [`Fix playbooks — ${audit.product_url || 'Unknown'}\n`];
                          lines.push('Copy and paste these code snippets into your site to improve AI visibility.\n');
                          for (const pb of fixPlaybooks as any[]) {
                            lines.push(`### ${pb.title}`);
                            if (pb.description) lines.push(pb.description);
                            lines.push(`\`\`\`${pb.playbook_type === 'json_ld' || pb.playbook_type === 'meta_tags' ? 'html' : pb.playbook_type === 'llms_txt' ? 'markdown' : ''}`);
                            lines.push(pb.code_snippet);
                            lines.push('```\n');
                          }
                          copySection('playbooks', lines.join('\n'));
                        }}
                        className={clsx(
                          'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition-colors',
                          copiedSection === 'playbooks' ? 'text-ok bg-ok/5 border-ok/20' : 'text-m-muted bg-paper border-rule hover:bg-paper-2 hover:text-ink',
                        )}
                      >
                        {copiedSection === 'playbooks' ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy all</>}
                      </button>
                    </span>
                  </div>
                  <div className="divide-y divide-rule/20">
                    {fixPlaybooks.map((pb: any, i: number) => {
                      const downloadName = pb.playbook_type === 'json_ld' ? `${pb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}.jsonld`
                        : pb.playbook_type === 'llms_txt' ? 'llms.txt'
                        : pb.playbook_type === 'robots_txt' ? 'robots.txt'
                        : pb.playbook_type === 'meta_tags' ? 'meta-tags.html'
                        : `${pb.playbook_type}.txt`;
                      const downloadContent = pb.playbook_type === 'json_ld'
                        ? pb.code_snippet.replace(/^<!--.*?-->\n?/gm, '').replace(/<\/?script[^>]*>\n?/g, '').trim()
                        : pb.code_snippet;
                      return (
                        <div key={i} className="px-5 py-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold text-signal bg-signal/10 px-2 py-0.5 rounded-full">{pb.playbook_type}</span>
                            <h4 className="text-sm font-medium text-ink">{pb.title}</h4>
                          </div>
                          {pb.description && (
                            <p className="text-xs text-m-muted mb-3">{pb.description}</p>
                          )}
                          <div className="relative">
                            <pre className="bg-paper-2 border border-rule/30 rounded-lg p-4 pr-20 text-xs font-mono text-ink-2 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                              {pb.code_snippet}
                            </pre>
                            <div className="absolute top-2 right-2 flex gap-1">
                              <button
                                onClick={() => {
                                  const blob = new Blob([downloadContent], { type: 'text/plain' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = downloadName;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="p-1.5 rounded bg-card border border-rule/30 text-m-muted hover:text-ink transition-colors"
                                title={`Download as ${downloadName}`}
                              >
                                <Download size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(pb.code_snippet);
                                }}
                                className="p-1.5 rounded bg-card border border-rule/30 text-m-muted hover:text-ink transition-colors"
                                title="Copy to clipboard"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

          {/* ═══════════════════════════════════════════════════════
              INTELLIGENCE TAB
              ═══════════════════════════════════════════════════════ */}
          {activeTab === 'intelligence' && (() => {
            const probes = intelligenceData?.modelProbes || [];
            const hasProbes = probes.length > 0;
            const bench = intelligenceData?.benchmarkPosition;
            const recs = intelligenceData?.recommendations || [];
            const avgAccuracy = intelligenceData?.modelBenchmarks?.averageAccuracy ?? (hasProbes ? Math.round(probes.reduce((s: number, p: any) => s + (p.accuracy_score || 0), 0) / probes.length) : null);
            const totalHallucinated = probes.reduce((s: number, p: any) => s + (p.hallucinated_count || 0), 0);
            const totalQuestions = probes.reduce((s: number, p: any) => s + (p.results_json?.length || 0), 0);

            const accuracyVerdict = avgAccuracy == null
              ? null
              : avgAccuracy >= 70 ? { label: 'AI represents your site accurately', tone: 'ok' as const }
              : avgAccuracy >= 40 ? { label: 'AI is partially accurate about your site', tone: 'warn' as const }
              : { label: "AI doesn't know your site well", tone: 'severe' as const };

            const hasAny = hasProbes || recs.length > 0 || bench;

            return (
              <div className="space-y-5">
                {/* Compact intro */}
                <div className="rounded-xl border border-rule bg-card p-4 flex items-start gap-3">
                  <Sparkles size={15} className="text-m-muted flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-semibold text-ink mb-0.5">AI & competitive intelligence</h3>
                    <p className="text-[12px] text-m-muted leading-relaxed">How AI models represent your site, how you compare to your industry, and the actions most likely to move your score.</p>
                  </div>
                </div>

                {/* Bottom line — synthesized verdict + next move (only when data supports it) */}
                {hasAny && (accuracyVerdict || bench || recs.length > 0) && (
                  <div className="rounded-xl border border-rule bg-card overflow-hidden">
                    <div className="px-5 py-3 border-b border-rule/40 flex items-center gap-2">
                      <Lightbulb size={15} className="text-signal" />
                      <h3 className="text-[13px] font-semibold text-ink">Bottom line</h3>
                    </div>
                    <div className="px-5 py-4 space-y-2.5">
                      {accuracyVerdict && (
                        <p className="text-[13px] text-ink leading-relaxed">
                          <span className={`font-semibold ${accuracyVerdict.tone === 'ok' ? 'text-ok' : accuracyVerdict.tone === 'warn' ? 'text-warn' : 'text-severe'}`}>{accuracyVerdict.label}.</span>
                          {' '}
                          <span className="text-m-muted">
                            Average accuracy across {probes.length} model{probes.length !== 1 ? 's' : ''} is {avgAccuracy}%
                            {totalHallucinated > 0 && `, with ${totalHallucinated} fabricated answer${totalHallucinated !== 1 ? 's' : ''}`}.
                          </span>
                        </p>
                      )}
                      {bench && (
                        <p className="text-[13px] text-ink leading-relaxed">
                          <span className="font-semibold">{bench.rankLabel}</span>
                          <span className="text-m-muted"> among {intelligenceData.industry} sites — score {bench.userScore} vs. industry average {bench.benchmark.avgScore} ({bench.deltaFromAvg >= 0 ? '+' : ''}{bench.deltaFromAvg}).</span>
                        </p>
                      )}
                      {recs.length > 0 && (
                        <p className="text-[13px] text-ink leading-relaxed">
                          <span className="font-semibold">Top next move:</span>
                          <span className="text-m-muted"> {recs[0].action} <span className="text-ok font-semibold">+{recs[0].predicted_impact}</span> projected impact.</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* AI model accuracy — only when probes exist */}
                {hasProbes && (
                  <div className="rounded-xl border border-rule bg-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-rule/40 flex items-center gap-2">
                      <BarChart3 size={15} className="text-m-muted" />
                      <h3 className="text-[13px] font-semibold text-ink">How accurately AI describes your site</h3>
                      <span className="ml-auto text-[11px] text-m-muted">{probes.length} model{probes.length !== 1 ? 's' : ''}{totalQuestions > 0 && ` · ${totalQuestions} questions`}</span>
                    </div>
                    <div className="p-5">
                      {intelligenceData.modelBenchmarks?.insight && (
                        <p className="text-[12px] text-m-muted mb-4 leading-relaxed">{intelligenceData.modelBenchmarks.insight}</p>
                      )}
                      <div className={`grid gap-3 ${probes.length === 1 ? 'sm:grid-cols-1' : probes.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                        {probes.map((probe: any) => {
                          const sc = probe.accuracy_score >= 70 ? 'text-ok' : probe.accuracy_score >= 40 ? 'text-warn' : 'text-severe';
                          const barColor = probe.accuracy_score >= 70 ? 'bg-ok' : probe.accuracy_score >= 40 ? 'bg-warn' : 'bg-severe';
                          return (
                            <div key={probe.id} className="rounded-lg border border-rule bg-paper p-4">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-[13px] font-semibold text-ink">{probe.model_label}</span>
                                <span className={`text-[18px] font-bold ${sc}`}>{probe.accuracy_score}%</span>
                              </div>
                              <div className="w-full h-1 rounded-full bg-paper-2 mb-3 overflow-hidden">
                                <div className={`h-full ${barColor} transition-all`} style={{ width: `${probe.accuracy_score}%` }} />
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-m-muted">
                                {probe.accurate_count > 0 && <span><span className="font-semibold text-ink">{probe.accurate_count}</span> correct</span>}
                                {probe.partial_count > 0 && <span><span className="font-semibold text-ink">{probe.partial_count}</span> partial</span>}
                                {((probe.inaccurate_count || 0) + (probe.hallucinated_count || 0)) > 0 && (
                                  <span><span className="font-semibold text-ink">{(probe.inaccurate_count || 0) + (probe.hallucinated_count || 0)}</span> wrong</span>
                                )}
                              </div>
                              {probe.results_json?.length > 0 && (
                                <details className="mt-3">
                                  <summary className="text-[11px] text-m-muted cursor-pointer hover:text-ink font-medium">View questions and answers</summary>
                                  <div className="mt-2 space-y-3 pt-2 border-t border-rule/30">
                                    {probe.results_json.map((r: any, j: number) => {
                                      const label = r.accuracy === 'accurate' ? 'Correct' : r.accuracy === 'partial' ? 'Partial' : r.accuracy === 'hallucinated' ? 'Fabricated' : r.accuracy === 'inaccurate' ? 'Wrong' : r.accuracy === 'no_data' ? 'No data' : 'Pending';
                                      const tone = r.accuracy === 'accurate' ? 'text-ok' : r.accuracy === 'partial' ? 'text-warn' : r.accuracy === 'hallucinated' || r.accuracy === 'inaccurate' ? 'text-severe' : 'text-m-muted';
                                      return (
                                        <div key={j} className="text-[11px]">
                                          <p className="font-medium text-ink">{r.question}</p>
                                          <p className="text-m-muted mt-1 leading-relaxed">{r.answer}</p>
                                          <span className={`inline-block mt-1 text-[10px] font-semibold uppercase tracking-[0.03em] ${tone}`}>{label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* What to do — only when accuracy is low and we have probes */}
                      {avgAccuracy != null && avgAccuracy < 40 && (
                        <div className="mt-5 p-4 rounded-lg border border-rule bg-paper">
                          <p className="text-[12px] font-semibold text-ink mb-2">What this means and what to do</p>
                          <p className="text-[12px] text-m-muted leading-relaxed mb-3">
                            {totalHallucinated > 0
                              ? 'AI assistants are fabricating answers about your site. Users asking ChatGPT or similar about you will get wrong information.'
                              : 'AI models lack reliable information about your site. Users relying on AI for research will not learn about you accurately.'}
                          </p>
                          <ol className="space-y-1.5 text-[12px] text-ink-2 leading-relaxed list-decimal list-inside">
                            <li>Add JSON-LD structured data (Organization + WebSite schema) to the homepage.</li>
                            <li>Publish an <code className="text-[11px] bg-paper-2 px-1 py-0.5 rounded">llms.txt</code> at the domain root describing the product clearly.</li>
                            <li>Make sure the homepage explicitly answers: what you are, what you offer, what makes you different.</li>
                            <li>Build external presence — directories, reviews, press — so AI models have references to learn from.</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Industry benchmark — muted palette */}
                {bench && (
                  <div className="rounded-xl border border-rule bg-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-rule/40 flex items-center gap-2">
                      <TrendingUp size={15} className="text-m-muted" />
                      <h3 className="text-[13px] font-semibold text-ink">How you compare in your industry</h3>
                      <span className="ml-auto text-[11px] font-medium text-m-muted">{intelligenceData.industry}</span>
                    </div>
                    <div className="p-5">
                      <div className="grid gap-3 sm:grid-cols-3 mb-4">
                        <div className="text-center p-4 rounded-lg border border-rule bg-paper">
                          <div className={`text-[22px] font-bold ${scoreColor(bench.userScore)}`}>{bench.userScore}</div>
                          <div className="text-[11px] font-medium text-m-muted mt-1">Your score</div>
                        </div>
                        <div className="text-center p-4 rounded-lg border border-rule bg-paper">
                          <div className="text-[22px] font-bold text-ink">{bench.benchmark.avgScore}</div>
                          <div className="text-[11px] font-medium text-m-muted mt-1">Industry average</div>
                        </div>
                        <div className="text-center p-4 rounded-lg border border-rule bg-paper">
                          {(() => {
                            const delta = bench.deltaFromAvg;
                            const color = delta > 0 ? 'text-ok' : delta < 0 ? 'text-severe' : 'text-m-muted';
                            const sign = delta > 0 ? '+' : '';
                            return (
                              <>
                                <div className={`text-[22px] font-bold ${color}`}>{sign}{delta}</div>
                                <div className="text-[11px] font-medium text-m-muted mt-1">vs. average</div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-[11px] font-semibold uppercase tracking-[0.03em] ${
                          bench.percentile >= 75 ? 'text-ok'
                            : bench.percentile >= 50 ? 'text-warn'
                              : 'text-severe'
                        }`}>{bench.rankLabel}</span>
                        <span className="text-[11px] text-m-muted">among {bench.comparedAgainst || `${intelligenceData.industry} sites`}</span>
                      </div>
                      <p className="text-[12px] text-ink-2 leading-relaxed">{bench.insight}</p>
                      {bench.benchmark.sampleSize > 0 && (
                        <p className="text-[10px] text-m-muted/70 mt-2">Based on {bench.benchmark.sampleSize} audited sites in {intelligenceData.industry}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Actionable recommendations */}
                {recs.length > 0 && (
                  <div className="rounded-xl border border-rule bg-card overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-rule/40 flex items-center gap-2">
                      <Lightbulb size={15} className="text-m-muted" />
                      <h3 className="text-[13px] font-semibold text-ink">Predicted next actions</h3>
                      <span className="ml-auto text-[11px] text-m-muted font-medium">{recs.length} action{recs.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="px-5 py-2.5 border-b border-rule/20 bg-paper/40">
                      <p className="text-[11px] text-m-muted leading-relaxed">
                        Ranked by predicted score lift based on patterns from comparable audits.
                      </p>
                    </div>
                    <div className="divide-y divide-rule/30">
                      {recs.map((rec: any, i: number) => (
                        <div key={rec.id || i} className="px-5 py-3.5">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center bg-paper border border-rule">
                              <span className="text-[12px] font-bold text-ok">+{rec.predicted_impact}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-ink leading-snug">{rec.action}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className={`text-[10px] font-semibold uppercase tracking-[0.03em] ${
                                  rec.confidence === 'high' ? 'text-ok' : rec.confidence === 'medium' ? 'text-warn' : 'text-m-muted'
                                }`}>
                                  {rec.confidence === 'high' ? 'High confidence' : rec.confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}
                                </span>
                                {rec.category && <span className="text-[10px] text-m-muted">· {rec.category}</span>}
                              </div>
                              {rec.evidence && (
                                <p className="text-[12px] text-m-muted mt-1.5 leading-relaxed">{rec.evidence}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Honest "not captured" notes when individual sections are missing */}
                {hasAny && (!hasProbes || !bench || recs.length === 0) && (
                  <div className="rounded-xl border border-rule bg-paper-2 px-5 py-3.5">
                    <p className="text-[11px] font-semibold text-ink mb-1">Some intelligence sections aren't available for this audit</p>
                    <ul className="text-[11px] text-m-muted space-y-0.5">
                      {!hasProbes && <li>· Multi-model AI accuracy probes were not run.</li>}
                      {!bench && <li>· Industry benchmark position is not available yet.</li>}
                      {recs.length === 0 && <li>· No predictive recommendations were generated.</li>}
                    </ul>
                    <p className="text-[11px] text-m-muted mt-2">Re-run the audit (or use Dig Deeper) to capture missing sections.</p>
                  </div>
                )}

                {/* Empty state */}
                {!hasAny && (
                  <div className="rounded-xl border border-rule bg-card text-center py-12 px-6">
                    <Sparkles size={28} className="mx-auto text-m-muted/50 mb-3" />
                    <p className="text-[13px] font-medium text-ink">No intelligence data captured yet</p>
                    <p className="text-[12px] text-m-muted mt-1 max-w-sm mx-auto">Once captured, this tab compares how AI models represent your site, benchmarks you against your industry, and ranks the next actions most likely to lift your score.</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Bottom action bar — only on Summary/Overview tab ── */}
          {(activeTab === 'overview' || activeTab === 'summary') && <div className="mt-8 mb-4">
            <div className="rounded-xl border border-rule bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-rule/40 flex items-center gap-2">
                <Download size={14} className="text-signal" />
                <h3 className="text-sm font-heading font-semibold text-ink">Actions</h3>
              </div>
              <div className="flex flex-wrap gap-2.5 px-5 py-4">
                <a
                  href={`/api/reports/${auditId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-[13px] font-semibold text-ink bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors whitespace-nowrap"
                >
                  <Download size={14} strokeWidth={2} /> PDF Report
                </a>
                <a
                  href={`/api/reports/${auditId}/docx`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-[13px] font-semibold text-ink bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors whitespace-nowrap"
                >
                  <Download size={14} strokeWidth={2} /> Word Report
                </a>
                <Link
                  href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                  className="flex items-center justify-center gap-2 text-[13px] font-semibold text-ink bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors whitespace-nowrap"
                >
                  <RefreshCw size={14} strokeWidth={2} /> Re-audit
                </Link>
                <Link
                  href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                  className="flex items-center justify-center gap-2 text-[13px] font-semibold text-signal bg-signal/5 border border-signal/20 rounded-lg px-4 py-2.5 hover:bg-signal/10 transition-colors whitespace-nowrap"
                >
                  <Search size={14} strokeWidth={2} /> Dig deeper
                </Link>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="flex items-center justify-center gap-2 text-[13px] font-semibold text-ink bg-paper border border-rule rounded-lg px-4 py-2.5 hover:bg-paper-2 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {shareCopied ? <><Check size={14} strokeWidth={2} className="text-ok" /> Copied</> : <><Share2 size={14} strokeWidth={2} /> Share</>}
                </button>
              </div>
              <div className="px-5 py-3 border-t border-rule/30 bg-paper-2/30">
                <p className="text-[11px] text-m-muted">1 credit per audit</p>
                {shareUrl && (
                  <p className="text-[11px] text-m-muted mt-0.5">
                    Share link: <span className="font-mono text-signal">{shareUrl}</span>
                  </p>
                )}
              </div>
            </div>
          </div>}
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
