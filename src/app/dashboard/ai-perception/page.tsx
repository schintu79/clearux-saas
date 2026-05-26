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
  MessageSquare,
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

/** Normalise raw accuracy labels from the probe engine into user-friendly terms.
 *  "Fabricated", "Hallucinated", etc. → "Inaccurate"
 *  "Partially Accurate" → "Partial"
 */
function normalizeAccuracy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const a = raw.toLowerCase().trim();
  if (a.includes('accurate') && !a.includes('partial') && !a.includes('in')) return 'Accurate';
  if (a.includes('partial')) return 'Partial';
  // Everything else (inaccurate, fabricated, hallucinated, wrong, etc.)
  return 'Inaccurate';
}

function accuracyColor(accuracy: string | null | undefined): { bg: string; color: string } {
  const norm = normalizeAccuracy(accuracy);
  if (!norm) return { bg: 'var(--paper-2)', color: 'var(--m-muted)' };
  if (norm === 'Accurate') return { bg: 'rgba(34,197,94,0.1)', color: 'var(--ok)' };
  if (norm === 'Partial') return { bg: 'rgba(234,179,8,0.1)', color: 'var(--warn)' };
  return { bg: 'rgba(239,68,68,0.1)', color: 'var(--severe)' };
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
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
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

  // Group questions across models — each question shows all model answers side by side
  const questionGroups = useMemo(() => {
    const groups = new Map<string, Array<{ model_id: string; model_label: string; answer: string; accuracy: string | null }>>();
    for (const probe of modelProbes) {
      if (!probe.results_json) continue;
      for (const r of probe.results_json) {
        const key = r.question;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({
          model_id: probe.model_id,
          model_label: probe.model_label,
          answer: r.answer,
          accuracy: r.accuracy,
        });
      }
    }
    return Array.from(groups.entries()).map(([question, answers]) => ({ question, answers }));
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
    <div className="space-y-6">
      <PageHeader
        icon={<Bot size={18} strokeWidth={1.75} />}
        title="AI Perception"
        subtitle="How AI models see, describe, and rank your brand"
      />

      {/* ── New brand / low-history notice ── */}
      <div
        className="flex items-start gap-3 rounded-lg border px-4 py-3"
        style={{
          background: 'rgba(34,197,94,0.06)',
          borderColor: 'rgba(34,197,94,0.2)',
        }}
      >
        <Info size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ok)' }} />
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>
          <span className="font-semibold">New to the web?</span>{' '}
          AI models can read and understand your website content, but they may not
          confidently endorse your claims until independent sources corroborate them.
          This is normal for recently launched sites or brands with limited web history.
          Focus on fixing issues, building authoritative backlinks, and earning mentions —
          as your online footprint grows, AI confidence in your brand will follow.
        </p>
      </div>

      {/* ── Summary metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DashCard>
          <div className="flex items-center gap-4">
            <ScoreCircle score={overallAccuracy} size="small" px={56} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Accuracy</p>
              <p className="text-[15px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                {overallAccuracy != null ? `${overallAccuracy}%` : 'Not measured'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                {overallAccuracy != null ? 'of AI answers are correct' : 'Run an audit to measure'}
              </p>
            </div>
          </div>
        </DashCard>
        <DashCard>
          <div className="flex items-center gap-4">
            <ScoreCircle score={avgSentiment} size="small" px={56} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Sentiment</p>
              <p className="text-[15px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                {avgSentiment != null
                  ? avgSentiment >= 70 ? 'Positive' : avgSentiment >= 40 ? 'Neutral' : 'Negative'
                  : 'Not measured'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                {avgSentiment != null ? 'overall tone across models' : 'Run an audit to measure'}
              </p>
            </div>
          </div>
        </DashCard>
        <DashCard>
          <div className="flex items-center gap-4">
            <div
              className="w-[56px] h-[56px] rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--paper-2)', border: '3px solid var(--rule)' }}
            >
              <span className="text-[16px] font-bold tabular-nums" style={{ color: scoreColorVar(avgPlacement ? (100 - avgPlacement * 10) : null) }}>
                {avgPlacement != null ? `#${avgPlacement}` : '--'}
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Avg placement</p>
              <p className="text-[15px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
                {avgPlacement != null ? placementLabel(avgPlacement) : 'Not measured'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                {avgPlacement != null ? 'rank in AI model responses' : 'Run an audit to measure'}
              </p>
            </div>
          </div>
        </DashCard>
      </div>

      {/* ── Per-model summary row ── */}
      {modelProbes.length > 0 && (
        <DashCard>
          <h2 className="text-[15px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>Model overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {modelProbes.map(probe => {
              const badge = accuracyBadge(probe.accuracy_score);
              return (
                <div
                  key={probe.model_id}
                  className="flex items-center gap-3 rounded-lg px-3 py-3"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
                >
                  <AIProviderIcon provider={providerKeyToIcon(probe.model_id) ?? 'chatgpt'} size={22} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>{probe.model_label}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                        {probe.accuracy_score}% accuracy
                      </span>
                    </div>
                    <span
                      className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </DashCard>
      )}

      {/* ── Question-grouped responses ── */}
      {questionGroups.length > 0 && (
        <DashCard>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Questions and responses</h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            Each question was asked to every AI model. Compare their answers side by side.
          </p>

          <div className="space-y-2">
            {questionGroups.map((group, i) => {
              const expanded = expandedQuestion === i;
              // Count accuracy stats for this question
              const accurate = group.answers.filter(a => normalizeAccuracy(a.accuracy) === 'Accurate').length;
              const partial = group.answers.filter(a => normalizeAccuracy(a.accuracy) === 'Partial').length;
              const wrong = group.answers.length - accurate - partial;

              return (
                <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
                  <button
                    onClick={() => setExpandedQuestion(expanded ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{group.question}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {accurate > 0 && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--ok)' }}>
                          {accurate} accurate
                        </span>
                      )}
                      {partial > 0 && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--warn)' }}>
                          {partial} partial
                        </span>
                      )}
                      {wrong > 0 && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--severe)' }}>
                          {wrong} wrong
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        style={{ color: 'var(--m-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
                      />
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.answers.map((a) => {
                          const ac = accuracyColor(a.accuracy);
                          return (
                            <div
                              key={a.model_id}
                              className="rounded-lg p-4"
                              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <AIProviderIcon provider={providerKeyToIcon(a.model_id) ?? 'chatgpt'} size={16} />
                                  <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>{a.model_label}</span>
                                </div>
                                {a.accuracy && (
                                  <span
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{ background: ac.bg, color: ac.color }}
                                  >
                                    {normalizeAccuracy(a.accuracy)}
                                  </span>
                                )}
                              </div>
                              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                                {a.answer}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashCard>
      )}

      {/* ── Per-page AI readability ── */}
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
