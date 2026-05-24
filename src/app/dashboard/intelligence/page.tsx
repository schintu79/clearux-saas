'use client';

/**
 * Brand Intelligence — unified dashboard view.
 *
 * Combines:
 *  - Section 1: Brand Intelligence Overview (5 headline metrics)
 *  - Section 2: AI Model Performance (per-model breakdown + evidence panel)
 *  - Section 7: Fix & Improve (actionable recommendations)
 *  - Legacy Benchmark Console (competitor management)
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
  Minus,
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
  Search,
  Shield,
  CheckCircle2,
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
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
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

  // UI state
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setDrafts([]);
      setServerSnapshot([]);
      setBenchmarkPosition(null);
      setIndustry(null);
      setBiSummary(null);
      setModelProbes([]);
      setRecommendations([]);
      return;
    }

    // Load brand intelligence from report
    const report = bundle?.report;
    if (report && (report as any).brand_intelligence) {
      setBiSummary((report as any).brand_intelligence as BrandIntelligenceSummary);
    }

    // Load model probes + recommendations from intelligence API
    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
        if (d?.modelProbes) setModelProbes(d.modelProbes);
        if (d?.recommendations) setRecommendations(d.recommendations);
      })
      .catch(() => {});

    // Load competitors
    const productUrl = audit.product_url;
    if (productUrl) {
      fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
        .then(r => r.json())
        .then(d => {
          const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
          setDrafts(list);
          setServerSnapshot(list);
          if (d?.industry) setIndustry(d.industry);
        })
        .catch(() => {});
    }
  }, [bundle]);

  const productUrl = bundle?.audit?.product_url || '';

  // Benchmark console helpers
  const isDirty = useMemo(() => {
    if (drafts.length !== serverSnapshot.length) return true;
    const key = (c: DraftCompetitor) => c.domain;
    const a = drafts.map(key).sort();
    const b = serverSnapshot.map(key).sort();
    return a.some((v, i) => v !== b[i]);
  }, [drafts, serverSnapshot]);

  const addRow = () => {
    setError(null);
    setInfo(null);
    if (drafts.length >= 5) {
      setError('You can track up to 5 competitors.');
      return;
    }
    setDrafts(prev => [...prev, { id: makeDraftId(), domain: '', score: null, source: 'manual' }]);
  };

  const updateRow = (id: string, patch: Partial<DraftCompetitor>) => {
    setDrafts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const removeRow = (id: string) => {
    setDrafts(prev => prev.filter(c => c.id !== id));
  };

  const resetEdits = () => {
    setDrafts(serverSnapshot);
    setError(null);
    setInfo(null);
  };

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
    setError(null);
    setInfo(null);
    const v = validate();
    if (!v.ok) { setError(v.message); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: productUrl,
          mode: 'save',
          competitors: v.cleaned.map(c => ({
            domain: c.domain,
            ...(c.name ? { name: c.name } : {}),
            ...(c.category ? { category: c.category } : {}),
            ...(c.note ? { note: c.note } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to save');
      }
      const d = await res.json();
      const next: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(next);
      setServerSnapshot(next);
      setInfo('Saved. Click Re-scan to refresh scores for the updated list.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const runAutoDetect = async () => {
    if (!productUrl) return;
    setError(null);
    setInfo(null);
    setDetecting(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, mode: 'auto' }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Auto-detect failed');
      }
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list);
      setServerSnapshot(list);
      if (d?.industry) setIndustry(d.industry);
      if (list.length === 0) {
        setInfo('Could not identify competitors automatically. Add them manually below.');
      } else {
        setInfo('Auto-detected. You can edit, remove, or add your own.');
      }
    } catch (e: any) {
      setError(e?.message || 'Auto-detect failed');
    } finally {
      setDetecting(false);
    }
  };

  const rescanScores = async () => {
    if (!productUrl) return;
    const domainsOnly = drafts.map(d => normalizeDomainInput(d.domain)).filter(Boolean);
    if (domainsOnly.length === 0) {
      setError('Add at least one competitor before re-scanning.');
      return;
    }
    setError(null);
    setInfo(null);
    setDetecting(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: productUrl,
          mode: 'manual',
          competitors: drafts.map(d => ({
            domain: normalizeDomainInput(d.domain),
            ...(d.name ? { name: d.name } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Re-scan failed');
      }
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list);
      setServerSnapshot(list);
      setInfo('Re-scan complete.');
    } catch (e: any) {
      setError(e?.message || 'Re-scan failed');
    } finally {
      setDetecting(false);
    }
  };

  /* ── Render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
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

  const isBrandAudit = (bundle.audit as any).audit_type === 'brand_identity';
  const overallScore = bundle.report.overall_score ?? 0;
  const scoredDrafts = drafts.filter(d => typeof d.score === 'number' && d.score > 0);
  const avgCompetitor = scoredDrafts.length > 0
    ? Math.round(scoredDrafts.reduce((s, c) => s + (c.score || 0), 0) / scoredDrafts.length)
    : null;

  return (
    <div>
      <OverviewBreadcrumb current="Brand Intelligence" />

      <PageHeader
        icon={<Radio size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Brand Intelligence"
        subtitle="How AI and humans perceive your brand — and what to do about it"
      />

      {/* ═══════════════════════════════════════════════════════════
          Section 1 — Brand Intelligence Overview (5 headline metrics)
         ═══════════════════════════════════════════════════════════ */}
      <section
        className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>
          Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* BI Score */}
          <MetricBlock
            label="Brand Intelligence Score"
            value={biSummary?.score ?? null}
            suffix="/100"
            explanation="Composite of AI visibility, sentiment, accuracy, and placement"
          />
          {/* AI Visibility */}
          <MetricBlock
            label="AI Visibility"
            value={biSummary?.aiVisibility ?? (modelProbes.length > 0 ? Math.round(modelProbes.filter(p => p.accuracy_score > 0).length / modelProbes.length * 100) : null)}
            suffix="%"
            explanation="Percentage of AI models that mention your brand"
          />
          {/* Placement Score */}
          <MetricBlock
            label="Placement Score"
            value={biSummary?.placementScore ?? null}
            suffix=""
            explanation="Average position in AI responses (lower is better)"
            invert
          />
          {/* Overall Sentiment */}
          <MetricBlock
            label="Overall Sentiment"
            value={biSummary?.overallSentiment ?? null}
            suffix="/100"
            explanation="How positively AI describes your brand"
          />
          {/* Share of Voice */}
          <MetricBlock
            label="Share of Voice"
            value={biSummary?.shareOfVoice ?? null}
            suffix="%"
            explanation="Your brand's share vs competitors in AI responses"
          />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 2 — AI Model Performance
         ═══════════════════════════════════════════════════════════ */}
      {modelProbes.length > 0 && (
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
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
          Sentiment Themes
         ═══════════════════════════════════════════════════════════ */}
      {biSummary && (biSummary.positiveThemes.length > 0 || biSummary.negativeThemes.length > 0) && (
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>
            Sentiment Themes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {biSummary.positiveThemes.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--ok)' }}>
                  What AI says positively
                </p>
                <ul className="space-y-1.5">
                  {biSummary.positiveThemes.map((t) => (
                    <li key={t} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink)' }}>
                      <CheckCircle2 size={11} style={{ color: 'var(--ok)' }} />
                      <span className="capitalize">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {biSummary.negativeThemes.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--severe)' }}>
                  What AI says critically
                </p>
                <ul className="space-y-1.5">
                  {biSummary.negativeThemes.map((t) => (
                    <li key={t} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink)' }}>
                      <AlertCircle size={11} style={{ color: 'var(--severe)' }} />
                      <span className="capitalize">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Section 7 — Fix & Improve
         ═══════════════════════════════════════════════════════════ */}
      {recommendations.length > 0 && (
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
            Fix and Improve
          </h2>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            Prioritized actions to improve how AI and humans see your brand.
          </p>

          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <FixRecommendationCard key={i} rec={rec} auditId={bundle.audit!.id} />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Competitive Benchmark Console (existing functionality)
         ═══════════════════════════════════════════════════════════ */}
      {!isBrandAudit && (
        <>
          <section
            className="rounded-xl p-5 mb-4"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <h2 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              Competitive Benchmark
            </h2>
            <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
              Edit competitors anytime. Auto-detect only suggests — you stay in control.
            </p>

            {/* Score hero */}
            <div className="flex flex-wrap items-start gap-6 mb-4 pb-4" style={{ borderBottom: '1px solid var(--rule)' }}>
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>Your score</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[36px] font-bold leading-none tabular-nums" style={{ color: scoreColorVar(overallScore) }}>{overallScore}</span>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
                </div>
              </div>
              {avgCompetitor != null && (
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>Competitor avg</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[36px] font-bold leading-none tabular-nums" style={{ color: scoreColorVar(avgCompetitor) }}>{avgCompetitor}</span>
                    <span className="text-[13px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
                  </div>
                </div>
              )}
              {benchmarkPosition?.benchmark && (
                <div className="flex flex-col items-start ml-auto">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                    Industry{industry ? ` — ${industry}` : ''}
                  </span>
                  <p className="text-[13px]" style={{ color: 'var(--ink)' }}>
                    Avg <span className="font-semibold tabular-nums">{benchmarkPosition.benchmark.avgScore}</span>/100
                    {benchmarkPosition.deltaFromAvg != null && (
                      <span className="font-semibold tabular-nums ml-2" style={{ color: benchmarkPosition.deltaFromAvg > 0 ? 'var(--ok)' : benchmarkPosition.deltaFromAvg < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                        {benchmarkPosition.deltaFromAvg > 0 ? '+' : ''}{benchmarkPosition.deltaFromAvg} vs. industry
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                type="button"
                onClick={runAutoDetect}
                disabled={detecting || saving}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
                style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
              >
                <Sparkles size={11} /> {drafts.length === 0 ? 'Auto-detect competitors' : 'Re-detect'}
              </button>
              {drafts.length > 0 && (
                <button
                  type="button"
                  onClick={rescanScores}
                  disabled={detecting || saving}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
                  style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
                >
                  <RefreshCw size={11} className={detecting ? 'animate-spin' : ''} /> Re-score
                </button>
              )}
              <button
                type="button"
                onClick={addRow}
                disabled={detecting || saving}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
                style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
              >
                <Plus size={11} /> Add competitor
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
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div className="mb-3 p-2.5 rounded-md flex items-start gap-2 text-[12px]" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink)' }}>
                <Info size={12} className="mt-0.5 flex-shrink-0" />
                <span>{info}</span>
              </div>
            )}

            {detecting && (
              <p className="text-[12px] mb-3" style={{ color: 'var(--m-muted)' }}>
                <Sparkles size={11} className="inline -mt-0.5 mr-1" /> Working... this may take a few seconds per competitor.
              </p>
            )}

            {/* Empty state */}
            {drafts.length === 0 && !detecting && (
              <div className="rounded-lg p-5 text-center" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                <LineChart size={20} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-2 opacity-50" />
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>No competitors configured yet</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
                  Auto-detect to get up to 5 suggestions, or add your own.
                </p>
              </div>
            )}

            {/* Editable rows */}
            {drafts.length > 0 && (
              <ul className="space-y-2">
                {drafts.map((c) => {
                  const score = c.score;
                  const cDelta = score != null ? overallScore - score : null;
                  return (
                    <li key={c.id} className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)', border: '1px solid var(--rule)' }}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={c.domain}
                          placeholder="example.com"
                          onChange={(e) => updateRow(c.id, { domain: e.target.value })}
                          className="flex-1 min-w-0 text-[13px] px-3 py-2 rounded-md outline-none"
                          style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                          aria-label="Competitor domain"
                        />
                        <button type="button" onClick={() => removeRow(c.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:opacity-80 flex-shrink-0" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 8%, transparent)' }} aria-label={`Remove ${c.domain || 'competitor'}`}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3 mt-2.5 pt-2.5" style={{ borderTop: '1px dashed var(--rule)' }}>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full" style={{ color: c.source === 'manual' ? 'var(--m-muted)' : 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                          {c.source === 'manual' ? <><Pencil size={9} className="inline -mt-0.5 mr-1" />Manual</> : <><Sparkles size={9} className="inline -mt-0.5 mr-1" />Auto</>}
                        </span>
                        {score != null && score > 0 ? (
                          <>
                            <span className="h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ width: 120, background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}>
                              <span className="block h-full" style={{ width: `${score}%`, background: scoreColorVar(score) }} />
                            </span>
                            <span className="tabular-nums font-semibold text-[12px]" style={{ color: scoreColorVar(score) }}>{score}/100</span>
                            {cDelta != null && (
                              <span className="tabular-nums text-[11px]" style={{ color: cDelta > 0 ? 'var(--ok)' : cDelta < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                                (you {cDelta > 0 ? `+${cDelta}` : cDelta})
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                            Not yet scored — click <strong style={{ color: 'var(--ink)' }}>Re-score</strong> to benchmark.
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <p className="text-[11px] mb-4" style={{ color: 'var(--m-muted)' }}>
            Want pillar-level breakdowns and the raw competitor analysis?{' '}
            <Link
              href={`/dashboard/audits/${bundle.audit.id}#intelligence`}
              className="inline-flex items-center gap-1 font-semibold hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              Open the full report <ExternalLink size={10} />
            </Link>
          </p>
        </>
      )}

      {isBrandAudit && (
        <section
          className="rounded-xl p-6 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-start gap-3">
            <LineChart size={18} style={{ color: 'var(--m-muted)' }} className="mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                Competitive benchmarks need a live site
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
                Brand-only audits don&apos;t have a public URL to compare. Run a site audit on the same brand to unlock competitor benchmarks.
              </p>
              <Link
                href="/dashboard/new-audit"
                className="inline-flex items-center gap-1 mt-3 text-[12px] font-semibold hover:underline"
                style={{ color: 'var(--ink)' }}
              >
                Run a site audit <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────── */

function MetricBlock({
  label,
  value,
  suffix,
  explanation,
  invert,
}: {
  label: string;
  value: number | null;
  suffix: string;
  explanation: string;
  invert?: boolean;
}) {
  const color = value != null
    ? (invert
      ? (value <= 2 ? 'var(--ok)' : value <= 4 ? 'var(--warn)' : 'var(--severe)')
      : scoreColorVar(value))
    : 'var(--m-muted)';

  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--m-muted)' }}>
        {label}
      </span>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color }}>
          {value != null ? value : '—'}
        </span>
        {value != null && suffix && (
          <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>{suffix}</span>
        )}
      </div>
      <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--m-muted)' }}>
        {explanation}
      </p>
    </div>
  );
}

function ModelProbeRow({
  probe,
  expanded,
  onToggle,
}: {
  probe: ModelProbe;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sentiment = probe.sentiment_score ?? null;
  const sentimentInfo = sentiment != null ? sentimentLabel(sentiment) : null;
  const hasEvidence = probe.results_json && probe.results_json.length > 0;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--rule)', background: 'color-mix(in srgb, var(--ink) 2%, transparent)' }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        <span className="text-[13px] font-semibold flex-1" style={{ color: 'var(--ink)' }}>
          {probe.model_label}
        </span>

        {/* Accuracy */}
        <span className="text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full" style={{ color: scoreColorVar(probe.accuracy_score), background: `color-mix(in srgb, ${scoreColorVar(probe.accuracy_score)} 10%, transparent)` }}>
          {probe.accuracy_score}% accurate
        </span>

        {/* Sentiment pill */}
        {sentimentInfo && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: sentimentInfo.color, background: `color-mix(in srgb, ${sentimentInfo.color} 10%, transparent)` }}>
            {sentimentInfo.label}
          </span>
        )}

        {/* Visibility indicator */}
        {probe.accuracy_score > 0 ? (
          <Eye size={12} style={{ color: 'var(--ok)' }} />
        ) : (
          <EyeOff size={12} style={{ color: 'var(--m-muted)' }} />
        )}

        {hasEvidence && (
          <ChevronDown
            size={12}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--m-muted)' }}
          />
        )}
      </button>

      {/* Evidence panel */}
      {expanded && hasEvidence && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--rule)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] pt-3" style={{ color: 'var(--m-muted)' }}>
            Prompts and responses
          </p>
          {probe.results_json!.map((r, i) => (
            <div key={i} className="rounded-md p-3" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <p className="text-[11px] font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
                Q: {r.question}
              </p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)', opacity: 0.85 }}>
                {r.answer}
              </p>
              {r.accuracy && (
                <span
                  className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: r.accuracy === 'Accurate' ? 'var(--ok)' : r.accuracy === 'Partially accurate' ? 'var(--warn)' : 'var(--severe)',
                    background: `color-mix(in srgb, ${r.accuracy === 'Accurate' ? 'var(--ok)' : r.accuracy === 'Partially accurate' ? 'var(--warn)' : 'var(--severe)'} 10%, transparent)`,
                  }}
                >
                  {r.accuracy}
                </span>
              )}
            </div>
          ))}

          {/* Sentiment themes for this model */}
          {probe.sentiment_themes && probe.sentiment_themes.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>
                Perception themes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {probe.sentiment_themes.map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full capitalize"
                    style={{
                      color: t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)',
                      background: `color-mix(in srgb, ${t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)'} 10%, transparent)`,
                    }}
                  >
                    {t.theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FixRecommendationCard({
  rec,
  auditId,
}: {
  rec: AuditRecommendation;
  auditId: string;
}) {
  const impactColor = rec.impact === 'high' ? 'var(--severe)' : rec.impact === 'medium' ? 'var(--warn)' : 'var(--m-muted)';
  const categoryIcon = rec.deployable ? <Code size={12} /> : <FileText size={12} />;

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: 'color-mix(in srgb, var(--ink) 2%, transparent)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
        >
          {categoryIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              {rec.title}
            </h4>
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full"
              style={{ color: impactColor, background: `color-mix(in srgb, ${impactColor} 10%, transparent)` }}
            >
              {rec.impact} impact
            </span>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
            {rec.description}
          </p>
          {rec.deployable && (
            <Link
              href={`/dashboard/fix?audit=${auditId}`}
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              <Wrench size={10} /> Fix from console <ChevronRight size={10} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
