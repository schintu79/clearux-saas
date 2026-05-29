'use client';

/**
 * Competitors — pure brand vs. competitors comparison.
 *
 * Every section on this page shows the audited brand alongside
 * competitor data in a grid. If a section has no comparative data
 * it is not shown. Non-comparative data (AI visibility by model,
 * visibility trend, sentiment themes) belongs on Brand Intelligence.
 */

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Target,
  Plus,
  Trash2,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Pencil,
  Eye,
  Zap,
  Shield,
  Users,
  Crown,
  BarChart3,
  ArrowRight,
  Bot,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import ScoreCircle, { getScoreColor } from '@/components/ui/ScoreCircle';
import SiteFavicon from '@/components/ui/SiteFavicon';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence';

/* ── Types ─────────────────────────────────────────── */

type Competitor = {
  domain: string;
  name?: string;
  score: number;
  pillarScores?: Array<{ name: string; score: number }>;
  category?: string;
  note?: string;
  source?: 'auto' | 'manual' | string;
};

type DraftCompetitor = {
  id: string;
  domain: string;
  score: number | null;
  source: 'auto' | 'manual';
  pillarScores?: Array<{ name: string; score: number }>;
  name?: string;
  category?: string;
  note?: string;
};

type PromptResult = {
  prompt_text: string;
  model_id: string;
  brand_mentioned: boolean;
  placement: number | null;
  sentiment_score: number | null;
  competitors_mentioned?: Array<{ name: string; placement: number }>;
};

/* ── Helpers ────────────────────────────────────────── */

function makeDraftId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

function fromServer(c: Competitor): DraftCompetitor {
  return {
    id: makeDraftId(),
    domain: c.domain,
    score: typeof c.score === 'number' ? c.score : null,
    source: (c.source === 'manual' ? 'manual' : 'auto'),
    pillarScores: c.pillarScores,
    name: c.name,
    category: c.category,
    note: c.note,
  };
}

const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
function normalizeDomainInput(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
}

const PILLAR_ICONS: Record<string, React.ReactNode> = {
  'Foundation': <Shield size={13} strokeWidth={1.75} />,
  'Human Experience': <Users size={13} strokeWidth={1.75} />,
  'Inclusive Design': <Eye size={13} strokeWidth={1.75} />,
  'Future Readiness': <Zap size={13} strokeWidth={1.75} />,
};

function deltaLabel(delta: number): { text: string; color: string; icon: React.ReactNode } {
  if (delta > 0) return { text: `+${delta}`, color: 'var(--ok)', icon: <TrendingUp size={12} /> };
  if (delta < 0) return { text: `${delta}`, color: 'var(--severe)', icon: <TrendingDown size={12} /> };
  return { text: '0', color: 'var(--m-muted)', icon: <Minus size={12} /> };
}

/* ── DashCard ──────────────────────────────────────── */

function DashCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>{children}</h2>;
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>{children}</p>;
}

/* ── Pillar computation (mirrors overview page logic) ── */

const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Brand Consistency'];
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]];

function computePillarScores(report: any): Array<{ name: string; score: number }> {
  const rawJson = report?.raw_json || report?.rawJson;
  const catScores: Array<{ name: string; score: number }> = rawJson?.categoryScores || [];
  if (catScores.length === 0) return [];
  return PILLAR_NAMES.map((name, i) => {
    const [start, end] = PILLAR_RANGES[i];
    const cats = catScores.filter((_c, idx) => idx >= start && idx < end && _c.score >= 0);
    return {
      name,
      score: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : -1,
    };
  }).filter(p => p.score >= 0);
}

/* ── Chart color palette ───────────────────────────── */

const CHART_COLORS = [
  '#C8A93E', // gold — brand (always first)
  '#4A7CDB', // blue
  '#3B8A6E', // teal
  '#D96B4D', // coral
  '#8B6BB5', // purple
  '#5AA3A3', // seafoam
];

/* ── AI Visibility Perception Card ──────────────────── */

type VisRankedEntry = {
  name: string;
  domain: string;
  visibility: number;
  isBrand: boolean;
  color: string;
};

