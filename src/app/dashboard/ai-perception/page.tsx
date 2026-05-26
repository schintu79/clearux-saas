'use client';

/**
 * AI Perception — how AI models see, understand, and represent the brand.
 *
 * Surfaces two layers:
 *  1) Multi-model AI probes — what ChatGPT, Claude, Gemini, Perplexity say
 *     about the brand (accuracy, sentiment, placement).
 *  2) Per-page AI readability — what AI crawlers can extract from each page
 *     (structured data, extractable signals, missing signals).
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Brain,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Info,
  Globe,
  Eye,
  FileText,
  Code,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import ScoreCircle from '@/components/ui/ScoreCircle';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import { AIProviderIcon, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import {
  buildProviderRows,
  summarizeCoverage,
  coverageCaption,
} from '@/lib/ai-xray/provider-status';
import type { LatestAuditBundle } from '@/lib/dashboard/latest-audit';
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence';

/* ── Types ─────────────────────────────────────────── */

type ModelProbe = {
  model_id: string;
  model_label: string;
  accuracy_score: number;
  results_json?: Array<{ question: string; answer: string; accuracy: string | null }>;
  sentiment_score?: number | null;
  sentiment_themes?: Array<{ theme: string; polarity: string; count: number }>;
  placement_score?: number | null;
  status?: 'measured' | 'skipped' | 'error' | null;
};

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

/* ── Helpers ────────────────────────────────────────── */

function scoreColorVar(s: number | null | undefined): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function accuracyBadge(score: number): { label: string; bg: string; color: string } {
  if (score >= 80) return { label: 'Accurate', bg: 'rgba(34,197,94,0.1)', color: 'var(--ok)' };
  if (score >= 50) return { label: 'Partial', bg: 'rgba(234,179,8,0.1)', color: 'var(--warn)' };
  return { label: 'Inaccurate', bg: 'rgba(239,68,68,0.1)', color: 'var(--severe)' };
}

function placementLabel(p: number | null | undefined): string {
  if (p == null) return '--';
  if (p <= 1.5) return `#${p.toFixed(1)} — Top result`;
  if (p <= 3) return `#${p.toFixed(1)} — Featured`;
  if (p <= 5) return `#${p.toFixed(1)} — Mentioned`;
  return `#${p.toFixed(1)} — Low visibility`;
}

