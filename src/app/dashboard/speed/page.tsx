'use client';

/**
 * Website Speed — Core Web Vitals and performance diagnostics.
 *
 * Surfaces:
 *  1) Performance scores for mobile and desktop (PageSpeed Insights).
 *  2) Six Core Web Vitals with thresholds and status colors.
 *  3) Actionable speed findings grouped by fixable vs advisory.
 *  4) On-demand re-test and link to Google PageSpeed Insights.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  Zap,
  Move,
  MousePointerClick,
  Clock,
  BarChart3,
  Timer,
  Info,
  AlertTriangle,
  ChevronDown,
  ArrowUpRight,
  CheckCircle2,
  Wrench,
  Lightbulb,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import ScoreCircle from '@/components/ui/ScoreCircle';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import type { SpeedDataSummary, SpeedStrategyResult, SpeedMetric } from '@/types/database';

/* ── Types ─────────────────────────────────────────── */

type SpeedFinding = {
  id: string;
  title: string;
  severity: string;
  description: string;
  recommendation?: string;
  detection_source?: string;
  performance_metric_type?: string;
  owner_team?: string;
  finding_type?: string;
  fix_status?: string;
};

/* ── Helpers ────────────────────────────────────────── */

function statusColor(status: SpeedMetric['status']): string {
  if (status === 'good') return 'var(--ok)';
  if (status === 'needs_improvement') return 'var(--warn)';
  return 'var(--severe)';
}

function statusLabel(status: SpeedMetric['status']): string {
  if (status === 'good') return 'Good';
  if (status === 'needs_improvement') return 'Needs work';
  return 'Poor';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Fast';
  if (score >= 50) return 'Moderate';
  return 'Slow';
}

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--ok)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--severe)';
}

function severityColor(s: string): string {
  if (s === 'critical') return 'var(--severe)';
  if (s === 'major') return 'var(--warn)';
  return 'var(--m-muted)';
}

function severityLabel(s: string): string {
  if (s === 'critical') return 'Critical';
  if (s === 'major') return 'Major';
  if (s === 'minor') return 'Minor';
  return 'Info';
}

const METRIC_CONFIG: Array<{
  key: 'lcp' | 'cls' | 'inp' | 'ttfb' | 'speedIndex' | 'tbt';
  label: string;
  fullLabel: string;
  description: string;
  Icon: any;
  goodThreshold: string;
  poorThreshold: string;
  unit: string;
}> = [
  { key: 'lcp', label: 'LCP', fullLabel: 'Largest Contentful Paint', description: 'How long the largest visible element takes to render. This is the primary loading metric users notice.', Icon: Zap, goodThreshold: '< 2.5s', poorThreshold: '> 4.0s', unit: 'seconds' },
  { key: 'cls', label: 'CLS', fullLabel: 'Cumulative Layout Shift', description: 'How much the page layout shifts unexpectedly while loading. High values mean elements jump around.', Icon: Move, goodThreshold: '< 0.1', poorThreshold: '> 0.25', unit: 'score' },
  { key: 'inp', label: 'INP', fullLabel: 'Interaction to Next Paint', description: 'How quickly the page responds to user interactions like clicks and taps.', Icon: MousePointerClick, goodThreshold: '< 200ms', poorThreshold: '> 500ms', unit: 'milliseconds' },
  { key: 'ttfb', label: 'TTFB', fullLabel: 'Time to First Byte', description: 'How long the server takes to start sending a response. Reflects server and network performance.', Icon: Clock, goodThreshold: '< 800ms', poorThreshold: '> 1800ms', unit: 'milliseconds' },
  { key: 'speedIndex', label: 'SI', fullLabel: 'Speed Index', description: 'How quickly visible content is progressively rendered on screen.', Icon: BarChart3, goodThreshold: '< 3.4s', poorThreshold: '> 5.8s', unit: 'seconds' },
  { key: 'tbt', label: 'TBT', fullLabel: 'Total Blocking Time', description: 'Total time the main thread was blocked, preventing input responsiveness.', Icon: Timer, goodThreshold: '< 200ms', poorThreshold: '> 600ms', unit: 'milliseconds' },
];

/* ── Main Page ─────────────────────────────────────── */

