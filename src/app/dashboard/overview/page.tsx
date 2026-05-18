'use client';

/**
 * Overview — brand audit command center for the SELECTED brand/site.
 *
 * Lives at `/dashboard/overview`. Mirrors the audit detail page so the
 * operator gets the same shapes (module cards, checkpoint health, score
 * trend, benchmarks) wherever they land. If the selected brand has no
 * audit, render a clean empty state — never another brand's data.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Globe,
  Fingerprint,
  ExternalLink,
  Download,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  X,
  FileSearch,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Zap,
  AlertTriangle,
  Share2,
  MoreVertical,
  Link as LinkIcon,
  LineChart,
  Check,
  Trash2,
  ListChecks,
  Info,
  TrendingUp,
  ArrowRight,
  Brain,
  Eye,
  Target,
  Map as MapIcon,
  Type,
  MousePointerClick,
  Shield,
  Heart,
  Accessibility,
  Smartphone,
  Gauge,
  MessageSquare,
  Scale,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { AIProviderIcon, providerKeyToIcon } from '@/components/ui/AIProviderIcon';
import {
  buildProviderRows,
  summarizeCoverage,
  coverageCaption,
} from '@/lib/ai-xray/provider-status';
import {
  ScoreOverTimeChart,
  HeuristicRadarChart,
} from '@/components/dashboard/AuditDashboard';
import ScoreRing from '@/components/ui/ScoreRing';
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints';
import {
  loadLatestAuditBundle,
  moduleScoresFromReport,
  isInProgressAuditStatus,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import { writeSelection } from '@/lib/dashboard/brand-selection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import type { Audit, Report, AuditFinding } from '@/types/database';

/* ── Pillar / module config (mirrors audit detail page) ─── */
const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Brand Consistency'];
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]];
const PILLAR_ICONS: React.ElementType[] = [Scale, Heart, Accessibility, Brain, FileSearch, Eye];

/** Category icons in 24-index order — matches analyzer.ts. */
const CATEGORY_ICONS: React.ElementType[] = [
  Eye, Target, MapIcon, Type,
  MousePointerClick, Shield, AlertTriangle, Heart,
  Accessibility, Brain, Sparkles, Smartphone,
  Gauge, Search, Zap, Globe,
  FileSearch, LinkIcon, Share2, Scale,
  Eye, MessageSquare, Target, CheckCircle2,
];

/** Module tints — same palette as the audit page so colors don't drift. */
const MODULE_TINTS = [
  { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.04)', border: 'rgba(59, 130, 246, 0.12)' },  // Foundation — blue
  { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.04)', border: 'rgba(236, 72, 153, 0.12)' },  // Human Experience — pink
  { dot: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.04)', border: 'rgba(139, 92, 246, 0.12)' },  // Inclusive Design — violet
  { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.04)', border: 'rgba(245, 158, 11, 0.12)' },  // Future Readiness — amber
  { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.04)', border: 'rgba(16, 185, 129, 0.12)' },  // SEO — emerald
  { dot: '#06B6D4', bg: 'rgba(6, 182, 212, 0.04)', border: 'rgba(6, 182, 212, 0.12)' },    // Brand — cyan
];

const statusMeta: Record<string, { label: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment', icon: Clock },
  payment_received:  { label: 'Processing',       icon: Zap },
  crawling:          { label: 'Crawling...',      icon: Globe },
  analysing:         { label: 'Analysing...',     icon: Sparkles },
  generating_report: { label: 'Generating...',    icon: FileSearch },
  completed:         { label: 'Completed',        icon: CheckCircle2 },
  failed:            { label: 'Failed',           icon: AlertTriangle },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-ok';
  if (s >= 40) return 'text-warn';
  return 'text-severe';
}

