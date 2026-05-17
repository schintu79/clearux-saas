'use client';

/**
 * Intelligence — workspace view for the selected brand/site.
 *
 * Shows competitive benchmarks (your score vs. detected competitors)
 * and industry position. Lives at /dashboard/intelligence so the
 * Overview "Benchmarks" card stays inside the new workspace IA
 * instead of dumping users into the legacy audit detail screen.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Sparkles,
  ArrowRight,
  ExternalLink,
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
  score: number;
  pillarScores?: Array<{ name: string; score: number }>;
};

type BenchmarkPosition = {
  userScore?: number;
  deltaFromAvg?: number;
  benchmark?: { avgScore: number; sampleSize?: number };
  comparedAgainst?: string;
};

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

export default function IntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [benchmarkPosition, setBenchmarkPosition] = useState<BenchmarkPosition | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
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

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setCompetitors([]);
      setBenchmarkPosition(null);
      setIndustry(null);
      return;
    }
    const productUrl = audit.product_url;
    if (productUrl) {
      fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
        .then(r => r.json())
        .then(d => setCompetitors(d?.competitors || []))
        .catch(() => {});
    }
    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setBenchmarkPosition(d?.benchmarkPosition || null);
        setIndustry(d?.industry || null);
      })
      .catch(() => {});
  }, [bundle]);

  const runAutoDetect = () => {
    const productUrl = bundle?.audit?.product_url;
    if (!productUrl) return;
    setDetecting(true);
    fetch('/api/audits/detect-competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: productUrl, mode: 'auto' }),
    })
      .then(r => r.json())
      .then(d => setCompetitors(d?.competitors || []))
      .catch(() => {})
      .finally(() => setDetecting(false));
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
  const top = competitors.slice(0, 3);
  const avgCompetitor = top.length > 0 ? Math.round(top.reduce((s, c) => s + c.score, 0) / top.length) : null;
  const delta = avgCompetitor != null ? overallScore - avgCompetitor : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Intelligence
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          How this brand benchmarks against competitors and the broader industry.
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
          {/* Competitors */}
          <section className="rounded-xl p-5 mb-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-start gap-2">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
                >
                  <LineChart size={14} />
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
                    Competitors
                  </h2>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>
                    {top.length > 0
                      ? `Your score vs. ${top.length} competitor${top.length === 1 ? '' : 's'}.`
                      : 'Add competitor domains to compare.'}
                  </p>
                </div>
              </div>
              <div className="flex items-baseline gap-1 flex-shrink-0">
                <span className="text-[28px] font-bold leading-none tabular-nums" style={{ color: scoreColor(overallScore) }}>
                  {overallScore}
                </span>
                <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>/100 you</span>
              </div>
            </div>

            {detecting ? (
              <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                <Sparkles size={11} className="inline -mt-0.5 mr-1" /> Detecting competitors…
              </p>
            ) : top.length > 0 ? (
              <>
                {delta != null && (
                  <p className="text-[12px] mb-3" style={{ color: 'var(--ink)' }}>
                    You score{' '}
                    <span className="font-semibold" style={{ color: delta > 0 ? 'var(--ok)' : delta < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>{' '}
                    vs. competitor average ({avgCompetitor}/100).
                  </p>
                )}
                <ul className="space-y-2">
                  {top.map((c) => {
                    const cDelta = overallScore - c.score;
                    return (
                      <li key={c.domain} className="flex items-center gap-3 text-[12px]">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: 'var(--m-muted)', opacity: 0.5 }}
                        />
                        <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ink)' }} title={c.domain}>
                          {c.domain}
                        </span>
                        <span
                          className="h-1.5 rounded-full overflow-hidden flex-shrink-0"
                          style={{ width: 120, background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                        >
                          <span
                            className="block h-full"
                            style={{ width: `${c.score}%`, background: scoreColor(c.score) }}
                          />
                        </span>
                        <span className="tabular-nums font-semibold w-9 text-right" style={{ color: scoreColor(c.score) }}>
                          {c.score}
                        </span>
                        <span
                          className="tabular-nums text-[11px] w-10 text-right"
                          style={{
                            color: cDelta > 0 ? 'var(--ok)' : cDelta < 0 ? 'var(--severe)' : 'var(--m-muted)',
                          }}
                        >
                          {cDelta > 0 ? `+${cDelta}` : cDelta}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div>
                <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                  No competitors yet. We can auto-detect up to 3 based on your site&apos;s industry.
                </p>
                <button
                  type="button"
                  onClick={runAutoDetect}
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md hover:underline"
                  style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
                >
                  <Sparkles size={11} /> Auto-detect competitors
                </button>
              </div>
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
                <span className="font-semibold" style={{ color: scoreColor(benchmarkPosition.userScore ?? overallScore) }}>
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