function readabilityStatusColor(status: string | undefined): string {
  if (status === 'green') return 'var(--ok)';
  if (status === 'amber') return 'var(--warn)';
  return 'var(--severe)';
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

export default function AIPerceptionPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || bundleLoading || !ready;

  const [modelProbes, setModelProbes] = useState<ModelProbe[]>([]);
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
  const [pages, setPages] = useState<AuditPageRow[]>([]);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setModelProbes([]); setBiSummary(null); setPages([]);
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
        if (d?.modelProbes) setModelProbes(d.modelProbes);
      })
      .catch(() => {});

    // Load page-level AI readability from audit findings
    if (audit?.id) {
      fetch(`/api/audits/pages?audit_id=${audit.id}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d?.pages) return;
          setPages(
            (d.pages as any[])
              .filter((p: any) => p.ai_readability)
              .map((p: any) => ({
                id: p.id,
                url: p.url,
                title: p.title || null,
                ai_readability: p.ai_readability,
              }))
          );
        })
        .catch(() => {});
    }
  }, [bundle]);

  const overallAccuracy = useMemo(() => {
    const measured = modelProbes.filter(p => p.status === 'measured' && p.accuracy_score != null);
    if (measured.length === 0) return null;
    return Math.round(measured.reduce((s, p) => s + p.accuracy_score, 0) / measured.length);
  }, [modelProbes]);

  const avgSentiment = useMemo(() => {
    const valid = modelProbes.filter(p => p.sentiment_score != null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, p) => s + (p.sentiment_score || 0), 0) / valid.length);
  }, [modelProbes]);

  const avgPlacement = useMemo(() => {
    const valid = modelProbes.filter(p => p.placement_score != null);
    if (valid.length === 0) return null;
    return +(valid.reduce((s, p) => s + (p.placement_score || 0), 0) / valid.length).toFixed(1);
  }, [modelProbes]);

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
        icon={<Bot size={18} strokeWidth={1.75} />}
        title="AI Perception"
        subtitle="How AI models see, describe, and rank your brand"
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashCard>
          <div className="flex items-center gap-3">
            <ScoreCircle score={overallAccuracy} size="small" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Accuracy</p>
              <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--ink)' }}>
                {overallAccuracy != null ? `${overallAccuracy}% correct` : 'Not yet measured'}
              </p>
            </div>
          </div>
        </DashCard>
        <DashCard>
          <div className="flex items-center gap-3">
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: 'var(--paper-2)', border: '2px solid var(--rule)' }}>
              <span className="text-[16px] font-bold tabular-nums" style={{ color: scoreColorVar(avgSentiment) }}>{avgSentiment ?? '--'}</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Sentiment</p>
              <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--ink)' }}>
                {avgSentiment != null
                  ? avgSentiment >= 70 ? 'Positive' : avgSentiment >= 40 ? 'Neutral' : 'Negative'
                  : 'Not measured'}
              </p>
            </div>
          </div>
        </DashCard>
        <DashCard>
          <div className="flex items-center gap-3">
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ background: 'var(--paper-2)', border: '2px solid var(--rule)' }}>
              <span className="text-[16px] font-bold tabular-nums" style={{ color: scoreColorVar(avgPlacement ? (100 - avgPlacement * 10) : null) }}>
                {avgPlacement != null ? `#${avgPlacement}` : '--'}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Avg placement</p>
              <p className="text-[13px] font-medium mt-0.5" style={{ color: 'var(--ink)' }}>
                {avgPlacement != null ? placementLabel(avgPlacement) : 'Not measured'}
              </p>
            </div>
          </div>
        </DashCard>
      </div>

      {/* Per-model probes */}
      <DashCard>
        <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>AI model responses</h2>
        <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>What each AI model says about your brand when asked directly</p>

        {modelProbes.length === 0 ? (
          <div className="text-center py-8">
            <Bot size={28} strokeWidth={1.5} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-3" />
            <p className="text-[13px]" style={{ color: 'var(--m-muted)' }}>No AI model probes available yet. Run an audit to generate them.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {modelProbes.map(probe => {
              const badge = accuracyBadge(probe.accuracy_score);
              const expanded = expandedModel === probe.model_id;
              return (
                <div key={probe.model_id} className="rounded-lg" style={{ border: '1px solid var(--rule)' }}>
                  <button
                    onClick={() => setExpandedModel(expanded ? null : probe.model_id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
                  >
                    <AIProviderIcon provider={providerKeyToIcon(probe.model_id) ?? 'chatgpt'} size={20} />
                    <span className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{probe.model_label}</span>
                    </span>
                    <span className="text-[12px] px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
                      {probe.accuracy_score}% {badge.label}
                    </span>
                    {probe.sentiment_score != null && (
                      <span className="text-[12px] font-medium tabular-nums" style={{ color: scoreColorVar(probe.sentiment_score) }}>
                        {probe.sentiment_score}% sent.
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      style={{ color: 'var(--m-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                    />
                  </button>
                  {expanded && probe.results_json && (
                    <div className="px-4 pb-4 space-y-2">
                      {probe.results_json.map((r, i) => (
                        <div key={i} className="rounded-md p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                          <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>{r.question}</p>
                          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{r.answer}</p>
                          {r.accuracy && (
                            <span
                              className="inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded"
                              style={{
                                background: r.accuracy === 'Accurate' ? 'rgba(34,197,94,0.1)' : r.accuracy === 'Partially Accurate' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
                                color: r.accuracy === 'Accurate' ? 'var(--ok)' : r.accuracy === 'Partially Accurate' ? 'var(--warn)' : 'var(--severe)',
                              }}
                            >
                              {r.accuracy}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashCard>

      {/* Per-page AI readability */}
      {pages.length > 0 && (
        <DashCard>
          <h2 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Page-level AI readability</h2>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>What AI crawlers can extract from each audited page</p>

          <div className="space-y-1">
            {pages.map(page => {
              const ar = page.ai_readability;
              const expanded = expandedPage === page.url;
              return (
                <div key={page.url} className="rounded-lg" style={{ border: '1px solid var(--rule)' }}>
                  <button
                    onClick={() => setExpandedPage(expanded ? null : page.url)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.02]"
                  >
                    <Globe size={14} style={{ color: 'var(--m-muted)' }} />
                    <span className="flex-1 min-w-0 text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {page.title || page.url}
                    </span>
                    {ar?.overallScore != null && (
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: scoreColorVar(ar.overallScore) }}>
                        {ar.overallScore}/100
                      </span>
                    )}
                    {ar?.status && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: readabilityStatusColor(ar.status) }} />
                    )}
                    <ChevronDown
                      size={14}
                      style={{ color: 'var(--m-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                    />
                  </button>
                  {expanded && ar && (
                    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ar.extractable && ar.extractable.length > 0 && (
                        <div className="rounded-md p-3" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid var(--rule)' }}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ok)' }}>
                            <CheckCircle2 size={11} className="inline mr-1" />
                            Extractable signals
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ar.extractable.map(s => (
                              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--rule)' }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {ar.missing && ar.missing.length > 0 && (
                        <div className="rounded-md p-3" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid var(--rule)' }}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--severe)' }}>
                            <AlertTriangle size={11} className="inline mr-1" />
                            Missing signals
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ar.missing.map(s => (
                              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {ar.structuredDataTypes && ar.structuredDataTypes.length > 0 && (
                        <div className="rounded-md p-3 sm:col-span-2" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--m-muted)' }}>
                            <Code size={11} className="inline mr-1" />
                            Structured data found
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {ar.structuredDataTypes.map(s => (
                              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--ok)' }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashCard>
      )}
    </div>
  );
}