function scoreColorVar(s: number) {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function langCode(code: string | null | undefined): string {
  if (!code || code === 'en') return 'EN';
  return code.toUpperCase();
}

type AuditPage = {
  id?: string;
  url: string;
  title: string | null;
  status_code: number | null;
  is_mobile_friendly: boolean | null;
  ai_readability: any | null;
};

function OverviewInner() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditsBanner, setCreditsBanner] = useState(false);

  const [scoreTrend, setScoreTrend] = useState<Array<{ auditId: string; date: string; overallScore: number }>>([]);
  const [competitors, setCompetitors] = useState<Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>>([]);
  const [detectingCompetitors, setDetectingCompetitors] = useState(false);
  const [categoryScores, setCategoryScores] = useState<Array<{ name: string; score: number; summary: string }>>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [auditPages, setAuditPages] = useState<AuditPage[]>([]);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [modelProbes, setModelProbes] = useState<Array<{ model_id: string; model_label: string; accuracy_score: number; status?: 'measured' | 'skipped' | 'error' | null; error_message?: string | null }>>([]);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (searchParams.get('credits') !== 'purchased') return;
    setCreditsBanner(true);
    window.history.replaceState({}, '', '/dashboard/overview');
    const t = setTimeout(() => setCreditsBanner(false), 6000);
    fetch('/api/stripe/verify-credits', { method: 'POST' }).catch(() => {});
    return () => clearTimeout(t);
  }, [searchParams]);

  // Strip post-Stripe-redirect params once seen. The running-audit
  // banner driven by bundle.inProgressAudit conveys the actual state;
  // we just clean the URL so a reload doesn't re-trigger anything.
  useEffect(() => {
    if (!searchParams.get('payment') && !searchParams.get('audit')) return;
    window.history.replaceState({}, '', '/dashboard/overview');
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || !user || !ready) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setScoreTrend([]);
    setCompetitors([]);
    setCategoryScores([]);
    setFindings([]);
    setAuditPages([]);
    loadLatestAuditBundle(user.id, selection)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, ready, selection]);

  /* ── Poll in-progress audit until it reaches a terminal state ──
   *
   * When the bundle has an in-progress audit for this selection, we
   * poll its status row every ~7s. When the status flips to
   * `completed` or `failed`, we refetch the full bundle so the
   * populated dashboard (or failed-state UI) appears without a
   * manual reload. We only poll while a non-terminal audit exists —
   * the interval auto-cancels on unmount, on selection change, or
   * once the audit terminates.
   */
  const inProgressAuditId = bundle?.inProgressAudit?.id || null;
  useEffect(() => {
    if (!user || !inProgressAuditId) return;
    let cancelled = false;
    const supabase = createBrowserSupabase();

    const tick = async () => {
      if (cancelled) return;
      try {
        const { data } = await supabase
          .from('audits')
          .select('status')
          .eq('id', inProgressAuditId)
          .maybeSingle();
        const status = (data as any)?.status as string | undefined;
        if (cancelled) return;
        if (status && !isInProgressAuditStatus(status)) {
          // Terminal — refetch the whole bundle so the populated
          // dashboard or the failed-state UI takes over.
          const next = await loadLatestAuditBundle(user.id, selection);
          if (!cancelled) setBundle(next);
        }
      } catch {
        /* swallow — next tick will retry */
      }
    };

    const interval = setInterval(tick, 7000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, inProgressAuditId, selection]);

  useEffect(() => {
    if (!user || selection?.kind !== 'brand') {
      setBrandName(null);
      return;
    }
    const supabase = createBrowserSupabase();
    (async () => {
      try {
        const { data } = await supabase
          .from('brand_identities')
          .select('name')
          .eq('id', selection.brandId)
          .maybeSingle();
        setBrandName((data as any)?.name || null);
      } catch {}
    })();
  }, [user, selection]);

  // Defensive sync (PR #17): if the loaded bundle's audit identity does
  // NOT match the current selection (e.g. selection was null on a direct
  // visit and the loader returned the globally-most-recent audit), write
  // the resolved audit's identity back to the selection store so the
  // sidebar selector + topbar "Viewing X" agree with what the body is
  // showing.
  //
  // CRITICAL: this only fires when the selection is null/missing. We
  // must NEVER overwrite a real brand selection with a derived site
  // selection — that was the brand-selection loop bug. When the user
  // picked a brand and the loader returned a website-type audit that
  // belongs to that brand (joined via brand_identity_id), the previous
  // implementation flipped the selection from {brand:B} to {site:H},
  // which then made the sidebar visibly switch to the site even though
  // the user had just picked the brand. Guard against that by only
  // syncing when the selection is null.
  useEffect(() => {
    if (selection) return;
    const resolved = bundle?.audit;
    if (!resolved) return;
    let resolvedSel: { kind: 'brand'; brandId: string } | { kind: 'site'; host: string } | null = null;
    if ((resolved as any).brand_identity_id) {
      resolvedSel = { kind: 'brand', brandId: (resolved as any).brand_identity_id };
    } else if (resolved.product_url) {
      try {
        const host = new URL(resolved.product_url).hostname.replace(/^www\./, '');
        if (host) resolvedSel = { kind: 'site', host };
      } catch {}
    }
    if (resolvedSel) writeSelection(resolvedSel);
  }, [bundle, selection]);

  const latestCompleted = bundle?.audit && bundle.report ? bundle.audit : null;
  useEffect(() => {
    if (!latestCompleted) return;
    const supabase = createBrowserSupabase();

    (async () => {
      try {
        const { data } = await supabase
          .from('audit_findings')
          .select('*')
          .eq('audit_id', latestCompleted.id)
          .order('sort_order', { ascending: true });
        setFindings((data || []) as AuditFinding[]);
      } catch {}
    })();

    (async () => {
      try {
        const { data } = await supabase
          .from('audit_pages')
          .select('id, url, title, status_code, is_mobile_friendly, ai_readability')
          .eq('audit_id', latestCompleted.id);
        setAuditPages((data || []) as AuditPage[]);
      } catch {}
    })();

    const rawJson = (bundle?.report?.raw_json || null) as any;
    if (rawJson?.categoryScores && Array.isArray(rawJson.categoryScores)) {
      setCategoryScores(rawJson.categoryScores);
    }

    const productUrl = latestCompleted.product_url;
    if (productUrl) {
      fetch(`/api/audits/score-trend?url=${encodeURIComponent(productUrl)}`)
        .then(r => r.json())
        .then(d => { if (d.trend) setScoreTrend(d.trend); })
        .catch(() => {});

      fetch(`/api/audits/detect-competitors?url=${encodeURIComponent(productUrl)}`)
        .then(r => r.json())
        .then(d => { if (d.competitors && d.competitors.length > 0) setCompetitors(d.competitors); })
        .catch(() => {});
    }

    // AI X-Ray: pull multi-model probes (Claude / GPT-4o=ChatGPT /
    // Gemini / Perplexity) for the latest audit.
    setModelProbes([]);
    void refreshModelProbes(latestCompleted.id);
  }, [latestCompleted, bundle]);

  const refreshModelProbes = useCallback(async (auditId: string) => {
    try {
      const r = await fetch(`/api/audits/intelligence?audit_id=${auditId}`);
      if (!r.ok) return;
      const d = await r.json();
      const probes = (d?.modelProbes || []) as Array<{ model_id: string; model_label: string; accuracy_score: number; status?: 'measured' | 'skipped' | 'error' | null; error_message?: string | null }>;
      setModelProbes(probes);
    } catch {}
  }, []);

  const handleXRayRefreshed = useCallback(() => {
    if (latestCompleted?.id) void refreshModelProbes(latestCompleted.id);
  }, [latestCompleted, refreshModelProbes]);

  const handleBenchmark = useCallback((mode: 'auto' | 'manual', domains?: string[]) => {
    if (!latestCompleted?.product_url) return;
    setDetectingCompetitors(true);
    fetch('/api/audits/detect-competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: latestCompleted.product_url, mode, competitors: domains }),
    })
      .then(r => r.json())
      .then(d => { if (d.competitors && d.competitors.length > 0) setCompetitors(d.competitors); })
      .catch(() => {})
      .finally(() => setDetectingCompetitors(false));
  }, [latestCompleted]);

  const handleStatCardClick = useCallback((filter: string) => {
    if (!latestCompleted || filter === 'passed') return;
    // Severity tiles route into Fix (the action view) with a severity
    // prefilter. Fix is where triage status lives; Find is discovery
    // and doesn't currently support a severity prefilter via URL.
    router.push(`/dashboard/fix?severity=${filter}`);
  }, [latestCompleted, router]);

  useEffect(() => {
    setShareUrl(null);
    setShareCopied(false);
    setShareEnabled(!!(latestCompleted as any)?.share_enabled);
  }, [latestCompleted]);

  const handleShare = useCallback(async () => {
    if (!latestCompleted) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/audits/${latestCompleted.id}/share`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.share_url) {
        setShareUrl(data.share_url);
        setShareEnabled(true);
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(data.share_url);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2500);
          }
        } catch {}
      }
    } catch {}
    setShareLoading(false);
  }, [latestCompleted]);

  const handleRevokeShare = useCallback(async () => {
    if (!latestCompleted) return;
    if (!confirm('Revoke the share link? Anyone with the link will no longer be able to view this audit.')) return;
    try {
      await fetch(`/api/audits/${latestCompleted.id}/share`, { method: 'DELETE' });
      setShareUrl(null);
      setShareEnabled(false);
    } catch {}
  }, [latestCompleted]);

  // Reload the bundle after a delete from the history card. If the deleted
  // audit was the one currently displayed at the top of Overview, the card
  // itself routes us away — otherwise we just refetch so the row vanishes.
  const handleAuditDeleted = useCallback((deletedAuditId: string) => {
    if (!user) return;
    if (bundle?.audit?.id === deletedAuditId) return;
    loadLatestAuditBundle(user.id, selection).then(setBundle).catch(() => {});
  }, [user, selection, bundle?.audit?.id]);

  // Quick action "Delete this audit" — the destructive option in the
  // header dropdown. Surfaced via a small inline confirmation modal so the
  // user explicitly confirms before the API call.
  const [headerDeleteOpen, setHeaderDeleteOpen] = useState(false);
  const [headerDeleting, setHeaderDeleting] = useState(false);
  const [headerDeleteError, setHeaderDeleteError] = useState<string | null>(null);
  const handleHeaderDeleteConfirm = useCallback(async () => {
    if (!latestCompleted) return;
    setHeaderDeleting(true);
    setHeaderDeleteError(null);
    try {
      const res = await fetch(`/api/audits/${latestCompleted.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Delete failed');
      }
      setHeaderDeleteOpen(false);
      router.push('/dashboard');
    } catch (e: any) {
      setHeaderDeleteError(e?.message || 'Delete failed');
    } finally {
      setHeaderDeleting(false);
    }
  }, [latestCompleted, router]);

  /* ── Loading skeleton ─────────────────────────────────── */
  if (authLoading || loading || !ready) {
    return (
      <div className="w-full">
        <div className="h-8 w-64 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-4 w-40 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-60 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-72 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  /* ── In-progress state ────────────────────────────────
   *
   * An audit exists for the selected brand/site and is still
   * crawling/analysing/generating. We MUST NOT show the no-audit
   * run-audit form here — the user just kicked off this audit and
   * needs to see calm "we're on it" status, not another form.
   *
   * This branch fires when there is no completed audit yet for this
   * selection but there is a non-terminal one. While the user is on
   * this view, a separate effect polls every ~7s for status updates
   * and re-fetches the bundle when the audit reaches a terminal
   * state, so the populated dashboard appears without a manual
   * reload.
   */
  if ((!bundle?.audit || !bundle.report) && bundle?.inProgressAudit) {
    return (
      <InProgressOverview
        audit={bundle.inProgressAudit}
        brandName={brandName}
        selection={selection}
      />
    );
  }

  /* ── Failed state ─────────────────────────────────────
   *
   * No completed audit, no audit currently running — but the most
   * recent attempt failed. Show a clear retry CTA instead of the
   * generic no-audit form so the user understands the previous run
   * did not complete and can act on it.
   */
  if ((!bundle?.audit || !bundle.report) && bundle?.failedAudit) {
    return (
      <FailedAuditOverview
        audit={bundle.failedAudit}
        brandName={brandName}
        selection={selection}
      />
    );
  }

  /* ── Empty state ─────────────────────────────────────── */
  if (!bundle?.audit || !bundle.report) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        {creditsBanner && <CreditsBanner onClose={() => setCreditsBanner(false)} />}
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            Overview
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection
              ? 'No audit for this brand yet. Run one to see your Brand Health Score and what to fix next.'
              : 'Pick a brand or run your first audit to see your Brand Health Score.'}
          </p>
        </div>
        <EmptyAudit
          title={selection ? 'No audit for this brand yet' : 'Run your first audit'}
          body="Enter a website URL and we will show you your Brand Health Score, the top issues hurting it, and a clear next action."
        />
      </div>
    );
  }

  /* ── Derived data ────────────────────────────────────── */
  const audit = bundle.audit as Audit;
  const report = bundle.report as Report;
  const overallScore = report.overall_score ?? 0;
  const auditCount = bundle.history.length;

  let domain: string | null = null;
  try { domain = new URL(audit.product_url || '').hostname.replace(/^www\./, ''); } catch {}

  const displayTitle = selection?.kind === 'brand' && brandName
    ? brandName
    : (domain || 'Latest audit');
  const headerIcon = selection?.kind === 'brand' ? Fingerprint : Globe;
  const HeaderIcon = headerIcon;
  const productUrl = audit.product_url || (domain ? `https://${domain}` : '');

  const openFindings = findings.filter((f) => f.status !== 'fixed' && !f.dismissed);
  const severityCounts = {
    critical: openFindings.filter((f) => f.severity === 'critical').length,
    high: openFindings.filter((f) => f.severity === 'high').length,
    medium: openFindings.filter((f) => f.severity === 'medium').length,
    low: openFindings.filter((f) => f.severity === 'low').length,
  };

  // Pillar/module scores for radar + Brand Health module dots.
  let pillarScores: Array<{ name: string; score: number }>;
  if (categoryScores.length > 0) {
    pillarScores = PILLAR_NAMES.map((name, i) => {
      const [start, end] = PILLAR_RANGES[i];
      const cats = categoryScores.filter((_, idx) => idx >= start && idx < end);
      return {
        name,
        score: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : -1,
      };
    }).filter(p => p.score >= 0);
  } else {
    pillarScores = moduleScoresFromReport(report, findings)
      .filter((m): m is { name: string; score: number } => m.score != null);
  }

  // Findings per pillar (used by Row 2 audit-style category cards).
  const findingsByPillarName: Record<string, AuditFinding[]> = {};
  for (const name of PILLAR_NAMES) findingsByPillarName[name] = [];
  for (const f of openFindings) {
    const catIdx = (f as any).category_index;
    if (typeof catIdx === 'number') {
      const pIdx = PILLAR_RANGES.findIndex(([s, e]) => catIdx >= s && catIdx < e);
      if (pIdx >= 0) findingsByPillarName[PILLAR_NAMES[pIdx]].push(f);
    } else {
      // Heuristic fallback — match keywords to a pillar name's first 1-2 words.
      const text = `${f.title} ${f.description}`.toLowerCase();
      let placed = false;
      for (let i = 0; i < PILLAR_NAMES.length; i++) {
        const words = PILLAR_NAMES[i].toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3);
        if (words.some(w => text.includes(w))) {
          findingsByPillarName[PILLAR_NAMES[i]].push(f);
          placed = true;
          break;
        }
      }
      if (!placed && PILLAR_NAMES.length > 0) findingsByPillarName[PILLAR_NAMES[0]].push(f);
    }
  }

  const hideBenchmarks = (audit as any).audit_type === 'brand_identity' || selection?.kind === 'brand';

  const execSummary = (report.executive_summary || '').trim();

  // AI readability summary (Row 3, AI monitoring card).
  const aiPagesScored = auditPages.filter(p => (p as any).ai_readability?.overallScore != null);
  const avgAi = aiPagesScored.length > 0
    ? Math.round(aiPagesScored.reduce((s, p) => s + ((p as any).ai_readability.overallScore || 0), 0) / aiPagesScored.length)
    : null;
  const aiBuckets = {
    green: aiPagesScored.filter(p => (p as any).ai_readability?.status === 'green' || (p as any).ai_readability?.overallScore >= 70).length,
    amber: aiPagesScored.filter(p => (p as any).ai_readability?.status === 'amber' || ((p as any).ai_readability?.overallScore >= 40 && (p as any).ai_readability?.overallScore < 70)).length,
    red:   aiPagesScored.filter(p => (p as any).ai_readability?.status === 'red'   || (p as any).ai_readability?.overallScore < 40).length,
  };

  return (
    <div className="w-full">
      {creditsBanner && <CreditsBanner onClose={() => setCreditsBanner(false)} />}

      {/* ── Identity header ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <HeaderIcon size={20} className="text-muted flex-shrink-0" />
            <h1 className="text-2xl font-medium font-sans text-text truncate" style={{ color: 'var(--ink)' }}>
              {displayTitle}
            </h1>
            {productUrl && selection?.kind !== 'brand' && (
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand/80 transition-colors"
                aria-label="Open site in new tab"
              >
                <ExternalLink size={11} />
              </a>
            )}
          </div>
          <p className="text-muted text-xs">
            {auditCount} audit{auditCount !== 1 ? 's' : ''}
            {overallScore > 0 && (
              <> · Latest score: <span className={`font-medium ${scoreColor(overallScore)}`}>{overallScore}/100</span></>
            )}
            {audit.completed_at && <> · {formatDate(audit.completed_at)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" ref={menuRef}>
          <a
            href={`/api/reports/${audit.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors"
          >
            <Download size={12} /> Report
          </a>
          <button
            type="button"
            onClick={handleShare}
            disabled={shareLoading}
            className="inline-flex items-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors disabled:opacity-60"
            aria-label={shareEnabled ? 'Copy share link' : 'Create share link'}
          >
            {shareCopied ? (
              <><Check size={12} className="text-ok" /> Copied</>
            ) : (
              <><Share2 size={12} /> Share</>
            )}
          </button>
          <Link
            href={productUrl ? `/dashboard/new-audit?url=${encodeURIComponent(productUrl)}` : '/dashboard/new-audit'}
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <RefreshCw size={13} />
            Re-audit
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg bg-card border border-border text-text hover:bg-surface-alt transition-colors"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-10 z-50 w-60 rounded-xl py-1.5 shadow-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
              >
                <Link
                  href={productUrl ? `/dashboard/new-audit?url=${encodeURIComponent(productUrl)}&depth=deep` : '/dashboard/new-audit?depth=deep'}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-black/[0.04] transition-colors"
                  style={{ color: 'var(--ink)' }}
                >
                  <Search size={13} className="text-m-muted" />
                  Dig deeper (full re-audit)
                </Link>
                <a
                  href={`/api/reports/${audit.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-black/[0.04] transition-colors"
                  style={{ color: 'var(--ink)' }}
                >
                  <Download size={13} className="text-m-muted" />
                  Download report (PDF)
                </a>
                <button
                  type="button"
                  onClick={() => { handleShare(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-black/[0.04] transition-colors text-left"
                  style={{ color: 'var(--ink)' }}
                >
                  <Share2 size={13} className="text-m-muted" />
                  {shareEnabled || shareUrl ? 'Copy share link' : 'Create share link'}
                </button>
                {(shareEnabled || shareUrl) && (
                  <button
                    type="button"
                    onClick={() => { handleRevokeShare(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-red-50 transition-colors text-left"
                    style={{ color: 'var(--severe)' }}
                  >
                    <LinkIcon size={13} />
                    Revoke share link
                  </button>
                )}
                <div className="my-1 h-px" style={{ background: 'var(--rule)' }} />
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setHeaderDeleteError(null); setHeaderDeleteOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-red-50 transition-colors text-left"
                  style={{ color: 'var(--severe)' }}
                >
                  <Trash2 size={13} />
                  Delete this audit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── In-progress re-audit banner (non-blocking) ──── */}
      {bundle.inProgressAudit && (
        <RunningAuditBanner audit={bundle.inProgressAudit} />
      )}

      {/* ── Alert / executive summary slot ───────────────── */}
      <AlertOrSummary
        critical={severityCounts.critical}
        execSummary={execSummary}
        overallScore={overallScore}
        latestAuditId={audit.id}
        completedAt={audit.completed_at || audit.created_at}
      />

      {/* ── Row 1: 3 equal summary cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 auto-rows-fr">
        {/* 1) Brand Health Score + module dots */}
        <DashboardCard
          title="Brand Health Score"
          subtitle="Latest audit"
          rightLabel={audit.completed_at ? formatDate(audit.completed_at) : null}
          icon={Heart}
          titleSize="lg"
        >
          <div className="flex flex-col items-center justify-center">
            <ScoreRing score={overallScore} size={120} strokeWidth={9} />
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--m-muted)' }}>/100</p>
            <span
              className="text-[11px] font-medium mt-1.5 px-3 py-0.5 rounded-full"
              style={{
                color: scoreColorVar(overallScore),
                background: `color-mix(in srgb, ${scoreColorVar(overallScore)} 10%, transparent)`,
              }}
            >
              {overallScore >= 70 ? 'Healthy' : overallScore >= 40 ? 'Needs work' : 'At risk'}
            </span>
          </div>
          {pillarScores.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--rule)' }}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>
                {openFindings.length} findings · {pillarScores.length} module{pillarScores.length !== 1 ? 's' : ''} of {PILLAR_NAMES.length}
              </p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
                {pillarScores.map((p) => {
                  const tint = MODULE_TINTS[PILLAR_NAMES.indexOf(p.name)] || MODULE_TINTS[0];
                  return (
                    <li key={p.name} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--ink)' }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tint.dot }} />
                      <span className="truncate" title={p.name}>{p.name}</span>
                      <span className={`tabular-nums font-semibold ${scoreColor(p.score)}`}>{p.score}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </DashboardCard>

        {/* 2) Score Over Time */}
        <DashboardCard
          title="Score Over Time"
          subtitle={scoreTrend.length >= 2 ? `${scoreTrend.length} audits` : 'Trend appears after next audit'}
          icon={TrendingUp}
          titleSize="lg"
        >
          {scoreTrend.length >= 2 ? (
            <ScoreOverTimeChart trend={scoreTrend} />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingUp size={28} style={{ color: 'var(--m-muted)', opacity: 0.4 }} className="mb-2" />
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Re-audit to track your score over time.</p>
              <Link
                href={productUrl ? `/dashboard/new-audit?url=${encodeURIComponent(productUrl)}` : '/dashboard/new-audit'}
                className="text-[11px] font-medium mt-2 hover:underline"
                style={{ color: 'var(--ink)' }}
              >
                Re-audit (1 credit) →
              </Link>
            </div>
          )}
        </DashboardCard>

        {/* 3) Heuristic Breakdown */}
        <DashboardCard
          title="Heuristic Breakdown"
          subtitle={pillarScores.length >= 3 ? 'Hover a point for the category' : 'Not enough data for radar'}
          icon={Target}
          titleSize="lg"
        >
          {pillarScores.length >= 3 ? (
            <HeuristicRadarChart pillarScores={pillarScores} />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Info size={22} style={{ color: 'var(--m-muted)', opacity: 0.5 }} className="mb-2" />
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                Run a deeper audit to populate the heuristic radar.
              </p>
            </div>
          )}
        </DashboardCard>

      </div>

      {/* ── Row 2: Category module cards — clean by default, expand for breakdown ── */}
      {pillarScores.length > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <ListChecks size={14} style={{ color: 'var(--m-muted)' }} />
          <h2 className="text-[15px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Categories</h2>
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            · {pillarScores.length} module{pillarScores.length === 1 ? '' : 's'} · expand for sub-checkpoints
          </p>
        </div>
      )}
      {pillarScores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          {pillarScores.map((p) => {
            const pillarIdx = PILLAR_NAMES.indexOf(p.name);
            if (pillarIdx < 0) return null;
            const [start, end] = PILLAR_RANGES[pillarIdx];
            const pillarCats = categoryScores.filter((_, idx) => idx >= start && idx < end);
            const tint = MODULE_TINTS[pillarIdx] || MODULE_TINTS[0];
            const PIcon = PILLAR_ICONS[pillarIdx] || Scale;
            const findingCount = findingsByPillarName[p.name]?.length || 0;
            return (
              <CategoryModuleCard
                key={p.name}
                name={p.name}
                score={p.score}
                tint={tint}
                Icon={PIcon}
                findingCount={findingCount}
                breakdown={pillarCats.slice(0, 4).map((cat, relIdx) => ({
                  name: cat.name,
                  score: cat.score,
                  Icon: CATEGORY_ICONS[start + relIdx] || Sparkles,
                }))}
                href={`/dashboard/find?module=${encodeURIComponent(p.name)}`}
              />
            );
          })}
        </div>
      )}

      {/* ── Row 3: Issues · Benchmarks · AI Monitoring · AI X-Ray ─ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4 auto-rows-fr">
        <IssuesByImportance
          severityCounts={severityCounts}
          onCardClick={handleStatCardClick}
        />
        <BenchmarksSummaryCard
          overallScore={overallScore}
          competitors={competitors}
          detecting={detectingCompetitors}
          onBenchmark={handleBenchmark}
          hidden={hideBenchmarks}
        />
        <AiMonitoringCard
          avgAi={avgAi}
          aiBuckets={aiBuckets}
          aiPagesScored={aiPagesScored.length}
          totalPages={auditPages.length}
        />
        <AIXRayCard
          probes={modelProbes}
          auditId={latestCompleted?.id || null}
          onRefreshed={handleXRayRefreshed}
        />
      </div>

      {/* ── Row 4: Checkpoint Health + Audit History ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <CheckpointHealthCard
          categoryScores={categoryScores}
          pillarScores={pillarScores}
          findings={openFindings}
          auditId={audit.id}
        />
        <AuditHistoryCard
          history={bundle.history}
          auditCount={auditCount}
          showAllHistory={showAllHistory}
          onToggleAll={() => setShowAllHistory((v) => !v)}
          currentAuditId={audit.id}
          onDeleted={handleAuditDeleted}
        />
      </div>

      {headerDeleteOpen && (
        <ConfirmDeleteAuditModal
          deleting={headerDeleting}
          error={headerDeleteError}
          onCancel={() => { if (!headerDeleting) { setHeaderDeleteOpen(false); setHeaderDeleteError(null); } }}
          onConfirm={handleHeaderDeleteConfirm}
        />
      )}

    </div>
  );
}

function CreditsBanner({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-5 px-4 py-3 rounded-lg flex items-center gap-3"
      style={{
        background: 'color-mix(in srgb, var(--ok) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--ok) 14%, transparent)',
      }}
    >
      <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
      <p className="text-[13px]" style={{ color: 'var(--ink)' }}>Credits added to your account.</p>
      <button onClick={onClose} className="ml-auto p-1 rounded-md hover:bg-black/5" style={{ color: 'var(--m-muted)' }} aria-label="Dismiss">
        <X size={12} />
      </button>
    </div>
  );
}

/* ── Reusable dashboard card wrapper ─────────────────── */
function DashboardCard({
  title,
  subtitle,
  rightLabel,
  children,
  icon: Icon,
  titleSize = 'lg',
}: {
  title: string;
  subtitle?: string | null;
  rightLabel?: string | null;
  children: React.ReactNode;
  icon?: React.ElementType;
  titleSize?: 'md' | 'lg';
}) {
  const titleCls = titleSize === 'lg'
    ? 'text-[15px] font-semibold leading-tight tracking-[-0.005em]'
    : 'text-[13px] font-semibold leading-tight';
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex items-start gap-2">
          {Icon && (
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
            >
              <Icon size={14} />
            </span>
          )}
          <div className="min-w-0">
            <h3 className={titleCls} style={{ color: 'var(--ink)' }}>{title}</h3>
            {subtitle && (
              <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>{subtitle}</p>
            )}
          </div>
        </div>
        {rightLabel && (
          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{rightLabel}</span>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/* ── Row 1 — AI monitoring card (clean, responsive, layered click-through) ── */
function AiMonitoringCard({
  avgAi,
  aiBuckets,
  aiPagesScored,
  totalPages,
}: {
  avgAi: number | null;
  aiBuckets: { green: number; amber: number; red: number };
  aiPagesScored: number;
  totalPages: number;
}) {
  const hasData = avgAi != null;
  const coverageDenom = totalPages || aiPagesScored;
  const status: { label: string; colorVar: string } = !hasData
    ? { label: 'Awaiting data', colorVar: '--m-muted' }
    : (avgAi as number) >= 70
      ? { label: 'Readable to AI', colorVar: '--ok' }
      : (avgAi as number) >= 40
        ? { label: 'Partial readability', colorVar: '--warn' }
        : { label: 'Hard for AI to read', colorVar: '--severe' };
  const totalBucket = aiBuckets.green + aiBuckets.amber + aiBuckets.red;
  const pct = (n: number) => (totalBucket > 0 ? (n / totalBucket) * 100 : 0);

  return (
    <Link
      href="/dashboard/ai-readability"
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full transition-all hover:shadow-md hover:-translate-y-0.5 group"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-label="Open AI Readability deep-dive"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Brain size={14} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>AI Monitoring</h3>
            <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>
              Can AI crawlers parse and extract from your pages?
            </p>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--m-muted)' }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {hasData ? (
          <>
            <div className="flex items-end gap-3">
              <div className="flex items-baseline gap-1">
                <span className={`text-[36px] font-bold leading-none tabular-nums ${scoreColor(avgAi as number)}`}>
                  {avgAi}
                </span>
                <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full mb-0.5"
                style={{
                  color: `var(${status.colorVar})`,
                  background: `color-mix(in srgb, var(${status.colorVar}) 10%, transparent)`,
                }}
              >
                {status.label}
              </span>
            </div>
            <p className="text-[10px] uppercase font-semibold tracking-[0.06em] mt-1.5" style={{ color: 'var(--m-muted)' }}>
              Avg AI readability
            </p>

            {/* Stacked coverage bar */}
            {totalBucket > 0 && (
              <div className="mt-4">
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden flex"
                  style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                >
                  {aiBuckets.green > 0 && (
                    <span style={{ width: `${pct(aiBuckets.green)}%`, background: 'var(--ok)' }} />
                  )}
                  {aiBuckets.amber > 0 && (
                    <span style={{ width: `${pct(aiBuckets.amber)}%`, background: 'var(--warn)' }} />
                  )}
                  {aiBuckets.red > 0 && (
                    <span style={{ width: `${pct(aiBuckets.red)}%`, background: 'var(--severe)' }} />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                  <span className="flex items-center gap-1" style={{ color: 'var(--ok)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ok)' }} />
                    <span className="tabular-nums font-semibold">{aiBuckets.green}</span> good
                  </span>
                  <span className="flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)' }} />
                    <span className="tabular-nums font-semibold">{aiBuckets.amber}</span> ok
                  </span>
                  <span className="flex items-center gap-1" style={{ color: 'var(--severe)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--severe)' }} />
                    <span className="tabular-nums font-semibold">{aiBuckets.red}</span> poor
                  </span>
                </div>
              </div>
            )}

            <p className="text-[10px] mt-auto pt-3" style={{ color: 'var(--m-muted)' }}>
              Coverage: {aiPagesScored} of {coverageDenom} page{coverageDenom === 1 ? '' : 's'} scored
            </p>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2 py-2">
            <p className="text-[12px]" style={{ color: 'var(--ink)' }}>
              We check what AI crawlers can actually parse and extract from each page — headings, metadata, structured data, and machine-readable signals.
            </p>
            <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
              Run a deeper audit to populate this view.
            </p>
            <span
              className="text-[11px] font-semibold mt-2 inline-flex items-center gap-1 group-hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              Open AI Readability <ChevronRight size={11} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── Row 3 — AI X-Ray card (per-platform: Claude, ChatGPT, Gemini, Perplexity) ──
 *
 * Surfaces multi-model probes from /api/audits/intelligence. Per-provider
 * status, error labels (incl. quota/billing), and the coverage-aware
 * average are computed by the shared helper so this card and the full
 * /dashboard/ai-readability section stay in lock-step.
 */
function AIXRayCard({
  probes,
  auditId,
  onRefreshed,
}: {
  probes: Array<{ model_id: string; model_label: string; accuracy_score: number; status?: 'measured' | 'skipped' | 'error' | null; error_message?: string | null }>;
  auditId: string | null;
  onRefreshed?: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshOk, setRefreshOk] = useState(false);

  const handleRefresh = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!auditId || refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    setRefreshOk(false);
    try {
      const res = await fetch(`/api/audits/${auditId}/rescan-xray`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefreshError(typeof data?.error === 'string' ? data.error : 'Re-scan failed');
      } else {
        setRefreshOk(true);
        onRefreshed?.();
        setTimeout(() => setRefreshOk(false), 2500);
      }
    } catch {
      setRefreshError('Re-scan failed');
    } finally {
      setRefreshing(false);
    }
  }, [auditId, refreshing, onRefreshed]);

  const rows = buildProviderRows(probes);
  const coverage = summarizeCoverage(rows);
  const avg = coverage.average;
  const coverageNote = coverageCaption(coverage);
  const status: { label: string; colorVar: string } = avg == null
    ? { label: 'Awaiting data', colorVar: '--m-muted' }
    : avg >= 70
      ? { label: 'AI knows you', colorVar: '--ok' }
      : avg >= 40
        ? { label: 'Partial visibility', colorVar: '--warn' }
        : { label: 'Invisible to AI', colorVar: '--severe' };

  return (
    <Link
      href="/dashboard/ai-readability#x-ray"
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full transition-all hover:shadow-md hover:-translate-y-0.5 group"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-label="Open AI X-Ray"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Sparkles size={14} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>AI X-Ray</h3>
            <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>
              What Claude, ChatGPT, Gemini &amp; Perplexity currently say about you
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!auditId || refreshing}
            className="p-1 rounded-md transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: 'var(--m-muted)' }}
            aria-label={refreshing ? 'Re-scanning AI X-Ray' : 'Re-scan AI X-Ray'}
            title={
              refreshing
                ? 'Re-scanning…'
                : refreshOk
                  ? 'Re-scan complete'
                  : refreshError
                    ? refreshError
                    : coverage.hasQuotaError
                      ? `Re-scan AI X-Ray. Note: ${coverage.quotaBlockedProviderLabels.join(', ')} will keep failing until provider quota/billing is restored.`
                      : 'Re-scan AI X-Ray (probes models only)'
            }
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <ChevronRight
            size={14}
            className="mt-1 transition-transform group-hover:translate-x-0.5"
            style={{ color: 'var(--m-muted)' }}
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {avg != null ? (
          <div className="flex items-end gap-3">
            <div className="flex items-baseline gap-1">
              <span className={`text-[36px] font-bold leading-none tabular-nums ${scoreColor(avg)}`}>
                {avg}
              </span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full mb-0.5"
              style={{
                color: `var(${status.colorVar})`,
                background: `color-mix(in srgb, var(${status.colorVar}) 10%, transparent)`,
              }}
            >
              {status.label}
            </span>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: 'var(--ink)' }}>
            We ask each AI model what it knows about your brand and score the answer.
          </p>
        )}

        {avg != null && (
          <p className="text-[10px] uppercase font-semibold tracking-[0.06em] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Avg accuracy across {coverage.measuredCount} of {coverage.totalCount} models
          </p>
        )}
        {coverageNote && avg != null && (
          <p className="text-[10px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {coverageNote}
          </p>
        )}

        {/* Per-platform rows */}
        <ul className="mt-4 space-y-1.5">
          {rows.map((r) => {
            const measuredRow = r.score != null;
            const colorVar = !measuredRow
              ? '--m-muted'
              : (r.score as number) >= 70
                ? '--ok'
                : (r.score as number) >= 40
                  ? '--warn'
                  : '--severe';
            const iconKey = providerKeyToIcon(r.key);
            return (
              <li key={r.key} className="flex items-center gap-2 text-[11px]">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md overflow-hidden flex-shrink-0"
                  style={{
                    background: 'var(--paper)',
                    border: '1px solid color-mix(in srgb, var(--rule) 60%, transparent)',
                  }}
                  aria-hidden
                >
                  {iconKey ? <AIProviderIcon provider={iconKey} size={20} /> : null}
                </span>
                <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ink)' }}>
                  {r.label}
                </span>
                {measuredRow ? (
                  <>
                    <span
                      className="h-1.5 rounded-full overflow-hidden flex-shrink-0"
                      style={{ width: 56, background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                    >
                      <span
                        className="block h-full"
                        style={{ width: `${r.score}%`, background: `var(${colorVar})` }}
                      />
                    </span>
                    <span
                      className="tabular-nums font-semibold w-7 text-right"
                      style={{ color: `var(${colorVar})` }}
                    >
                      {r.score}
                    </span>
                  </>
                ) : (
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: r.status === 'error' ? 'var(--severe)' : 'var(--m-muted)',
                    }}
                    title={r.statusTooltip}
                  >
                    {r.statusLabel}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {(refreshing || refreshError || refreshOk) && (
          <p
            className="text-[10px] mt-2"
            style={{ color: refreshError ? 'var(--severe)' : refreshOk ? 'var(--ok)' : 'var(--m-muted)' }}
          >
            {refreshing ? 'Re-scanning model probes…' : refreshError ? refreshError : 'Re-scan complete'}
          </p>
        )}

        {coverage.hasQuotaError && !refreshing && (
          <p className="text-[10px] mt-2" style={{ color: 'var(--warn)' }}>
            {coverage.quotaBlockedProviderLabels.join(', ')} quota exceeded — Re-scan will keep failing until provider billing is restored.
          </p>
        )}

        <span
          className="text-[11px] font-semibold mt-auto pt-3 inline-flex items-center gap-1 group-hover:underline"
          style={{ color: 'var(--ink)' }}
        >
          {avg != null ? 'Open AI X-Ray' : 'Run an audit to populate'} <ChevronRight size={11} />
        </span>
      </div>
    </Link>
  );
}

/* ── Row 3 — Issues by importance: 2×2 grid of soft tinted cards (dot + label, big number, helper, chevron) ── */
function IssuesByImportance({
  severityCounts,
  onCardClick,
}: {
  severityCounts: { critical: number; high: number; medium: number; low: number };
  onCardClick?: (filter: string) => void;
}) {
  const total =
    severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low;
  // Passed checks proxy: when nothing is flagged we still show a positive count tile.
  // We use the open severity counts only; the right-most "Passed" tile mirrors the
  // audit page stat-card layout, using a simple derived value (total of low-impact
  // improvements already handled inline). Here we expose Critical / High / Medium / Low
  // so all four severities have a clear discoverable home in 2×2.
  const tiles: Array<{
    key: string;
    label: string;
    count: number;
    helper: string;
    colorVar: string;
    clickable: boolean;
  }> = [
    { key: 'critical', label: 'Critical', count: severityCounts.critical, helper: 'Needs immediate attention', colorVar: '--severe', clickable: severityCounts.critical > 0 },
    { key: 'high',     label: 'High',     count: severityCounts.high,     helper: 'High impact issues to fix',  colorVar: '--warn',   clickable: severityCounts.high > 0 },
    { key: 'medium',   label: 'Medium',   count: severityCounts.medium,   helper: 'Should improve soon',        colorVar: '--signal', clickable: severityCounts.medium > 0 },
    { key: 'low',      label: 'Low',      count: severityCounts.low,      helper: 'Low impact improvements',    colorVar: '--ok',     clickable: severityCounts.low > 0 },
  ];

  return (
    <DashboardCard
      title="Issues by importance"
      subtitle={total === 0 ? 'No open issues — nice.' : `${total} open issue${total === 1 ? '' : 's'}`}
      icon={AlertTriangle}
      titleSize="lg"
    >
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-6">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
            style={{ background: 'color-mix(in srgb, var(--ok) 10%, transparent)', color: 'var(--ok)' }}
          >
            <CheckCircle2 size={18} />
          </span>
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>All clear at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {tiles.map((t) => {
            const interactive = t.clickable && !!onCardClick;
            const Tag: any = interactive ? 'button' : 'div';
            return (
              <Tag
                key={t.key}
                {...(interactive
                  ? {
                      type: 'button',
                      onClick: () => onCardClick?.(t.key),
                      'aria-label': `${t.count} ${t.label.toLowerCase()} severity issues — open in Fix`,
                    }
                  : {})}
                className={`text-left rounded-xl px-3 py-3 flex flex-col gap-1 transition-all ${
                  interactive ? 'hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group' : 'opacity-90'
                }`}
                style={{
                  background: `color-mix(in srgb, var(${t.colorVar}) 7%, transparent)`,
                  border: `1px solid color-mix(in srgb, var(${t.colorVar}) 20%, transparent)`,
                }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: `var(${t.colorVar})` }}
                  />
                  <span
                    className="text-[11px] font-semibold tracking-tight truncate"
                    style={{ color: `var(${t.colorVar})` }}
                  >
                    {t.label} Issues
                  </span>
                </div>
                <p
                  className="text-[28px] leading-none font-bold tabular-nums mt-0.5"
                  style={{ color: `var(${t.colorVar})` }}
                >
                  {t.count}
                </p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p
                    className="text-[10px] leading-snug truncate"
                    style={{ color: 'var(--m-muted)' }}
                    title={t.helper}
                  >
                    {t.helper}
                  </p>
                  {interactive && (
                    <ChevronRight
                      size={12}
                      className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: `color-mix(in srgb, var(${t.colorVar}) 65%, transparent)` }}
                    />
                  )}
                </div>
              </Tag>
            );
          })}
        </div>
      )}
    </DashboardCard>
  );
}

/* ── Row 3 — Priority recommendations ────────────────── */
/* ── Row 2 — Category module card with collapsible breakdown ── */
function CategoryModuleCard({
  name,
  score,
  tint,
  Icon,
  findingCount,
  breakdown,
  href,
}: {
  name: string;
  score: number;
  tint: { dot: string; bg: string; border: string };
  Icon: React.ElementType;
  findingCount: number;
  breakdown: Array<{ name: string; score: number; Icon: React.ElementType }>;
  href: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: tint.bg, border: `1px solid ${tint.border}` }}
    >
      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${tint.dot}15` }}
        >
          <Icon size={14} style={{ color: tint.dot }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="font-sans font-semibold text-[12.5px] leading-tight truncate"
            style={{ color: 'var(--ink)' }}
            title={name}
          >
            {name}
          </h3>
          <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
            {findingCount} finding{findingCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="px-3 pb-2 flex items-baseline gap-1">
        <span className={`text-[22px] font-bold leading-none tabular-nums ${scoreColor(score)}`}>{score}</span>
        <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>/100</span>
      </div>

      {breakdown.length > 0 && expanded && (
        <div className="px-3 pb-2 pt-2 space-y-1.5" style={{ borderTop: `1px solid ${tint.border}` }}>
          {breakdown.map((cat, i) => {
            const CIcon = cat.Icon;
            return (
              <div key={i} className="flex items-center gap-1.5">
                <CIcon size={10} className="flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
                <span className="flex-1 text-[10px] truncate" style={{ color: 'var(--ink)' }} title={cat.name}>
                  {cat.name}
                </span>
                <span className={`text-[10px] font-semibold tabular-nums flex-shrink-0 ${scoreColor(cat.score)}`}>{cat.score}</span>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="mt-auto px-3 py-1.5 flex items-center justify-between gap-1 text-[10px] font-medium"
        style={{ borderTop: `1px solid ${tint.border}`, color: tint.dot }}
      >
        <Link href={href} className="inline-flex items-center gap-1 hover:gap-1.5 transition-all">
          <span>View findings</span>
          <ArrowRight size={10} />
        </Link>
        {breakdown.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-0.5 hover:opacity-80 transition-opacity"
            aria-expanded={expanded}
            aria-label={expanded ? `Hide ${name} breakdown` : `Show ${name} breakdown`}
          >
            <span>{expanded ? 'Hide' : 'Breakdown'}</span>
            <ChevronDown
              size={10}
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Row 4 — Audit history card ───────────────────────── */
function AuditHistoryCard({
  history,
  auditCount,
  showAllHistory,
  onToggleAll,
  currentAuditId,
  onDeleted,
}: {
  history: LatestAuditBundle['history'];
  auditCount: number;
  showAllHistory: boolean;
  onToggleAll: () => void;
  currentAuditId: string;
  onDeleted: (deletedAuditId: string) => void;
}) {
  const router = useRouter();
  const PREVIEW = 8;
  const showingAll = showAllHistory || auditCount <= PREVIEW;
  const rows = showingAll ? history : history.slice(0, PREVIEW);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/audits/${pendingDeleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Delete failed');
      }
      const deletedId = pendingDeleteId;
      setPendingDeleteId(null);
      onDeleted(deletedId);
      // If the user just deleted the audit currently displayed on Overview,
      // bounce them to the dashboard root so we don't render stale state.
      if (deletedId === currentAuditId) {
        router.push('/dashboard');
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setDeleteError(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, onDeleted, currentAuditId, router]);

  return (
    <section
      className="rounded-xl flex flex-col overflow-hidden h-full"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-labelledby="audit-history-heading"
    >
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Clock size={14} />
          </span>
          <div className="min-w-0">
            <h2
              id="audit-history-heading"
              className="text-[15px] font-semibold leading-tight tracking-[-0.005em]"
              style={{ color: 'var(--ink)' }}
            >
              Audit history
            </h2>
            <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>
              {showingAll
                ? `${auditCount} total audit${auditCount === 1 ? '' : 's'}`
                : `Latest ${Math.min(PREVIEW, auditCount)} of ${auditCount}`}
            </p>
          </div>
        </div>
        {auditCount > PREVIEW && (
          <button
            type="button"
            onClick={onToggleAll}
            className="text-[11px] font-medium hover:underline"
            style={{ color: 'var(--ink)' }}
            aria-expanded={showingAll}
          >
            {showingAll ? 'Show less' : 'View all'}
          </button>
        )}
      </div>

      <div className="max-h-[520px] overflow-y-auto divide-y" style={{ borderColor: 'var(--rule)' }}>
        {rows.map((h) => {
          const a = h.audit;
          const r = h.report;
          const meta = statusMeta[a.status] || statusMeta.pending_payment;
          const Icon = meta.icon;
          const done = a.status === 'completed';
          const aLang = langCode((a as any).language);
          return (
            <div
              key={a.id}
              className="flex items-center hover:bg-black/[0.02] transition-colors group/row"
            >
              <Link
                href={`/dashboard/audits/${a.id}`}
                className="flex-1 min-w-0 px-4 py-2.5 flex items-center gap-3"
              >
                <div className="flex items-center gap-2 text-[11px] flex-1 min-w-0 flex-wrap">
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>
                    {formatDate(a.completed_at || a.created_at)}
                  </span>
                  <span style={{ color: 'var(--rule)' }}>·</span>
                  <span className="flex items-center gap-0.5" style={{ color: 'var(--m-muted)' }}>
                    <Icon size={10} />
                    {meta.label}
                  </span>
                  <span style={{ color: 'var(--rule)' }}>·</span>
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--m-muted)', background: 'var(--paper-2)' }}
                  >
                    {aLang}
                  </span>
                  {done && r?.overall_score != null && (
                    <>
                      <span style={{ color: 'var(--rule)' }}>·</span>
                      <span className={`font-medium ${scoreColor(r.overall_score)}`}>{r.overall_score} pts</span>
                    </>
                  )}
                  {(a as any).depth_mode === 'deep' && (
                    <span className="text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      Deep
                    </span>
                  )}
                </div>
                <ChevronRight
                  size={12}
                  className="group-hover/row:text-brand transition-colors flex-shrink-0"
                  style={{ color: 'var(--m-muted)', opacity: 0.5 }}
                />
              </Link>
              <button
                type="button"
                onClick={() => { setDeleteError(null); setPendingDeleteId(a.id); }}
                title="Delete this audit"
                aria-label={`Delete audit from ${formatDate(a.completed_at || a.created_at)}`}
                className="flex-shrink-0 mr-3 ml-1 w-7 h-7 rounded-md inline-flex items-center justify-center transition-colors hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 opacity-60 hover:opacity-100"
                style={{ color: 'var(--m-muted)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {pendingDeleteId && (
        <ConfirmDeleteAuditModal
          deleting={deleting}
          error={deleteError}
          onCancel={() => { if (!deleting) { setPendingDeleteId(null); setDeleteError(null); } }}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
}

/* ── Reusable confirm delete modal ────────────────────── */
function ConfirmDeleteAuditModal({
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleting) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, deleting]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-audit-heading"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(20,19,15,0.45)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) onCancel(); }}
    >
      <div
        className="w-full max-w-sm rounded-xl shadow-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <span
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--severe) 10%, transparent)', color: 'var(--severe)' }}
            >
              <Trash2 size={16} />
            </span>
            <div className="min-w-0">
              <h3 id="delete-audit-heading" className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                Delete this audit?
              </h3>
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
                This permanently removes the audit, its report, findings, and crawled pages. This cannot be undone.
              </p>
            </div>
          </div>
          {error && (
            <p className="text-[12px] mt-3 px-3 py-2 rounded-md" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 8%, transparent)' }}>
              {error}
            </p>
          )}
        </div>
        <div className="px-5 pb-5 pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="text-[12px] font-medium px-3 py-2 rounded-lg hover:bg-black/[0.04] transition-colors disabled:opacity-50"
            style={{ color: 'var(--ink)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="text-[12px] font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-1.5"
            style={{ background: 'var(--severe)', color: '#ffffff' }}
          >
            <Trash2 size={12} />
            {deleting ? 'Deleting…' : 'Delete audit'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Row 4 — Checkpoint Health: full list with expandable rows ── */
function CheckpointHealthCard({
  categoryScores,
  pillarScores,
  findings,
  auditId,
}: {
  categoryScores: Array<{ name: string; score: number; summary: string }>;
  pillarScores: Array<{ name: string; score: number }>;
  findings: AuditFinding[];
  auditId: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Map findings to categories (explicit category_index first, keyword fallback).
  const findingsByCategory: Record<string, AuditFinding[]> = useMemo(() => {
    const out: Record<string, AuditFinding[]> = {};
    for (const c of categoryScores) out[c.name] = [];
    if (categoryScores.length === 0) return out;

    for (const f of findings) {
      const idx = (f as any).category_index;
      if (typeof idx === 'number' && idx >= 0 && idx < categoryScores.length) {
        out[categoryScores[idx].name].push(f);
        continue;
      }
      // keyword fallback
      let matched = false;
      const text = `${f.title} ${f.description}`.toLowerCase();
      for (const c of categoryScores) {
        const words = c.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3);
        if (words.some(w => text.includes(w))) {
          out[c.name].push(f);
          matched = true;
          break;
        }
      }
      if (!matched && categoryScores.length > 0) out[categoryScores[0].name].push(f);
    }
    return out;
  }, [categoryScores, findings]);

  const totalCategories = categoryScores.length || pillarScores.length;
  const totalIssues = findings.filter(f => !f.dismissed).length;

  return (
    <div
      className="rounded-xl flex flex-col overflow-hidden h-full"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <ListChecks size={14} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Checkpoint health</h3>
            {totalCategories > 0 && (
              <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>
                {totalCategories * 4} checkpoints across {totalCategories} categories
              </p>
            )}
          </div>
        </div>
        {totalIssues > 0 && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.05em]" style={{ color: 'var(--m-muted)' }}>
            {totalIssues} issues
          </span>
        )}
      </div>

      {categoryScores.length === 0 && pillarScores.length === 0 ? (
        <div className="px-5 py-8 flex flex-col items-center justify-center text-center">
          <ListChecks size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} className="mb-2" />
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            Checkpoint data will appear after the next audit.
          </p>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-y-auto divide-y" style={{ borderColor: 'var(--rule)' }}>
          {(categoryScores.length > 0 ? categoryScores : pillarScores.map(p => ({ name: p.name, score: p.score, summary: '' }))).map((cat) => {
            const checkpoints = CHECKPOINT_LABELS[cat.name] || ['Check 1', 'Check 2', 'Check 3', 'Check 4'];
            const catFindings = findingsByCategory[cat.name] || [];
            const failCount = Math.min(catFindings.length, checkpoints.length);
            const passCount = checkpoints.length - failCount;
            const isOpen = expanded === cat.name;
            return (
              <div key={cat.name}>
                <button
                  onClick={() => setExpanded(isOpen ? null : cat.name)}
                  className="w-full px-4 sm:px-5 py-2.5 flex items-center gap-3 text-left hover:bg-black/[0.02] transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className={`text-[12px] font-semibold tabular-nums w-7 text-right ${scoreColor(cat.score)}`}>{Math.round(cat.score)}</span>
                  <span className="text-[12px] font-medium flex-1 min-w-0 truncate" style={{ color: 'var(--ink)' }}>{cat.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {passCount > 0 && (
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>{passCount} pass</span>
                    )}
                    {failCount > 0 && (
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--severe)' }}>{failCount} fail</span>
                    )}
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      style={{ color: 'var(--m-muted)' }}
                    />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 sm:px-5 pb-3 pt-1 space-y-1.5">
                    {checkpoints.map((checkpoint, i) => {
                      const hasFinding = i < failCount;
                      const finding = hasFinding ? catFindings[i] : null;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 py-1.5 px-3 rounded-lg"
                          style={{
                            background: hasFinding
                              ? 'color-mix(in srgb, var(--severe) 5%, transparent)'
                              : 'color-mix(in srgb, var(--ok) 5%, transparent)',
                          }}
                        >
                          {hasFinding ? (
                            <AlertTriangle size={11} style={{ color: 'var(--severe)' }} className="flex-shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle2 size={11} style={{ color: 'var(--ok)' }} className="flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-[11px] font-medium"
                              style={{ color: hasFinding ? 'var(--severe)' : 'var(--ok)' }}
                            >
                              {checkpoint}
                            </p>
                            {finding && (
                              <Link
                                href={`/dashboard/fix#finding-${finding.id}`}
                                className="text-[11px] mt-0.5 line-clamp-1 hover:underline"
                                style={{ color: 'var(--m-muted)' }}
                              >
                                {finding.title}
                              </Link>
                            )}
                          </div>
                          <span
                            className="text-[11px] font-semibold flex-shrink-0"
                            style={{ color: hasFinding ? 'var(--severe)' : 'var(--ok)' }}
                          >
                            {hasFinding ? 'Fail' : 'Pass'}
                          </span>
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
    </div>
  );
}

