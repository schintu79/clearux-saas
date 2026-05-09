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

/* Pillar visual config — names come from translations at render time */
const PILLAR_STYLE = [
  {
    color: 'violet',
    gradient: 'from-[#6366F1] to-[#5A4A84]',
    gradientSubtle: 'from-[#6366F1]/5 to-[#6366F1]/10 dark:from-[#6366F1]/10 dark:to-[#6366F1]/5',
    border: 'border-[#6366F1]/20 dark:border-[#6366F1]/15',
    iconBg: 'bg-[#6366F1]/10',
    iconColor: 'text-[#6366F1]',
    badgeBg: 'bg-[#6366F1]',
    scoreBg: 'bg-[#6366F1]',
    range: [0, 4] as [number, number],
  },
  {
    color: 'pink',
    gradient: 'from-pink-500 to-pink-600',
    gradientSubtle: 'from-pink-50 to-pink-100/50 dark:from-pink-950/30 dark:to-pink-900/10',
    border: 'border-pink-200 dark:border-pink-800/40',
    iconBg: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
    badgeBg: 'bg-pink-500',
    scoreBg: 'bg-pink-500',
    range: [4, 8] as [number, number],
  },
  {
    color: 'amber',
    gradient: 'from-amber-500 to-amber-600',
    gradientSubtle: 'from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10',
    border: 'border-amber-200 dark:border-amber-800/40',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    badgeBg: 'bg-amber-500',
    scoreBg: 'bg-amber-500',
    range: [8, 12] as [number, number],
  },
  {
    color: 'emerald',
    gradient: 'from-[#22C55E] to-[#236B43]',
    gradientSubtle: 'from-[#22C55E]/5 to-[#22C55E]/10 dark:from-[#22C55E]/10 dark:to-[#22C55E]/5',
    border: 'border-[#22C55E]/20 dark:border-[#22C55E]/15',
    iconBg: 'bg-[#22C55E]/10',
    iconColor: 'text-[#22C55E]',
    badgeBg: 'bg-[#22C55E]',
    scoreBg: 'bg-[#22C55E]',
    range: [12, 16] as [number, number],
  },
  {
    color: 'cyan',
    gradient: 'from-[#06B6D4] to-[#0E7490]',
    gradientSubtle: 'from-[#06B6D4]/5 to-[#06B6D4]/10 dark:from-[#06B6D4]/10 dark:to-[#06B6D4]/5',
    border: 'border-[#06B6D4]/20 dark:border-[#06B6D4]/15',
    iconBg: 'bg-[#06B6D4]/10',
    iconColor: 'text-[#06B6D4]',
    badgeBg: 'bg-[#06B6D4]',
    scoreBg: 'bg-[#06B6D4]',
    range: [16, 20] as [number, number],
  },
  {
    color: 'rose',
    gradient: 'from-[#F43F5E] to-[#BE123C]',
    gradientSubtle: 'from-[#F43F5E]/5 to-[#F43F5E]/10 dark:from-[#F43F5E]/10 dark:to-[#F43F5E]/5',
    border: 'border-[#F43F5E]/20 dark:border-[#F43F5E]/15',
    iconBg: 'bg-[#F43F5E]/10',
    iconColor: 'text-[#F43F5E]',
    badgeBg: 'bg-[#F43F5E]',
    scoreBg: 'bg-[#F43F5E]',
    range: [20, 24] as [number, number],
  },
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
      bg: 'bg-card',
      border: 'border-border/40 dark:border-white/[0.06]',
      dot: 'bg-red-500',
      text: 'text-red-600 dark:text-red-400',
      impactBg: 'bg-red-50 dark:bg-red-950/20',
    },
    high: {
      badge: 'failed' as const,
      label: L.severityHigh,
      bg: 'bg-card',
      border: 'border-border/40 dark:border-white/[0.06]',
      dot: 'bg-orange-500',
      text: 'text-orange-600 dark:text-orange-400',
      impactBg: 'bg-orange-50 dark:bg-orange-950/20',
    },
    medium: {
      badge: 'pending' as const,
      label: L.severityMedium,
      bg: 'bg-card',
      border: 'border-border/40 dark:border-white/[0.06]',
      dot: 'bg-yellow-500',
      text: 'text-yellow-600 dark:text-yellow-500',
      impactBg: 'bg-yellow-50 dark:bg-yellow-950/20',
    },
    low: {
      badge: 'active' as const,
      label: L.severityLow,
      bg: 'bg-card',
      border: 'border-border/40 dark:border-white/[0.06]',
      dot: 'bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      impactBg: 'bg-blue-50 dark:bg-blue-950/20',
    },
  };
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-[#22C55E] dark:text-emerald-400';
  if (s >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-[#EF4444] dark:text-red-400';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-[#22C55E]';
  if (s >= 40) return 'bg-amber-500';
  return 'bg-red-500';
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
        className={`text-sm font-medium text-text transition-opacity duration-300 ${
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
    <div className="mb-6 rounded-xl border border-border/20 dark:border-white/[0.04] bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/15 dark:border-white/[0.03]">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-brand" />
          <h3 className="text-xs font-medium text-text">64-Checkpoint Health</h3>
          <span className="text-[11px] text-muted ml-auto">
            {findings.filter(f => !f.dismissed).length} issues across {categoryScores.length} categories
          </span>
        </div>
      </div>
      <div className="divide-y divide-border/10 dark:divide-white/[0.03]">
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
                className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-brand/5 dark:hover:bg-brand/[0.04] transition-colors text-left"
              >
                <span className={`text-[11px] font-medium w-6 text-right ${scoreColor(cat.score)}`}>{cat.score}</span>
                <span className="text-[11px] font-medium text-text flex-1 truncate">{cat.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {passCount > 0 && <span className="text-[11px] font-medium text-[#22C55E] dark:text-emerald-400">{passCount} pass</span>}
                  {failCount > 0 && <span className="text-[11px] font-medium text-red-500">{failCount} fail</span>}
                </div>
                <ChevronDown size={12} className={`text-muted flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && (
                <div className="px-5 pb-3 space-y-1.5">
                  {checkpoints.map((checkpoint, i) => {
                    const hasFinding = i < failCount;
                    const finding = hasFinding ? catFindings[i] : null;
                    return (
                      <div key={i} className={`flex items-start gap-2.5 py-1.5 px-3 rounded-lg ${hasFinding ? 'bg-red-50/40 dark:bg-red-900/[0.06]' : 'bg-[#22C55E]/5'}`}>
                        {hasFinding ? (
                          <AlertTriangle size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-medium ${hasFinding ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {checkpoint}
                          </p>
                          {finding && (
                            <p className="text-[11px] text-muted mt-0.5 line-clamp-1">{finding.title}</p>
                          )}
                        </div>
                        <span className={`text-[11px] font-medium flex-shrink-0 ${hasFinding ? 'text-red-500' : 'text-[#22C55E] dark:text-emerald-500'}`}>
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
function ScoreOverTime({ productUrl, currentAuditId }: { productUrl: string; currentAuditId: string }) {
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
          setTrend(d.trend);
          setImprovement(d.improvement || 0);
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
    <div className="mb-6 rounded-xl border border-border/30 dark:border-white/[0.06] bg-card overflow-hidden shadow-sm">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-off/30 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
          <TrendingUp size={14} className="text-brand" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-medium text-text">Score Over Time</span>
          <span className="text-[11px] text-muted ml-2">{trend.length} audits · {domain}</span>
        </div>
        {improvement !== 0 && (
          <span className={`text-xs font-medium ${improvement > 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {improvement > 0 ? '+' : ''}{improvement} pts
          </span>
        )}
        <ChevronDown size={14} className={`text-muted flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded chart */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/15 dark:border-white/[0.04]">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {/* Grid */}
            {gridScores.map((s, i) => {
              const y = PAD_T + chartH - ((s - minScore) / range) * chartH;
              return (
                <g key={i}>
                  <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
                  <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="8" fill="var(--muted)" fontFamily="var(--font-inter)">{s}</text>
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
                    fill={isHovered ? '#6366F1' : isCurrent ? '#6366F1' : 'var(--card)'}
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
                <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="7.5" fill="var(--muted)" fontFamily="var(--font-inter)">{label}</text>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

const FINDING_STATUSES = [
  { key: 'open', label: 'Open', color: 'text-muted', bg: 'bg-off', dot: 'bg-gray-400' },
  { key: 'in_progress', label: 'In Progress', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', dot: 'bg-amber-500' },
  { key: 'fixed', label: 'Fixed', color: 'text-[#22C55E] dark:text-emerald-400', bg: 'bg-[#22C55E]/8', dot: 'bg-[#22C55E]' },
  { key: 'backlog', label: 'Backlog', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500' },
] as const;

function FindingCard({ finding, pillarColor, categoryName, sevConfig, onScoreUpdate }: { finding: AuditFinding; pillarColor: string; categoryName?: string; sevConfig: ReturnType<typeof buildSeverityConfig>; onScoreUpdate?: () => void }) {
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
        // Refresh scores whenever status changes to/from "fixed"
        const involvesFixed = newStatus === 'fixed' || previousStatus === 'fixed';
        if (involvesFixed && onScoreUpdate) {
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
      <div className="rounded-xl border border-border/20 dark:border-white/[0.04] bg-off/30 dark:bg-white/[0.02] p-3 opacity-60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
          <span className="text-xs text-muted line-through flex-1">{finding.title}</span>
          <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">Dismissed</span>
        </div>
        {finding.dismissal_reason && (
          <p className="text-[11px] text-muted mt-1 ml-4">{finding.dismissal_reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${sev.border} ${sev.bg} shadow-sm overflow-hidden transition-all`}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
      >
        <div className={`w-2 h-2 rounded-full ${sev.dot} flex-shrink-0 mt-1.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[11px] font-medium uppercase tracking-wider ${sev.text}`}>
              {sev.label}
            </span>
            {(finding as any).verification_status === 'likely_fixed' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-[#22C55E]/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                <Eye size={10} />
                Likely Fixed
              </span>
            )}
            {(finding as any).verification_status === 'poorly_fixed' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/15 px-2 py-0.5 rounded-full uppercase tracking-wide">
                <AlertTriangle size={10} />
                Poorly Fixed
              </span>
            )}
            {finding.page_url && (
              <a
                href={finding.page_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-brand transition-colors max-w-[260px] truncate"
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
          <h4 className="font-medium text-text text-sm leading-snug">{finding.title}</h4>
        </div>
        <ChevronDown
          size={16}
          className={`text-muted flex-shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-border/20 dark:border-white/[0.04] mx-4 space-y-3">
          {/* Description */}
          <p className="text-muted text-sm leading-relaxed pt-3">
            {finding.description}
          </p>

          {/* AI Verification Note — Likely Fixed */}
          {(finding as any).verification_status === 'likely_fixed' && (finding as any).verification_note && (
            <div className="flex items-start gap-2.5 p-3 bg-[#22C55E]/5 dark:bg-emerald-950/20 rounded-lg border border-[#22C55E]/15">
              <Eye size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-text mb-0.5">AI Verification</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">
                  {(finding as any).verification_note}
                </p>
                <p className="text-[11px] text-muted mt-1">
                  Mark this finding as &quot;Fixed&quot; to confirm and update your score.
                </p>
              </div>
            </div>
          )}

          {/* AI Verification Note — Poorly Fixed */}
          {(finding as any).verification_status === 'poorly_fixed' && (finding as any).verification_note && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50/60 dark:bg-red-950/20 rounded-lg border border-red-200/40 dark:border-red-800/20">
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-text mb-0.5">Regression Detected</p>
                <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                  {(finding as any).verification_note}
                </p>
                <p className="text-[11px] text-muted mt-1">
                  The attempted fix introduced new issues. Review and address the regression to improve your score.
                </p>
              </div>
            </div>
          )}

          {/* Recommendation */}
          {finding.recommendation && (
            <div className="p-3 bg-surface-alt/60 dark:bg-white/[0.03] rounded-lg border border-border/30 dark:border-white/[0.04]">
              <div className="flex gap-2.5">
                <Lightbulb size={14} className={`flex-shrink-0 mt-0.5 ${pillarColor}`} />
                <div>
                  <p className="text-[11px] font-medium text-text mb-1">Recommendation</p>
                  <p className="text-sm text-muted leading-relaxed">{finding.recommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Estimated Impact */}
          {finding.estimated_impact && (
            <div className="flex items-start gap-2.5 p-3 bg-[#22C55E]/5 dark:bg-emerald-950/20 rounded-lg border border-[#22C55E]/15">
              <TrendingUp size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-text mb-0.5">Expected Impact</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">{finding.estimated_impact}</p>
              </div>
            </div>
          )}

          {/* Screenshot with highlighted element */}
          {finding.screenshot_url && (
            <div className="rounded-lg overflow-hidden border border-border/30 dark:border-white/[0.04]">
              <div className="px-3 py-2 bg-surface-alt/60 dark:bg-white/[0.03] border-b border-border/20 dark:border-white/[0.04] flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                <span className="text-[11px] font-medium text-text">Visual Evidence</span>
                {finding.page_url && (
                  <span className="text-[11px] text-muted ml-auto font-mono truncate max-w-[200px]">
                    {(() => { try { const u = new URL(finding.page_url); return u.pathname + u.search; } catch { return finding.page_url; } })()}
                  </span>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={finding.screenshot_url}
                alt={`Screenshot showing: ${finding.title}`}
                className="w-full max-h-80 object-contain bg-off dark:bg-off"
                loading="lazy"
              />
            </div>
          )}

          {/* Status toggle + Dismiss */}
          <div className="mt-1 p-3 rounded-lg bg-surface-alt/60 dark:bg-white/[0.03] border border-border/20 dark:border-white/[0.04]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-text uppercase tracking-wide">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {FINDING_STATUSES.map((s) => {
                  const active = status === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleStatusChange(s.key)}
                      disabled={statusUpdating}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all ${
                        active ? `${s.bg} ${s.color} ring-1 ring-current/20 shadow-sm` : 'text-muted hover:bg-off dark:hover:bg-white/[0.04]'
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
                  className="text-[11px] font-medium text-muted hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>

          {/* Dismiss form */}
          {showDismissForm && (
            <div className="mt-2 p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-200/30 dark:border-red-800/20">
              <p className="text-[11px] font-medium text-text mb-2">Why are you dismissing this? (The AI will skip it on re-audits)</p>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="e.g. This is addressed on our About page, or: This is intentional for our target audience..."
                className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-card text-text placeholder:text-placeholder focus:outline-none focus:border-brand resize-none"
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleDismiss}
                  disabled={statusUpdating || !dismissReason.trim()}
                  className="text-[11px] font-medium text-white px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  Dismiss and skip on re-audit
                </button>
                <button
                  onClick={() => setShowDismissForm(false)}
                  className="text-[11px] font-medium text-muted px-3 py-1.5 rounded-lg hover:bg-off transition-colors"
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
      className={`text-xs leading-relaxed cursor-pointer text-muted hover:text-text transition-colors ${expanded ? '' : 'line-clamp-2'}`}
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
  const L = getUILabels(lang);
  const pillarCats = categoryScores.filter((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
  const avgScore = pillarCats.length > 0
    ? Math.round(pillarCats.reduce((sum, c) => sum + c.score, 0) / pillarCats.length)
    : 0;

  // Group findings by approximate category match
  const findingsByCategory: Record<string, AuditFinding[]> = {};
  const ungrouped: AuditFinding[] = [];

  for (const f of findings) {
    let matched = false;
    for (const cat of pillarCats) {
      // Match finding to category by checking if the finding's title/description relates to the category
      const catWords = cat.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3);
      const findingText = `${f.title} ${f.description}`.toLowerCase();
      if (catWords.some(w => findingText.includes(w))) {
        if (!findingsByCategory[cat.name]) findingsByCategory[cat.name] = [];
        findingsByCategory[cat.name].push(f);
        matched = true;
        break;
      }
    }
    if (!matched) ungrouped.push(f);
  }

  // Distribute ungrouped findings evenly
  if (ungrouped.length > 0 && pillarCats.length > 0) {
    ungrouped.forEach((f, i) => {
      const catName = pillarCats[i % pillarCats.length].name;
      if (!findingsByCategory[catName]) findingsByCategory[catName] = [];
      findingsByCategory[catName].push(f);
    });
  }

  return (
    <div className="mb-8">
      {/* Pillar header */}
      <div className={`rounded-xl bg-gradient-to-r ${pillar.gradientSubtle} border ${pillar.border} p-5 mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center shadow-sm`}>
              {React.createElement(PILLAR_ICONS[pillarIndex] || Scale, { size: 18, className: 'text-white' })}
            </div>
            <div>
              <h2 className="font-heading font-medium text-lg text-text">{pillar.name}</h2>
              <p className="text-xs text-muted">{pillarCats.length} {L.categoriesEvaluated}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-medium font-heading ${scoreColor(avgScore)}`}>{avgScore}</p>
            <p className="text-[11px] text-muted">{getScoreLabel(avgScore, lang)}</p>
          </div>
        </div>

        {/* Category score bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {pillarCats.map((cat, relIdx) => {
            const globalIdx = pillar.range[0] + relIdx;
            const Icon = getCategoryIcon(cat.name, globalIdx);
            return (
              <div key={globalIdx} className="bg-card/80 dark:bg-white/[0.04] backdrop-blur-sm rounded-lg p-3 border border-border/20 dark:border-white/[0.04]">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className={`w-6 h-6 rounded-md ${pillar.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={12} className={pillar.iconColor} />
                  </div>
                  <p className="text-xs font-medium text-text truncate flex-1">{cat.name}</p>
                  <span className={`text-xs font-medium flex-shrink-0 ${scoreColor(cat.score)}`}>
                    {cat.score}
                  </span>
                </div>
                <div className="w-full bg-border/15 dark:bg-white/[0.06] rounded-full h-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${pillar.scoreBg}`}
                    style={{ width: `${cat.score}%`, opacity: cat.score >= 70 ? 0.8 : cat.score >= 40 ? 0.7 : 0.9 }}
                  />
                </div>
                {cat.summary && cat.summary.trim() && (
                  <div className="mt-2 p-2.5 rounded-lg bg-off/40 dark:bg-white/[0.03] border border-border/10 dark:border-white/[0.03]">
                    <ExpandableSummary text={cat.summary} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Findings for this pillar */}
      {Object.entries(findingsByCategory).map(([catName, catFindings]) => {
        if (catFindings.length === 0) return null;
        // Sort by severity
        const sorted = [...catFindings].sort((a, b) => {
          const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
        });

        return (
          <div key={catName} className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={`text-xs font-medium ${pillar.iconColor}`}>{catName}</span>
              <span className="text-[11px] text-muted">
                {catFindings.length} finding{catFindings.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {sorted.map((finding) => (
                <FindingCard key={finding.id} finding={finding} pillarColor={pillar.iconColor} categoryName={catName} sevConfig={buildSeverityConfig(getUILabels(lang))} onScoreUpdate={onScoreUpdate} />
              ))}
            </div>
          </div>
        );
      })}
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
  const [auditPages, setAuditPages] = useState<Array<{ url: string; title: string | null; status_code: number | null; load_time_ms: number | null; screenshot_url: string | null }>>([]);
  const [siblingCount, setSiblingCount] = useState(0); // other audits for same domain
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'pages'>('overview');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [verificationAlertDismissed, setVerificationAlertDismissed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
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
              .select('url, title, status_code, load_time_ms, screenshot_url')
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
      if (!active) return;
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

      if (active) {
        pollRef.current = setInterval(async () => {
          if (!active) return;
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
  useEffect(() => {
    if (isPaymentReturn) return;
    if (!audit) return;
    const inProgress = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
    if (!inProgress) return;

    pollRef.current = setInterval(async () => {
      const s = await fetchAuditDetail(true);
      if (s === 'completed' || s === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 5000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [audit?.status, isPaymentReturn, fetchAuditDetail]);

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
        <div className="h-5 w-20 bg-off rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-off rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-off rounded animate-pulse mb-8" />
        <div className="h-48 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-4">
        <Link href="/dashboard/audits" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
          <ArrowLeft size={16} />
          Back to Audits
        </Link>
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300 text-sm">{error || 'Audit not found'}</p>
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

  // Assign findings to modules based on sort_order (findings come out in category order from the engine)
  function assignFindingsToPillars() {
    const perPillar: Record<string, AuditFinding[]> = {};
    for (const p of PILLAR_CONFIG) perPillar[p.name] = [];

    // Determine how many categories were actually analyzed
    // Use selectedModules from raw_json if available, fall back to pillar count
    const selectedModules: string[] | null = rawJson?.selectedModules ?? null;
    const totalCategories = selectedModules
      ? selectedModules.length * 4
      : (auditSelectedPillars ? auditSelectedPillars.length * 4 : categoryScores.length || 16);
    const totalFindings = findings.length;
    const findingsPerCategory = totalFindings / Math.max(1, totalCategories);

    for (const f of findings) {
      const estimatedCatIdx = Math.min(
        Math.floor(f.sort_order / Math.max(1, findingsPerCategory)),
        totalCategories - 1,
      );
      const pillar = getPillarForCategory(estimatedCatIdx, PILLAR_CONFIG);
      perPillar[pillar.name].push(f);
    }

    return perPillar;
  }

  const findingsByPillar = assignFindingsToPillars();

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* ── Sticky Score Bar — fixed to top of main content area ── */}
      {isCompleted && showStickyScore && (
        <div className="fixed top-0 right-0 left-0 md:left-[220px] z-40">
          <div className="border-b border-border/30 dark:border-white/[0.06] bg-card/95 backdrop-blur-md shadow-sm">
            <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white ${
                  calculatedOverallScore >= 70 ? 'bg-[#22C55E]' : calculatedOverallScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                  {calculatedOverallScore}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate">{formatUrl(audit.product_url || '')}</p>
                  <p className="text-[11px] text-muted">{getScoreLabel(calculatedOverallScore, auditLang)}</p>
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
                      <div className={`w-1.5 h-1.5 rounded-full ${pillar.badgeBg}`} />
                      {wasAudited ? (
                        <span className={`text-xs font-medium ${scoreColor(avg)}`}>{avg}</span>
                      ) : (
                        <span className="text-xs text-muted">--</span>
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
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {siblingCount > 0 ? `Back to ${formatUrl(audit.product_url || '')} Audits` : 'Back to Audits'}
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium font-heading text-text mb-1 truncate">
            {formatUrl(audit.product_url || '')}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-muted text-sm">{formatDate(audit.created_at)}</p>
            {(audit as any).depth_mode === 'deep' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand dark:text-brand bg-brand/10 dark:bg-brand/15 px-2 py-0.5 rounded-full uppercase tracking-wide">
                <Search size={10} />
                Deep Mode
              </span>
            )}
            <a
              href={audit.product_url || ''}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
            >
              <ExternalLink size={11} />
              Visit site
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-off transition-colors"
            aria-label="Audit settings"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-[100] w-52 rounded-xl border border-border/40 dark:border-white/[0.08] bg-white dark:bg-[#1E1E24] shadow-xl shadow-black/20 dark:shadow-black/50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {isCompleted && (
                <>
                  <button
                    onClick={() => { handleShare(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Share2 size={13} className="text-muted" />
                    {shareUrl ? 'Copy share link' : 'Create share link'}
                  </button>
                  {(shareUrl || (audit as any).share_enabled) && (
                    <button
                      onClick={handleRevokeShare}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                    >
                      <LinkIcon size={13} />
                      Revoke share link
                    </button>
                  )}
                  <div className="my-1.5 h-px bg-border/30 dark:bg-white/[0.04]" />
                </>
              )}
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors"
              >
                <RefreshCw size={13} className="text-muted" />
                Re-audit this site
                <span className="ml-auto text-[11px] text-muted">1 credit</span>
              </Link>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors"
              >
                <Search size={13} className="text-muted" />
                Dig Deeper (find new issues)
                <span className="ml-auto text-[11px] text-muted">1 credit</span>
              </Link>
              <button
                onClick={() => { handleRestart(); setMenuOpen(false); }}
                disabled={restarting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
              >
                <Zap size={13} className="text-muted" />
                Restart audit
              </button>
              <div className="my-1.5 h-px bg-border/30 dark:bg-white/[0.04]" />
              <button
                onClick={() => { handleDelete(); setMenuOpen(false); }}
                disabled={deleting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-50"
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
            <Loader2 size={20} className="text-brand animate-spin" />
            <div>
              <p className="font-medium text-text">Confirming your payment...</p>
              <p className="text-sm text-muted">This only takes a moment.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Pending payment ────────────────────────────────── */}
      {audit.status === 'pending_payment' && !verifying && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
                <Clock size={20} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="font-medium text-text">Payment required</p>
                <p className="text-sm text-muted">Complete payment to start the audit.</p>
              </div>
            </div>
            <button
              onClick={handlePayNow}
              className="inline-flex items-center gap-2 text-sm font-medium bg-brand text-surface px-6 py-2.5 rounded-lg transition-all hover:brightness-110"
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
            <StatusIcon size={20} className="text-brand" />
            <div>
              <p className="font-medium text-text">{meta.label}</p>
              <p className="text-sm text-muted">{meta.description}</p>
            </div>
            <Loader2 size={16} className="text-brand animate-spin ml-auto" />
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
                        isActive ? 'bg-brand' : 'bg-off',
                        isCurrent && 'animate-pulse',
                      )}
                    />
                    <p className={clsx('text-xs font-medium mt-1.5', isActive ? 'text-brand' : 'text-muted')}>
                      {step.label}
                    </p>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <RotatingCheckpoints />
          <p className="text-sm text-muted mt-2 text-center">
            This page updates automatically. No need to refresh.
          </p>

          {/* Restart button if stuck */}
          {audit.updated_at && (Date.now() - new Date(audit.updated_at).getTime() > 3 * 60 * 1000) && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted">Taking longer than expected?</p>
              <button
                onClick={handleRestart}
                disabled={restarting}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand text-surface px-4 py-2.5 rounded-lg transition-all disabled:opacity-60 hover:brightness-110"
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
        <div className="mb-6 p-5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-900 dark:text-red-200">Audit failed</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {audit.crawl_error || 'Something went wrong during processing.'}
              </p>
              <div className="mt-3 p-3 rounded-lg bg-[#22C55E]/8 border border-emerald-200 dark:border-emerald-800/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    No credits were used for this audit
                  </p>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 ml-[22px]">
                  Your credit has been automatically refunded. You can restart the audit at no extra cost.
                </p>
              </div>
              <div className="flex items-center gap-2.5 mt-4">
                <button
                  onClick={handleRestart}
                  disabled={restarting}
                  className="inline-flex items-center gap-1.5 text-sm font-medium bg-brand text-surface px-5 py-2.5 rounded-lg transition-all disabled:opacity-60 hover:brightness-110"
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
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-red-600 dark:hover:text-red-400 px-3 py-2.5 rounded-xl border border-border hover:border-red-300 dark:hover:border-red-700 transition-colors disabled:opacity-60"
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
          <div ref={scoreCardRef} className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card overflow-hidden mb-6 shadow-lg shadow-black/[0.03]">
            {/* Brand top accent */}
            <div className="h-1.5 bg-brand" />

            <div className="p-5 sm:p-6">
              {/* Mobile: centered stack — Desktop: horizontal row */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Score ring */}
                <div className="flex-shrink-0">
                  <ScoreRing score={calculatedOverallScore} size={110} strokeWidth={7} />
                </div>

                {/* Score details */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                    <h2 className="text-xl font-medium font-heading text-text">{L.overallScore}</h2>
                    {isPartialAudit && (
                      <span className="text-[11px] font-medium text-muted bg-off dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
                        {activeModuleCount} of {totalModuleCount} modules
                      </span>
                    )}
                    <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${
                      (calculatedOverallScore) >= 70
                        ? 'bg-[#22C55E]/10 text-[#22C55E] dark:text-emerald-400'
                        : (calculatedOverallScore) >= 40
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-[#EF4444] dark:text-red-400'
                    }`}>
                      {getScoreLabel(calculatedOverallScore, auditLang)}
                    </span>
                  </div>

                  {/* Pillar mini-scores — 2-column grid on mobile, inline on desktop */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5 mt-3">
                    {PILLAR_CONFIG.map((pillar, pIdx) => {
                      const pillarCats = categoryScores.filter((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
                      const avg = pillarCats.length > 0
                        ? Math.round(pillarCats.reduce((s, c) => s + c.score, 0) / pillarCats.length)
                        : 0;
                      const hasData = pillarCats.length > 0;
                      const wasAudited = hasData && (!isPartialAudit || (auditSelectedModules ? auditSelectedModules.includes(MODULE_SLUG_ORDER[pIdx]) : (auditSelectedPillars?.includes(pIdx) ?? true)));
                      return (
                        <div key={pillar.name} className={`flex items-center gap-1.5 ${!wasAudited ? 'opacity-30' : ''}`}>
                          <div className={`w-2 h-2 rounded-full ${pillar.badgeBg}`} />
                          <span className="text-xs text-muted">{pillar.name}</span>
                          {wasAudited ? (
                            <span className={`text-xs font-medium ${scoreColor(avg)}`}>{avg}</span>
                          ) : (
                            <span className="text-xs text-muted">--</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action buttons — all in one row, same style */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <a href={`/api/reports/${auditId}/pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors whitespace-nowrap">
                      <Download size={12} /> PDF
                    </a>
                    <a href={`/api/reports/${auditId}/docx`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors whitespace-nowrap">
                      <Download size={12} /> Word
                    </a>
                    <Link
                      href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                      className="flex items-center justify-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors whitespace-nowrap"
                    >
                      <RefreshCw size={12} /> Re-audit
                    </Link>
                    <Link
                      href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                      className="flex items-center justify-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors whitespace-nowrap"
                    >
                      <Search size={12} /> Dig Deeper
                    </Link>
                    <button
                      onClick={handleShare}
                      disabled={shareLoading}
                      className="flex items-center justify-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {shareCopied ? <><Check size={12} className="text-emerald-500" /> Copied</> : <><Share2 size={12} /> Share</>}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted mt-2">1 credit per audit</p>
                </div>
              </div>

              {/* Issue summary strip */}
              {report.total_issues > 0 && (
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 mt-5 pt-4 border-t border-border/30 dark:border-white/[0.04]">
                  <span className="text-sm font-medium text-text">
                    {report.total_issues} {L.issuesFound}
                  </span>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    {severityCounts.critical > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {severityCounts.critical} {L.severityCritical.toLowerCase()}
                      </span>
                    )}
                    {severityCounts.high > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {severityCounts.high} {L.severityHigh.toLowerCase()}
                      </span>
                    )}
                    {severityCounts.medium > 0 && (
                      <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">{severityCounts.medium} {L.severityMedium.toLowerCase()}</span>
                    )}
                    {severityCounts.low > 0 && (
                      <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">{severityCounts.low} {L.severityLow.toLowerCase()}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Score Over Time (line chart — shows when there are multiple audits of the same URL) ── */}
          <ScoreOverTime productUrl={audit.product_url || ''} currentAuditId={auditId} />

          {/* ── Improvement tip ─────────────────────────────── */}
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-brand/5 dark:bg-brand/[0.08] border border-brand/20 dark:border-brand/10">
            <RefreshCw size={15} className="text-brand flex-shrink-0" />
            <p className="text-xs text-muted">
              <span className="font-medium text-text">Track your progress</span> — update finding statuses as you fix them, dismiss false positives with a reason, then re-audit to compare your score.
            </p>
          </div>

          {/* ── Page Screenshot ────────────────────────────── */}
          {auditPages[0]?.screenshot_url && (
            <div className="mb-6 rounded-xl overflow-hidden border border-border/30 dark:border-white/[0.06] shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={auditPages[0].screenshot_url}
                alt="Website overview"
                className="w-full h-auto max-h-96 object-cover object-top"
                loading="lazy"
              />
              <div className="px-4 py-2 bg-card border-t border-border/20 dark:border-white/[0.03]">
                <p className="text-xs text-muted">{L.homepageCaptured}</p>
              </div>
            </div>
          )}

          {/* ── Tab Navigation ─────────────────────────────── */}
          <div className="flex items-center gap-1 bg-off/80 dark:bg-white/[0.04] rounded-xl p-1 mb-6">
            {(['overview', 'findings', 'pages'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex-1 text-sm font-medium py-2.5 rounded-lg transition-all',
                  activeTab === tab
                    ? 'bg-card text-text shadow-sm'
                    : 'text-muted hover:text-text',
                )}
              >
                {tab === 'overview' && L.tabOverview}
                {tab === 'findings' && `${L.tabFindings} (${findings.length})`}
                {tab === 'pages' && `${L.tabPages} (${auditPages.length})`}
              </button>
            ))}
          </div>

          {/* ── TAB: Overview ──────────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              {/* Verification alerts — baseline re-audit feedback */}
              {!verificationAlertDismissed && rawJson?.verificationSummary && (
                <>
                  {/* "Nothing changed" alert */}
                  {rawJson.verificationSummary.nothingChanged && (
                    <div className="mb-4 p-4 rounded-xl bg-off dark:bg-white/[0.03] border border-border/40 dark:border-white/[0.06] flex items-start gap-3">
                      <Info size={16} className="text-muted flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text mb-0.5">No changes detected</p>
                        <p className="text-xs text-muted leading-relaxed">
                          Nothing has changed compared to the latest audit. Your score remains the same.
                          To improve, address open findings and mark them as fixed, or run a Deep Mode audit to discover new insights.
                        </p>
                      </div>
                      <button
                        onClick={() => setVerificationAlertDismissed(true)}
                        className="text-muted hover:text-text transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* "Likely fixed findings detected" alert */}
                  {rawJson.verificationSummary.likelyFixed > 0 && (
                    <div className="mb-4 p-4 rounded-xl bg-[#22C55E]/5 dark:bg-emerald-950/20 border border-[#22C55E]/15 flex items-start gap-3">
                      <Eye size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text mb-0.5">
                          {rawJson.verificationSummary.likelyFixed} finding{rawJson.verificationSummary.likelyFixed > 1 ? 's' : ''} may have been fixed
                        </p>
                        <p className="text-xs text-muted leading-relaxed">
                          Our AI scanned the live site and detected changes that suggest {rawJson.verificationSummary.likelyFixed > 1 ? 'these issues have' : 'this issue has'} been addressed.
                          Look for the &quot;Likely Fixed&quot; badge on findings below. Confirm the fix to update your score.
                        </p>
                      </div>
                      <button
                        onClick={() => setVerificationAlertDismissed(true)}
                        className="text-muted hover:text-text transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* "Poorly fixed findings detected" alert */}
                  {rawJson.verificationSummary.poorlyFixed > 0 && (
                    <div className="mb-4 p-4 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200/40 dark:border-red-800/20 flex items-start gap-3">
                      <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text mb-0.5">
                          {rawJson.verificationSummary.poorlyFixed} finding{rawJson.verificationSummary.poorlyFixed > 1 ? 's' : ''} poorly fixed
                        </p>
                        <p className="text-xs text-muted leading-relaxed">
                          Our AI detected that {rawJson.verificationSummary.poorlyFixed > 1 ? 'these fixes' : 'this fix'} may have introduced new issues or made things worse.
                          Look for the &quot;Poorly Fixed&quot; badge on findings below and review the AI notes for guidance.
                        </p>
                      </div>
                      <button
                        onClick={() => setVerificationAlertDismissed(true)}
                        className="text-muted hover:text-text transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Top Priority Recommendations — shown first for immediate actionability */}
              {(rawJson?.topRecommendations?.length > 0 || rawJson?.keyRecommendation) && (
                <div className="mb-6 p-5 rounded-xl border border-brand/20 dark:border-brand/10 bg-brand/5 dark:bg-brand/[0.06]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand">
                      <Zap size={14} className="text-surface" />
                    </div>
                    <p className="text-sm font-medium text-text">{getReportLabels(auditLang).topPriorityRecommendations}</p>
                  </div>
                  <div className="space-y-3">
                    {(rawJson.topRecommendations || [rawJson.keyRecommendation]).filter(Boolean).map((rec: string, i: number) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium bg-brand text-surface mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-sm text-text leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Executive Summary */}
              {report.executive_summary && (
                <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-6 mb-6">
                  <h2 className="font-heading font-medium text-lg text-text mb-3">{getReportLabels(auditLang).executiveSummary}</h2>
                  <div className="text-muted text-sm leading-relaxed whitespace-pre-line">
                    {report.executive_summary}
                  </div>

                  {/* Research note */}
                  <div className="mt-4 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-surface-alt/60 dark:bg-white/[0.03] border border-border/30 dark:border-white/[0.04]">
                    <Lightbulb size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted leading-relaxed">
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

              {/* 64-Checkpoint Health — pass/fail breakdown */}
              <CheckpointHealth categoryScores={categoryScores} findings={findings} />

              {/* AI transparency note */}
              <div className="mb-6 px-4 py-3 rounded-xl bg-off/40 dark:bg-white/[0.02] border border-border/15 dark:border-white/[0.03]">
                <p className="text-[11px] text-muted/70 leading-relaxed">
                  <span className="font-medium text-muted">About this audit</span> — This report was generated by AI analysing your publicly visible page content across up to 6 modules and 24 categories. It cannot test JavaScript interactions, real load times, or content behind authentication. For accessibility compliance and security-critical findings, we recommend pairing these results with manual review. Dismiss any finding that doesn&apos;t apply to your context — the AI will learn from your feedback on re-audits.
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
                        <div key={idx} className="bg-card border border-border/30 dark:border-white/[0.06] rounded-xl flex flex-col items-center py-4 px-3">
                          <ScoreRing score={item.score} size={72} strokeWidth={5} />
                          <p className="text-xs text-muted font-medium mt-2">{item.label}</p>
                        </div>
                      ),
                    )}
                  </div>

                  {/* Simple severity-grouped findings */}
                  {findings.length > 0 && (
                    <div className="space-y-3">
                      {findings.map((finding) => (
                        <FindingCard key={finding.id} finding={finding} pillarColor="text-brand" sevConfig={severityConfig} onScoreUpdate={() => fetchAuditDetail(true)} />
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
                  <CheckCircle2 size={32} className="text-[#22C55E] dark:text-emerald-500 mx-auto mb-3" />
                  <p className="text-text font-medium">{L.noIssuesFound}</p>
                  <p className="text-sm text-muted mt-1">{L.noIssuesDescription}</p>
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
                        <span className="text-xs text-muted">
                          {items.length} issue{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map((finding) => (
                          <FindingCard key={finding.id} finding={finding} pillarColor="text-brand" sevConfig={severityConfig} onScoreUpdate={() => fetchAuditDetail(true)} />
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
              <p className="text-sm text-muted mb-4">
                {auditPages.length} {L.pagesCrawled}
              </p>
              <div className="bg-card border border-border/30 dark:border-white/[0.06] rounded-xl overflow-hidden divide-y divide-border/30 dark:divide-white/[0.04]">
                {auditPages.map((pg, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-3 hover:bg-off/50 dark:hover:bg-white/[0.02] transition-colors">
                    <span className="text-xs text-muted w-6 text-right flex-shrink-0 font-mono">{idx + 1}</span>
                    <Globe size={14} className="text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {pg.title && (
                        <p className="text-sm font-medium text-text truncate">{pg.title}</p>
                      )}
                      <a
                        href={pg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand hover:text-brand/80 hover:underline truncate block"
                      >
                        {pg.url}
                      </a>
                    </div>
                    {pg.status_code && pg.status_code !== 200 && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20">
                        {pg.status_code}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Bottom action bar ────────────────────────── */}
          <div className="mt-8 mb-4">
            <div className="flex flex-wrap justify-center gap-2.5 max-w-3xl mx-auto">
              <a
                href={`/api/reports/${auditId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-card border border-border text-text text-sm font-medium px-5 py-3 rounded-xl hover:bg-surface-alt transition-colors whitespace-nowrap"
              >
                <Download size={14} /> PDF Report
              </a>
              <a
                href={`/api/reports/${auditId}/docx`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-card border border-border text-text text-sm font-medium px-5 py-3 rounded-xl hover:bg-surface-alt transition-colors whitespace-nowrap"
              >
                <Download size={14} /> Word Report
              </a>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}`}
                className="flex items-center justify-center gap-2 bg-card border border-border text-text text-sm font-medium px-5 py-3 rounded-xl hover:bg-surface-alt transition-colors whitespace-nowrap"
              >
                <RefreshCw size={14} /> Re-audit
              </Link>
              <Link
                href={`/dashboard/new-audit?url=${encodeURIComponent(audit.product_url || '')}&depth=deep`}
                className="flex items-center justify-center gap-2 bg-card border border-border text-text text-sm font-medium px-5 py-3 rounded-xl hover:bg-surface-alt transition-colors whitespace-nowrap"
              >
                <Search size={14} /> Dig Deeper
              </Link>
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="flex items-center justify-center gap-2 bg-card border border-border text-text text-sm font-medium px-5 py-3 rounded-xl hover:bg-surface-alt transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {shareCopied ? <><Check size={14} className="text-emerald-500" /> Copied</> : <><Share2 size={14} /> Share</>}
              </button>
            </div>
            <p className="text-center text-[11px] text-muted mt-2">1 credit per audit</p>
            {shareUrl && (
              <p className="text-center text-[11px] text-muted">
                Share link: <span className="font-mono text-brand">{shareUrl}</span>
              </p>
            )}
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
        <div className="h-5 w-20 bg-off rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-off rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-off rounded animate-pulse mb-8" />
        <div className="h-48 bg-off rounded-xl animate-pulse" />
      </div>
    }
  >
    <AuditDetailInner {...props} />
  </Suspense>
);

export default AuditDetailPage;
