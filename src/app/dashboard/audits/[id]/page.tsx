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

/* ── Pillar configuration ─────────────────────────────────── */
// Must match the 16 categories in analyzer.ts exactly (4 per pillar)

const PILLAR_CONFIG = [
  {
    name: 'Foundation',
    color: 'violet',
    gradient: 'from-violet-500 to-violet-600',
    gradientSubtle: 'from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/10',
    border: 'border-violet-200 dark:border-violet-800/40',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
    badgeBg: 'bg-violet-500',
    scoreBg: 'bg-violet-500',
    range: [0, 4],
    categories: [
      { name: 'Visual Design & First Impression', Icon: Eye },
      { name: 'Value Proposition & Messaging', Icon: Target },
      { name: 'Navigation & Information Architecture', Icon: Map },
      { name: 'Content Quality & Readability', Icon: Type },
    ],
  },
  {
    name: 'Human Experience',
    color: 'pink',
    gradient: 'from-pink-500 to-pink-600',
    gradientSubtle: 'from-pink-50 to-pink-100/50 dark:from-pink-950/30 dark:to-pink-900/10',
    border: 'border-pink-200 dark:border-pink-800/40',
    iconBg: 'bg-pink-500/10',
    iconColor: 'text-pink-500',
    badgeBg: 'bg-pink-500',
    scoreBg: 'bg-pink-500',
    range: [4, 8],
    categories: [
      { name: 'Calls-to-Action & Conversion Path', Icon: MousePointerClick },
      { name: 'Trust, Credibility & Social Proof', Icon: Shield },
      { name: 'Ethical UX & Dark Pattern Detection', Icon: AlertTriangle },
      { name: 'Emotional Design & Psychological Safety', Icon: Heart },
    ],
  },
  {
    name: 'Inclusive Design',
    color: 'amber',
    gradient: 'from-amber-500 to-amber-600',
    gradientSubtle: 'from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10',
    border: 'border-amber-200 dark:border-amber-800/40',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    badgeBg: 'bg-amber-500',
    scoreBg: 'bg-amber-500',
    range: [8, 12],
    categories: [
      { name: 'Accessibility & WCAG Compliance', Icon: Accessibility },
      { name: 'Cognitive Accessibility & Neurodiversity', Icon: Brain },
      { name: 'Digital Wellbeing & Responsible Design', Icon: Sparkles },
      { name: 'Mobile Experience & Responsive Design', Icon: Smartphone },
    ],
  },
  {
    name: 'Future Readiness',
    color: 'emerald',
    gradient: 'from-emerald-500 to-emerald-600',
    gradientSubtle: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    badgeBg: 'bg-emerald-500',
    scoreBg: 'bg-emerald-500',
    range: [12, 16],
    categories: [
      { name: 'Performance & Technical Health', Icon: Gauge },
      { name: 'AI Discoverability & LLM Readiness', Icon: Search },
      { name: 'AI Agent Readiness', Icon: Zap },
      { name: 'Cultural Sensitivity & Global Readiness', Icon: Globe },
    ],
  },
];

const CATEGORY_ICONS_BY_INDEX: React.ElementType[] = PILLAR_CONFIG.flatMap(p => p.categories.map(c => c.Icon));

function getCategoryIcon(name: string, index?: number): React.ElementType {
  if (index !== undefined && index >= 0 && index < CATEGORY_ICONS_BY_INDEX.length) {
    return CATEGORY_ICONS_BY_INDEX[index];
  }
  const lower = name.toLowerCase();
  for (const pillar of PILLAR_CONFIG) {
    for (const cat of pillar.categories) {
      if (lower.includes(cat.name.toLowerCase().split(' ')[0])) return cat.Icon;
    }
  }
  return Sparkles;
}

function getPillarForCategory(index: number) {
  for (const pillar of PILLAR_CONFIG) {
    if (index >= pillar.range[0] && index < pillar.range[1]) return pillar;
  }
  return PILLAR_CONFIG[0];
}

