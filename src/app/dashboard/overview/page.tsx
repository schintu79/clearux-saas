'use client';

/**
 * Overview — answers "What should I do next?"
 *
 * Shows the user's ClearUX score exactly ONCE, the top 3 issues, one
 * primary next action, module score strip, and last-audit metadata.
 * Empty state offers a URL input and "Run Audit" CTA.
 */

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  rankFindings,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  moduleScoresFromReport,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';

function scoreTone(s: number | null | undefined): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ScoreCard({
  score,
  delta,
  domain,
  completedAt,
}: {
  score: number | null;
  delta: number | null;
  domain: string | null;
  completedAt: string | null;
}) {
  const size = 110;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const val = score ?? 0;
  const offset = c - (Math.max(0, Math.min(100, val)) / 100) * c;
  const col = scoreTone(score);

  return (
    <div
      className="rounded-xl p-6 flex items-center gap-6"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      data-testid="overview-score"
    >
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
          {score != null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={col}
              strokeWidth={stroke}
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-sans font-semibold tabular-nums leading-none" style={{ fontSize: 32, color: col }}>
            {score ?? '—'}
          </span>
          <span className="text-[10px] tracking-[0.08em] uppercase mt-1.5" style={{ color: 'var(--m-muted)' }}>
            ClearUX score
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          Latest audit
        </p>
        <p className="text-[18px] font-sans font-semibold mt-1 truncate" style={{ color: 'var(--ink)' }}>
          {domain || 'Run an audit to begin'}
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {delta != null && (
            <span
              className="inline-flex items-center gap-1 text-[12px] font-semibold"
              style={{ color: delta > 0 ? 'var(--ok)' : delta < 0 ? 'var(--severe)' : 'var(--m-muted)' }}
            >
              {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {delta > 0 ? '+' : ''}
              {delta} pts vs. previous
            </span>
          )}
          {!delta && completedAt && (
            <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--m-muted)' }}>
              <Clock size={11} />
              First audit · {relativeDate(completedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleStrip({ scores }: { scores: Array<{ name: string; score: number | null }> }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      data-testid="overview-module-strip"
    >
      <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
        Module scores
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {scores.map((s) => (
          <div
            key={s.name}
            className="rounded-lg px-3 py-3"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
          >
            <p className="text-[10px] font-semibold tracking-[0.04em] uppercase leading-tight" style={{ color: 'var(--m-muted)' }}>
              {s.name}
            </p>
            <p className="text-[20px] font-sans font-semibold tabular-nums mt-1" style={{ color: scoreTone(s.score) }}>
              {s.score ?? '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditsBanner, setCreditsBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get('credits') !== 'purchased') return;
    setCreditsBanner(true);
    window.history.replaceState({}, '', '/dashboard/overview');
    const t = setTimeout(() => setCreditsBanner(false), 6000);
    fetch('/api/stripe/verify-credits', { method: 'POST' }).catch(() => {});
    return () => clearTimeout(t);
  }, [searchParams]);

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

  if (authLoading || loading) {
    return (
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-72 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          <div className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
        </div>
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            Overview
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            What should you do next? Run your first audit to find out.
          </p>
        </div>
        <EmptyAudit
          title="Run your first audit"
          body="Enter a website URL and we will show you your ClearUX score, the top issues hurting it, and a clear next action."
        />
      </div>
    );
  }

  const { audit, report, findings, prior } = bundle;
  let domain: string | null = null;
  try { domain = new URL(audit.product_url || '').hostname.replace(/^www\./, ''); } catch {}
  const score = report?.overall_score ?? null;
  const priorScore = prior?.report?.overall_score ?? null;
  const delta = score != null && priorScore != null ? score - priorScore : null;

  const openFindings = findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
  const top3 = rankFindings(openFindings).slice(0, 3);
  const modules = moduleScoresFromReport(report);

  // Next-best-action: the single highest-priority finding, or re-audit when all open are fixed.
  const next = top3[0] || null;

  return (
    <div>
      {creditsBanner && (
        <div role="status" aria-live="polite" className="mb-5 px-4 py-3 rounded-lg flex items-center gap-3" style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 14%, transparent)' }}>
          <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
          <p className="text-[13px]" style={{ color: 'var(--ink)' }}>Credits added to your account.</p>
          <button onClick={() => setCreditsBanner(false)} className="ml-auto p-1 rounded-md hover:bg-black/5" style={{ color: 'var(--m-muted)' }} aria-label="Dismiss">
            <X size={12} />
          </button>
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Overview
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What you should do next, in order of impact.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
        <ScoreCard
          score={score}
          delta={delta}
          domain={domain}
          completedAt={audit.completed_at}
        />
        <div
          className="rounded-xl p-5 flex flex-col justify-between gap-3"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="overview-next-action"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
              Next action
            </p>
            {next ? (
              <>
                <p className="text-[14px] font-sans font-semibold mt-1.5 leading-snug" style={{ color: 'var(--ink)' }}>
                  Fix this: {next.title}
                </p>
                <p className="text-[12px] mt-1.5 leading-relaxed line-clamp-3" style={{ color: 'var(--m-muted)' }}>
                  {next.description}
                </p>
              </>
            ) : (
              <>
                <p className="text-[14px] font-sans font-semibold mt-1.5" style={{ color: 'var(--ink)' }}>
                  Re-audit to verify your fixes
                </p>
                <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  All findings are closed. Run a re-audit to confirm and track delta.
                </p>
              </>
            )}
          </div>
          <Link
            href={next ? '/dashboard/fix' : '/dashboard/new-audit'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 self-start"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            {next ? 'Fix this' : 'Run re-audit'}
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Top 3 issues */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
            Top 3 issues hurting your score
          </p>
          <Link href="/dashboard/find" className="text-[12px] font-medium" style={{ color: 'var(--signal)' }}>
            See all findings →
          </Link>
        </div>
        {top3.length === 0 ? (
          <div
            className="rounded-xl p-5 text-[13px]"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
            data-testid="overview-top3-empty"
          >
            No open findings — every issue is fixed or dismissed. Run a re-audit to confirm.
          </div>
        ) : (
          <ul className="space-y-2" data-testid="overview-top3">
            {top3.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/dashboard/fix#finding-${f.id}`}
                  className="rounded-xl p-4 flex items-start gap-3 transition-all hover:shadow-sm group"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: severityColor(f.severity) }}
                    aria-hidden
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                      {f.title}
                    </span>
                    <span className="block text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
                      {severityLabel(f.severity)} · {moduleNameForFinding(f)}
                      {f.page_url ? ` · ${f.page_url}` : ''}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[12px] font-medium opacity-70 group-hover:opacity-100"
                    style={{ color: 'var(--signal)' }}
                  >
                    Fix
                    <ArrowRight size={11} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModuleStrip scores={modules} />

      <div className="mt-6 rounded-xl p-4 flex items-start gap-3" style={{ background: 'color-mix(in srgb, var(--signal) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 12%, transparent)' }}>
        <RefreshCw size={15} style={{ color: 'var(--signal)' }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
            Re-audit to track your progress
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            ClearUX scores the delta between audits and surfaces regressions.
          </p>
        </div>
        <Link href="/dashboard/new-audit" className="text-[12px] font-medium whitespace-nowrap" style={{ color: 'var(--signal)' }}>
          Run re-audit →
        </Link>
      </div>

      <p className="text-[11px] mt-4" style={{ color: 'var(--m-muted)' }}>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle size={10} />
          Last audit completed {relativeDate(audit.completed_at)}.
        </span>
      </p>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-72 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <div className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          <div className="h-[160px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
        </div>
      </div>
    }>
      <OverviewInner />
    </Suspense>
  );
}
