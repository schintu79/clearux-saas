'use client';

/**
 * Intelligence — workspace view for the selected brand/site.
 *
 * Hosts the Benchmark Console: an always-editable list of competitors
 * (auto-detected suggestions or manually added) that can be reviewed,
 * edited, removed, and re-scored. Industry position sits below.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  loadLatestAuditBundle,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';

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
  id: string;             // local-only id for keying
  domain: string;
  name: string;
  category: string;
  note: string;
  score: number | null;   // null = unscored (new manual entry)
  source: 'auto' | 'manual';
  pillarScores?: Array<{ name: string; score: number }>;
};

type BenchmarkPosition = {
  userScore?: number;
  deltaFromAvg?: number;
  benchmark?: { avgScore: number; sampleSize?: number };
  comparedAgainst?: string;
};

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
    name: c.name || c.domain,
    category: c.category || '',
    note: c.note || '',
    score: typeof c.score === 'number' ? c.score : null,
    source: (c.source === 'manual' ? 'manual' : 'auto'),
    pillarScores: c.pillarScores,
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

export default function IntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [drafts, setDrafts] = useState<DraftCompetitor[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<DraftCompetitor[]>([]);
  const [benchmarkPosition, setBenchmarkPosition] = useState<BenchmarkPosition | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user || !ready) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    loadLatestAuditBundle(user.id, selection)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, ready, selection]);

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setDrafts([]);
      setServerSnapshot([]);
      setBenchmarkPosition(null);
      setIndustry(null);
      return;
    }
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
    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
      })
      .catch(() => {});
  }, [bundle]);

  const productUrl = bundle?.audit?.product_url || '';

  const isDirty = useMemo(() => {
    if (drafts.length !== serverSnapshot.length) return true;
    const key = (c: DraftCompetitor) => `${c.domain}|${c.name}|${c.category}|${c.note}`;
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
    setDrafts(prev => [...prev, {
      id: makeDraftId(),
      domain: '',
      name: '',
      category: '',
      note: '',
      score: null,
      source: 'manual',
    }]);
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
      if (!dom) {
        return { ok: false, message: 'Every competitor needs a domain.' };
      }
      if (!DOMAIN_RE.test(dom)) {
        return { ok: false, message: `"${d.domain}" is not a valid domain (e.g. example.com).` };
      }
      if (seen.has(dom)) {
        return { ok: false, message: `"${dom}" is listed twice. Remove duplicates.` };
      }
      seen.add(dom);
      cleaned.push({ ...d, domain: dom, name: d.name.trim() || dom });
    }
    return { ok: true, cleaned };
  };

  const save = async () => {
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
            name: c.name,
            category: c.category,
            note: c.note,
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
            name: d.name,
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

  if (authLoading || loading || !ready) {
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
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            Intelligence
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection ? 'No audit for this brand yet.' : 'Pick a brand or run an audit to see how it benchmarks.'}
          </p>
        </div>
        <EmptyAudit
          title="No benchmarks yet"
          body="Run a Fixpath audit to compare your Brand Health Score against detected competitors and your industry."
        />
      </div>
    );
  }

  const isBrandAudit = (bundle.audit as any).audit_type === 'brand_identity' || selection?.kind === 'brand';
  const overallScore = bundle.report.overall_score ?? 0;
  const scoredDrafts = drafts.filter(d => typeof d.score === 'number' && d.score > 0);
  const avgCompetitor = scoredDrafts.length > 0
    ? Math.round(scoredDrafts.reduce((s, c) => s + (c.score || 0), 0) / scoredDrafts.length)
    : null;
  const delta = avgCompetitor != null ? overallScore - avgCompetitor : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Intelligence
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Benchmark Console — review and edit the competitors you compare against.
        </p>
      </div>

      {isBrandAudit ? (
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-start gap-3">
            <LineChart size={18} style={{ color: 'var(--m-muted)' }} className="mt-0.5" />
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                Benchmarks need a live site
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
                Brand-only audits don&apos;t have a public URL to compare. Run a site audit on the same brand to unlock competitor and industry benchmarks.
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
        </div>
      ) : (
        <>
          {/* Benchmark Console */}
          <section
            className="rounded-xl p-5 mb-4"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-start gap-2 min-w-0">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
                >
                  <LineChart size={14} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
                    Benchmark Console
                  </h2>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
                    Edit competitors anytime. Auto-detect only suggests — you stay in control.
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-1 flex-shrink-0">
                <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: scoreColorVar(overallScore) }}>
                  {overallScore}
                </span>
                <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>/100 you</span>
              </div>
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
                <Sparkles size={11} /> {drafts.length === 0 ? 'Auto-detect competitors' : 'Re-scan with auto-detect'}
              </button>
              {drafts.length > 0 && (
                <button
                  type="button"
                  onClick={rescanScores}
                  disabled={detecting || saving}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
                  style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
                  title="Re-score the current competitor list"
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
                  <button
                    type="button"
                    onClick={resetEdits}
                    disabled={saving || detecting}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    <X size={11} /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || detecting}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md text-white disabled:opacity-50"
                    style={{ background: 'var(--ink)' }}
                  >
                    <Save size={11} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>

            {error && (
              <div
                className="mb-3 p-2.5 rounded-md flex items-start gap-2 text-[12px]"
                style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }}
                role="alert"
              >
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {info && !error && (
              <div
                className="mb-3 p-2.5 rounded-md flex items-start gap-2 text-[12px]"
                style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink)' }}
              >
                <Info size={12} className="mt-0.5 flex-shrink-0" />
                <span>{info}</span>
              </div>
            )}

            {detecting && (
              <p className="text-[12px] mb-3" style={{ color: 'var(--m-muted)' }}>
                <Sparkles size={11} className="inline -mt-0.5 mr-1" /> Working… this may take a few seconds per competitor.
              </p>
            )}

            {drafts.length > 0 && delta != null && (
              <p className="text-[12px] mb-3" style={{ color: 'var(--ink)' }}>
                You score{' '}
                <span className="font-semibold" style={{ color: delta > 0 ? 'var(--ok)' : delta < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>{' '}
                vs. competitor average ({avgCompetitor}/100).
              </p>
            )}

            {/* Empty state */}
            {drafts.length === 0 && !detecting && (
              <div
                className="rounded-lg p-5 text-center"
                style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}
              >
                <LineChart size={20} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-2 opacity-50" />
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                  No competitors configured yet
                </p>
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
                    <li
                      key={c.id}
                      className="rounded-lg p-3"
                      style={{
                        background: 'color-mix(in srgb, var(--ink) 3%, transparent)',
                        border: '1px solid var(--rule)',
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-3">
                          <label className="block text-[10px] uppercase font-semibold tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                            Name
                          </label>
                          <input
                            type="text"
                            value={c.name}
                            placeholder="Display name"
                            onChange={(e) => updateRow(c.id, { name: e.target.value })}
                            className="w-full text-[12px] px-2 py-1.5 rounded-md outline-none"
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--rule)',
                              color: 'var(--ink)',
                            }}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[10px] uppercase font-semibold tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                            Domain
                          </label>
                          <input
                            type="text"
                            value={c.domain}
                            placeholder="example.com"
                            onChange={(e) => updateRow(c.id, { domain: e.target.value })}
                            className="w-full text-[12px] px-2 py-1.5 rounded-md outline-none"
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--rule)',
                              color: 'var(--ink)',
                            }}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] uppercase font-semibold tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                            Category
                          </label>
                          <input
                            type="text"
                            value={c.category}
                            placeholder="Optional"
                            onChange={(e) => updateRow(c.id, { category: e.target.value })}
                            className="w-full text-[12px] px-2 py-1.5 rounded-md outline-none"
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--rule)',
                              color: 'var(--ink)',
                            }}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[10px] uppercase font-semibold tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                            Note
                          </label>
                          <input
                            type="text"
                            value={c.note}
                            placeholder="Optional"
                            onChange={(e) => updateRow(c.id, { note: e.target.value })}
                            className="w-full text-[12px] px-2 py-1.5 rounded-md outline-none"
                            style={{
                              background: 'var(--card)',
                              border: '1px solid var(--rule)',
                              color: 'var(--ink)',
                            }}
                          />
                        </div>
                        <div className="md:col-span-1 flex md:justify-end items-end">
                          <button
                            type="button"
                            onClick={() => removeRow(c.id)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:opacity-80"
                            style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 8%, transparent)' }}
                            aria-label={`Remove ${c.domain}`}
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Score row */}
                      <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px dashed var(--rule)' }}>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full"
                          style={{
                            color: c.source === 'manual' ? 'var(--m-muted)' : 'var(--ink)',
                            background: 'color-mix(in srgb, var(--ink) 6%, transparent)',
                          }}
                        >
                          {c.source === 'manual' ? <><Pencil size={9} className="inline -mt-0.5 mr-1" />Manual</> : <><Sparkles size={9} className="inline -mt-0.5 mr-1" />Auto</>}
                        </span>
                        {score != null && score > 0 ? (
                          <>
                            <span
                              className="h-1.5 rounded-full overflow-hidden flex-shrink-0"
                              style={{ width: 120, background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                            >
                              <span
                                className="block h-full"
                                style={{ width: `${score}%`, background: scoreColorVar(score) }}
                              />
                            </span>
                            <span className="tabular-nums font-semibold text-[12px]" style={{ color: scoreColorVar(score) }}>
                              {score}/100
                            </span>
                            {cDelta != null && (
                              <span
                                className="tabular-nums text-[11px]"
                                style={{
                                  color: cDelta > 0 ? 'var(--ok)' : cDelta < 0 ? 'var(--severe)' : 'var(--m-muted)',
                                }}
                              >
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

          {/* Industry position */}
          {benchmarkPosition?.benchmark && (
            <section className="rounded-xl p-5 mb-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <h2 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                Industry position{industry ? ` — ${industry}` : ''}
              </h2>
              <p className="text-[12px]" style={{ color: 'var(--ink)' }}>
                You score{' '}
                <span className="font-semibold" style={{ color: scoreColorVar(benchmarkPosition.userScore ?? overallScore) }}>
                  {benchmarkPosition.userScore ?? overallScore}
                </span>{' '}
                vs. industry average{' '}
                <span className="font-semibold">{benchmarkPosition.benchmark.avgScore}</span>
                {benchmarkPosition.deltaFromAvg != null && (
                  <>
                    {' '}
                    (
                    <span style={{ color: benchmarkPosition.deltaFromAvg > 0 ? 'var(--ok)' : benchmarkPosition.deltaFromAvg < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                      {benchmarkPosition.deltaFromAvg > 0 ? '+' : ''}{benchmarkPosition.deltaFromAvg}
                    </span>
                    )
                  </>
                )}
                .
              </p>
              {benchmarkPosition.benchmark.sampleSize && (
                <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
                  Based on {benchmarkPosition.benchmark.sampleSize} audited sites{benchmarkPosition.comparedAgainst ? ` in ${benchmarkPosition.comparedAgainst}` : ''}.
                </p>
              )}
            </section>
          )}

          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
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
    </div>
  );
}