const severityConfig = {
  critical: {
    badge: 'danger' as const,
    label: 'Critical',
    bg: 'bg-white dark:bg-card',
    border: 'border-border/40 dark:border-white/[0.06]',
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    impactBg: 'bg-red-50 dark:bg-red-950/20',
  },
  high: {
    badge: 'failed' as const,
    label: 'High',
    bg: 'bg-white dark:bg-card',
    border: 'border-border/40 dark:border-white/[0.06]',
    dot: 'bg-orange-500',
    text: 'text-orange-600 dark:text-orange-400',
    impactBg: 'bg-orange-50 dark:bg-orange-950/20',
  },
  medium: {
    badge: 'pending' as const,
    label: 'Medium',
    bg: 'bg-white dark:bg-card',
    border: 'border-border/40 dark:border-white/[0.06]',
    dot: 'bg-yellow-500',
    text: 'text-yellow-600 dark:text-yellow-500',
    impactBg: 'bg-yellow-50 dark:bg-yellow-950/20',
  },
  low: {
    badge: 'active' as const,
    label: 'Low',
    bg: 'bg-white dark:bg-card',
    border: 'border-border/40 dark:border-white/[0.06]',
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    impactBg: 'bg-blue-50 dark:bg-blue-950/20',
  },
};

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-emerald-500';
  if (s >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 60) return 'Decent';
  if (s >= 40) return 'Needs Work';
  return 'Poor';
}

const statusMeta: Record<
  string,
  { label: string; color: string; icon: React.ElementType; description: string }
> = {
  pending_payment: {
    label: 'Awaiting Payment',
    color: 'pending',
    icon: Clock,
    description: 'Complete payment to start the audit.',
  },
  payment_received: {
    label: 'Payment Confirmed',
    color: 'active',
    icon: CheckCircle2,
    description: 'Payment received. Your audit is being queued.',
  },
  crawling: {
    label: 'Crawling Website',
    color: 'active',
    icon: Globe,
    description: 'Our AI is crawling your website and collecting data...',
  },
  analysing: {
    label: 'Analysing UX',
    color: 'active',
    icon: Sparkles,
    description: 'Running deep analysis across 16 categories...',
  },
  generating_report: {
    label: 'Generating Report',
    color: 'active',
    icon: FileSearch,
    description: 'Compiling your professional audit report...',
  },
  completed: {
    label: 'Completed',
    color: 'completed',
    icon: CheckCircle2,
    description: 'Your audit is ready.',
  },
  failed: {
    label: 'Failed',
    color: 'failed',
    icon: AlertTriangle,
    description: 'Something went wrong. You can retry the audit.',
  },
};

/* ── Progress steps ──────────────────────────────────────── */
const progressSteps = [
  { key: 'payment_received', label: 'Payment' },
  { key: 'crawling', label: 'Crawling' },
  { key: 'analysing', label: 'Analysing' },
  { key: 'generating_report', label: 'Report' },
  { key: 'completed', label: 'Done' },
];

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

