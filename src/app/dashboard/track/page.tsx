'use client';

/**
 * Track — selected brand only. Score trend, fixed vs. open counts,
 * recent audits. No portfolio/global data.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
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
  ChevronDown,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { computeAuditDiff } from '@/lib/audit-engine/audit-diff';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import DashCard from '@/components/dashboard/v2/DashCard';
import SectionHeader from '@/components/dashboard/v2/SectionHeader';
import ActionLink from '@/components/dashboard/v2/ActionLink';
import { scoreColor, hostOf } from '@/components/dashboard/v2/score-utils';

function deltaTone(d: number | null): string {
  if (d == null || d === 0) return 'var(--m-muted)';
  return d > 0 ? 'var(--ok)' : 'var(--severe)';
}

function ScoreLine({ points }: { points: Array<{ score: number; date: string }> }) {
  if (points.length < 2) return null;

  const W = 420, H = 140, PAD_L = 28, PAD_R = 14, PAD_T = 18, PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const minScore = Math.max(0, Math.min(...points.map(p => p.score)) - 10);
  const maxScore = Math.min(100, Math.max(...points.map(p => p.score)) + 10);
  const range = maxScore - minScore || 1;

  const coords = points.map((p, i) => ({
    x: PAD_L + (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW),
    y: PAD_T + chartH - ((p.score - minScore) / range) * chartH,
    score: p.score,
    date: p.date,
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} ${PAD_T + chartH} L ${coords[0].x.toFixed(1)} ${PAD_T + chartH} Z`;

  const gridLines = 4;
  const gridScores = Array.from({ length: gridLines + 1 }, (_, i) => Math.round(minScore + (range * i) / gridLines));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Score trend">
      {/* Grid */}
      {gridScores.map((s, i) => {
        const y = PAD_T + chartH - ((s - minScore) / range) * chartH;
        return (
          <g key={i}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
            <text x={PAD_L - 5} y={y + 2.5} textAnchor="end" fontSize="6" fill="var(--muted)" fontFamily="var(--font-inter)">{s}</text>
          </g>
        );
      })}

      {/* Area fill */}
      <defs>
        <linearGradient id="trackScoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#trackScoreAreaGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="var(--signal)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points + last-point score badge */}
      {coords.map((c, i) => {
        const isLast = i === coords.length - 1;
        return (
          <g key={i}>
            <circle cx={c.x} cy={c.y} r={2} fill="var(--paper)" stroke="var(--signal)" strokeWidth="1" />
            {isLast && (
              <g>
                <rect x={c.x - 11} y={c.y - 16} width="22" height="12" rx="3" fill="var(--signal)" />
                <text x={c.x} y={c.y - 8} textAnchor="middle" fontSize="7" fontWeight="600" fill="white" fontFamily="var(--font-inter)">{c.score}</text>
              </g>
            )}
          </g>
        );
      })}

      {/* X-axis date labels */}
      {coords.map((c, i) => {
        if (points.length > 6 && i !== 0 && i !== points.length - 1 && i !== Math.floor(points.length / 2)) return null;
        const d = new Date(c.date);
        const label = `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
        return (
          <text key={i} x={c.x} y={H - 4} textAnchor="middle" fontSize="6" fill="var(--muted)" fontFamily="var(--font-inter)">{label}</text>
        );
      })}
    </svg>
  );
}

/* ── Per-metric trend cards (Phase 2 #4) ─────────────────────────
 * Read-only sparklines over the audit history already persisted. Each card
 * shows the latest value, the delta vs the previous audit (coloured by
 * whether that direction is good for the metric), and a sparkline. */
function MetricSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 140, H = 34, P = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const pts = values.map((v, i) => {
    const x = P + (i / (values.length - 1)) * (W - 2 * P);
    const y = H - P - ((v - min) / range) * (H - 2 * P);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 34 }} preserveAspectRatio="none">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {(() => { const [lx, ly] = pts[pts.length - 1].split(','); return <circle cx={lx} cy={ly} r="2" fill={color} />; })()}
    </svg>
  );
}

interface MetricSeriesPoint { value: number; date: string }
function MetricTrendCard({ label, series, suffix, higherBetter }: { label: string; series: MetricSeriesPoint[]; suffix: string; higherBetter: boolean }) {
  if (series.length === 0) return null;
  const current = series[series.length - 1].value;
  const prev = series.length >= 2 ? series[series.length - 2].value : null;
  const rawDelta = prev != null ? current - prev : null;
  const improved = rawDelta == null || rawDelta === 0 ? null : higherBetter ? rawDelta > 0 : rawDelta < 0;
  const deltaColor = improved == null ? 'var(--m-muted)' : improved ? 'var(--ok)' : 'var(--severe)';
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>{label}</span>
        {rawDelta != null && rawDelta !== 0 && (
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: deltaColor }}>
            {improved ? '▲' : '▼'} {Math.abs(rawDelta)}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: 'var(--ink)' }}>{current}</span>
        {suffix && <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{suffix}</span>}
      </div>
      {series.length >= 2
        ? <MetricSparkline values={series.map((s) => s.value)} color="var(--signal)" />
        : <p className="text-[10px]" style={{ color: 'var(--m-muted)' }}>Trend appears after your next audit</p>}
    </div>
  );
}

const moduleNames = ['Foundation', 'Human experience', 'Inclusive design', 'Future readiness', 'SEO structure', 'Accessibility readiness', 'Design consistency'];

function getModuleScores(report: any): Record<string, number> {
  const scores: Record<string, number> = {};
  const cats = report?.raw_json?.categoryScores as Array<{ name: string; score: number }> | undefined;
  if (!cats) return scores;
  for (let m = 0; m < moduleNames.length; m++) {
    const moduleCats = cats.slice(m * 4, m * 4 + 4).filter((c: { score: number }) => c.score >= 0);
    if (moduleCats.length > 0) {
      scores[moduleNames[m]] = Math.round(moduleCats.reduce((s: number, c: { score: number }) => s + c.score, 0) / moduleCats.length);
    }
  }
  return scores;
}

export default function TrackPage() {
  const { user, loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || wsLoading || bundleLoading || !bundle;
  const [priorFindings, setPriorFindings] = useState<import('@/types/database').AuditFinding[]>([]);

  // ── Monitoring schedule (Phase 2 #1) ──
  const monitorUrl = bundle?.audit?.product_url ?? null;
  const [monitorCadence, setMonitorCadence] = useState<'off' | 'weekly' | 'monthly'>('off');
  const [monitorNextRun, setMonitorNextRun] = useState<string | null>(null);
  const [monitorSaving, setMonitorSaving] = useState(false);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  // Until the saved schedule is fetched, we don't know the real cadence — gate
  // the control on this so it never flashes "Off" before showing the truth.
  const [monitorLoaded, setMonitorLoaded] = useState(false);
  // Explanation is collapsed by default — heading + status + control stay visible.
  const [monitorExpanded, setMonitorExpanded] = useState(false);

  useEffect(() => {
    if (!monitorUrl || !workspace?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/scheduled-audits?workspace_id=${workspace.id}`);
        if (!res.ok) return;
        const d = await res.json();
        const norm = (u: string) => (u || '').replace(/\/+$/, '');
        const match = (d.schedules || []).find((s: any) => s.is_active && norm(s.product_url) === norm(monitorUrl));
        if (cancelled) return;
        if (match) { setMonitorCadence(match.frequency === 'weekly' ? 'weekly' : 'monthly'); setMonitorNextRun(match.next_run_at); }
        else { setMonitorCadence('off'); setMonitorNextRun(null); }
      } catch { /* leave default off */ }
      finally { if (!cancelled) setMonitorLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [monitorUrl, workspace?.id]);

  const setCadence = async (cad: 'off' | 'weekly' | 'monthly') => {
    if (!monitorUrl || monitorSaving || cad === monitorCadence) return;
    const prev = monitorCadence;
    setMonitorSaving(true); setMonitorError(null); setMonitorCadence(cad);
    try {
      const res = await fetch('/api/scheduled-audits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_url: monitorUrl,
          workspace_id: workspace?.id || null,
          enabled: cad !== 'off',
          frequency: cad === 'off' ? undefined : cad,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setMonitorCadence(prev); setMonitorError(d.error || 'Could not update monitoring'); return; }
      setMonitorNextRun(d.schedule?.next_run_at ?? null);
    } catch {
      setMonitorCadence(prev); setMonitorError('Could not update monitoring');
    } finally {
      setMonitorSaving(false);
    }
  };

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
    if (workspace) return [...bundle.history].reverse();
    const host = hostOf(bundle.audit.product_url);
    if (!host) return [];
    return bundle.history
      .filter((h) => hostOf(h.audit.product_url) === host)
      .reverse();
  }, [bundle, workspace]);

  // All hooks must be above early returns to avoid #310 ("Rendered more hooks than during the previous render")
  const report = bundle?.report ?? null;
  const auditFindings = bundle?.findings ?? [];
  const prior = bundle?.prior ?? null;

  const diff = useMemo(() => {
    if (!prior?.report || !report || priorFindings.length === 0) return null;
    return computeAuditDiff(report, prior.report, auditFindings, priorFindings);
  }, [report, prior, auditFindings, priorFindings]);

  const validatedFixes = useMemo(() => diff?.findings.filter((f) => f.diffStatus === 'fixed') || [], [diff]);
  const failedFixes = useMemo(
    () => diff?.findings.filter((f) => f.diffStatus === 'regressed' || f.diffStatus === 'persisted') || [],
    [diff],
  );

  const trendPoints = useMemo(() => scopedHistory
    .filter((h) => h.report?.overall_score != null)
    .map((h) => ({
      score: h.report!.overall_score as number,
      date: h.audit.completed_at || h.audit.created_at,
    })), [scopedHistory]);

  const topModuleDeltas = useMemo(() => {
    if (scopedHistory.length < 2) return [];
    const latest = scopedHistory[scopedHistory.length - 1];
    const previous = scopedHistory[scopedHistory.length - 2];
    const latestScores = getModuleScores(latest.report);
    const prevScores = getModuleScores(previous.report);
    const deltas: Array<{ name: string; delta: number }> = [];
    for (const mod of moduleNames) {
      if (latestScores[mod] != null && prevScores[mod] != null) {
        deltas.push({ name: mod, delta: latestScores[mod] - prevScores[mod] });
      }
    }
    deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return deltas.filter(d => d.delta !== 0).slice(0, 3);
  }, [scopedHistory]);

  // Per-metric trends over the persisted history (Phase 2 #4).
  const metricTrends = useMemo(() => {
    const build = (get: (h: { audit: any; report: any }) => number | null): MetricSeriesPoint[] =>
      scopedHistory
        .map((h) => ({ value: get(h), date: h.audit.completed_at || h.audit.created_at }))
        .filter((p): p is MetricSeriesPoint => typeof p.value === 'number');
    const defs = [
      { label: 'Health score', suffix: '/100', higherBetter: true, series: build((h) => h.report?.overall_score ?? null) },
      { label: 'AI visibility', suffix: '/100', higherBetter: true, series: build((h) => h.report?.raw_json?.aiVisibilityBreakdown?.overall ?? h.report?.ai_visibility_breakdown?.overall ?? h.report?.ai_discoverability_score ?? null) },
      { label: 'Open issues', suffix: '', higherBetter: false, series: build((h) => h.report?.total_issues ?? null) },
      { label: 'Brand consistency', suffix: '/100', higherBetter: true, series: build((h) => h.report?.raw_json?.brandConsistency?.score ?? null) },
      { label: 'Performance (mobile)', suffix: '/100', higherBetter: true, series: build((h) => h.audit?.speed_data?.mobile?.score ?? null) },
    ];
    return defs.filter((d) => d.series.length > 0);
  }, [scopedHistory]);

  if (loading) {
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
        <PageHeader icon={<TrendingUp size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />} title="Track" subtitle={workspace ? 'No audit for this brand yet.' : 'Run your first audit to start tracking progress.'} />
        <EmptyAudit
          title="No audits to track yet"
          body="Run your first audit to set a baseline. Re-audit after fixing issues to see what improved and confirm fixes landed."
        />
      </div>
    );
  }

  const { findings } = bundle;
  const score = report?.overall_score ?? null;
  const priorScore = prior?.report?.overall_score ?? null;
  const delta = score != null && priorScore != null ? score - priorScore : null;
  const open = findings.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const fixed = findings.filter((f) => f.status === 'fixed').length;
  const backlog = findings.filter((f) => f.status === 'backlog').length;

  const persistedOnly = failedFixes.filter((f) => f.diffStatus === 'persisted' && f.previous?.status === 'fixed');
  const regressed = failedFixes.filter((f) => f.diffStatus === 'regressed');

  const singleAudit = trendPoints.length < 2;

  return (
    <div>
      <OverviewBreadcrumb current="Track" />
      <PageHeader icon={<TrendingUp size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />} title="Track" subtitle="Website Health Score and issue trend for this brand. Re-audit to confirm fixes landed." />

      {/* Monitoring — user-chosen cadence for automatic re-audits (Phase 2 #1) */}
      <DashCard padding="lg" className="mb-6">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            {/* Heading row — click to expand the explanation */}
            <button
              type="button"
              onClick={() => setMonitorExpanded((v) => !v)}
              aria-expanded={monitorExpanded}
              className="flex items-center gap-2 text-left"
            >
              <RefreshCw size={14} style={{ color: 'var(--ink)' }} />
              <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Automatic monitoring</span>
              {monitorLoaded && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded"
                  style={monitorCadence !== 'off'
                    ? { background: 'color-mix(in srgb, var(--ok) 14%, transparent)', color: 'var(--ok)' }
                    : { background: 'color-mix(in srgb, var(--ink) 7%, transparent)', color: 'var(--m-muted)' }}>
                  {monitorCadence !== 'off' ? 'On' : 'Off'}
                </span>
              )}
              <ChevronDown size={14} style={{ color: 'var(--m-muted)' }}
                className={`transition-transform ${monitorExpanded ? 'rotate-180' : ''}`} />
            </button>
            {/* Live status — always visible; never a guessed state before load */}
            <p className="text-[12px] mt-1.5 font-medium" style={{ color: monitorLoaded && monitorCadence !== 'off' ? 'var(--ink)' : 'var(--m-muted)' }}>
              {!monitorLoaded
                ? 'Checking your schedule…'
                : monitorCadence === 'off'
                  ? 'Off — pick Weekly or Monthly to start tracking automatically.'
                  : monitorNextRun
                    ? `Next automatic re-audit: ${new Date(monitorNextRun).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · then every ${monitorCadence === 'weekly' ? 'week' : 'month'}.`
                    : `Running ${monitorCadence === 'weekly' ? 'weekly' : 'monthly'}.`}
              {monitorError ? <span style={{ color: 'var(--severe)' }}> · {monitorError}</span> : null}
            </p>
            {/* Expandable explanation */}
            {monitorExpanded && (
              <p className="text-[12.5px] mt-2 leading-[1.55] max-w-[620px]" style={{ color: 'var(--m-muted)' }}>
                We re-audit this brand on the schedule you choose and add each result to your trend — so a score drop or a
                new critical issue shows up here on its own, between your manual audits. Included in your plan; it never uses audit credits.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {!monitorLoaded ? (
              // Skeleton while the saved cadence loads — prevents the "Off" flash.
              <div className="h-[34px] w-[186px] rounded-lg" aria-hidden="true"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', opacity: 0.6 }} />
            ) : (
              <div role="group" aria-label="How often to re-audit this brand"
                className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)', opacity: monitorSaving ? 0.6 : 1 }}>
                {(['off', 'weekly', 'monthly'] as const).map((opt, i) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCadence(opt)}
                    disabled={monitorSaving}
                    aria-pressed={monitorCadence === opt}
                    className="px-3.5 py-1.5 text-[12px] font-medium transition-colors"
                    style={{
                      background: monitorCadence === opt ? 'var(--ink)' : 'transparent',
                      color: monitorCadence === opt ? 'var(--paper)' : 'var(--m-muted)',
                      borderLeft: i === 0 ? undefined : '1px solid var(--rule)',
                    }}
                  >
                    {opt === 'off' ? 'Off' : opt === 'weekly' ? 'Weekly' : 'Monthly'}
                  </button>
                ))}
              </div>
            )}
            <span className="text-[10.5px]" style={{ color: 'var(--m-muted)' }}>
              {monitorSaving ? 'Saving…' : 'Re-audit frequency'}
            </span>
          </div>
        </div>
      </DashCard>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
        <DashCard padding="lg">
          <SectionHeader title="Score over time">
            {delta != null && (
              <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: deltaTone(delta) }}>
                {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                {delta > 0 ? '+' : ''}{delta} pts vs. previous
              </span>
            )}
          </SectionHeader>
          {singleAudit ? (
            <div className="py-8 text-center">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                Trend appears after your next audit
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
                One audit so far. Run another to track movement.
              </p>
              <ActionLink href={`${dashPrefix}/new-audit`} icon={RefreshCw} className="mt-4">
                Run re-audit
              </ActionLink>
            </div>
          ) : (
            <>
              <ScoreLine points={trendPoints} />
              <p className="text-[11px] mt-2" style={{ color: 'var(--m-muted)' }}>
                {trendPoints.length} audits · {new Date(trendPoints[0].date).toLocaleDateString()} → {new Date(trendPoints[trendPoints.length - 1].date).toLocaleDateString()}
              </p>
              {topModuleDeltas.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {topModuleDeltas.map(({ name, delta }) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium"
                      style={{
                        background: 'color-mix(in srgb, var(--signal) 8%, transparent)',
                        color: delta >= 0 ? 'var(--ok)' : 'var(--severe)',
                      }}
                    >
                      {name} {delta >= 0 ? '+' : ''}{delta}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </DashCard>

        <DashCard padding="lg" className="flex flex-col gap-3">
          <SectionHeader title="Issues" />
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
          <ActionLink href={`${dashPrefix}/fix`} icon={ArrowRight}>
            Open Fix queue
          </ActionLink>
        </DashCard>
      </div>

      {/* Metric trends — per-metric movement over the audit history (Phase 2 #4) */}
      {metricTrends.length > 0 && (
        <div className="mb-6">
          <SectionHeader title="Metric trends" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-1">
            {metricTrends.map((m) => (
              <MetricTrendCard key={m.label} label={m.label} series={m.series} suffix={m.suffix} higherBetter={m.higherBetter} />
            ))}
          </div>
        </div>
      )}

      {/* Fix validation — proof of improvement on re-audit */}
      {diff && (validatedFixes.length > 0 || persistedOnly.length > 0 || regressed.length > 0) && (
        <DashCard padding="lg" className="mb-6">
          <SectionHeader title="Fix validation" />
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
                        href={`${dashPrefix}/fix?finding=${f.id}`}
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
        </DashCard>
      )}

      {/* Recent audits */}
      <DashCard padding="lg">
        <SectionHeader title="Recent audits">
          <ActionLink href={`${dashPrefix}/new-audit`} icon={RefreshCw}>
            Run re-audit
          </ActionLink>
        </SectionHeader>
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
                    href={`${dashPrefix}/audits/${h.audit.id}`}
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
      </DashCard>
    </div>
  );
}
