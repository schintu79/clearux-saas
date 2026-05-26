'use client';

/**
 * Competitors — competitive benchmark and industry positioning.
 *
 * Shows the brand's competitive landscape with real data from the
 * intelligence API: pillar score comparison, AI visibility trends,
 * per-model sentiment, share of voice, and a side-by-side table.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
  ExternalLink,
  Eye,
  BarChart3,
  Award,
  Zap,
  Shield,
  Users,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
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

type ModelProbe = {
  model_id: string;
  model_label: string;
  accuracy_score: number;
  sentiment_score?: number | null;
  placement_score?: number | null;
  share_of_voice?: number | null;
  status?: 'measured' | 'skipped' | 'error' | null;
};

type TrendSnapshot = {
  snapshot_at: string;
  bi_score: number;
  ai_visibility: number;
  overall_sentiment: number;
  share_of_voice: number | null;
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

function formatMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short' });
  } catch { return ''; }
}

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

/* ── Main Page ─────────────────────────────────────── */

export default function CompetitorsPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || bundleLoading || !ready;

  // Intelligence data
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
  const [modelProbes, setModelProbes] = useState<ModelProbe[]>([]);
  const [trendSnapshots, setTrendSnapshots] = useState<TrendSnapshot[]>([]);
  const [promptResults, setPromptResults] = useState<PromptResult[]>([]);
  const [industry, setIndustry] = useState<string | null>(null);
  const [benchmarkPosition, setBenchmarkPosition] = useState<any>(null);

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

  // Speed data
  const speedData = useMemo(() => {
    const sd = (audit as any)?.speed_data;
    if (!sd) return null;
    return typeof sd === 'string' ? JSON.parse(sd) : sd;
  }, [audit]);

  /* ── Load data ────────────────────────────────────── */

  useEffect(() => {
    if (!audit) {
      setDrafts([]); setServerSnapshot([]); setBenchmarkPosition(null);
      setIndustry(null); setBiSummary(null); setModelProbes([]);
      setTrendSnapshots([]); setPromptResults([]);
      return;
    }

    const report = bundle?.report;
    if (report && (report as any).brand_intelligence) {
      setBiSummary((report as any).brand_intelligence as BrandIntelligenceSummary);
    }

    // Fetch intelligence data
    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
        setModelProbes(d?.modelProbes || []);
        setTrendSnapshots(d?.trendSnapshots || []);
        setPromptResults(d?.promptResults || []);
      })
      .catch(() => {});

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
    if (drafts.length >= 5) { setError('You can track up to 5 competitors.'); return; }
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

  const userScore = benchmarkPosition?.userScore
    ?? biSummary?.score
    ?? (bundle?.report as any)?.overall_score
    ?? null;

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
      { domain: domain || '', name: brandName, score: userScore, isUser: true, pillarScores: undefined as any },
      ...drafts.map(d => ({ domain: d.domain, name: d.name || d.domain, score: d.score, isUser: false, pillarScores: d.pillarScores })),
    ].filter(c => c.score != null);
    return all.sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [drafts, userScore, brandName, domain]);

  const userRank = rankedCompetitors.findIndex(c => c.isUser) + 1;

  // Pillar names from competitor data
  const pillarNames = useMemo(() => {
    const first = drafts.find(c => c.pillarScores && c.pillarScores.length > 0);
    return first?.pillarScores?.map(p => p.name) || [];
  }, [drafts]);

  // AI model probes — only measured
  const measuredProbes = useMemo(() => modelProbes.filter(p => p.status === 'measured'), [modelProbes]);

  // Competitor mentions from prompt results
  const competitorMentions = useMemo(() => {
    const map = new Map<string, { mentions: number; avgPlacement: number; placements: number[] }>();
    promptResults.forEach(pr => {
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
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 8);
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
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        icon={<Target size={18} strokeWidth={1.75} />}
        title="Competitors"
        subtitle={`Competitive positioning for ${brandName}`}
      />

      {/* ══════════════════════════════════════════════════
          1. HERO — Score ranking with position
         ══════════════════════════════════════════════════ */}
      <DashCard>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-shrink-0">
            <ScoreCircle score={userScore} size="big" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SiteFavicon hostname={domain || ''} size={16} />
              <h2 className="text-[17px] font-semibold" style={{ color: 'var(--ink)' }}>{brandName}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]" style={{ color: 'var(--m-muted)' }}>
              {industry && <span>Industry: <span className="font-medium" style={{ color: 'var(--ink)' }}>{industry}</span></span>}
              {userRank > 0 && rankedCompetitors.length > 1 && (
                <span>Rank: <span className="font-semibold" style={{ color: 'var(--ink)' }}>#{userRank}</span> of {rankedCompetitors.length}</span>
              )}
              {userDelta != null && (
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: userDelta > 0 ? 'var(--ok)' : userDelta < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                  {deltaLabel(userDelta).icon}
                  {userDelta > 0 ? '+' : ''}{userDelta} vs. competitor avg
                </span>
              )}
            </div>
            {biSummary?.shareOfVoice != null && (
              <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
                AI share of voice: <span className="font-semibold" style={{ color: 'var(--ink)' }}>{biSummary.shareOfVoice}%</span>
              </p>
            )}
            {benchmarkPosition?.benchmark && (
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                Industry avg: <span className="font-medium" style={{ color: 'var(--ink)' }}>{benchmarkPosition.benchmark.avgScore ?? benchmarkPosition.benchmark}/100</span>
                {benchmarkPosition.percentile != null && (
                  <> &middot; {brandName} is in the <span className="font-semibold" style={{ color: 'var(--ink)' }}>top {100 - benchmarkPosition.percentile}%</span></>
                )}
              </p>
            )}
          </div>
        </div>
      </DashCard>

      {/* ══════════════════════════════════════════════════
          2. SIDE-BY-SIDE — Competitor ranking table
         ══════════════════════════════════════════════════ */}
      <DashCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <SectionTitle>Competitor side-by-side</SectionTitle>
            <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
              Compare {brandName} against competitors across all metrics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {drafts.length > 0 && (
              <button
                onClick={rescan}
                disabled={detecting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors hover:bg-black/[0.04]"
                style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
              >
                <RefreshCw size={12} className={detecting ? 'animate-spin' : ''} />
                Rescan
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
            <button
              onClick={addBlank}
              className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors hover:bg-black/[0.04]"
              style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
            >
              <Plus size={12} />
              Add
            </button>
          </div>
        </div>

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

        {drafts.length === 0 && !showEditor ? (
          <div className="text-center py-10">
            <Target size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>No competitors tracked yet</p>
            <p className="text-[12px] mt-1 mb-4" style={{ color: 'var(--m-muted)' }}>Use auto-detect to find competitors in your industry, or add them manually.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_60px_60px_36px] sm:grid-cols-[1fr_200px_80px_80px_36px] gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>
              <span>Brand</span>
              <span className="hidden sm:block">Domain</span>
              <span className="text-right">Score</span>
              <span className="text-right hidden sm:block">Status</span>
              <span />
            </div>

            {/* User's brand row — always first, highlighted */}
            <div
              className="grid grid-cols-[1fr_60px_60px_36px] sm:grid-cols-[1fr_200px_80px_80px_36px] gap-3 items-center px-3 py-3 rounded-md"
              style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)', borderBottom: '1px solid var(--rule)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <SiteFavicon hostname={domain || ''} size={18} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{brandName}</p>
                  <p className="text-[11px] sm:hidden truncate" style={{ color: 'var(--m-muted)' }}>{domain}</p>
                </div>
              </div>
              <span className="hidden sm:block text-[12px] truncate" style={{ color: 'var(--m-muted)' }}>{domain}</span>
              <span className="text-right text-[14px] font-bold tabular-nums" style={{ color: userScore != null ? getScoreColor(userScore) : 'var(--m-muted)' }}>
                {userScore ?? '--'}
              </span>
              <span className="text-right hidden sm:flex items-center justify-end">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)', color: 'var(--ink)' }}>
                  <Eye size={10} /> Active
                </span>
              </span>
              <span />
            </div>

            {/* Competitor rows */}
            {drafts.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_60px_60px_36px] sm:grid-cols-[1fr_200px_80px_80px_36px] gap-3 items-center px-3 py-2.5 rounded-md hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--rule)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <SiteFavicon hostname={c.domain} size={18} />
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
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{c.name || c.domain}</p>
                      {c.name && <p className="text-[11px] sm:hidden truncate" style={{ color: 'var(--m-muted)' }}>{c.domain}</p>}
                    </div>
                  )}
                </div>
                <span className="hidden sm:block text-[12px] truncate" style={{ color: 'var(--m-muted)' }}>{c.domain}</span>
                <span className="text-right text-[13px] font-semibold tabular-nums" style={{ color: c.score != null ? getScoreColor(c.score) : 'var(--m-muted)' }}>
                  {c.score != null ? c.score : '--'}
                </span>
                <span className="text-right hidden sm:block text-[11px] capitalize" style={{ color: 'var(--m-muted)' }}>
                  {c.source}
                </span>
                <button onClick={() => removeDraft(c.id)} className="p-1 rounded hover:bg-black/[0.04] transition-colors" title="Remove">
                  <Trash2 size={13} style={{ color: 'var(--m-muted)' }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action bar */}
        {(isDirty || showEditor || drafts.length > 0) && (
          <div className="flex items-center justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
            <button
              onClick={() => setShowEditor(!showEditor)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors hover:bg-black/[0.04]"
              style={{ color: 'var(--m-muted)' }}
            >
              <Pencil size={12} />
              {showEditor ? 'Done editing' : 'Edit'}
            </button>
            {isDirty && (
              <button
                onClick={saveCompetitors}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all hover:opacity-90"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                <Save size={12} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        )}
      </DashCard>

      {/* ══════════════════════════════════════════════════
          3. PILLAR BREAKDOWN — Score comparison by category
         ══════════════════════════════════════════════════ */}
      {pillarNames.length > 0 && (
        <DashCard>
          <SectionTitle>Score breakdown</SectionTitle>
          <SectionDesc>Category-level comparison across all tracked competitors.</SectionDesc>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-[12px]" style={{ minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--m-muted)' }}>Brand</th>
                  <th className="text-center py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)' }}>Overall</th>
                  {pillarNames.map(p => (
                    <th key={p} className="text-center py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)' }}>
                      <div className="flex items-center justify-center gap-1">
                        {PILLAR_ICONS[p] || null}
                        {p}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Brand row */}
                <tr style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <SiteFavicon hostname={domain || ''} size={14} />
                      <span className="font-semibold" style={{ color: 'var(--ink)' }}>{brandName}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-3 font-bold tabular-nums" style={{ color: userScore != null ? getScoreColor(userScore) : 'var(--m-muted)' }}>
                    {userScore ?? '--'}
                  </td>
                  {pillarNames.map(p => (
                    <td key={p} className="text-center py-3 px-3 tabular-nums font-semibold" style={{ color: userScore != null ? getScoreColor(userScore) : 'var(--m-muted)' }}>
                      {userScore ?? '--'}
                    </td>
                  ))}
                </tr>
                {drafts.filter(c => c.pillarScores?.length).map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <SiteFavicon hostname={c.domain} size={14} />
                        <span className="font-medium" style={{ color: 'var(--ink)' }}>{c.name || c.domain}</span>
                      </div>
                    </td>
                    <td className="text-center py-3 px-3 font-bold tabular-nums" style={{ color: c.score != null ? getScoreColor(c.score) : 'var(--m-muted)' }}>
                      {c.score ?? '--'}
                    </td>
                    {(c.pillarScores || []).map(p => (
                      <td key={p.name} className="text-center py-3 px-3 tabular-nums" style={{ color: getScoreColor(p.score) }}>
                        {p.score}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashCard>
      )}

      {/* ══════════════════════════════════════════════════
          4. AI VISIBILITY — Per-model performance
         ══════════════════════════════════════════════════ */}
      {measuredProbes.length > 0 && (
        <DashCard>
          <SectionTitle>AI visibility by model</SectionTitle>
          <SectionDesc>How each AI model perceives and represents {brandName}.</SectionDesc>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {measuredProbes.map(probe => (
              <div
                key={probe.model_id}
                className="rounded-lg p-3"
                style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--m-muted)' }}>
                  {probe.model_label}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[22px] font-bold tabular-nums" style={{ color: getScoreColor(probe.accuracy_score) }}>
                    {probe.accuracy_score}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>accuracy</span>
                </div>
                <div className="mt-2 space-y-1">
                  {probe.sentiment_score != null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: 'var(--m-muted)' }}>Sentiment</span>
                      <span className="font-semibold tabular-nums" style={{ color: getScoreColor(probe.sentiment_score) }}>{probe.sentiment_score}</span>
                    </div>
                  )}
                  {probe.share_of_voice != null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: 'var(--m-muted)' }}>Share of voice</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{probe.share_of_voice}%</span>
                    </div>
                  )}
                  {probe.placement_score != null && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: 'var(--m-muted)' }}>Avg placement</span>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>#{probe.placement_score}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DashCard>
      )}

      {/* ══════════════════════════════════════════════════
          5. COMPETITOR MENTIONS — Who gets mentioned in AI
         ══════════════════════════════════════════════════ */}
      {competitorMentions.length > 0 && (
        <DashCard>
          <SectionTitle>Who AI models mention</SectionTitle>
          <SectionDesc>Brands that appear alongside {brandName} when AI models answer industry questions.</SectionDesc>

          <div className="space-y-0">
            <div className="grid grid-cols-[1fr_80px_80px] gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>
              <span>Competitor</span>
              <span className="text-right">Mentions</span>
              <span className="text-right">Avg rank</span>
            </div>
            {competitorMentions.map(cm => {
              const matchedDraft = drafts.find(d => d.domain.includes(cm.name) || (d.name || '').toLowerCase().includes(cm.name));
              return (
                <div key={cm.name} className="grid grid-cols-[1fr_80px_80px] gap-3 items-center px-3 py-2.5 hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--rule)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {matchedDraft ? (
                      <SiteFavicon hostname={matchedDraft.domain} size={14} />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-sm" style={{ background: 'color-mix(in srgb, var(--ink) 10%, transparent)' }} />
                    )}
                    <span className="text-[13px] font-medium capitalize truncate" style={{ color: 'var(--ink)' }}>{cm.name}</span>
                  </div>
                  <span className="text-right text-[13px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {cm.mentions}
                  </span>
                  <span className="text-right text-[13px] tabular-nums" style={{ color: cm.avgPlacement <= 2 ? 'var(--ok)' : cm.avgPlacement <= 3 ? 'var(--warn)' : 'var(--severe)' }}>
                    {cm.avgPlacement > 0 ? `#${cm.avgPlacement}` : '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </DashCard>
      )}

      {/* ══════════════════════════════════════════════════
          6. SPEED COMPARISON — If speed data available
         ══════════════════════════════════════════════════ */}
      {speedData && (speedData.mobile || speedData.desktop) && (
        <DashCard>
          <SectionTitle>Performance snapshot</SectionTitle>
          <SectionDesc>{brandName} page speed compared to competitor benchmarks.</SectionDesc>

          <div className="grid grid-cols-2 gap-4">
            {speedData.mobile && (
              <div className="rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--m-muted)' }}>Mobile</p>
                <div className="flex items-center gap-3">
                  <ScoreCircle score={speedData.mobile.score} size="normal" />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Performance</p>
                    {speedData.mobile.metrics?.lcp && (
                      <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                        LCP: {(speedData.mobile.metrics.lcp.value / 1000).toFixed(1)}s
                      </p>
                    )}
                    {speedData.mobile.metrics?.cls && (
                      <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                        CLS: {speedData.mobile.metrics.cls.value.toFixed(3)}
                      </p>
                    )}
                  </div>
                </div>
                {speedData.mobile.categories && (
                  <div className="mt-3 pt-3 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid var(--rule)' }}>
                    {Object.entries(speedData.mobile.categories as Record<string, number>).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-[11px]">
                        <span className="capitalize" style={{ color: 'var(--m-muted)' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-semibold tabular-nums" style={{ color: getScoreColor(val) }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {speedData.desktop && (
              <div className="rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--m-muted)' }}>Desktop</p>
                <div className="flex items-center gap-3">
                  <ScoreCircle score={speedData.desktop.score} size="normal" />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Performance</p>
                    {speedData.desktop.metrics?.lcp && (
                      <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                        LCP: {(speedData.desktop.metrics.lcp.value / 1000).toFixed(1)}s
                      </p>
                    )}
                    {speedData.desktop.metrics?.cls && (
                      <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                        CLS: {speedData.desktop.metrics.cls.value.toFixed(3)}
                      </p>
                    )}
                  </div>
                </div>
                {speedData.desktop.categories && (
                  <div className="mt-3 pt-3 grid grid-cols-2 gap-2" style={{ borderTop: '1px solid var(--rule)' }}>
                    {Object.entries(speedData.desktop.categories as Record<string, number>).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-[11px]">
                        <span className="capitalize" style={{ color: 'var(--m-muted)' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="font-semibold tabular-nums" style={{ color: getScoreColor(val) }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DashCard>
      )}

      {/* ══════════════════════════════════════════════════
          7. TREND — Intelligence score over time
         ══════════════════════════════════════════════════ */}
      {trendSnapshots.length >= 2 && (
        <DashCard>
          <SectionTitle>Visibility trend</SectionTitle>
          <SectionDesc>Track how {brandName} AI visibility changes over time.</SectionDesc>

          {/* Simple sparkline-style trend visualization */}
          <div className="relative h-32 mt-2">
            <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" className="overflow-visible">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(y => (
                <line key={y} x1="0" y1={100 - y} x2="400" y2={100 - y} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="4 4" />
              ))}
              {/* Score line */}
              <polyline
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={trendSnapshots.map((s, i) => {
                  const x = (i / (trendSnapshots.length - 1)) * 400;
                  const y = 100 - (s.bi_score || 0);
                  return `${x},${y}`;
                }).join(' ')}
              />
              {/* AI Visibility line */}
              <polyline
                fill="none"
                stroke="var(--ok)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="4 2"
                points={trendSnapshots.map((s, i) => {
                  const x = (i / (trendSnapshots.length - 1)) * 400;
                  const y = 100 - (s.ai_visibility || 0);
                  return `${x},${y}`;
                }).join(' ')}
              />
            </svg>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{formatMonth(trendSnapshots[0].snapshot_at)}</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded-full" style={{ background: 'var(--ink)' }} />
                <span style={{ color: 'var(--m-muted)' }}>Score</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded-full" style={{ background: 'var(--ok)', opacity: 0.7 }} />
                <span style={{ color: 'var(--m-muted)' }}>AI visibility</span>
              </span>
            </div>
            <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{formatMonth(trendSnapshots[trendSnapshots.length - 1].snapshot_at)}</span>
          </div>
        </DashCard>
      )}

      {/* ══════════════════════════════════════════════════
          8. SENTIMENT THEMES — What AI says positively/negatively
         ══════════════════════════════════════════════════ */}
      {biSummary && ((biSummary.positiveThemes?.length || 0) > 0 || (biSummary.negativeThemes?.length || 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(biSummary.positiveThemes?.length || 0) > 0 && (
            <DashCard>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} style={{ color: 'var(--ok)' }} />
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Strengths AI highlights</h3>
              </div>
              <div className="space-y-1.5">
                {biSummary.positiveThemes?.slice(0, 5).map((theme, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--ok) 8%, transparent)' }}>
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--ok)' }} />
                    <span style={{ color: 'var(--ink)' }}>{theme}</span>
                  </div>
                ))}
              </div>
            </DashCard>
          )}
          {(biSummary.negativeThemes?.length || 0) > 0 && (
            <DashCard>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={14} style={{ color: 'var(--severe)' }} />
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Weaknesses AI identifies</h3>
              </div>
              <div className="space-y-1.5">
                {biSummary.negativeThemes?.slice(0, 5).map((theme, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] px-2.5 py-1.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)' }}>
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--severe)' }} />
                    <span style={{ color: 'var(--ink)' }}>{theme}</span>
                  </div>
                ))}
              </div>
            </DashCard>
          )}
        </div>
      )}
    </div>
  );
}
