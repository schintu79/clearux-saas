'use client';

/**
 * Brand Intelligence — Visual card-based dashboard.
 *
 * 2×2 card grid:
 *  1. AI Master Overview — 4 key metrics (score, visibility, placement, sentiment)
 *  2. AI Model Performance — per-model accuracy with expandable evidence
 *  3. Competitive Benchmark — comparison table + industry position (merges SoV)
 *  4. Sentiment & Signals — positive/negative themes + human signals feed
 *
 * Additional detail: Fix & Improve panel below the grid when data exists.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Radio,
  BarChart3,
  LineChart,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Plus,
  Trash2,
  Save,
  X,
  Pencil,
  RefreshCw,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  MessageSquare,
  Target,
  Zap,
  Wrench,
  FileText,
  Code,
  Star,
  Globe,
  Users,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import ScoreCircle from '@/components/ui/ScoreCircle';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import type { BrandIntelligenceSummary, ModelSentiment } from '@/lib/audit-engine/brand-intelligence';

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

type BenchmarkPosition = {
  userScore?: number;
  deltaFromAvg?: number;
  benchmark?: { avgScore: number; sampleSize?: number };
  comparedAgainst?: string;
};

type ModelProbe = {
  model_id: string;
  model_label: string;
  accuracy_score: number;
  results_json?: Array<{ question: string; answer: string; accuracy: string | null }>;
  sentiment_score?: number | null;
  sentiment_themes?: Array<{ theme: string; polarity: string; count: number }>;
  placement_score?: number | null;
  status?: 'measured' | 'skipped' | 'error' | null;
};

type AuditRecommendation = {
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  deployable: boolean;
  fixType?: string;
};

/* ── Helpers ────────────────────────────────────────── */

function scoreColorVar(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function sentimentLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Positive', color: 'var(--ok)' };
  if (score >= 40) return { label: 'Neutral', color: 'var(--warn)' };
  return { label: 'Negative', color: 'var(--severe)' };
}

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

function placementDisplay(p: number | null): { label: string; color: string } {
  if (p == null) return { label: '--', color: 'var(--m-muted)' };
  if (p <= 1.5) return { label: p.toFixed(1), color: 'var(--ok)' };
  if (p <= 2.5) return { label: p.toFixed(1), color: 'var(--ok)' };
  if (p <= 3.5) return { label: p.toFixed(1), color: 'var(--warn)' };
  return { label: p.toFixed(1), color: 'var(--severe)' };
}

/* ── Main Page ─────────────────────────────────────── */

