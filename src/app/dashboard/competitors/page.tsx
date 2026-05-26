'use client';

/**
 * Competitors — competitive benchmark and industry position.
 *
 * Shows the brand's competitive landscape: where it stands vs. competitors,
 * industry averages, and per-model benchmark data. Users can auto-detect
 * competitors, add them manually, and rescan.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  ChevronDown,
  ArrowRight,
  Globe,
  Check,
  Pencil,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import ScoreCircle from '@/components/ui/ScoreCircle';
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

type BenchmarkPosition = {
  userScore?: number;
  deltaFromAvg?: number;
  benchmark?: { avgScore: number; sampleSize?: number };
  comparedAgainst?: string;
};

/* ── Helpers ────────────────────────────────────────── */

function scoreColorVar(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
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

/* ── Main Page ─────────────────────────────────────── */

export default function CompetitorsPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || bundleLoading || !ready;

  // Intelligence data
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
  const [benchmarkPosition, setBenchmarkPosition] = useState<BenchmarkPosition | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);

  // Competitor management
  const [drafts, setDrafts] = useState<DraftCompetitor[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<DraftCompetitor[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const productUrl = useMemo(() => {
    const a = bundle?.audit;
    return a?.product_url || null;
  }, [bundle]);

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setDrafts([]); setServerSnapshot([]); setBenchmarkPosition(null);
      setIndustry(null); setBiSummary(null);
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
      })
      .catch(() => {});

    if (!productUrl) return;
    fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
        setDrafts(list);
        setServerSnapshot(list);
      })
      .catch(() => {});
  }, [bundle, productUrl]);

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
    const v = { valid: true, cleaned: drafts.filter(d => d.domain.trim()).map(d => ({ ...d, domain: normalizeDomainInput(d.domain) })) };
    for (const c of v.cleaned) { if (!DOMAIN_RE.test(c.domain)) { setError(`Invalid domain: ${c.domain}`); setSaving(false); return; } }
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        body: JSON.stringify({ url: productUrl, mode: 'save', competitors: v.cleaned.map(c => ({ domain: c.domain, ...(c.name ? { name: c.name } : {}), ...(c.category ? { category: c.category } : {}), ...(c.note ? { note: c.note } : {}) })) }),
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
    setDetecting(true); setError(null); setInfo(null);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST',
        body: JSON.stringify({ url: productUrl, mode: 'auto' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list); setServerSnapshot(list);
      setInfo(list.length === 0 ? 'Could not identify competitors. Add them manually.' : 'Auto-detected. You can edit or add your own.');
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

  const userScore = benchmarkPosition?.userScore ?? (biSummary?.overallSentiment ?? null);

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
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        icon={<Target size={18} strokeWidth={1.75} />}
        title="Competitors"
        subtitle="See where you stand in your industry and track competitor performance"
      />

      {/* Hero: Your position */}
      <DashCard>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-shrink-0">
            <ScoreCircle score={userScore} size="big" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Industry position</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
              {industry ? `Industry: ${industry}` : 'Industry not yet detected'}
              {benchmarkPosition?.benchmark && (
                <>
                  {' '}&middot; Avg score: <span className="font-semibold" style={{ color: 'var(--ink)' }}>{benchmarkPosition.benchmark.avgScore}/100</span>
                  {benchmarkPosition.deltaFromAvg != null && (
                    <span className="ml-1.5 font-semibold" style={{ color: benchmarkPosition.deltaFromAvg > 0 ? 'var(--ok)' : benchmarkPosition.deltaFromAvg < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                      {benchmarkPosition.deltaFromAvg > 0 ? '+' : ''}{benchmarkPosition.deltaFromAvg} vs. avg
                    </span>
                  )}
                </>
              )}
            </p>
            {biSummary?.shareOfVoice != null && (
              <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
                Share of voice: <span className="font-semibold" style={{ color: 'var(--ink)' }}>{biSummary.shareOfVoice}%</span>
              </p>
            )}
          </div>
        </div>
      </DashCard>

      {/* Competitor table */}
      <DashCard>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Tracked competitors</h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>Up to 5 competitors. Auto-detect or add manually.</p>
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
        {info && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md mb-3" style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--ok)' }}>
            <Info size={13} />
            <span className="text-[12px]">{info}</span>
            <button onClick={() => setInfo(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="text-center py-10">
            <Target size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>No competitors tracked yet</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>Use auto-detect to find competitors in your industry, or add them manually.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_80px_36px] gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>
              <span>Competitor</span>
              <span className="text-right">Score</span>
              <span className="text-right">Source</span>
              <span />
            </div>
            {drafts.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_80px_80px_36px] gap-3 items-center px-3 py-2.5 rounded-md hover:bg-black/[0.02] transition-colors" style={{ borderBottom: '1px solid var(--rule)' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <Globe size={14} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0" />
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
                      {c.name && <p className="text-[11px] truncate" style={{ color: 'var(--m-muted)' }}>{c.domain}</p>}
                    </div>
                  )}
                </div>
                <span className="text-right text-[13px] font-semibold tabular-nums" style={{ color: scoreColorVar(c.score) }}>
                  {c.score != null ? c.score : '--'}
                </span>
                <span className="text-right text-[11px] capitalize" style={{ color: 'var(--m-muted)' }}>{c.source}</span>
                <button onClick={() => removeDraft(c.id)} className="p-1 rounded hover:bg-black/[0.04] transition-colors" title="Remove">
                  <Trash2 size={13} style={{ color: 'var(--m-muted)' }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action bar */}
        {(isDirty || showEditor) && (
          <div className="flex items-center justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
            <button
              onClick={() => { setShowEditor(!showEditor); }}
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

      {/* Pillar breakdown for competitors that have it */}
      {drafts.some(c => c.pillarScores && c.pillarScores.length > 0) && (
        <DashCard>
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>Score breakdown by pillar</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                  <th className="text-left py-2 pr-3 font-semibold" style={{ color: 'var(--m-muted)' }}>Competitor</th>
                  {(drafts.find(c => c.pillarScores?.length)?.pillarScores || []).map(p => (
                    <th key={p.name} className="text-right py-2 px-2 font-semibold" style={{ color: 'var(--m-muted)' }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Your brand row */}
                <tr style={{ borderBottom: '1px solid var(--rule)' }}>
                  <td className="py-2.5 pr-3 font-semibold" style={{ color: 'var(--ink)' }}>You</td>
                  {(drafts.find(c => c.pillarScores?.length)?.pillarScores || []).map(p => (
                    <td key={p.name} className="text-right py-2.5 px-2 tabular-nums font-semibold" style={{ color: scoreColorVar(userScore) }}>
                      {userScore ?? '--'}
                    </td>
                  ))}
                </tr>
                {drafts.filter(c => c.pillarScores?.length).map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td className="py-2.5 pr-3 font-medium" style={{ color: 'var(--ink)' }}>{c.name || c.domain}</td>
                    {(c.pillarScores || []).map(p => (
                      <td key={p.name} className="text-right py-2.5 px-2 tabular-nums" style={{ color: scoreColorVar(p.score) }}>
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
    </div>
  );
}
