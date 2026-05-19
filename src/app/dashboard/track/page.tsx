'use client';

/**
 * Track — selected brand only. Score trend, fixed vs. open counts,
 * recent audits. No portfolio/global data.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import { computeAuditDiff, type FindingDiffItem } from '@/lib/audit-engine/audit-diff';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function deltaTone(d: number | null): string {
  if (d == null || d === 0) return 'var(--m-muted)';
  return d > 0 ? 'var(--ok)' : 'var(--severe)';
}

function ScoreLine({ points }: { points: Array<{ score: number; date: string }> }) {
  if (points.length < 2) return null;
  const w = 600;
  const h = 120;
  const max = Math.max(100, ...points.map((p) => p.score));
  const min = Math.min(0, ...points.map((p) => p.score));
  const range = Math.max(1, max - min);
  const stepX = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p.score - min) / range) * h;
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 12}`} width="100%" height={h + 12} role="img" aria-label="Score trend">
      <path d={path} fill="none" stroke="var(--signal)" strokeWidth={2} />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="var(--signal)" />
      ))}
    </svg>
  );
}

export default function TrackPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [priorFindings, setPriorFindings] = useState<import('@/types/database').AuditFinding[]>([]);

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

  // Fetch prior audit findings for diff validation
  useEffect(() => {
    if (!bundle?.prior?.audit?.id) { setPriorFindings([]); return; }
    const priorAuditId = bundle.prior.audit.id;
    const supabase = createBrowserSupabase();
    (async () => {
      try {
        const { data } = await supabase
          .from('audit_findings')
          .select('*')
          .eq('audit_id', priorAuditId);
        setPriorFindings(data || []);
      } catch {
        setPriorFindings([]);
      }
    })();
  }, [bundle?.prior?.audit?.id]);

  // History returned by loadLatestAuditBundle is already scoped to the
  // selected brand/site (server-side for brand, client-side filter for
  // site). For backwards-compat when no selection is set, fall back to
  // same-domain matching.
  const scopedHistory = useMemo(() => {
    if (!bundle?.audit) return [];
    if (selection) return [...bundle.history].reverse();
    const host = hostnameOf(bundle.audit.product_url);
    if (!host) return [];
    return bundle.history
      .filter((h) => hostnameOf(h.audit.product_url) === host)
      .reverse();
  }, [bundle, selection]);

  if (authLoading || loading || !ready) {
    return (
      <div>
        <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="h-[200px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
        <OverviewBreadcrumb current="Track" />
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Track</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection ? 'No audit for this brand yet.' : 'Run your first audit to start tracking.'}
          </p>
        </div>
        <EmptyAudit
          title="No audits to track yet"
          body="Run your first audit to establish a baseline. Fixpath will compare every future audit against it."
        />
      </div>
    );
  }

  const { report, findings, prior } = bundle;
  const score = report?.overall_score ?? null;
  const priorScore = prior?.report?.overall_score ?? null;
  const delta = score != null && priorScore != null ? score - priorScore : null;
  const open = findings.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const fixed = findings.filter((f) => f.status === 'fixed').length;
  const backlog = findings.filter((f) => f.status === 'backlog').length;

  // Fix validation — compare current findings vs prior to show proof of improvement
  const diff = useMemo(() => {
    if (!prior?.report || !report || priorFindings.length === 0) return null;
    return computeAuditDiff(report, prior.report, findings, priorFindings);
  }, [report, prior, findings, priorFindings]);

  const validatedFixes = useMemo(() => diff?.findings.filter((f) => f.diffStatus === 'fixed') || [], [diff]);
  const failedFixes = useMemo(
    () => diff?.findings.filter((f) => f.diffStatus === 'regressed' || f.diffStatus === 'persisted') || [],
    [diff],
  );
  const persistedOnly = failedFixes.filter((f) => f.diffStatus === 'persisted' && f.previous?.status === 'fixed');
  const regressed = failedFixes.filter((f) => f.diffStatus === 'regressed');

  const trendPoints = scopedHistory
    .filter((h) => h.report?.overall_score != null)
    .map((h) => ({
      score: h.report!.overall_score as number,
      date: h.audit.completed_at || h.audit.created_at,
    }));

  const singleAudit = trendPoints.length < 2;

  return (
    <div>
      <OverviewBreadcrumb current="Track" />
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Track</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Brand Health Score and issue trend for this brand. Re-audit to confirm fixes landed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
              Score over time
            </p>
            {delta != null && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: deltaTone(delta) }}>
                {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                {delta > 0 ? '+' : ''}{delta} pts vs. previous
              </span>
            )}
          </div>
          {singleAudit ? (
            <div className="py-8 text-center">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                Trend appears after your next audit
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
                One audit so far. Run another to track movement.
              </p>
              <Link
                href="/dashboard/new-audit"
                className="inline-flex items-center gap-1.5 mt-4 px-3 py-2 rounded-lg text-[12px] font-semibold"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Run re-audit
                <RefreshCw size={11} />
              </Link>
            </div>
          ) : (
            <>
              <ScoreLine points={trendPoints} />
              <p className="text-[11px] mt-2" style={{ color: 'var(--m-muted)' }}>
                {trendPoints.length} audits · {new Date(trendPoints[0].date).toLocaleDateString()} → {new Date(trendPoints[trendPoints.length - 1].date).toLocaleDateString()}
              </p>
            </>
          )}
        </div>

        <div
          className="rounded-xl p-5 flex flex-col gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
            Issues
          </p>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Open</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: open > 0 ? 'var(--severe)' : 'var(--ok)' }}>{open}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Fixed</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--ok)' }}>{fixed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Backlog</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--signal)' }}>{backlog}</span>
            </div>
          </div>
          <Link
            href="/dashboard/fix"
            className="inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: 'var(--signal)' }}
          >
            Open Fix queue
            <ArrowRight size={11} />
          </Link>
        </div>
      </div>

      {/* Fix validation — proof of improvement on re-audit */}
      {diff && (validatedFixes.length > 0 || persistedOnly.length > 0 || regressed.length > 0) && (
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
            Fix validation
          </p>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            Compared against the previous audit to verify which fixes landed.
          </p>

          {/* Validated — fixes that resolved */}
          {validatedFixes.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <CheckCircle2 size={13} style={{ color: 'var(--ok)' }} />
                <span className="text-[12px] font-semibold" style={{ color: 'var(--ok)' }}>
                  {validatedFixes.length} fix{validatedFixes.length !== 1 ? 'es' : ''} validated
                </span>
              </div>
              <ul className="space-y-1">
                {validatedFixes.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px]"
                    style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)' }}
                  >
                    <CheckCircle2 size={11} style={{ color: 'var(--ok)' }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--ink)' }}>
                      {item.previous?.title || 'Resolved issue'}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--ok)' }}>Resolved</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Failed — fixes that didn't hold up or regressed */}
          {(persistedOnly.length > 0 || regressed.length > 0) && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle size={13} style={{ color: 'var(--warn)' }} />
                <span className="text-[12px] font-semibold" style={{ color: 'var(--warn)' }}>
                  {persistedOnly.length + regressed.length} fix{persistedOnly.length + regressed.length !== 1 ? 'es' : ''} need attention
                </span>
              </div>
              <ul className="space-y-1">
                {[...regressed, ...persistedOnly].map((item, i) => {
                  const f = item.current || item.previous;
                  if (!f) return null;
                  const isRegressed = item.diffStatus === 'regressed';
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px]"
                      style={{ background: 'color-mix(in srgb, var(--warn) 6%, transparent)' }}
                    >
                      <AlertTriangle size={11} style={{ color: 'var(--warn)' }} />
                      <span className="flex-1 truncate" style={{ color: 'var(--ink)' }}>
                        {f.title}
                      </span>
                      <span
                        className="text-[10px] font-medium uppercase"
                        style={{ color: isRegressed ? 'var(--severe)' : 'var(--warn)' }}
                      >
                        {isRegressed ? 'Regressed' : 'Not resolved'}
                      </span>
                      <Link
                        href={`/dashboard/fix?finding=${f.id}`}
                        className="inline-flex items-center gap-1 text-[10px] font-medium flex-shrink-0"
                        style={{ color: 'var(--signal)' }}
                      >
                        Fix <ExternalLink size={9} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recent audits */}
      <div
        className="rounded-xl p-5"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
            Recent audits
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: 'var(--signal)' }}
          >
            Run re-audit
            <RefreshCw size={11} />
          </Link>
        </div>
        {scopedHistory.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>No audit history yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...scopedHistory].reverse().map((h, idx, arr) => {
              const sc = h.report?.overall_score ?? null;
              const prev = arr[idx + 1]?.report?.overall_score ?? null;
              const d = sc != null && prev != null ? sc - prev : null;
              return (
                <li
                  key={h.audit.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
                >
                  <Clock size={12} style={{ color: 'var(--m-muted)' }} />
                  <span className="text-[12px] flex-1" style={{ color: 'var(--ink-2)' }}>
                    {h.audit.completed_at ? new Date(h.audit.completed_at).toLocaleDateString() : 'Pending'}
                  </span>
                  <span className="text-[13px] font-semibold tabular-nums" style={{ color: scoreColor(sc) }}>
                    {sc ?? '—'}
                  </span>
                  {d != null && d !== 0 && (
                    <span className="text-[11px] font-semibold" style={{ color: deltaTone(d) }}>
                      {d > 0 ? '+' : ''}{d}
                    </span>
                  )}
                  <Link
                    href={`/dashboard/audits/${h.audit.id}`}
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--signal)' }}
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
