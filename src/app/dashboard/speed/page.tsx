'use client';

/**
 * Website Speed — PageSpeed Insights-style dashboard.
 *
 * Surfaces:
 *  1) Mobile/Desktop toggle with category score circles (Performance, Accessibility, Best Practices, SEO).
 *  2) Screenshot + hero performance score.
 *  3) Expandable metrics section with inline recommendations.
 *  4) Fixable issues and advisory findings in card grids.
 *  5) On-demand re-test and link to Google PageSpeed Insights.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  CheckCircle2,
  Wrench,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  AlertTriangle,
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

/** Sort order for metric status: poor first, then needs_improvement, then good */
function statusSortOrder(status: SpeedMetric['status']): number {
  if (status === 'poor') return 0;
  if (status === 'needs_improvement') return 1;
  return 2;
}

/* ── Metric recommendations ──────────────────────── */

const METRIC_RECOMMENDATIONS: Record<string, { needs_improvement: string; poor: string }> = {
  fcp: {
    needs_improvement: 'Reduce server response time and eliminate render-blocking resources to paint content faster.',
    poor: 'Your first content appears very late. Inline critical CSS, defer non-essential JS, and optimize server response time.',
  },
  lcp: {
    needs_improvement: 'Optimize images, preload critical assets, and reduce server response time.',
    poor: 'Your main content takes too long to appear. Prioritize image compression, use a CDN, and reduce render-blocking resources.',
  },
  cls: {
    needs_improvement: 'Set explicit width/height on images and embeds, and avoid inserting content above existing elements.',
    poor: 'Your layout shifts significantly. Add size attributes to all media and avoid dynamically injected content.',
  },
  inp: {
    needs_improvement: 'Reduce JavaScript execution time and break up long tasks.',
    poor: 'Interactions feel sluggish. Split heavy JS into smaller chunks, defer non-critical scripts, and minimize DOM size.',
  },
  ttfb: {
    needs_improvement: 'Optimize server configuration, enable caching, or use a CDN.',
    poor: 'Your server is very slow to respond. Investigate server-side bottlenecks, enable edge caching, or upgrade hosting.',
  },
  speedIndex: {
    needs_improvement: 'Reduce render-blocking CSS/JS and prioritize visible content loading.',
    poor: 'Visible content loads very slowly. Eliminate render-blocking resources, inline critical CSS, defer non-essential scripts.',
  },
  tbt: {
    needs_improvement: 'Break up long JavaScript tasks and defer non-essential scripts.',
    poor: 'The main thread is heavily blocked. Remove unused JS, code-split large bundles, and defer third-party scripts.',
  },
};

/* ── Metric configuration ────────────────────────── */

