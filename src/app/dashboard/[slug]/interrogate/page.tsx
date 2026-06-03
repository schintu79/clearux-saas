'use client';

/**
 * AI Interrogation — guided module for testing how AI models perceive a brand.
 *
 * Replaces the old "What AI models say about you" section on Brand Intelligence.
 * Users choose a question, pick up to 3 models, run the check, and compare
 * responses side-by-side with extracted themes and latency data.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  AIProviderIcon,
  PROVIDER_LABEL,
  PROVIDER_SUBTITLE,
  providerKeyToIcon,
  type AIProvider,
} from '@/components/ui/AIProviderIcon';

/* ── Types ──────────────────────────────────────────────────── */

type QuestionFamily = string;

interface RankedQuestion {
  questionId: string;
  questionText: string;
  family: QuestionFamily;
  relevanceScore: number;
  rankReason: string;
}

interface ModelResult {
  modelSlug: string;
  modelShortId: string;
  modelDisplayName: string;
  status: 'completed' | 'running' | 'failed';
  responseText: string | null;
  themes: string[];
  latencyMs: number | null;
  error: string | null;
}

interface Followup {
  questionText: string;
  family: QuestionFamily;
}

interface Usage {
  checksUsed: number;
  checksLimit: number;
  checksRemaining: number;
  canInterrogate: boolean;
}

interface PastInterrogation {
  interrogation: {
    id: string;
    question_text: string;
    question_family: string;
    status: string;
    created_at: string;
    selected_models: string[];
  };
  results: Array<{
    id: string;
    model_slug: string;
    model_short_id: string;
    model_display_name: string;
    status: string;
    response_text: string | null;
    themes: string[] | null;
    latency_ms: number | null;
    error_message: string | null;
  }>;
}

/* ── Constants ──────────────────────────────────────────────── */

const MODEL_DISPLAY: { shortId: string; slug: string }[] = [
  { shortId: 'chatgpt', slug: 'openai/gpt-4o-mini' },
  { shortId: 'gemini', slug: 'google/gemini-2.5-flash' },
  { shortId: 'perplexity', slug: 'perplexity/sonar' },
  { shortId: 'grok', slug: 'x-ai/grok-4.3' },
  { shortId: 'meta', slug: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { shortId: 'deepseek', slug: 'deepseek/deepseek-chat-v3-0324' },
];

const FAMILY_COLORS: Record<string, string> = {
  general_discovery: '#6366F1',
  trust_credibility: '#10B981',
  differentiation: '#F59E0B',
  quality_perception: '#3B82F6',
  pricing_value: '#EF4444',
  booking_buying_readiness: '#8B5CF6',
  local_relevance: '#14B8A6',
  service_clarity: '#F97316',
  reputation_social_proof: '#EC4899',
  premium_budget_perception: '#A855F7',
  audience_fit: '#06B6D4',
  brand_tone_personality: '#84CC16',
};

function familyLabel(family: string): string {
  return family
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const MAX_MODELS = 3;
const INITIAL_QUESTIONS = 3;

/* ── Skeleton helpers ───────────────────────────────────────── */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: 'var(--paper-2)' }}
    />
  );
}

/* ── Main component ─────────────────────────────────────────── */

