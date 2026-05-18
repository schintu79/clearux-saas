'use client';

/**
 * AI X-Ray — per-question comparison card.
 *
 * Shows the top 3-5 typical user questions and what each AI model
 * (Claude / ChatGPT / Gemini / Perplexity) returned for them. The point
 * is to expose the *reason* behind a low AI X-Ray score: "Claude says X,
 * Gemini says I don't know, ChatGPT fabricates Y". A single visibility
 * score on its own doesn't explain why the brand is invisible — this
 * card does.
 *
 * Data comes from `multi_model_probes.results_json`, which is an array
 * of { question, answer, accuracy, accuracy_note } objects per model.
 * All models run the same question set; we union the questions across
 * probes and render one row per question, one column per model.
 */

import React, { useMemo } from 'react';
import { MessageSquareQuote, CheckCircle2, AlertTriangle, XCircle, HelpCircle, MinusCircle } from 'lucide-react';
import { AIProviderIcon, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import { AI_PLATFORMS, type ProviderKey } from '@/lib/ai-xray/provider-status';

type ProbeAccuracy =
  | 'accurate'
  | 'partial'
  | 'inaccurate'
  | 'hallucinated'
  | 'no_data'
  | string
  | null
  | undefined;

type ResultRow = {
  question?: string;
  answer?: string;
  accuracy?: ProbeAccuracy;
  accuracy_note?: string | null;
};

type ProbeForComparison = {
  model_id: string;
  model_label?: string | null;
  status?: 'measured' | 'skipped' | 'error' | null;
  error_message?: string | null;
  results_json?: ResultRow[] | null;
};

interface AIXRayComparisonProps {
  probes: ReadonlyArray<ProbeForComparison>;
  /** Max number of questions to render. Defaults to 5. */
  topN?: number;
}

const ACCURACY_META: Record<string, { label: string; tone: string; icon: React.ElementType }> = {
  accurate:     { label: 'Accurate',    tone: '--ok',       icon: CheckCircle2 },
  partial:      { label: 'Partial',     tone: '--warn',     icon: AlertTriangle },
  inaccurate:   { label: 'Inaccurate',  tone: '--severe',   icon: XCircle },
  hallucinated: { label: 'Fabricated',  tone: '--severe',   icon: XCircle },
  no_data:      { label: 'No data',     tone: '--m-muted',  icon: MinusCircle },
};

function accuracyMeta(a: ProbeAccuracy) {
  if (typeof a === 'string' && ACCURACY_META[a]) return ACCURACY_META[a];
  return { label: 'Pending', tone: '--m-muted', icon: HelpCircle };
}

function normalizeQuestion(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[?.!]+$/g, '');
}