export default function IntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || wsLoading || bundleLoading || !bundle;

  // Brand Intelligence data
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
  const [modelProbes, setModelProbes] = useState<ModelProbe[]>([]);
  const [recommendations, setRecommendations] = useState<AuditRecommendation[]>([]);

  // Benchmark data
  const [drafts, setDrafts] = useState<DraftCompetitor[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<DraftCompetitor[]>([]);
  const [benchmarkPosition, setBenchmarkPosition] = useState<BenchmarkPosition | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Human Perception data (Tier 2)
  const [humanPerception, setHumanPerception] = useState<any>(null);
  const [redditMentions, setRedditMentions] = useState<any[]>([]);
  const [webMentions, setWebMentions] = useState<any[]>([]);
  const [reviewData, setReviewData] = useState<any[]>([]);
  const [trendSnapshots, setTrendSnapshots] = useState<any[]>([]);

  // UI state
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showCompetitorEditor, setShowCompetitorEditor] = useState(false);
  const [signalFilter, setSignalFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setDrafts([]); setServerSnapshot([]); setBenchmarkPosition(null); setIndustry(null);
      setBiSummary(null); setModelProbes([]); setRecommendations([]);
      setHumanPerception(null); setRedditMentions([]); setWebMentions([]);
      setReviewData([]); setTrendSnapshots([]);
      return;
    }

    const report = bundle?.report;
    if (report && (report as any).brand_intelligence) {
      setBiSummary((report as any).brand_intelligence as BrandIntelligenceSummary);
    }

    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
        if (d?.modelProbes) setModelProbes(d.modelProbes);
        if (d?.recommendations) setRecommendations(d.recommendations);
        setHumanPerception(d?.humanPerception || null);
        setRedditMentions(d?.redditMentions || []);
        setWebMentions(d?.webMentions || []);
        setReviewData(d?.reviewData || []);
        setTrendSnapshots(d?.trendSnapshots || []);
      })
      .catch(() => {});

    const productUrl = audit.product_url;
    if (productUrl) {
      fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
        .then(r => r.json())
        .then(d => {
          const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
          setDrafts(list); setServerSnapshot(list);
          if (d?.industry) setIndustry(d.industry);
        })
        .catch(() => {});
    }
  }, [bundle]);

  const productUrl = bundle?.audit?.product_url || '';
  const isBrandAudit = bundle?.audit && (bundle.audit as any).audit_type === 'brand_identity';
  const overallScore = bundle?.report?.overall_score ?? 0;

  const userPillarScores = useMemo(() => {
    const report = bundle?.report;
    if (!report) return [];
    const modules: Array<{ name: string; scoreKey: string }> = [
      { name: 'Foundation', scoreKey: 'content_score' },
      { name: 'Human Experience', scoreKey: 'ux_score' },
      { name: 'Inclusive Design', scoreKey: 'mobile_score' },
      { name: 'Future Readiness', scoreKey: 'ai_discoverability_score' },
      { name: 'Brand Consistency', scoreKey: 'overall_score' },
      { name: 'SEO Structure', scoreKey: 'conversion_score' },
    ];
    return modules
      .map(m => ({ name: m.name, score: (report as any)[m.scoreKey] as number | null }))
      .filter(m => m.score != null && m.score > 0);
  }, [bundle?.report]);

  const hasRealHumanData = (reviewData.length > 0 || redditMentions.length > 0 || webMentions.length > 0);
  const hp = humanPerception;
  const scoredDrafts = drafts.filter(d => typeof d.score === 'number' && d.score > 0);
  const humanSentimentScore = hp?.socialSentiment ?? (hp?.reviewScore != null ? Math.round(hp.reviewScore * 20) : null);

  // Computed averages for AI Master Overview
  const avgPlacement = useMemo(() => {
    const placements = modelProbes.map(p => p.placement_score).filter((p): p is number => p != null);
    return placements.length > 0 ? placements.reduce((a, b) => a + b, 0) / placements.length : null;
  }, [modelProbes]);

  // All human signals merged
  const allSignals = useMemo(() => {
    const signals: Array<{ type: string; title: string; source: string; sourceUrl?: string; sentiment: string; date?: string; score?: number }> = [];
    redditMentions.forEach((m: any) => signals.push({
      type: 'reddit', title: m.post_title, source: `r/${m.subreddit}`, sourceUrl: m.post_url,
      sentiment: m.sentiment || 'neutral', date: m.created_at, score: m.score,
    }));
    webMentions.forEach((m: any) => signals.push({
      type: 'web', title: m.title, source: m.source_domain, sourceUrl: m.source_url,
      sentiment: m.sentiment || 'neutral', date: m.fetched_at,
    }));
    reviewData.forEach((r: any) => signals.push({
      type: 'review', title: `${r.platform} — ${r.aggregate_score}/5 (${r.review_count} reviews)`,
      source: r.platform, sentiment: r.aggregate_score >= 4 ? 'positive' : r.aggregate_score >= 3 ? 'neutral' : 'negative',
      score: r.aggregate_score,
    }));
    return signals;
  }, [redditMentions, webMentions, reviewData]);

  const filteredSignals = signalFilter === 'all' ? allSignals : allSignals.filter(s => s.sentiment === signalFilter);

  // Competitor helpers
  const isDirty = useMemo(() => {
    if (drafts.length !== serverSnapshot.length) return true;
    const a = drafts.map(c => c.domain).sort();
    const b = serverSnapshot.map(c => c.domain).sort();
    return a.some((v, i) => v !== b[i]);
  }, [drafts, serverSnapshot]);

  const addRow = () => {
    setError(null); setInfo(null);
    if (drafts.length >= 5) { setError('You can track up to 5 competitors.'); return; }
    setDrafts(prev => [...prev, { id: makeDraftId(), domain: '', score: null, source: 'manual' }]);
  };
  const updateRow = (id: string, patch: Partial<DraftCompetitor>) => setDrafts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeRow = (id: string) => setDrafts(prev => prev.filter(c => c.id !== id));
  const resetEdits = () => { setDrafts(serverSnapshot); setError(null); setInfo(null); };

  const validate = (): { ok: true; cleaned: DraftCompetitor[] } | { ok: false; message: string } => {
    const cleaned: DraftCompetitor[] = [];
    const seen = new Set<string>();
    for (const d of drafts) {
      const dom = normalizeDomainInput(d.domain);
      if (!dom) return { ok: false, message: 'Every competitor needs a domain.' };
      if (!DOMAIN_RE.test(dom)) return { ok: false, message: `"${d.domain}" is not a valid domain (e.g. example.com).` };
      if (seen.has(dom)) return { ok: false, message: `"${dom}" is listed twice. Remove duplicates.` };
      seen.add(dom);
      cleaned.push({ ...d, domain: dom });
    }
    return { ok: true, cleaned };
  };

  const saveDrafts = async () => {
    if (!productUrl) return;
    setError(null); setInfo(null);
    const v = validate();
    if (!v.ok) { setError((v as { ok: false; message: string }).message); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, mode: 'save', competitors: v.cleaned.map(c => ({ domain: c.domain, ...(c.name ? { name: c.name } : {}), ...(c.category ? { category: c.category } : {}), ...(c.note ? { note: c.note } : {}) })) }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Failed to save'); }
      const d = await res.json();
      const next: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(next); setServerSnapshot(next);
      setInfo('Saved. Click Re-scan to refresh scores.');
    } catch (e: any) { setError(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const runAutoDetect = async () => {
    if (!productUrl) return;
    setError(null); setInfo(null); setDetecting(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, mode: 'auto' }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Auto-detect failed'); }
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list); setServerSnapshot(list);
      if (d?.industry) setIndustry(d.industry);
      setInfo(list.length === 0 ? 'Could not identify competitors. Add them manually.' : 'Auto-detected. You can edit or add your own.');
    } catch (e: any) { setError(e?.message || 'Auto-detect failed'); }
    finally { setDetecting(false); }
  };

  const rescanScores = async () => {
    if (!productUrl) return;
    const domainsOnly = drafts.map(d => normalizeDomainInput(d.domain)).filter(Boolean);
    if (domainsOnly.length === 0) { setError('Add at least one competitor before re-scanning.'); return; }
    setError(null); setInfo(null); setDetecting(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, mode: 'manual', competitors: drafts.map(d => ({ domain: normalizeDomainInput(d.domain), ...(d.name ? { name: d.name } : {}) })) }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Re-scan failed'); }
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list); setServerSnapshot(list); setInfo('Re-scan complete.');
    } catch (e: any) { setError(e?.message || 'Re-scan failed'); }
    finally { setDetecting(false); }
  };

  const pillarNames = useMemo(() => {
    const names = new Set<string>();
    scoredDrafts.forEach(d => d.pillarScores?.forEach(p => names.add(p.name)));
    return Array.from(names);
  }, [scoredDrafts]);

  /* ── Render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-[220px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!bundle?.audit || !bundle.report) {
    return (
      <div>
        <OverviewBreadcrumb current="Brand Intelligence" />
        <PageHeader
          icon={<Radio size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
          title="Brand Intelligence"
          subtitle={workspace ? 'No audit for this brand yet.' : 'Pick a brand or run an audit to unlock brand intelligence.'}
        />
        <EmptyAudit
          title="No intelligence yet"
          body="Run a Fixpath audit to see how AI and humans perceive your brand, with actionable fixes."
        />
      </div>
    );
  }

  const sentimentScore = biSummary?.overallSentiment ?? null;
  const visibilityScore = biSummary?.shareOfVoice ?? null;

  return (
    <div>
      <OverviewBreadcrumb current="Brand Intelligence" />
      <PageHeader
        icon={<Radio size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Brand Intelligence"
        subtitle="How AI and humans perceive your brand — and what to do about it"
      />

      {/* ═══════════════════════════════════════════════════════════
          2×2 Card Grid
         ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* ── Card 1: AI Master Overview (full-width hero) ── */}
        <DashCard className="lg:col-span-2">
          <CardHeader title="AI Master Overview" subtitle="Your brand's presence, accuracy, and perception across AI models" />
          {biSummary || overallScore > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <MetricDonut label="Performance Score" value={overallScore} />
              <MetricDonut label="AI Visibility" value={visibilityScore} suffix="%" />
              <MetricDonut label="Avg. Placement" value={avgPlacement} isPlacement />
              <MetricDonut label="Sentiment Score" value={sentimentScore} />
            </div>
          ) : (
            <EmptyCardBody message="Run an audit with the Brand module enabled to generate AI performance metrics." />
          )}
        </DashCard>

        {/* ── Card 2: AI Model Performance ── */}
        <DashCard>
          <CardHeader title="AI Model Performance" subtitle="How each AI model perceives your brand" />
          {modelProbes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {modelProbes.map((probe) => (
                <ModelProbeRow
                  key={probe.model_id}
                  probe={probe}
                  expanded={expandedModel === probe.model_id}
                  onToggle={() => setExpandedModel(expandedModel === probe.model_id ? null : probe.model_id)}
                />
              ))}
            </div>
          ) : (
            <EmptyCardBody message="Model performance data will appear after your audit runs AI probes across multiple models." />
          )}
        </DashCard>

        {/* ── Card 3: Competitive Benchmark ── */}
        <DashCard>
          <div className="flex items-center justify-between">
            <CardHeader title="Competitive Benchmark" subtitle="Where you stand vs competitors" />
            {!isBrandAudit && scoredDrafts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCompetitorEditor(!showCompetitorEditor)}
                className="text-[11px] font-medium px-2 py-1 rounded-md flex-shrink-0"
                style={{ color: 'var(--m-muted)', background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
              >
                {showCompetitorEditor ? 'Hide editor' : 'Edit'}
              </button>
            )}
          </div>

          {isBrandAudit ? (
            <div className="mt-3 rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
              <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Competitive benchmarks need a live site</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
                Run a site audit on the same brand to unlock competitor comparisons.
              </p>
              <Link href={`${dashPrefix}/new-audit`} className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
                Run a site audit <ArrowRight size={10} />
              </Link>
            </div>
          ) : scoredDrafts.length > 0 ? (
            <div className="mt-3">
              {/* Ranking table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]" style={{ color: 'var(--ink)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--rule)' }}>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--m-muted)' }}>#</th>
                      <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--m-muted)' }}>Brand</th>
                      <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--m-muted)' }}>Score</th>
                      {biSummary?.shareOfVoice != null && (
                        <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--m-muted)' }}>SoV</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* User row — always first */}
                    <tr style={{ borderBottom: '1px solid var(--rule)', background: 'color-mix(in srgb, var(--ink) 2%, transparent)' }}>
                      <td className="py-2.5 pr-3 font-semibold">1</td>
                      <td className="py-2.5 pr-3 font-semibold">You</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-semibold tabular-nums" style={{ color: scoreColorVar(overallScore) }}>{overallScore}</span>
                      </td>
                      {biSummary?.shareOfVoice != null && (
                        <td className="py-2.5 px-2 text-center font-semibold tabular-nums" style={{ color: scoreColorVar(biSummary.shareOfVoice) }}>
                          {biSummary.shareOfVoice}%
                        </td>
                      )}
                    </tr>
                    {/* Competitors */}
                    {scoredDrafts.map((c, i) => {
                      const isLagging = c.score != null && overallScore < c.score - 5;
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                          <td className="py-2.5 pr-3 font-medium" style={{ color: 'var(--m-muted)' }}>{i + 2}</td>
                          <td className="py-2.5 pr-3 font-medium">{c.name || c.domain}</td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="tabular-nums font-medium" style={{ color: isLagging ? 'var(--severe)' : 'var(--m-muted)' }}>
                              {c.score}
                            </span>
                          </td>
                          {biSummary?.shareOfVoice != null && (
                            <td className="py-2.5 px-2 text-center tabular-nums" style={{ color: 'var(--m-muted)' }}>--</td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Industry benchmark position */}
              {benchmarkPosition?.benchmark && (
                <div className="mt-3 px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                    Industry{industry ? ` (${industry})` : ''} average:{' '}
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{benchmarkPosition.benchmark.avgScore}/100</span>
                    {benchmarkPosition.deltaFromAvg != null && (
                      <span className="font-semibold tabular-nums ml-2" style={{ color: benchmarkPosition.deltaFromAvg > 0 ? 'var(--ok)' : benchmarkPosition.deltaFromAvg < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                        {benchmarkPosition.deltaFromAvg > 0 ? '+' : ''}{benchmarkPosition.deltaFromAvg} vs. industry
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <EmptyCardBody message="Add competitors to see how you compare. Use auto-detect or add manually." />
              <button
                type="button"
                onClick={() => { setShowCompetitorEditor(true); }}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md mt-3"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Add competitors <ArrowRight size={10} />
              </button>
            </div>
          )}

          {/* Competitor editor — inline below the table */}
          {!isBrandAudit && (showCompetitorEditor || scoredDrafts.length === 0) && (
            <CompetitorEditor
              drafts={drafts}
              isDirty={isDirty}
              detecting={detecting}
              saving={saving}
              error={error}
              info={info}
              onAdd={addRow}
              onUpdate={updateRow}
              onRemove={removeRow}
              onReset={resetEdits}
              onAutoDetect={runAutoDetect}
              onRescan={rescanScores}
              onSave={saveDrafts}
            />
          )}
        </DashCard>

        {/* ── Card 4: Sentiment & Signals ── */}
        <DashCard>
          <CardHeader
            title="Sentiment & Signals"
            subtitle={hasRealHumanData ? "How AI and humans feel about your brand" : "How AI models perceive and represent your brand"}
          />

          {biSummary || hasRealHumanData ? (
            <div className="mt-3">
              {/* Sentiment scores row — only show metrics that have data */}
              <div className={`grid gap-3 mb-4 ${hasRealHumanData && allSignals.length > 0 ? 'grid-cols-3' : hasRealHumanData || allSignals.length > 0 ? 'grid-cols-2' : 'grid-cols-1 max-w-[220px]'}`}>
                <MiniStat label="AI Sentiment" value={biSummary?.overallSentiment ?? null} suffix="/100" />
                {hasRealHumanData && humanSentimentScore != null && (
                  <MiniStat label="Human Sentiment" value={humanSentimentScore} suffix="/100" />
                )}
                {allSignals.length > 0 && (
                  <MiniStat label="Signals" value={allSignals.length} suffix="" isCount />
                )}
              </div>

              {/* Positive / Negative themes — compact */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--ok)' }}>Positive signals</p>
                  {(biSummary?.positiveThemes?.length ?? 0) > 0 || (hp?.topPositiveThemes?.length ?? 0) > 0 ? (
                    <ul className="space-y-1">
                      {biSummary?.positiveThemes?.slice(0, 3).map((t) => (
                        <li key={t} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md capitalize" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)', color: 'var(--ink)' }}>
                          <CheckCircle2 size={9} style={{ color: 'var(--ok)' }} /> {t}
                        </li>
                      ))}
                      {hasRealHumanData && hp?.topPositiveThemes?.slice(0, 2).map((t: any, i: number) => (
                        <li key={`h-${i}`} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)', color: 'var(--ink)' }}>
                          <ThumbsUp size={9} style={{ color: 'var(--ok)' }} /> {t.theme}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[10px]" style={{ color: 'var(--m-muted)' }}>No positive signals yet</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--severe)' }}>Negative signals</p>
                  {(biSummary?.negativeThemes?.length ?? 0) > 0 || (hp?.topNegativeThemes?.length ?? 0) > 0 ? (
                    <ul className="space-y-1">
                      {biSummary?.negativeThemes?.slice(0, 3).map((t) => (
                        <li key={t} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md capitalize" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', color: 'var(--ink)' }}>
                          <AlertCircle size={9} style={{ color: 'var(--severe)' }} /> {t}
                        </li>
                      ))}
                      {hasRealHumanData && hp?.topNegativeThemes?.slice(0, 2).map((t: any, i: number) => (
                        <li key={`h-${i}`} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', color: 'var(--ink)' }}>
                          <ThumbsDown size={9} style={{ color: 'var(--severe)' }} /> {t.theme}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[10px]" style={{ color: 'var(--m-muted)' }}>No negative signals yet</p>
                  )}
                </div>
              </div>

              {/* Human signals feed — compact inline list */}
              {allSignals.length > 0 && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                      Human signals ({allSignals.length})
                    </p>
                    <div className="flex-1" />
                    {(['all', 'positive', 'negative'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setSignalFilter(f === 'all' ? 'all' : f)}
                        className="px-2 py-0.5 rounded text-[9px] font-medium capitalize"
                        style={{
                          background: signalFilter === f ? 'var(--ink)' : 'transparent',
                          color: signalFilter === f ? 'var(--paper)' : 'var(--m-muted)',
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                    {filteredSignals.slice(0, 8).map((signal, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px]" style={{ background: 'color-mix(in srgb, var(--ink) 2%, transparent)' }}>
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: signal.sentiment === 'positive' ? 'var(--ok)' : signal.sentiment === 'negative' ? 'var(--severe)' : 'var(--warn)' }}
                        />
                        <span className="flex-1 min-w-0 truncate font-medium" style={{ color: 'var(--ink)' }}>{signal.title}</span>
                        <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{signal.source}</span>
                        {signal.sourceUrl && (
                          <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 hover:opacity-70">
                            <ExternalLink size={9} style={{ color: 'var(--m-muted)' }} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                  {filteredSignals.length > 8 && (
                    <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--m-muted)' }}>
                      +{filteredSignals.length - 8} more signals
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <EmptyCardBody message="Sentiment data will appear after your audit completes. Run an intelligence scan to see how AI and humans perceive your brand." />
          )}
        </DashCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Fix & Improve — below the grid when data exists
         ═══════════════════════════════════════════════════════════ */}
      {recommendations.length > 0 && (
        <DashCard className="mb-4">
          <CardHeader title="Fix and improve" subtitle="Prioritized actions to improve how AI and humans see your brand" />
          <div className="mt-3 space-y-2">
            {recommendations.map((rec, i) => (
              <FixRecommendationCard key={i} rec={rec} auditId={bundle.audit!.id} />
            ))}
          </div>
        </DashCard>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Shared card components
   ══════════════════════════════════════════════════════════ */

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

function CardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h2>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{subtitle}</p>
    </div>
  );
}

function EmptyCardBody({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[11px] text-center max-w-xs" style={{ color: 'var(--m-muted)' }}>{message}</p>
    </div>
  );
}

/* ── Metric Donut (matches reference image) ── */

function MetricDonut({ label, value, suffix, isPlacement }: { label: string; value: number | null; suffix?: string; isPlacement?: boolean }) {
  // For placement, lower is better. Display as raw number.
  const displayValue = value != null ? (isPlacement ? value.toFixed(1) : Math.round(value)) : '--';
  const color = value != null
    ? isPlacement
      ? (value <= 2 ? 'var(--ok)' : value <= 3.5 ? 'var(--warn)' : 'var(--severe)')
      : scoreColorVar(value)
    : 'var(--m-muted)';

  // Ring percentage: for placement (1-5 scale, lower is better), invert
  const pct = value != null
    ? isPlacement
      ? Math.max(0, Math.min(100, ((5 - value) / 4) * 100))
      : Math.min(value, 100)
    : 0;

  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[68px] h-[68px] flex-shrink-0">
        <svg viewBox="0 0 68 68" className="w-full h-full">
          {/* Background ring */}
          <circle cx="34" cy="34" r={r} fill="none" stroke="color-mix(in srgb, var(--ink) 8%, transparent)" strokeWidth="5" />
          {/* Value ring */}
          {value != null && (
            <circle
              cx="34" cy="34" r={r} fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform="rotate(-90 34 34)"
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[16px] font-bold tabular-nums leading-none" style={{ color: value != null ? 'var(--ink)' : 'var(--m-muted)' }}>
            {displayValue}
          </span>
        </div>
      </div>
      <span className="text-[11px] font-medium leading-tight" style={{ color: 'var(--m-muted)' }}>{label}</span>
    </div>
  );
}

/* ── Mini stat for sentiment card ── */

function MiniStat({ label, value, suffix, isCount }: { label: string; value: number | null; suffix: string; isCount?: boolean }) {
  const color = value != null ? (isCount ? 'var(--ink)' : scoreColorVar(value)) : 'var(--m-muted)';
  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>{label}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color }}>{value != null ? value : '--'}</span>
        {value != null && suffix && <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

/* ── Model Probe Row ── */

function ModelProbeRow({ probe, expanded, onToggle }: { probe: ModelProbe; expanded: boolean; onToggle: () => void }) {
  const sentiment = probe.sentiment_score ?? null;
  const sentimentInfo = sentiment != null ? sentimentLabel(sentiment) : null;
  const hasEvidence = probe.results_json && probe.results_json.length > 0;
  const placement = probe.placement_score ?? null;
  const pd = placementDisplay(placement);

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)', background: 'color-mix(in srgb, var(--ink) 2%, transparent)' }}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-3 py-2.5 text-left" aria-expanded={expanded}>
        <span className="text-[12px] font-semibold flex-1 truncate" style={{ color: 'var(--ink)' }}>{probe.model_label}</span>
        <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full" style={{ color: scoreColorVar(probe.accuracy_score), background: `color-mix(in srgb, ${scoreColorVar(probe.accuracy_score)} 10%, transparent)` }}>
          {probe.accuracy_score}%
        </span>
        {sentimentInfo && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: sentimentInfo.color, background: `color-mix(in srgb, ${sentimentInfo.color} 10%, transparent)` }}>
            {sentimentInfo.label}
          </span>
        )}
        {probe.accuracy_score > 0 ? <Eye size={11} style={{ color: 'var(--ok)' }} /> : <EyeOff size={11} style={{ color: 'var(--m-muted)' }} />}
        {hasEvidence && <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--m-muted)' }} />}
      </button>
      {expanded && hasEvidence && (
        <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid var(--rule)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] pt-2" style={{ color: 'var(--m-muted)' }}>Prompts and responses</p>
          {probe.results_json!.map((r, i) => (
            <div key={i} className="rounded-md p-2.5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Q: {r.question}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink)', opacity: 0.85 }}>{r.answer}</p>
              {r.accuracy && (
                <span className="inline-block mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{
                  color: r.accuracy === 'Accurate' ? 'var(--ok)' : r.accuracy === 'Partially accurate' ? 'var(--warn)' : 'var(--severe)',
                  background: `color-mix(in srgb, ${r.accuracy === 'Accurate' ? 'var(--ok)' : r.accuracy === 'Partially accurate' ? 'var(--warn)' : 'var(--severe)'} 10%, transparent)`,
                }}>{r.accuracy}</span>
              )}
            </div>
          ))}
          {probe.sentiment_themes && probe.sentiment_themes.length > 0 && (
            <div className="pt-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--m-muted)' }}>Perception themes</p>
              <div className="flex flex-wrap gap-1">
                {probe.sentiment_themes.map((t, i) => (
                  <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full capitalize" style={{
                    color: t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)',
                    background: `color-mix(in srgb, ${t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)'} 10%, transparent)`,
                  }}>{t.theme}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Competitor Editor ── */

function CompetitorEditor({
  drafts, isDirty, detecting, saving, error, info,
  onAdd, onUpdate, onRemove, onReset, onAutoDetect, onRescan, onSave,
}: {
  drafts: DraftCompetitor[];
  isDirty: boolean;
  detecting: boolean;
  saving: boolean;
  error: string | null;
  info: string | null;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<DraftCompetitor>) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  onAutoDetect: () => void;
  onRescan: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>
        Manage competitors
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button type="button" onClick={onAutoDetect} disabled={detecting || saving} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
          <Sparkles size={10} /> {drafts.length === 0 ? 'Auto-detect' : 'Re-detect'}
        </button>
        {drafts.length > 0 && (
          <button type="button" onClick={onRescan} disabled={detecting || saving} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
            <RefreshCw size={10} className={detecting ? 'animate-spin' : ''} /> Re-score
          </button>
        )}
        <button type="button" onClick={onAdd} disabled={detecting || saving} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
          <Plus size={10} /> Add
        </button>
        <div className="flex-1" />
        {isDirty && (
          <>
            <button type="button" onClick={onReset} disabled={saving || detecting} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--m-muted)' }}>
              <X size={10} /> Cancel
            </button>
            <button type="button" onClick={onSave} disabled={saving || detecting} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
              <Save size={10} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-2 p-2 rounded-md flex items-start gap-1.5 text-[11px]" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }} role="alert">
          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}
      {info && !error && (
        <div className="mb-2 p-2 rounded-md flex items-start gap-1.5 text-[11px]" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink)' }}>
          <Info size={11} className="mt-0.5 flex-shrink-0" /> <span>{info}</span>
        </div>
      )}
      {detecting && (
        <p className="text-[11px] mb-2" style={{ color: 'var(--m-muted)' }}>
          <Sparkles size={10} className="inline -mt-0.5 mr-1" /> Working...
        </p>
      )}

      {drafts.length > 0 && (
        <ul className="space-y-1.5">
          {drafts.map((c) => (
            <li key={c.id} className="rounded-md p-2.5" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)', border: '1px solid var(--rule)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="text" value={c.domain} placeholder="example.com"
                  onChange={(e) => onUpdate(c.id, { domain: e.target.value })}
                  className="flex-1 min-w-0 text-[12px] px-2.5 py-1.5 rounded-md outline-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  aria-label="Competitor domain"
                />
                {c.score != null && c.score > 0 && (
                  <span className="tabular-nums font-semibold text-[11px]" style={{ color: scoreColorVar(c.score) }}>{c.score}</span>
                )}
                <button type="button" onClick={() => onRemove(c.id)} className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:opacity-80 flex-shrink-0" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 8%, transparent)' }} aria-label="Remove">
                  <Trash2 size={11} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Fix Recommendation Card ── */

function FixRecommendationCard({ rec, auditId }: { rec: AuditRecommendation; auditId: string }) {
  const { workspaceSlug: _ws } = useWorkspace();
  const dashPrefix = _ws ? `/dashboard/${_ws}` : '/dashboard';
  const impactColor = rec.impact === 'high' ? 'var(--severe)' : rec.impact === 'medium' ? 'var(--warn)' : 'var(--m-muted)';

  return (
    <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--ink) 2%, transparent)', border: '1px solid var(--rule)' }}>
      <div className="flex items-start gap-2.5">
        <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}>
          {rec.deployable ? <Code size={10} /> : <FileText size={10} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>{rec.title}</h4>
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full" style={{ color: impactColor, background: `color-mix(in srgb, ${impactColor} 10%, transparent)` }}>
              {rec.impact}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{rec.description}</p>
          {rec.deployable && (
            <Link href={`${dashPrefix}/fix?audit=${auditId}`} className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
              <Wrench size={9} /> Fix from console <ChevronRight size={9} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
