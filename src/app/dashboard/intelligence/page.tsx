'use client';

/**
 * Brand Intelligence — Strategic dashboard (v2 redesign)
 *
 * 6-section architecture:
 *  1. Executive Overview — hero score + sub-metrics + narrative summary
 *  2. AI Model Understanding — per-model breakdown with issues/opportunities
 *  3. Brand Narrative & Perception — themes, signals, hallucinations
 *  4. Competitive Intelligence — gap analysis + leaderboard
 *  5. Prioritized Improvement Plan — grouped recommendations
 *  6. Methodology Transparency — what was queried, when, how
 */

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Radio,
  BarChart3,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Plus,
  Trash2,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  MessageSquare,
  Target,
  Wrench,
  Users,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Bot,
  Shield,
  AlertTriangle,
  Lightbulb,
  Activity,
  Hash,
  Clock,
  Layers,
  BookOpen,
  Brain,
  Eye,
  ArrowUpDown,
  Globe,
  Code,
  Search,
  Minus,
  Loader2,
  XCircle,
  CircleDot,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import ScoreCircle from '@/components/ui/ScoreCircle';
import { AIProviderIcon, PROVIDER_LABEL, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence';

/* ── Fix instructions for missing AI readability signals ── */

const SIGNAL_FIX_MAP: Record<string, string> = {
  'page title': 'Add a <title> tag inside <head>. Keep it under 60 characters, include your brand name and primary keyword.',
  'h1 heading': 'Add exactly one <h1> tag with a clear, descriptive heading. AI models use it to understand what the page is about.',
  'meta description': 'Add <meta name="description" content="..."> inside <head>. 150–160 characters summarizing the page content.',
  'main content text': 'The page has very little readable text. AI models need substantial text to understand your content. Add descriptive copy.',
  'substantial text content (page may be image/js-heavy)': 'The page relies on images or JavaScript-rendered content. Add HTML text that describes your offering clearly.',
  'canonical url': 'Add <link rel="canonical" href="https://yoursite.com/page"> inside <head> to tell AI models which URL is the primary version.',
  'language declaration (lang attribute)': 'Add lang="en" (or your language code) to the <html> tag. AI models use it for language detection.',
  'open graph title (og:title)': 'Add <meta property="og:title" content="Your Title"> inside <head>. Used by social platforms and some AI models.',
  'open graph description (og:description)': 'Add <meta property="og:description" content="..."> inside <head>. Helps AI models understand the page context.',
  'open graph image (og:image)': 'Add <meta property="og:image" content="https://yoursite.com/image.jpg"> for rich previews in AI-powered surfaces.',
  'twitter card tags': 'Add <meta name="twitter:card" content="summary_large_image"> and matching title/description/image meta tags.',
  'viewport meta tag': 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> inside <head> for mobile compatibility.',
  'json-ld structured data': 'Add JSON-LD schema markup (Organization, Product, LocalBusiness, etc.) inside a <script type="application/ld+json"> tag.',
  'page is set to noindex (ai crawlers may skip)': 'Your page has <meta name="robots" content="noindex">. AI crawlers may skip it entirely. Remove noindex if you want AI visibility.',
}

/* ── Types ─────────────────────────────────────────── */

type Competitor = {
  domain: string;
  name?: string;
  score: number;
  pillarScores?: Array<{ name: string; score: number }>;
  category?: string;
  note?: string;
  source?: 'auto' | 'manual' | string;
};

type DraftCompetitor = {
  id: string;
  domain: string;
  score: number | null;
  source: 'auto' | 'manual';
  pillarScores?: Array<{ name: string; score: number }>;
  name?: string;
  category?: string;
  note?: string;
};

type BenchmarkPosition = {
  userScore?: number;
  deltaFromAvg?: number;
  benchmark?: { avgScore: number; sampleSize?: number };
  comparedAgainst?: string;
};

type ModelProbe = {
  model_id: string;
  model_label: string;
  accuracy_score: number;
  results_json?: Array<{ question: string; answer: string; accuracy: string | null; accuracyNote?: string | null }>;
  sentiment_score?: number | null;
  sentiment_themes?: Array<{ theme: string; polarity: string; count: number }>;
  placement_score?: number | null;
  share_of_voice?: number | null;
  status?: 'measured' | 'skipped' | 'error' | null;
};

type PromptResult = {
  prompt_text: string;
  response_text: string;
  model_id: string;
  brand_mentioned: boolean;
  placement: number | null;
  sentiment_score: number | null;
  share_of_voice: number | null;
  competitors_mentioned?: Array<{ name: string; placement: number | null }>;
};

type AuditRecommendation = {
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  deployable: boolean;
  fixType?: string;
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

function scoreColor(s: number | null | undefined): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function sentimentLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Positive', color: 'var(--ok)' };
  if (score >= 40) return { label: 'Neutral', color: 'var(--warn)' };
  return { label: 'Negative', color: 'var(--severe)' };
}

function recognitionStatus(accuracy: number): { label: string; color: string; bg: string } {
  if (accuracy >= 50) return { label: 'Recognized', color: 'var(--ok)', bg: 'color-mix(in srgb, var(--ok) 8%, transparent)' };
  if (accuracy >= 20) return { label: 'Partially recognized', color: 'var(--warn)', bg: 'color-mix(in srgb, var(--warn) 8%, transparent)' };
  return { label: 'Not recognized', color: 'var(--severe)', bg: 'color-mix(in srgb, var(--severe) 8%, transparent)' };
}

/**
 * Normalize raw accuracy label — aligned with buildBenchmark() in multi-model-probe.ts.
 * Returns: 'Accurate' | 'Partial' | 'Inaccurate' | 'Hallucinated' | 'No Data'
 */
function normalizeAccuracy(raw: string | null | undefined): string | null {
  if (!raw) return 'No Data';
  const a = raw.toLowerCase().trim();
  if (a === 'accurate') return 'Accurate';
  if (a === 'partial') return 'Partial';
  if (a === 'inaccurate') return 'Inaccurate';
  if (a === 'hallucinated') return 'Hallucinated';
  if (a === 'no_data' || a === 'no data') return 'No Data';
  if (a.includes('accurate') && !a.includes('partial') && !a.includes('in')) return 'Accurate';
  if (a.includes('partial')) return 'Partial';
  if (a.includes('hallucin')) return 'Hallucinated';
  return 'Inaccurate';
}

/* ── AI Perception helpers ─────────────────────────── */

function accuracyColor(accuracy: string | null | undefined): { bg: string; color: string } {
  const norm = normalizeAccuracy(accuracy);
  if (!norm || norm === 'No Data') return { bg: 'var(--paper-2)', color: 'var(--m-muted)' };
  if (norm === 'Accurate') return { bg: 'rgba(34,197,94,0.1)', color: 'var(--ok)' };
  if (norm === 'Partial') return { bg: 'rgba(234,179,8,0.1)', color: 'var(--warn)' };
  return { bg: 'rgba(239,68,68,0.1)', color: 'var(--severe)' };
}

function accuracyBadge(score: number, status?: 'measured' | 'skipped' | 'error' | null): { label: string; bg: string; color: string } {
  // Non-measured models get neutral badges instead of misleading "Inaccurate"
  if (status === 'skipped') return { label: 'Not configured', bg: 'rgba(148,163,184,0.1)', color: 'var(--m-muted)' };
  if (status === 'error') return { label: 'Error', bg: 'rgba(239,68,68,0.1)', color: 'var(--severe)' };
  if (score >= 80) return { label: 'Accurate', bg: 'rgba(34,197,94,0.1)', color: 'var(--ok)' };
  if (score >= 50) return { label: 'Partial', bg: 'rgba(234,179,8,0.1)', color: 'var(--warn)' };
  if (score >= 15) return { label: 'Low', bg: 'rgba(239,68,68,0.1)', color: 'var(--severe)' };
  return { label: 'Not known', bg: 'rgba(148,163,184,0.12)', color: 'var(--m-muted)' };
}

function perceptionSentimentLabel(s: number | null | undefined): string {
  if (s == null) return 'Not measured';
  if (s >= 75) return 'Very positive';
  if (s >= 60) return 'Positive';
  if (s >= 45) return 'Neutral';
  if (s >= 30) return 'Negative';
  return 'Very negative';
}

function placementLabel(p: number | null | undefined): string {
  if (p == null) return 'Not measured';
  if (p <= 1.5) return `#${p.toFixed(1)} — Top result`;
  if (p <= 2.5) return `#${p.toFixed(1)} — Near the top`;
  if (p <= 3.5) return `#${p.toFixed(1)} — Mid-range`;
  if (p <= 4.5) return `#${p.toFixed(1)} — Lower half`;
  return `#${p.toFixed(1)} — Barely visible`;
}

function placementScoreToPercent(p: number | null | undefined): number | null {
  if (p == null) return null;
  return Math.round(Math.max(0, Math.min(100, (5 - p) / 4 * 100)));
}

function readabilityStatusColor(status: string | undefined): string {
  if (status === 'green') return 'var(--ok)';
  if (status === 'amber') return 'var(--warn)';
  return 'var(--severe)';
}

function makeDraftId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

function fromServer(c: Competitor): DraftCompetitor {
  return {
    id: makeDraftId(),
    domain: c.domain,
    score: typeof c.score === 'number' ? c.score : null,
    source: (c.source === 'manual' ? 'manual' : 'auto'),
    pillarScores: c.pillarScores,
    name: c.name,
    category: c.category,
    note: c.note,
  };
}

const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;
function normalizeDomainInput(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '').toLowerCase();
}

/** Generate executive summary from available data */
function generateExecutiveSummary(params: {
  brandName: string;
  overallScore: number;
  avgAccuracy: number;
  avgPlacement: number | null;
  sentimentScore: number | null;
  visibilityScore: number | null;
  modelCount: number;
  recognizedCount: number;
  isNewBrand: boolean;
  positiveThemes: string[];
  negativeThemes: string[];
  competitorCount: number;
  deltaFromAvg: number | null;
}): string[] {
  const { brandName, overallScore, avgAccuracy, avgPlacement, sentimentScore, visibilityScore, modelCount, recognizedCount, isNewBrand, positiveThemes, negativeThemes, competitorCount, deltaFromAvg } = params;
  const lines: string[] = [];

  if (isNewBrand) {
    lines.push(`AI models have very limited knowledge of ${brandName}. This is typical for newer or niche brands that haven't built significant online presence yet.`);
    lines.push(`Focus on creating clear, structured website content that AI can learn from — explicit positioning, schema markup, and authoritative external mentions will accelerate recognition.`);
    return lines;
  }

  // Recognition line
  if (recognizedCount === modelCount && modelCount > 0) {
    lines.push(`All ${modelCount} AI models recognize ${brandName}. ${avgAccuracy >= 70 ? 'They describe your brand accurately, which is a strong foundation.' : avgAccuracy >= 40 ? 'However, their understanding is inconsistent — some details are missing or inaccurate.' : 'However, their descriptions contain significant gaps and inaccuracies that need addressing.'}`);
  } else if (recognizedCount > 0) {
    lines.push(`${recognizedCount} of ${modelCount} AI models recognize ${brandName}. ${modelCount - recognizedCount} model${modelCount - recognizedCount > 1 ? 's have' : ' has'} limited or no knowledge of your brand, which means you're invisible in those AI ecosystems.`);
  }

  // Positioning line
  if (avgPlacement != null) {
    if (avgPlacement <= 2) {
      lines.push(`When asked about your category, AI models mention ${brandName} early in their responses — a strong signal of brand authority.`);
    } else if (avgPlacement <= 3.5) {
      lines.push(`${brandName} appears mid-list in AI recommendations. You're known but not top-of-mind — there's room to strengthen your positioning.`);
    } else {
      lines.push(`AI models mention ${brandName} late in responses or only in passing. You're rarely surfaced as a primary recommendation.`);
    }
  }

  // Competitive line
  if (competitorCount > 0 && deltaFromAvg != null) {
    if (deltaFromAvg > 10) {
      lines.push(`You outperform the industry average by ${deltaFromAvg} points, giving you an edge in AI-powered discovery.`);
    } else if (deltaFromAvg < -10) {
      lines.push(`You're ${Math.abs(deltaFromAvg)} points below the industry average. Competitors are likely being recommended more frequently by AI.`);
    }
  }

  // Opportunity line — specific, actionable advice
  if (recognizedCount === 0 && modelCount > 0) {
    lines.push(`Next step: add structured data (JSON-LD Organization schema), a clear one-line description in your homepage meta, and get mentioned on industry directories so AI models can learn who you are.`);
  } else if (negativeThemes.length > 0 && avgAccuracy < 40) {
    lines.push(`Next step: AI models are confused about what ${brandName} does. Update your homepage meta description and About page to state your product category, target audience, and core features explicitly.`);
  } else if (negativeThemes.length > 0) {
    lines.push(`Next step: address "${negativeThemes[0]}"${negativeThemes.length > 1 ? ` and "${negativeThemes[1]}"` : ''} — update the relevant pages on your site so AI models pick up accurate information on the next training cycle.`);
  } else if (avgAccuracy < 70) {
    lines.push(`Next step: strengthen your site's machine-readable signals — add JSON-LD schema markup, explicit product descriptions, and FAQ structured data so AI models can parse your positioning accurately.`);
  } else if (avgAccuracy >= 70 && recognizedCount >= modelCount) {
    lines.push(`Your brand is well-represented across AI. Keep your site content current and monitor for accuracy drift as models retrain.`);
  }

  return lines.length > 0 ? lines : [`${brandName} has a ${overallScore >= 70 ? 'strong' : overallScore >= 40 ? 'moderate' : 'weak'} AI brand intelligence profile. Review the detailed breakdown below for specific insights and actions.`];
}

/* ── Main Page ─────────────────────────────────────── */

export default function IntelligencePageWrapper() {
  return (
    <Suspense fallback={null}>
      <IntelligencePage />
    </Suspense>
  );
}

function IntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, workspaceId, loading: wsLoading } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || wsLoading || bundleLoading || !bundle;

  // Brand Intelligence data
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
  const [modelProbes, setModelProbes] = useState<ModelProbe[]>([]);
  const [recommendations, setRecommendations] = useState<AuditRecommendation[]>([]);

  // Benchmark data
  const [drafts, setDrafts] = useState<DraftCompetitor[]>([]);
  const [serverSnapshot, setServerSnapshot] = useState<DraftCompetitor[]>([]);
  const [benchmarkPosition, setBenchmarkPosition] = useState<BenchmarkPosition | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Human Perception data (Tier 2)
  const [humanPerception, setHumanPerception] = useState<any>(null);
  const [redditMentions, setRedditMentions] = useState<any[]>([]);
  const [webMentions, setWebMentions] = useState<any[]>([]);
  const [reviewData, setReviewData] = useState<any[]>([]);
  const [trendSnapshots, setTrendSnapshots] = useState<any[]>([]);
  const [contentGaps, setContentGaps] = useState<any[]>([]);

  // AI Perception data
  const [promptResults, setPromptResults] = useState<PromptResult[]>([]);
  const [fallbackCompetitors, setFallbackCompetitors] = useState<Array<{
    name: string; domain: string; score: number;
  }>>([]);

  // Re-scan state
  const [rescanning, setRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);
  const [rescanAvailable, setRescanAvailable] = useState(true);
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

  // Read ?tab= from URL to allow deep-linking (e.g. from Competitors page)
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get('tab');
    if (t === 'perception' || t === 'pages') return t;
    return 'overview' as const;
  })();

  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'perception' | 'pages'>(initialTab);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [showCompetitorEditor, setShowCompetitorEditor] = useState(false);
  const [signalFilter, setSignalFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [showMethodology, setShowMethodology] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  // AI Interrogation state
  const [iqQuestions, setIqQuestions] = useState<Array<{ questionId: string; questionText: string; family: string; relevanceScore: number; rankReason: string }>>([]);
  const [iqQuestionsLoading, setIqQuestionsLoading] = useState(false);
  const [iqSelectedModels, setIqSelectedModels] = useState<string[]>([
    'perplexity/sonar',
    'deepseek/deepseek-chat-v3-0324',
    'openai/gpt-4o-mini',
  ]);
  const [iqUsage, setIqUsage] = useState<{ checksUsed: number; checksLimit: number; checksRemaining: number; canInterrogate: boolean } | null>(null);
  const [iqRunning, setIqRunning] = useState(false);
  const [iqActiveQuestion, setIqActiveQuestion] = useState<string | null>(null);
  const [iqResults, setIqResults] = useState<Array<{ modelSlug: string; modelShortId: string; modelDisplayName: string; status: string; responseText: string | null; themes: string[]; accuracy: string | null; accuracyNote: string | null; latencyMs: number | null; error: string | null }>>([]);
  // Past interrogation results — keyed by question_text for dedup + instant replay
  const [iqPastResults, setIqPastResults] = useState<Map<string, Array<{ modelSlug: string; modelShortId: string; modelDisplayName: string; status: string; responseText: string | null; themes: string[]; accuracy: string | null; accuracyNote: string | null; latencyMs: number | null; error: string | null }>>>(new Map());

  // Pages tab data
  const [auditPages, setAuditPages] = useState<AuditPageRow[]>([]);
  const [pageSort, setPageSort] = useState<'score-asc' | 'score-desc' | 'name'>('score-desc');

  /* ── AI Interrogation constants ─────────────────────── */
  const IQ_MODEL_DISPLAY: { shortId: string; slug: string; free?: boolean }[] = useMemo(() => [
    // Free models — included with every audit
    { shortId: 'perplexity', slug: 'perplexity/sonar', free: true },
    { shortId: 'deepseek', slug: 'deepseek/deepseek-chat-v3-0324', free: true },
    { shortId: 'chatgpt', slug: 'openai/gpt-4o-mini', free: true },
    // Premium models — opt-in, costs a check
    { shortId: 'gemini', slug: 'google/gemini-2.5-flash' },
    { shortId: 'grok', slug: 'x-ai/grok-4.3' },
    { shortId: 'meta', slug: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  ], []);
  const IQ_MAX_MODELS = 3;

  /* ── AI Interrogation data fetching ────────────────── */
  const fetchIqQuestions = useCallback(async () => {
    if (!workspaceId) return;
    setIqQuestionsLoading(true);
    try {
      const res = await fetch(`/api/ai-interrogation/questions?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      const data = await res.json();
      setIqQuestions((data.questions ?? []).slice(0, 10));
    } catch { /* silent */ } finally {
      setIqQuestionsLoading(false);
    }
  }, [workspaceId]);

  const fetchIqUsage = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/ai-interrogation/usage?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      setIqUsage(await res.json());
    } catch { /* silent */ }
  }, [workspaceId]);

  const fetchIqPastResults = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/ai-interrogation/run?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      const data = await res.json();
      const items = data.interrogations ?? [];
      const map = new Map<string, Array<{ modelSlug: string; modelShortId: string; modelDisplayName: string; status: string; responseText: string | null; themes: string[]; accuracy: string | null; accuracyNote: string | null; latencyMs: number | null; error: string | null }>>();
      for (const item of items) {
        const qText = item.interrogation?.question_text;
        if (!qText) continue;
        const results = (item.results ?? []).map((r: any) => {
          const slug = r.model_slug ?? '';
          const shortId = IQ_MODEL_DISPLAY.find((m) => m.slug === slug)?.shortId ?? slug;
          const prov = providerKeyToIcon(shortId);
          return {
            modelSlug: slug,
            modelShortId: shortId,
            modelDisplayName: r.model_label ?? (prov ? PROVIDER_LABEL[prov] : shortId),
            status: r.status ?? 'completed',
            responseText: r.response_text ?? null,
            themes: r.themes ?? [],
            accuracy: r.accuracy ?? null,
            accuracyNote: r.accuracy_note ?? null,
            latencyMs: r.latency_ms ?? null,
            error: r.error_message ?? null,
          };
        });
        // Keep the most recent result per question (first in the list since ordered desc)
        if (!map.has(qText) && results.length > 0) {
          map.set(qText, results);
        }
      }
      setIqPastResults(map);
    } catch { /* silent */ }
  }, [workspaceId, IQ_MODEL_DISPLAY]);

  useEffect(() => {
    if (!workspaceId) return;
    fetchIqQuestions();
    fetchIqUsage();
    fetchIqPastResults();
  }, [workspaceId, fetchIqQuestions, fetchIqUsage, fetchIqPastResults]);

  // Auto-load answers for the first pinned question when past results are available
  useEffect(() => {
    if (iqActiveQuestion || iqQuestions.length === 0 || iqPastResults.size === 0) return;
    // Find the first question (pinned = first 3) that has cached results
    for (let i = 0; i < Math.min(3, iqQuestions.length); i++) {
      const q = iqQuestions[i];
      const cached = iqPastResults.get(q.questionText);
      if (cached && cached.length > 0) {
        setIqActiveQuestion(q.questionText);
        setIqResults(cached);
        break;
      }
    }
  }, [iqQuestions, iqPastResults, iqActiveQuestion]);

  const toggleIqModel = (slug: string) => {
    setIqSelectedModels((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= IQ_MAX_MODELS) return prev;
      return [...prev, slug];
    });
  };

  const handleIqAsk = async (questionText: string, family?: string) => {
    if (!workspaceId || !questionText.trim() || iqRunning) return;
    const trimmed = questionText.trim();

    // Check for saved (cached) results for this question
    const savedResults = iqPastResults.get(trimmed);

    // Per-question model memory: if we have saved results, check if any
    // currently-selected models already have cached answers we can show instantly
    if (savedResults && savedResults.length > 0) {
      // Find which selected models already have cached answers
      const cachedForSelected = savedResults.filter(r => iqSelectedModels.includes(r.modelSlug));
      // Find which selected models need new answers
      const uncachedModels = iqSelectedModels.filter(slug => !savedResults.some(r => r.modelSlug === slug));

      if (uncachedModels.length === 0) {
        // All selected models have cached results — show instantly, no API call
        setIqActiveQuestion(trimmed);
        setIqResults(cachedForSelected.length > 0 ? cachedForSelected : savedResults);
        return;
      }

      // Some models have cached answers, some don't — show cached immediately
      // and fire API call for only the uncached ones
      if (cachedForSelected.length > 0) {
        setIqActiveQuestion(trimmed);
        const pendingNew = uncachedModels.map((slug) => {
          const shortId = IQ_MODEL_DISPLAY.find((m) => m.slug === slug)?.shortId ?? slug;
          const provider = providerKeyToIcon(shortId);
          return {
            modelSlug: slug,
            modelShortId: shortId,
            modelDisplayName: provider ? PROVIDER_LABEL[provider] : shortId,
            status: 'running' as string,
            responseText: null,
            themes: [] as string[],
            accuracy: null as string | null,
            accuracyNote: null as string | null,
            latencyMs: null,
            error: null,
          };
        });
        setIqResults([...cachedForSelected, ...pendingNew]);
        setIqRunning(true);

        const matchingQuestion = iqQuestions.find((q) => q.questionText === trimmed);
        try {
          const res = await fetch('/api/ai-interrogation/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: workspaceId,
              question_id: matchingQuestion?.questionId ?? null,
              question_text: trimmed,
              question_family: family ?? matchingQuestion?.family ?? 'general_discovery',
              selected_models: uncachedModels,
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(err.error ?? 'Request failed');
          }
          const data = await res.json();
          const mapped = (data.results ?? []).map((r: any) => {
            const slug = r.modelSlug ?? r.model_slug ?? '';
            const shortId = IQ_MODEL_DISPLAY.find((m) => m.slug === slug)?.shortId ?? slug;
            const prov = providerKeyToIcon(shortId);
            return {
              modelSlug: slug,
              modelShortId: shortId,
              modelDisplayName: r.modelLabel ?? r.model_label ?? (prov ? PROVIDER_LABEL[prov] : shortId),
              status: r.status ?? 'completed',
              responseText: r.responseText ?? r.response_text ?? null,
              themes: r.themes ?? [],
              accuracy: r.accuracy ?? null,
              accuracyNote: r.accuracyNote ?? r.accuracy_note ?? null,
              latencyMs: r.latencyMs ?? r.latency_ms ?? null,
              error: r.error ?? r.errorMessage ?? r.error_message ?? null,
            };
          });
          const combined = [...cachedForSelected, ...mapped];
          setIqResults(combined);
          // Update cache with merged results
          if (combined.length > 0) {
            setIqPastResults(prev => {
              const next = new Map(prev);
              const existing = next.get(trimmed) ?? [];
              // Merge: keep existing + add new (no duplicates by modelSlug)
              const merged = [...existing];
              for (const r of mapped) {
                if (!merged.some(e => e.modelSlug === r.modelSlug)) merged.push(r);
              }
              next.set(trimmed, merged);
              return next;
            });
          }
          if (data.usage) {
            setIqUsage({
              checksUsed: data.usage.checksUsed ?? 0,
              checksLimit: data.usage.checksLimit ?? 0,
              checksRemaining: data.usage.checksRemaining ?? 0,
              canInterrogate: (data.usage.checksRemaining ?? 0) > 0,
            });
          } else {
            fetchIqUsage();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Something went wrong';
          setIqResults([...cachedForSelected, ...pendingNew.map((r) => ({ ...r, status: 'failed', error: msg }))]);
        } finally {
          setIqRunning(false);
        }
        return;
      }
    }

    // Need models selected for a new query
    if (iqSelectedModels.length === 0) return;

    const matchingQuestion = iqQuestions.find((q) => q.questionText === trimmed);

    setIqActiveQuestion(trimmed);
    setIqRunning(true);

    // Set pending results
    const pending = iqSelectedModels.map((slug) => {
      const shortId = IQ_MODEL_DISPLAY.find((m) => m.slug === slug)?.shortId ?? slug;
      const provider = providerKeyToIcon(shortId);
      return {
        modelSlug: slug,
        modelShortId: shortId,
        modelDisplayName: provider ? PROVIDER_LABEL[provider] : shortId,
        status: 'running' as string,
        responseText: null,
        themes: [] as string[],
        accuracy: null as string | null,
        accuracyNote: null as string | null,
        latencyMs: null,
        error: null,
      };
    });
    setIqResults(pending);

    try {
      const res = await fetch('/api/ai-interrogation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          question_id: matchingQuestion?.questionId ?? null,
          question_text: trimmed,
          question_family: family ?? matchingQuestion?.family ?? 'general_discovery',
          selected_models: iqSelectedModels,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? 'Request failed');
      }
      const data = await res.json();
      const mapped = (data.results ?? []).map((r: any) => {
        const slug = r.modelSlug ?? r.model_slug ?? '';
        const shortId = IQ_MODEL_DISPLAY.find((m) => m.slug === slug)?.shortId ?? slug;
        const prov = providerKeyToIcon(shortId);
        return {
          modelSlug: slug,
          modelShortId: shortId,
          modelDisplayName: r.modelLabel ?? r.model_label ?? (prov ? PROVIDER_LABEL[prov] : shortId),
          status: r.status ?? 'completed',
          responseText: r.responseText ?? r.response_text ?? null,
          themes: r.themes ?? [],
          accuracy: r.accuracy ?? null,
          accuracyNote: r.accuracyNote ?? r.accuracy_note ?? null,
          latencyMs: r.latencyMs ?? r.latency_ms ?? null,
          error: r.error ?? r.errorMessage ?? r.error_message ?? null,
        };
      });
      setIqResults(mapped);
      // Cache in pastResults so re-clicking won't charge again
      if (mapped.length > 0) {
        setIqPastResults(prev => {
          const next = new Map(prev);
          const existing = next.get(trimmed) ?? [];
          const merged = [...existing];
          for (const r of mapped) {
            if (!merged.some(e => e.modelSlug === r.modelSlug)) merged.push(r);
          }
          next.set(trimmed, merged);
          return next;
        });
      }
      // Update counter from the POST response (faster than a separate fetch)
      if (data.usage) {
        setIqUsage({
          checksUsed: data.usage.checksUsed ?? 0,
          checksLimit: data.usage.checksLimit ?? 0,
          checksRemaining: data.usage.checksRemaining ?? 0,
          canInterrogate: (data.usage.checksRemaining ?? 0) > 0,
        });
      } else {
        fetchIqUsage();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setIqResults(pending.map((r) => ({ ...r, status: 'failed', error: msg })));
    } finally {
      setIqRunning(false);
    }
  };

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setDrafts([]); setServerSnapshot([]); setBenchmarkPosition(null); setIndustry(null);
      setBiSummary(null); setModelProbes([]); setRecommendations([]); setPromptResults([]);
      setHumanPerception(null); setRedditMentions([]); setWebMentions([]);
      setReviewData([]); setTrendSnapshots([]); setContentGaps([]);
      return;
    }

    const report = bundle?.report;
    if (report && (report as any).brand_intelligence) {
      setBiSummary((report as any).brand_intelligence as BrandIntelligenceSummary);
    }

    // Fetch per-page AI readability data
    const supabase = createBrowserSupabase();
    supabase
      .from('audit_pages')
      .select('id, url, title, ai_readability')
      .eq('audit_id', audit.id)
      .then(({ data }) => setAuditPages((data || []) as AuditPageRow[]));

    fetch(`/api/audits/intelligence?audit_id=${audit.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
        if (d?.modelProbes) {
          setModelProbes(d.modelProbes);
          // Compute cooldown from latest probe created_at (168-hour / 7-day window)
          const COOLDOWN_HOURS = 168;
          const probes = d.modelProbes as any[];
          if (probes.length > 0) {
            const latestCreated = probes
              .map((p: any) => new Date(p.created_at).getTime())
              .reduce((a: number, b: number) => Math.max(a, b), 0);
            const hoursSince = (Date.now() - latestCreated) / (1000 * 60 * 60);
            if (hoursSince < COOLDOWN_HOURS) {
              setRescanAvailable(false);
              const nextAtMs = latestCreated + COOLDOWN_HOURS * 60 * 60 * 1000;
              setCooldownMessage(formatCooldown(nextAtMs));
            } else {
              setRescanAvailable(true);
              setCooldownMessage(null);
            }
          }
        }
        if (d?.promptResults) setPromptResults(d.promptResults);
        if (d?.recommendations) setRecommendations(d.recommendations);
        setHumanPerception(d?.humanPerception || null);
        setRedditMentions(d?.redditMentions || []);
        setWebMentions(d?.webMentions || []);
        setReviewData(d?.reviewData || []);
        setTrendSnapshots(d?.trendSnapshots || []);
        setContentGaps(d?.contentGaps || []);
      })
      .catch(() => {});

    const productUrl = audit.product_url;
    if (productUrl) {
      fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
        .then(r => r.json())
        .then(d => {
          const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
          setDrafts(list); setServerSnapshot(list);
          if (d?.industry) setIndustry(d.industry);
          // Also set fallback competitors for perception tab
          setFallbackCompetitors(
            (d?.competitors || []).map((c: any) => ({
              name: c.name || c.domain,
              domain: c.domain,
              score: c.score ?? 0,
            }))
          );
        })
        .catch(() => {});
    }
  }, [bundle]);

  const productUrl = bundle?.audit?.product_url || '';
  const isBrandAudit = bundle?.audit && (bundle.audit as any).audit_type === 'brand_identity';
  const overallScore = bundle?.report?.overall_score ?? 0;

  // Brand identity
  let domain: string | null = null;
  try { domain = new URL(productUrl || '').hostname.replace(/^www\./, ''); } catch {}
  const brandName = (bundle?.audit as any)?.brand_name || workspace?.name || domain || 'your brand';
  const isNewBrand = modelProbes.length > 0 && modelProbes.every(p => p.accuracy_score < 15);

  const hasRealHumanData = (reviewData.length > 0 || redditMentions.length > 0 || webMentions.length > 0);
  const hp = humanPerception;
  const scoredDrafts = drafts.filter(d => typeof d.score === 'number' && d.score > 0);
  const humanSentimentScore = hp?.socialSentiment ?? (hp?.reviewScore != null ? Math.round(hp.reviewScore * 20) : null);

  /* ── Merged model breakdown ──────────────────────────────
   * RULE 2: Question-level cards and model-by-model breakdown must come
   * from the SAME saved evaluated records.
   * This merges audit-time probes (multi_model_probes) with interactive
   * interrogation results (workspace_ai_interrogation_results) so the
   * breakdown reflects ALL evaluated records, not just one source.
   * Accuracy is recomputed using the canonical formula:
   *   (accurate*100 + partial*50 + noData*25) / (total*100) * 100
   */
  const mergedModelBreakdown = useMemo(() => {
    type MergedRecord = { accuracy: string | null };
    const modelRecords = new Map<string, {
      label: string;
      records: MergedRecord[];
      sentimentScores: number[];
      placementScores: number[];
      themes: Array<{ theme: string; polarity: string; count: number }>;
      status: 'measured' | 'skipped' | 'error' | null;
    }>();

    // Source 1: audit-time probes (from multi_model_probes table)
    for (const probe of modelProbes) {
      const key = probe.model_id;
      if (!modelRecords.has(key)) {
        modelRecords.set(key, { label: probe.model_label, records: [], sentimentScores: [], placementScores: [], themes: [], status: probe.status ?? null });
      }
      const entry = modelRecords.get(key)!;
      // Promote status: measured > error > skipped (best status wins across multiple probe rows)
      if (probe.status === 'measured') entry.status = 'measured';
      else if (probe.status === 'error' && entry.status !== 'measured') entry.status = 'error';
      if (probe.results_json) {
        for (const r of probe.results_json) {
          entry.records.push({ accuracy: r.accuracy });
        }
      }
      if (probe.sentiment_score != null) entry.sentimentScores.push(probe.sentiment_score);
      if (probe.placement_score != null) entry.placementScores.push(probe.placement_score);
      if (probe.sentiment_themes) entry.themes.push(...probe.sentiment_themes);
    }

    // Source 2: interactive interrogation results (from workspace_ai_interrogation_results)
    for (const [, results] of iqPastResults) {
      for (const r of results) {
        if (r.status !== 'completed' || !r.accuracy) continue;
        const key = r.modelShortId;
        if (!modelRecords.has(key)) {
          modelRecords.set(key, { label: r.modelDisplayName, records: [], sentimentScores: [], placementScores: [], themes: [], status: null });
        }
        modelRecords.get(key)!.records.push({ accuracy: r.accuracy });
      }
    }

    // Compute accuracy per model using canonical formula
    return Array.from(modelRecords.entries())
      .filter(([, data]) => data.records.length > 0)
      .map(([modelId, data]) => {
        const counts = { accurate: 0, partial: 0, inaccurate: 0, hallucinated: 0, noData: 0 };
        for (const r of data.records) {
          const norm = normalizeAccuracy(r.accuracy)?.toLowerCase().trim() ?? 'no data';
          if (norm === 'accurate') counts.accurate++;
          else if (norm === 'partial') counts.partial++;
          else if (norm === 'inaccurate') counts.inaccurate++;
          else if (norm === 'hallucinated') counts.hallucinated++;
          else counts.noData++;
        }
        const total = data.records.length;
        const accuracyScore = total > 0
          ? Math.round(((counts.accurate * 100 + counts.partial * 50 + counts.noData * 25) / (total * 100)) * 100)
          : 0;

        const avgSentiment = data.sentimentScores.length > 0
          ? Math.round(data.sentimentScores.reduce((a, b) => a + b, 0) / data.sentimentScores.length)
          : null;
        const avgPlac = data.placementScores.length > 0
          ? Math.round(data.placementScores.reduce((a, b) => a + b, 0) / data.placementScores.length)
          : null;

        // Deduplicate themes
        const themeMap = new Map<string, { polarity: string; count: number }>();
        for (const t of data.themes) {
          const k = t.theme.toLowerCase();
          const ex = themeMap.get(k);
          if (ex) ex.count += t.count;
          else themeMap.set(k, { polarity: t.polarity, count: t.count });
        }

        return {
          model_id: modelId,
          model_label: data.label,
          accuracy_score: accuracyScore,
          sentiment_score: avgSentiment,
          placement_score: avgPlac,
          sentiment_themes: [...themeMap.entries()].map(([theme, v]) => ({ theme, polarity: v.polarity, count: v.count })),
          total_questions: total,
          status: data.status,
        };
      })
      .sort((a, b) => b.accuracy_score - a.accuracy_score);
  }, [modelProbes, iqPastResults]);

  const hasModelBreakdown = mergedModelBreakdown.length > 0;

  // Computed metrics — use merged breakdown when available for truthful numbers
  const avgAccuracy = useMemo(() => {
    if (mergedModelBreakdown.length > 0) {
      return Math.round(mergedModelBreakdown.reduce((a, p) => a + p.accuracy_score, 0) / mergedModelBreakdown.length);
    }
    if (modelProbes.length === 0) return 0;
    return Math.round(modelProbes.reduce((a, p) => a + p.accuracy_score, 0) / modelProbes.length);
  }, [modelProbes, mergedModelBreakdown]);

  const avgPlacement = useMemo(() => {
    const placements = modelProbes.map(p => p.placement_score).filter((p): p is number => p != null);
    return placements.length > 0 ? placements.reduce((a, b) => a + b, 0) / placements.length : null;
  }, [modelProbes]);

  const recognizedCount = useMemo(() => {
    return modelProbes.filter(p => p.accuracy_score >= 20).length;
  }, [modelProbes]);

  const coverageScore = useMemo(() => {
    if (modelProbes.length === 0) return null;
    return Math.round((recognizedCount / modelProbes.length) * 100);
  }, [modelProbes, recognizedCount]);

  const sentimentScore = useMemo(() => {
    if (biSummary?.overallSentiment != null) return biSummary.overallSentiment;
    const sentiments = modelProbes.map(p => p.sentiment_score).filter((s): s is number => s != null);
    return sentiments.length > 0 ? Math.round(sentiments.reduce((a, b) => a + b, 0) / sentiments.length) : null;
  }, [biSummary, modelProbes]);

  const visibilityScore = useMemo(() => {
    // Use aiVisibility (% of models that mention the brand) — matches BrandIntelligenceCard
    if (biSummary?.aiVisibility != null) return biSummary.aiVisibility;
    // Fallback: compute from probe data — use same threshold as recognizedCount (>= 20)
    // so the percentage and the "X of Y" text never contradict each other
    if (modelProbes.length === 0) return null;
    const mentioned = modelProbes.filter(p => p.accuracy_score >= 20).length;
    return Math.round((mentioned / modelProbes.length) * 100);
  }, [biSummary, modelProbes]);

  // Hallucinations — extract from probe results where accuracy is inaccurate/fabricated
  const hallucinations = useMemo(() => {
    const items: Array<{ model: string; question: string; answer: string; note?: string }> = [];
    for (const probe of modelProbes) {
      if (!probe.results_json) continue;
      for (const r of probe.results_json) {
        const norm = normalizeAccuracy(r.accuracy);
        if (norm === 'Inaccurate' || norm === 'Hallucinated') {
          items.push({ model: probe.model_label, question: r.question, answer: r.answer, note: r.accuracyNote || undefined });
        }
      }
    }
    return items;
  }, [modelProbes]);

  /* ── AI Perception computed values ─────────────────── */

  const perceptionMeasured = useMemo(() => modelProbes.filter(p => p.status === 'measured' && p.accuracy_score != null), [modelProbes]);

  // Use merged breakdown accuracy when available (includes interactive results)
  const perceptionAccuracy = useMemo(() => {
    if (mergedModelBreakdown.length > 0) {
      return Math.round(mergedModelBreakdown.reduce((s, p) => s + p.accuracy_score, 0) / mergedModelBreakdown.length);
    }
    if (perceptionMeasured.length === 0) return null;
    return Math.round(perceptionMeasured.reduce((s, p) => s + p.accuracy_score, 0) / perceptionMeasured.length);
  }, [perceptionMeasured, mergedModelBreakdown]);

  const perceptionSentiment = useMemo(() => {
    const valid = modelProbes.filter(p => p.sentiment_score != null);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, p) => s + (p.sentiment_score || 0), 0) / valid.length);
  }, [modelProbes]);

  const perceptionPlacement = useMemo(() => {
    const valid = modelProbes.filter(p => p.placement_score != null);
    if (valid.length === 0) return null;
    return +(valid.reduce((s, p) => s + (p.placement_score || 0), 0) / valid.length).toFixed(1);
  }, [modelProbes]);

  const allThemes = useMemo(() => {
    const themes: Array<{ theme: string; polarity: string; count: number }> = [];
    for (const probe of modelProbes) {
      if (probe.sentiment_themes) themes.push(...probe.sentiment_themes);
    }
    const map = new Map<string, { polarity: string; count: number }>();
    for (const t of themes) {
      const key = t.theme.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.count += t.count;
      else map.set(key, { polarity: t.polarity, count: t.count });
    }
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([theme, v]) => ({ theme, polarity: v.polarity, count: v.count }));
  }, [modelProbes]);

  const competitorData = useMemo(() => {
    const compMap = new Map<string, { mentions: number; placements: number[]; byModel: Record<string, number[]> }>();
    for (const pr of promptResults) {
      if (!pr.competitors_mentioned) continue;
      for (const comp of pr.competitors_mentioned) {
        const name = comp.name?.trim();
        if (!name) continue;
        const entry = compMap.get(name) || { mentions: 0, placements: [], byModel: {} };
        entry.mentions++;
        if (comp.placement != null) entry.placements.push(comp.placement);
        if (!entry.byModel[pr.model_id]) entry.byModel[pr.model_id] = [];
        if (comp.placement != null) entry.byModel[pr.model_id].push(comp.placement);
        compMap.set(name, entry);
      }
    }
    return [...compMap.entries()]
      .map(([name, data]) => ({
        name,
        mentions: data.mentions,
        avgPlacement: data.placements.length > 0
          ? Math.round((data.placements.reduce((a, b) => a + b, 0) / data.placements.length) * 10) / 10
          : null,
        byModel: Object.fromEntries(
          Object.entries(data.byModel).map(([m, placements]) => [
            m,
            placements.length > 0 ? Math.round((placements.reduce((a, b) => a + b, 0) / placements.length) * 10) / 10 : null,
          ])
        ) as Record<string, number | null>,
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10);
  }, [promptResults]);

  const questionGroups = useMemo(() => {
    const groups = new Map<string, Array<{ model_id: string; model_label: string; answer: string; accuracy: string | null; accuracyNote?: string | null }>>();
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
          accuracyNote: r.accuracyNote,
        });
      }
    }
    return Array.from(groups.entries()).map(([question, answers]) => ({ question, answers }));
  }, [modelProbes]);

  // All human signals merged
  const allSignals = useMemo(() => {
    const signals: Array<{ type: string; title: string; source: string; sourceUrl?: string; sentiment: string; date?: string; score?: number }> = [];
    redditMentions.forEach((m: any) => signals.push({
      type: 'reddit', title: m.post_title, source: `r/${m.subreddit}`, sourceUrl: m.post_url,
      sentiment: m.sentiment || 'neutral', date: m.created_at, score: m.score,
    }));
    webMentions.forEach((m: any) => signals.push({
      type: 'web', title: m.title, source: m.source_domain, sourceUrl: m.source_url,
      sentiment: m.sentiment || 'neutral', date: m.fetched_at,
    }));
    reviewData.forEach((r: any) => signals.push({
      type: 'review', title: `${r.platform} — ${r.aggregate_score}/5 (${r.review_count} reviews)`,
      source: r.platform, sentiment: r.aggregate_score >= 4 ? 'positive' : r.aggregate_score >= 3 ? 'neutral' : 'negative',
      score: r.aggregate_score,
    }));
    return signals;
  }, [redditMentions, webMentions, reviewData]);

  const filteredSignals = signalFilter === 'all' ? allSignals : allSignals.filter(s => s.sentiment === signalFilter);

  // Executive summary
  const executiveSummary = useMemo(() => {
    if (modelProbes.length === 0 && !biSummary) return [];
    return generateExecutiveSummary({
      brandName,
      overallScore,
      avgAccuracy,
      avgPlacement,
      sentimentScore,
      visibilityScore,
      modelCount: modelProbes.length,
      recognizedCount,
      isNewBrand,
      positiveThemes: biSummary?.positiveThemes || [],
      negativeThemes: biSummary?.negativeThemes || [],
      competitorCount: scoredDrafts.length,
      deltaFromAvg: benchmarkPosition?.deltaFromAvg ?? null,
    });
  }, [brandName, overallScore, avgAccuracy, avgPlacement, sentimentScore, visibilityScore, modelProbes.length, recognizedCount, isNewBrand, biSummary, scoredDrafts.length, benchmarkPosition]);

  // Group recommendations by category
  const groupedRecs = useMemo(() => {
    const groups: Record<string, AuditRecommendation[]> = {};
    for (const rec of recommendations) {
      const cat = rec.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(rec);
    }
    return groups;
  }, [recommendations]);

  // Competitor helpers
  const isDirty = useMemo(() => {
    if (drafts.length !== serverSnapshot.length) return true;
    const a = drafts.map(c => c.domain).sort();
    const b = serverSnapshot.map(c => c.domain).sort();
    return a.some((v, i) => v !== b[i]);
  }, [drafts, serverSnapshot]);

  const addRow = () => {
    setError(null); setInfo(null);
    if (drafts.length >= 5) { setError('You can track up to 5 competitors.'); return; }
    setDrafts(prev => [...prev, { id: makeDraftId(), domain: '', score: null, source: 'manual' }]);
  };
  const updateRow = (id: string, patch: Partial<DraftCompetitor>) => setDrafts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeRow = (id: string) => setDrafts(prev => prev.filter(c => c.id !== id));
  const resetEdits = () => { setDrafts(serverSnapshot); setError(null); setInfo(null); };

  const validate = (): { ok: true; cleaned: DraftCompetitor[] } | { ok: false; message: string } => {
    const cleaned: DraftCompetitor[] = [];
    const seen = new Set<string>();
    for (const d of drafts) {
      const dom = normalizeDomainInput(d.domain);
      if (!dom) return { ok: false, message: 'Every competitor needs a domain.' };
      if (!DOMAIN_RE.test(dom)) return { ok: false, message: `"${d.domain}" is not a valid domain (e.g. example.com).` };
      if (seen.has(dom)) return { ok: false, message: `"${dom}" is listed twice. Remove duplicates.` };
      seen.add(dom);
      cleaned.push({ ...d, domain: dom });
    }
    return { ok: true, cleaned };
  };

  const saveDrafts = async () => {
    if (!productUrl) return;
    setError(null); setInfo(null);
    const v = validate();
    if (!v.ok) { setError((v as { ok: false; message: string }).message); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, mode: 'save', competitors: v.cleaned.map(c => ({ domain: c.domain, ...(c.name ? { name: c.name } : {}), ...(c.category ? { category: c.category } : {}), ...(c.note ? { note: c.note } : {}) })) }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Failed to save'); }
      const d = await res.json();
      const next: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(next); setServerSnapshot(next);
      setInfo('Saved. Click Re-scan to refresh scores.');
    } catch (e: any) { setError(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const runAutoDetect = async () => {
    if (!productUrl) return;
    setError(null); setInfo(null); setDetecting(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, mode: 'auto' }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Auto-detect failed'); }
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list); setServerSnapshot(list);
      if (d?.industry) setIndustry(d.industry);
      setInfo(list.length === 0 ? 'Could not identify competitors. Add them manually.' : 'Auto-detected. You can edit or add your own.');
    } catch (e: any) { setError(e?.message || 'Auto-detect failed'); }
    finally { setDetecting(false); }
  };

  const rescanScores = async () => {
    if (!productUrl) return;
    const domainsOnly = drafts.map(d => normalizeDomainInput(d.domain)).filter(Boolean);
    if (domainsOnly.length === 0) { setError('Add at least one competitor before re-scanning.'); return; }
    setError(null); setInfo(null); setDetecting(true);
    try {
      const res = await fetch('/api/audits/detect-competitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl, mode: 'manual', competitors: drafts.map(d => ({ domain: normalizeDomainInput(d.domain), ...(d.name ? { name: d.name } : {}) })) }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || 'Re-scan failed'); }
      const d = await res.json();
      const list: DraftCompetitor[] = (d?.competitors || []).map((c: Competitor) => fromServer(c));
      setDrafts(list); setServerSnapshot(list); setInfo('Re-scan complete.');
    } catch (e: any) { setError(e?.message || 'Re-scan failed'); }
    finally { setDetecting(false); }
  };

  /** Format a cooldown remaining duration into a human-readable string. */
  const formatCooldown = (nextAtMs: number): string => {
    const msLeft = Math.max(0, nextAtMs - Date.now());
    const minutesLeft = Math.ceil(msLeft / (1000 * 60));
    const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    let timeStr: string;
    if (minutesLeft < 60) {
      timeStr = minutesLeft === 1 ? '1 minute' : `${minutesLeft} minutes`;
    } else if (hoursLeft < 48) {
      timeStr = hoursLeft === 1 ? '1 hour' : `${hoursLeft} hours`;
    } else {
      timeStr = `${daysLeft} days`;
    }
    return `Cooldown resets in ${timeStr}. AI models need time to process new web content.`;
  };

  const handleRescan = async () => {
    const auditId = bundle?.audit?.id;
    if (!auditId || rescanning) return;
    setRescanning(true);
    setRescanMessage(null);
    try {
      const res = await fetch(`/api/audits/${auditId}/rescan-xray`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRescanMessage(data.error || 'Re-scan failed');
        return;
      }
      if (data.cached) {
        const nextAtMs = new Date(data.nextScanAvailableAt).getTime();
        const msg = formatCooldown(nextAtMs);
        setRescanMessage(msg);
        setRescanAvailable(false);
        setCooldownMessage(msg);
        return;
      }
      setRescanMessage('Re-scan complete. Results updated.');
      const freshCooldownMs = Date.now() + 168 * 60 * 60 * 1000;
      setRescanAvailable(false);
      setCooldownMessage(formatCooldown(freshCooldownMs));
      const probesRes = await fetch(`/api/audits/intelligence?audit_id=${auditId}`);
      if (probesRes.ok) {
        const d = await probesRes.json();
        if (d?.modelProbes) setModelProbes(d.modelProbes);
        if (d?.promptResults) setPromptResults(d.promptResults);
        if (d?.brandIntelligence) setBiSummary(d.brandIntelligence as BrandIntelligenceSummary);
      }
    } catch {
      setRescanMessage('Re-scan failed. Please try again later.');
    } finally {
      setRescanning(false);
    }
  };

  // Pages tab computed values
  const sortedPages = useMemo(() => {
    const sorted = [...auditPages];
    if (pageSort === 'score-asc') sorted.sort((a, b) => (a.ai_readability?.overallScore ?? 999) - (b.ai_readability?.overallScore ?? 999));
    else if (pageSort === 'score-desc') sorted.sort((a, b) => (b.ai_readability?.overallScore ?? -1) - (a.ai_readability?.overallScore ?? -1));
    else sorted.sort((a, b) => (a.title || a.url).localeCompare(b.title || b.url));
    return sorted;
  }, [auditPages, pageSort]);

  const pagesScored = auditPages.filter(p => p.ai_readability?.overallScore != null);
  const avgPageScore = pagesScored.length > 0
    ? Math.round(pagesScored.reduce((s, p) => s + (p.ai_readability!.overallScore || 0), 0) / pagesScored.length)
    : null;
  const pagesGreen = pagesScored.filter(p => p.ai_readability?.status === 'green').length;
  const pagesAmber = pagesScored.filter(p => p.ai_readability?.status === 'amber').length;
  const pagesRed = pagesScored.filter(p => p.ai_readability?.status === 'red').length;

  const hasData = biSummary || modelProbes.length > 0 || overallScore > 0;
  const hasProbes = modelProbes.length > 0;
  const hasPerceptionSentiment = perceptionSentiment != null;
  const hasPerceptionPlacement = perceptionPlacement != null;
  const hasCompetitorProbeData = competitorData.length > 0;
  const hasFallbackCompetitors = fallbackCompetitors.length > 0;
  const brandIsUnknown = hasProbes && perceptionAccuracy != null && perceptionAccuracy === 0;

  /* ── Render ────────────────────────────────────────── */

  if (loading) {
    return (
      <div>
        <div className="h-8 w-48 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="h-[200px] rounded-xl animate-pulse mb-4" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-[180px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!bundle?.audit || !bundle.report) {
    return (
      <div>
        <OverviewBreadcrumb current="Brand Intelligence" />
        <PageHeader
          icon={<Radio size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
          title="Brand Intelligence"
          subtitle={workspace ? 'No audit for this brand yet.' : 'Pick a brand or run an audit to unlock brand intelligence.'}
        />
        <EmptyAudit
          title="No intelligence yet"
          body="Run a Fixpath audit to see how AI and humans perceive your brand, with actionable fixes."
        />
      </div>
    );
  }

  return (
    <div>
      <OverviewBreadcrumb current="Brand Intelligence" />
      <PageHeader
        icon={<Radio size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Brand Intelligence"
        subtitle="How AI sees, describes, and recommends your brand — and what to improve"
      />

      {/* ── Tab switcher ── */}
      <div className="flex items-center gap-1 mb-5 rounded-lg p-1" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}>
        {([
          { key: 'overview' as const, label: 'Overview', icon: <Eye size={13} strokeWidth={1.75} /> },
          { key: 'perception' as const, label: 'AI Perception', icon: <Bot size={13} strokeWidth={1.75} /> },
          { key: 'pages' as const, label: 'Pages', icon: <Brain size={13} strokeWidth={1.75} />, count: auditPages.length || undefined },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-all"
            style={{
              background: activeTab === tab.key ? 'var(--card)' : 'transparent',
              color: activeTab === tab.key ? 'var(--ink)' : 'var(--m-muted)',
              boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="text-[10px] font-semibold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          OVERVIEW TAB
         ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (<>

      {/* ═══════════════════════════════════════════════════
          SECTION 1: Hero Score Card (consistent with AI Perception tab)
         ═══════════════════════════════════════════════════ */}
      <div className="overflow-hidden rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <div className="p-6 sm:p-8">
          {hasData ? (<>
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Left — Scores */}
              <div className="flex items-center gap-5 lg:pr-8 lg:border-r flex-shrink-0" style={{ borderColor: 'var(--rule)' }}>
                <ScoreCircle score={biSummary?.score ?? overallScore} size="big" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Brand Intelligence</p>
                  <p className="text-[26px] font-bold tabular-nums leading-tight mt-0.5" style={{ color: 'var(--ink)' }}>
                    {(biSummary?.score ?? overallScore) != null ? `${biSummary?.score ?? overallScore}%` : 'Not measured'}
                  </p>
                  <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
                    How AI models understand {brandName}
                  </p>
                </div>
              </div>
              {/* Right — Info cards */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* What this measures */}
                <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Search size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>What this measures</p>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                    We query leading AI models about your brand, then compare their answers to your actual website content.
                    This score combines accuracy, visibility, and sentiment into one composite metric.
                  </p>
                </div>
                {/* Executive insight */}
                <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Key insight</p>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                    {executiveSummary.length > 0
                      ? executiveSummary[0]
                      : 'Run an audit with the Brand module enabled to see how AI models represent your brand.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Metric dashboard cards — merged overview + key signals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
              {/* AI Visibility */}
              <button type="button" onClick={() => setActiveTab('perception')} className="text-left rounded-lg p-3.5 transition-all hover:shadow-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Eye size={11} style={{ color: 'var(--m-muted)' }} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--m-muted)' }}>AI Visibility</p>
                </div>
                <div className="flex items-baseline gap-0.5 mb-1.5">
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: scoreColor(visibilityScore) }}>{visibilityScore != null ? Math.round(visibilityScore) : '--'}</span>
                  {visibilityScore != null && <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>%</span>}
                </div>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--m-muted)' }}>
                  {modelProbes.length > 0
                    ? `${recognizedCount} of ${modelProbes.length} models mention your brand`
                    : 'How often AI mentions your brand'}
                </p>
                {recognizedCount < modelProbes.length && modelProbes.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-medium mt-2 px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', color: 'var(--severe)' }}>
                    <Bot size={9} className="flex-shrink-0" /> {modelProbes.length - recognizedCount} don&apos;t recognize {brandName}
                  </div>
                )}
                <span className="text-[10px] font-semibold flex items-center gap-0.5 mt-2.5" style={{ color: 'var(--ink)' }}>
                  Details <ArrowRight size={8} />
                </span>
              </button>

              {/* Accuracy */}
              <button type="button" onClick={() => setActiveTab('perception')} className="text-left rounded-lg p-3.5 transition-all hover:shadow-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Target size={11} style={{ color: 'var(--m-muted)' }} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--m-muted)' }}>Accuracy</p>
                </div>
                <div className="flex items-baseline gap-0.5 mb-1.5">
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: scoreColor(avgAccuracy) }}>{avgAccuracy > 0 ? avgAccuracy : '--'}</span>
                  {avgAccuracy > 0 && <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>%</span>}
                </div>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--m-muted)' }}>
                  How well AI matches your actual site content
                </p>
                {hallucinations.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-medium mt-2 px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', color: 'var(--severe)' }}>
                    <AlertTriangle size={9} className="flex-shrink-0" /> {hallucinations.length} factually wrong answer{hallucinations.length > 1 ? 's' : ''}
                  </div>
                )}
                {avgAccuracy > 0 && avgAccuracy < 60 && hallucinations.length === 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-medium mt-2 px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--warn) 6%, transparent)', color: 'var(--warn)' }}>
                    <AlertTriangle size={9} className="flex-shrink-0" /> AI has an incomplete picture
                  </div>
                )}
                <span className="text-[10px] font-semibold flex items-center gap-0.5 mt-2.5" style={{ color: 'var(--ink)' }}>
                  Details <ArrowRight size={8} />
                </span>
              </button>

              {/* Sentiment */}
              <button type="button" onClick={() => setActiveTab('perception')} className="text-left rounded-lg p-3.5 transition-all hover:shadow-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  {sentimentScore != null && sentimentScore >= 60 ? <ThumbsUp size={11} style={{ color: 'var(--ok)' }} /> : sentimentScore != null && sentimentScore < 40 ? <ThumbsDown size={11} style={{ color: 'var(--severe)' }} /> : <Minus size={11} style={{ color: 'var(--m-muted)' }} />}
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--m-muted)' }}>Sentiment</p>
                </div>
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: scoreColor(sentimentScore) }}>{sentimentScore ?? '--'}</span>
                  {sentimentScore != null && (
                    <span className="text-[11px] font-semibold" style={{ color: scoreColor(sentimentScore) }}>{sentimentLabel(sentimentScore).label}</span>
                  )}
                </div>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--m-muted)' }}>
                  How AI portrays your brand reputation
                </p>
                {sentimentScore != null && sentimentScore < 40 && (
                  <div className="flex items-center gap-1 text-[10px] font-medium mt-2 px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', color: 'var(--severe)' }}>
                    <ThumbsDown size={9} className="flex-shrink-0" /> Negative AI sentiment
                  </div>
                )}
                <span className="text-[10px] font-semibold flex items-center gap-0.5 mt-2.5" style={{ color: 'var(--ink)' }}>
                  Details <ArrowRight size={8} />
                </span>
              </button>

              {/* AI Readability */}
              <button type="button" onClick={() => setActiveTab('pages')} className="text-left rounded-lg p-3.5 transition-all hover:shadow-sm" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Brain size={11} style={{ color: 'var(--m-muted)' }} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--m-muted)' }}>AI Readability</p>
                </div>
                <div className="flex items-baseline gap-0.5 mb-1.5">
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: scoreColor(avgPageScore) }}>{avgPageScore ?? '--'}</span>
                  {avgPageScore != null && <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>/100</span>}
                </div>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--m-muted)' }}>
                  {pagesScored.length > 0
                    ? `${pagesScored.length} page${pagesScored.length !== 1 ? 's' : ''} scored`
                    : 'How well bots extract your content'}
                </p>
                {pagesRed > 0 && (
                  <div className="flex items-center gap-1 text-[10px] font-medium mt-2 px-2 py-1 rounded" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', color: 'var(--severe)' }}>
                    <Globe size={9} className="flex-shrink-0" /> {pagesRed} page{pagesRed > 1 ? 's' : ''} with poor readability
                  </div>
                )}
                <span className="text-[10px] font-semibold flex items-center gap-0.5 mt-2.5" style={{ color: 'var(--ink)' }}>
                  View pages <ArrowRight size={8} />
                </span>
              </button>
            </div>

            {/* All-clear banner */}
            {recognizedCount === modelProbes.length && modelProbes.length > 0 && avgAccuracy >= 60 && hallucinations.length === 0 && (sentimentScore == null || sentimentScore >= 50) && pagesRed === 0 && (
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg mt-3" style={{ background: 'color-mix(in srgb, var(--ok) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 10%, transparent)' }}>
                <CheckCircle2 size={13} className="flex-shrink-0" style={{ color: 'var(--ok)' }} />
                <p className="text-[12px]" style={{ color: 'var(--ink)', opacity: 0.85 }}>
                  No critical issues — your brand has strong AI visibility across all models
                </p>
              </div>
            )}

            {/* Brand too new notice */}
            {isNewBrand && (
              <div className="mt-3 px-3.5 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--warn) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 12%, transparent)' }}>
                <p className="text-[12px] leading-[1.5]" style={{ color: 'var(--ink)', opacity: 0.8 }}>
                  <strong>AI models have limited knowledge of {brandName}.</strong> This is common for newer or niche brands. As your online presence grows through content, reviews, and external mentions, AI will learn more about you.
                </p>
              </div>
            )}
          </>
        ) : (
          <EmptyCardBody message="Run an audit with the Brand module enabled to generate AI performance metrics." />
        )}
      </div></div>



      {/* ═══════════════════════════════════════════════════
          SECTION 3: Perception snapshot (compact themes)
         ═══════════════════════════════════════════════════ */}
      {((biSummary?.positiveThemes?.length ?? 0) > 0 || (biSummary?.negativeThemes?.length ?? 0) > 0) && (
        <DashCard className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} strokeWidth={1.75} style={{ color: 'var(--signal)' }} />
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>How AI describes {brandName}</h2>
            </div>
            <button type="button" onClick={() => setActiveTab('perception')} className="text-[11px] font-semibold hover:underline flex items-center gap-1" style={{ color: 'var(--m-muted)' }}>
              Full analysis <ArrowRight size={10} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5" style={{ color: 'var(--ok)' }}>
                <ThumbsUp size={10} /> Strongest themes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {biSummary?.positiveThemes?.slice(0, 4).map(t => (
                  <span key={t} className="text-[11px] px-2.5 py-1 rounded-md capitalize" style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)', color: 'var(--ok)' }}>{t}</span>
                ))}
                {(!biSummary?.positiveThemes || biSummary.positiveThemes.length === 0) && (
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>None detected yet</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5" style={{ color: 'var(--severe)' }}>
                <ThumbsDown size={10} /> Weakest themes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {biSummary?.negativeThemes?.slice(0, 4).map(t => (
                  <span key={t} className="text-[11px] px-2.5 py-1 rounded-md capitalize" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', color: 'var(--severe)' }}>{t}</span>
                ))}
                {(!biSummary?.negativeThemes || biSummary.negativeThemes.length === 0) && (
                  <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>None detected yet</span>
                )}
              </div>
            </div>
          </div>
        </DashCard>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 4: Competitive Intelligence
         ═══════════════════════════════════════════════════ */}
      <DashCard className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 size={14} strokeWidth={1.75} style={{ color: 'var(--signal)' }} />
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Competitive intelligence</h2>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
              How {brandName} compares to competitors in AI understanding and visibility
            </p>
          </div>
          {!isBrandAudit && scoredDrafts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCompetitorEditor(!showCompetitorEditor)}
              className="text-[11px] font-medium px-2 py-1 rounded-md flex-shrink-0"
              style={{ color: 'var(--m-muted)', background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
            >
              {showCompetitorEditor ? 'Hide editor' : 'Edit'}
            </button>
          )}
        </div>

        {/* Methodology */}
        <div className="mt-2.5 mb-3 px-3 py-2 rounded-md flex items-center gap-2.5" style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)' }}>
          <Info size={11} style={{ color: 'var(--signal)', flexShrink: 0 }} />
          <p className="text-[11px] leading-[1.45]" style={{ color: 'var(--ink)', opacity: 0.6 }}>
            Scores reflect overall audit results — content quality, technical structure, AI readiness, and UX. Higher = better optimized for AI discovery.
          </p>
        </div>

        {isBrandAudit ? (
          <div className="rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
            <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Competitive benchmarks need a live site</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
              Run a site audit on the same brand to unlock competitor comparisons.
            </p>
            <Link href={`${dashPrefix}/new-audit`} className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
              Run a site audit <ArrowRight size={10} />
            </Link>
          </div>
        ) : scoredDrafts.length > 0 ? (
          <>
            {/* Benchmark summary */}
            {benchmarkPosition?.benchmark && (
              <div className="mb-3 rounded-lg px-3.5 py-3" style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                <p className="text-[12px] leading-[1.6]" style={{ color: 'var(--ink)', opacity: 0.85 }}>
                  {benchmarkPosition.deltaFromAvg != null && benchmarkPosition.deltaFromAvg > 5
                    ? `You're ${benchmarkPosition.deltaFromAvg} points above the ${industry || 'industry'} average (${benchmarkPosition.benchmark.avgScore}/100). Your brand is well-positioned for AI discovery.`
                    : benchmarkPosition.deltaFromAvg != null && benchmarkPosition.deltaFromAvg < -5
                    ? `You're ${Math.abs(benchmarkPosition.deltaFromAvg)} points below the ${industry || 'industry'} average (${benchmarkPosition.benchmark.avgScore}/100). Competitors are likely being surfaced more often by AI.`
                    : `You're close to the ${industry || 'industry'} average of ${benchmarkPosition.benchmark.avgScore}/100.`
                  }
                  {scoredDrafts.some(c => c.score != null && c.score > overallScore + 5) &&
                    ` Competitors outperform mainly through stronger content structure and trust signals.`
                  }
                </p>
              </div>
            )}

            {/* Leaderboard table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]" style={{ color: 'var(--ink)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--rule)' }}>
                    <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--m-muted)' }}>#</th>
                    <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--m-muted)' }}>Brand</th>
                    <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--m-muted)' }}>Score</th>
                    <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--m-muted)' }}>Gap</th>
                    {biSummary?.shareOfVoice != null && (
                      <th className="text-center py-2 px-2 font-medium" style={{ color: 'var(--m-muted)' }}>SoV</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {/* Build sorted leaderboard */}
                  {[
                    { domain: 'You', name: 'You', score: overallScore, isUser: true, sov: biSummary?.shareOfVoice },
                    ...scoredDrafts.map(c => ({ domain: c.domain, name: c.name || c.domain, score: c.score ?? 0, isUser: false, sov: null as number | null })),
                  ]
                  .sort((a, b) => b.score - a.score)
                  .map((entry, i) => (
                    <tr
                      key={entry.domain}
                      style={{
                        borderBottom: '1px solid var(--rule)',
                        background: entry.isUser ? 'color-mix(in srgb, var(--signal) 4%, transparent)' : undefined,
                      }}
                    >
                      <td className="py-2.5 pr-3 font-semibold tabular-nums" style={{ color: entry.isUser ? 'var(--ink)' : 'var(--m-muted)' }}>{i + 1}</td>
                      <td className="py-2.5 pr-3 font-semibold">{entry.name}{entry.isUser && <span className="text-[9px] ml-1.5 font-normal" style={{ color: 'var(--signal)' }}>(you)</span>}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-semibold tabular-nums" style={{ color: scoreColor(entry.score) }}>{entry.score}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {entry.isUser ? (
                          <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>—</span>
                        ) : (
                          <span className="text-[10px] font-semibold tabular-nums" style={{ color: overallScore > entry.score ? 'var(--ok)' : overallScore < entry.score ? 'var(--severe)' : 'var(--m-muted)' }}>
                            {overallScore > entry.score ? '+' : ''}{overallScore - entry.score}
                          </span>
                        )}
                      </td>
                      {biSummary?.shareOfVoice != null && (
                        <td className="py-2.5 px-2 text-center tabular-nums" style={{ color: entry.isUser ? scoreColor(entry.sov ?? 0) : 'var(--m-muted)' }}>
                          {entry.sov != null ? `${entry.sov}%` : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div>
            <EmptyCardBody message="Add competitors to see how you compare. Use auto-detect or add manually." />
            <div className="flex justify-center">
              <Link
                href={`${dashPrefix}/competitors`}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Add competitors <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        )}

        {/* Competitor editor */}
        {!isBrandAudit && (showCompetitorEditor || scoredDrafts.length === 0) && (
          <CompetitorEditor
            drafts={drafts} isDirty={isDirty} detecting={detecting} saving={saving}
            error={error} info={info}
            onAdd={addRow} onUpdate={updateRow} onRemove={removeRow} onReset={resetEdits}
            onAutoDetect={runAutoDetect} onRescan={rescanScores} onSave={saveDrafts}
          />
        )}
      </DashCard>

      {/* ═══════════════════════════════════════════════════
          SECTION 5: Prioritized Improvement Plan
         ═══════════════════════════════════════════════════ */}
      {recommendations.length > 0 && (
        <DashCard className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} strokeWidth={1.75} style={{ color: 'var(--ok)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>How to improve</h2>
          </div>
          <p className="text-[11px] mb-4" style={{ color: 'var(--m-muted)' }}>
            Prioritized actions to strengthen how AI understands and recommends {brandName}
          </p>

          {/* High impact first */}
          {(() => {
            const visible = showAllRecs ? recommendations : recommendations.slice(0, 6);

            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visible.map((rec, i) => {
                    const impactColor = rec.impact === 'high' ? 'var(--severe)' : rec.impact === 'medium' ? 'var(--warn)' : 'var(--m-muted)';
                    const isHigh = rec.impact === 'high';
                    return (
                      <div
                        key={i}
                        className="rounded-lg p-4"
                        style={{
                          background: isHigh ? 'color-mix(in srgb, var(--severe) 3%, transparent)' : 'rgba(34,197,94,0.04)',
                          border: `1px solid ${isHigh ? 'color-mix(in srgb, var(--severe) 10%, transparent)' : 'var(--rule)'}`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-[13px] font-semibold flex-1 leading-snug" style={{ color: 'var(--ink)' }}>{rec.title}</p>
                          <span className="text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: impactColor, background: `color-mix(in srgb, ${impactColor} 10%, transparent)` }}>
                            {rec.impact}
                          </span>
                        </div>
                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{rec.description}</p>
                        {rec.category && (
                          <span className="inline-block mt-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: 'var(--m-muted)', background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}>
                            {rec.category}
                          </span>
                        )}
                        {rec.deployable && (
                          <Link href={`${dashPrefix}/fix?audit=${bundle.audit!.id}`} className="inline-flex items-center gap-1 mt-2 ml-2 text-[11px] font-semibold hover:underline" style={{ color: 'var(--ink)' }}>
                            <Wrench size={10} /> Fix from console <ChevronRight size={9} />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>

                {recommendations.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRecs(!showAllRecs)}
                    className="flex items-center gap-1 mx-auto mt-3 text-[11px] font-medium px-3 py-1.5 rounded-md"
                    style={{ color: 'var(--m-muted)', background: 'color-mix(in srgb, var(--ink) 4%, transparent)' }}
                  >
                    {showAllRecs ? (
                      <>Show less <ChevronUp size={10} /></>
                    ) : (
                      <>Show all {recommendations.length} recommendations <ChevronDown size={10} /></>
                    )}
                  </button>
                )}
              </>
            );
          })()}
        </DashCard>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 6: Methodology Transparency
         ═══════════════════════════════════════════════════ */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowMethodology(!showMethodology)}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-left"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <BookOpen size={13} style={{ color: 'var(--m-muted)' }} />
          <span className="text-[12px] font-medium flex-1" style={{ color: 'var(--m-muted)' }}>How this is evaluated</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${showMethodology ? 'rotate-180' : ''}`} style={{ color: 'var(--m-muted)' }} />
        </button>

        {showMethodology && (
          <div className="mt-1 rounded-xl px-4 py-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MethodItem icon={<Bot size={12} />} label="Models queried">
                {modelProbes.length > 0
                  ? modelProbes.map(p => p.model_label).join(', ')
                  : 'None yet — run an audit to query AI models'
                }
              </MethodItem>
              <MethodItem icon={<Hash size={12} />} label="Question families">
                Brand recognition, offering and services, pricing model, reputation and trust, competitive differentiation
              </MethodItem>
              <MethodItem icon={<Target size={12} />} label="Evaluation method">
                Zero-context probing — models are asked about {brandName} with no prior information. Responses are graded against your actual site content.
              </MethodItem>
              <MethodItem icon={<Clock size={12} />} label="Last updated">
                {bundle?.audit?.updated_at
                  ? new Date(bundle.audit.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Unknown'
                }
              </MethodItem>
              <MethodItem icon={<Layers size={12} />} label="Scoring weights">
                Visibility 30% + Sentiment 25% + Accuracy 25% + Placement 20%
              </MethodItem>
              <MethodItem icon={<Shield size={12} />} label="Context used">
                No prior context. Each model starts fresh to measure organic brand knowledge.
              </MethodItem>
            </div>
          </div>
        )}
      </div>


      </>)}

      {/* ══════════════════════════════════════════════════════
          AI PERCEPTION TAB
         ══════════════════════════════════════════════════════ */}
      {activeTab === 'perception' && (
        <div className="space-y-4">

          {/* ── Hero Score Card (Executive Summary style) ── */}
          <div className="overflow-hidden rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="p-6 sm:p-8">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Left — Scores */}
                <div className="flex items-center gap-5 lg:pr-8 lg:border-r flex-shrink-0" style={{ borderColor: 'var(--rule)' }}>
                  <ScoreCircle score={perceptionAccuracy} size="big" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>AI Accuracy</p>
                    <p className="text-[26px] font-bold tabular-nums leading-tight mt-0.5" style={{ color: 'var(--ink)' }}>
                      {perceptionAccuracy != null ? `${perceptionAccuracy}%` : 'Not measured'}
                    </p>
                    <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
                      {perceptionAccuracy != null ? `Across ${perceptionMeasured.length} model${perceptionMeasured.length !== 1 ? 's' : ''}` : 'Run an audit to measure'}
                    </p>
                    {hasPerceptionSentiment && (
                      <div className="flex items-center gap-2.5 mt-3 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
                        <ScoreCircle score={perceptionSentiment} size="small" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>Sentiment</p>
                          <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                            {perceptionSentimentLabel(perceptionSentiment)}{' '}
                            <span className="text-[13px] font-normal" style={{ color: 'var(--m-muted)' }}>{perceptionSentiment}/100</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Right — Info cards */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* How we measure */}
                  <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Search size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>How we measure</p>
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                      We ask leading AI models — ChatGPT, Claude, Gemini, and Perplexity — questions about your brand,
                      then compare their answers to what your website actually says. This shows how accurately AI
                      represents your brand to millions of people using it every day.
                    </p>
                  </div>
                  {/* Why it matters */}
                  <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Info size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Why it matters</p>
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                      Low accuracy is normal for newer brands. AI models can read your website, but they won{"'"}t
                      confidently endorse your claims until independent sources corroborate them. Focus on building
                      authoritative backlinks, earning press mentions, and keeping content clear — AI confidence follows web authority.
                    </p>
                  </div>
                </div>
              </div>
              {/* Re-scan + status strip */}
              {hasProbes && (
                <div className="flex items-center justify-between gap-4 mt-5 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                    Model-level view of how AI sees, describes, and ranks {brandName}
                  </p>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <button
                      onClick={handleRescan}
                      disabled={rescanning || !rescanAvailable}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-60"
                      style={rescanAvailable ? {
                        background: 'var(--ink)',
                        color: 'var(--paper)',
                        border: '1px solid var(--ink)',
                      } : {
                        background: 'var(--rule)',
                        color: 'var(--m-muted)',
                        border: '1px solid var(--rule)',
                        cursor: 'default',
                      }}
                    >
                      <RefreshCw size={13} strokeWidth={1.75} className={rescanning ? 'animate-spin' : ''} />
                      {rescanning ? 'Scanning...' : 'Re-scan AI models'}
                    </button>
                    {!rescanAvailable && cooldownMessage && !rescanMessage && (
                      <p className="text-[11px] max-w-[280px] text-right leading-snug" style={{ color: 'var(--m-muted)' }}>{cooldownMessage}</p>
                    )}
                    {rescanMessage && (
                      <p className="text-[11px] max-w-[280px] text-right" style={{ color: 'var(--m-muted)' }}>{rescanMessage}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Brand unknown notice ── */}
          {brandIsUnknown && (
            <div
              className="flex items-start gap-3 rounded-lg border px-4 py-4"
              style={{ background: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.2)' }}
            >
              <AlertTriangle size={16} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--warn)' }} />
              <div>
                <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                  No AI data available for this brand yet
                </p>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  AI models don{"'"}t have enough training data to answer questions about your brand.
                  This is normal for newer or niche brands — AI knowledge lags behind the live web by months.
                </p>
                {hasFallbackCompetitors && (
                  <p className="text-[12px] leading-relaxed mt-2" style={{ color: 'var(--m-muted)' }}>
                    Your competitors are already visible to AI — see how they rank below.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── What AI models say about you (primary action section) ── */}
          <DashCard style={{ display: 'flex', flexDirection: 'column', maxHeight: '720px' }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <MessageSquare size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>What AI models say about you</h2>
              </div>
              <div className="flex items-center gap-2">
                {iqUsage && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}>
                    {iqUsage.checksRemaining} check{iqUsage.checksRemaining !== 1 ? 's' : ''} left
                  </span>
                )}
                {!rescanAvailable && cooldownMessage && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--warn) 8%, transparent)', color: 'var(--warn)' }}>
                    <Clock size={9} className="inline -mt-0.5 mr-0.5" />
                    Cooldown active
                  </span>
                )}
              </div>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--m-muted)' }}>
              Select up to {IQ_MAX_MODELS} models, then pick a question. Previously asked questions load instantly at no cost.
            </p>

            {/* Split layout: left panel (models + questions) | right panel (answers) */}
            <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0 overflow-hidden">
              {/* ── Left panel: Models + Questions ── */}
              <div className="lg:w-[340px] flex-shrink-0 flex flex-col overflow-hidden">
                {/* Model selector — sticky at top */}
                <div className="flex-shrink-0 pb-3 z-10" style={{ background: 'var(--card)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] mb-2" style={{ color: 'var(--m-muted)' }}>
                    Models {iqSelectedModels.length > 0 && <span className="normal-case font-normal">({iqSelectedModels.length}/{IQ_MAX_MODELS})</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {IQ_MODEL_DISPLAY.map((m) => {
                      const selected = iqSelectedModels.includes(m.slug);
                      const provider = providerKeyToIcon(m.shortId);
                      return (
                        <button
                          key={m.slug}
                          onClick={() => toggleIqModel(m.slug)}
                          disabled={iqRunning}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all"
                          style={{
                            background: selected ? 'var(--ink)' : 'var(--paper-2)',
                            color: selected ? 'var(--paper)' : 'var(--m-muted)',
                            border: `1px solid ${selected ? 'var(--ink)' : 'var(--rule)'}`,
                            opacity: iqRunning ? 0.5 : 1,
                          }}
                          title={m.free ? 'Included free with every audit' : 'Uses 1 check'}
                        >
                          {provider && <AIProviderIcon provider={provider} size={13} />}
                          {provider ? PROVIDER_LABEL[provider] : m.shortId}
                          {m.free && <CheckCircle2 size={9} strokeWidth={2} className="opacity-50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Questions list — scrollable */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] mb-1.5 sticky top-0 py-1 z-10" style={{ color: 'var(--m-muted)', background: 'var(--card)' }}>
                    Questions
                  </p>
                  {iqQuestionsLoading ? (
                    <div className="flex items-center gap-2 py-3">
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--m-muted)' }} />
                      <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Loading questions...</span>
                    </div>
                  ) : (() => {
                    const allQs: Array<{ key: string; text: string; family?: string; isPinned?: boolean; isBenchmark?: boolean; onClick: () => void }> = [];
                    // All shortlist questions are benchmark questions — these form the
                    // category-specific Top 10 scoring basis. Pin the first 3 for visibility.
                    for (let i = 0; i < iqQuestions.length; i++) {
                      const q = iqQuestions[i];
                      allQs.push({ key: q.questionId, text: q.questionText, family: q.family, isPinned: i < 3, isBenchmark: true, onClick: () => handleIqAsk(q.questionText, q.family) });
                    }
                    // Legacy audit-time probe questions that aren't in the shortlist
                    for (const group of questionGroups) {
                      if (!iqQuestions.some(q => q.questionText === group.question)) {
                        allQs.push({ key: `probe-${group.question}`, text: group.question, isBenchmark: false, onClick: () => handleIqAsk(group.question) });
                      }
                    }
                    if (allQs.length === 0) {
                      return (
                        <p className="text-[12px] py-2" style={{ color: 'var(--m-muted)' }}>
                          No questions available yet. Run an audit to generate industry-specific questions.
                        </p>
                      );
                    }
                    // Sort: pinned questions first, then rest in original order
                    const pinnedQs = allQs.filter(q => q.isPinned);
                    const otherQs = allQs.filter(q => !q.isPinned);
                    const sortedQs = [...pinnedQs, ...otherQs];
                    return (
                      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)' }}>
                        {sortedQs.map((q, idx) => {
                          const isActive = iqActiveQuestion === q.text;
                          const hasSaved = iqPastResults.has(q.text);
                          const pastR = iqPastResults.get(q.text);
                          const probeGroup = questionGroups.find(g => g.question === q.text);
                          let accCount = 0, partCount = 0, wrongCount = 0;
                          if (pastR && pastR.length > 0) {
                            for (const r of pastR) {
                              const n = normalizeAccuracy(r.accuracy);
                              if (n === 'Accurate') accCount++;
                              else if (n === 'Partial') partCount++;
                              else if (n === 'Inaccurate' || n === 'Hallucinated') wrongCount++;
                            }
                          } else if (probeGroup) {
                            for (const a of probeGroup.answers) {
                              const n = normalizeAccuracy(a.accuracy);
                              if (n === 'Accurate') accCount++;
                              else if (n === 'Partial') partCount++;
                              else if (n === 'Inaccurate' || n === 'Hallucinated') wrongCount++;
                            }
                          }
                          const hasAccuracy = accCount > 0 || partCount > 0 || wrongCount > 0;
                          const canAsk = hasSaved || (iqUsage == null || iqUsage.canInterrogate);
                          const showPinDivider = q.isPinned && idx === pinnedQs.length - 1 && otherQs.length > 0;
                          return (
                            <button
                              key={q.key}
                              onClick={q.onClick}
                              disabled={iqRunning || !canAsk}
                              className="w-full text-left flex items-start gap-2.5 px-3 py-2 transition-colors"
                              style={{
                                background: isActive ? 'var(--ink)' : q.isPinned ? 'color-mix(in srgb, var(--ok) 4%, transparent)' : idx % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--ink) 2%, transparent)',
                                color: isActive ? 'var(--paper)' : 'var(--ink)',
                                borderBottom: showPinDivider ? '2px solid var(--rule)' : idx < sortedQs.length - 1 ? '1px solid var(--rule)' : 'none',
                                opacity: (iqRunning && !isActive) ? 0.5 : 1,
                              }}
                            >
                              <span className="text-[10px] font-mono font-medium mt-0.5 flex-shrink-0 w-4 text-right" style={{ color: isActive ? 'var(--paper)' : 'var(--m-muted)', opacity: 0.6 }}>
                                {q.isPinned && <CircleDot size={8} className="inline -mt-px mr-0.5" style={{ color: isActive ? 'var(--paper)' : 'var(--ok)' }} />}
                                {idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[13px] leading-snug">{q.text}</span>
                                </div>
                                {!isActive && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    {q.isBenchmark ? (
                                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded" style={{ background: isActive ? 'rgba(255,255,255,0.15)' : 'color-mix(in srgb, var(--ink) 6%, transparent)', color: isActive ? 'var(--paper)' : 'var(--m-muted)' }}>
                                        Benchmark
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-px rounded" style={{ background: 'color-mix(in srgb, var(--warn) 10%, transparent)', color: 'var(--warn)' }}>
                                        Custom
                                      </span>
                                    )}
                                    {accCount > 0 && (
                                      <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-px rounded" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--ok)' }}>
                                        <CheckCircle2 size={10} strokeWidth={2} />
                                        {accCount}
                                      </span>
                                    )}
                                    {partCount > 0 && (
                                      <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-px rounded" style={{ background: 'rgba(234,179,8,0.1)', color: 'var(--warn)' }}>
                                        <AlertTriangle size={10} strokeWidth={2} />
                                        {partCount}
                                      </span>
                                    )}
                                    {wrongCount > 0 && (
                                      <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-px rounded" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--severe)' }}>
                                        <XCircle size={10} strokeWidth={2} />
                                        {wrongCount}
                                      </span>
                                    )}
                                    {hasSaved && !hasAccuracy && accCount === 0 && partCount === 0 && wrongCount === 0 && (
                                      <span className="text-[10px] font-medium px-1.5 py-px rounded" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}>saved</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {iqUsage && !iqUsage.canInterrogate && iqUsage.checksLimit > 0 && (
                    <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--m-muted)' }}>
                      All checks used. Saved answers still load free.
                    </p>
                  )}
                  {iqUsage && iqUsage.checksLimit === 0 && (
                    <p className="text-[10px] mt-1.5 px-1" style={{ color: 'var(--m-muted)' }}>
                      Upgrade your plan to unlock AI interrogation checks.
                    </p>
                  )}
                </div>
              </div>

              {/* ── Right panel: Answers ── */}
              <div className="flex-1 min-w-0 overflow-y-auto">
                {iqResults.length > 0 ? (
                  <div>
                    {iqActiveQuestion && (
                      <p className="text-[15px] font-semibold mb-3 leading-snug" style={{ color: 'var(--ink)' }}>
                        {iqActiveQuestion}
                      </p>
                    )}
                    <div className="space-y-2.5">
                      {iqResults.map((r) => {
                        const provider = providerKeyToIcon(r.modelShortId);
                        const ac = accuracyColor(r.accuracy);
                        const normAcc = normalizeAccuracy(r.accuracy);
                        return (
                          <div key={r.modelSlug} className="rounded-lg p-3.5" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {provider && <AIProviderIcon provider={provider} size={16} />}
                                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{r.modelDisplayName}</span>
                              </div>
                              {r.status === 'running' && (
                                <Loader2 size={13} className="animate-spin" style={{ color: 'var(--m-muted)' }} />
                              )}
                              {r.status === 'failed' && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--severe)' }}>
                                  <XCircle size={10} strokeWidth={2} />
                                  Error
                                </span>
                              )}
                              {r.status !== 'running' && r.status !== 'failed' && normAcc && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ac.bg, color: ac.color }}>
                                  {normAcc === 'Accurate' && <CheckCircle2 size={10} strokeWidth={2} />}
                                  {normAcc === 'Partial' && <AlertTriangle size={10} strokeWidth={2} />}
                                  {normAcc === 'Inaccurate' && <XCircle size={10} strokeWidth={2} />}
                                  {normAcc}
                                </span>
                              )}
                            </div>
                            {r.status === 'running' ? (
                              <div className="space-y-1.5">
                                <div className="animate-pulse rounded h-3 w-full" style={{ background: 'var(--rule)' }} />
                                <div className="animate-pulse rounded h-3 w-3/4" style={{ background: 'var(--rule)' }} />
                                <div className="animate-pulse rounded h-3 w-1/2" style={{ background: 'var(--rule)' }} />
                              </div>
                            ) : r.status === 'failed' ? (
                              <p className="text-[12px]" style={{ color: 'var(--severe)' }}>{r.error || 'Request failed'}</p>
                            ) : (
                              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{r.responseText}</p>
                            )}
                            {r.accuracyNote && r.status !== 'running' && r.status !== 'failed' && (
                              <p className="text-[11px] mt-2 pt-2 italic" style={{ color: 'var(--m-muted)', borderTop: '1px solid var(--rule)', opacity: 0.8 }}>{r.accuracyNote}</p>
                            )}
                            {r.themes && r.themes.length > 0 && r.status !== 'running' && r.status !== 'failed' && (
                              <div className="flex flex-wrap gap-1 mt-2 pt-2" style={{ borderTop: r.accuracyNote ? 'none' : '1px solid var(--rule)' }}>
                                {r.themes.map((t, ti) => (
                                  <span key={ti} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--paper)', color: 'var(--m-muted)' }}>{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : iqActiveQuestion == null && questionGroups.length > 0 ? (
                  <div>
                    <p className="text-[15px] font-semibold mb-3 leading-snug" style={{ color: 'var(--ink)' }}>
                      {questionGroups[0].question}
                    </p>
                    <div className="space-y-2">
                      {questionGroups[0].answers.map((a) => {
                        const ac = accuracyColor(a.accuracy);
                        return (
                          <div key={a.model_id} className="rounded-lg p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <AIProviderIcon provider={providerKeyToIcon(a.model_id) ?? 'chatgpt'} size={14} />
                                <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>{a.model_label}</span>
                              </div>
                              {a.accuracy && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ac.bg, color: ac.color }}>
                                  {normalizeAccuracy(a.accuracy)}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{a.answer}</p>
                            {a.accuracyNote && (
                              <p className="text-[10px] mt-1.5 pt-1.5 italic" style={{ color: 'var(--m-muted)', borderTop: '1px solid var(--rule)', opacity: 0.8 }}>{a.accuracyNote}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full min-h-[180px] rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 2%, transparent)', border: '1px dashed var(--rule)' }}>
                    <div className="text-center px-6">
                      <Bot size={22} className="mx-auto mb-2" style={{ color: 'var(--m-muted)', opacity: 0.4 }} />
                      <p className="text-[12px] font-medium" style={{ color: 'var(--m-muted)' }}>Select a question to see what AI models say</p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)', opacity: 0.6 }}>Saved answers load instantly — no check needed</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DashCard>

          {/* ── Per-model breakdown (merged from all evaluated records) ── */}
          {hasModelBreakdown && (
            <DashCard>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Model-by-model breakdown</h2>
              </div>
              <p className="text-[13px] mb-2" style={{ color: 'var(--m-muted)' }}>
                How each AI model performs when asked about your brand. Accuracy is computed from all evaluated questions using the category-specific Top 10 benchmark set.
              </p>
              <p className="text-[11px] mb-4 px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)', color: 'var(--m-muted)' }}>
                <strong style={{ color: 'var(--ink)' }}>Methodology:</strong> We select the 10 most relevant questions for your industry and category — the kind of questions real users ask Google and AI about businesses like yours. Each model answers the same questions, and responses are graded against your actual website content. Scores: Accurate = 100%, Partial = 50%, No data = 25%, Inaccurate/Hallucinated = 0%.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {mergedModelBreakdown.map(probe => {
                  const badge = accuracyBadge(probe.accuracy_score, probe.status);
                  const hasSent = probe.sentiment_score != null;
                  return (
                    <div key={probe.model_id} className="rounded-lg px-4 py-4" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <AIProviderIcon provider={providerKeyToIcon(probe.model_id) ?? 'chatgpt'} size={20} />
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{probe.model_label}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Accuracy</span>
                          <div className="flex items-center gap-1.5">
                            {probe.status === 'measured' || !probe.status ? (
                              <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{probe.accuracy_score}%</span>
                            ) : (
                              <span className="text-[12px] font-semibold" style={{ color: 'var(--m-muted)' }}>—</span>
                            )}
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Sentiment</span>
                          <span className="text-[12px] font-semibold tabular-nums" style={{ color: hasSent ? scoreColor(probe.sentiment_score) : 'var(--m-muted)' }}>
                            {hasSent ? `${probe.sentiment_score}/100` : '--'}
                          </span>
                        </div>
                        {probe.status === 'measured' && probe.total_questions > 0 && (
                          <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid var(--rule)' }}>
                            <span className="text-[10px]" style={{ color: 'var(--m-muted)', opacity: 0.7 }}>Based on</span>
                            <span className="text-[10px] tabular-nums" style={{ color: 'var(--m-muted)', opacity: 0.7 }}>
                              {probe.total_questions} question{probe.total_questions !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                      {probe.sentiment_themes && probe.sentiment_themes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3 pt-2" style={{ borderTop: '1px solid var(--rule)' }}>
                          {probe.sentiment_themes.slice(0, 3).map(t => (
                            <span key={t.theme} className="text-[10px] px-1.5 py-0.5 rounded" style={{
                              background: t.polarity === 'positive' ? 'rgba(34,197,94,0.08)' : t.polarity === 'negative' ? 'rgba(239,68,68,0.08)' : 'var(--paper-2)',
                              color: t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)',
                              border: '1px solid var(--rule)',
                            }}>{t.theme}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </DashCard>
          )}

          {/* ── Perception themes ── */}
          {allThemes.length > 0 && (
            <DashCard>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Brand perception themes</h2>
              </div>
              <p className="text-[13px] mb-4" style={{ color: 'var(--m-muted)' }}>
                Recurring topics AI models mention about your brand, classified by tone.
              </p>
              <div className="flex flex-wrap gap-2">
                {allThemes.map(t => (
                  <span key={t.theme} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg font-medium" style={{
                    background: t.polarity === 'positive' ? 'rgba(34,197,94,0.08)' : t.polarity === 'negative' ? 'rgba(239,68,68,0.06)' : 'var(--paper-2)',
                    color: t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)',
                    border: '1px solid var(--rule)',
                  }}>
                    {t.polarity === 'positive' ? <ThumbsUp size={11} /> : t.polarity === 'negative' ? <ThumbsDown size={11} /> : <Minus size={11} />}
                    {t.theme}
                  </span>
                ))}
              </div>
            </DashCard>
          )}

          {/* ── Competitor AI placement ── */}
          {hasCompetitorProbeData && (
            <DashCard>
              <div className="flex items-center gap-2 mb-1">
                <Users size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Competitor AI placement</h2>
              </div>
              <p className="text-[13px] mb-4" style={{ color: 'var(--m-muted)' }}>
                When people ask AI about your category, these competitors get mentioned too.
                Lower position numbers mean the competitor appears earlier in AI responses.
              </p>
              <CompetitorPlacementTable competitors={competitorData} />
            </DashCard>
          )}

          {/* ── Fallback competitor list ── */}
          {!hasCompetitorProbeData && hasFallbackCompetitors && (
            <DashCard>
              <div className="flex items-center gap-2 mb-1">
                <Users size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Competitors in your space</h2>
              </div>
              <p className="text-[13px] mb-4" style={{ color: 'var(--m-muted)' }}>
                {brandIsUnknown
                  ? 'While your brand isn\'t yet visible to AI models, these competitors in your category already have an AI presence. Their UX scores are shown below.'
                  : 'Competitors detected in your category. Run a deeper scan to see how AI models rank them against your brand.'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>Competitor</th>
                      <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>Domain</th>
                      <th className="text-center py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>UX score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fallbackCompetitors.map((comp, i) => (
                      <tr key={comp.domain} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--paper-2)' }}>
                        <td className="py-2 px-3 font-medium" style={{ color: 'var(--ink)' }}>{comp.name}</td>
                        <td className="py-2 px-3" style={{ color: 'var(--m-muted)' }}>{comp.domain}</td>
                        <td className="text-center py-2 px-3 tabular-nums font-semibold" style={{ color: comp.score > 0 ? scoreColor(comp.score) : 'var(--m-muted)' }}>
                          {comp.score > 0 ? `${comp.score}/100` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashCard>
          )}

          {/* ── How to improve ── */}
          {hasProbes && (
            <DashCard className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} strokeWidth={1.75} style={{ color: 'var(--ok)' }} />
                <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>How to improve your AI presence</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
                  <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Improve accuracy</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                    Make your website content clear, specific, and structured. Use schema markup, clear headings, and explicit claims that AI can easily parse and verify.
                  </p>
                </div>
                <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
                  <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Boost sentiment</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                    Earn positive mentions from authoritative sources — press coverage, expert reviews, satisfied customers on trusted platforms. AI sentiment follows public perception.
                  </p>
                </div>
                <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
                  <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Climb placement rankings</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                    Be the most cited and linked-to brand in your category. AI models rank brands higher when many independent sources reference them consistently.
                  </p>
                </div>
                <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
                  <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Beat competitors</p>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                    Create content that directly addresses common category questions. AI recommends brands that have clear, comprehensive answers to what users are asking.
                  </p>
                </div>
              </div>
            </DashCard>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PAGES TAB — Per-page AI readability
         ══════════════════════════════════════════════════════ */}
      {activeTab === 'pages' && (
        <div>
          {/* ═══════════════════════════════════════════════════
              Hero Score Card (consistent with Overview + AI Perception tabs)
             ═══════════════════════════════════════════════════ */}
          <div className="overflow-hidden rounded-xl mb-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="p-6 sm:p-8">
              {pagesScored.length > 0 ? (<>
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left — Score */}
                  <div className="flex items-center gap-5 lg:pr-8 lg:border-r flex-shrink-0" style={{ borderColor: 'var(--rule)' }}>
                    <ScoreCircle score={avgPageScore} size="big" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>AI Readability</p>
                      <p className="text-[26px] font-bold tabular-nums leading-tight mt-0.5" style={{ color: 'var(--ink)' }}>
                        {avgPageScore != null ? `${avgPageScore}/100` : 'Not measured'}
                      </p>
                      <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
                        Average across {pagesScored.length} page{pagesScored.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {/* Right — Info cards */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* What this measures */}
                    <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Search size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                        <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>What this measures</p>
                      </div>
                      <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                        How well AI bots can extract and understand your page content — headings, metadata,
                        structured data, and semantic clarity that determines how AI represents each page.
                      </p>
                    </div>
                    {/* Page breakdown */}
                    <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Globe size={14} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
                        <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Page breakdown</p>
                      </div>
                      <div className="flex items-center gap-4 text-[12px]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ok)' }} />
                          <span style={{ color: 'var(--m-muted)' }}>Good</span>
                          <span className="font-semibold" style={{ color: 'var(--ink)' }}>{pagesGreen}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} />
                          <span style={{ color: 'var(--m-muted)' }}>Needs work</span>
                          <span className="font-semibold" style={{ color: 'var(--ink)' }}>{pagesAmber}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} />
                          <span style={{ color: 'var(--m-muted)' }}>Poor</span>
                          <span className="font-semibold" style={{ color: 'var(--ink)' }}>{pagesRed}</span>
                        </span>
                      </div>
                      {pagesScored.length >= 2 && (() => {
                        const best = [...pagesScored].sort((a, b) => (b.ai_readability?.overallScore ?? 0) - (a.ai_readability?.overallScore ?? 0))[0];
                        const worst = [...pagesScored].sort((a, b) => (a.ai_readability?.overallScore ?? 999) - (b.ai_readability?.overallScore ?? 999))[0];
                        if (best === worst) return null;
                        return (
                          <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--rule)' }}>
                            <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--m-muted)' }}>
                              <CheckCircle2 size={10} style={{ color: 'var(--ok)' }} />
                              Best: <span className="font-medium truncate" style={{ color: 'var(--ink)' }}>{best.title || best.url}</span>
                              <span className="font-semibold tabular-nums" style={{ color: 'var(--ok)' }}>{best.ai_readability?.overallScore}</span>
                            </p>
                            <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--m-muted)' }}>
                              <AlertTriangle size={10} style={{ color: 'var(--severe)' }} />
                              Weakest: <span className="font-medium truncate" style={{ color: 'var(--ink)' }}>{worst.title || worst.url}</span>
                              <span className="font-semibold tabular-nums" style={{ color: 'var(--severe)' }}>{worst.ai_readability?.overallScore}</span>
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </>) : (
                <div className="text-center py-6">
                  <Globe size={24} className="mx-auto mb-3" style={{ color: 'var(--m-muted)', opacity: 0.5 }} />
                  <p className="text-[13px]" style={{ color: 'var(--m-muted)' }}>
                    Run a website audit to populate per-page AI readability data.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Sort controls */}
          {auditPages.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpDown size={11} style={{ color: 'var(--m-muted)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--m-muted)' }}>Sort:</span>
              {([
                { key: 'score-desc' as const, label: 'Score (high → low)' },
                { key: 'score-asc' as const, label: 'Score (low → high)' },
                { key: 'name' as const, label: 'Name' },
              ]).map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPageSort(opt.key)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    background: pageSort === opt.key ? 'var(--ink)' : 'transparent',
                    color: pageSort === opt.key ? 'var(--paper)' : 'var(--m-muted)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Page list */}
          {auditPages.length === 0 ? (
            <DashCard>
              <EmptyCardBody message="No crawled pages on this audit yet. Run a website audit to populate per-page AI readability data." />
            </DashCard>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <div className="px-5 py-3.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--rule)' }}>
                <Brain size={14} style={{ color: 'var(--signal)' }} />
                <h2 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                  What AI bots extract from your pages
                </h2>
                {avgPageScore != null && (
                  <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: scoreColor(avgPageScore) }}>
                    avg {avgPageScore}/100 · {pagesScored.length} page{pagesScored.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
                {sortedPages.map((page) => {
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
                            <details className="mt-3 group/fix">
                              <summary
                                className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:underline"
                                style={{ color: 'var(--ink)' }}
                              >
                                Fix {missing.length} missing signal{missing.length === 1 ? '' : 's'} <ChevronDown size={10} className="transition-transform group-open/fix:rotate-180" />
                              </summary>
                              <div className="mt-2 space-y-2">
                                {missing.map((signal) => {
                                  const fix = SIGNAL_FIX_MAP[signal.toLowerCase()] || `Add the missing "${signal}" to this page's HTML.`
                                  return (
                                    <div key={signal} className="flex gap-2 text-[11px] leading-relaxed rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)' }}>
                                      <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--severe)' }} />
                                      <div>
                                        <span className="font-semibold" style={{ color: 'var(--ink)' }}>{signal}:</span>{' '}
                                        <span style={{ color: 'var(--m-muted)' }}>{fix}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </details>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Shared components
   ══════════════════════════════════════════════════════════ */

function PerceptionMetricCard({
  icon,
  label,
  value,
  subtext,
  description,
  scoreCircle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  description: string;
  scoreCircle?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <DashCard>
      <div className="flex items-start gap-4">
        {scoreCircle || (
          <div
            className="w-[56px] h-[56px] rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--paper-2)', border: '3px solid var(--rule)' }}
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--m-muted)' }}>
            {label}
          </p>
          <p className="text-[15px] font-semibold mt-0.5" style={{ color: 'var(--ink)' }}>
            {value}
          </p>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            {subtext}
          </p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed mt-3 pt-3" style={{ color: 'var(--m-muted)', borderTop: '1px solid var(--rule)' }}>
        {description}
      </p>
      {children}
    </DashCard>
  );
}

function CompetitorPlacementTable({
  competitors,
}: {
  competitors: Array<{ name: string; mentions: number; avgPlacement: number | null; byModel: Record<string, number | null> }>;
}) {
  if (competitors.length === 0) return null;

  const models = Array.from(
    new Set(competitors.flatMap(c => Object.keys(c.byModel)))
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>
              Competitor
            </th>
            <th className="text-center py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>
              Mentions
            </th>
            {models.map(m => (
              <th key={m} className="text-center py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>
                <div className="flex items-center justify-center gap-1.5">
                  <AIProviderIcon provider={providerKeyToIcon(m) ?? 'chatgpt'} size={14} />
                  <span className="hidden sm:inline">{m === 'claude' ? 'Claude' : m === 'gpt4o' ? 'GPT-4o' : m === 'gemini' ? 'Gemini' : m === 'perplexity' ? 'Perplexity' : m}</span>
                </div>
              </th>
            ))}
            <th className="text-center py-2 px-3 font-semibold" style={{ color: 'var(--m-muted)', borderBottom: '1px solid var(--rule)' }}>
              Avg position
            </th>
          </tr>
        </thead>
        <tbody>
          {competitors.map((comp, i) => (
            <tr key={comp.name} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--paper-2)' }}>
              <td className="py-2 px-3 font-medium" style={{ color: 'var(--ink)' }}>
                {comp.name}
              </td>
              <td className="text-center py-2 px-3 tabular-nums" style={{ color: 'var(--m-muted)' }}>
                {comp.mentions}
              </td>
              {models.map(m => {
                const pos = comp.byModel[m];
                return (
                  <td key={m} className="text-center py-2 px-3 tabular-nums" style={{ color: pos != null ? 'var(--ink)' : 'var(--m-muted)' }}>
                    {pos != null ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                        style={{
                          background: pos <= 2 ? 'rgba(34,197,94,0.1)' : pos <= 3 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.08)',
                          color: pos <= 2 ? 'var(--ok)' : pos <= 3 ? 'var(--warn)' : 'var(--severe)',
                        }}
                      >
                        #{pos}
                      </span>
                    ) : '--'}
                  </td>
                );
              })}
              <td className="text-center py-2 px-3 tabular-nums font-semibold" style={{ color: comp.avgPlacement != null ? 'var(--ink)' : 'var(--m-muted)' }}>
                {comp.avgPlacement != null ? `#${comp.avgPlacement.toFixed(1)}` : '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashCard({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{ background: 'var(--card)', border: '1px solid var(--rule)', ...style }}
    >
      {children}
    </div>
  );
}

function EmptyCardBody({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[11px] text-center max-w-xs" style={{ color: 'var(--m-muted)' }}>{message}</p>
    </div>
  );
}

/* ── Sub-metric card for executive overview ── */

function SubMetric({ label, value, suffix, tooltip }: { label: string; value: number | null; suffix?: string; tooltip?: string }) {
  const color = value != null ? scoreColor(value) : 'var(--m-muted)';
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }} title={tooltip}>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>{label}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color }}>{value != null ? Math.round(value) : '--'}</span>
        {value != null && suffix && <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

/* ── Mini stat for perception section ── */

function MiniStat({ label, value, suffix, isCount }: { label: string; value: number | null; suffix: string; isCount?: boolean }) {
  const color = value != null ? (isCount ? 'var(--ink)' : scoreColor(value)) : 'var(--m-muted)';
  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>{label}</p>
      <div className="flex items-baseline gap-0.5">
        <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color }}>{value != null ? value : '--'}</span>
        {value != null && suffix && <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

/* ── Model card for Section 2 ── */

function ModelCard({ probe, brandName, expanded, onToggle }: { probe: ModelProbe; brandName: string; expanded: boolean; onToggle: () => void }) {
  const providerKey = providerKeyToIcon(probe.model_id);
  const recognition = recognitionStatus(probe.accuracy_score);
  const sentiment = probe.sentiment_score ?? null;
  const sentimentInfo = sentiment != null ? sentimentLabel(sentiment) : null;
  const hasEvidence = probe.results_json && probe.results_json.length > 0;

  // Derive issue tags
  const issues: Array<{ label: string; color: string }> = [];
  if (probe.accuracy_score < 20) issues.push({ label: 'Low recognition', color: 'var(--severe)' });
  else if (probe.accuracy_score < 50) issues.push({ label: 'Weak accuracy', color: 'var(--warn)' });
  if (sentiment != null && sentiment < 40) issues.push({ label: 'Negative sentiment', color: 'var(--severe)' });
  if (probe.placement_score != null && probe.placement_score > 3.5) issues.push({ label: 'Low placement', color: 'var(--warn)' });

  // Count accuracy types from results
  const accuracyCounts = useMemo(() => {
    if (!probe.results_json) return { accurate: 0, partial: 0, inaccurate: 0, total: 0 };
    let accurate = 0, partial = 0, inaccurate = 0;
    for (const r of probe.results_json) {
      const n = normalizeAccuracy(r.accuracy);
      if (n === 'Accurate') accurate++;
      else if (n === 'Partial') partial++;
      else if (n === 'Inaccurate' || n === 'Hallucinated') inaccurate++;
      // 'No Data' is not counted as inaccurate
    }
    return { accurate, partial, inaccurate, total: probe.results_json.length };
  }, [probe.results_json]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rule)', background: 'color-mix(in srgb, var(--ink) 1.5%, transparent)' }}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-3.5 py-3 text-left" aria-expanded={expanded}>
        {/* Provider icon */}
        {providerKey && (
          <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <AIProviderIcon provider={providerKey} size={16} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{probe.model_label}</span>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: recognition.color, background: recognition.bg }}>
              {recognition.label}
            </span>
          </div>
          {/* Issue tags */}
          {issues.length > 0 && (
            <div className="flex gap-1 mt-0.5">
              {issues.map((issue, i) => (
                <span key={i} className="text-[8px] font-medium px-1 py-0.5 rounded" style={{ color: issue.color, background: `color-mix(in srgb, ${issue.color} 8%, transparent)` }}>
                  {issue.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Accuracy score */}
        <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: scoreColor(probe.accuracy_score), background: `color-mix(in srgb, ${scoreColor(probe.accuracy_score)} 10%, transparent)` }}>
          {probe.accuracy_score}%
        </span>

        {/* Sentiment badge */}
        {sentimentInfo && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: sentimentInfo.color, background: `color-mix(in srgb, ${sentimentInfo.color} 10%, transparent)` }}>
            {sentimentInfo.label}
          </span>
        )}

        {hasEvidence && <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--m-muted)' }} />}
      </button>

      {expanded && hasEvidence && (
        <div className="px-3.5 pb-3.5 space-y-3" style={{ borderTop: '1px solid var(--rule)' }}>
          {/* Summary stats */}
          <div className="flex items-center gap-3 pt-2.5">
            <span className="text-[10px]" style={{ color: 'var(--ok)' }}>{accuracyCounts.accurate} accurate</span>
            <span className="text-[10px]" style={{ color: 'var(--warn)' }}>{accuracyCounts.partial} partial</span>
            <span className="text-[10px]" style={{ color: 'var(--severe)' }}>{accuracyCounts.inaccurate} inaccurate</span>
            {probe.placement_score != null && (
              <span className="text-[10px] ml-auto" style={{ color: 'var(--m-muted)' }}>Placement: {probe.placement_score.toFixed(1)}/5</span>
            )}
          </div>

          {/* Q&A cards */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>What this model said</p>
          {probe.results_json!.map((r, i) => {
            const norm = normalizeAccuracy(r.accuracy);
            const accColor = norm === 'Accurate' ? 'var(--ok)' : norm === 'Partial' ? 'var(--warn)' : 'var(--severe)';
            return (
              <div key={i} className="rounded-md p-3" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                <p className="text-[10px] font-semibold mb-1" style={{ color: 'var(--m-muted)' }}>Q: {r.question}</p>
                <p className="text-[11px] leading-relaxed mb-1.5" style={{ color: 'var(--ink)', opacity: 0.85 }}>{r.answer}</p>
                <div className="flex items-center gap-2">
                  {norm && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: accColor, background: `color-mix(in srgb, ${accColor} 10%, transparent)` }}>
                      {norm}
                    </span>
                  )}
                  {r.accuracyNote && (
                    <span className="text-[9px]" style={{ color: 'var(--m-muted)' }}>{r.accuracyNote}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Perception themes */}
          {probe.sentiment_themes && probe.sentiment_themes.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--m-muted)' }}>Perception themes</p>
              <div className="flex flex-wrap gap-1">
                {probe.sentiment_themes.map((t, i) => (
                  <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full capitalize" style={{
                    color: t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)',
                    background: `color-mix(in srgb, ${t.polarity === 'positive' ? 'var(--ok)' : t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)'} 10%, transparent)`,
                  }}>{t.theme}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Methodology item ── */

function MethodItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{icon}</div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] mb-0.5" style={{ color: 'var(--m-muted)' }}>{label}</p>
        <p className="text-[11px] leading-[1.5]" style={{ color: 'var(--ink)', opacity: 0.75 }}>{children}</p>
      </div>
    </div>
  );
}

/* ── Competitor Editor ── */

function CompetitorEditor({
  drafts, isDirty, detecting, saving, error, info,
  onAdd, onUpdate, onRemove, onReset, onAutoDetect, onRescan, onSave,
}: {
  drafts: DraftCompetitor[];
  isDirty: boolean;
  detecting: boolean;
  saving: boolean;
  error: string | null;
  info: string | null;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<DraftCompetitor>) => void;
  onRemove: (id: string) => void;
  onReset: () => void;
  onAutoDetect: () => void;
  onRescan: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>
        Manage competitors
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button type="button" onClick={onAutoDetect} disabled={detecting || saving} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
          <Sparkles size={10} /> {drafts.length === 0 ? 'Auto-detect' : 'Re-detect'}
        </button>
        {drafts.length > 0 && (
          <button type="button" onClick={onRescan} disabled={detecting || saving} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
            <RefreshCw size={10} className={detecting ? 'animate-spin' : ''} /> Re-score
          </button>
        )}
        <button type="button" onClick={onAdd} disabled={detecting || saving} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--ink)', background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
          <Plus size={10} /> Add
        </button>
        <div className="flex-1" />
        {isDirty && (
          <>
            <button type="button" onClick={onReset} disabled={saving || detecting} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md disabled:opacity-50" style={{ color: 'var(--m-muted)' }}>
              <X size={10} /> Cancel
            </button>
            <button type="button" onClick={onSave} disabled={saving || detecting} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-50" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
              <Save size={10} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="mb-2 p-2 rounded-md flex items-start gap-1.5 text-[11px]" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }} role="alert">
          <AlertCircle size={11} className="mt-0.5 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}
      {info && !error && (
        <div className="mb-2 p-2 rounded-md flex items-start gap-1.5 text-[11px]" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink)' }}>
          <Info size={11} className="mt-0.5 flex-shrink-0" /> <span>{info}</span>
        </div>
      )}
      {detecting && (
        <p className="text-[11px] mb-2" style={{ color: 'var(--m-muted)' }}>
          <Sparkles size={10} className="inline -mt-0.5 mr-1" /> Working...
        </p>
      )}

      {drafts.length > 0 && (
        <ul className="space-y-1.5">
          {drafts.map((c) => (
            <li key={c.id} className="rounded-md p-2.5" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)', border: '1px solid var(--rule)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="text" value={c.domain} placeholder="example.com"
                  onChange={(e) => onUpdate(c.id, { domain: e.target.value })}
                  className="flex-1 min-w-0 text-[12px] px-2.5 py-1.5 rounded-md outline-none"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  aria-label="Competitor domain"
                />
                {c.score != null && c.score > 0 && (
                  <span className="tabular-nums font-semibold text-[11px]" style={{ color: scoreColor(c.score) }}>{c.score}</span>
                )}
                <button type="button" onClick={() => onRemove(c.id)} className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:opacity-80 flex-shrink-0" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 8%, transparent)' }} aria-label="Remove">
                  <Trash2 size={11} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
