'use client';

/**
 * AI Interrogation — Claude-style chat interface for testing how AI
 * models perceive a brand.
 *
 * Layout:  history sidebar (left) + chat thread (center) + console bar (bottom)
 * Flow:    see suggested question pills → tap one → see collapsible model
 *          response cards (closed by default) → expand to read → follow-up
 *          pills appear → repeat.
 * Console: model selector circles + "Suggest what to ask" button (no free input).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  AIProviderIcon,
  PROVIDER_LABEL,
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

const MAX_MODELS = 3;

/* ── Helpers ──────────────────────────────────────────────── */

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  // Which model cards are expanded (keyed by `${msgId}::${modelSlug}`)
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const [pastInterrogations, setPastInterrogations] = useState<PastInterrogation[]>([]);
  const [pastLoading, setPastLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  // Whether to show question pills in the chat area
  const [showSuggestions, setShowSuggestions] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Expand / collapse a model card ──────────────────────── */
  const toggleCard = (msgId: string, modelSlug: string) => {
    const key = `${msgId}::${modelSlug}`;
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* ── Auto-scroll to bottom ───────────────────────────────── */
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
      setQuestionsError('Could not load questions.');
    } finally {
      setQuestionsLoading(false);
    }
  }, [workspaceId]);

  const refreshQuestions = useCallback(async () => {
    if (!workspaceId) return;
    setQuestionsLoading(true);
    setQuestionsError(null);
    try {
      const res = await fetch('/api/ai-interrogation/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) throw new Error('Failed to refresh questions');
      const data = await res.json();
      setQuestions(data.questions ?? []);
      setShowSuggestions(true);
    } catch {
      setQuestionsError('Could not refresh questions.');
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

    const matchingQuestion = questions.find(
      (q) => q.questionText === questionText.trim(),
    );

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      text: questionText.trim(),
      timestamp: new Date(),
      family: family ?? matchingQuestion?.family ?? 'general_discovery',
    };

    setMessages((prev) => [...prev, userMsg]);
    setShowSuggestions(false);
    setIsRunning(true);
    setRunError(null);

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

  /* ── Toggle model ─────────────────────────────────────────── */
  const toggleModel = (slug: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_MODELS) return prev;
      return [...prev, slug];
    });
  };

  /* ── Loading / workspace guard ────────────────────────────── */
  if (wsLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--m-muted)' }} />
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-[14px]" style={{ color: 'var(--m-muted)' }}>Workspace not found.</p>
      </div>
    );
  }
  if (usage && !usage.canInterrogate && usage.checksLimit === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--paper)', border: '1px solid var(--m-border)' }}>
          <Sparkles size={28} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: 'var(--m-muted)' }} />
          <h2 className="text-[16px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Upgrade to unlock AI interrogation</h2>
          <p className="text-[14px] max-w-md mx-auto" style={{ color: 'var(--ink-2)' }}>
            AI interrogation lets you test how leading AI models perceive and describe your business. Upgrade your plan to get started.
          </p>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
      {/* ═══════ SIDEBAR — history (Claude-style) ═══════════ */}
      {showSidebar && (
        <div
          className="w-[280px] flex-shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--m-border)', background: 'var(--paper-2)' }}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
              History
            </span>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1 rounded-md transition-colors"
              style={{ color: 'var(--m-muted)' }}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {pastLoading ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-lg h-[54px]" style={{ background: 'var(--paper)' }} />
                ))}
              </div>
            ) : pastInterrogations.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Bot size={20} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: 'var(--m-muted)' }} />
                <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                  No past checks yet
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {pastInterrogations.map((item) => {
                  const interr = item.interrogation;
                  const models = item.results.map((r) => r.model_short_id);
                  const ts = new Date(interr.created_at);

                  return (
                    <button
                      key={interr.id}
                      onClick={() => {
                        handleSend(interr.question_text, interr.question_family);
                      }}
                      disabled={isRunning}
                      className="w-full text-left rounded-lg px-3 py-2.5 transition-colors group"
                      style={{ color: 'var(--ink)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'var(--paper)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <p
                        className="text-[13px] leading-snug mb-1 line-clamp-2"
                        style={{ color: 'var(--ink)' }}
                      >
                        {interr.question_text}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1">
                          {models.slice(0, 3).map((m) => {
                            const prov = providerKeyToIcon(m);
                            return prov ? (
                              <AIProviderIcon
                                key={m}
                                provider={prov}
                                size={12}
                                className="ring-1 ring-[var(--paper-2)] rounded-full"
                              />
                            ) : null;
                          })}
                        </div>
                        <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
                          {timeAgo(ts)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ MAIN AREA ══════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top bar ──────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--m-border)' }}
        >
          <div className="flex items-center gap-2.5">
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-1.5 rounded-lg transition-colors mr-1"
                style={{ color: 'var(--ink-2)' }}
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
            <Bot size={16} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
            <h1 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
              AI interrogation
            </h1>
          </div>

          {usage && (
            <div
              className="rounded-full px-3 py-1 flex items-center gap-1.5 text-[11px] font-medium"
              style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}
            >
              <span className="tabular-nums">{usage.checksRemaining}</span>
              <span style={{ color: 'var(--m-muted)' }}>checks left</span>
            </div>
          )}
        </div>

        {/* ── Chat thread ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-5 py-6">

            {/* Welcome state */}
            {!hasMessages && (
              <div className="pt-12 pb-4">
                <div className="text-center mb-10">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--paper-2)' }}
                  >
                    <Bot size={20} strokeWidth={1.5} style={{ color: 'var(--ink)' }} />
                  </div>
                  <h2 className="text-[22px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>
                    What do AI models say about you?
                  </h2>
                  <p className="text-[14px] max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    See how ChatGPT, Gemini, Perplexity and others describe your
                    business when people ask about you.
                  </p>
                </div>
              </div>
            )}

            {/* Question pills — shown in welcome state or when toggled */}
            {showSuggestions && !isRunning && (
              <div className="mb-8">
                {questionsLoading ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse rounded-full h-[36px] w-[180px]" style={{ background: 'var(--paper-2)' }} />
                    ))}
                  </div>
                ) : questionsError ? (
                  <div className="text-center">
                    <p className="text-[13px] mb-2" style={{ color: 'var(--severe)' }}>{questionsError}</p>
                    <button onClick={fetchQuestions} className="text-[12px] font-medium underline" style={{ color: 'var(--ink-2)' }}>Retry</button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {questions.slice(0, 8).map((q) => (
                      <button
                        key={q.questionId}
                        onClick={() => handleSend(q.questionText, q.family)}
                        disabled={selectedModels.length === 0}
                        className="rounded-full px-4 py-2 text-[13px] transition-all"
                        style={{
                          background: 'var(--paper)',
                          border: '1px solid var(--m-border)',
                          color: 'var(--ink)',
                          cursor: selectedModels.length === 0 ? 'not-allowed' : 'pointer',
                          opacity: selectedModels.length === 0 ? 0.4 : 1,
                        }}
                      >
                        {q.questionText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg) => (
              <div key={msg.id} className="mb-5">
                {msg.type === 'user' ? (
                  /* ── User bubble ─────────────────────────── */
                  <div className="flex justify-end mb-1">
                    <div
                      className="rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]"
                      style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                    >
                      <p className="text-[14px] leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  /* ── Model response cards ────────────────── */
                  <div className="space-y-1.5">
                    {(msg.results ?? []).map((r) => {
                      const provider = providerKeyToIcon(r.modelShortId);
                      const cardKey = `${msg.id}::${r.modelSlug}`;
                      const isExpanded = expandedCards.has(cardKey);
                      const isCompleted = r.status === 'completed';
                      const isFailed = r.status === 'failed';
                      const isLoading = r.status === 'running';

                      return (
                        <div
                          key={r.modelSlug}
                          className="rounded-xl overflow-hidden transition-all"
                          style={{
                            background: 'var(--paper)',
                            border: '1px solid var(--m-border)',
                          }}
                        >
                          {/* Collapsed header — always visible */}
                          <button
                            onClick={() => {
                              if (!isLoading) toggleCard(msg.id, r.modelSlug);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                            style={{ cursor: isLoading ? 'default' : 'pointer' }}
                          >
                            {/* Model icon */}
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: 'var(--paper-2)' }}
                            >
                              {provider ? (
                                <AIProviderIcon provider={provider} size={16} />
                              ) : (
                                <span className="text-[10px] font-bold" style={{ color: 'var(--m-muted)' }}>
                                  {r.modelShortId[0]?.toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Name */}
                            <span className="text-[13px] font-semibold flex-1" style={{ color: 'var(--ink)' }}>
                              {r.modelDisplayName}
                            </span>

                            {/* Status indicators */}
                            {isLoading && (
                              <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
                            )}
                            {isCompleted && r.latencyMs != null && (
                              <span className="text-[11px] flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--m-muted)' }}>
                                <Clock size={10} />
                                {(r.latencyMs / 1000).toFixed(1)}s
                              </span>
                            )}
                            {isFailed && (
                              <XCircle size={14} className="flex-shrink-0" style={{ color: 'var(--severe)' }} />
                            )}

                            {/* Expand chevron */}
                            {!isLoading && (
                              <ChevronRight
                                size={14}
                                className="flex-shrink-0 transition-transform"
                                style={{
                                  color: 'var(--m-muted)',
                                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                                }}
                              />
                            )}
                          </button>

                          {/* Expanded content */}
                          {isExpanded && !isLoading && (
                            <div
                              className="px-4 pb-4 pt-0"
                              style={{ borderTop: '1px solid var(--m-border)' }}
                            >
                              {isCompleted && r.responseText && (
                                <>
                                  <p
                                    className="text-[13px] leading-[1.7] whitespace-pre-wrap pt-3"
                                    style={{ color: 'var(--ink)' }}
                                  >
                                    {r.responseText}
                                  </p>
                                  {r.themes.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--m-border)' }}>
                                      {r.themes.map((t) => (
                                        <span
                                          key={t}
                                          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                          style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                              {isFailed && (
                                <p className="text-[13px] pt-3" style={{ color: 'var(--severe)' }}>
                                  {r.error ?? 'This model failed to respond.'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Follow-up pills */}
                    {msg.followups && msg.followups.length > 0 && !isRunning && (
                      <div className="pt-3">
                        <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--m-muted)' }}>
                          Follow up
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {msg.followups.slice(0, 3).map((f, i) => (
                            <button
                              key={i}
                              onClick={() => handleSend(f.questionText, f.family)}
                              disabled={isRunning}
                              className="rounded-full px-3.5 py-2 text-[12px] transition-all"
                              style={{
                                background: 'var(--paper)',
                                border: '1px solid var(--m-border)',
                                color: 'var(--ink)',
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

            {/* Error */}
            {runError && (
              <div
                className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
              >
                <XCircle size={14} style={{ color: 'var(--severe)' }} />
                <p className="text-[13px]" style={{ color: 'var(--severe)' }}>{runError}</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* ── Console bar ──────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-5 py-3"
          style={{ borderTop: '1px solid var(--m-border)', background: 'var(--paper)' }}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-4">
              {/* Model selector — avatar circles */}
              <div className="flex items-center gap-1.5">
                {MODEL_DISPLAY.map(({ shortId, slug }) => {
                  const provider = providerKeyToIcon(shortId) as AIProvider | null;
                  const isSelected = selectedModels.includes(slug);
                  const isDisabled = !isSelected && selectedModels.length >= MAX_MODELS;

                  return (
                    <button
                      key={slug}
                      onClick={() => toggleModel(slug)}
                      disabled={isDisabled}
                      title={provider ? PROVIDER_LABEL[provider] : shortId}
                      className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: isSelected ? 'var(--ink)' : 'var(--paper-2)',
                        border: isSelected ? '2px solid var(--ink)' : '2px solid transparent',
                        opacity: isDisabled ? 0.3 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {provider ? (
                        <AIProviderIcon
                          provider={provider}
                          size={16}
                          className={isSelected ? 'brightness-0 invert' : ''}
                        />
                      ) : (
                        <span className="text-[10px] font-bold" style={{ color: isSelected ? 'var(--paper)' : 'var(--m-muted)' }}>
                          {shortId[0].toUpperCase()}
                        </span>
                      )}
                      {isSelected && (
                        <div
                          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center"
                          style={{ background: 'var(--ok)' }}
                        >
                          <Check size={8} strokeWidth={3} color="#fff" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Suggest button */}
              <button
                onClick={() => {
                  if (showSuggestions && questions.length > 0) {
                    refreshQuestions();
                  } else {
                    setShowSuggestions(true);
                    if (questions.length === 0) fetchQuestions();
                  }
                  scrollToBottom();
                }}
                disabled={isRunning || questionsLoading || selectedModels.length === 0}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all"
                style={{
                  background: isRunning || selectedModels.length === 0 ? 'var(--m-border)' : 'var(--ink)',
                  color: isRunning || selectedModels.length === 0 ? 'var(--m-muted)' : 'var(--paper)',
                  cursor: isRunning || selectedModels.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {questionsLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                Suggest what to ask
              </button>
            </div>

            {/* Usage line */}
            {usage && (
              <p className="text-[10px] text-center mt-2" style={{ color: 'var(--m-muted)' }}>
                {selectedModels.length}/{MAX_MODELS} models
                {' · '}
                {usage.checksRemaining} check{usage.checksRemaining !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