export default function AIInterrogationPage() {
  const { workspace, workspaceId, loading: wsLoading } = useWorkspace();

  /* ── State ────────────────────────────────────────────────── */
  const [questions, setQuestions] = useState<RankedQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const [usage, setUsage] = useState<Usage | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);

  const [pastInterrogations, setPastInterrogations] = useState<PastInterrogation[]>([]);
  const [pastLoading, setPastLoading] = useState(true);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);

  const modelSectionRef = useRef<HTMLDivElement>(null);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  /* ── Derived ──────────────────────────────────────────────── */
  const selectedQuestion = useMemo(
    () => questions.find((q) => q.questionId === selectedQuestionId) ?? null,
    [questions, selectedQuestionId],
  );

  const visibleQuestions = showAllQuestions
    ? questions
    : questions.slice(0, INITIAL_QUESTIONS);

  const canRun =
    selectedQuestion !== null &&
    selectedModels.length > 0 &&
    !isRunning &&
    (usage?.canInterrogate ?? false);

  /* ── Data fetching ────────────────────────────────────────── */
  const fetchQuestions = useCallback(async () => {
    if (!workspaceId) return;
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const res = await fetch(
        `/api/ai-interrogation/questions?workspace_id=${workspaceId}`,
      );
      if (!res.ok) throw new Error('Failed to load questions');
      const data = await res.json();
      setQuestions(data.questions ?? []);
    } catch {
      setQuestionsError('Could not load questions. Please try again.');
    } finally {
      setQuestionsLoading(false);
    }
  }, [workspaceId]);

  const fetchUsage = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(
        `/api/ai-interrogation/usage?workspace_id=${workspaceId}`,
      );
      if (!res.ok) return;
      setUsage(await res.json());
    } catch {
      /* silent */
    }
  }, [workspaceId]);

  const fetchPast = useCallback(async () => {
    if (!workspaceId) return;
    setPastLoading(true);
    try {
      const res = await fetch(
        `/api/ai-interrogation/run?workspace_id=${workspaceId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setPastInterrogations(data.interrogations ?? []);
    } catch {
      /* silent */
    } finally {
      setPastLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    fetchQuestions();
    fetchUsage();
    fetchPast();
  }, [workspaceId, fetchQuestions, fetchUsage, fetchPast]);

  /* ── Scroll helpers ───────────────────────────────────────── */
  useEffect(() => {
    if (selectedQuestionId && modelSectionRef.current) {
      modelSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedQuestionId]);

  useEffect(() => {
    if (results.length > 0 && resultsSectionRef.current) {
      resultsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [results.length]);

  /* ── Run interrogation ────────────────────────────────────── */
  const handleRun = async () => {
    if (!canRun || !selectedQuestion || !workspaceId) return;
    setIsRunning(true);
    setRunError(null);
    setResults([]);
    setFollowups([]);

    // Optimistic: show running state per model
    const pendingResults: ModelResult[] = selectedModels.map((slug) => {
      const shortId = MODEL_DISPLAY.find((m) => m.slug === slug)?.shortId ?? slug;
      const provider = providerKeyToIcon(shortId);
      return {
        modelSlug: slug,
        modelShortId: shortId,
        modelDisplayName: provider ? PROVIDER_LABEL[provider] : shortId,
        status: 'running',
        responseText: null,
        themes: [],
        latencyMs: null,
        error: null,
      };
    });
    setResults(pendingResults);

    try {
      const res = await fetch('/api/ai-interrogation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          question_id: selectedQuestion.questionId,
          question_text: selectedQuestion.questionText,
          question_family: selectedQuestion.family,
          selected_models: selectedModels,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Request failed');
      }

      const data = await res.json();

      // Map API results onto our display type
      const mapped: ModelResult[] = (data.results ?? []).map((r: any) => ({
        modelSlug: r.modelSlug ?? r.model_slug ?? '',
        modelShortId: r.modelShortId ?? r.model_short_id ?? '',
        modelDisplayName: r.modelDisplayName ?? r.model_display_name ?? '',
        status: r.status ?? 'completed',
        responseText: r.responseText ?? r.response_text ?? null,
        themes: r.themes ?? [],
        latencyMs: r.latencyMs ?? r.latency_ms ?? null,
        error: r.error ?? r.error_message ?? null,
      }));

      setResults(mapped);
      setFollowups(data.followups ?? []);

      // Refresh usage + past list
      fetchUsage();
      fetchPast();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Something went wrong');
      setResults([]);
    } finally {
      setIsRunning(false);
    }
  };

  /* ── Retry single model (re-runs entire interrogation) ────── */
  const handleRetryFailed = async (failedSlug: string) => {
    if (!selectedQuestion || !workspaceId) return;
    setIsRunning(true);
    setRunError(null);

    // Mark only the failed model as running
    setResults((prev) =>
      prev.map((r) =>
        r.modelSlug === failedSlug ? { ...r, status: 'running' as const, error: null } : r,
      ),
    );

    try {
      const res = await fetch('/api/ai-interrogation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          question_id: selectedQuestion.questionId,
          question_text: selectedQuestion.questionText,
          question_family: selectedQuestion.family,
          selected_models: [failedSlug],
        }),
      });

      if (!res.ok) throw new Error('Retry failed');
      const data = await res.json();
      const retried = (data.results ?? [])[0];

      if (retried) {
        setResults((prev) =>
          prev.map((r) =>
            r.modelSlug === failedSlug
              ? {
                  ...r,
                  status: retried.status ?? 'completed',
                  responseText: retried.responseText ?? retried.response_text ?? null,
                  themes: retried.themes ?? [],
                  latencyMs: retried.latencyMs ?? retried.latency_ms ?? null,
                  error: retried.error ?? retried.error_message ?? null,
                }
              : r,
          ),
        );
      }
      fetchUsage();
    } catch {
      setResults((prev) =>
        prev.map((r) =>
          r.modelSlug === failedSlug
            ? { ...r, status: 'failed' as const, error: 'Retry failed' }
            : r,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  };

  /* ── Follow-up click ──────────────────────────────────────── */
  const handleFollowup = (f: Followup) => {
    const match = questions.find(
      (q) => q.questionText === f.questionText || q.family === f.family,
    );
    if (match) {
      setSelectedQuestionId(match.questionId);
    }
    setResults([]);
    setFollowups([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Loading / workspace resolution ───────────────────────── */
  if (wsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2
          size={20}
          className="animate-spin"
          style={{ color: 'var(--m-muted)' }}
        />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-[14px]" style={{ color: 'var(--m-muted)' }}>
          Workspace not found.
        </p>
      </div>
    );
  }

  /* ── No subscription guard ────────────────────────────────── */
  if (usage && !usage.canInterrogate && usage.checksLimit === 0) {
    return (
      <div className="space-y-6">
        <PageHeaderBlock usage={null} />
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--paper)', border: '1px solid var(--m-border)' }}
        >
          <Sparkles
            size={28}
            strokeWidth={1.5}
            className="mx-auto mb-3"
            style={{ color: 'var(--m-muted)' }}
          />
          <h2
            className="text-[16px] font-semibold mb-1"
            style={{ color: 'var(--ink)' }}
          >
            Upgrade to unlock AI interrogation
          </h2>
          <p
            className="text-[14px] max-w-md mx-auto"
            style={{ color: 'var(--ink-2)' }}
          >
            AI interrogation lets you test how leading AI models perceive and
            describe your business. Upgrade your plan to get started.
          </p>
        </div>
      </div>
    );
  }

  /* ── Main render ──────────────────────────────────────────── */
  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <PageHeaderBlock usage={usage} />

      {/* 2. Question selector */}
      <section>
        <h2
          className="text-[16px] font-semibold mb-3"
          style={{ color: 'var(--ink)' }}
        >
          Choose a question
        </h2>

        {questionsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: INITIAL_QUESTIONS }).map((_, i) => (
              <Skeleton key={i} className="h-[62px] w-full" />
            ))}
          </div>
        ) : questionsError ? (
          <div
            className="rounded-xl px-5 py-4 flex items-center gap-3"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--m-border)',
            }}
          >
            <XCircle size={16} style={{ color: 'var(--severe)' }} />
            <p className="text-[14px]" style={{ color: 'var(--ink)' }}>
              {questionsError}
            </p>
            <button
              onClick={fetchQuestions}
              className="ml-auto text-[13px] font-medium underline"
              style={{ color: 'var(--ink-2)' }}
            >
              Retry
            </button>
          </div>
        ) : questions.length === 0 ? (
          <div
            className="rounded-xl px-5 py-8 text-center"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--m-border)',
            }}
          >
            <Loader2
              size={18}
              className="animate-spin mx-auto mb-2"
              style={{ color: 'var(--m-muted)' }}
            />
            <p className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
              Preparing questions tailored to your business...
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleQuestions.map((q) => {
                const selected = selectedQuestionId === q.questionId;
                const familyColor =
                  FAMILY_COLORS[q.family] ?? 'var(--m-muted)';
                return (
                  <button
                    key={q.questionId}
                    onClick={() => {
                      setSelectedQuestionId(selected ? null : q.questionId);
                      if (!selected) {
                        setResults([]);
                        setFollowups([]);
                        setRunError(null);
                      }
                    }}
                    className="w-full text-left rounded-xl px-5 py-4 transition-all"
                    style={{
                      background: 'var(--paper)',
                      border: selected
                        ? '2px solid var(--ink)'
                        : '1px solid var(--m-border)',
                      padding: selected ? '15px 19px' : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors"
                        style={{
                          borderColor: selected
                            ? 'var(--ink)'
                            : 'var(--m-border)',
                          background: selected
                            ? 'var(--ink)'
                            : 'transparent',
                        }}
                      >
                        {selected && (
                          <Check size={10} strokeWidth={3} color="var(--paper)" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[14px] leading-snug"
                          style={{ color: 'var(--ink)' }}
                        >
                          {q.questionText}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: `${familyColor}15`,
                              color: familyColor,
                            }}
                          >
                            {familyLabel(q.family)}
                          </span>
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background:
                                q.relevanceScore >= 0.8
                                  ? 'var(--ok)'
                                  : q.relevanceScore >= 0.5
                                    ? 'var(--warn)'
                                    : 'var(--m-muted)',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {questions.length > INITIAL_QUESTIONS && (
              <button
                onClick={() => setShowAllQuestions((v) => !v)}
                className="flex items-center gap-1.5 mt-3 text-[13px] font-medium transition-colors"
                style={{ color: 'var(--ink-2)' }}
              >
                {showAllQuestions ? (
                  <>
                    Show fewer questions <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    Show more questions ({questions.length - INITIAL_QUESTIONS}{' '}
                    more) <ChevronDown size={14} />
                  </>
                )}
              </button>
            )}
          </>
        )}
      </section>

      {/* 3. Model selector */}
      {selectedQuestion && (
        <section
          ref={modelSectionRef}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="flex items-baseline gap-2 mb-3">
            <h2
              className="text-[16px] font-semibold"
              style={{ color: 'var(--ink)' }}
            >
              Select AI models
            </h2>
            <span className="text-[13px]" style={{ color: 'var(--m-muted)' }}>
              (max {MAX_MODELS})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODEL_DISPLAY.map(({ shortId, slug }) => {
              const provider = providerKeyToIcon(shortId) as AIProvider | null;
              const isSelected = selectedModels.includes(slug);
              const isDisabled =
                !isSelected && selectedModels.length >= MAX_MODELS;
              const label = provider
                ? PROVIDER_LABEL[provider]
                : shortId;
              const subtitle = provider
                ? PROVIDER_SUBTITLE[provider]
                : '';

              return (
                <button
                  key={slug}
                  disabled={isDisabled}
                  onClick={() => {
                    setSelectedModels((prev) =>
                      isSelected
                        ? prev.filter((s) => s !== slug)
                        : [...prev, slug],
                    );
                  }}
                  className="relative text-left rounded-xl px-4 py-4 transition-all"
                  style={{
                    background: 'var(--paper)',
                    border: isSelected
                      ? '2px solid var(--ink)'
                      : '1px solid var(--m-border)',
                    padding: isSelected ? '15px' : undefined,
                    opacity: isDisabled ? 0.45 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSelected && (
                    <div
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ink)' }}
                    >
                      <Check size={11} strokeWidth={3} color="var(--paper)" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {provider ? (
                      <AIProviderIcon provider={provider} size={28} />
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
                        style={{ background: 'var(--m-muted)' }}
                      >
                        {shortId[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p
                        className="text-[14px] font-semibold"
                        style={{ color: 'var(--ink)' }}
                      >
                        {label}
                      </p>
                      {subtitle && (
                        <p
                          className="text-[12px]"
                          style={{ color: 'var(--m-muted)' }}
                        >
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Run CTA */}
      {selectedQuestion && (
        <section>
          <button
            disabled={!canRun}
            onClick={handleRun}
            className="w-full rounded-xl py-3.5 text-[15px] font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: canRun ? 'var(--ink)' : 'var(--m-border)',
              color: canRun ? 'var(--paper)' : 'var(--m-muted)',
              cursor: canRun ? 'pointer' : 'not-allowed',
            }}
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running models...
              </>
            ) : (
              'Compare answers'
            )}
          </button>
          <p
            className="text-[12px] text-center mt-2"
            style={{ color: 'var(--m-muted)' }}
          >
            Uses 1 AI check per model selected
          </p>
          {runError && (
            <p
              className="text-[13px] text-center mt-2"
              style={{ color: 'var(--severe)' }}
            >
              {runError}
            </p>
          )}
        </section>
      )}

      {/* 5. Results panel */}
      {results.length > 0 && (
        <section ref={resultsSectionRef}>
          <h2
            className="text-[16px] font-semibold mb-3"
            style={{ color: 'var(--ink)' }}
          >
            Results
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((r) => {
              const provider = providerKeyToIcon(r.modelShortId);
              return (
                <div
                  key={r.modelSlug}
                  className="rounded-xl px-5 py-5 flex flex-col"
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid var(--m-border)',
                  }}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-2.5 mb-3">
                    {provider ? (
                      <AIProviderIcon provider={provider} size={20} />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ background: 'var(--m-muted)' }}
                      >
                        {r.modelShortId[0]?.toUpperCase()}
                      </div>
                    )}
                    <span
                      className="text-[14px] font-semibold"
                      style={{ color: 'var(--ink)' }}
                    >
                      {r.modelDisplayName}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      {r.status === 'completed' && (
                        <CheckCircle2
                          size={14}
                          strokeWidth={2}
                          style={{ color: 'var(--ok)' }}
                        />
                      )}
                      {r.status === 'failed' && (
                        <XCircle
                          size={14}
                          strokeWidth={2}
                          style={{ color: 'var(--severe)' }}
                        />
                      )}
                      {r.status === 'running' && (
                        <Loader2
                          size={14}
                          className="animate-spin"
                          style={{ color: 'var(--m-muted)' }}
                        />
                      )}
                    </span>
                  </div>

                  {/* Body */}
                  {r.status === 'running' && (
                    <div className="flex-1 flex items-center justify-center py-6">
                      <Loader2
                        size={18}
                        className="animate-spin"
                        style={{ color: 'var(--m-muted)' }}
                      />
                    </div>
                  )}

                  {r.status === 'completed' && r.responseText && (
                    <div className="flex-1">
                      <p
                        className="text-[14px] leading-[1.6] whitespace-pre-wrap"
                        style={{ color: 'var(--ink)' }}
                      >
                        {r.responseText}
                      </p>
                      {r.themes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--m-border)' }}>
                          {r.themes.map((t) => (
                            <span
                              key={t}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                              style={{
                                background: 'var(--paper-2)',
                                color: 'var(--ink-2)',
                                border: '1px solid var(--m-border)',
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {r.status === 'failed' && (
                    <div className="flex-1">
                      <p
                        className="text-[13px] mb-3"
                        style={{ color: 'var(--severe)' }}
                      >
                        {r.error ?? 'This model failed to respond.'}
                      </p>
                      <button
                        onClick={() => handleRetryFailed(r.modelSlug)}
                        disabled={isRunning}
                        className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                          background: 'var(--paper-2)',
                          color: 'var(--ink)',
                          border: '1px solid var(--m-border)',
                        }}
                      >
                        <RefreshCw size={12} />
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Latency */}
                  {r.status === 'completed' && r.latencyMs != null && (
                    <p
                      className="text-[11px] mt-3 flex items-center gap-1"
                      style={{ color: 'var(--m-muted)' }}
                    >
                      <Clock size={10} />
                      answered in {(r.latencyMs / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Follow-up suggestions */}
      {followups.length > 0 && (
        <section>
          <h2
            className="text-[16px] font-semibold mb-3"
            style={{ color: 'var(--ink)' }}
          >
            Related questions
          </h2>
          <div className="space-y-2">
            {followups.slice(0, 3).map((f, i) => (
              <button
                key={i}
                onClick={() => handleFollowup(f)}
                className="w-full text-left rounded-xl px-5 py-3.5 transition-all hover:border-[var(--ink)]"
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--m-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <MessageSquare
                    size={14}
                    strokeWidth={1.75}
                    style={{ color: 'var(--m-muted)' }}
                  />
                  <p
                    className="text-[14px]"
                    style={{ color: 'var(--ink)' }}
                  >
                    {f.questionText}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 7. Past interrogations */}
      <section>
        <h2
          className="text-[16px] font-semibold mb-3"
          style={{ color: 'var(--ink)' }}
        >
          Recent checks
          {!pastLoading && pastInterrogations.length > 0 && (
            <span
              className="text-[13px] font-normal ml-2"
              style={{ color: 'var(--m-muted)' }}
            >
              ({pastInterrogations.length})
            </span>
          )}
        </h2>

        {pastLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[52px] w-full" />
            <Skeleton className="h-[52px] w-full" />
          </div>
        ) : pastInterrogations.length === 0 ? (
          <div
            className="rounded-xl px-5 py-8 text-center"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--m-border)',
            }}
          >
            <Bot
              size={24}
              strokeWidth={1.5}
              className="mx-auto mb-2"
              style={{ color: 'var(--m-muted)' }}
            />
            <p className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
              No AI checks yet. Choose a question above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pastInterrogations.map((item) => {
              const interr = item.interrogation;
              const expanded = expandedPastId === interr.id;
              const models = item.results.map((r) => r.model_short_id);
              const ts = new Date(interr.created_at);
              const timeStr = ts.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              }) + ', ' + ts.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={interr.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid var(--m-border)',
                  }}
                >
                  <button
                    onClick={() =>
                      setExpandedPastId(expanded ? null : interr.id)
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[14px] truncate"
                        style={{ color: 'var(--ink)' }}
                      >
                        {interr.question_text}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex -space-x-1.5">
                        {models.map((m) => {
                          const prov = providerKeyToIcon(m);
                          return prov ? (
                            <AIProviderIcon
                              key={m}
                              provider={prov}
                              size={16}
                              className="ring-2 ring-[var(--paper)] rounded-full"
                            />
                          ) : null;
                        })}
                      </div>
                      <span
                        className="text-[11px] tabular-nums"
                        style={{ color: 'var(--m-muted)' }}
                      >
                        {timeStr}
                      </span>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          background:
                            interr.status === 'completed'
                              ? 'rgba(34,197,94,0.1)'
                              : interr.status === 'partial'
                                ? 'rgba(234,179,8,0.1)'
                                : 'rgba(239,68,68,0.08)',
                          color:
                            interr.status === 'completed'
                              ? 'var(--ok)'
                              : interr.status === 'partial'
                                ? 'var(--warn)'
                                : 'var(--severe)',
                        }}
                      >
                        {interr.status}
                      </span>
                      <ChevronDown
                        size={14}
                        style={{
                          color: 'var(--m-muted)',
                          transform: expanded
                            ? 'rotate(180deg)'
                            : 'none',
                          transition: 'transform 150ms',
                        }}
                      />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {item.results.map((r) => {
                        const prov = providerKeyToIcon(r.model_short_id);
                        return (
                          <div
                            key={r.id}
                            className="rounded-lg p-4"
                            style={{
                              background: 'var(--paper-2)',
                              border: '1px solid var(--m-border)',
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {prov && (
                                <AIProviderIcon
                                  provider={prov}
                                  size={16}
                                />
                              )}
                              <span
                                className="text-[13px] font-semibold"
                                style={{ color: 'var(--ink)' }}
                              >
                                {r.model_display_name}
                              </span>
                              {r.status === 'completed' && (
                                <CheckCircle2
                                  size={12}
                                  className="ml-auto"
                                  style={{ color: 'var(--ok)' }}
                                />
                              )}
                              {r.status === 'failed' && (
                                <XCircle
                                  size={12}
                                  className="ml-auto"
                                  style={{ color: 'var(--severe)' }}
                                />
                              )}
                            </div>
                            {r.response_text ? (
                              <p
                                className="text-[13px] leading-relaxed"
                                style={{ color: 'var(--ink-2)' }}
                              >
                                {r.response_text}
                              </p>
                            ) : (
                              <p
                                className="text-[13px] italic"
                                style={{ color: 'var(--m-muted)' }}
                              >
                                {r.error_message ?? 'No response'}
                              </p>
                            )}
                            {r.themes && r.themes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: '1px solid var(--m-border)' }}>
                                {r.themes.map((t) => (
                                  <span
                                    key={t}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                                    style={{
                                      background: 'var(--paper)',
                                      color: 'var(--m-muted)',
                                      border: '1px solid var(--m-border)',
                                    }}
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            {r.latency_ms != null && (
                              <p
                                className="text-[10px] mt-2 flex items-center gap-1"
                                style={{ color: 'var(--m-muted)' }}
                              >
                                <Clock size={9} />
                                {(r.latency_ms / 1000).toFixed(1)}s
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Page header block ──────────────────────────────────────── */

function PageHeaderBlock({ usage }: { usage: Usage | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1
          className="text-[24px] font-semibold"
          style={{ color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}
        >
          AI interrogation
        </h1>
        <p
          className="text-[14px] mt-1 max-w-xl"
          style={{ color: 'var(--ink-2)' }}
        >
          Test how AI models perceive and describe your business. Choose a
          question, select which models to interrogate, and compare their
          answers.
        </p>
      </div>

      {usage && (
        <div className="flex-shrink-0">
          <div
            className="rounded-full px-3.5 py-1.5 flex items-center gap-2 text-[12px] font-medium"
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--m-border)',
              color: 'var(--ink-2)',
            }}
          >
            <span className="tabular-nums">
              {usage.checksUsed} / {usage.checksLimit}
            </span>
            <span style={{ color: 'var(--m-muted)' }}>AI checks this month</span>
          </div>
          <div
            className="mt-1.5 h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--m-border)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (usage.checksUsed / Math.max(usage.checksLimit, 1)) * 100)}%`,
                background:
                  usage.checksUsed / Math.max(usage.checksLimit, 1) > 0.9
                    ? 'var(--severe)'
                    : 'var(--ink)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
