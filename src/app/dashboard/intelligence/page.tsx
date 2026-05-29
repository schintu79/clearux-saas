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

import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import ScoreCircle from '@/components/ui/ScoreCircle';
import { AIProviderIcon, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence';

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

type AuditRecommendation = {
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  deployable: boolean;
  fixType?: string;
};

/* ── Helpers ────────────────────────────────────────── */

function scoreColor(s: number | null): string {
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

function normalizeAccuracy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const a = raw.toLowerCase().trim();
  if (a.includes('accurate') && !a.includes('partial') && !a.includes('in')) return 'Accurate';
  if (a.includes('partial')) return 'Partial';
  return 'Inaccurate';
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

  // Opportunity line
  if (negativeThemes.length > 0) {
    lines.push(`Main opportunity: address ${negativeThemes.slice(0, 2).join(' and ')} to improve how AI represents your brand.`);
  } else if (avgAccuracy < 70) {
    lines.push(`Main opportunity: clarify your positioning and strengthen model-readable trust signals to improve accuracy.`);
  }

  return lines.length > 0 ? lines : [`${brandName} has a ${overallScore >= 70 ? 'strong' : overallScore >= 40 ? 'moderate' : 'weak'} AI brand intelligence profile. Review the detailed breakdown below for specific insights and actions.`];
}

/* ── Main Page ─────────────────────────────────────── */

export default function IntelligencePage() {
  const { user, loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
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

  // UI state
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showCompetitorEditor, setShowCompetitorEditor] = useState(false);
  const [signalFilter, setSignalFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const [showMethodology, setShowMethodology] = useState(false);
  const [showAllRecs, setShowAllRecs] = useState(false);

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setDrafts([]); setServerSnapshot([]); setBenchmarkPosition(null); setIndustry(null);
      setBiSummary(null); setModelProbes([]); setRecommendations([]);
      setHumanPerception(null); setRedditMentions([]); setWebMentions([]);
      setReviewData([]); setTrendSnapshots([]); setContentGaps([]);
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
        setBenchmarkPosition(d?.benchmarkPosition || null);
        if (d?.industry) setIndustry(d.industry);
        if (d?.modelProbes) setModelProbes(d.modelProbes);
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

  // Computed metrics
  const avgAccuracy = useMemo(() => {
    if (modelProbes.length === 0) return 0;
    return Math.round(modelProbes.reduce((a, p) => a + p.accuracy_score, 0) / modelProbes.length);
  }, [modelProbes]);

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

  const sentimentScore = biSummary?.overallSentiment ?? null;
  const visibilityScore = biSummary?.shareOfVoice ?? null;

  // Hallucinations — extract from probe results where accuracy is inaccurate/fabricated
  const hallucinations = useMemo(() => {
    const items: Array<{ model: string; question: string; answer: string; note?: string }> = [];
    for (const probe of modelProbes) {
      if (!probe.results_json) continue;
      for (const r of probe.results_json) {
        const norm = normalizeAccuracy(r.accuracy);
        if (norm === 'Inaccurate') {
          items.push({ model: probe.model_label, question: r.question, answer: r.answer, note: r.accuracyNote || undefined });
        }
      }
    }
    return items;
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

  const hasData = biSummary || modelProbes.length > 0 || overallScore > 0;

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

      {/* ═══════════════════════════════════════════════════
          SECTION 1: Executive Overview
         ═══════════════════════════════════════════════════ */}
      <DashCard className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={14} strokeWidth={1.75} style={{ color: 'var(--signal)' }} />
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Executive overview</h2>
        </div>
        <p className="text-[11px] mb-4" style={{ color: 'var(--m-muted)' }}>
          How AI models understand, rank, and describe {brandName}
        </p>

        {hasData ? (
          <>
            {/* Hero score + sub-metrics */}
            <div className="flex flex-col md:flex-row items-center gap-6 mb-5">
              {/* Main hero score */}
              <div className="flex-shrink-0">
                <ScoreCircle score={biSummary?.score ?? overallScore} size="medium" />
                <p className="text-[11px] font-semibold text-center mt-2" style={{ color: 'var(--m-muted)' }}>Brand Intelligence</p>
              </div>

              {/* Sub-metric row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1 w-full">
                <SubMetric label="AI visibility" value={visibilityScore} suffix="%" tooltip="How often AI models mention your brand when asked about your category" />
                <SubMetric label="Accuracy" value={avgAccuracy} tooltip="How accurately AI describes your brand compared to your actual site content" />
                <SubMetric label="Sentiment" value={sentimentScore} tooltip="How positively or negatively AI portrays your brand reputation" />
                <SubMetric label="Avg. placement" value={avgPlacement != null ? Math.round((5 - avgPlacement) / 4 * 100) : null} tooltip="Where your brand appears in AI responses (higher = mentioned earlier)" />
                <SubMetric label="Coverage" value={coverageScore} suffix="%" tooltip={`${recognizedCount} of ${modelProbes.length} models recognize your brand`} />
              </div>
            </div>

            {/* Executive summary */}
            {executiveSummary.length > 0 && (
              <div className="rounded-lg px-4 py-3.5" style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                <div className="flex items-start gap-2.5">
                  <Lightbulb size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--signal)' }} />
                  <div className="space-y-1.5">
                    {executiveSummary.map((line, i) => (
                      <p key={i} className="text-[12.5px] leading-[1.6]" style={{ color: 'var(--ink)', opacity: 0.85 }}>{line}</p>
                    ))}
                  </div>
                </div>
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
      </DashCard>

      {/* ═══════════════════════════════════════════════════
          SECTION 2: AI Model Understanding
         ═══════════════════════════════════════════════════ */}
      {modelProbes.length > 0 && (
        <DashCard className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot size={14} strokeWidth={1.75} style={{ color: 'var(--signal)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>AI model understanding</h2>
          </div>
          <p className="text-[11px] mb-1" style={{ color: 'var(--m-muted)' }}>
            What each AI model knows about {brandName} — accuracy, sentiment, and issues
          </p>

          {/* Compact methodology */}
          <div className="mb-3 px-3 py-2 rounded-md flex items-center gap-2.5" style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)' }}>
            <Info size={11} style={{ color: 'var(--signal)', flexShrink: 0 }} />
            <p className="text-[11px] leading-[1.45]" style={{ color: 'var(--ink)', opacity: 0.6 }}>
              Each model was asked identical questions about {brandName} with no prior context. Accuracy measures how well answers match your actual site content.
            </p>
          </div>

          <div className="space-y-2">
            {modelProbes.map((probe) => (
              <ModelCard
                key={probe.model_id}
                probe={probe}
                brandName={brandName}
                expanded={expandedModel === probe.model_id}
                onToggle={() => setExpandedModel(expandedModel === probe.model_id ? null : probe.model_id)}
              />
            ))}
          </div>
        </DashCard>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 3: Brand Narrative & Perception
         ═══════════════════════════════════════════════════ */}
      {(biSummary || hasRealHumanData) && (
        <DashCard className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={14} strokeWidth={1.75} style={{ color: 'var(--signal)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Brand narrative and perception</h2>
          </div>
          <p className="text-[11px] mb-4" style={{ color: 'var(--m-muted)' }}>
            How AI and the web describe, praise, and criticize {brandName}
          </p>

          {/* Sentiment overview row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <MiniStat label="AI sentiment" value={biSummary?.overallSentiment ?? null} suffix="/100" />
            {hasRealHumanData && humanSentimentScore != null && (
              <MiniStat label="Human sentiment" value={humanSentimentScore} suffix="/100" />
            )}
            {allSignals.length > 0 && (
              <MiniStat label="Public signals" value={allSignals.length} suffix="" isCount />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Positive signals */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5" style={{ color: 'var(--ok)' }}>
                <ThumbsUp size={10} /> Positive signals
              </p>
              {(biSummary?.positiveThemes?.length ?? 0) > 0 || (hp?.topPositiveThemes?.length ?? 0) > 0 ? (
                <ul className="space-y-1.5">
                  {biSummary?.positiveThemes?.slice(0, 4).map((t) => (
                    <li key={t} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md capitalize" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)', color: 'var(--ink)' }}>
                      <CheckCircle2 size={11} style={{ color: 'var(--ok)' }} /> {t}
                    </li>
                  ))}
                  {hasRealHumanData && hp?.topPositiveThemes?.slice(0, 2).map((t: any, i: number) => (
                    <li key={`h-${i}`} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)', color: 'var(--ink)' }}>
                      <Users size={11} style={{ color: 'var(--ok)' }} /> {t.theme}
                      <span className="text-[9px] ml-auto flex-shrink-0" style={{ color: 'var(--m-muted)' }}>human</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] px-3 py-2" style={{ color: 'var(--m-muted)' }}>No positive signals detected yet</p>
              )}
            </div>

            {/* Negative / weak signals */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5" style={{ color: 'var(--severe)' }}>
                <ThumbsDown size={10} /> Negative or weak signals
              </p>
              {(biSummary?.negativeThemes?.length ?? 0) > 0 || (hp?.topNegativeThemes?.length ?? 0) > 0 ? (
                <ul className="space-y-1.5">
                  {biSummary?.negativeThemes?.slice(0, 4).map((t) => (
                    <li key={t} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md capitalize" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', color: 'var(--ink)' }}>
                      <AlertCircle size={11} style={{ color: 'var(--severe)' }} /> {t}
                    </li>
                  ))}
                  {hasRealHumanData && hp?.topNegativeThemes?.slice(0, 2).map((t: any, i: number) => (
                    <li key={`h-${i}`} className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-md" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', color: 'var(--ink)' }}>
                      <Users size={11} style={{ color: 'var(--severe)' }} /> {t.theme}
                      <span className="text-[9px] ml-auto flex-shrink-0" style={{ color: 'var(--m-muted)' }}>human</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] px-3 py-2" style={{ color: 'var(--m-muted)' }}>No negative signals detected yet</p>
              )}
            </div>
          </div>

          {/* Hallucinations & confusion */}
          {hallucinations.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5" style={{ color: 'var(--warn)' }}>
                <AlertTriangle size={10} /> Hallucinations and confusion ({hallucinations.length})
              </p>
              <p className="text-[11px] mb-3" style={{ color: 'var(--m-muted)' }}>
                Where AI models are inventing, guessing, or confusing {brandName} with other entities. This directly shows where your brand is not machine-legible enough.
              </p>
              <div className="space-y-2">
                {hallucinations.slice(0, 4).map((h, i) => (
                  <div key={i} className="rounded-md px-3 py-2.5" style={{ background: 'color-mix(in srgb, var(--warn) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 10%, transparent)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}>{h.model}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink)', opacity: 0.85 }}>{h.answer.slice(0, 200)}{h.answer.length > 200 ? '...' : ''}</p>
                    {h.note && <p className="text-[10px] mt-1" style={{ color: 'var(--severe)' }}>{h.note}</p>}
                  </div>
                ))}
                {hallucinations.length > 4 && (
                  <p className="text-[10px] text-center" style={{ color: 'var(--m-muted)' }}>+{hallucinations.length - 4} more inaccurate responses</p>
                )}
              </div>
            </div>
          )}

          {/* Human signals feed */}
          {allSignals.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
                  Public mentions ({allSignals.length})
                </p>
                <div className="flex-1" />
                {(['all', 'positive', 'negative'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setSignalFilter(f === 'all' ? 'all' : f)}
                    className="px-2 py-0.5 rounded text-[9px] font-medium capitalize"
                    style={{
                      background: signalFilter === f ? 'var(--ink)' : 'transparent',
                      color: signalFilter === f ? 'var(--paper)' : 'var(--m-muted)',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {filteredSignals.slice(0, 10).map((signal, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px]" style={{ background: 'color-mix(in srgb, var(--ink) 2%, transparent)' }}>
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: signal.sentiment === 'positive' ? 'var(--ok)' : signal.sentiment === 'negative' ? 'var(--severe)' : 'var(--warn)' }}
                    />
                    <span className="flex-1 min-w-0 truncate font-medium" style={{ color: 'var(--ink)' }}>{signal.title}</span>
                    <span className="text-[9px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{signal.source}</span>
                    {signal.sourceUrl && (
                      <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 hover:opacity-70">
                        <ExternalLink size={9} style={{ color: 'var(--m-muted)' }} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
              {filteredSignals.length > 10 && (
                <p className="text-[10px] mt-1.5 text-center" style={{ color: 'var(--m-muted)' }}>
                  +{filteredSignals.length - 10} more
                </p>
              )}
            </div>
          )}
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
              <button
                type="button"
                onClick={() => { setShowCompetitorEditor(true); }}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Add competitors <ArrowRight size={10} />
              </button>
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

    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Shared components
   ══════════════════════════════════════════════════════════ */

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
      else if (n === 'Inaccurate') inaccurate++;
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