function getStepIndex(status: string) {
  return progressSteps.findIndex((s) => s.key === status);
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
        className={`text-sm font-medium bg-clip-text text-transparent transition-opacity duration-300 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundImage: 'var(--gradient-brand-text)' }}
      >
        {auditCheckpoints[idx]}...
      </p>
    </div>
  );
}

/* ── Collapsible Finding Card ─────────────────────────────── */
function FindingCard({ finding, pillarColor, categoryName }: { finding: AuditFinding; pillarColor: string; categoryName?: string }) {
  const [open, setOpen] = useState(false);
  const sev = severityConfig[finding.severity] || severityConfig.medium;

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
            <span className={`text-[11px] font-bold uppercase tracking-wider ${sev.text}`}>
              {sev.label}
            </span>
            {finding.page_url && (
              <a
                href={finding.page_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-violet-500 transition-colors max-w-[260px] truncate"
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
          <h4 className="font-semibold text-text text-sm leading-snug">{finding.title}</h4>
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

          {/* Recommendation */}
          {finding.recommendation && (
            <div className="p-3 bg-surface-alt/60 dark:bg-white/[0.03] rounded-lg border border-border/30 dark:border-white/[0.04]">
              <div className="flex gap-2.5">
                <Lightbulb size={14} className={`flex-shrink-0 mt-0.5 ${pillarColor}`} />
                <div>
                  <p className="text-[11px] font-bold text-text mb-1">Recommendation</p>
                  <p className="text-sm text-muted leading-relaxed">{finding.recommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Estimated Impact */}
          {finding.estimated_impact && (
            <div className="flex items-start gap-2.5 p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/40 dark:border-emerald-800/20">
              <TrendingUp size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-text mb-0.5">Expected Impact</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">{finding.estimated_impact}</p>
              </div>
            </div>
          )}

          {/* Screenshot with highlighted element */}
          {finding.screenshot_url && (
            <div className="rounded-lg overflow-hidden border border-border/30 dark:border-white/[0.04]">
              <div className="px-3 py-2 bg-surface-alt/60 dark:bg-white/[0.03] border-b border-border/20 dark:border-white/[0.04] flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${sev.dot}`} />
                <span className="text-[11px] font-semibold text-text">Visual Evidence</span>
                {finding.page_url && (
                  <span className="text-[10px] text-muted ml-auto font-mono truncate max-w-[200px]">
                    {(() => { try { const u = new URL(finding.page_url); return u.pathname + u.search; } catch { return finding.page_url; } })()}
                  </span>
                )}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={finding.screenshot_url}
                alt={`Screenshot showing: ${finding.title}`}
                className="w-full max-h-80 object-contain bg-white dark:bg-gray-900"
                loading="lazy"
              />
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
      className={`text-[11px] leading-snug mt-1.5 cursor-pointer text-text/70 hover:text-text transition-colors ${expanded ? '' : 'line-clamp-2'}`}
      title={expanded ? 'Click to collapse' : 'Click to read more'}
    >
      {text}
    </p>
  );
}

