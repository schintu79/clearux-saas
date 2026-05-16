'use client';

/**
 * Track — answers "Am I getting better?"
 *
 * Score-over-time, fixed vs. open counts, module deltas, audit timeline,
 * regression hint, and a re-audit CTA. Single-audit users see an explicit
 * "trend data appears after your next audit" empty state.
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
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  moduleScoresFromReport,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';

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
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    loadLatestAuditBundle(user.id)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  const sameDomain = useMemo(() => {
    if (!bundle?.audit) return [];
    const host = hostnameOf(bundle.audit.product_url);
    if (!host) return [];
    return bundle.history
      .filter((h) => hostnameOf(h.audit.product_url) === host)
      .reverse();
  }, [bundle]);

  if (authLoading || loading) {
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
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Track</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            Are you getting better? Run your first audit to start tracking.
          </p>
        </div>
        <EmptyAudit
          title="No audits to track yet"
          body="Run your first audit to establish a baseline. Fixpath will compare every future audit against it."
        />
      </div>
    );
  }

  const { audit, report, findings, prior } = bundle;
  const score = report?.overall_score ?? null;
  const priorScore = prior?.report?.overall_score ?? null;
  const delta = score != null && priorScore != null ? score - priorScore : null;
  const open = findings.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const fixed = findings.filter((f) => f.status === 'fixed').length;
  const backlog = findings.filter((f) => f.status === 'backlog').length;

  // For the latest audit we have findings in the bundle, so the module
  // strip uses the finding-derived estimator. The prior audit's findings
  // aren't in the bundle (would require a second query); the legacy
  // sub-score mapping is good enough for a delta comparison.
  const latestModules = moduleScoresFromReport(report, findings);
  const priorModules = moduleScoresFromReport(prior?.report || null);
  const moduleDeltas = latestModules.map((m, i) => ({
    name: m.name,
    score: m.score,
    delta: m.score != null && priorModules[i].score != null ? m.score - (priorModules[i].score as number) : null,
  }));

  const trendPoints = sameDomain
    .filter((h) => h.report?.overall_score != null)
    .map((h) => ({
      score: h.report!.overall_score as number,
      date: h.audit.completed_at || h.audit.created_at,
    }));

  const singleAudit = trendPoints.length < 2;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Track</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Are you getting better? Compare scores, fixed vs. open issues, and module shifts.
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
                Trend data appears after your next audit
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
                One audit so far. Run another to track movement on your score and module breakdown.
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
                {trendPoints.length} audits · oldest {new Date(trendPoints[0].date).toLocaleDateString()} · latest {new Date(trendPoints[trendPoints.length - 1].date).toLocaleDateString()}
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
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--severe)' }}>{open}</span>
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

      {/* Module deltas */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
          Module deltas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {moduleDeltas.map((m) => (
            <div
              key={m.name}
              className="rounded-lg px-3 py-3"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
            >
              <p className="text-[10px] font-semibold tracking-[0.04em] uppercase leading-tight" style={{ color: 'var(--m-muted)' }}>
                {m.name}
              </p>
              <p className="text-[18px] font-sans font-semibold tabular-nums mt-1" style={{ color: scoreColor(m.score) }}>
                {m.score ?? '—'}
              </p>
              <p className="text-[11px] mt-0.5 font-semibold" style={{ color: deltaTone(m.delta) }}>
                {m.delta == null ? '—' : `${m.delta > 0 ? '+' : ''}${m.delta} pts`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent audits timeline */}
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
        {sameDomain.length === 0 ? (
          <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>No audit history for this domain.</p>
        ) : (
          <ul className="space-y-2">
            {[...sameDomain].reverse().map((h, idx, arr) => {
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

      {fixed > 0 && (
        <div
          className="mt-6 rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 14%, transparent)' }}
        >
          <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} className="flex-shrink-0 mt-0.5" />
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>{fixed} finding{fixed === 1 ? '' : 's'} marked fixed.</span>{' '}
            Run a re-audit to verify in code and pick up any new regressions.
          </p>
        </div>
      )}
    </div>
  );
}