const METRIC_CONFIG: Array<{
  key: 'fcp' | 'lcp' | 'cls' | 'inp' | 'ttfb' | 'speedIndex' | 'tbt';
  label: string;
  fullLabel: string;
  friendlyLabel: string;
  description: string;
  Icon: any;
  goodThreshold: string;
  poorThreshold: string;
  /** Numeric thresholds for bar visualization (in raw metric units) */
  goodLimit: number;
  poorLimit: number;
  /** Maximum value for the bar (typically ~1.5× poor limit) */
  barMax: number;
  /** Whether this is a Core Web Vital (LCP, INP, CLS) */
  coreVital: boolean;
}> = [
  { key: 'lcp', label: 'LCP', fullLabel: 'Largest Contentful Paint', friendlyLabel: 'Loading time', description: 'How long the largest visible element takes to render. The primary loading metric users notice.', Icon: Zap, goodThreshold: '< 2.5s', poorThreshold: '> 4.0s', goodLimit: 2500, poorLimit: 4000, barMax: 6000, coreVital: true },
  { key: 'inp', label: 'INP', fullLabel: 'Interaction to Next Paint', friendlyLabel: 'Responsiveness', description: 'How quickly the page responds to user interactions like clicks and taps.', Icon: MousePointerClick, goodThreshold: '< 200ms', poorThreshold: '> 500ms', goodLimit: 200, poorLimit: 500, barMax: 750, coreVital: true },
  { key: 'cls', label: 'CLS', fullLabel: 'Cumulative Layout Shift', friendlyLabel: 'Visual stability', description: 'How much the page layout shifts unexpectedly while loading.', Icon: Move, goodThreshold: '< 0.1', poorThreshold: '> 0.25', goodLimit: 0.1, poorLimit: 0.25, barMax: 0.4, coreVital: true },
  { key: 'fcp', label: 'FCP', fullLabel: 'First Contentful Paint', friendlyLabel: 'First paint', description: 'How quickly the first text or image is painted on screen.', Icon: Zap, goodThreshold: '< 1.8s', poorThreshold: '> 3.0s', goodLimit: 1800, poorLimit: 3000, barMax: 4500, coreVital: false },
  { key: 'ttfb', label: 'TTFB', fullLabel: 'Time to First Byte', friendlyLabel: 'Server speed', description: 'How long the server takes to start sending a response.', Icon: Clock, goodThreshold: '< 800ms', poorThreshold: '> 1800ms', goodLimit: 800, poorLimit: 1800, barMax: 2700, coreVital: false },
  { key: 'speedIndex', label: 'SI', fullLabel: 'Speed Index', friendlyLabel: 'Render speed', description: 'How quickly visible content is progressively rendered on screen.', Icon: BarChart3, goodThreshold: '< 3.4s', poorThreshold: '> 5.8s', goodLimit: 3400, poorLimit: 5800, barMax: 8700, coreVital: false },
  { key: 'tbt', label: 'TBT', fullLabel: 'Total Blocking Time', friendlyLabel: 'Thread blocking', description: 'Total time the main thread was blocked, preventing input responsiveness.', Icon: Timer, goodThreshold: '< 200ms', poorThreshold: '> 600ms', goodLimit: 200, poorLimit: 600, barMax: 900, coreVital: false },
];

/* ── StatusBadge — simple colored status label ── */