/* ── Row 3 — Benchmarks summary card (layered: clean summary → deep-dive on click) ── */
function BenchmarksSummaryCard({
  overallScore,
  competitors,
  detecting,
  onBenchmark,
  hidden,
}: {
  overallScore: number;
  competitors: Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>;
  detecting: boolean;
  onBenchmark: (mode: 'auto' | 'manual', domains?: string[]) => void;
  hidden: boolean;
}) {
  if (hidden) {
    return (
      <DashboardCard
        title="Benchmarks"
        subtitle="Not available for brand audits"
        icon={LineChart}
        titleSize="lg"
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <LineChart size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} className="mb-2" />
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            Benchmarks compare a live site against competitors. Run a site audit to enable.
          </p>
        </div>
      </DashboardCard>
    );
  }

  const top = competitors.slice(0, 5);
  const hasCompetitors = top.length > 0;
  const compScores = top.map(c => c.score);
  const avgCompetitor = compScores.length > 0
    ? Math.round(compScores.reduce((s, n) => s + n, 0) / compScores.length)
    : null;
  const delta = avgCompetitor != null ? overallScore - avgCompetitor : null;
  const status: { label: string; colorVar: string } = !hasCompetitors
    ? { label: 'Awaiting data', colorVar: '--m-muted' }
    : delta == null
      ? { label: 'Tracking', colorVar: '--m-muted' }
      : delta >= 5
        ? { label: 'Ahead of peers', colorVar: '--ok' }
        : delta <= -5
          ? { label: 'Behind peers', colorVar: '--severe' }
          : { label: 'On par', colorVar: '--warn' };

  return (
    <Link
      href="/dashboard/intelligence"
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full transition-all hover:shadow-md hover:-translate-y-0.5 group"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-label="Open competitive benchmarks"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <LineChart size={14} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Benchmarks</h3>
            <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>
              {hasCompetitors
                ? `vs. ${top.length} competitor${top.length === 1 ? '' : 's'}`
                : 'Compare against competitors'}
            </p>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: 'var(--m-muted)' }}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col">
        {detecting ? (
          <div className="flex flex-col items-center justify-center text-center py-4 flex-1">
            <Sparkles size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} className="mb-2 animate-pulse" />
            <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Analysing competitors…</p>
          </div>
        ) : hasCompetitors ? (
          <>
            <div className="flex items-end gap-3">
              <div className="flex items-baseline gap-1">
                <span className={`text-[36px] font-bold leading-none tabular-nums ${scoreColor(overallScore)}`}>
                  {overallScore}
                </span>
                <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
              </div>
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full mb-0.5"
                style={{
                  color: `var(${status.colorVar})`,
                  background: `color-mix(in srgb, var(${status.colorVar}) 10%, transparent)`,
                }}
              >
                {status.label}
                {delta != null && delta !== 0 && (
                  <> · {delta > 0 ? '+' : ''}{delta}</>
                )}
              </span>
            </div>
            <p className="text-[10px] uppercase font-semibold tracking-[0.06em] mt-1.5" style={{ color: 'var(--m-muted)' }}>
              Your score
            </p>

            {/* Compact competitor rows */}
            <ul className="mt-4 space-y-1.5">
              {top.map((c) => {
                const cDelta = overallScore - c.score;
                return (
                  <li key={c.domain} className="flex items-center gap-2 text-[11px]">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: 'var(--m-muted)', opacity: 0.5 }}
                    />
                    <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--ink)' }} title={c.domain}>
                      {c.domain}
                    </span>
                    <span className={`tabular-nums font-semibold ${scoreColor(c.score)}`}>{c.score}</span>
                    <span
                      className="tabular-nums text-[10px] w-9 text-right"
                      style={{
                        color: cDelta > 0 ? 'var(--ok)' : cDelta < 0 ? 'var(--severe)' : 'var(--m-muted)',
                      }}
                    >
                      {cDelta > 0 ? `+${cDelta}` : cDelta}
                    </span>
                  </li>
                );
              })}
            </ul>

            <span
              className="text-[11px] font-semibold mt-auto pt-3 inline-flex items-center gap-1 group-hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              Open benchmarks <ChevronRight size={11} />
            </span>
          </>
        ) : (
          <div className="flex flex-col items-start gap-2 py-2">
            <p className="text-[12px]" style={{ color: 'var(--ink)' }}>
              No competitors configured yet.
            </p>
            <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
              Add up to 5 competitor domains, or auto-detect suggestions. You stay in control.
            </p>
            <span
              className="text-[11px] font-semibold mt-1 inline-flex items-center gap-1 group-hover:underline"
              style={{ color: 'var(--ink)' }}
            >
              Configure benchmarks <ChevronRight size={11} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── Top alert / executive summary slot ──────────────── */
function AlertOrSummary({
  critical,
  execSummary,
  overallScore,
  latestAuditId,
  completedAt,
}: {
  critical: number;
  execSummary: string;
  overallScore: number;
  latestAuditId: string;
  completedAt: string;
}) {
  if (critical > 0) {
    return (
      <div
        role="alert"
        className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3"
        style={{
          background: 'color-mix(in srgb, var(--severe) 7%, transparent)',
          border: '1px solid color-mix(in srgb, var(--severe) 22%, transparent)',
        }}
      >
        <AlertTriangle size={16} style={{ color: 'var(--severe)' }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--severe)' }}>
            {critical} critical issue{critical === 1 ? '' : 's'} need attention
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
            These have the biggest negative impact on your Brand Health Score. Triage them first.
          </p>
        </div>
        <Link
          href={`/dashboard/fix?severity=critical`}
          className="flex-shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--severe)', color: '#fff' }}
        >
          Triage now <ChevronRight size={12} />
        </Link>
      </div>
    );
  }

  if (execSummary) {
    return (
      <div
        className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <Info size={16} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--m-muted)' }}>
            Executive summary · {formatDate(completedAt)}
          </p>
          <p className="text-[13px] leading-relaxed mt-1 line-clamp-3" style={{ color: 'var(--ink)' }}>
            {execSummary}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-3"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <Info size={14} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0" />
      <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
        Latest audit completed {formatDate(completedAt)} ·{' '}
        <span className="font-semibold" style={{ color: 'var(--ink)' }}>{overallScore}/100</span> Brand Health Score
      </p>
    </div>
  );
}

/* ── Running audit banner (shown above populated dashboard) ──
 *
 * When a completed audit already exists and a new audit is currently
 * running for the same selection (e.g. user clicked Re-audit), show
 * a calm non-blocking banner. The populated dashboard still renders
 * underneath; the parent component polls and re-fetches the bundle
 * when the running audit terminates so the user sees fresh data
 * without reloading.
 */
function RunningAuditBanner({ audit }: { audit: Audit }) {
  const meta = statusMeta[audit.status] || statusMeta.payment_received;
  const StatusIcon = meta.icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 px-4 py-2.5 rounded-xl flex items-center gap-3"
      style={{
        background: 'color-mix(in srgb, var(--signal) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)',
      }}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--signal) 14%, transparent)', color: 'var(--signal)' }}
      >
        <StatusIcon size={13} className="animate-pulse" />
      </span>
      <p className="text-[12px] flex-1 min-w-0" style={{ color: 'var(--ink)' }}>
        <span className="font-semibold">New audit running</span>
        <span className="mx-1.5" style={{ color: 'var(--rule)' }}>·</span>
        <span style={{ color: 'var(--m-muted)' }}>{meta.label}. We will refresh this page when it is ready.</span>
      </p>
      <Link
        href={`/dashboard/audits/${audit.id}`}
        className="flex-shrink-0 inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
        style={{ color: 'var(--ink)' }}
      >
        View progress <ChevronRight size={11} />
      </Link>
    </div>
  );
}

