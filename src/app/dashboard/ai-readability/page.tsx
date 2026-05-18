'use client';

/**
 * AI Readability — workspace view for the selected brand/site.
 *
 * Surfaces two layers in one page:
 *  1) AI X-Ray (#x-ray) — per-platform accuracy from multi-model probes
 *     (Claude, ChatGPT, Gemini, Perplexity). Rows show "Not yet measured"
 *     until a probe row exists; we never fabricate scores.
 *  2) Per-page AI readability — what AI crawlers can extract from each
 *     crawled page (score, status, extractable signals, missing signals).
 *
 * Lives at /dashboard/ai-readability so the Overview "AI Monitoring" and
 * "AI X-Ray" cards stay inside the new workspace IA instead of dumping
 * users into the legacy audit detail screen.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { AIProviderIcon, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import {
  loadLatestAuditBundle,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import {
  buildProviderRows,
  summarizeCoverage,
  coverageCaption,
} from '@/lib/ai-xray/provider-status';

type AIPageReadability = {
  extractable?: string[];
  missing?: string[];
  structuredDataTypes?: string[];
  overallScore?: number;
  status?: 'green' | 'amber' | 'red';
};

type AuditPageRow = {
  id?: string;
  url: string;
  title: string | null;
  ai_readability: AIPageReadability | null;
};

type ModelProbe = {
  model_id: string;
  model_label: string;
  accuracy_score: number;
  status?: 'measured' | 'skipped' | 'error' | null;
  error_message?: string | null;
  created_at?: string | null;
};

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

export default function AIReadabilityPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [pages, setPages] = useState<AuditPageRow[]>([]);
  const [probes, setProbes] = useState<ModelProbe[]>([]);
  const [loading, setLoading] = useState(true);

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

  const refreshProbes = React.useCallback(async (auditId: string) => {
    try {
      const r = await fetch(`/api/audits/intelligence?audit_id=${auditId}`);
      if (!r.ok) return;
      const d = await r.json();
      setProbes((d?.modelProbes || []) as ModelProbe[]);
    } catch {}
  }, []);

  useEffect(() => {
    const auditId = bundle?.audit?.id;
    if (!auditId) {
      setPages([]);
      setProbes([]);
      return;
    }
    const supabase = createBrowserSupabase();
    supabase
      .from('audit_pages')
      .select('id, url, title, ai_readability')
      .eq('audit_id', auditId)
      .then(({ data }) => setPages((data || []) as AuditPageRow[]));

    void refreshProbes(auditId);
  }, [bundle, refreshProbes]);

  if (authLoading || loading || !ready) {
    return (
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-[220px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!bundle?.audit || !bundle.report) {
    return (
      <div>
        <OverviewBreadcrumb current="AI Readability" />
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            AI Readability
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection
              ? 'No audit for this brand yet. Run one to see how AI assistants read this brand.'
              : 'Pick a brand or run an audit to see how AI reads it.'}
          </p>
        </div>
        <EmptyAudit
          title="No audit to analyse yet"
          body="Run a Fixpath audit to see how Claude, ChatGPT, Gemini, and Perplexity read your brand — and what to fix so they get it right."
        />
      </div>
    );
  }

  return (
    <AIReadabilityBody
      bundle={bundle}
      pages={pages}
      probes={probes}
      onProbesRefreshed={() => bundle?.audit?.id && refreshProbes(bundle.audit.id)}
    />
  );
}

function AIReadabilityBody({
  bundle,
  pages,
  probes,
  onProbesRefreshed,
}: {
  bundle: LatestAuditBundle;
  pages: AuditPageRow[];
  probes: ModelProbe[];
  onProbesRefreshed: () => void;
}) {
  const audit = bundle.audit!;
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);
  const [rescanOk, setRescanOk] = useState(false);

  const handleRescan = async () => {
    if (!audit?.id || rescanning) return;
    setRescanning(true);
    setRescanError(null);
    setRescanOk(false);
    try {
      const res = await fetch(`/api/audits/${audit.id}/rescan-xray`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRescanError(typeof data?.error === 'string' ? data.error : 'Re-scan failed');
      } else {
        setRescanOk(true);
        onProbesRefreshed();
        setTimeout(() => setRescanOk(false), 3000);
      }
    } catch {
      setRescanError('Re-scan failed');
    } finally {
      setRescanning(false);
    }
  };

  // Most-recent created_at across probes — used as "last scan" timestamp.
  const lastScan = useMemo(() => {
    const stamps = probes
      .map((p) => p.created_at ? new Date(p.created_at).getTime() : 0)
      .filter((t) => t > 0);
    return stamps.length > 0 ? new Date(Math.max(...stamps)) : null;
  }, [probes]);
  const rows = useMemo(() => buildProviderRows(probes), [probes]);
  const coverage = useMemo(() => summarizeCoverage(rows), [rows]);
  const avg = coverage.average;
  const coverageNote = coverageCaption(coverage);

  const pagesScored = pages.filter(p => p.ai_readability?.overallScore != null);
  const avgPageScore = pagesScored.length > 0
    ? Math.round(pagesScored.reduce((s, p) => s + (p.ai_readability!.overallScore || 0), 0) / pagesScored.length)
    : null;

  return (
    <div>
      <OverviewBreadcrumb current="AI Readability" />
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          AI Readability
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          How AI assistants read this brand, and what each crawled page exposes to them.
        </p>
      </div>

      {/* ── Layer-clarification note ──────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 mb-4 flex items-start gap-2.5 text-[12px]"
        style={{ background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
      >
        <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
        <div className="min-w-0">
          <p>
            <strong>AI Readability</strong> (this page) measures crawlability and what bots can parse from your pages.{' '}
            <strong>AI X-Ray</strong> (below) measures what Claude, ChatGPT, Gemini and Perplexity currently say about your brand.{' '}
            <span style={{ color: 'var(--m-muted)' }}>
              AI Visibility / Share of Voice across non-branded buyer prompts is a separate layer and is not measured yet.
            </span>
          </p>
        </div>
      </div>

      {/* ── AI X-Ray ─────────────────────────────────────────── */}
      <section id="x-ray" className="rounded-xl p-5 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <div className="flex items-start gap-2 mb-4">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Sparkles size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
              AI X-Ray <span className="text-[11px] font-normal" style={{ color: 'var(--m-muted)' }}>· AI Perception</span>
            </h2>
            <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
              We ask each model what it knows about your brand and grade its answer for accuracy.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleRescan}
              disabled={rescanning}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
              aria-label="Re-scan AI X-Ray"
              title="Re-run model probes only — does not re-crawl your site"
            >
              <RefreshCw size={12} className={rescanning ? 'animate-spin' : ''} />
              {rescanning ? 'Re-scanning' : 'Re-scan'}
            </button>
            {avg != null && (
              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1">
                  <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: scoreColor(avg) }}>
                    {avg}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>/100 avg</span>
                </div>
                <span className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                  {coverage.measuredCount} of {coverage.totalCount} models measured
                </span>
              </div>
            )}
          </div>
        </div>

        {(rescanError || rescanOk) && (
          <div
            className="text-[11px] mb-3 px-3 py-2 rounded-md"
            style={{
              color: rescanError ? 'var(--severe)' : 'var(--ok)',
              background: `color-mix(in srgb, var(${rescanError ? '--severe' : '--ok'}) 8%, transparent)`,
            }}
          >
            {rescanError || 'Re-scan complete — refreshed model perception scores.'}
          </div>
        )}

        {coverage.hasQuotaError && !rescanError && (
          <div
            className="text-[11px] mb-3 px-3 py-2 rounded-md flex items-start gap-2"
            style={{
              color: 'var(--ink)',
              background: 'color-mix(in srgb, var(--warn) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warn) 35%, transparent)',
            }}
          >
            <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--warn)' }} />
            <span>
              <strong>{coverage.quotaBlockedProviderLabels.join(', ')} quota exceeded.</strong>{' '}
              The average above is calculated from the {coverage.measuredCount} of {coverage.totalCount} models that did respond — failures are not counted as zero.
              Re-scan will keep failing for {coverage.quotaBlockedProviderLabels.length === 1 ? 'this provider' : 'these providers'} until the API quota or billing is restored.
            </span>
          </div>
        )}

        {coverage.hasErrors && !coverage.hasQuotaError && (
          <div
            className="text-[11px] mb-3 px-3 py-2 rounded-md flex items-start gap-2"
            style={{
              color: 'var(--ink)',
              background: 'color-mix(in srgb, var(--m-muted) 10%, transparent)',
              border: '1px solid var(--rule)',
            }}
          >
            <Info size={13} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
            <span>
              The average above is calculated from {coverage.measuredCount} of {coverage.totalCount} models —
              {' '}{coverage.erroredProviderLabels.join(', ')} returned an error and {coverage.erroredProviderLabels.length === 1 ? 'is' : 'are'} excluded from the score. Re-scan to retry.
            </span>
          </div>
        )}

        {coverageNote && !coverage.hasErrors && avg != null && (
          <p className="text-[11px] mb-3" style={{ color: 'var(--m-muted)' }}>
            {coverageNote}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {rows.map((r) => {
            const iconKey = providerKeyToIcon(r.key);
            const scoreCol = scoreColor(r.score ?? null);

            const statusBadge: { label: string; varName: string; tooltip?: string } | null =
              r.status === 'measured'
                ? null
                : {
                    label: r.statusLabel,
                    varName: r.status === 'error' ? '--severe' : '--m-muted',
                    tooltip: r.statusTooltip,
                  };

            return (
              <div
                key={r.key}
                className="rounded-lg p-3.5 flex flex-col gap-2"
                style={{
                  background: 'var(--paper)',
                  border: '1px solid color-mix(in srgb, var(--rule) 60%, transparent)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md overflow-hidden flex-shrink-0"
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid color-mix(in srgb, var(--rule) 60%, transparent)',
                    }}
                    aria-hidden
                  >
                    {iconKey ? <AIProviderIcon provider={iconKey} size={24} /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{r.label}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--m-muted)' }}>{r.note}</p>
                  </div>
                  {statusBadge && (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        color: `var(${statusBadge.varName})`,
                        background: `color-mix(in srgb, var(${statusBadge.varName}) 10%, transparent)`,
                      }}
                      title={statusBadge.tooltip}
                    >
                      {statusBadge.label}
                    </span>
                  )}
                </div>
                {r.status === 'measured' && r.score != null ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: scoreCol }}>
                        {r.score}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                    >
                      <span
                        className="block h-full"
                        style={{ width: `${r.score}%`, background: scoreCol }}
                      />
                    </div>
                  </>
                ) : (
                  <p
                    className="text-[11px] leading-snug"
                    style={{ color: r.status === 'error' ? 'var(--severe)' : 'var(--m-muted)' }}
                  >
                    {r.statusTooltip}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {(avg == null || lastScan) && (
          <p className="text-[11px] mt-3 flex items-center gap-2" style={{ color: 'var(--m-muted)' }}>
            {avg == null && <span>Multi-model probes will populate after your next audit.</span>}
            {lastScan && (
              <span className="ml-auto">
                Last scan {lastScan.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
          </p>
        )}
      </section>

      {/* ── Per-page AI readability ───────────────────────────── */}
      <section className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--rule)' }}>
          <Brain size={16} style={{ color: 'var(--signal)' }} />
          <h2 className="text-[14px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
            What AI bots extract from your pages
          </h2>
          {avgPageScore != null && (
            <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: scoreColor(avgPageScore) }}>
              avg {avgPageScore}/100 · {pagesScored.length} page{pagesScored.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {pages.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13px]" style={{ color: 'var(--ink)' }}>
              No crawled pages on this audit yet.
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
              Run a website audit to populate per-page extraction data.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
            {pages.map((page) => {
              const r = page.ai_readability || {};
              const score = r.overallScore ?? null;
              const status = r.status;
              const extractable = r.extractable || [];
              const missing = r.missing || [];
              return (
                <li key={page.id || page.url}>
                  <details className="group">
                    <summary className="px-5 py-3.5 flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          background: status === 'green' ? 'var(--ok)' : status === 'amber' ? 'var(--warn)' : status === 'red' ? 'var(--severe)' : 'var(--m-muted)',
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                          {page.title || page.url}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--m-muted)' }}>{page.url}</p>
                      </div>
                      {score != null && (
                        <span className="text-[14px] font-bold tabular-nums flex-shrink-0" style={{ color: scoreColor(score) }}>
                          {score}
                        </span>
                      )}
                      <ChevronDown size={14} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-5 pb-4">
                      {(extractable.length > 0 || missing.length > 0) ? (
                        <div className="flex flex-wrap gap-1.5">
                          {extractable.map((item) => (
                            <span
                              key={`e-${item}`}
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ color: 'var(--ok)', background: 'color-mix(in srgb, var(--ok) 10%, transparent)' }}
                            >
                              <CheckCircle2 size={9} /> {item}
                            </span>
                          ))}
                          {missing.map((item) => (
                            <span
                              key={`m-${item}`}
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 10%, transparent)' }}
                            >
                              <AlertTriangle size={9} /> {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                          No AI readability breakdown recorded for this page.
                        </p>
                      )}
                      {missing.length > 0 && (
                        <Link
                          href="/dashboard/fix?module=Foundation"
                          className="inline-flex items-center gap-1 mt-3 text-[11px] font-semibold hover:underline"
                          style={{ color: 'var(--ink)' }}
                        >
                          Fix {missing.length} missing signal{missing.length === 1 ? '' : 's'} <ArrowRight size={11} />
                        </Link>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
        Scores are computed from your latest audit ({audit.product_url ? new URL(audit.product_url).hostname.replace(/^www\./, '') : 'this brand'}).
        Want the raw bot text and structured-data inspector?{' '}
        <Link
          href={`/dashboard/audits/${audit.id}#ai_xray`}
          className="inline-flex items-center gap-1 font-semibold hover:underline"
          style={{ color: 'var(--ink)' }}
        >
          Open the full report <ExternalLink size={10} />
        </Link>
      </p>
    </div>
  );
}
