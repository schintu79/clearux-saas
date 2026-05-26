'use client';

/**
 * Competitors — pure brand vs. competitors comparison.
 *
 * Every section on this page shows the audited brand alongside
 * competitor data in a grid. If a section has no comparative data
 * it is not shown. Non-comparative data (AI visibility by model,
 * visibility trend, sentiment themes) belongs on Brand Intelligence.
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
  Eye,
  Zap,
  Shield,
  Users,
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

/* ── Main Page ─────────────────────────────────────── */

export default function CompetitorsPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || bundleLoading || !ready;

  // Intelligence data
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
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
    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
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
          2. COMPETITOR COMPARISON — Unified scoring table
         ══════════════════════════════════════════════════ */}
      <DashCard>
        <div className="flex items-center justify-between mb-1">
          <SectionTitle>Competitor comparison</SectionTitle>
          {/* Add button — inside the card, muted at 5 */}
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

        {drafts.length === 0 && !showEditor ? (
          <div className="text-center py-10">
            <Target size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>No competitors tracked yet</p>
            <p className="text-[12px] mt-1 mb-4" style={{ color: 'var(--m-muted)' }}>Use auto-detect to find competitors in your industry, or add them manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
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
                {/* User's brand row — highlighted */}
                <tr style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <SiteFavicon hostname={domain || ''} size={16} />
                      <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{brandName}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell py-3 px-3 text-[12px] truncate" style={{ color: 'var(--m-muted)' }}>{domain}</td>
                  <td className="text-center py-3 px-3 text-[14px] font-bold tabular-nums" style={{ color: userScore != null ? getScoreColor(userScore) : 'var(--m-muted)' }}>
                    {userScore ?? '--'}
                  </td>
                  {pillarNames.map(p => (
                    <td key={p} className="text-center py-3 px-3 tabular-nums font-semibold" style={{ color: userScore != null ? getScoreColor(userScore) : 'var(--m-muted)' }}>
                      {userScore ?? '--'}
                    </td>
                  ))}
                  <td className="hidden sm:table-cell text-center py-3 px-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--ok) 10%, transparent)', color: 'var(--ok)' }}>
                      Audited
                    </span>
                  </td>
                  <td />
                </tr>

                {/* Competitor rows */}
                {drafts.map((c) => (
                  <tr key={c.id} className="hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2.5">
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
                ))}
              </tbody>
            </table>
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
          3. AI MENTIONS — Brand vs competitors in AI responses
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