/* ── In-progress overview ─────────────────────────────────
 *
 * Shown when the selected brand/site has an audit currently
 * crawling / analysing / generating but no completed audit yet.
 * This replaces the no-audit run-audit form for that state — the
 * user just kicked the audit off, so we need calm "we're on it"
 * status with skeleton cards in the populated-dashboard shape, not
 * another form. The parent component polls the audit row every ~7s
 * and re-fetches the bundle as soon as the audit terminates, so
 * this view auto-flips to the populated dashboard (or the failed
 * state) without a manual reload.
 */
function InProgressOverview({
  audit,
  brandName,
  selection,
}: {
  audit: Audit;
  brandName: string | null;
  selection: ReturnType<typeof useBrandSelection>['selection'];
}) {
  let domain: string | null = null;
  try { domain = new URL(audit.product_url || '').hostname.replace(/^www\./, ''); } catch {}
  const displayTitle = selection?.kind === 'brand' && brandName
    ? brandName
    : (domain || 'Your website');
  const HeaderIcon = selection?.kind === 'brand' ? Fingerprint : Globe;
  const meta = statusMeta[audit.status] || statusMeta.payment_received;
  const StatusIcon = meta.icon;

  return (
    <div className="w-full">
      {/* Identity header — mirrors populated overview header but
          without the action buttons that depend on a completed
          audit (Report, Share, Re-audit, More). */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <HeaderIcon size={20} className="text-muted flex-shrink-0" />
            <h1 className="text-2xl font-medium font-sans text-text truncate" style={{ color: 'var(--ink)' }}>
              {displayTitle}
            </h1>
          </div>
          <p className="text-muted text-xs">Auditing your website</p>
        </div>
      </div>

      {/* Status banner */}
      <div
        role="status"
        aria-live="polite"
        className="mb-4 px-4 py-3 rounded-xl flex items-start gap-3"
        style={{
          background: 'color-mix(in srgb, var(--signal) 7%, transparent)',
          border: '1px solid color-mix(in srgb, var(--signal) 22%, transparent)',
        }}
      >
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--signal) 14%, transparent)', color: 'var(--signal)' }}
        >
          <StatusIcon size={16} className="animate-pulse" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {meta.label}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
            We are working on your audit. This page will update automatically when it is ready — usually a few minutes.
          </p>
        </div>
        <Link
          href={`/dashboard/audits/${audit.id}`}
          className="flex-shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface-alt transition-colors"
        >
          View progress <ChevronRight size={12} />
        </Link>
      </div>

      {/* Skeleton row 1 — mirrors Brand Health, Score Over Time, Heuristic Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 auto-rows-fr">
        <SkeletonCard title="Brand Health Score" subtitle="Calculating…" icon={Heart} />
        <SkeletonCard title="Score Over Time" subtitle="Trend will appear after this audit" icon={TrendingUp} />
        <SkeletonCard title="Heuristic Breakdown" subtitle="Radar populates when the audit completes" icon={Target} />
      </div>

      {/* Skeleton row 2 — mirrors Categories grid */}
      <div className="mb-2 flex items-center gap-2">
        <ListChecks size={14} style={{ color: 'var(--m-muted)' }} />
        <h2 className="text-[15px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Categories</h2>
        <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>· populating</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {PILLAR_NAMES.map((name, i) => {
          const tint = MODULE_TINTS[i] || MODULE_TINTS[0];
          const PIcon = PILLAR_ICONS[i] || Scale;
          return (
            <div
              key={name}
              className="rounded-xl overflow-hidden flex flex-col"
              style={{ background: tint.bg, border: `1px solid ${tint.border}` }}
            >
              <div className="flex items-start gap-2 px-3 pt-3 pb-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${tint.dot}15` }}
                >
                  <PIcon size={14} style={{ color: tint.dot }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-sans font-semibold text-[12.5px] leading-tight truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {name}
                  </h3>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    Auditing…
                  </p>
                </div>
              </div>
              <div className="px-3 pb-3 pt-1">
                <div
                  className="h-5 w-12 rounded-md animate-pulse"
                  style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Skeleton row 3 — mirrors Issues / Benchmarks / AI Monitoring / AI X-Ray */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4 auto-rows-fr">
        <SkeletonCard title="Issues by importance" subtitle="Findings will appear here" icon={AlertTriangle} />
        <SkeletonCard title="Benchmarks" subtitle="Competitor comparison" icon={LineChart} />
        <SkeletonCard title="AI Monitoring" subtitle="AI readability across pages" icon={Brain} />
        <SkeletonCard title="AI X-Ray" subtitle="What AI models say about you" icon={Sparkles} />
      </div>
    </div>
  );
}

/* ── Skeleton card used by InProgressOverview ────────── */
function SkeletonCard({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-hidden
    >
      <div className="flex items-start gap-2 mb-3">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
        >
          <Icon size={14} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>{title}</h3>
          <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>{subtitle}</p>
        </div>
      </div>
      <div className="flex-1 min-h-[120px] flex flex-col gap-2 justify-center">
        <div
          className="h-4 w-3/4 rounded animate-pulse"
          style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
        />
        <div
          className="h-4 w-1/2 rounded animate-pulse"
          style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
        />
        <div
          className="h-4 w-2/3 rounded animate-pulse"
          style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
        />
      </div>
    </div>
  );
}

/* ── Failed audit overview ────────────────────────────
 *
 * Shown when no completed audit exists for the selected brand/site
 * and the most recent attempt for this selection failed. Surfaces a
 * clear retry CTA instead of the generic no-audit form — the user
 * needs to understand the previous run did not complete.
 */
function FailedAuditOverview({
  audit,
  brandName,
  selection,
}: {
  audit: Audit;
  brandName: string | null;
  selection: ReturnType<typeof useBrandSelection>['selection'];
}) {
  let domain: string | null = null;
  try { domain = new URL(audit.product_url || '').hostname.replace(/^www\./, ''); } catch {}
  const displayTitle = selection?.kind === 'brand' && brandName
    ? brandName
    : (domain || 'Your website');
  const HeaderIcon = selection?.kind === 'brand' ? Fingerprint : Globe;
  const productUrl = audit.product_url || (domain ? `https://${domain}` : '');
  const retryHref = productUrl
    ? `/dashboard/new-audit?url=${encodeURIComponent(productUrl)}`
    : '/dashboard/new-audit';

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <HeaderIcon size={20} className="text-muted flex-shrink-0" />
            <h1 className="text-2xl font-medium font-sans text-text truncate" style={{ color: 'var(--ink)' }}>
              {displayTitle}
            </h1>
          </div>
          <p className="text-muted text-xs">Last audit did not complete</p>
        </div>
      </div>

      <div
        role="alert"
        className="rounded-xl p-6 flex flex-col items-start gap-4"
        style={{
          background: 'color-mix(in srgb, var(--severe) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--severe) 22%, transparent)',
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--severe) 12%, transparent)', color: 'var(--severe)' }}
          >
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 className="text-[18px] font-sans font-semibold" style={{ color: 'var(--ink)' }}>
              The last audit failed
            </h2>
            <p className="text-[13px] mt-1.5 max-w-[520px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
              We were not able to finish auditing {domain ? <span className="font-medium" style={{ color: 'var(--ink)' }}>{domain}</span> : 'your website'}.
              You can retry the audit, or open the previous run to see the error details.
            </p>
            {audit.crawl_error && (
              <p
                className="text-[11px] mt-2 px-2.5 py-1.5 rounded-md font-mono"
                style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }}
              >
                {audit.crawl_error.slice(0, 200)}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={retryHref}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-lg"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <RefreshCw size={13} />
            Retry audit
          </Link>
          <Link
            href={`/dashboard/audits/${audit.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg bg-card border border-border text-text hover:bg-surface-alt transition-colors"
          >
            View details <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full">
          <div className="h-8 w-64 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
          <div className="h-4 w-40 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-60 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />
            ))}
          </div>
        </div>
      }
    >
      <OverviewInner />
    </Suspense>
  );
}
