'use client';

/**
 * AI Perception — how AI models see, understand, and represent the brand.
 *
 * Surfaces:
 *  1) Multi-model AI probes — what ChatGPT, Claude, Gemini, Perplexity say
 *     about the brand (accuracy, sentiment, placement).
 *  2) Competitor placement — who AI models mention first in category prompts.
 *  3) Per-page AI readability — what AI crawlers can extract from each page.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Globe,
  Code,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
  Target,
  ThumbsUp,
  ThumbsDown,
  Minus,
  BarChart3,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import ScoreCircle from '@/components/ui/ScoreCircle';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import { AIProviderIcon, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence';

/* ── Types ─────────────────────────────────────────── */

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

function normalizeAccuracy(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const a = raw.toLowerCase().trim();
  if (a.includes('accurate') && !a.includes('partial') && !a.includes('in')) return 'Accurate';
  if (a.includes('partial')) return 'Partial';
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

function sentimentLabel(s: number | null | undefined): string {
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
  // Convert 1-5 scale to 0-100 where 1 = 100, 5 = 0
  return Math.round(Math.max(0, Math.min(100, (5 - p) / 4 * 100)));
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

/* ── MetricCard ────────────────────────────────────── */

function MetricCard({
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
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            {subtext}
          </p>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed mt-3 pt-3" style={{ color: 'var(--m-muted)', borderTop: '1px solid var(--rule)' }}>
        {description}
      </p>
      {children}
    </DashCard>
  );
}

/* ── CompetitorRow ──────────────────────────────────── */

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

/* ── Main Page ─────────────────────────────────────── */

export default function AIPerceptionPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const loading = authLoading || bundleLoading || !ready;

  const [modelProbes, setModelProbes] = useState<ModelProbe[]>([]);
  const [promptResults, setPromptResults] = useState<PromptResult[]>([]);
  const [biSummary, setBiSummary] = useState<BrandIntelligenceSummary | null>(null);
  const [pages, setPages] = useState<AuditPageRow[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  // Re-scan state
  const [rescanning, setRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);
  const [rescanAvailable, setRescanAvailable] = useState(true);
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null);

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

  useEffect(() => {
    const audit = bundle?.audit;
    if (!audit) {
      setModelProbes([]); setBiSummary(null); setPages([]); setPromptResults([]);
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
        // Also pull brand intelligence from report if available
        if (d?.brandIntelligence) setBiSummary(d.brandIntelligence as BrandIntelligenceSummary);
      })
      .catch(() => {});

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

  /* ── Computed metrics ─────────────────────────────── */

  const measured = useMemo(() => modelProbes.filter(p => p.status === 'measured' && p.accuracy_score != null), [modelProbes]);

  const overallAccuracy = useMemo(() => {
    if (measured.length === 0) return null;
    return Math.round(measured.reduce((s, p) => s + p.accuracy_score, 0) / measured.length);
  }, [measured]);

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

  // All sentiment themes across models
  const allThemes = useMemo(() => {
    const themes: Array<{ theme: string; polarity: string; count: number }> = [];
    for (const probe of modelProbes) {
      if (probe.sentiment_themes) themes.push(...probe.sentiment_themes);
    }
    // Dedupe by theme name
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

  // Competitor data from prompt results
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

  // Question groups across models
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
      // After a fresh scan, cooldown starts now (168 hours from now)
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

  /* ── Render ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--m-muted)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!bundle?.audit) return <EmptyAudit />;

  const hasProbes = modelProbes.length > 0;
  const hasSentiment = avgSentiment != null;
  const hasPlacement = avgPlacement != null;
  const hasCompetitors = competitorData.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Header + Re-scan ── */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={<Bot size={18} strokeWidth={1.75} />}
          title="AI Perception"
          subtitle="How AI models see, describe, and rank your brand"
        />
        {hasProbes && (
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-1">
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
              <p className="text-[11px] max-w-[280px] text-right leading-snug" style={{ color: 'var(--m-muted)' }}>
                {cooldownMessage}
              </p>
            )}
            {rescanMessage && (
              <p className="text-[11px] max-w-[280px] text-right" style={{ color: 'var(--m-muted)' }}>
                {rescanMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Explainer banner ── */}
      <div
        className="flex items-start gap-3 rounded-lg border px-4 py-3"
        style={{
          background: 'color-mix(in srgb, var(--ink) 3%, transparent)',
          borderColor: 'var(--rule)',
        }}
      >
        <Search size={15} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
          We ask leading AI models — ChatGPT, Claude, Gemini, and Perplexity — questions about your brand,
          then compare their answers to what your website actually says. This shows you how accurately AI
          represents your brand to the millions of people using it every day.
        </p>
      </div>

      {/* ── New brand notice ── */}
      {hasProbes && overallAccuracy != null && overallAccuracy < 50 && (
        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3"
          style={{
            background: 'rgba(34,197,94,0.04)',
            borderColor: 'rgba(34,197,94,0.15)',
          }}
        >
          <Info size={15} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ok)' }} />
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink)' }}>
            <span className="font-semibold">Low accuracy is normal for newer brands.</span>{' '}
            AI models can read your website, but they won{"'"}t confidently endorse your claims until
            independent sources corroborate them. Focus on building authoritative backlinks, earning
            press mentions, and keeping your content clear — AI confidence follows web authority.
          </p>
        </div>
      )}

      {/* ── Summary metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={<Target size={18} strokeWidth={1.75} style={{ color: scoreColorVar(overallAccuracy) }} />}
          label="Accuracy"
          value={overallAccuracy != null ? `${overallAccuracy}%` : 'Not measured'}
          subtext={overallAccuracy != null ? `${measured.length} model${measured.length !== 1 ? 's' : ''} tested` : 'Run an audit to measure'}
          description="How well AI answers match what your website actually claims. We ask each model about your brand and grade their responses against your real content."
          scoreCircle={<ScoreCircle score={overallAccuracy} size="small" px={56} />}
        />

        <MetricCard
          icon={
            hasSentiment ? (
              avgSentiment! >= 60 ? <ThumbsUp size={18} strokeWidth={1.75} style={{ color: 'var(--ok)' }} /> :
              avgSentiment! >= 40 ? <Minus size={18} strokeWidth={1.75} style={{ color: 'var(--warn)' }} /> :
              <ThumbsDown size={18} strokeWidth={1.75} style={{ color: 'var(--severe)' }} />
            ) : <ThumbsUp size={18} strokeWidth={1.75} style={{ color: 'var(--m-muted)' }} />
          }
          label="Sentiment"
          value={sentimentLabel(avgSentiment)}
          subtext={hasSentiment ? `${avgSentiment}/100 average tone` : 'Needs brand intelligence analysis'}
          description="The overall tone AI models use when talking about your brand. Positive sentiment means AI recommends you confidently; negative means it hedges or warns users."
          scoreCircle={<ScoreCircle score={avgSentiment} size="small" px={56} />}
        />

        <MetricCard
          icon={
            <span className="text-[15px] font-bold tabular-nums" style={{ color: scoreColorVar(placementScoreToPercent(avgPlacement)) }}>
              {avgPlacement != null ? `#${avgPlacement}` : '--'}
            </span>
          }
          label="Avg placement"
          value={placementLabel(avgPlacement)}
          subtext={hasPlacement ? 'position when AI lists options' : 'Needs brand intelligence analysis'}
          description="Where your brand appears in AI responses when someone asks for recommendations in your category. #1 means you are the first brand mentioned; #5 means you are buried at the bottom."
          scoreCircle={
            <ScoreCircle score={placementScoreToPercent(avgPlacement)} size="small" px={56} />
          }
        />
      </div>

      {/* ── Per-model breakdown ── */}
      {hasProbes && (
        <DashCard>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Model-by-model breakdown</h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            How each AI model performs when asked about your brand. Accuracy, sentiment, and placement vary by model.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {modelProbes.map(probe => {
              const badge = accuracyBadge(probe.accuracy_score);
              const hasSent = probe.sentiment_score != null;
              const hasPlace = probe.placement_score != null;

              return (
                <div
                  key={probe.model_id}
                  className="rounded-lg px-4 py-4"
                  style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
                >
                  <div className="flex items-center gap-2.5 mb-3">
                    <AIProviderIcon provider={providerKeyToIcon(probe.model_id) ?? 'chatgpt'} size={20} />
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{probe.model_label}</span>
                  </div>

                  <div className="space-y-2">
                    {/* Accuracy */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Accuracy</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                          {probe.accuracy_score}%
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    {/* Sentiment */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Sentiment</span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: hasSent ? scoreColorVar(probe.sentiment_score) : 'var(--m-muted)' }}>
                        {hasSent ? `${probe.sentiment_score}/100` : '--'}
                      </span>
                    </div>

                    {/* Placement */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Placement</span>
                      <span className="text-[12px] font-semibold tabular-nums" style={{ color: hasPlace ? 'var(--ink)' : 'var(--m-muted)' }}>
                        {hasPlace ? `#${probe.placement_score}` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Themes */}
                  {probe.sentiment_themes && probe.sentiment_themes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-2" style={{ borderTop: '1px solid var(--rule)' }}>
                      {probe.sentiment_themes.slice(0, 3).map(t => (
                        <span
                          key={t.theme}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: t.polarity === 'positive' ? 'rgba(34,197,94,0.08)' :
                              t.polarity === 'negative' ? 'rgba(239,68,68,0.08)' : 'var(--paper-2)',
                            color: t.polarity === 'positive' ? 'var(--ok)' :
                              t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)',
                            border: '1px solid var(--rule)',
                          }}
                        >
                          {t.theme}
                        </span>
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
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            Recurring topics AI models mention about your brand, classified by tone.
          </p>
          <div className="flex flex-wrap gap-2">
            {allThemes.map(t => (
              <span
                key={t.theme}
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg font-medium"
                style={{
                  background: t.polarity === 'positive' ? 'rgba(34,197,94,0.08)' :
                    t.polarity === 'negative' ? 'rgba(239,68,68,0.06)' : 'var(--paper-2)',
                  color: t.polarity === 'positive' ? 'var(--ok)' :
                    t.polarity === 'negative' ? 'var(--severe)' : 'var(--m-muted)',
                  border: '1px solid var(--rule)',
                }}
              >
                {t.polarity === 'positive' ? <ThumbsUp size={11} /> :
                 t.polarity === 'negative' ? <ThumbsDown size={11} /> :
                 <Minus size={11} />}
                {t.theme}
              </span>
            ))}
          </div>
        </DashCard>
      )}

      {/* ── Competitor AI placement ── */}
      {hasCompetitors && (
        <DashCard>
          <div className="flex items-center gap-2 mb-1">
            <Users size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Competitor AI placement</h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            When people ask AI about your category, these competitors get mentioned too.
            Lower position numbers mean the competitor appears earlier in AI responses.
          </p>
          <CompetitorPlacementTable competitors={competitorData} />
        </DashCard>
      )}

      {/* ── Question-grouped responses ── */}
      {questionGroups.length > 0 && (
        <DashCard>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>What AI models say about you</h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            We asked each AI model the same questions about your brand. Expand a question to see how each model answered and whether its response matches your website.
          </p>

          <div className="space-y-2">
            {questionGroups.map((group, i) => {
              const expanded = expandedQuestion === i;
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
                              {a.accuracyNote && (
                                <p className="text-[11px] mt-2 pt-2 italic" style={{ color: 'var(--m-muted)', borderTop: '1px solid var(--rule)', opacity: 0.8 }}>
                                  {a.accuracyNote}
                                </p>
                              )}
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
          <div className="flex items-center gap-2 mb-1">
            <Globe size={15} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Page-level AI readability</h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            What AI crawlers can extract from each page on your site. Pages with more structured data and clear signals are easier for AI to understand and recommend.
          </p>

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

      {/* ── How to improve ── */}
      {hasProbes && (
        <DashCard className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} strokeWidth={1.75} style={{ color: 'var(--ok)' }} />
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>How to improve your AI presence</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Improve accuracy</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                Make your website content clear, specific, and structured. Use schema markup, clear headings, and explicit claims that AI can easily parse and verify.
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Boost sentiment</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                Earn positive mentions from authoritative sources — press coverage, expert reviews, satisfied customers on trusted platforms. AI sentiment follows public perception.
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Climb placement rankings</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                Be the most cited and linked-to brand in your category. AI models rank brands higher when many independent sources reference them consistently.
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid var(--rule)' }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Beat competitors</p>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                Create content that directly addresses common category questions. AI recommends brands that have clear, comprehensive answers to what users are asking.
              </p>
            </div>
          </div>
        </DashCard>
      )}
    </div>
  );
}