/* ── Pillar Section ───────────────────────────────────────── */
function PillarSection({
  pillar,
  categoryScores,
  findings,
}: {
  pillar: typeof PILLAR_CONFIG[number];
  categoryScores: Array<{ name: string; score: number; summary: string }>;
  findings: AuditFinding[];
}) {
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
      <div className={`rounded-2xl bg-gradient-to-r ${pillar.gradientSubtle} border ${pillar.border} p-5 mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center shadow-sm`}>
              {pillar.name === 'Foundation' && <Scale size={18} className="text-white" />}
              {pillar.name === 'Human Experience' && <Heart size={18} className="text-white" />}
              {pillar.name === 'Inclusive Design' && <Accessibility size={18} className="text-white" />}
              {pillar.name === 'Future Readiness' && <Brain size={18} className="text-white" />}
            </div>
            <div>
              <h2 className="font-manrope font-bold text-lg text-text">{pillar.name}</h2>
              <p className="text-xs text-muted">{pillarCats.length} categories evaluated</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold font-manrope ${scoreColor(avgScore)}`}>{avgScore}</p>
            <p className="text-[11px] text-muted">{scoreLabel(avgScore)}</p>
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
                  <p className="text-xs font-semibold text-text truncate flex-1">{cat.name}</p>
                  <span className={`text-xs font-bold flex-shrink-0 ${scoreColor(cat.score)}`}>
                    {cat.score}
                  </span>
                </div>
                <div className="w-full bg-border/15 dark:bg-white/[0.06] rounded-full h-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${pillar.scoreBg}`}
                    style={{ width: `${cat.score}%`, opacity: cat.score >= 70 ? 0.8 : cat.score >= 40 ? 0.7 : 0.9 }}
                  />
                </div>
                {cat.summary && (
                  <ExpandableSummary text={cat.summary} />
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
              <span className={`text-xs font-semibold ${pillar.iconColor}`}>{catName}</span>
              <span className="text-[11px] text-muted">
                {catFindings.length} finding{catFindings.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2">
              {sorted.map((finding) => (
                <FindingCard key={finding.id} finding={finding} pillarColor={pillar.iconColor} categoryName={catName} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'pages'>('overview');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

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
          setFindings(findingsRes.data || []);
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
        <div className="h-48 bg-off rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300 text-sm">{error || 'Audit not found'}</p>
        </div>
      </div>
    );
  }

  /* ── Derived state ─────────────────────────────────────── */
  const report = audit.report as Report | null;
  const meta = statusMeta[audit.status] || statusMeta.pending_payment;
  const StatusIcon = meta.icon;
  const isCompleted = audit.status === 'completed';
  const isInProgress = ['crawling', 'analysing', 'generating_report', 'payment_received'].includes(audit.status);
  const canDelete = audit.status === 'pending_payment';
  const currentStepIdx = getStepIndex(audit.status);

  // Parse category scores from report
  const rawJson = report?.raw_json as any;
  const categoryScores: Array<{ name: string; score: number; summary: string }> =
    rawJson?.categoryScores && Array.isArray(rawJson.categoryScores) ? rawJson.categoryScores : [];

  // Severity counts
  const severityCounts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  // Assign findings to pillars based on sort_order (findings come out in category order from the engine)
  function assignFindingsToPillars() {
    const perPillar: Record<string, AuditFinding[]> = {};
    for (const p of PILLAR_CONFIG) perPillar[p.name] = [];

    // Simple heuristic: distribute findings based on their sort_order
    // The engine processes categories 0-18 in order, so sort_order roughly maps to category index
    const totalFindings = findings.length;
    const totalCategories = 19;
    const findingsPerCategory = totalFindings / totalCategories;

    for (const f of findings) {
      const estimatedCatIdx = Math.min(
        Math.floor(f.sort_order / Math.max(1, findingsPerCategory)),
        totalCategories - 1,
      );
      const pillar = getPillarForCategory(estimatedCatIdx);
      perPillar[pillar.name].push(f);
    }

    return perPillar;
  }

  const findingsByPillar = assignFindingsToPillars();

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-manrope text-text mb-1 truncate">
            {formatUrl(audit.product_url)}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-muted text-sm">{formatDate(audit.created_at)}</p>
            <a
              href={audit.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 transition-colors"
            >
              <ExternalLink size={11} />
              Visit site
            </a>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canDelete && (
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting} disabled={deleting}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* ── Payment return: verifying ──────────────────────── */}
      {isPaymentReturn && verifying && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="text-violet-500 animate-spin" />
            <div>
              <p className="font-semibold text-text">Confirming your payment...</p>
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
                <p className="font-semibold text-text">Payment required</p>
                <p className="text-sm text-muted">Complete payment to start the audit.</p>
              </div>
            </div>
            <button
              onClick={handlePayNow}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white px-6 py-2.5 rounded-xl transition-all hover:brightness-110"
              style={{ background: 'var(--gradient-brand)' }}
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
            <StatusIcon size={20} className="text-violet-500" />
            <div>
              <p className="font-semibold text-text">{meta.label}</p>
              <p className="text-sm text-muted">{meta.description}</p>
            </div>
            <Loader2 size={16} className="text-violet-500 animate-spin ml-auto" />
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
                        !isActive && 'bg-off',
                        isCurrent && 'animate-pulse',
                      )}
                      style={isActive ? { background: 'var(--gradient-brand)' } : undefined}
                    />
                    <p className={clsx('text-xs font-medium mt-1.5', isActive ? 'text-violet-500' : 'text-muted')}>
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2.5 rounded-xl transition-all disabled:opacity-60 hover:brightness-110"
                style={{ background: 'var(--gradient-brand)' }}
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
              <p className="font-semibold text-red-900 dark:text-red-200">Audit failed</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                {audit.crawl_error || 'Something went wrong during processing.'}
              </p>
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
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
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all disabled:opacity-60 hover:brightness-110"
                  style={{ background: 'var(--gradient-brand)' }}
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
          <div className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card overflow-hidden mb-6 shadow-lg shadow-black/[0.03]">
            {/* Gradient top accent */}
            <div className="h-1.5" style={{ background: 'var(--gradient-brand)' }} />

            <div className="p-5 sm:p-6">
              {/* Mobile: centered stack — Desktop: horizontal row */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Score ring */}
                <div className="flex-shrink-0">
                  <ScoreRing score={report.overall_score ?? 0} size={110} strokeWidth={7} />
                </div>

                {/* Score details */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                    <h2 className="text-xl font-bold font-manrope text-text">Overall Score</h2>
                    <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                      (report.overall_score ?? 0) >= 70
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : (report.overall_score ?? 0) >= 40
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {scoreLabel(report.overall_score ?? 0)}
                    </span>
                  </div>

                  {/* Pillar mini-scores — 2-column grid on mobile, inline on desktop */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1.5 mt-3">
                    {PILLAR_CONFIG.map((pillar) => {
                      const pillarCats = categoryScores.filter((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
                      const avg = pillarCats.length > 0
                        ? Math.round(pillarCats.reduce((s, c) => s + c.score, 0) / pillarCats.length)
                        : 0;
                      return (
                        <div key={pillar.name} className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${pillar.badgeBg}`} />
                          <span className="text-xs text-muted">{pillar.name}</span>
                          <span className={`text-xs font-bold ${scoreColor(avg)}`}>{avg}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Download buttons — below pillar scores on mobile, stays in row on desktop */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-4">
                    <a href={`/api/reports/${auditId}/pdf`} target="_blank" rel="noopener noreferrer">
                      <button
                        className="flex items-center gap-2 text-xs font-semibold text-white px-4 py-2.5 rounded-xl transition-all hover:brightness-110 shadow-sm"
                        style={{ background: 'var(--gradient-brand)' }}
                      >
                        <Download size={14} />
                        PDF
                      </button>
                    </a>
                    <a href={`/api/reports/${auditId}/docx`} target="_blank" rel="noopener noreferrer">
                      <button className="flex items-center gap-2 bg-card border border-border text-text text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-surface-alt transition-colors">
                        <Download size={14} />
                        Word
                      </button>
                    </a>
                  </div>
                </div>
              </div>

              {/* Issue summary strip */}
              {report.total_issues > 0 && (
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 mt-5 pt-4 border-t border-border/30 dark:border-white/[0.04]">
                  <span className="text-sm font-semibold text-text">
                    {report.total_issues} issues found
                  </span>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    {severityCounts.critical > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        {severityCounts.critical} critical
                      </span>
                    )}
                    {severityCounts.high > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {severityCounts.high} high
                      </span>
                    )}
                    {severityCounts.medium > 0 && (
                      <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">{severityCounts.medium} medium</span>
                    )}
                    {severityCounts.low > 0 && (
                      <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">{severityCounts.low} low</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Page Screenshot ────────────────────────────── */}
          {auditPages[0]?.screenshot_url && (
            <div className="mb-6 rounded-2xl overflow-hidden border border-border/30 dark:border-white/[0.06] shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={auditPages[0].screenshot_url}
                alt="Website overview"
                className="w-full h-auto max-h-96 object-cover object-top"
                loading="lazy"
              />
              <div className="px-4 py-2 bg-card border-t border-border/20 dark:border-white/[0.03]">
                <p className="text-xs text-muted">Homepage captured during audit</p>
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
                  'flex-1 text-sm font-semibold py-2.5 rounded-lg transition-all',
                  activeTab === tab
                    ? 'bg-card text-text shadow-sm'
                    : 'text-muted hover:text-text',
                )}
              >
                {tab === 'overview' && 'Overview'}
                {tab === 'findings' && `Findings (${findings.length})`}
                {tab === 'pages' && `Pages (${auditPages.length})`}
              </button>
            ))}
          </div>

          {/* ── TAB: Overview ──────────────────────────────── */}
          {activeTab === 'overview' && (
            <>
              {/* Executive Summary */}
              {report.executive_summary && (
                <div className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card p-6 mb-6">
                  <h2 className="font-manrope font-bold text-lg text-text mb-3">Executive Summary</h2>
                  <div className="text-muted text-sm leading-relaxed whitespace-pre-line">
                    {report.executive_summary}
                  </div>
                  {(rawJson?.topRecommendations?.length > 0 || rawJson?.keyRecommendation) && (
                    <div className="mt-5 p-5 rounded-xl border border-violet-200/40 dark:border-violet-800/20" style={{ background: 'var(--gradient-brand-subtle)' }}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-brand)' }}>
                          <Zap size={14} className="text-white" />
                        </div>
                        <p className="text-sm font-bold text-text">Top Priority Recommendations</p>
                      </div>
                      <div className="space-y-3">
                        {(rawJson.topRecommendations || [rawJson.keyRecommendation]).filter(Boolean).map((rec: string, i: number) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5" style={{ background: 'var(--gradient-brand)' }}>
                              {i + 1}
                            </span>
                            <p className="text-sm text-text/80 leading-relaxed">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Research note */}
                  <div className="mt-4 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-surface-alt/60 dark:bg-white/[0.03] border border-border/30 dark:border-white/[0.04]">
                    <Lightbulb size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted leading-relaxed">
                      For deep qualitative research (user interviews, usability testing), we recommend pairing ClearUX findings with a specialist.
                    </p>
                  </div>
                </div>
              )}

              {/* Pillar Sections with scores and findings */}
              {categoryScores.length > 0 && PILLAR_CONFIG.map((pillar) => (
                <PillarSection
                  key={pillar.name}
                  pillar={pillar}
                  categoryScores={categoryScores}
                  findings={findingsByPillar[pillar.name] || []}
                />
              ))}

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
                        <FindingCard key={finding.id} finding={finding} pillarColor="text-violet-500" />
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
                  <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
                  <p className="text-text font-semibold">No issues found</p>
                  <p className="text-sm text-muted mt-1">Your site passed all checks.</p>
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
                        <span className={`text-sm font-bold ${config.text}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-muted">
                          {items.length} issue{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {items.map((finding) => (
                          <FindingCard key={finding.id} finding={finding} pillarColor="text-violet-500" />
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
                {auditPages.length} page{auditPages.length !== 1 ? 's' : ''} crawled and analysed during this audit
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
                        className="text-xs text-violet-500 hover:text-violet-600 hover:underline truncate block"
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

          {/* ── Bottom download CTA ────────────────────────── */}
          <div className="mt-8 mb-4 flex items-center justify-center gap-3">
            <a
              href={`/api/reports/${auditId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:brightness-110 shadow-md"
              style={{ background: 'var(--gradient-brand)' }}
            >
              <Download size={14} />
              Download PDF Report
            </a>
            <a
              href={`/api/reports/${auditId}/docx`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-card border border-border text-text text-sm font-semibold px-6 py-3 rounded-xl hover:bg-surface-alt transition-colors"
            >
              <Download size={14} />
              Download Word Report
            </a>
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
        <div className="h-48 bg-off rounded-2xl animate-pulse" />
      </div>
    }
  >
    <AuditDetailInner {...props} />
  </Suspense>
);

export default AuditDetailPage;