export default function WebsiteSpeedPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || bundleLoading || !ready;

  const [speedData, setSpeedData] = useState<SpeedDataSummary | null>(null);
  const [findings, setFindings] = useState<SpeedFinding[]>([]);
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile');
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  // Load speed data from audit
  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setSpeedData(null);
      setFindings([]);
      return;
    }

    // Speed data lives on the audit record
    const sd = (audit as any).speed_data as SpeedDataSummary | null;
    if (sd) setSpeedData(sd);

    // Fetch speed-related findings
    fetch(`/api/audits/${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.findings) return;
        const speedFindings = (d.findings as any[]).filter(
          (f: any) => f.detection_source === 'pagespeed_api'
        );
        setFindings(speedFindings);
      })
      .catch(() => {});
  }, [bundle]);

  // Run speed test on demand
  const handleRunTest = async () => {
    const auditId = bundle?.audit?.id;
    if (!auditId || testing) return;
    setTesting(true);
    setTestError(null);
    try {
      const res = await fetch('/api/speed-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestError(data.error || 'Speed test failed. Please try again.');
        return;
      }
      setSpeedData(data.speed_data);
      // Re-fetch findings
      const findingsRes = await fetch(`/api/audits/${auditId}`);
      if (findingsRes.ok) {
        const fd = await findingsRes.json();
        if (fd?.findings) {
          setFindings(
            (fd.findings as any[]).filter((f: any) => f.detection_source === 'pagespeed_api')
          );
        }
      }
    } catch {
      setTestError('Network error. Please check your connection and try again.');
    } finally {
      setTesting(false);
    }
  };

  // Derived data
  const result: SpeedStrategyResult | null = speedData
    ? (strategy === 'mobile' ? speedData.mobile : speedData.desktop)
    : null;

  const fixableFindings = useMemo(
    () => findings.filter(f => f.finding_type === 'specific'),
    [findings]
  );
  const advisoryFindings = useMemo(
    () => findings.filter(f => f.finding_type !== 'specific'),
    [findings]
  );

  const productUrl = (bundle?.audit as any)?.product_url as string | undefined;

  const cwvMetrics = useMemo(() => {
    if (!result) return [];
    return METRIC_CONFIG.map(m => ({
      ...m,
      mobile: speedData?.mobile?.metrics[m.key] ?? null,
      desktop: speedData?.desktop?.metrics[m.key] ?? null,
    }));
  }, [result, speedData]);

  // Count of metrics that need attention
  const problemCount = useMemo(() => {
    if (!result) return 0;
    return METRIC_CONFIG.reduce((count, m) => {
      const metric = result.metrics[m.key];
      return count + (metric && metric.status !== 'good' ? 1 : 0);
    }, 0);
  }, [result]);

  /* ── Render ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--m-muted)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!bundle?.audit) return <EmptyAudit />;

  const hasData = speedData != null && (speedData.mobile != null || speedData.desktop != null);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={<Gauge size={18} strokeWidth={1.75} />}
          title="Website speed"
          subtitle="Core Web Vitals and performance diagnostics from Google PageSpeed Insights"
        />
        {hasData && (
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-1">
            <button
              onClick={handleRunTest}
              disabled={testing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
              style={{
                background: 'var(--ink)',
                color: 'var(--paper)',
                border: '1px solid var(--ink)',
              }}
            >
              <RefreshCw size={13} strokeWidth={1.75} className={testing ? 'animate-spin' : ''} />
              {testing ? 'Testing...' : 'Re-run speed test'}
            </button>
            {speedData?.testedAt && (
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                Last tested {new Date(speedData.testedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── No data state ── */}
      {!hasData && (
        <div
          className="rounded-xl border p-8 flex flex-col items-center justify-center gap-4"
          style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
          >
            <Gauge size={22} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} />
          </div>
          <div className="text-center max-w-sm">
            <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              No speed data yet
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
              Run a PageSpeed test to see real Core Web Vitals for your website. The test checks loading
              performance, visual stability, and responsiveness on both mobile and desktop.
            </p>
          </div>
          {testError && (
            <p className="text-[12px] text-center max-w-sm" style={{ color: 'var(--severe)' }}>{testError}</p>
          )}
          <button
            onClick={handleRunTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all hover:shadow-sm disabled:opacity-50"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {testing ? 'Running test...' : 'Run speed test'}
          </button>
        </div>
      )}

      {/* ── Data present ── */}
      {hasData && (
        <>
          {/* ── Strategy toggle ── */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
              {(['mobile', 'desktop'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className="px-4 py-1.5 text-[12px] font-medium capitalize transition-colors"
                  style={{
                    background: strategy === s ? 'var(--ink)' : 'transparent',
                    color: strategy === s ? 'var(--paper)' : 'var(--m-muted)',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {result && (
              <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                {problemCount === 0
                  ? 'All metrics passing'
                  : `${problemCount} metric${problemCount !== 1 ? 's' : ''} need${problemCount === 1 ? 's' : ''} attention`}
              </span>
            )}
          </div>

          {/* ── Hero score cards ── */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Mobile', data: speedData.mobile },
              { label: 'Desktop', data: speedData.desktop },
            ].map(({ label, data: strategyData }) => {
              const isActive = label.toLowerCase() === strategy;
              return (
                <button
                  key={label}
                  onClick={() => setStrategy(label.toLowerCase() as 'mobile' | 'desktop')}
                  className="rounded-xl border p-5 flex items-center gap-5 text-left transition-all"
                  style={{
                    background: 'var(--card)',
                    borderColor: isActive ? 'var(--ink)' : 'var(--rule)',
                    boxShadow: isActive ? '0 0 0 1px var(--ink)' : 'none',
                  }}
                >
                  {strategyData ? (
                    <>
                      <ScoreCircle score={strategyData.score} size="small" px={72} strokeWidth={7} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-1" style={{ color: 'var(--m-muted)' }}>
                          {label}
                        </p>
                        <p className="text-[18px] font-semibold tabular-nums" style={{ color: scoreColor(strategyData.score) }}>
                          {strategyData.score}<span className="text-[13px] font-normal" style={{ color: 'var(--m-muted)' }}>/100</span>
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: scoreColor(strategyData.score) }}>
                          {scoreLabel(strategyData.score)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 py-2 text-center">
                      <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-1" style={{ color: 'var(--m-muted)' }}>
                        {label}
                      </p>
                      <p className="text-[13px]" style={{ color: 'var(--m-muted)' }}>Not tested</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Core Web Vitals breakdown ── */}
          {result && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
            >
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--rule)' }}>
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Core Web Vitals</h2>
                <div className="flex items-center gap-4">
                  {(['good', 'needs_improvement', 'poor'] as const).map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: statusColor(s) }} />
                      <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{statusLabel(s)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metric rows */}
              <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--rule) 50%, transparent)' }}>
                {METRIC_CONFIG.map(m => {
                  const metric = result.metrics[m.key];
                  const otherStrategy = strategy === 'mobile' ? 'desktop' : 'mobile';
                  const otherResult = strategy === 'mobile' ? speedData!.desktop : speedData!.mobile;
                  const otherMetric = otherResult?.metrics[m.key];
                  const color = statusColor(metric.status);

                  return (
                    <div key={m.key} className="px-5 py-4 grid grid-cols-[1fr_auto] gap-4 items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}
                          >
                            <m.Icon size={13} strokeWidth={1.75} style={{ color }} />
                          </span>
                          <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                            {m.fullLabel}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                          >
                            {m.label}
                          </span>
                        </div>
                        <p className="text-[12px] leading-relaxed ml-[34px]" style={{ color: 'var(--m-muted)' }}>
                          {m.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 ml-[34px]">
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                            Good: <span style={{ color: 'var(--ok)' }}>{m.goodThreshold}</span>
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                            Poor: <span style={{ color: 'var(--severe)' }}>{m.poorThreshold}</span>
                          </span>
                          {otherMetric && (
                            <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                              {otherStrategy}: <span className="font-semibold tabular-nums" style={{ color: statusColor(otherMetric.status) }}>{otherMetric.displayValue}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 pt-1">
                        <p className="text-[22px] font-semibold tabular-nums leading-none" style={{ color }}>
                          {metric.displayValue}
                        </p>
                        <p className="text-[11px] mt-1 font-medium" style={{ color }}>
                          {statusLabel(metric.status)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── What this means ── */}
          {result && (
            <div
              className="rounded-xl border p-5"
              style={{
                background: 'color-mix(in srgb, var(--ink) 2%, var(--card))',
                borderColor: 'var(--rule)',
              }}
            >
              <div className="flex items-start gap-3">
                <Info size={15} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
                <div>
                  <h3 className="text-[13px] font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>
                    What this means for your visitors
                  </h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                    {result.score >= 90
                      ? 'Your website loads quickly and responds instantly. Visitors experience smooth interactions with no noticeable delays or layout shifts. This directly improves engagement, conversion rates, and search ranking.'
                      : result.score >= 50
                        ? 'Your website has moderate performance. Some visitors, especially on mobile or slower connections, may experience delays in loading or interaction. Improving the metrics flagged below can meaningfully reduce bounce rates and improve user satisfaction.'
                        : 'Your website has significant performance issues. Visitors are likely experiencing slow loads, unresponsive interactions, or visual instability. These issues directly hurt engagement, conversion rates, and SEO rankings. The fixable issues below are prioritized by impact.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Speed findings: Fixable ── */}
          {fixableFindings.length > 0 && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
            >
              <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--rule)' }}>
                <Wrench size={14} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                  Fixable issues
                </h2>
                <span
                  className="ml-1 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums"
                  style={{ background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}
                >
                  {fixableFindings.length}
                </span>
                <span className="ml-auto text-[11px]" style={{ color: 'var(--m-muted)' }}>
                  These can be fixed directly in your codebase
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--rule) 50%, transparent)' }}>
                {fixableFindings.map(f => {
                  const isExpanded = expandedFinding === f.id;
                  return (
                    <div key={f.id} className="px-5">
                      <button
                        onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                        className="w-full py-3.5 flex items-start gap-3 text-left"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: severityColor(f.severity) }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                            {f.title}
                          </p>
                          {!isExpanded && f.recommendation && (
                            <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'var(--m-muted)' }}>
                              {f.recommendation}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ background: `color-mix(in srgb, ${severityColor(f.severity)} 10%, transparent)`, color: severityColor(f.severity) }}
                          >
                            {severityLabel(f.severity)}
                          </span>
                          <ChevronDown
                            size={14}
                            style={{
                              color: 'var(--m-muted)',
                              transform: isExpanded ? 'rotate(180deg)' : 'none',
                              transition: 'transform 200ms ease',
                            }}
                          />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="pb-4 pl-5 space-y-2.5">
                          {f.description && (
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                              {f.description}
                            </p>
                          )}
                          {f.recommendation && (
                            <div
                              className="rounded-lg p-3"
                              style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)' }}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <Lightbulb size={12} strokeWidth={1.75} style={{ color: 'var(--ok)' }} />
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>How to fix</span>
                              </div>
                              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                                {f.recommendation}
                              </p>
                            </div>
                          )}
                          {f.performance_metric_type && (
                            <p className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
                              Affects: {METRIC_CONFIG.find(m => m.key === f.performance_metric_type)?.fullLabel || f.performance_metric_type}
                              {f.owner_team && <> &middot; Owner: {f.owner_team}</>}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Speed findings: Advisory ── */}
          {advisoryFindings.length > 0 && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
            >
              <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--rule)' }}>
                <Info size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--m-muted)' }}>
                  Advisory
                </h2>
                <span
                  className="ml-1 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums"
                  style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--m-muted)' }}
                >
                  {advisoryFindings.length}
                </span>
                <span className="ml-auto text-[11px]" style={{ color: 'var(--m-muted)' }}>
                  Recommendations for further optimization
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--rule) 50%, transparent)' }}>
                {advisoryFindings.map(f => {
                  const isExpanded = expandedFinding === f.id;
                  return (
                    <div key={f.id} className="px-5">
                      <button
                        onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                        className="w-full py-3.5 flex items-start gap-3 text-left"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{ background: 'var(--m-muted)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                            {f.title}
                          </p>
                          {!isExpanded && f.recommendation && (
                            <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'var(--m-muted)' }}>
                              {f.recommendation}
                            </p>
                          )}
                        </div>
                        <ChevronDown
                          size={14}
                          style={{
                            color: 'var(--m-muted)',
                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 200ms ease',
                          }}
                        />
                      </button>
                      {isExpanded && (
                        <div className="pb-4 pl-5 space-y-2.5">
                          {f.description && (
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                              {f.description}
                            </p>
                          )}
                          {f.recommendation && (
                            <div
                              className="rounded-lg p-3"
                              style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <Lightbulb size={12} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                                <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>Recommendation</span>
                              </div>
                              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                                {f.recommendation}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── No findings state ── */}
          {findings.length === 0 && result && (
            <div
              className="rounded-xl border p-5 flex items-center gap-3"
              style={{ background: 'color-mix(in srgb, var(--ok) 4%, var(--card))', borderColor: 'var(--rule)' }}
            >
              <CheckCircle2 size={16} strokeWidth={1.75} style={{ color: 'var(--ok)' }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>No speed issues detected</p>
                <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                  PageSpeed Insights found no actionable performance issues for this website.
                </p>
              </div>
            </div>
          )}

          {/* ── Footer: PageSpeed Insights link ── */}
          {productUrl && (
            <div className="flex items-center justify-end">
              <a
                href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(productUrl.startsWith('http') ? productUrl : `https://${productUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--m-muted)' }}
              >
                View full report on PageSpeed Insights
                <ExternalLink size={12} strokeWidth={1.75} />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