function AIVisibilityPerceptionCard({
  brandName,
  brandDomain,
  brandAiVisibility,
  brandOverallScore,
  competitorMentions,
  drafts,
  trendSnapshots,
  loading,
}: {
  brandName: string;
  brandDomain: string | null;
  brandAiVisibility: number | null;
  /** Fallback score when no AI-specific visibility exists (overall report score). */
  brandOverallScore: number | null;
  competitorMentions: {
    brand: { mentions: number; avgPlacement: number };
    competitors: Array<{ name: string; mentions: number; avgPlacement: number; placements: number[] }>;
    totalPrompts: number;
  };
  drafts: DraftCompetitor[];
  trendSnapshots: any[];
  loading: boolean;
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Build ranked entries: brand + competitors by AI visibility %
  const { workspaceSlug: _ws } = useWorkspace();
  const dashPrefix = _ws ? `/dashboard/${_ws}` : '/dashboard';
  // Primary source: LLM probe mention data. Fallback: competitor_benchmarks scores.
  // The audited brand is ALWAYS included so the user can see their position.
  const rankedEntries = useMemo<VisRankedEntry[]>(() => {
    const entries: VisRankedEntry[] = [];

    // Resolve brand visibility: prefer explicit AI visibility score,
    // then compute from probe mention rate, finally fall back to overall score.
    // Mention rate is capped at 99 — 100% implies perfect AI coverage which is
    // unrealistic and confuses users ("no one can actually be 100%").
    let effectiveBrandVis: number | null = brandAiVisibility;
    if (effectiveBrandVis == null && competitorMentions.totalPrompts > 0) {
      effectiveBrandVis = Math.min(
        99,
        Math.round((competitorMentions.brand.mentions / competitorMentions.totalPrompts) * 100),
      );
    }

    // Primary: competitor entries from LLM probe mention rates
    const hasProbeCompetitors = competitorMentions.totalPrompts > 0 && competitorMentions.competitors.length > 0;
    if (hasProbeCompetitors) {
      // Always include the brand when probe data exists
      entries.push({
        name: brandName,
        domain: brandDomain || '',
        visibility: effectiveBrandVis ?? 0,
        isBrand: true,
        color: CHART_COLORS[0],
      });

      competitorMentions.competitors.forEach((cm, idx) => {
        const matchedDraft = drafts.find(d => d.domain.includes(cm.name) || (d.name || '').toLowerCase().includes(cm.name));
        const mentionRate = Math.min(99, Math.round((cm.mentions / competitorMentions.totalPrompts) * 100));
        entries.push({
          name: matchedDraft?.name || cm.name,
          domain: matchedDraft?.domain || cm.name,
          visibility: mentionRate,
          isBrand: false,
          color: CHART_COLORS[(idx + 1) % CHART_COLORS.length],
        });
      });
    } else if (drafts.length > 0) {
      // Fallback: use competitor_benchmarks scores when no probe competitor data exists.
      // Prefer AI visibility score if probes ran, otherwise fall back to overall score.
      const brandVis = effectiveBrandVis ?? brandOverallScore;
      if (brandVis != null) {
        entries.push({
          name: brandName,
          domain: brandDomain || '',
          visibility: Math.min(brandVis, 100),
          isBrand: true,
          color: CHART_COLORS[0],
        });
      }
      drafts.forEach((d, idx) => {
        entries.push({
          name: d.name || d.domain,
          domain: d.domain,
          visibility: d.score != null ? Math.min(d.score, 100) : 0,
          isBrand: false,
          color: CHART_COLORS[(idx + 1) % CHART_COLORS.length],
        });
      });
    } else if (effectiveBrandVis != null) {
      // No competitors at all but brand has AI visibility data — still show it
      entries.push({
        name: brandName,
        domain: brandDomain || '',
        visibility: effectiveBrandVis,
        isBrand: true,
        color: CHART_COLORS[0],
      });
    }

    return entries.sort((a, b) => b.visibility - a.visibility);
  }, [brandName, brandDomain, brandAiVisibility, brandOverallScore, competitorMentions, drafts]);

  // Historical trend data for the brand
  const brandTrend = useMemo(() => {
    const snaps = trendSnapshots
      .filter((s: any) => s.ai_visibility != null)
      .map((s: any) => ({
        date: new Date(s.snapshot_at),
        value: s.ai_visibility as number,
        label: new Date(s.snapshot_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }));
    return snaps.length >= 2 ? snaps : null;
  }, [trendSnapshots]);

  // Derive insight sentence — rewritten to explain mention share, not "ranking"
  const insightText = useMemo(() => {
    const competitorEntries = rankedEntries.filter(e => !e.isBrand);
    if (competitorEntries.length === 0) return null;
    const topCompetitor = competitorEntries[0];
    if (!topCompetitor) return null;

    if (competitorEntries.length === 1) {
      return `When asked about ${brandName}, AI models mention ${topCompetitor.name} ${topCompetitor.visibility}% of the time.`;
    }
    const bottomCompetitor = competitorEntries[competitorEntries.length - 1];
    if (topCompetitor.visibility > 50) {
      return `${topCompetitor.name} is the most referenced competitor at ${topCompetitor.visibility}% — AI strongly associates it with your market.`;
    }
    return `${topCompetitor.name} comes up most at ${topCompetitor.visibility}%, while ${bottomCompetitor.name} is only mentioned ${bottomCompetitor.visibility}% of the time.`;
  }, [rankedEntries, brandName]);

  // Skeleton loading
  if (loading) {
    return (
      <DashCard>
        <SectionTitle>Who does AI mention about you?</SectionTitle>
        <SectionDesc>Checking which competitors AI brings up when asked about your brand</SectionDesc>
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-4 rounded animate-pulse" style={{ background: 'var(--rule)' }} />
              <div className="flex-1 h-6 rounded animate-pulse" style={{ background: 'var(--rule)' }} />
              <div className="w-12 h-4 rounded animate-pulse" style={{ background: 'var(--rule)' }} />
            </div>
          ))}
        </div>
      </DashCard>
    );
  }

  // Empty state
  const hasCompetitorEntries = rankedEntries.some(e => !e.isBrand);
  if (rankedEntries.length === 0 || (!hasCompetitorEntries && rankedEntries.length < 2)) {
    const hasCompetitors = drafts.length > 0;
    return (
      <DashCard>
        <SectionTitle>Who does AI mention about you?</SectionTitle>
        <SectionDesc>We ask multiple AI models about your brand and track which competitors they reference</SectionDesc>
        <div className="text-center py-10">
          <MessageSquare size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
          <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
            {hasCompetitors ? 'AI mention data is being computed' : 'Not enough data yet'}
          </p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {hasCompetitors
              ? 'Competitor data uploaded. Run an audit with AI probes enabled to see who AI mentions alongside your brand.'
              : drafts.length === 0
                ? 'Run an audit with AI probes enabled, then add competitors to see how often AI brings them up.'
                : 'Add at least one competitor to see who AI associates with your brand.'}
          </p>
        </div>
      </DashCard>
    );
  }

  // Separate brand and competitor entries for display
  const brandEntry = rankedEntries.find(e => e.isBrand);
  const competitorEntries = rankedEntries.filter(e => !e.isBrand);
  const maxCompetitorVis = Math.max(...competitorEntries.map(e => e.visibility), 1);

  return (
    <DashCard>
      <div className="flex items-start justify-between mb-1">
        <div>
          <SectionTitle>Who does AI mention about you?</SectionTitle>
          <SectionDesc>We asked multiple AI models about your brand. Here&apos;s who they referenced.</SectionDesc>
        </div>
      </div>

      {/* ── Methodology explainer ────────────────────── */}
      <div
        className="mt-3 px-3.5 py-3 rounded-lg flex items-start gap-3"
        style={{ background: 'color-mix(in srgb, var(--signal) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 12%, transparent)' }}
      >
        {/* Mini flow: Bot → Questions → Mentions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)' }}
          >
            <Bot size={13} style={{ color: 'var(--signal)' }} />
          </div>
          <svg width="16" height="8" viewBox="0 0 16 8" fill="none" style={{ flexShrink: 0 }}>
            <path d="M0 4h12M10 1l3 3-3 3" stroke="var(--m-muted)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
          </svg>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)' }}
          >
            <MessageSquare size={13} style={{ color: 'var(--signal)' }} />
          </div>
        </div>
        <p className="text-[11.5px] leading-[1.5]" style={{ color: 'var(--ink)', opacity: 0.75 }}>
          We asked <strong>Claude, GPT-4, Gemini</strong>, and <strong>Perplexity</strong> about <strong>{brandName}</strong>.
          The % below shows how often each competitor was mentioned in AI responses — not a global ranking.
        </p>
      </div>

      {/* ── Brand mention rate (context row) ──────── */}
      {brandEntry && (
        <div
          className="mt-4 px-3.5 py-2.5 rounded-lg flex items-center justify-between"
          style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}
        >
          <div className="flex items-center gap-2.5">
            <SiteFavicon hostname={brandEntry.domain} size={16} />
            <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
              {brandEntry.name}
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)', color: 'var(--m-muted)' }}
            >
              Your brand
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{brandEntry.visibility}%</span>
            <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>mention rate</span>
          </div>
        </div>
      )}

      {/* ── Competitor mention chart ─────────────────── */}
      {competitorEntries.length > 0 && (
        <div className="mt-2 mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5 mt-3" style={{ color: 'var(--m-muted)' }}>
            Competitors mentioned in AI responses
          </p>
          <div ref={chartRef} className="space-y-2.5">
            {competitorEntries.map((entry, idx) => {
              const barWidth = maxCompetitorVis > 0 ? (entry.visibility / maxCompetitorVis) * 100 : 0;
              return (
                <div key={entry.domain + idx} className="flex items-center gap-3 group">
                  <span
                    className="w-5 text-[11px] font-bold tabular-nums text-center flex-shrink-0"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <SiteFavicon hostname={entry.domain} size={14} />
                      <span
                        className="text-[12px] font-medium truncate"
                        style={{ color: 'color-mix(in srgb, var(--ink) 80%, transparent)' }}
                      >
                        {entry.name}
                      </span>
                    </div>
                    <div className="w-full h-[22px] rounded-md overflow-hidden relative" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}>
                      <div
                        className="h-full rounded-md transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.max(barWidth, 2)}%`,
                          background: `color-mix(in srgb, ${entry.color} 50%, transparent)`,
                          opacity: 0.7,
                        }}
                      />
                      <span
                        className="absolute top-0 h-full flex items-center text-[11px] font-bold tabular-nums"
                        style={{
                          left: barWidth > 20 ? undefined : `${Math.max(barWidth, 3)}%`,
                          right: barWidth > 20 ? `max(4px, ${100 - barWidth + 1}%)` : undefined,
                          color: barWidth > 20 ? '#fff' : 'var(--ink)',
                          paddingLeft: barWidth > 20 ? undefined : '6px',
                          paddingRight: barWidth > 20 ? '8px' : undefined,
                          textShadow: barWidth > 20 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                        }}
                      >
                        {entry.visibility}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Trend sparkline (if historical data exists) ── */}
      {brandTrend && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--m-muted)' }}>
            {brandName} mention trend
          </p>
          <BrandTrendSparkline data={brandTrend} color={CHART_COLORS[0]} />
        </div>
      )}

      {/* ── Insight sentence ──────────────────────────── */}
      {insightText && (
        <div
          className="mt-4 px-3.5 py-2.5 rounded-lg text-[12px] leading-relaxed"
          style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)', color: 'var(--ink)' }}
        >
          <span className="font-semibold" style={{ color: 'var(--m-muted)' }}>Insight — </span>
          {insightText}
        </div>
      )}

      {/* ── Link to AI Perception tab ────────────────── */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
        <Link
          href={`${dashPrefix}/ai-perception`}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--m-muted)' }}
        >
          See full AI perception breakdown
          <ArrowRight size={12} />
        </Link>
      </div>
    </DashCard>
  );
}