/** Short excerpt of a model answer for the comparison cell. */
function answerExcerpt(answer: string | undefined, maxLen = 220): string {
  if (!answer) return '';
  const trimmed = answer.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

export function AIXRayComparison({ probes, topN = 5 }: AIXRayComparisonProps) {
  // 1) Order the models to match AI_PLATFORMS, but only keep ones present
  //    in the probe set so we don't render empty columns for providers
  //    that were never measured for this audit.
  const orderedProbes = useMemo(() => {
    const byId = new Map<string, ProbeForComparison>();
    for (const p of probes) byId.set(p.model_id, p);
    return AI_PLATFORMS
      .map((pl) => ({ platform: pl, probe: byId.get(pl.key) || null }))
      .filter((row) => row.probe != null) as Array<{
        platform: typeof AI_PLATFORMS[number];
        probe: ProbeForComparison;
      }>;
  }, [probes]);

  // 2) Union questions across all probes, preserving the order from the
  //    first probe that mentions each question. Same question phrasing
  //    sometimes varies slightly across providers; we de-duplicate by a
  //    normalized form but keep the first-seen original for display.
  const topQuestions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of probes) {
      const rows = Array.isArray(p.results_json) ? p.results_json : [];
      for (const r of rows) {
        const q = typeof r?.question === 'string' ? r.question.trim() : '';
        if (!q) continue;
        const key = normalizeQuestion(q);
        if (!seen.has(key)) seen.set(key, q);
        if (seen.size >= topN) break;
      }
      if (seen.size >= topN) break;
    }
    return Array.from(seen.entries()).slice(0, topN);
  }, [probes, topN]);

  // 3) Pre-index each probe's results by normalized question so per-cell
  //    lookup is O(1).
  const resultsByProbe = useMemo(() => {
    const map = new Map<string, Map<string, ResultRow>>();
    for (const p of probes) {
      const inner = new Map<string, ResultRow>();
      const rows = Array.isArray(p.results_json) ? p.results_json : [];
      for (const r of rows) {
        const q = typeof r?.question === 'string' ? r.question.trim() : '';
        if (!q) continue;
        inner.set(normalizeQuestion(q), r);
      }
      map.set(p.model_id, inner);
    }
    return map;
  }, [probes]);

  if (orderedProbes.length === 0 || topQuestions.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-xl overflow-hidden mb-4"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-label="AI X-Ray model comparison by question"
    >
      <div className="px-5 py-4 flex items-start gap-2.5" style={{ borderBottom: '1px solid var(--rule)' }}>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
        >
          <MessageSquareQuote size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>
            What each AI says about your brand
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            Top {topQuestions.length} question{topQuestions.length === 1 ? '' : 's'} a user might ask · {orderedProbes.length} model{orderedProbes.length === 1 ? '' : 's'} compared
          </p>
        </div>
      </div>

      <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
        {topQuestions.map(([key, question]) => (
          <li key={key} className="px-5 py-4">
            <p className="text-[13px] font-semibold mb-3 leading-snug" style={{ color: 'var(--ink)' }}>
              {question}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {orderedProbes.map(({ platform, probe }) => {
                const inner = resultsByProbe.get(probe.model_id);
                const result = inner?.get(key) || null;
                const status = probe.status ?? 'measured';
                const iconKey = providerKeyToIcon(platform.key as ProviderKey);
                const meta = result ? accuracyMeta(result.accuracy) : null;
                const StatusIcon = meta?.icon || HelpCircle;
                const tone = meta?.tone || '--m-muted';

                return (
                  <div
                    key={`${probe.model_id}-${key}`}
                    className="rounded-lg p-3 flex flex-col gap-2"
                    style={{
                      background: 'var(--paper)',
                      border: '1px solid color-mix(in srgb, var(--rule) 60%, transparent)',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded overflow-hidden flex-shrink-0"
                        style={{
                          background: 'var(--paper)',
                          border: '1px solid color-mix(in srgb, var(--rule) 60%, transparent)',
                        }}
                        aria-hidden
                      >
                        {iconKey ? <AIProviderIcon provider={iconKey} size={18} /> : null}
                      </span>
                      <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                        {probe.model_label || platform.label}
                      </span>
                      {meta && (
                        <span
                          className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{
                            color: `var(${tone})`,
                            background: `color-mix(in srgb, var(${tone}) 10%, transparent)`,
                          }}
                        >
                          <StatusIcon size={9} />
                          {meta.label}
                        </span>
                      )}
                    </div>

                    {result ? (
                      <>
                        <p
                          className="text-[11px] leading-relaxed"
                          style={{ color: 'var(--ink)' }}
                        >
                          {answerExcerpt(result.answer) || (
                            <span style={{ color: 'var(--m-muted)' }}>
                              No answer recorded.
                            </span>
                          )}
                        </p>
                        {result.accuracy_note && (
                          <p
                            className="text-[10.5px] leading-snug pt-1.5 border-t"
                            style={{
                              color: 'var(--m-muted)',
                              borderColor: 'color-mix(in srgb, var(--rule) 50%, transparent)',
                            }}
                          >
                            <span className="font-semibold" style={{ color: 'var(--ink)' }}>Why: </span>
                            {result.accuracy_note}
                          </p>
                        )}
                      </>
                    ) : status === 'error' ? (
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--severe)' }}>
                        Probe failed for this model — re-scan to retry.
                      </p>
                    ) : status === 'skipped' ? (
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--m-muted)' }}>
                        Provider not configured in this environment.
                      </p>
                    ) : (
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--m-muted)' }}>
                        Not asked.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AIXRayComparison;
