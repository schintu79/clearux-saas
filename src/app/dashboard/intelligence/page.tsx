'use client';

/**
 * Brand Intelligence — Full Rebuild
 *
 * Architecture (per brief):
 *  1. Hero Metric Row — 3 dominant numbers always visible
 *  2. Sentiment Deep Dive — full-width breakdown + trend
 *  3. Share of Voice — stacked bar + competitor comparison
 *  4. Competitive Benchmark — single comparison table
 *  5. Human Signals Feed — reviews/mentions with source links
 *  6. Fix & Improve Panel — impact-ranked fix cards
 *  + AI Model Performance (retained from original)
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Radio,
  BarChart3,
  LineChart,
  Sparkles,
  ArrowRight,
  ArrowDown,
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
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
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

function trendIcon(current: number | null, previous: number | null) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta > 2) return { icon: TrendingUp, color: 'var(--ok)', label: `+${delta}` };
  if (delta < -2) return { icon: TrendingDown, color: 'var(--severe)', label: `${delta}` };
  return { icon: Minus, color: 'var(--m-muted)', label: 'Stable' };
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

/* ── Main Page ─────────────────────────────────────── */

export default function IntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || bundleLoading || !ready;

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
  const [promptResults, setPromptResults] = useState<any[]>([]);
  const [contentGaps, setContentGaps] = useState<any[]>([]);
  const [trendSnapshots, setTrendSnapshots] = useState<any[]>([]);

  // UI state
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [showCompetitorEditor, setShowCompetitorEditor] = useState(false);

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setDrafts([]); setServerSnapshot([]); setBenchmarkPosition(null); setIndustry(null);
      setBiSummary(null); setModelProbes([]); setRecommendations([]);
      setHumanPerception(null); setRedditMentions([]); setWebMentions([]);
      setReviewData([]); setPromptResults([]); setContentGaps([]); setTrendSnapshots([]);
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
        setPromptResults(d?.promptResults || []);
        setContentGaps(d?.contentGaps || []);
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
      setInfo('Saved. Click Re-scan to refresh scores for the updated list.');
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
      setInfo(list.length === 0 ? 'Could not identify competitors automatically. Add them manually below.' : 'Auto-detected. You can edit, remove, or add your own.');
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

  // Derived data
  const hp = humanPerception;
  const scoredDrafts = drafts.filter(d => typeof d.score === 'number' && d.score > 0);

  // Human sentiment score: derived from humanPerception socialSentiment or reviewScore
  const humanSentimentScore = hp?.socialSentiment ?? (hp?.reviewScore != null ? Math.round(hp.reviewScore * 20) : null);
  const humanSignalCount = (hp?.reviewCount ?? 0) + (hp?.webMentionCount ?? 0) + (hp?.redditMentionCount ?? 0);

  // All human signals merged for the feed
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

  // Trend data
  const latestSnap = trendSnapshots.length > 0 ? trendSnapshots[trendSnapshots.length - 1] : null;
  const prevSnap = trendSnapshots.length >= 2 ? trendSnapshots[0] : null;

  // Pillar dimensions for benchmark table
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
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[1, 2, 3].map(i => <div key={i} className="h-[140px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
        <div className="h-[260px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
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
          subtitle={selection ? 'No audit for this brand yet.' : 'Pick a brand or run an audit to unlock brand intelligence.'}
        />
        <EmptyAudit
          title="No intelligence yet"
          body="Run a Fixpath audit to see how AI and humans perceive your brand, with actionable fixes."
        />
      </div>
    );
  }

  return (
    <div>
      <OverviewBreadcrumb current="Brand Intelligence" />
      <PageHeader
        icon={<Radio size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Brand Intelligence"
        subtitle="How AI and humans perceive your brand — and what to do about it"
      />

      {/* ═══════════════════════════════════════════════════════════
          Section 1 — Hero Metric Row (3 dominant numbers)
         ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {/* Brand Sentiment */}
        <HeroMetricCard
          label="Brand Sentiment"
          value={biSummary?.overallSentiment ?? null}
          suffix="/100"
          descriptor={biSummary?.overallSentiment != null ? sentimentLabel(biSummary.overallSentiment) : null}
          dataSource={biSummary ? `Based on ${biSummary.perModel.length} AI model${biSummary.perModel.length !== 1 ? 's' : ''} + human signals` : null}
          trend={trendIcon(latestSnap?.overall_sentiment, prevSnap?.overall_sentiment)}
          scrollTarget="sentiment-deep-dive"
          emptyMessage="Run an audit to measure how AI and humans feel about your brand."
        />
        {/* Share of Voice */}
        <HeroMetricCard
          label="Share of Voice"
          value={biSummary?.shareOfVoice ?? null}
          suffix="%"
          descriptor={biSummary?.shareOfVoice != null ? (
            scoredDrafts.length > 0
              ? { label: `vs ${scoredDrafts.length} competitor${scoredDrafts.length !== 1 ? 's' : ''}`, color: 'var(--ink)' }
              : { label: 'No competitors tracked yet', color: 'var(--m-muted)' }
          ) : null}
          dataSource={biSummary?.shareOfVoice != null ? `Your brand's share in AI responses` : null}
          trend={trendIcon(latestSnap?.share_of_voice, prevSnap?.share_of_voice)}
          scrollTarget="share-of-voice"
          emptyMessage="Share of Voice requires tracking competitors and collecting AI response data."
        />
        {/* Human Sentiment */}
        <HeroMetricCard
          label="Human Sentiment"
          value={humanSentimentScore}
          suffix="/100"
          descriptor={humanSentimentScore != null ? sentimentLabel(humanSentimentScore) : null}
          dataSource={humanSignalCount > 0 ? `Based on ${humanSignalCount} signal${humanSignalCount !== 1 ? 's' : ''}` : null}
          trend={null}
          scrollTarget="human-signals"
          emptyMessage="Connect review sources to start tracking real user sentiment."
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Section 2 — Sentiment Deep Dive
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="sentiment-deep-dive"
        className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
          Overall Sentiment
        </h2>
        <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
          Full breakdown of how your brand is perceived across AI, reviews, and the web.
        </p>

        {biSummary || hp ? (
          <>
            {/* Sentiment gauge bar */}
            {biSummary?.overallSentiment != null && (
              <div className="mb-5">
                <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'linear-gradient(to right, var(--severe), var(--warn), var(--ok))' }}>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2"
                    style={{
                      left: `${biSummary.overallSentiment}%`,
                      transform: 'translate(-50%, -50%)',
                      background: 'var(--card)',
                      borderColor: 'var(--ink)',
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: 'var(--severe)' }}>Negative</span>
                  <span className="text-[10px]" style={{ color: 'var(--warn)' }}>Neutral</span>
                  <span className="text-[10px]" style={{ color: 'var(--ok)' }}>Positive</span>
                </div>
              </div>
            )}

            {/* AI / Human / Social breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <SentimentSourceCard
                label="AI-Derived Sentiment"
                score={biSummary?.overallSentiment ?? null}
                source={biSummary ? `From ${biSummary.perModel.length} model probe${biSummary.perModel.length !== 1 ? 's' : ''}` : 'No AI data yet'}
              />
              <SentimentSourceCard
                label="Human Reviews"
                score={hp?.reviewScore != null ? Math.round(hp.reviewScore * 20) : null}
                source={hp?.reviewCount ? `From ${hp.reviewCount} review${hp.reviewCount !== 1 ? 's' : ''}` : 'No review data collected yet'}
              />
              <SentimentSourceCard
                label="Social Mentions"
                score={hp?.socialSentiment ?? null}
                source={hp?.redditMentionCount || hp?.webMentionCount ? `From ${(hp?.redditMentionCount ?? 0) + (hp?.webMentionCount ?? 0)} mention${((hp?.redditMentionCount ?? 0) + (hp?.webMentionCount ?? 0)) !== 1 ? 's' : ''}` : 'No social data collected yet'}
              />
            </div>

            {/* Trend chart — simple snapshot comparison */}
            {trendSnapshots.length >= 2 && (
              <div className="mb-5 px-4 py-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: 'var(--m-muted)' }}>
                  Sentiment over time
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <TrendMetric label="BI Score" current={latestSnap?.bi_score} previous={prevSnap?.bi_score} />
                  <TrendMetric label="AI Visibility" current={latestSnap?.ai_visibility} previous={prevSnap?.ai_visibility} suffix="%" />
                  <TrendMetric label="Sentiment" current={latestSnap?.overall_sentiment} previous={prevSnap?.overall_sentiment} />
                  <TrendMetric label="Share of Voice" current={latestSnap?.share_of_voice} previous={prevSnap?.share_of_voice} suffix="%" />
                </div>
              </div>
            )}

            {trendSnapshots.length < 2 && biSummary && (
              <div className="mb-5 px-4 py-3 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                  More data builds over time. Run additional audits to see your sentiment trend.
                </p>
              </div>
            )}

            {/* Positive / Negative signal lists */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--ok)' }}>
                  Top positive signals
                </h3>
                {(biSummary?.positiveThemes?.length ?? 0) > 0 || (hp?.topPositiveThemes?.length ?? 0) > 0 ? (
                  <ul className="space-y-1.5">
                    {biSummary?.positiveThemes?.slice(0, 4).map((t) => (
                      <li key={t} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)', color: 'var(--ink)' }}>
                        <CheckCircle2 size={11} style={{ color: 'var(--ok)' }} />
                        <span className="capitalize">{t}</span>
                        <span className="text-[9px] ml-auto" style={{ color: 'var(--m-muted)' }}>AI</span>
                      </li>
                    ))}
                    {hp?.topPositiveThemes?.slice(0, 3).map((t: any, i: number) => (
                      <li key={`h-${i}`} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)', color: 'var(--ink)' }}>
                        <ThumbsUp size={11} style={{ color: 'var(--ok)' }} />
                        <span>{t.theme}</span>
                        <span className="text-[9px] ml-auto capitalize" style={{ color: 'var(--m-muted)' }}>{t.source}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] px-2.5 py-3" style={{ color: 'var(--m-muted)' }}>No positive signals detected yet.</p>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--severe)' }}>
                  Top negative signals
                </h3>
                {(biSummary?.negativeThemes?.length ?? 0) > 0 || (hp?.topNegativeThemes?.length ?? 0) > 0 ? (
                  <ul className="space-y-1.5">
                    {biSummary?.negativeThemes?.slice(0, 4).map((t) => (
                      <li key={t} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', color: 'var(--ink)' }}>
                        <AlertCircle size={11} style={{ color: 'var(--severe)' }} />
                        <span className="capitalize">{t}</span>
                        <span className="text-[9px] ml-auto" style={{ color: 'var(--m-muted)' }}>AI</span>
                      </li>
                    ))}
                    {hp?.topNegativeThemes?.slice(0, 3).map((t: any, i: number) => (
                      <li key={`h-${i}`} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', color: 'var(--ink)' }}>
                        <ThumbsDown size={11} style={{ color: 'var(--severe)' }} />
                        <span>{t.theme}</span>
                        <span className="text-[9px] ml-auto capitalize" style={{ color: 'var(--m-muted)' }}>{t.source}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] px-2.5 py-3" style={{ color: 'var(--m-muted)' }}>No negative signals detected yet.</p>
                )}
              </div>
            </div>
          </>
        ) : (
          <EmptySection
            icon={<Zap size={20} />}
            message="Sentiment data will appear after your audit completes. Run an intelligence scan to see how AI and humans perceive your brand."
          />
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 3 — Share of Voice
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="share-of-voice"
        className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
          Share of Voice
        </h2>
        <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
          How much of the conversation your brand owns vs competitors in AI responses.
        </p>

        {biSummary?.shareOfVoice != null && scoredDrafts.length > 0 ? (
          <>
            {/* Stacked horizontal bars */}
            <div className="space-y-2.5 mb-5">
              <ShareBar
                label="You"
                value={biSummary.shareOfVoice}
                isUser
              />
              {scoredDrafts.map(c => {
                const modelSov = biSummary.perModel.length > 0
                  ? Math.round(biSummary.perModel.reduce((s, m) => s + m.shareOfVoice, 0) / biSummary.perModel.length)
                  : null;
                // Estimate competitor share from remaining share
                const remainingShare = 100 - (biSummary.shareOfVoice ?? 0);
                const perCompetitor = scoredDrafts.length > 0 ? Math.round(remainingShare / scoredDrafts.length) : 0;
                return (
                  <ShareBar
                    key={c.id}
                    label={c.name || c.domain}
                    value={perCompetitor}
                  />
                );
              })}
            </div>

            {/* Per-model share of voice if available */}
            {biSummary.perModel.some(m => m.shareOfVoice > 0) && (
              <div className="mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>
                  Share by AI model
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]" style={{ color: 'var(--ink)' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                        <th className="text-left py-2 pr-4 font-medium" style={{ color: 'var(--m-muted)' }}>Model</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--m-muted)' }}>Your Share</th>
                        <th className="text-right py-2 pl-3 font-medium" style={{ color: 'var(--m-muted)' }}>Visibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {biSummary.perModel.filter(m => m.visibility).map(m => (
                        <tr key={m.modelId} style={{ borderBottom: '1px solid var(--rule)' }}>
                          <td className="py-2 pr-4 font-medium">{m.modelLabel}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold" style={{ color: scoreColorVar(m.shareOfVoice) }}>{m.shareOfVoice}%</td>
                          <td className="py-2 pl-3 text-right">
                            <Eye size={11} style={{ color: 'var(--ok)' }} className="inline" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : biSummary?.shareOfVoice != null && scoredDrafts.length === 0 ? (
          <div className="rounded-lg p-5 text-center" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
            <BarChart3 size={20} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-2 opacity-50" />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Add competitors to unlock Share of Voice comparison</p>
            <p className="text-[12px] mt-1 mb-3" style={{ color: 'var(--m-muted)' }}>
              Share of Voice requires tracking at least one competitor and collecting mention data over time.
            </p>
            <button
              type="button"
              onClick={() => { setShowCompetitorEditor(true); document.getElementById('competitive-benchmark')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md"
              style={{ color: 'var(--card)', background: 'var(--ink)' }}
            >
              <Plus size={11} /> Add competitors
            </button>
          </div>
        ) : (
          <EmptySection
            icon={<BarChart3 size={20} />}
            message="Share of Voice data will appear after your next audit. Track competitors and collect AI response data to see how you compare."
            action={!isBrandAudit ? { label: 'Add competitors', onClick: () => { setShowCompetitorEditor(true); document.getElementById('competitive-benchmark')?.scrollIntoView({ behavior: 'smooth' }); } } : undefined}
          />
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 4 — Competitive Benchmark (single comparison table)
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="competitive-benchmark"
        className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            Competitive Benchmark
          </h2>
          {!isBrandAudit && scoredDrafts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompetitorEditor(!showCompetitorEditor)}
              className="text-[11px] font-medium px-2 py-1 rounded-md"
              style={{ color: 'var(--m-muted)', background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
            >
              {showCompetitorEditor ? 'Hide editor' : 'Edit competitors'}
            </button>
          )}
        </div>
        <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
          Where you lead, where you lag, and what to do about it.
        </p>

        {isBrandAudit ? (
          <div className="rounded-lg p-5" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
            <div className="flex items-start gap-3">
              <LineChart size={18} style={{ color: 'var(--m-muted)' }} className="mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Competitive benchmarks need a live site</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
                  Brand-only audits don&apos;t have a public URL to compare. Run a site audit on the same brand to unlock competitor benchmarks.
                </p>
                <Link href="/dashboard/new-audit" className="inline-flex items-center gap-1 mt-3 text-[12px] font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
                  Run a site audit <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        ) : scoredDrafts.length > 0 ? (
          <>
            {/* Comparison table */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[11px]" style={{ color: 'var(--ink)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--rule)' }}>
                    <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--m-muted)' }}></th>
                    <th className="text-center py-2 px-3 font-semibold" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 3%, transparent)', borderRadius: '6px 6px 0 0' }}>You</th>
                    {scoredDrafts.map(c => (
                      <th key={c.id} className="text-center py-2 px-3 font-medium" style={{ color: 'var(--m-muted)' }}>{c.name || c.domain}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Overall Score */}
                  <BenchmarkRow
                    label="Overall Score"
                    userValue={overallScore}
                    competitors={scoredDrafts.map(c => c.score)}
                  />
                  {/* Pillar scores if available */}
                  {pillarNames.map(pillar => (
                    <BenchmarkRow
                      key={pillar}
                      label={pillar}
                      userValue={null}
                      competitors={scoredDrafts.map(c => {
                        const p = c.pillarScores?.find(ps => ps.name === pillar);
                        return p ? p.score : null;
                      })}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lead / Lag / Opportunity summary */}
            <BenchmarkSummary overallScore={overallScore} competitors={scoredDrafts} pillarNames={pillarNames} />

            {/* Industry benchmark if available */}
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
          </>
        ) : (
          <EmptySection
            icon={<LineChart size={20} />}
            message="Add competitors to unlock benchmarking. Auto-detect to get up to 5 suggestions, or add your own."
            action={{ label: 'Add competitors', onClick: () => setShowCompetitorEditor(true) }}
          />
        )}

        {/* Competitor editor — collapsible */}
        {!isBrandAudit && (showCompetitorEditor || scoredDrafts.length === 0) && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: 'var(--m-muted)' }}>
              Manage competitors
            </p>
            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button type="button" onClick={runAutoDetect} disabled={detecting || saving} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                <Sparkles size={11} /> {drafts.length === 0 ? 'Auto-detect' : 'Re-detect'}
              </button>
              {drafts.length > 0 && (
                <button type="button" onClick={rescanScores} disabled={detecting || saving} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                  <RefreshCw size={11} className={detecting ? 'animate-spin' : ''} /> Re-score
                </button>
              )}
              <button type="button" onClick={addRow} disabled={detecting || saving} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                <Plus size={11} /> Add
              </button>
              <div className="flex-1" />
              {isDirty && (
                <>
                  <button type="button" onClick={resetEdits} disabled={saving || detecting} className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md disabled:opacity-50" style={{ color: 'var(--m-muted)' }}>
                    <X size={11} /> Cancel
                  </button>
                  <button type="button" onClick={saveDrafts} disabled={saving || detecting} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md text-white disabled:opacity-50" style={{ background: 'var(--ink)' }}>
                    <Save size={11} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-md flex items-start gap-2 text-[12px]" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }} role="alert">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className="mb-3 p-2.5 rounded-md flex items-start gap-2 text-[12px]" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink)' }}>
                <Info size={12} className="mt-0.5 flex-shrink-0" /> <span>{info}</span>
              </div>
            )}
            {detecting && (
              <p className="text-[12px] mb-3" style={{ color: 'var(--m-muted)' }}>
                <Sparkles size={11} className="inline -mt-0.5 mr-1" /> Working... this may take a few seconds per competitor.
              </p>
            )}

            {drafts.length > 0 && (
              <ul className="space-y-2">
                {drafts.map((c) => (
                  <li key={c.id} className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)', border: '1px solid var(--rule)' }}>
                    <div className="flex items-center gap-2">
                      <input
                        type="text" value={c.domain} placeholder="example.com"
                        onChange={(e) => updateRow(c.id, { domain: e.target.value })}
                        className="flex-1 min-w-0 text-[13px] px-3 py-2 rounded-md outline-none"
                        style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                        aria-label="Competitor domain"
                      />
                      <button type="button" onClick={() => removeRow(c.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:opacity-80 flex-shrink-0" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 8%, transparent)' }} aria-label={`Remove ${c.domain || 'competitor'}`}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2" style={{ borderTop: '1px dashed var(--rule)' }}>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full" style={{ color: c.source === 'manual' ? 'var(--m-muted)' : 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                        {c.source === 'manual' ? <><Pencil size={9} className="inline -mt-0.5 mr-1" />Manual</> : <><Sparkles size={9} className="inline -mt-0.5 mr-1" />Auto</>}
                      </span>
                      {c.score != null && c.score > 0 ? (
                        <>
                          <span className="h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ width: 120, background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}>
                            <span className="block h-full" style={{ width: `${c.score}%`, background: scoreColorVar(c.score) }} />
                          </span>
                          <span className="tabular-nums font-semibold text-[12px]" style={{ color: scoreColorVar(c.score) }}>{c.score}/100</span>
                        </>
                      ) : (
                        <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                          Not yet scored — click <strong style={{ color: 'var(--ink)' }}>Re-score</strong> to benchmark.
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          AI Model Performance (retained — valuable detail section)
         ═══════════════════════════════════════════════════════════ */}
      {modelProbes.length > 0 && (
        <section className="rounded-xl p-5 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
            AI Model Performance
          </h2>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            How your brand performs inside each AI model. Expand to see actual prompts and responses.
          </p>
          <div className="space-y-2">
            {modelProbes.map((probe) => (
              <ModelProbeRow
                key={probe.model_id}
                probe={probe}
                expanded={expandedModel === probe.model_id}
                onToggle={() => setExpandedModel(expandedModel === probe.model_id ? null : probe.model_id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Section 5 — Human Signals Feed
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="human-signals"
        className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
          Human Signals
        </h2>
        <p className="text-[12px] mb-3" style={{ color: 'var(--m-muted)' }}>
          Real human-generated signals behind the sentiment scores — reviews, mentions, discussions.
        </p>

        {allSignals.length > 0 ? (
          <>
            {/* Filter tabs */}
            <div className="flex items-center gap-1 mb-4">
              {(['all', 'positive', 'neutral', 'negative'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setSignalFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors"
                  style={{
                    background: signalFilter === f ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 4%, transparent)',
                    color: signalFilter === f ? 'var(--card)' : 'var(--m-muted)',
                  }}
                >
                  {f === 'all' ? `All (${allSignals.length})` : `${f} (${allSignals.filter(s => s.sentiment === f).length})`}
                </button>
              ))}
            </div>

            {/* Signal cards */}
            <div className="space-y-2">
              {filteredSignals.slice(0, 15).map((signal, i) => (
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: signal.sentiment === 'positive' ? 'var(--ok)' : signal.sentiment === 'negative' ? 'var(--severe)' : 'var(--warn)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>
                      {signal.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {signal.type === 'reddit' && <MessageSquare size={9} style={{ color: 'var(--m-muted)' }} />}
                      {signal.type === 'web' && <Globe size={9} style={{ color: 'var(--m-muted)' }} />}
                      {signal.type === 'review' && <Star size={9} style={{ color: 'var(--m-muted)' }} />}
                      <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{signal.source}</span>
                      {signal.date && <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{new Date(signal.date).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {signal.sourceUrl && (
                    <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 mt-0.5 hover:opacity-70">
                      <ExternalLink size={11} style={{ color: 'var(--m-muted)' }} />
                    </a>
                  )}
                </div>
              ))}
            </div>

            {filteredSignals.length > 15 && (
              <p className="text-[11px] mt-3 text-center" style={{ color: 'var(--m-muted)' }}>
                Showing 15 of {filteredSignals.length} signals
              </p>
            )}
          </>
        ) : (
          <EmptySection
            icon={<Users size={20} />}
            message="No human signals collected yet. Connect review sources to start tracking real user sentiment."
          />
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Category Visibility + Content Gaps
         ═══════════════════════════════════════════════════════════ */}
      {(promptResults.length > 0 || contentGaps.length > 0) && (
        <section className="rounded-xl p-5 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Category Visibility</h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            How visible your brand is when AI answers non-branded category questions.
          </p>

          {hp?.promptLibraryVisibility != null && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>Category visibility</p>
                <p className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: scoreColorVar(hp.promptLibraryVisibility) }}>{hp.promptLibraryVisibility}%</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{promptResults.length} prompts tested</p>
              </div>
              <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>Content gaps</p>
                <p className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: 'var(--ink)' }}>{contentGaps.length}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>Opportunities to publish</p>
              </div>
            </div>
          )}

          {contentGaps.length > 0 && (
            <div className="mt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--ink)' }}>Content to publish</h3>
              <div className="space-y-2">
                {contentGaps.slice(0, 5).map((gap: any, i: number) => (
                  <div key={i} className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                    <div className="flex items-start gap-2">
                      <FileText size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ink)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>{gap.recommended_topic}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] capitalize" style={{ color: 'var(--m-muted)' }}>{(gap.recommended_format || '').replace(/_/g, ' ')}</span>
                          <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{gap.target_word_count} words</span>
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full" style={{
                            color: gap.estimated_impact === 'high' ? 'var(--severe)' : gap.estimated_impact === 'medium' ? 'var(--warn)' : 'var(--m-muted)',
                            background: gap.estimated_impact === 'high' ? 'color-mix(in srgb, var(--severe) 10%, transparent)' : gap.estimated_impact === 'medium' ? 'color-mix(in srgb, var(--warn) 10%, transparent)' : 'color-mix(in srgb, var(--ink) 6%, transparent)',
                          }}>{gap.estimated_impact}</span>
                        </div>
                        {gap.recommended_angle && <p className="text-[10px] mt-1" style={{ color: 'var(--m-muted)' }}>{gap.recommended_angle}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Section 6 — Fix & Improve Panel
         ═══════════════════════════════════════════════════════════ */}
      <section className="rounded-xl p-5 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
          Fix and Improve
        </h2>
        <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
          Prioritized actions to improve how AI and humans see your brand.
        </p>

        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <FixRecommendationCard key={i} rec={rec} auditId={bundle.audit!.id} />
            ))}
          </div>
        ) : (
          <EmptySection
            icon={<Wrench size={20} />}
            message="Fixes are generated from your intelligence data. Run a full intelligence scan to unlock recommendations."
            action={{ label: 'Run scan', href: '/dashboard/new-audit' }}
          />
        )}
      </section>

      {/* Footer link to full report */}
      {!isBrandAudit && (
        <p className="text-[11px] mb-4" style={{ color: 'var(--m-muted)' }}>
          Want pillar-level breakdowns and the raw competitor analysis?{' '}
          <Link href={`/dashboard/audits/${bundle.audit.id}#intelligence`} className="inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
            Open the full report <ExternalLink size={10} />
          </Link>
        </p>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

/** Hero metric card — large number, always visible at top */
function HeroMetricCard({
  label, value, suffix, descriptor, dataSource, trend, scrollTarget, emptyMessage,
}: {
  label: string;
  value: number | null;
  suffix: string;
  descriptor: { label: string; color: string } | null;
  dataSource: string | null;
  trend: { icon: any; color: string; label: string } | null;
  scrollTarget: string;
  emptyMessage: string;
}) {
  const color = value != null ? scoreColorVar(value) : 'var(--m-muted)';

  return (
    <div
      className="rounded-xl p-5 flex flex-col"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>
        {label}
      </span>

      {value != null ? (
        <>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-[36px] font-bold leading-none tabular-nums" style={{ color }}>
              {value}
            </span>
            <span className="text-[13px] font-medium" style={{ color: 'var(--m-muted)' }}>{suffix}</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            {descriptor && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ color: descriptor.color, background: `color-mix(in srgb, ${descriptor.color} 10%, transparent)` }}
              >
                {descriptor.label}
              </span>
            )}
            {trend && (
              <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: trend.color }}>
                <trend.icon size={10} /> {trend.label}
              </span>
            )}
          </div>

          {dataSource && (
            <p className="text-[10px] mt-auto" style={{ color: 'var(--m-muted)' }}>{dataSource}</p>
          )}

          <button
            type="button"
            onClick={() => document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-2 flex items-center gap-1 text-[11px] font-medium hover:underline"
            style={{ color: 'var(--ink)' }}
          >
            View detail <ArrowDown size={10} />
          </button>
        </>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <span className="text-[28px] font-bold leading-none mb-2" style={{ color: 'var(--m-muted)' }}>--</span>
          <p className="text-[10px] leading-snug" style={{ color: 'var(--m-muted)' }}>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

/** Sentiment source card — AI/Human/Social breakdown */
function SentimentSourceCard({ label, score, source }: { label: string; score: number | null; source: string }) {
  const color = score != null ? scoreColorVar(score) : 'var(--m-muted)';
  const info = score != null ? sentimentLabel(score) : null;

  return (
    <div className="px-4 py-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--m-muted)' }}>{label}</p>
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[24px] font-bold tabular-nums leading-none" style={{ color }}>
          {score != null ? score : '--'}
        </span>
        {score != null && <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>/100</span>}
        {info && (
          <span className="text-[10px] font-semibold ml-1 px-1.5 py-0.5 rounded-full" style={{ color: info.color, background: `color-mix(in srgb, ${info.color} 10%, transparent)` }}>
            {info.label}
          </span>
        )}
      </div>
      <p className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{source}</p>
    </div>
  );
}

/** Share of Voice horizontal bar */
function ShareBar({ label, value, isUser }: { label: string; value: number; isUser?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-[11px] w-28 truncate ${isUser ? 'font-semibold' : 'font-medium'}`} style={{ color: isUser ? 'var(--ink)' : 'var(--m-muted)' }}>
        {label}
      </span>
      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(value, 100)}%`, background: isUser ? 'var(--ink)' : 'color-mix(in srgb, var(--ink) 25%, transparent)' }} />
      </div>
      <span className="text-[11px] tabular-nums font-semibold w-10 text-right" style={{ color: isUser ? 'var(--ink)' : 'var(--m-muted)' }}>
        {value}%
      </span>
    </div>
  );
}

/** Benchmark comparison table row */
function BenchmarkRow({ label, userValue, competitors }: { label: string; userValue: number | null; competitors: (number | null)[] }) {
  const allValues = [userValue, ...competitors].filter((v): v is number => v != null);
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;

  return (
    <tr style={{ borderBottom: '1px solid var(--rule)' }}>
      <td className="py-2.5 pr-4 text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>{label}</td>
      <td className="py-2.5 px-3 text-center tabular-nums font-semibold" style={{ color: userValue != null ? scoreColorVar(userValue) : 'var(--m-muted)', background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
        {userValue != null ? userValue : '--'}
      </td>
      {competitors.map((val, i) => {
        const isLeading = userValue != null && val != null && userValue > val;
        const isLagging = userValue != null && val != null && userValue < val - 5;
        return (
          <td key={i} className="py-2.5 px-3 text-center tabular-nums font-medium" style={{ color: val != null ? (isLagging ? 'var(--severe)' : isLeading ? 'var(--ok)' : 'var(--ink)') : 'var(--m-muted)' }}>
            {val != null ? val : '--'}
          </td>
        );
      })}
    </tr>
  );
}

/** Benchmark summary — You lead / You lag / Biggest opportunity */
function BenchmarkSummary({ overallScore, competitors, pillarNames }: { overallScore: number; competitors: DraftCompetitor[]; pillarNames: string[] }) {
  const scoredComps = competitors.filter(c => c.score != null && c.score > 0);
  if (scoredComps.length === 0) return null;

  const leadIn: string[] = [];
  const lagIn: string[] = [];
  let biggestGap = { dimension: '', gap: 0 };

  // Check overall
  const maxCompOverall = Math.max(...scoredComps.map(c => c.score!));
  if (overallScore >= maxCompOverall) leadIn.push('Overall Score');
  if (overallScore < maxCompOverall - 5) {
    lagIn.push('Overall Score');
    const gap = maxCompOverall - overallScore;
    if (gap > biggestGap.gap) biggestGap = { dimension: 'Overall Score', gap };
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--ok)' }}>You lead in</p>
        <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
          {leadIn.length > 0 ? leadIn.join(', ') : 'No leading dimensions yet'}
        </p>
      </div>
      <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--severe)' }}>You lag in</p>
        <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
          {lagIn.length > 0 ? lagIn.join(', ') : 'No lagging dimensions'}
        </p>
      </div>
      <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--warn) 5%, transparent)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--warn)' }}>Biggest opportunity</p>
        <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
          {biggestGap.gap > 0 ? `${biggestGap.dimension} — ${biggestGap.gap}pt gap vs leader` : 'No significant gaps'}
        </p>
      </div>
    </div>
  );
}

/** Trend metric block */
function TrendMetric({ label, current, previous, suffix = '' }: { label: string; current: number | null; previous: number | null; suffix?: string }) {
  const delta = current != null && previous != null ? current - previous : null;
  const isPositive = delta != null && delta > 0;
  const isNegative = delta != null && delta < 0;

  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>{label}</p>
      <p className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: 'var(--ink)' }}>
        {current != null ? `${current}${suffix}` : '--'}
      </p>
      {delta != null && (
        <div className="flex items-center gap-1 mt-0.5">
          {isPositive && <TrendingUp size={10} style={{ color: 'var(--ok)' }} />}
          {isNegative && <TrendingDown size={10} style={{ color: 'var(--severe)' }} />}
          <span className="text-[10px] font-medium" style={{ color: isPositive ? 'var(--ok)' : isNegative ? 'var(--severe)' : 'var(--m-muted)' }}>
            {isPositive ? '+' : ''}{Math.round(delta)}{suffix}
          </span>
        </div>
      )}
    </div>
  );
}

/** Empty section with CTA */
function EmptySection({ icon, message, action }: { icon: React.ReactNode; message: string; action?: { label: string; onClick?: () => void; href?: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
      <span style={{ color: 'var(--m-muted)', opacity: 0.5 }}>{icon}</span>
      <p className="text-[12px] max-w-sm" style={{ color: 'var(--m-muted)' }}>{message}</p>
      {action && (
        action.href ? (
          <Link href={action.href} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md mt-1" style={{ color: 'var(--card)', background: 'var(--ink)' }}>
            {action.label} <ArrowRight size={11} />
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md mt-1" style={{ color: 'var(--card)', background: 'var(--ink)' }}>
            {action.label} <ArrowRight size={11} />
          </button>
        )
      )}
    </div>
  );
}

/** AI Model probe row with expandable evidence */
function ModelProbeRow({ probe, expanded, onToggle }: { probe: ModelProbe; expanded: boolean; onToggle: () => void }) {
  const sentiment = probe.sentiment_score ?? null;
  const sentimentInfo = sentiment != null ? sentimentLabel(sentiment) : null;
  const hasEvidence = probe.results_json && probe.results_json.length > 0;
  const placement = probe.placement_score ?? null;
  const placementLbl = placement != null
    ? placement <= 1.5 ? 'Top pick' : placement <= 2.5 ? 'Early' : placement <= 3.5 ? 'Middle' : 'Buried'
    : null;
  const placementColor = placement != null
    ? placement <= 1.5 ? 'var(--ok)' : placement <= 2.5 ? 'var(--ok)' : placement <= 3.5 ? 'var(--warn)' : 'var(--severe)'
    : 'var(--m-muted)';

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)', background: 'color-mix(in srgb, var(--ink) 2%, transparent)' }}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left" aria-expanded={expanded}>
        <span className="text-[13px] font-semibold flex-1" style={{ color: 'var(--ink)' }}>{probe.model_label}</span>
        <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full" style={{ color: scoreColorVar(probe.accuracy_score), background: `color-mix(in srgb, ${scoreColorVar(probe.accuracy_score)} 10%, transparent)` }}>
          {probe.accuracy_score}% accurate
        </span>
        {sentimentInfo && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sentimentInfo.color, background: `color-mix(in srgb, ${sentimentInfo.color} 10%, transparent)` }}>
            {sentimentInfo.label}
          </span>
        )}
        {placementLbl && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: placementColor, background: `color-mix(in srgb, ${placementColor} 10%, transparent)` }}>
            {placementLbl}
          </span>
        )}
        {probe.accuracy_score > 0 ? <Eye size={12} style={{ color: 'var(--ok)' }} /> : <EyeOff size={12} style={{ color: 'var(--m-muted)' }} />}
        {hasEvidence && <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--m-muted)' }} />}
      </button>
      {expanded && hasEvidence && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--rule)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] pt-3" style={{ color: 'var(--m-muted)' }}>Prompts and responses</p>
          {probe.results_json!.map((r, i) => (
            <div key={i} className="rounded-md p-3" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>Q: {r.question}</p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)', opacity: 0.85 }}>{r.answer}</p>
              {r.accuracy && (
                <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                  color: r.accuracy === 'Accurate' ? 'var(--ok)' : r.accuracy === 'Partially accurate' ? 'var(--warn)' : 'var(--severe)',
                  background: `color-mix(in srgb, ${r.accuracy === 'Accurate' ? 'var(--ok)' : r.accuracy === 'Partially accurate' ? 'var(--warn)' : 'var(--severe)'} 10%, transparent)`,
                }}>{r.accuracy}</span>
              )}
            </div>
          ))}
          {probe.sentiment_themes && probe.sentiment_themes.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>Perception themes</p>
              <div className="flex flex-wrap gap-1.5">
                {probe.sentiment_themes.map((t, i) => (
                  <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize" style={{
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

/** Fix recommendation card */
function FixRecommendationCard({ rec, auditId }: { rec: AuditRecommendation; auditId: string }) {
  const impactColor = rec.impact === 'high' ? 'var(--severe)' : rec.impact === 'medium' ? 'var(--warn)' : 'var(--m-muted)';
  const categoryIcon = rec.deployable ? <Code size={12} /> : <FileText size={12} />;

  return (
    <div className="rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--ink) 2%, transparent)', border: '1px solid var(--rule)' }}>
      <div className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}>
          {categoryIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{rec.title}</h4>
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full" style={{ color: impactColor, background: `color-mix(in srgb, ${impactColor} 10%, transparent)` }}>
              {rec.impact} impact
            </span>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{rec.description}</p>
          {rec.deployable && (
            <Link href={`/dashboard/fix?audit=${auditId}`} className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
              <Wrench size={10} /> Fix from console <ChevronRight size={10} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