/* ── Brand trend sparkline (SVG) ──────────────────── */

function BrandTrendSparkline({ data, color }: { data: Array<{ date: Date; value: number; label: string }>; color: string }) {
  const W = 600;
  const H = 80;
  const PAD_X = 40;
  const PAD_Y = 12;
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;

  const minV = Math.max(0, Math.min(...data.map(d => d.value)) - 5);
  const maxV = Math.min(100, Math.max(...data.map(d => d.value)) + 5);
  const rangeV = Math.max(maxV - minV, 1);

  const points = data.map((d, i) => {
    const x = PAD_X + (i / (data.length - 1)) * plotW;
    const y = PAD_Y + plotH - ((d.value - minV) / rangeV) * plotH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ');
  const areaD = pathD + ` L${points[points.length - 1].x},${H - PAD_Y} L${points[0].x},${H - PAD_Y} Z`;

  // Show ~4 labels evenly
  const labelStep = Math.max(1, Math.floor(data.length / 4));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 80 }}>
      {/* Gradient fill */}
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Start + end dots */}
      <circle cx={points[0].x} cy={points[0].y} r={3} fill={color} />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />

      {/* Value labels */}
      <text x={points[0].x} y={points[0].y - 7} textAnchor="middle" fontSize={9} fontWeight={600} fill={color}>{points[0].value}%</text>
      <text x={points[points.length - 1].x} y={points[points.length - 1].y - 7} textAnchor="middle" fontSize={9} fontWeight={600} fill={color}>{points[points.length - 1].value}%</text>

      {/* X-axis labels */}
      {points.filter((_, i) => i % labelStep === 0 || i === points.length - 1).map((p, i) => (
        <text key={i} x={p.x} y={H - 1} textAnchor="middle" fontSize={8} fill="var(--m-muted)">{p.label}</text>
      ))}
    </svg>
  );
}

