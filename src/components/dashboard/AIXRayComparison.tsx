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

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareQuote, CheckCircle2, AlertTriangle, XCircle, HelpCircle, MinusCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';
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

/** Tooltip microcopy for each claim-state — what it means, why, what it doesn't mean, how to fix */
const ACCURACY_TOOLTIP: Record<string, { meaning: string; why: string; notMean: string; fix: string }> = {
  accurate: {
    meaning: 'The AI answer matches your actual site content.',
    why: 'Your site has clear, well-structured content that AI models can read and reproduce correctly.',
    notMean: 'This does not mean AI will always get it right — models update their knowledge periodically.',
    fix: 'Keep content current and well-structured to maintain accuracy.',
  },
  partial: {
    meaning: 'The AI answer is partly right but incomplete or slightly off.',
    why: 'Your site has some relevant content, but it may be fragmented, buried in subpages, or missing key details.',
    notMean: 'This does not mean the AI is broken — it means your content could be clearer or more prominent.',
    fix: 'Add explicit, complete answers to your homepage and key pages. Use structured data (JSON-LD) so AI has a single authoritative source.',
  },
  inaccurate: {
    meaning: 'The AI answer conflicts with what your site actually says.',
    why: 'The AI model has outdated info, confused your brand with something else, or your site lacks clear signals about this topic.',
    notMean: 'This does not mean the AI failed to visit your website — AI models learn from training data, not live browsing.',
    fix: 'Update your meta descriptions, page content, and structured data to clearly state the correct answer. Changes take 2-4 weeks to propagate.',
  },
  hallucinated: {
    meaning: 'The AI provided specific details we could not verify from your site.',
    why: 'The model may have inferred or fabricated details because your site lacks explicit content about this topic.',
    notMean: 'This does not mean the information is necessarily wrong — only that we could not confirm it from your crawled pages.',
    fix: 'Add explicit, factual content that directly answers this question. Structured data and an llms.txt file give AI a verifiable source.',
  },
  no_data: {
    meaning: 'The AI had no information to offer about this topic.',
    why: 'Your site may be new, niche, or the content for this topic is missing or hidden behind JavaScript rendering.',
    notMean: 'This does not mean your site is invisible to AI — it means this specific topic has no coverage yet.',
    fix: 'Add dedicated content for this topic on a crawlable page. Ensure critical text is in the HTML, not loaded via JS.',
  },
};

const ACCURACY_META: Record<string, { label: string; tone: string; icon: React.ElementType }> = {
  accurate:     { label: 'Accurate',    tone: '--ok',       icon: CheckCircle2 },
  partial:      { label: 'Partial',     tone: '--warn',     icon: AlertTriangle },
  inaccurate:   { label: 'Incorrect',   tone: '--severe',   icon: XCircle },
  // "Unverified" reads fairer than "Fabricated" when the underlying signal
  // is "the model produced an answer we could not verify" — only call it
  // out as Incorrect if the audit was able to prove it wrong.
  hallucinated: { label: 'Unverified',  tone: '--warn',     icon: AlertTriangle },
  no_data:      { label: 'No data',     tone: '--m-muted',  icon: MinusCircle },
};

/** Floating tooltip for accuracy badges — portal-based to escape overflow-hidden */
function AccuracyTooltip({ accuracyKey, children }: { accuracyKey: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const tip = ACCURACY_TOOLTIP[accuracyKey];
  if (!tip) return <>{children}</>;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + window.scrollY - 8,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
  }, [open]);

  return (
    <div
      ref={anchorRef}
      className="inline-flex items-center gap-1"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <Info size={10} className="opacity-40 flex-shrink-0 cursor-help" style={{ color: 'var(--ink)' }} />
      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] w-[280px] rounded-lg shadow-lg p-3 text-left pointer-events-none"
          style={{
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            background: 'var(--card)',
            border: '1px solid var(--rule)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          <p className="text-[11px] font-semibold leading-snug mb-1.5" style={{ color: 'var(--ink)' }}>
            {tip.meaning}
          </p>
          <p className="text-[10px] leading-relaxed mb-1" style={{ color: 'var(--m-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>Why:</span> {tip.why}
          </p>
          <p className="text-[10px] leading-relaxed mb-1" style={{ color: 'var(--m-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>Note:</span> {tip.notMean}
          </p>
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
            <span className="font-semibold" style={{ color: 'var(--ok)' }}>Fix:</span> {tip.fix}
          </p>
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 -mt-1"
            style={{ background: 'var(--card)', borderRight: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

function accuracyMeta(a: ProbeAccuracy) {
  if (typeof a === 'string' && ACCURACY_META[a]) return ACCURACY_META[a];
  return { label: 'Pending', tone: '--m-muted', icon: HelpCircle };
}

function normalizeQuestion(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[?.!]+$/g, '');
}

const EXCERPT_LEN = 220;

/** Short excerpt of a model answer for the collapsed comparison cell. */
function answerExcerpt(answer: string | undefined, maxLen = EXCERPT_LEN): string {
  if (!answer) return '';
  const trimmed = answer.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

function ProbeAnswerBody({ answer, note }: { answer: string; note: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = (answer || '').trim().replace(/\s+/g, ' ');
  const canExpand = trimmed.length > EXCERPT_LEN || (note && note.length > 120);
  return (
    <>
      <p
        className="text-[11px] leading-relaxed whitespace-pre-wrap"
        style={{ color: 'var(--ink)' }}
      >
        {expanded ? trimmed : answerExcerpt(trimmed)}
      </p>
      {note && (
        <p
          className="text-[10.5px] leading-snug pt-1.5 border-t"
          style={{
            color: 'var(--m-muted)',
            borderColor: 'color-mix(in srgb, var(--rule) 50%, transparent)',
          }}
        >
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>Why: </span>
          {note}
        </p>
      )}
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold mt-0.5 hover:underline"
          style={{ color: 'var(--ink)' }}
          aria-expanded={expanded}
        >
          {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show full answer</>}
        </button>
      )}
    </>
  );
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
                        <AccuracyTooltip accuracyKey={typeof result?.accuracy === 'string' ? result.accuracy : ''}>
                          <span
                            className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded flex-shrink-0 cursor-help"
                            style={{
                              color: `var(${tone})`,
                              background: `color-mix(in srgb, var(${tone}) 10%, transparent)`,
                            }}
                          >
                            <StatusIcon size={9} />
                            {meta.label}
                          </span>
                        </AccuracyTooltip>
                      )}
                    </div>

                    {result ? (
                      result.answer ? (
                        <ProbeAnswerBody
                          answer={result.answer}
                          note={result.accuracy_note || null}
                        />
                      ) : (
                        <p className="text-[11px] leading-snug" style={{ color: 'var(--m-muted)' }}>
                          No answer recorded.
                          {result.accuracy_note ? <><br /><span className="font-semibold" style={{ color: 'var(--ink)' }}>Why: </span>{result.accuracy_note}</> : null}
                        </p>
                      )
                    ) : status === 'error' ? (
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--severe)' }}>
                        {probe.error_message
                          ? <>Probe failed: {probe.error_message}</>
                          : <>Probe failed for this model — re-scan to retry.</>}
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

export { ACCURACY_TOOLTIP, AccuracyTooltip };
export default AIXRayComparison;