function StatusBadge({ status }: { status: SpeedMetric['status'] }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${statusColor(status)} 10%, transparent)`,
        color: statusColor(status),
      }}
    >
      {statusLabel(status)}
    </span>
  );
}

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
  const [metricsExpanded, setMetricsExpanded] = useState(true);

  // Load speed data from audit
  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setSpeedData(null);
      setFindings([]);
      return;
    }

    const sd = (audit as any).speed_data as SpeedDataSummary | null;
    if (sd) setSpeedData(sd);

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
  const handleRunTest = useCallback(async () => {
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
  }, [bundle?.audit?.id, testing]);

  // Derived data
  const result: SpeedStrategyResult | null = speedData
    ? (strategy === 'mobile' ? speedData.mobile : speedData.desktop)
    : null;

  const categories = result?.categories ?? null;
  const hasCategories = categories != null;

  const fixableFindings = useMemo(
    () => findings.filter(f => f.finding_type === 'specific'),
    [findings]
  );
  const advisoryFindings = useMemo(
    () => findings.filter(f => f.finding_type !== 'specific'),
    [findings]
  );

  const productUrl = (bundle?.audit as any)?.product_url as string | undefined;

  // Sort metrics: problematic first
  const sortedMetrics = useMemo(() => {
    if (!result) return METRIC_CONFIG;
    return [...METRIC_CONFIG].sort((a, b) => {
      const metricA = result.metrics[a.key];
      const metricB = result.metrics[b.key];
      if (!metricA && !metricB) return 0;
      if (!metricA) return 1;
      if (!metricB) return -1;
      return statusSortOrder(metricA.status) - statusSortOrder(metricB.status);
    });
  }, [result]);

  // Count of metrics needing attention
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
        <div
          className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--m-muted)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!bundle?.audit) return <EmptyAudit />;

  const hasData = speedData != null && (speedData.mobile != null || speedData.desktop != null);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <PageHeader
          icon={<Gauge size={18} strokeWidth={1.75} />}
          title="Website speed"
          subtitle="Performance diagnostics powered by Google PageSpeed Insights"
        />
        {hasData && (
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
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

      {testError && (
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-2 text-[12px]"
          style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', color: 'var(--severe)' }}
        >
          <AlertTriangle size={14} strokeWidth={1.75} />
          {testError}
        </div>
      )}

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
              Run a PageSpeed test to see real Core Web Vitals for your website. The test checks
              loading performance, visual stability, and responsiveness on both mobile and desktop.
            </p>
          </div>
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
          {/* ── Mobile / Desktop tab toggle ── */}
          <div
            className="inline-flex items-center rounded-lg p-1 gap-0.5"
            style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
          >
            {(['mobile', 'desktop'] as const).map(s => {
              const isActive = strategy === s;
              const data = s === 'mobile' ? speedData?.mobile : speedData?.desktop;
              const Icon = s === 'mobile' ? Smartphone : Monitor;
              return (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all"
                  style={{
                    background: isActive ? 'var(--card)' : 'transparent',
                    color: isActive ? 'var(--ink)' : 'var(--m-muted)',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  <span className="capitalize">{s}</span>
                  {data && (
                    <span
                      className="text-[11px] font-semibold tabular-nums ml-0.5"
                      style={{ color: isActive ? scoreColor(data.score) : 'var(--m-muted)' }}
                    >
                      {data.score}
                    </span>
                  )}
                  {!data && (
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>--</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Hero: Category scores + screenshot ── */}
          {result && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
            >
              {/* Scores row: Performance (big) + secondary scores + screenshot */}
              <div className="flex flex-col sm:flex-row items-center">
                {/* Scores */}
                <div className="flex-1 px-6 sm:px-10 py-8">
                  <div className="flex items-end justify-center gap-8 sm:gap-12">
                    {/* Performance — big primary circle */}
                    <div className="flex flex-col items-center gap-2.5">
                      <ScoreCircle score={result.score} size="big" />
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
                        Performance
                      </span>
                    </div>

                    {/* Accessibility, Best Practices, SEO */}
                    {hasCategories && ([
                      { key: 'accessibility' as const, label: 'Accessibility' },
                      { key: 'bestPractices' as const, label: 'Best Practices' },
                      { key: 'seo' as const, label: 'SEO' },
                    ]).map(cat => (
                      <div key={cat.key} className="flex flex-col items-center gap-2.5">
                        <ScoreCircle
                          score={categories![cat.key]}
                          size="small"
                        />
                        <span className="text-[12px] font-medium" style={{ color: 'var(--m-muted)' }}>
                          {cat.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Note below scores */}
                  <p className="text-[11px] leading-relaxed text-center mt-5 max-w-[380px] mx-auto" style={{ color: 'var(--m-muted)' }}>
                    Values are estimated and may vary. The performance score is calculated directly from the metrics below.
                  </p>
                </div>

                {/* Screenshot — right side */}
                {result.screenshotUrl && (
                  <div
                    className="w-full sm:w-[220px] flex-shrink-0 p-4 sm:p-5 flex items-center justify-center"
                    style={{ borderLeft: '1px solid var(--rule)' }}
                  >
                    <div
                      className="rounded-lg overflow-hidden border"
                      style={{ borderColor: 'var(--rule)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={result.screenshotUrl}
                        alt="Page screenshot"
                        className="w-full h-auto max-h-[220px] object-contain"
                        style={{ background: 'var(--paper)' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom row: URL | Legend | Tested date */}
              <div
                className="px-5 sm:px-8 py-3 flex items-center justify-between gap-4"
                style={{ borderTop: '1px solid var(--rule)' }}
              >
                {/* Left: URL */}
                <p
                  className="text-[11px] truncate min-w-0 flex-1"
                  style={{ color: 'var(--m-muted)' }}
                  title={result.finalUrl || ''}
                >
                  {result.finalUrl || ''}
                </p>

                {/* Center: Legend */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '8px solid var(--severe)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>0&ndash;49</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-[8px] h-[8px] rounded-[1px]" style={{ background: 'var(--warn)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>50&ndash;89</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-[8px] h-[8px] rounded-full" style={{ background: 'var(--ok)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>90&ndash;100</span>
                  </span>
                </div>

                {/* Right: Tested date */}
                <p className="text-[11px] flex-shrink-0 flex-1 text-right" style={{ color: 'var(--m-muted)' }}>
                  {speedData?.testedAt
                    ? `Tested ${new Date(speedData.testedAt).toLocaleDateString()} at ${new Date(speedData.testedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </p>
              </div>
            </div>
          )}

          {/* ── Metrics Section ── */}
          {result && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
            >
              {/* Metrics header */}
              <button
                onClick={() => setMetricsExpanded(prev => !prev)}
                className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2 transition-colors"
                style={{ borderBottom: metricsExpanded ? '1px solid var(--rule)' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--m-muted)' }}>
                    Metrics
                  </h2>
                  {problemCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums"
                      style={{ background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}
                    >
                      {problemCount} need{problemCount === 1 ? 's' : ''} attention
                    </span>
                  )}
                  {problemCount === 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: 'color-mix(in srgb, var(--ok) 12%, transparent)', color: 'var(--ok)' }}
                    >
                      All passing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {/* Status legend */}
                  <div className="hidden sm:flex items-center gap-3">
                    {(['good', 'needs_improvement', 'poor'] as const).map(s => (
                      <div key={s} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: statusColor(s) }} />
                        <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{statusLabel(s)}</span>
                      </div>
                    ))}
                  </div>
                  {metricsExpanded
                    ? <ChevronUp size={16} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                    : <ChevronDown size={16} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                  }
                </div>
              </button>

              {/* Metrics content */}
              {metricsExpanded && (() => {
                const coreVitals = sortedMetrics.filter(m => m.coreVital && result.metrics[m.key]);
                const otherMetrics = sortedMetrics.filter(m => !m.coreVital && result.metrics[m.key]);

                const renderMetricRow = (m: typeof METRIC_CONFIG[number]) => {
                  const metric = result.metrics[m.key];
                  if (!metric) return null;

                  const color = statusColor(metric.status);
                  const rec = metric.status !== 'good'
                    ? METRIC_RECOMMENDATIONS[m.key]?.[metric.status]
                    : null;

                  return (
                    <div
                      key={m.key}
                      className="px-4 sm:px-5 py-4"
                      style={{ borderBottom: '1px solid color-mix(in srgb, var(--rule) 50%, transparent)' }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: metric info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: color }}
                            />
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                              {m.fullLabel}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-[0.02em] flex-shrink-0"
                              style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
                            >
                              {m.label}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                            {m.description}
                          </p>
                        </div>

                        {/* Right: value + status */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <p className="text-[20px] font-semibold tabular-nums leading-none" style={{ color }}>
                            {metric.displayValue}
                          </p>
                          <StatusBadge status={metric.status} />
                        </div>
                      </div>

                      {/* Inline recommendation for non-good */}
                      {rec && (
                        <div
                          className="mt-3 rounded-lg p-2.5"
                          style={{ background: `color-mix(in srgb, ${color} 5%, transparent)` }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Lightbulb size={11} strokeWidth={1.75} style={{ color }} />
                            <span className="text-[10px] font-semibold" style={{ color }}>How to improve</span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                            {rec}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {/* Core Web Vitals */}
                    {coreVitals.length > 0 && (
                      <div>
                        {coreVitals.map(m => renderMetricRow(m))}
                      </div>
                    )}

                    {/* Other notable metrics */}
                    {otherMetrics.length > 0 && (
                      <>
                        <div
                          className="px-4 sm:px-5 py-2.5"
                          style={{ borderBottom: '1px solid color-mix(in srgb, var(--rule) 50%, transparent)' }}
                        >
                          <span className="text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: 'var(--m-muted)' }}>
                            Other notable metrics
                          </span>
                        </div>
                        <div>
                          {otherMetrics.map(m => renderMetricRow(m))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ── Speed findings: Fixable — card grid ── */}
          {fixableFindings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Wrench size={14} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                  Fixable issues
                </h2>
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums"
                  style={{ background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}
                >
                  {fixableFindings.length}
                </span>
                <span className="ml-auto text-[11px] hidden sm:inline" style={{ color: 'var(--m-muted)' }}>
                  These can be fixed directly in your codebase
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fixableFindings.map(f => {
                  const affectedMetric = f.performance_metric_type
                    ? METRIC_CONFIG.find(m => m.key === f.performance_metric_type)
                    : null;
                  return (
                    <div
                      key={f.id}
                      className="rounded-xl border p-4 flex flex-col"
                      style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            background: `color-mix(in srgb, ${severityColor(f.severity)} 10%, transparent)`,
                            color: severityColor(f.severity),
                          }}
                        >
                          {severityLabel(f.severity)}
                        </span>
                        {affectedMetric && (
                          <span className="text-[10px] font-medium" style={{ color: 'var(--m-muted)' }}>
                            {affectedMetric.label}
                          </span>
                        )}
                      </div>
                      <h3 className="text-[13px] font-semibold leading-snug mb-1.5" style={{ color: 'var(--ink)' }}>
                        {f.title}
                      </h3>
                      {f.description && (
                        <p className="text-[11px] leading-relaxed mb-3 line-clamp-2 flex-1" style={{ color: 'var(--m-muted)' }}>
                          {f.description}
                        </p>
                      )}
                      {f.recommendation && (
                        <div
                          className="rounded-lg p-2.5 mt-auto"
                          style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)' }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <Lightbulb size={10} strokeWidth={1.75} style={{ color: 'var(--ok)' }} />
                            <span className="text-[10px] font-semibold" style={{ color: 'var(--ok)' }}>How to fix</span>
                          </div>
                          <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: 'var(--ink)' }}>
                            {f.recommendation}
                          </p>
                        </div>
                      )}
                      {f.owner_team && (
                        <p className="text-[10px] mt-2" style={{ color: 'var(--m-muted)' }}>
                          Owner: {f.owner_team}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Speed findings: Advisory — card grid ── */}
          {advisoryFindings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Info size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                <h2 className="text-[14px] font-semibold" style={{ color: 'var(--m-muted)' }}>
                  Advisory
                </h2>
                <span
                  className="px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums"
                  style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--m-muted)' }}
                >
                  {advisoryFindings.length}
                </span>
                <span className="ml-auto text-[11px] hidden sm:inline" style={{ color: 'var(--m-muted)' }}>
                  Recommendations for further optimization
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {advisoryFindings.map(f => (
                  <div
                    key={f.id}
                    className="rounded-xl border p-4 flex flex-col"
                    style={{ background: 'var(--card)', borderColor: 'var(--rule)' }}
                  >
                    <h3 className="text-[13px] font-semibold leading-snug mb-1.5" style={{ color: 'var(--ink)' }}>
                      {f.title}
                    </h3>
                    {f.description && (
                      <p className="text-[11px] leading-relaxed mb-3 line-clamp-2 flex-1" style={{ color: 'var(--m-muted)' }}>
                        {f.description}
                      </p>
                    )}
                    {f.recommendation && (
                      <div
                        className="rounded-lg p-2.5 mt-auto"
                        style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Lightbulb size={10} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: 'var(--ink)' }}>Recommendation</span>
                        </div>
                        <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: 'var(--ink)' }}>
                          {f.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── No findings state ── */}
          {findings.length === 0 && result && (
            <div
              className="rounded-xl border p-4 flex items-center gap-3"
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
            <div className="flex items-center justify-end pt-2">
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