/* ── Main Page ─────────────────────────────────────── */

export default function CompetitorsPage() {
  const { user, loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const { bundle, loading: bundleLoading } = useAuditBundle();
  // Show loading during initial load, bundle fetch, or site transition.
  // When bundle is null (site switch in progress), always show loading
  // to prevent any stale data flash from the previous site.
  const loading = authLoading || wsLoading || bundleLoading || !bundle;

  // Clear all local state when selection changes so no stale data from
  // a previous site is visible (AuditBundleContext now clears bundle to
  // null on selection change; this clears the page-level derived state).
  useEffect(() => {
    setBiSummary(null);
    setPromptResults([]);
    setIndustry(null);
    setBenchmarkPosition(null);
    setTrendSnapshots([]);
    setDrafts([]);
    setServerSnapshot([]);
  }, [workspace]);

  // Intelligence data
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
  const [promptResults, setPromptResults] = useState<PromptResult[]>([]);
  const [industry, setIndustry] = useState<string | null>(null);
  const [benchmarkPosition, setBenchmarkPosition] = useState<any>(null);
  const [trendSnapshots, setTrendSnapshots] = useState<any[]>([]);
  const [intelligenceLoading, setIntelligenceLoading] = useState(true);

  // Competitor management
  const [drafts, setDrafts] = useState<DraftCompetitor[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<DraftCompetitor[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Derive brand name and domain
  const audit = bundle?.audit;
  const productUrl = audit?.product_url || null;
  let domain: string | null = null;
  try { domain = new URL(productUrl || '').hostname.replace(/^www\./, ''); } catch {}
  const brandName = (audit as any)?.brand_name || domain || 'Your site';

  const canAddMore = drafts.length < 5;

  /* ── Load data ────────────────────────────────────── */

  useEffect(() => {
    if (!audit) {
      setDrafts([]); setServerSnapshot([]); setBenchmarkPosition(null);
      setIndustry(null); setBiSummary(null); setPromptResults([]);
      return;
    }

    const report = bundle?.report;
    if (report && (report as any).brand_intelligence) {
      setBiSummary((report as any).brand_intelligence as BrandIntelligenceSummary);
    }

    // Fetch intelligence data
    setIntelligenceLoading(true);
    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
        setPromptResults(d?.promptResults || []);
        setTrendSnapshots(d?.trendSnapshots || []);
      })
      .catch(() => {})
      .finally(() => setIntelligenceLoading(false));

    // Fetch competitors
    if (!productUrl) return;
    fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
        setDrafts(list);
        setServerSnapshot(list);
      })
      .catch(() => {});
  }, [bundle, productUrl, audit]);

  /* ── Competitor actions ─────────────────────────── */

  const addBlank = () => {
    if (!canAddMore) { setError('You can track up to 5 competitors.'); return; }
    setDrafts(prev => [...prev, { id: makeDraftId(), domain: '', score: null, source: 'manual' }]);
    setShowEditor(true);
  };

  const removeDraft = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id));

  const updateDraft = (id: string, field: keyof DraftCompetitor, value: string) =>
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));

  const saveCompetitors = async () => {
    if (!productUrl) return;
    setError(null); setSaving(true);
    const cleaned = drafts.filter(d => d.domain.trim()).map(d => ({ ...d, domain: normalizeDomainInput(d.domain) }));
    for (const c of cleaned) { if (!DOMAIN_RE.test(c.domain)) { setError(`Invalid domain: ${c.domain}`); setSaving(false); return; } }
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        body: JSON.stringify({ url: productUrl, mode: 'save', competitors: cleaned.map(c => ({ domain: c.domain, ...(c.name ? { name: c.name } : {}), ...(c.category ? { category: c.category } : {}), ...(c.note ? { note: c.note } : {}) })) }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      const next: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(next); setServerSnapshot(next); setShowEditor(false);
    } catch { setError('Failed to save.'); }
    setSaving(false);
  };

  const autoDetect = async () => {
    if (!productUrl) return;
    setDetecting(true); setError(null); setInfoMsg(null);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        body: JSON.stringify({ url: productUrl, mode: 'auto' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list); setServerSnapshot(list);
      setInfoMsg(list.length === 0 ? 'Could not identify competitors. Add them manually.' : 'Auto-detected. You can edit or add your own.');
    } catch { setError('Auto-detect failed.'); }
    setDetecting(false);
  };

  const rescan = async () => {
    if (!productUrl) return;
    setDetecting(true); setError(null);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        body: JSON.stringify({ url: productUrl, mode: 'manual', competitors: drafts.map(d => ({ domain: normalizeDomainInput(d.domain), ...(d.name ? { name: d.name } : {}) })) }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list); setServerSnapshot(list);
    } catch { setError('Rescan failed.'); }
    setDetecting(false);
  };

  const isDirty = useMemo(() => {
    if (drafts.length !== serverSnapshot.length) return true;
    return drafts.some((d, i) => d.domain !== serverSnapshot[i]?.domain || d.name !== serverSnapshot[i]?.name);
  }, [drafts, serverSnapshot]);

  /* ── Derived values ──────────────────────────────── */

  // Use the audit report as the single source of truth for the brand's score
  const report = bundle?.report;
  const userScore: number | null = (report as any)?.overall_score ?? null;

  // Compute real pillar scores from the same categoryScores the overview page uses
  const userPillarScores = useMemo(() => computePillarScores(report), [report]);

  const avgCompetitorScore = useMemo(() => {
    const scored = drafts.filter(c => c.score != null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, c) => s + (c.score || 0), 0) / scored.length);
  }, [drafts]);

  const userDelta = userScore != null && avgCompetitorScore != null
    ? userScore - avgCompetitorScore : null;

  // Sort competitors by score descending for ranking
  const rankedCompetitors = useMemo(() => {
    const all = [
      { domain: domain || '', name: brandName, score: userScore, isUser: true, pillarScores: userPillarScores },
      ...drafts.map(d => ({ domain: d.domain, name: d.name || d.domain, score: d.score, isUser: false, pillarScores: d.pillarScores })),
    ].filter(c => c.score != null);
    return all.sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [drafts, userScore, userPillarScores, brandName, domain]);

  const userRank = rankedCompetitors.findIndex(c => c.isUser) + 1;

  // Pillar names from competitor data
  const pillarNames = useMemo(() => {
    const first = drafts.find(c => c.pillarScores && c.pillarScores.length > 0);
    return first?.pillarScores?.map(p => p.name) || [];
  }, [drafts]);

  // Competitor mentions from prompt results — this IS comparative
  const competitorMentions = useMemo(() => {
    const map = new Map<string, { mentions: number; avgPlacement: number; placements: number[] }>();
    // Count brand mentions
    let brandMentions = 0;
    let brandPlacements: number[] = [];
    promptResults.forEach(pr => {
      if (pr.brand_mentioned) {
        brandMentions++;
        if (pr.placement != null) brandPlacements.push(pr.placement);
      }
      pr.competitors_mentioned?.forEach(cm => {
        const key = cm.name.toLowerCase();
        const existing = map.get(key) || { mentions: 0, avgPlacement: 0, placements: [] };
        existing.mentions++;
        if (cm.placement) existing.placements.push(cm.placement);
        map.set(key, existing);
      });
    });
    map.forEach((v) => {
      v.avgPlacement = v.placements.length > 0
        ? Math.round((v.placements.reduce((a, b) => a + b, 0) / v.placements.length) * 10) / 10
        : 0;
    });
    const competitors = Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, isUser: false }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 8);

    // Insert brand at top for comparison
    const brandAvgPlacement = brandPlacements.length > 0
      ? Math.round((brandPlacements.reduce((a, b) => a + b, 0) / brandPlacements.length) * 10) / 10
      : 0;

    return {
      brand: { mentions: brandMentions, avgPlacement: brandAvgPlacement },
      competitors,
      totalPrompts: promptResults.length,
    };
  }, [promptResults]);

  /* ── Render ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--m-muted)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!bundle?.audit) return <EmptyAudit />;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Target size={18} strokeWidth={1.75} />}
        title="Competitors"
        subtitle={`Competitive positioning for ${brandName}`}
      >
        {drafts.length > 0 && (
          <button
            onClick={rescan}
            disabled={detecting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <RefreshCw size={12} className={detecting ? 'animate-spin' : ''} />
            {detecting ? 'Scanning...' : 'Rescan'}
          </button>
        )}
        {drafts.length === 0 && (
          <button
            onClick={autoDetect}
            disabled={detecting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Search size={12} />
            {detecting ? 'Detecting...' : 'Auto-detect'}
          </button>
        )}
      </PageHeader>

      {/* ══════════════════════════════════════════════════
          1. HERO — Score + stat cards
         ══════════════════════════════════════════════════ */}
      <DashCard>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Score circle */}
          <div className="flex-shrink-0">
            <ScoreCircle score={userScore} size="big" />
          </div>

          {/* Right side — brand name + stat grid */}
          <div className="flex-1 min-w-0">
            {/* Brand identity */}
            <div className="flex items-center gap-2.5 mb-4">
              <SiteFavicon hostname={domain || ''} size={18} />
              <h2 className="text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>{brandName}</h2>
              {industry && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-[12px] font-medium"
                  style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)', color: 'var(--ink)' }}
                >
                  {industry}
                </span>
              )}
            </div>

            {/* Stat cards grid */}
            <div className="flex flex-wrap gap-3">
              {/* Rank */}
              {userRank > 0 && rankedCompetitors.length > 1 && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
                >
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: 'var(--ink)' }}>
                    #{userRank}
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Rank</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--m-muted)' }}>of {rankedCompetitors.length} brands</p>
                  </div>
                </div>
              )}

              {/* Delta vs competitor avg */}
              {userDelta != null && (() => {
                const dColor = userDelta > 0 ? 'var(--ok)' : userDelta < 0 ? 'var(--severe)' : 'var(--m-muted)';
                return (
                  <div
                    className="flex items-center gap-3 px-4 py-3 rounded-lg"
                    style={{ background: `color-mix(in srgb, ${dColor} 6%, transparent)` }}
                  >
                    <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: dColor }}>
                      {userDelta > 0 ? '+' : ''}{userDelta}
                    </span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Gap</p>
                      <p className="text-[12px] font-medium" style={{ color: 'var(--m-muted)' }}>vs. competitor avg</p>
                    </div>
                  </div>
                );
              })()}

              {/* Industry benchmark */}
              {benchmarkPosition?.benchmark && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
                >
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: 'var(--ink)' }}>
                    {benchmarkPosition.benchmark.avgScore ?? benchmarkPosition.benchmark}
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Industry avg</p>
                    {benchmarkPosition.percentile != null && (
                      <p className="text-[12px] font-medium" style={{ color: 'var(--m-muted)' }}>Top {100 - benchmarkPosition.percentile}% in sector</p>
                    )}
                  </div>
                </div>
              )}

              {/* AI share of voice */}
              {biSummary?.shareOfVoice != null && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
                >
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: 'var(--ink)' }}>
                    {biSummary.shareOfVoice}%
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>AI voice</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--m-muted)' }}>Share of mentions</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashCard>

      {/* ══════════════════════════════════════════════════
          2. COMPETITOR COMPARISON — Unified scoring table
         ══════════════════════════════════════════════════ */}
      <DashCard>
        <div className="flex items-center justify-between mb-1">
          <SectionTitle>Competitors overview</SectionTitle>
          <div className="flex items-center gap-2">
            {/* Edit button */}
            {drafts.length > 0 && (
              <button
                onClick={() => setShowEditor(!showEditor)}
                className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors"
                style={showEditor
                  ? { background: 'var(--signal)', color: '#fff', border: '1px solid var(--signal)' }
                  : { color: 'var(--ink)', border: '1px solid var(--rule)' }
                }
              >
                {showEditor ? <X size={12} /> : <Pencil size={12} />}
                {showEditor ? 'Done editing' : 'Edit'}
              </button>
            )}
            {/* Add button */}
            <button
              onClick={addBlank}
              disabled={!canAddMore}
              className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors"
              style={{
                color: canAddMore ? 'var(--ink)' : 'var(--m-muted)',
                border: '1px solid var(--rule)',
                opacity: canAddMore ? 1 : 0.5,
                cursor: canAddMore ? 'pointer' : 'default',
              }}
            >
              <Plus size={12} />
              Add
              {!canAddMore && <span className="text-[10px] ml-0.5">(5/5)</span>}
            </button>
          </div>
        </div>
        <SectionDesc>
          {brandName} vs. competitors — overall and category scores.
          {drafts.some(c => c.source === 'auto') && (
            <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}>
              <Info size={10} />
              Competitor scores are estimated from site analysis
            </span>
          )}
        </SectionDesc>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md mb-3" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--severe)' }}>
            <AlertCircle size={13} />
            <span className="text-[12px]">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}
        {infoMsg && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md mb-3" style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--ok)' }}>
            <Info size={13} />
            <span className="text-[12px]">{infoMsg}</span>
            <button onClick={() => setInfoMsg(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {/* Edit mode banner */}
        {showEditor && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md mb-3 text-[12px] font-medium"
            style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)', color: 'var(--signal)', border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)' }}
          >
            <Pencil size={12} />
            Editing competitors — change domains, remove entries, then press Save.
          </div>
        )}

        {drafts.length === 0 && !showEditor ? (
          <div className="text-center py-10">
            <Target size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>No competitors tracked yet</p>
            <p className="text-[12px] mt-1 mb-4" style={{ color: 'var(--m-muted)' }}>Use auto-detect to find competitors in your industry, or add them manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5" style={showEditor ? { borderLeft: '3px solid var(--signal)', paddingLeft: '17px' } : undefined}>
            <table className="w-full text-[12px]" style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                  <th className="text-left py-2 pr-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Brand</th>
                  <th className="hidden sm:table-cell text-left py-2 px-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Domain</th>
                  <th className="text-center py-2 px-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Overall</th>
                  {pillarNames.map(p => (
                    <th key={p} className="text-center py-2 px-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>
                      <div className="flex items-center justify-center gap-1">
                        {PILLAR_ICONS[p] || null}
                        {p}
                      </div>
                    </th>
                  ))}
                  <th className="hidden sm:table-cell text-center py-2 px-2 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Source</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {/* Ranked rows — brand shown at its actual rank position */}
                {rankedCompetitors.map((entry, idx) => {
                  if (entry.isUser) {
                    // User's brand row — highlighted
                    return (
                      <tr key="user-brand" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', borderBottom: '1px solid var(--rule)' }}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] font-bold tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{idx + 1}</span>
                            <SiteFavicon hostname={domain || ''} size={16} />
                            <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{brandName}</span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell py-3 px-3 text-[12px] truncate" style={{ color: 'var(--m-muted)' }}>{domain}</td>
                        <td className="text-center py-3 px-3 text-[14px] font-bold tabular-nums" style={{ color: userScore != null ? getScoreColor(userScore) : 'var(--m-muted)' }}>
                          {userScore ?? '--'}
                        </td>
                        {pillarNames.map(p => {
                          const pillar = userPillarScores.find(ps => ps.name === p);
                          const pScore = pillar?.score ?? null;
                          return (
                            <td key={p} className="text-center py-3 px-3 tabular-nums font-semibold" style={{ color: pScore != null ? getScoreColor(pScore) : 'var(--m-muted)' }}>
                              {pScore ?? '--'}
                            </td>
                          );
                        })}
                        <td className="hidden sm:table-cell text-center py-3 px-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--ok) 10%, transparent)', color: 'var(--ok)' }}>
                            Audited
                          </span>
                        </td>
                        <td />
                      </tr>
                    );
                  }

                  // Competitor row
                  const c = drafts.find(d => d.domain === entry.domain);
                  if (!c) return null;
                  return (
                    <tr key={c.id} className="hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--rule)' }}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] font-bold tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{idx + 1}</span>
                          <SiteFavicon hostname={c.domain} size={16} />
                          {showEditor ? (
                            <input
                              type="text"
                              value={c.domain}
                              onChange={e => updateDraft(c.id, 'domain', e.target.value)}
                              placeholder="competitor.com"
                              className="w-full text-[13px] outline-none font-medium px-2 py-0.5 rounded"
                              style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--signal) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 25%, transparent)' }}
                            />
                          ) : (
                            <span className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name || c.domain}</span>
                          )}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell py-2.5 px-3 text-[12px] truncate" style={{ color: 'var(--m-muted)' }}>{c.domain}</td>
                      <td className="text-center py-2.5 px-3 text-[13px] font-bold tabular-nums" style={{ color: c.score != null ? getScoreColor(c.score) : 'var(--m-muted)' }}>
                        {c.score != null ? c.score : '--'}
                      </td>
                      {pillarNames.length > 0 && (c.pillarScores && c.pillarScores.length > 0) ? (
                        c.pillarScores.map(p => (
                          <td key={p.name} className="text-center py-2.5 px-3 tabular-nums" style={{ color: getScoreColor(p.score) }}>
                            {p.score}
                          </td>
                        ))
                      ) : pillarNames.length > 0 ? (
                        pillarNames.map(p => (
                          <td key={p} className="text-center py-2.5 px-3 text-[12px]" style={{ color: 'var(--m-muted)' }}>--</td>
                        ))
                      ) : null}
                      <td className="hidden sm:table-cell text-center py-2.5 px-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize" style={{
                          background: c.source === 'auto' ? 'color-mix(in srgb, var(--warn) 10%, transparent)' : 'color-mix(in srgb, var(--ink) 6%, transparent)',
                          color: c.source === 'auto' ? 'var(--warn)' : 'var(--m-muted)',
                        }}>
                          {c.source === 'auto' ? 'Estimated' : 'Manual'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <button onClick={() => removeDraft(c.id)} className="p-1 rounded hover:bg-black/[0.04] transition-colors" title="Remove">
                          <Trash2 size={13} style={{ color: 'var(--m-muted)' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Unscored competitors (not in rankedCompetitors) */}
                {drafts.filter(c => c.score == null).map((c) => (
                  <tr key={c.id} className="hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--m-muted)' }}>--</span>
                        <SiteFavicon hostname={c.domain} size={16} />
                        {showEditor ? (
                          <input
                            type="text"
                            value={c.domain}
                            onChange={e => updateDraft(c.id, 'domain', e.target.value)}
                            placeholder="competitor.com"
                            className="w-full text-[13px] bg-transparent outline-none font-medium"
                            style={{ color: 'var(--ink)' }}
                          />
                        ) : (
                          <span className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name || c.domain}</span>
                        )}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell py-2.5 px-3 text-[12px] truncate" style={{ color: 'var(--m-muted)' }}>{c.domain}</td>
                    <td className="text-center py-2.5 px-3 text-[13px] font-bold tabular-nums" style={{ color: 'var(--m-muted)' }}>--</td>
                    {pillarNames.map(p => (
                      <td key={p} className="text-center py-2.5 px-3 text-[12px]" style={{ color: 'var(--m-muted)' }}>--</td>
                    ))}
                    <td className="hidden sm:table-cell text-center py-2.5 px-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded capitalize" style={{
                        background: c.source === 'auto' ? 'color-mix(in srgb, var(--warn) 10%, transparent)' : 'color-mix(in srgb, var(--ink) 6%, transparent)',
                        color: c.source === 'auto' ? 'var(--warn)' : 'var(--m-muted)',
                      }}>
                        {c.source === 'auto' ? 'Estimated' : 'Manual'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <button onClick={() => removeDraft(c.id)} className="p-1 rounded hover:bg-black/[0.04] transition-colors" title="Remove">
                        <Trash2 size={13} style={{ color: 'var(--m-muted)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Save bar — only when there are unsaved changes */}
        {isDirty && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              onClick={saveCompetitors}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all hover:opacity-90"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <Save size={12} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </DashCard>

      {/* ══════════════════════════════════════════════════
          3. AI VISIBILITY PERCEPTION — Ranked trend chart
         ══════════════════════════════════════════════════ */}
      <AIVisibilityPerceptionCard
        brandName={brandName}
        brandDomain={domain}
        brandAiVisibility={biSummary?.aiVisibility ?? null}
        brandOverallScore={userScore}
        competitorMentions={competitorMentions}
        drafts={drafts}
        trendSnapshots={trendSnapshots}
        loading={intelligenceLoading}
      />

      {/* ══════════════════════════════════════════════════
          4. AI MENTIONS — Brand vs competitors in AI responses
         ══════════════════════════════════════════════════ */}
      {competitorMentions.competitors.length > 0 && competitorMentions.totalPrompts > 0 && (
        <DashCard>
          <SectionTitle>AI mention comparison</SectionTitle>
          <SectionDesc>
            How often each brand appears when AI models answer {competitorMentions.totalPrompts} industry questions.
          </SectionDesc>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-[12px]" style={{ minWidth: 400 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                  <th className="text-left py-2 pr-4 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Brand</th>
                  <th className="text-center py-2 px-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Mentions</th>
                  <th className="text-center py-2 px-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Mention rate</th>
                  <th className="text-center py-2 px-3 font-semibold text-[11px] uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Avg placement</th>
                </tr>
              </thead>
              <tbody>
                {/* Brand row — highlighted */}
                <tr style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <SiteFavicon hostname={domain || ''} size={16} />
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{brandName}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-3 text-[13px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {competitorMentions.brand.mentions}
                  </td>
                  <td className="text-center py-3 px-3 text-[13px] font-semibold tabular-nums" style={{ color: competitorMentions.totalPrompts > 0 ? getScoreColor(Math.round((competitorMentions.brand.mentions / competitorMentions.totalPrompts) * 100)) : 'var(--m-muted)' }}>
                    {competitorMentions.totalPrompts > 0 ? `${Math.round((competitorMentions.brand.mentions / competitorMentions.totalPrompts) * 100)}%` : '--'}
                  </td>
                  <td className="text-center py-3 px-3 text-[13px] font-semibold tabular-nums" style={{ color: competitorMentions.brand.avgPlacement > 0 && competitorMentions.brand.avgPlacement <= 2 ? 'var(--ok)' : competitorMentions.brand.avgPlacement <= 3 ? 'var(--warn)' : 'var(--m-muted)' }}>
                    {competitorMentions.brand.avgPlacement > 0 ? `#${competitorMentions.brand.avgPlacement}` : '--'}
                  </td>
                </tr>

                {/* Competitor rows */}
                {competitorMentions.competitors.map(cm => {
                  const matchedDraft = drafts.find(d => d.domain.includes(cm.name) || (d.name || '').toLowerCase().includes(cm.name));
                  const mentionRate = competitorMentions.totalPrompts > 0 ? Math.round((cm.mentions / competitorMentions.totalPrompts) * 100) : 0;
                  return (
                    <tr key={cm.name} className="hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--rule)' }}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {matchedDraft ? (
                            <SiteFavicon hostname={matchedDraft.domain} size={16} />
                          ) : (
                            <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--ink) 10%, transparent)' }} />
                          )}
                          <span className="text-[13px] font-medium capitalize truncate" style={{ color: 'var(--ink)' }}>{cm.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-2.5 px-3 text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                        {cm.mentions}
                      </td>
                      <td className="text-center py-2.5 px-3 text-[13px] tabular-nums" style={{ color: getScoreColor(mentionRate) }}>
                        {mentionRate}%
                      </td>
                      <td className="text-center py-2.5 px-3 text-[13px] tabular-nums" style={{ color: cm.avgPlacement <= 2 ? 'var(--ok)' : cm.avgPlacement <= 3 ? 'var(--warn)' : 'var(--severe)' }}>
                        {cm.avgPlacement > 0 ? `#${cm.avgPlacement}` : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashCard>
      )}
    </div>
  );
}
