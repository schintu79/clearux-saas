'use client';

/**
 * AI Interrogation — chat-style interface for testing how AI models
 * perceive a brand.
 *
 * Users type (or tap) a question, pick models via a compact toggle strip,
 * and see each model's response as a chat bubble. Follow-ups appear as
 * suggestion chips so the conversation flows naturally.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
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

interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  text: string;
  timestamp: Date;
  results?: ModelResult[];
  followups?: Followup[];
  family?: string;
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

/* ── Skeleton helper ──────────────────────────────────────── */

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

  const [selectedModels, setSelectedModels] = useState<string[]>([
    'openai/gpt-4o-mini',
    'google/gemini-2.5-flash',
    'perplexity/sonar',
  ]);

  const [usage, setUsage] = useState<Usage | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [customInput, setCustomInput] = useState('');

  const [pastInterrogations, setPastInterrogations] = useState<PastInterrogation[]>([]);
  const [pastLoading, setPastLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Auto-scroll to bottom of chat ───────────────────────── */
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

  /* ── Run interrogation ────────────────────────────────────── */
  const handleSend = async (questionText: string, family?: string) => {
    if (!workspaceId || !questionText.trim() || selectedModels.length === 0 || isRunning) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: questionText.trim(),
      timestamp: new Date(),
      family: family ?? 'general_discovery',
    };

    // Find matching question from library
    const matchingQuestion = questions.find(
      (q) => q.questionText === questionText.trim(),
    );

    setMessages((prev) => [...prev, userMsg]);
    setCustomInput('');
    setIsRunning(true);
    setRunError(null);

    // Create a placeholder system message with running results
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

    const systemMsgId = `system-${Date.now()}`;
    const systemMsg: ChatMessage = {
      id: systemMsgId,
      type: 'system',
      text: '',
      timestamp: new Date(),
      results: pendingResults,
    };

    setMessages((prev) => [...prev, systemMsg]);

    try {
      const res = await fetch('/api/ai-interrogation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          question_id: matchingQuestion?.questionId ?? null,
          question_text: questionText.trim(),
          question_family: family ?? matchingQuestion?.family ?? 'general_discovery',
          selected_models: selectedModels,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Request failed');
      }

      const data = await res.json();

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

      setMessages((prev) =>
        prev.map((m) =>
          m.id === systemMsgId
            ? { ...m, results: mapped, followups: data.followups ?? [] }
            : m,
        ),
      );

      fetchUsage();
      fetchPast();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setRunError(errorMessage);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === systemMsgId
            ? {
                ...m,
                results: pendingResults.map((r) => ({
                  ...r,
                  status: 'failed' as const,
                  error: errorMessage,
                })),
              }
            : m,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  };

  /* ── Follow-up click ──────────────────────────────────────── */
  const handleFollowup = (f: Followup) => {
    handleSend(f.questionText, f.family);
  };

  /* ── Suggested question click ─────────────────────────────── */
  const handleSuggestionClick = (q: RankedQuestion) => {
    handleSend(q.questionText, q.family);
  };

  /* ── Send custom input ────────────────────────────────────── */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      handleSend(customInput.trim());
    }
  };

  /* ── Toggle model ─────────────────────────────────────────── */
  const toggleModel = (slug: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug);
      }
      if (prev.length >= MAX_MODELS) return prev;
      return [...prev, slug];
    });
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
      <div className="max-w-2xl mx-auto py-16 px-4">
        <div
          className="rounded-2xl p-8 text-center"
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

  const hasMessages = messages.length > 0;

  /* ── Main render ──────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 64px)', maxHeight: 'calc(100vh - 64px)' }}
    >
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--m-border)' }}
      >
        <div className="flex items-center gap-3">
          <Bot size={18} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
          <h1
            className="text-[16px] font-semibold"
            style={{ color: 'var(--ink)' }}
          >
            AI interrogation
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {usage && (
            <div
              className="rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-medium"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--m-border)',
                color: 'var(--ink-2)',
              }}
            >
              <span className="tabular-nums">
                {usage.checksRemaining}
              </span>
              <span style={{ color: 'var(--m-muted)' }}>checks left</span>
            </div>
          )}

          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
            style={{
              background: showHistory ? 'var(--paper-2)' : 'transparent',
              color: 'var(--ink-2)',
            }}
          >
            <History size={13} />
            History
          </button>
        </div>
      </div>

      {/* ── Chat area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Welcome state — no messages yet */}
          {!hasMessages && (
            <div className="py-8">
              <div className="text-center mb-8">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--paper-2)' }}
                >
                  <MessageSquare size={22} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
                </div>
                <h2
                  className="text-[20px] font-semibold mb-2"
                  style={{ color: 'var(--ink)' }}
                >
                  Ask AI about your brand
                </h2>
                <p
                  className="text-[14px] max-w-md mx-auto"
                  style={{ color: 'var(--ink-2)' }}
                >
                  Test how ChatGPT, Gemini, Perplexity, and other AI models
                  perceive your business. Pick a question below or type your own.
                </p>
              </div>

              {/* Suggested questions */}
              {questionsLoading ? (
                <div className="space-y-2 max-w-lg mx-auto">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[52px] w-full" />
                  ))}
                </div>
              ) : questionsError ? (
                <div
                  className="rounded-xl px-5 py-4 flex items-center gap-3 max-w-lg mx-auto"
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
              ) : (
                <div className="space-y-2 max-w-lg mx-auto">
                  {questions.slice(0, 6).map((q) => {
                    const familyColor = FAMILY_COLORS[q.family] ?? 'var(--m-muted)';
                    return (
                      <button
                        key={q.questionId}
                        onClick={() => handleSuggestionClick(q)}
                        disabled={isRunning || selectedModels.length === 0}
                        className="w-full text-left rounded-xl px-4 py-3.5 transition-all group"
                        style={{
                          background: 'var(--paper)',
                          border: '1px solid var(--m-border)',
                          opacity: isRunning ? 0.5 : 1,
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <MessageSquare
                            size={14}
                            strokeWidth={1.75}
                            className="mt-0.5 flex-shrink-0 transition-colors"
                            style={{ color: 'var(--m-muted)' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[14px] leading-snug"
                              style={{ color: 'var(--ink)' }}
                            >
                              {q.questionText}
                            </p>
                            <span
                              className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5"
                              style={{
                                background: `${familyColor}12`,
                                color: familyColor,
                              }}
                            >
                              {familyLabel(q.family)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <div key={msg.id} className="mb-6">
              {msg.type === 'user' ? (
                /* ── User bubble ────────────────────────────── */
                <div className="flex justify-end">
                  <div
                    className="rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]"
                    style={{
                      background: 'var(--ink)',
                      color: 'var(--paper)',
                    }}
                  >
                    <p className="text-[14px] leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ) : (
                /* ── Model response bubbles ─────────────────── */
                <div className="space-y-3">
                  {(msg.results ?? []).map((r) => {
                    const provider = providerKeyToIcon(r.modelShortId);
                    return (
                      <div key={r.modelSlug} className="flex items-start gap-2.5">
                        {/* Avatar */}
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: 'var(--paper-2)' }}
                        >
                          {provider ? (
                            <AIProviderIcon provider={provider} size={16} />
                          ) : (
                            <span
                              className="text-[10px] font-bold"
                              style={{ color: 'var(--m-muted)' }}
                            >
                              {r.modelShortId[0]?.toUpperCase()}
                            </span>
                          )}
                        </div>

                        {/* Bubble */}
                        <div
                          className="rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] flex-1"
                          style={{
                            background: 'var(--paper)',
                            border: '1px solid var(--m-border)',
                          }}
                        >
                          {/* Model name + status */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className="text-[12px] font-semibold"
                              style={{ color: 'var(--ink)' }}
                            >
                              {r.modelDisplayName}
                            </span>
                            {r.status === 'running' && (
                              <Loader2
                                size={11}
                                className="animate-spin"
                                style={{ color: 'var(--m-muted)' }}
                              />
                            )}
                            {r.status === 'completed' && r.latencyMs != null && (
                              <span
                                className="text-[10px] flex items-center gap-0.5"
                                style={{ color: 'var(--m-muted)' }}
                              >
                                <Clock size={9} />
                                {(r.latencyMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>

                          {/* Response body */}
                          {r.status === 'running' && (
                            <div className="py-3">
                              <div className="flex gap-1.5">
                                <div
                                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                                  style={{
                                    background: 'var(--m-muted)',
                                    animationDelay: '0ms',
                                  }}
                                />
                                <div
                                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                                  style={{
                                    background: 'var(--m-muted)',
                                    animationDelay: '150ms',
                                  }}
                                />
                                <div
                                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                                  style={{
                                    background: 'var(--m-muted)',
                                    animationDelay: '300ms',
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {r.status === 'completed' && r.responseText && (
                            <>
                              <p
                                className="text-[13px] leading-[1.65] whitespace-pre-wrap"
                                style={{ color: 'var(--ink)' }}
                              >
                                {r.responseText}
                              </p>
                              {r.themes.length > 0 && (
                                <div
                                  className="flex flex-wrap gap-1 mt-2.5 pt-2.5"
                                  style={{ borderTop: '1px solid var(--m-border)' }}
                                >
                                  {r.themes.map((t) => (
                                    <span
                                      key={t}
                                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                      style={{
                                        background: 'var(--paper-2)',
                                        color: 'var(--ink-2)',
                                      }}
                                    >
                                      {t}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )}

                          {r.status === 'failed' && (
                            <p
                              className="text-[13px]"
                              style={{ color: 'var(--severe)' }}
                            >
                              {r.error ?? 'This model failed to respond.'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Follow-up suggestions */}
                  {msg.followups && msg.followups.length > 0 && (
                    <div className="pl-10 pt-1">
                      <p
                        className="text-[11px] font-medium mb-2"
                        style={{ color: 'var(--m-muted)' }}
                      >
                        Follow up
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.followups.slice(0, 3).map((f, i) => (
                          <button
                            key={i}
                            onClick={() => handleFollowup(f)}
                            disabled={isRunning}
                            className="text-left rounded-xl px-3.5 py-2.5 text-[13px] transition-all"
                            style={{
                              background: 'var(--paper)',
                              border: '1px solid var(--m-border)',
                              color: 'var(--ink)',
                              opacity: isRunning ? 0.5 : 1,
                              cursor: isRunning ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {f.questionText}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Error message */}
          {runError && messages.length > 0 && (
            <div
              className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 max-w-lg"
              style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              <XCircle size={14} style={{ color: 'var(--severe)' }} />
              <p className="text-[13px]" style={{ color: 'var(--severe)' }}>
                {runError}
              </p>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Input area ───────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-2"
        style={{ borderTop: '1px solid var(--m-border)' }}
      >
        <div className="max-w-3xl mx-auto">
          {/* Model toggle strip */}
          <div className="flex items-center gap-1.5 mb-2.5 px-1 overflow-x-auto">
            <span
              className="text-[11px] font-medium flex-shrink-0 mr-1"
              style={{ color: 'var(--m-muted)' }}
            >
              Models:
            </span>
            {MODEL_DISPLAY.map(({ shortId, slug }) => {
              const provider = providerKeyToIcon(shortId) as AIProvider | null;
              const isSelected = selectedModels.includes(slug);
              const isDisabled = !isSelected && selectedModels.length >= MAX_MODELS;
              const label = provider ? PROVIDER_LABEL[provider] : shortId;

              return (
                <button
                  key={slug}
                  onClick={() => toggleModel(slug)}
                  disabled={isDisabled}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex-shrink-0"
                  style={{
                    background: isSelected ? 'var(--ink)' : 'var(--paper)',
                    color: isSelected ? 'var(--paper)' : 'var(--ink-2)',
                    border: isSelected
                      ? '1px solid var(--ink)'
                      : '1px solid var(--m-border)',
                    opacity: isDisabled ? 0.35 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {provider && (
                    <AIProviderIcon
                      provider={provider}
                      size={12}
                      className={isSelected ? 'brightness-0 invert' : ''}
                    />
                  )}
                  {label}
                  {isSelected && (
                    <Check size={10} strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Text input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center rounded-xl px-4 py-2.5"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--m-border)',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={
                  selectedModels.length === 0
                    ? 'Select at least one model above'
                    : 'Ask something about your brand...'
                }
                disabled={isRunning || selectedModels.length === 0}
                className="flex-1 text-[14px] bg-transparent outline-none placeholder:text-[var(--m-muted)]"
                style={{ color: 'var(--ink)' }}
              />
            </div>
            <button
              type="submit"
              disabled={isRunning || !customInput.trim() || selectedModels.length === 0}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
              style={{
                background:
                  !isRunning && customInput.trim() && selectedModels.length > 0
                    ? 'var(--ink)'
                    : 'var(--m-border)',
                color:
                  !isRunning && customInput.trim() && selectedModels.length > 0
                    ? 'var(--paper)'
                    : 'var(--m-muted)',
                cursor:
                  isRunning || !customInput.trim() || selectedModels.length === 0
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {isRunning ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>

          {/* Usage hint */}
          {usage && (
            <p
              className="text-[11px] text-center mt-2"
              style={{ color: 'var(--m-muted)' }}
            >
              {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''} selected
              {' · '}
              {usage.checksRemaining} check{usage.checksRemaining !== 1 ? 's' : ''} remaining this month
            </p>
          )}
        </div>
      </div>

      {/* ── History sidebar overlay ───────────────────────────── */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHistory(false);
          }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.2)' }}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-md h-full overflow-y-auto"
            style={{
              background: 'var(--paper)',
              borderLeft: '1px solid var(--m-border)',
            }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
              style={{ background: 'var(--paper)', borderBottom: '1px solid var(--m-border)' }}
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: 'var(--ink)' }}
              >
                Past checks
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-[13px] font-medium px-2 py-1 rounded-lg"
                style={{ color: 'var(--ink-2)' }}
              >
                Close
              </button>
            </div>

            <div className="px-5 py-4">
              {pastLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-[52px] w-full" />
                  <Skeleton className="h-[52px] w-full" />
                </div>
              ) : pastInterrogations.length === 0 ? (
                <div className="py-12 text-center">
                  <Bot
                    size={24}
                    strokeWidth={1.5}
                    className="mx-auto mb-2"
                    style={{ color: 'var(--m-muted)' }}
                  />
                  <p className="text-[14px]" style={{ color: 'var(--ink-2)' }}>
                    No past checks yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pastInterrogations.map((item) => {
                    const interr = item.interrogation;
                    const expanded = expandedPastId === interr.id;
                    const models = item.results.map((r) => r.model_short_id);
                    const ts = new Date(interr.created_at);
                    const timeStr =
                      ts.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      }) +
                      ', ' +
                      ts.toLocaleTimeString(undefined, {
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
                          className="w-full text-left px-4 py-3 transition-colors"
                        >
                          <p
                            className="text-[13px] leading-snug mb-1.5"
                            style={{ color: 'var(--ink)' }}
                          >
                            {interr.question_text}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                              {models.map((m) => {
                                const prov = providerKeyToIcon(m);
                                return prov ? (
                                  <AIProviderIcon
                                    key={m}
                                    provider={prov}
                                    size={14}
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
                            <ChevronDown
                              size={12}
                              className="ml-auto"
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
                          <div className="px-4 pb-4 space-y-2.5">
                            {item.results.map((r) => {
                              const prov = providerKeyToIcon(r.model_short_id);
                              return (
                                <div
                                  key={r.id}
                                  className="rounded-lg p-3"
                                  style={{
                                    background: 'var(--paper-2)',
                                    border: '1px solid var(--m-border)',
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    {prov && (
                                      <AIProviderIcon
                                        provider={prov}
                                        size={14}
                                      />
                                    )}
                                    <span
                                      className="text-[12px] font-semibold"
                                      style={{ color: 'var(--ink)' }}
                                    >
                                      {r.model_display_name}
                                    </span>
                                    {r.latency_ms != null && (
                                      <span
                                        className="text-[10px] ml-auto flex items-center gap-0.5"
                                        style={{ color: 'var(--m-muted)' }}
                                      >
                                        <Clock size={9} />
                                        {(r.latency_ms / 1000).toFixed(1)}s
                                      </span>
                                    )}
                                  </div>
                                  {r.response_text ? (
                                    <p
                                      className="text-[12px] leading-relaxed"
                                      style={{ color: 'var(--ink-2)' }}
                                    >
                                      {r.response_text}
                                    </p>
                                  ) : (
                                    <p
                                      className="text-[12px] italic"
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
                                          className="text-[9px] px-1.5 py-0.5 rounded-full"
                                          style={{
                                            background: 'var(--paper)',
                                            color: 'var(--m-muted)',
                                          }}
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Re-ask button */}
                            <button
                              onClick={() => {
                                setShowHistory(false);
                                handleSend(
                                  interr.question_text,
                                  interr.question_family,
                                );
                              }}
                              disabled={isRunning}
                              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                              style={{
                                background: 'var(--paper-2)',
                                color: 'var(--ink)',
                                border: '1px solid var(--m-border)',
                              }}
                            >
                              <RefreshCw size={11} />
                              Ask again
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
