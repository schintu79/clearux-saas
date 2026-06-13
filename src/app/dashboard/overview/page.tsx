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
  Radio,
  MessageSquare,
  Scale,
  WifiOff,
  Loader2,
  Keyboard,
  FileText,
  Code2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
// AI provider imports removed — merged into BrandIntelligenceCard
import {
  ScoreOverTimeChart,
  HeuristicRadarChart,
} from '@/components/dashboard/AuditDashboard';
import ScoreCircle from '@/components/ui/ScoreCircle';
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints';
import {
  moduleScoresFromReport,
  isInProgressAuditStatus,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { healthLabel, type HealthContext } from '@/lib/audit-findings-presentation';
import { applySeverityCap, composeModuleScores } from '@/lib/scoring/severity-cap';
import { moduleIndexFor } from '@/lib/scoring/module-map';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuditProgress } from '@/hooks/useAuditProgress';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import WebsiteSpeedCard from '@/components/dashboard/v2/WebsiteSpeedCard';
import BrandIntelligenceCard from '@/components/dashboard/v2/BrandIntelligenceCard';
import type { BrandIntelligenceSummary } from '@/lib/audit-engine/brand-intelligence';
import type { Audit, Report, AuditFinding, SpeedDataSummary, Workspace } from '@/types/database';
import SiteFavicon from '@/components/ui/SiteFavicon';


/* ── Pillar / module config (mirrors audit detail page) ─── */
const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Accessibility Readiness', 'Design Consistency'];
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24], [24, 28]];
const PILLAR_ICONS: React.ElementType[] = [Scale, Heart, Accessibility, Brain, FileSearch, ShieldCheck, Eye];

/** Category icons in 28-index order — matches analyzer.ts. */
const CATEGORY_ICONS: React.ElementType[] = [
  Eye, Target, MapIcon, Type,
  MousePointerClick, Shield, AlertTriangle, Heart,
  Accessibility, Brain, Sparkles, Smartphone,
  Gauge, Search, Zap, Globe,
  FileSearch, LinkIcon, Share2, Scale,
  Eye, Keyboard, FileText, Code2,
  Eye, MessageSquare, Target, CheckCircle2,
];

/** Module tints — same palette as the audit page so colors don't drift. */
const MODULE_TINTS = [
  { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.04)', border: 'rgba(59, 130, 246, 0.12)' },  // Foundation — blue
  { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.04)', border: 'rgba(236, 72, 153, 0.12)' },  // Human Experience — pink
  { dot: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.04)', border: 'rgba(139, 92, 246, 0.12)' },  // Inclusive Design — violet
  { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.04)', border: 'rgba(245, 158, 11, 0.12)' },  // Future Readiness — amber
  { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.04)', border: 'rgba(16, 185, 129, 0.12)' },  // SEO — emerald
  { dot: '#14B8A6', bg: 'rgba(20, 184, 166, 0.04)', border: 'rgba(20, 184, 166, 0.12)' },  // Accessibility Readiness — teal
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
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';

  const { bundle, loading: bundleLoading, invalidate } = useAuditBundle();
  const [creditsBanner, setCreditsBanner] = useState(false);

  const [scoreTrend, setScoreTrend] = useState<Array<{ auditId: string; date: string; overallScore: number; pillarScores?: (number | null)[] | null }>>([]);
  const [competitors, setCompetitors] = useState<Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>>([]);
  const [categoryScores, setCategoryScores] = useState<Array<{ name: string; score: number; summary: string }>>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [auditPages, setAuditPages] = useState<AuditPage[]>([]);
  const [brandName, setBrandName] = useState<string | null>(null);
  const [modelProbes, setModelProbes] = useState<Array<{ model_id: string; model_label: string; accuracy_score: number; status?: 'measured' | 'skipped' | 'error' | null; error_message?: string | null }>>([]);
  const [brandIntelligence, setBrandIntelligence] = useState<BrandIntelligenceSummary | null>(null);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Force-refresh bundle when overview mounts (navigation from new-audit,
  // audit detail, or any other page). Without this, a re-audit of the same
  // brand/site doesn't trigger a context refetch because the selection
  // reference hasn't changed — the user sees stale data until they manually
  // refresh the page.
  const mountInvalidatedRef = useRef(false);
  useEffect(() => {
    if (!user || wsLoading) return;
    if (mountInvalidatedRef.current) return;
    mountInvalidatedRef.current = true;
    invalidate();
  }, [user, wsLoading, invalidate]);

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
    window.history.replaceState({}, '', `${dashPrefix}/overview`);
    const t = setTimeout(() => setCreditsBanner(false), 6000);
    fetch('/api/stripe/verify-credits', { method: 'POST' }).catch(() => {});
    return () => clearTimeout(t);
  }, [searchParams]);

  // Handle URL params on arrival: force-set brand/site selection from
  // ?site= or ?brand= (new-audit redirect), and strip one-shot params
  // (?payment, ?audit from Stripe redirect). Merged into a single
  // effect so replaceState only fires once and searchParams changes
  // are handled atomically.
  const paramsHandledRef = useRef(false);
  useEffect(() => {
    // Only process URL params once per mount — after replaceState
    // clears them, searchParams updates and re-fires this effect.
    // The guard prevents the second (empty) run from being a no-op
    // that still costs a render cycle.
    const siteParam = searchParams.get('site');
    const brandParam = searchParams.get('brand');
    const paymentParam = searchParams.get('payment');
    const auditParam = searchParams.get('audit');
    const hasActionableParams = siteParam || brandParam || paymentParam || auditParam;
    if (!hasActionableParams) { paramsHandledRef.current = false; return; }
    if (paramsHandledRef.current) return;
    paramsHandledRef.current = true;

    // Workspace context is URL-driven — no selection persistence needed.
    // Clear URL params to avoid re-processing on next render.
    window.history.replaceState({}, '', window.location.pathname);
  }, [searchParams]);

  // Reset ALL derived data when workspace changes so no stale data
  // from the previous site is ever visible. The bundle itself is managed
  // by AuditBundleContext (which now clears to null on workspace change).
  useEffect(() => {
    setScoreTrend([]);
    setCompetitors([]);
    setCategoryScores([]);
    setFindings([]);
    setAuditPages([]);
    setBrandIntelligence(null);
    setModelProbes([]);
    setBrandName(null);
    setShareUrl(null);
    setShareEnabled(false);
  }, [workspace]);

  /* ── In-progress audit tracking ──
   *
   * AuditBundleContext already polls every 3s while a non-terminal
   * audit exists, so we don't need a separate polling loop here.
   * We just track the inProgressAuditId for the progress banner
   * and use the useAuditProgress hook for real-time stage data.
   */
  const inProgressAuditId = bundle?.inProgressAudit?.id || null;
  const { data: reauditProgress } = useAuditProgress(inProgressAuditId, { enabled: !!inProgressAuditId });

  useEffect(() => {
    if (!user || !workspace?.active_brand_identity_id) {
      setBrandName(null);
      return;
    }
    const supabase = createBrowserSupabase();
    (async () => {
      try {
        const { data } = await supabase
          .from('brand_identities')
          .select('name')
          .eq('id', workspace.active_brand_identity_id!)
          .is('deleted_at', null)
          .maybeSingle();
        setBrandName((data as any)?.name || null);
      } catch {}
    })();
  }, [user, workspace]);

  // No defensive sync needed — workspace identity is URL-driven.

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
      // Sanitize stale Design Consistency data: if ALL four sub-categories
      // (indices 24-27) have scores between 0 and 5, the module wasn't
      // properly analyzed (predates the -1 sentinel fix). Mark as -1 so
      // downstream consumers skip it correctly.
      const scores = [...rawJson.categoryScores];
      const dcCats = scores.slice(24, 28);
      if (dcCats.length === 4 && dcCats.every((c: any) => c.score >= 0 && c.score <= 5)) {
        for (let i = 24; i < 28; i++) {
          scores[i] = { ...scores[i], score: -1 };
        }
      }
      setCategoryScores(scores);
    }

    // Load brand intelligence from report
    const biData = (bundle?.report as any)?.brand_intelligence;
    setBrandIntelligence(biData ? (biData as BrandIntelligenceSummary) : null);

    const productUrl = latestCompleted.product_url;
    if (productUrl) {
      const trendParams = new URLSearchParams({ url: productUrl });
      if (workspace?.id) trendParams.set('workspace_id', workspace.id);
      fetch(`/api/audits/score-trend?${trendParams}`)
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

  // ── Late-enrichment catch-up for brand intelligence ──
  // Brand intelligence is written to the report row AFTER the audit status
  // transitions to 'completed' (Wave 2 enrichment). If the bundle was
  // fetched before enrichment finished, brand_intelligence will be null.
  // Detect this and fetch directly from the intelligence API with retries.
  const biRetryRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (biRetryRef.current) { clearTimeout(biRetryRef.current); biRetryRef.current = null; }
    if (!latestCompleted?.id) return;
    const reportBI = (bundle?.report as any)?.brand_intelligence;
    if (reportBI) return; // Already have it — nothing to do

    const auditStatus = (latestCompleted as any)?.status;
    if (auditStatus !== 'completed' && auditStatus !== 'completed_with_warnings') return;

    // Completed audit with missing brand_intelligence — fetch with retries
    let attempt = 0;
    const maxAttempts = 3;
    const delays = [5000, 10000, 20000]; // 5s, 10s, 20s

    const tryFetch = async () => {
      try {
        const r = await fetch(`/api/audits/intelligence?audit_id=${latestCompleted.id}`);
        if (!r.ok) return false;
        const d = await r.json();
        if (d?.brandIntelligence) {
          setBrandIntelligence(d.brandIntelligence as BrandIntelligenceSummary);
          return true;
        }
      } catch {}
      return false;
    };

    const scheduleRetry = () => {
      if (attempt >= maxAttempts) return;
      biRetryRef.current = setTimeout(async () => {
        const success = await tryFetch();
        if (!success) {
          attempt++;
          scheduleRetry();
        }
      }, delays[attempt] || 20000);
    };

    scheduleRetry();

    return () => {
      if (biRetryRef.current) { clearTimeout(biRetryRef.current); biRetryRef.current = null; }
    };
  }, [latestCompleted, bundle?.report]);

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


  const handleStatCardClick = useCallback((filter: string) => {
    if (!latestCompleted || filter === 'passed') return;
    // Severity tiles route into Fix (the action view) with a severity
    // prefilter. Fix is where triage status lives; Find is discovery
    // and doesn't currently support a severity prefilter via URL.
    router.push(`${dashPrefix}/fix?severity=${filter}`);
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
  const handleAuditDeleted = useCallback((_deletedAuditId: string) => {
    // Always invalidate — the bundle context will re-fetch and return the next
    // available audit, or null (triggering the "Start a new Audit" empty state).
    invalidate();
  }, [invalidate]);

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
      // Stay in the same site context — invalidate re-fetches the next available
      // audit (or returns null for the "Start a new Audit" empty state).
      invalidate();
    } catch (e: any) {
      setHeaderDeleteError(e?.message || 'Delete failed');
    } finally {
      setHeaderDeleting(false);
    }
  }, [latestCompleted, invalidate]);

  /* ── Loading skeleton ─────────────────────────────────── */
  // Show skeleton only during the very first load (no bundle yet) or
  // before auth/workspace have hydrated. Once a bundle has been loaded
  // at least once (even if a background refetch is in progress), skip
  // the skeleton so the user sees real content. This prevents a stall
  // where invalidate() bumps the fetch counter, causing the primary
  // load's .finally() to never set loading=false.
  if (authLoading || wsLoading || (bundleLoading && !bundle)) {
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
        workspace={workspace}
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
        workspace={workspace}
      />
    );
  }

  /* ── Empty state ─────────────────────────────────────── */
  if (!bundle?.audit || !bundle.report) {
    return (
      <div className="w-full">

        {creditsBanner && <CreditsBanner onClose={() => setCreditsBanner(false)} />}
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            Overview
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {workspace
              ? 'No audit for this brand yet. Run one to see your Website Health Score and what to fix next.'
              : 'Pick a brand or run your first audit to see your Website Health Score.'}
          </p>
        </div>
        <EmptyAudit
          title={workspace ? 'No audit for this brand yet' : 'Run your first audit'}
          body="Enter a website URL and we will show you your Website Health Score, the top issues hurting it, and a clear next action."
        />
      </div>
    );
  }

  /* ── Derived data ────────────────────────────────────── */
  const audit = bundle.audit as Audit;
  const report = bundle.report as Report;
  const auditCount = bundle.history.length;

  let domain: string | null = null;
  try { domain = new URL(audit.product_url || '').hostname.replace(/^www\./, ''); } catch {}

  const displayTitle = !workspace?.primary_domain && brandName
    ? brandName
    : (domain || 'Latest audit');
  const isBrand = !workspace?.primary_domain;
  const productUrl = audit.product_url || (domain ? `https://${domain}` : '');

  const openFindings = findings.filter((f) => f.status !== 'fixed' && !f.dismissed && (f as any).verification_status !== 'verified_fixed');
  // Exclude strategic findings from severity counts — the Fix page filters
  // them out, so the alert banner count must match what the user sees after
  // clicking "Triage now".
  const fixableOpen = openFindings.filter((f) => (f as any).finding_type !== 'strategic');
  const severityCounts = {
    critical: fixableOpen.filter((f) => f.severity === 'critical').length,
    high: fixableOpen.filter((f) => f.severity === 'high').length,
    medium: fixableOpen.filter((f) => f.severity === 'medium').length,
    low: fixableOpen.filter((f) => f.severity === 'low').length,
  };

  // Pillar/module scores for radar + Brand Health module dots.
  // SCORE INTEGRITY: derive overallScore from the SAME category data
  // that produces module scores — never read report.overall_score separately.
  let pillarScores: Array<{ name: string; score: number }>;
  let overallScore: number;
  if (categoryScores.length > 0) {
    // Primary path: compute from raw_json.categoryScores
    const analyzedCats = categoryScores.filter((c) => c.score >= 0);
    overallScore = analyzedCats.length > 0
      ? Math.round(analyzedCats.reduce((s, c) => s + c.score, 0) / analyzedCats.length)
      : (report.overall_score ?? 0);
    pillarScores = PILLAR_NAMES.map((name, i) => {
      const [start, end] = PILLAR_RANGES[i];
      const cats = categoryScores.filter((c, idx) => idx >= start && idx < end && c.score >= 0);
      return {
        name,
        score: cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : -1,
      };
    }).filter(p => p.score >= 0);
  } else {
    // Fallback: use findings-based scoring (same formula as analyzer)
    const pagesAnalyzed = (audit as any)?.crawl_summary?.pages_analyzed ?? 0;
    const moduleResults = moduleScoresFromReport(report, findings, pagesAnalyzed);
    pillarScores = moduleResults
      .filter((m): m is { name: string; score: number } => m.score != null);
    // Derive overall from the module scores — never read report.overall_score
    // independently, because report.overall_score was computed with a potentially
    // different set of findings (pre-fix/dismiss) and a different formula.
    overallScore = pillarScores.length > 0
      ? Math.round(pillarScores.reduce((s, p) => s + p.score, 0) / pillarScores.length)
      : (report.overall_score ?? 0);
  }

  // ── Score model v2: severity cap (2026-06-10) ──────────────────────
  // The live recompute above keeps the score in sync with fixes/dismissals,
  // but it MUST apply the same severity cap as the engine — without this
  // the overview showed an uncapped 87 while the report stored the capped
  // 65 for the same audit. Cap counts only OPEN findings, so fixing the
  // high-severity issues lifts the cap in real time.
  const uncappedOverallScore = overallScore; // shown struck-through so the cap math is visible
  const { overall: cappedOverallScore, capInfo: scoreCapInfo } = applySeverityCap(overallScore, openFindings);
  overallScore = cappedOverallScore;

  // Findings per pillar (used by Row 2 audit-style category cards).
  const findingsByPillarName: Record<string, AuditFinding[]> = {};
  for (const name of PILLAR_NAMES) findingsByPillarName[name] = [];
  // 2026-06-12: shared categorizer (module-map.ts) — this inline loop had
  // its own keyword fallback while Find & Fix mapped strictly by index, so
  // the cards counted findings the Find page never showed.
  for (const f of openFindings) {
    const pIdx = moduleIndexFor((f as any).category_index, f.title, f.description);
    if (pIdx >= 0 && pIdx < PILLAR_NAMES.length) findingsByPillarName[PILLAR_NAMES[pIdx]].push(f);
  }

  // ── Score model v2: per-module severity caps (2026-06-11) ──────────
  // Module scores were raw category math, so a module carrying open
  // high-severity findings could read 80-96 right next to a capped
  // overall of 65 — contradictory reporting. Each module is now capped
  // by ITS OWN open findings using the same thresholds as the overall.
  // Categories cards, radar, and module dots all read pillarScores, so
  // they stay mutually consistent. Fixing a module's issues lifts its
  // cap live, same as the overall.
  // ── Shared display chain (2026-06-11): per-module caps + composition ──
  // composeModuleScores in @/lib/scoring/severity-cap is THE single source —
  // the Find page uses the identical call, so the two surfaces cannot
  // disagree on a module's number again (Find showed 81 vs Overview 48).
  const rawPillarScore: Record<string, number> = Object.fromEntries(pillarScores.map((p) => [p.name, p.score]));
  const composedModules = composeModuleScores(pillarScores, findingsByPillarName, overallScore, scoreCapInfo.applied);
  const pillarCapInfo: Record<string, import('@/lib/scoring/severity-cap').ScoreCapInfo> = {};
  for (const m of composedModules) pillarCapInfo[m.name] = m.capInfo;
  pillarScores = composedModules.map(({ name, score }) => ({ name, score }));

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

      {/* ── Re-audit progress banner ──
        * When a new audit is running for the same brand/site while a
        * completed audit already exists, show a compact progress banner
        * so the user knows we're working. Without this, re-audits look
        * completely stalled because the old completed data stays visible.
        */}
      {inProgressAuditId && bundle?.audit && bundle?.report && (() => {
        const ipAudit = bundle.inProgressAudit!;
        const meta = statusMeta[(ipAudit as any).status] || statusMeta.payment_received;
        const StatusIcon = meta.icon;
        const stagesCompleted = reauditProgress?.stages
          ? Object.values(reauditProgress.stages).filter(Boolean).length
          : 0;
        const totalStages = 8;
        const pct = reauditProgress?.progress || Math.round((stagesCompleted / totalStages) * 100);
        return (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{
              background: 'color-mix(in srgb, var(--signal) 7%, transparent)',
              border: '1px solid color-mix(in srgb, var(--signal) 22%, transparent)',
            }}
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--signal) 14%, transparent)', color: 'var(--signal)' }}
            >
              <StatusIcon size={14} className="animate-pulse" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                New audit in progress
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                {reauditProgress
                  ? `${stagesCompleted} of ${totalStages} stages complete · ${pct}%`
                  : 'Working on it — this page will update automatically when done.'}
              </p>
            </div>
            {/* Compact progress bar */}
            <div className="w-24 h-1 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--signal) 15%, transparent)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: 'var(--signal)' }}
              />
            </div>
            <Link
              href={`${dashPrefix}/audits/${ipAudit.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex-shrink-0 transition-colors hover:bg-surface-alt"
              style={{ borderColor: 'var(--rule)', color: 'var(--ink)' }}
            >
              View <ChevronRight size={10} />
            </Link>
          </div>
        );
      })()}

      {/* ── Identity header ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            {isBrand
              ? <Fingerprint size={20} className="text-muted flex-shrink-0" />
              : <SiteFavicon hostname={domain || ''} size={18} className="text-muted flex-shrink-0" />}
            <h1 className="text-2xl font-medium font-sans text-text truncate" style={{ color: 'var(--ink)' }}>
              {displayTitle}
            </h1>
            {productUrl && workspace?.primary_domain && (
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
            href={productUrl ? `${dashPrefix}/new-audit?mode=dig-deeper&url=${encodeURIComponent(productUrl)}&depth=deep` : `${dashPrefix}/new-audit?mode=dig-deeper&depth=deep`}
            className="inline-flex items-center gap-1.5 bg-card border border-border text-text text-xs font-medium px-3 py-2 rounded-lg hover:bg-surface-alt transition-colors"
          >
            <Search size={12} /> Dig deeper
          </Link>
          <Link
            href={productUrl ? `${dashPrefix}/new-audit?mode=re-audit&url=${encodeURIComponent(productUrl)}` : `${dashPrefix}/new-audit?mode=re-audit`}
            className="inline-flex items-center gap-1.5 bg-brand text-surface text-xs font-medium px-3.5 py-2 rounded-lg transition-all hover:brightness-110"
          >
            <RefreshCw size={13} />
            Re-run Website Audit
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

      {/* ── Executive summary + re-audit results (one card) ──
           The re-audit reconciliation row is now rendered INSIDE the
           executive-summary card (AlertOrSummary's reAuditFooter slot)
           below a divider, so the two read as a single block. Pure layout —
           same data sources (report executive_summary + reconciliationSummary). */}
      {(() => {
        const rawJson = (bundle?.report?.raw_json || null) as any;
        const recon = rawJson?.reconciliationSummary;
        let reAuditFooter: React.ReactNode = null;
        if (recon) {
          const { verifiedFixed, regressed, newFindings, stillOpen, notReverified } = recon;
          const prevScore = scoreTrend.length >= 2 ? scoreTrend[scoreTrend.length - 2]?.overallScore : null;
          const scoreDelta = prevScore != null ? overallScore - prevScore : null;
          reAuditFooter = (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
              <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: 'var(--ink)' }}>
                <RefreshCw size={13} style={{ color: 'var(--signal)' }} /> Re-audit results
              </span>
              {verifiedFixed > 0 && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-ok" />
                  <span style={{ color: 'var(--ink)' }}>{verifiedFixed} fixed</span>
                </span>
              )}
              {stillOpen > 0 && (
                <span className="inline-flex items-center gap-1" style={{ color: 'var(--m-muted)' }}>
                  {stillOpen} still open
                </span>
              )}
              {newFindings > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Zap size={11} style={{ color: 'var(--signal)' }} />
                  <span style={{ color: 'var(--ink)' }}>{newFindings} new</span>
                </span>
              )}
              {regressed > 0 && (
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle size={11} className="text-severe" />
                  <span style={{ color: 'var(--ink)' }}>{regressed} regressed</span>
                </span>
              )}
              {notReverified > 0 && (
                <span className="inline-flex items-center gap-1" style={{ color: 'var(--m-muted)' }}>
                  {notReverified} not re-checked
                </span>
              )}
              {scoreDelta != null && (
                <span className={`font-semibold tabular-nums ${scoreDelta > 0 ? 'text-ok' : scoreDelta < 0 ? 'text-severe' : ''}`} style={scoreDelta === 0 ? { color: 'var(--m-muted)' } : undefined}>
                  {scoreDelta > 0 ? '+' : ''}{scoreDelta} score change
                </span>
              )}
              <Link
                href={productUrl ? `${dashPrefix}/new-audit?url=${encodeURIComponent(productUrl)}` : `${dashPrefix}/new-audit`}
                className="ml-auto inline-flex items-center gap-1 font-medium hover:underline"
                style={{ color: 'var(--signal)' }}
              >
                <RefreshCw size={12} /> Re-run to track progress
              </Link>
            </div>
          );
        }
        return (
          <AlertOrSummary
            critical={severityCounts.critical}
            execSummary={execSummary}
            overallScore={overallScore}
            latestAuditId={audit.id}
            completedAt={audit.completed_at || audit.created_at}
            totalFindings={openFindings.length}
            healthCtx={{
              pagesAnalyzed: (audit as any)?.crawl_summary?.pages_analyzed ?? 0,
              findings: openFindings.map(f => ({ severity: f.severity, confidence_level: (f as any).confidence_level, category_index: f.category_index })),
              categoryScores: categoryScores.map(c => ({ score_state: (c as any).score_state })),
            }}
            reAuditFooter={reAuditFooter}
          />
        );
      })()}

      {/* ── Row 1: 3 equal summary cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 auto-rows-fr">
        {/* 1) Website Health Score + module dots */}
        <DashboardCard
          title="Website Health Score"
          subtitle="Latest audit"
          rightLabel={audit.completed_at ? formatDate(audit.completed_at) : null}
          icon={Heart}
          titleSize="lg"
        >
          <div className="flex flex-col items-center justify-center">
            <ScoreCircle score={overallScore} size="big" />
            <p className="text-[12px] mt-2" style={{ color: 'var(--m-muted)' }}>/100</p>
            <span
              className="text-[11px] font-medium mt-1.5 px-3 py-0.5 rounded-full"
              style={{
                color: scoreColorVar(overallScore),
                background: `color-mix(in srgb, ${scoreColorVar(overallScore)} 10%, transparent)`,
              }}
            >
              {healthLabel(overallScore, openFindings.length, {
                pagesAnalyzed: (audit as any)?.crawl_summary?.pages_analyzed ?? 0,
                findings: openFindings.map(f => ({ severity: f.severity, confidence_level: (f as any).confidence_level, category_index: f.category_index })),
                categoryScores: categoryScores.map(c => ({ score_state: (c as any).score_state })),
              }).label}
            </span>
            {scoreCapInfo.applied && (
              <p className="text-[11px] mt-2 text-center leading-snug max-w-[260px]" style={{ color: 'var(--warn)' }}>
                Your checks average <s>{uncappedOverallScore}</s> — capped at {overallScore} by {scoreCapInfo.reason}. Fixing them unlocks your full score.
              </p>
            )}
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
        {(() => {
          // pts badge: latest overall vs the previous audit (▲/▼ N pts).
          const ptsDelta = scoreTrend.length >= 2
            ? (scoreTrend[scoreTrend.length - 1]?.overallScore ?? 0) - (scoreTrend[scoreTrend.length - 2]?.overallScore ?? 0)
            : null;
          const ptsBadge = ptsDelta != null ? (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums px-2 py-1 rounded-full ${ptsDelta > 0 ? 'text-ok' : ptsDelta < 0 ? 'text-severe' : ''}`}
              style={{
                background: ptsDelta > 0
                  ? 'color-mix(in srgb, var(--ok) 12%, transparent)'
                  : ptsDelta < 0
                    ? 'color-mix(in srgb, var(--severe) 12%, transparent)'
                    : 'color-mix(in srgb, var(--ink) 7%, transparent)',
                color: ptsDelta === 0 ? 'var(--m-muted)' : undefined,
              }}
            >
              {ptsDelta > 0 ? '▲' : ptsDelta < 0 ? '▼' : '—'} {Math.abs(ptsDelta)} pts
            </span>
          ) : null;
          return (
        <DashboardCard
          title="Score Over Time"
          subtitle={scoreTrend.length >= 2 ? `${scoreTrend.length} audits` : 'Trend appears after next audit'}
          icon={TrendingUp}
          titleSize="lg"
          rightBadge={ptsBadge}
        >
          {scoreTrend.length >= 2 ? (
            <div className="h-full flex flex-col justify-end">
              <ScoreOverTimeChart trend={scoreTrend} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingUp size={28} style={{ color: 'var(--m-muted)', opacity: 0.4 }} className="mb-2" />
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Re-audit to track your score over time.</p>
              <Link
                href={productUrl ? `${dashPrefix}/new-audit?url=${encodeURIComponent(productUrl)}` : `${dashPrefix}/new-audit`}
                className="text-[11px] font-medium mt-2 hover:underline"
                style={{ color: 'var(--ink)' }}
              >
                Re-audit (1 credit) →
              </Link>
            </div>
          )}
        </DashboardCard>
          );
        })()}

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
          {scoreCapInfo.applied && (
            <p className="text-[11px]" style={{ color: 'var(--warn)' }}>
              · Each module is scored on its own checks and capped by its own open issues. Your overall {overallScore}/100 is a separate verdict driven by your most severe issues ({scoreCapInfo.reason}) — it is not an average of the modules.
            </p>
          )}
        </div>
      )}
      {pillarScores.length > 0 && (() => {
        // Per-module trend delta vs the previous audit (raw category-quality
        // movement). latest = last trend entry, prev = the one before — same
        // computation both sides (score-trend API), so deltas are like-for-
        // like. Shown only when a real previous score exists (never a
        // fabricated ±0 on first audit / newly-added module).
        const latestPillars = scoreTrend.length >= 2 ? scoreTrend[scoreTrend.length - 1]?.pillarScores : null;
        const prevPillars = scoreTrend.length >= 2 ? scoreTrend[scoreTrend.length - 2]?.pillarScores : null;
        return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
          {pillarScores.map((p) => {
            const pillarIdx = PILLAR_NAMES.indexOf(p.name);
            if (pillarIdx < 0) return null;
            const [start, end] = PILLAR_RANGES[pillarIdx];
            const pillarCats = categoryScores.filter((c, idx) => idx >= start && idx < end && c.score >= 0);
            const tint = MODULE_TINTS[pillarIdx] || MODULE_TINTS[0];
            const PIcon = PILLAR_ICONS[pillarIdx] || Scale;
            const findingCount = findingsByPillarName[p.name]?.length || 0;
            const cur = latestPillars?.[pillarIdx];
            const prv = prevPillars?.[pillarIdx];
            const trendDelta = (typeof cur === 'number' && typeof prv === 'number') ? cur - prv : null;
            return (
              <CategoryModuleCard
                key={p.name}
                name={p.name}
                score={p.score}
                tint={tint}
                Icon={PIcon}
                findingCount={findingCount}
                capReason={pillarCapInfo[p.name]?.applied ? pillarCapInfo[p.name].reason : null}
                rawScore={rawPillarScore[p.name] ?? null}
                trendDelta={trendDelta}
                breakdown={pillarCats.slice(0, 4).map((cat, relIdx) => ({
                  name: cat.name,
                  score: cat.score,
                  Icon: CATEGORY_ICONS[start + relIdx] || Sparkles,
                }))}
                href={`${dashPrefix}/find?module=${encodeURIComponent(p.name)}`}
                expanded={breakdownOpen}
                onToggle={() => setBreakdownOpen((v) => !v)}
              />
            );
          })}

          {/* Design Consistency is always included — no "not included" fallback needed */}
        </div>
        );
      })()}

      {/* ── Row 3: Issues · Speed · Brand Intelligence (unified) ─ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 auto-rows-fr">
        <IssuesByImportance
          severityCounts={severityCounts}
          onCardClick={handleStatCardClick}
        />
        <WebsiteSpeedCard
          speedData={(latestCompleted as any)?.speed_data ?? null}
          auditId={latestCompleted?.id ?? null}
          onViewIssues={() => {
            router.push(`${dashPrefix}/speed`);
          }}
          onTestComplete={(newData) => {
            // Force a re-render by refreshing the bundle
            if (bundle?.audit) (bundle.audit as any).speed_data = newData;
          }}
        />
        <BrandIntelligenceCard
          data={brandIntelligence}
          legacyScore={overallScore}
          legacyCompetitorCount={competitors.length}
          hasProbeData={modelProbes.length > 0}
          auditId={latestCompleted?.id ?? null}
          avgAiReadability={avgAi}
          aiPagesBuckets={aiBuckets}
          aiPagesScored={aiPagesScored.length}
          totalPages={auditPages.length}
          probes={modelProbes}
          onXRayRefreshed={handleXRayRefreshed}
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
  rightBadge,
  children,
  icon: Icon,
  titleSize = 'lg',
}: {
  title: string;
  subtitle?: string | null;
  rightLabel?: string | null;
  /** Styled top-right element (e.g. the score-trend pts badge). Takes precedence over rightLabel. */
  rightBadge?: React.ReactNode;
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
        {rightBadge ? (
          <div className="flex-shrink-0">{rightBadge}</div>
        ) : rightLabel ? (
          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{rightLabel}</span>
        ) : null}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/* ── AIReadabilityCard removed — merged into BrandIntelligenceCard ── */

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
    { key: 'low',      label: 'Low',      count: severityCounts.low,      helper: 'Minor improvements',         colorVar: '--ok',     clickable: severityCounts.low > 0 },
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
          <p className="text-[11px] font-medium" style={{ color: 'var(--ok)' }}>No issues found across all audited categories.</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>Your site scored well — keep monitoring with regular audits.</p>
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
  capReason = null,
  rawScore = null,
  trendDelta = null,
  breakdown,
  href,
  expanded,
  onToggle,
}: {
  name: string;
  score: number;
  tint: { dot: string; bg: string; border: string };
  Icon: React.ElementType;
  findingCount: number;
  /** Set when the module score is capped by its own open findings */
  capReason?: string | null;
  /** Uncapped module score — struck through beside the capped one so the math is visible */
  rawScore?: number | null;
  /** Raw category-quality movement vs the previous audit (null = no prior score) */
  trendDelta?: number | null;
  breakdown: Array<{ name: string; score: number; Icon: React.ElementType }>;
  href: string;
  expanded: boolean;
  onToggle: () => void;
}) {
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

      <div className="px-3 pb-2">
        <div className="flex items-baseline gap-2">
          {capReason && rawScore != null && rawScore > score && (
            <s className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--m-muted)' }}>{rawScore}</s>
          )}
          <span className={`text-[28px] font-bold tabular-nums leading-none ${scoreColor(score)}`}>{score}</span>
          {trendDelta != null && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${trendDelta > 0 ? 'text-ok' : trendDelta < 0 ? 'text-severe' : ''}`}
              style={trendDelta === 0 ? { color: 'var(--m-muted)' } : undefined}
              title="Change in category quality vs your previous audit"
            >
              {trendDelta > 0 ? '▲' : trendDelta < 0 ? '▼' : '—'}{trendDelta !== 0 ? Math.abs(trendDelta) : ''}
            </span>
          )}
        </div>
        {capReason && (
          <p className="text-[9.5px] leading-tight mt-1.5 font-medium px-1.5 py-0.5 rounded inline-block" style={{ color: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 9%, transparent)' }}>
            Held down by {capReason}
          </p>
        )}
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
            onClick={onToggle}
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
  const { workspaceSlug: _ws } = useWorkspace();
  const _dp = _ws ? `/dashboard/${_ws}` : '/dashboard';
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
      // Whether deleting the current audit or an older one, call onDeleted
      // which triggers invalidate() to re-fetch — the context stays on the same
      // site and shows either the next audit or the empty state.
      onDeleted(deletedId);
    } catch (e: any) {
      setDeleteError(e?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [pendingDeleteId, onDeleted, currentAuditId]);

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
                href={`${_dp}/audits/${a.id}`}
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
                  {a.id === currentAuditId && (
                    <span className="text-[10px] font-semibold text-signal bg-signal/10 px-1.5 py-0.5 rounded-full uppercase tracking-[0.03em]">
                      Current
                    </span>
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
  const { workspaceSlug: _ws } = useWorkspace();
  const _dp = _ws ? `/dashboard/${_ws}` : '/dashboard';
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
          {(categoryScores.length > 0 ? categoryScores.filter(c => c.score >= 0) : pillarScores.map(p => ({ name: p.name, score: p.score, summary: '' }))).map((cat) => {
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
                                href={`${_dp}/fix#finding-${finding.id}`}
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

/* ── Top alert / executive summary slot ──────────────── */
function AlertOrSummary({
  critical,
  execSummary,
  overallScore,
  latestAuditId,
  completedAt,
  totalFindings = 0,
  healthCtx,
  reAuditFooter = null,
}: {
  critical: number;
  execSummary: string;
  overallScore: number;
  latestAuditId: string;
  completedAt: string;
  totalFindings?: number;
  healthCtx?: HealthContext;
  /** Re-audit results row — rendered inside this same card, below a divider,
   *  so the executive summary and re-audit deltas read as one block (UI only). */
  reAuditFooter?: React.ReactNode;
}) {
  const { workspaceSlug: _ws } = useWorkspace();
  const _dp = _ws ? `/dashboard/${_ws}` : '/dashboard';
  // Shared divider+footer slot appended inside every state's card.
  const Footer = reAuditFooter
    ? <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--rule)' }}>{reAuditFooter}</div>
    : null;

  // Clean audit — no findings at all → success banner (gated by 4 conditions)
  if (totalFindings === 0 && overallScore >= 90) {
    const { label, tier } = healthLabel(overallScore, 0, healthCtx);
    const isExcellent = tier === 'excellent';
    return (
      <div
        className="mb-4 rounded-xl"
        style={{
          background: `color-mix(in srgb, var(--ok) ${isExcellent ? '7' : '5'}%, transparent)`,
          border: `1px solid color-mix(in srgb, var(--ok) ${isExcellent ? '22' : '15'}%, transparent)`,
        }}
      >
        <div className="px-4 py-3 flex items-start gap-3">
          <CheckCircle2 size={16} style={{ color: 'var(--ok)' }} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ok)' }}>
              {isExcellent ? 'Excellent — no issues found' : 'Healthy — no issues found'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
              {isExcellent
                ? `Your site scored ${overallScore}/100 with zero findings across all audited categories. Keep monitoring with regular audits.`
                : `Your site scored ${overallScore}/100 with zero findings. Coverage or confidence may be limited — a deeper audit could reveal more.`}
            </p>
          </div>
        </div>
        {Footer}
      </div>
    );
  }

  if (critical > 0) {
    return (
      <div
        role="alert"
        className="mb-4 rounded-xl"
        style={{
          background: 'color-mix(in srgb, var(--severe) 7%, transparent)',
          border: '1px solid color-mix(in srgb, var(--severe) 22%, transparent)',
        }}
      >
        <div className="px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} style={{ color: 'var(--severe)' }} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--severe)' }}>
              {critical} critical issue{critical === 1 ? '' : 's'} need attention
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
              These have the biggest negative impact on your Website Health Score. Triage them first.
            </p>
          </div>
          <Link
            href={`${_dp}/fix?severity=critical`}
            className="flex-shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--severe)', color: '#fff' }}
          >
            Triage now <ChevronRight size={12} />
          </Link>
        </div>
        {Footer}
      </div>
    );
  }

  if (execSummary) {
    return (
      <div
        className="mb-4 rounded-xl"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="px-4 py-3 flex items-start gap-3">
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
        {Footer}
      </div>
    );
  }

  return (
    <div
      className="mb-4 rounded-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="px-4 py-2.5 flex items-center gap-3">
        <Info size={14} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0" />
        <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
          Latest audit completed {formatDate(completedAt)} ·{' '}
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>{overallScore}/100</span> Website Health Score
        </p>
      </div>
      {Footer}
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
  const { workspaceSlug: _ws } = useWorkspace();
  const _dp = _ws ? `/dashboard/${_ws}` : '/dashboard';
  const { data: progress } = useAuditProgress(audit.id, { interval: 3000 });
  const liveStatus = progress?.status || audit.status;
  const meta = statusMeta[liveStatus] || statusMeta.payment_received;
  const StatusIcon = meta.icon;
  const pct = progress?.progress ?? 0;
  const stagesCompleted = progress?.stages
    ? Object.values(progress.stages).filter(Boolean).length
    : 0;
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
      <div className="flex-1 min-w-0">
        <p className="text-[12px]" style={{ color: 'var(--ink)' }}>
          <span className="font-semibold">New audit running</span>
          <span className="mx-1.5" style={{ color: 'var(--rule)' }}>·</span>
          <span style={{ color: 'var(--m-muted)' }}>
            {progress
              ? `${stagesCompleted} of 8 stages — ${pct}% complete`
              : `${meta.label}. We will refresh this page when it is ready.`}
          </span>
        </p>
        {progress && pct > 0 && (
          <div className="mt-1.5 h-[2px] w-full rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--signal) 15%, transparent)' }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, background: 'var(--signal)' }}
            />
          </div>
        )}
      </div>
      <Link
        href={`${_dp}/audits/${audit.id}`}
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
 * Progressive loading: as each pipeline stage completes, the
 * corresponding card transitions from skeleton → populated with
 * a fade/slide reveal animation. Uses useAuditProgress for stage
 * detection and fetches partial data to populate cards live.
 */

interface PartialAuditData {
  speedData: any | null
  overallScore: number | null
  moduleScores: Record<string, number> | null
  totalIssues: number
  findingsCount: number
  severityBreakdown: { critical: number; major: number; moderate: number; minor: number }
  pagesCrawled: number
  stage: string | null
}

function InProgressOverview({
  audit,
  brandName,
  workspace,
}: {
  audit: Audit;
  brandName: string | null;
  workspace: Workspace | null;
}) {
  const { workspaceSlug: _ws } = useWorkspace();
  const _dp = _ws ? `/dashboard/${_ws}` : '/dashboard';
  let domain: string | null = null;
  try { domain = new URL(audit.product_url || '').hostname.replace(/^www\./, ''); } catch {}
  const displayTitle = !workspace?.primary_domain && brandName
    ? brandName
    : (domain || 'Your website');
  const isBrand = !workspace?.primary_domain;
  const meta = statusMeta[audit.status] || statusMeta.payment_received;
  const StatusIcon = meta.icon;

  // Restart audit state — immediate feedback to prevent spam clicks (Bug 3)
  const [restartState, setRestartState] = useState<'idle' | 'pending' | 'error'>('idle');
  const [restartError, setRestartError] = useState<string | null>(null);
  const { invalidate } = useAuditBundle();

  const handleRestart = async () => {
    if (restartState === 'pending') return; // Guard — ignore duplicate clicks
    setRestartState('pending');
    setRestartError(null);
    try {
      const res = await fetch(`/api/audits/${audit.id}/restart`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRestartError(data.error || 'Failed to restart audit');
        setRestartState('error');
        return;
      }
      // Success — invalidate the bundle to pick up the restarted audit state
      invalidate();
      // Keep button in pending state — the InProgressOverview will re-render
      // with fresh skeleton state once the bundle updates
    } catch (err) {
      setRestartError('Network error. Please try again.');
      setRestartState('error');
    }
  };

  // Stall detection: only show Restart when audit appears stuck (no progress for >5 min)
  const stuckMinutes = audit.updated_at
    ? (Date.now() - new Date(audit.updated_at).getTime()) / 60_000
    : 0;
  const isStuck = stuckMinutes > 5 || audit.status === 'stalled' || audit.status === 'failed';

  // Progressive loading state
  const { data: progress } = useAuditProgress(audit.id)
  const [partial, setPartial] = useState<PartialAuditData | null>(null)
  const lastFetchRef = useRef<string>('')

  // Fetch partial data whenever progress changes meaningfully
  useEffect(() => {
    if (!progress) return
    // Build a fingerprint — includes stage so we refetch when pipeline advances
    const fp = `${progress.stage}-${progress.data.hasSpeedData}-${progress.data.findingsCount}-${progress.data.overallScore}-${progress.data.pagesCrawled}`
    if (fp === lastFetchRef.current) return
    lastFetchRef.current = fp

    const fetchPartial = async () => {
      try {
        const res = await fetch(`/api/audits/${audit.id}/partial`)
        if (res.ok) {
          const data = await res.json()
          setPartial(data)
        }
      } catch { /* silent */ }
    }
    fetchPartial()
  }, [audit.id, progress])

  // Compute completed stages count
  const stagesCompleted = progress?.stages
    ? Object.values(progress.stages).filter(Boolean).length
    : 0
  const totalStages = 8

  // Determine which cards are populated
  const hasScore = partial?.overallScore != null
  const hasSpeed = partial?.speedData != null
  const hasFindings = (partial?.findingsCount ?? 0) > 0
  const hasModuleScores = partial?.moduleScores != null && Object.keys(partial.moduleScores).length > 0

  return (
    <div className="w-full">

      {/* Identity header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            {isBrand
              ? <Fingerprint size={20} className="text-muted flex-shrink-0" />
              : <SiteFavicon hostname={domain || ''} size={18} className="text-muted flex-shrink-0" />}
            <h1 className="text-2xl font-medium font-sans text-text truncate" style={{ color: 'var(--ink)' }}>
              {displayTitle}
            </h1>
          </div>
          <p className="text-muted text-xs">Auditing your website</p>
        </div>
      </div>

      {/* Status banner with progress */}
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
            {progress
              ? `${stagesCompleted} of ${totalStages} stages complete — results appear as they're ready`
              : 'We are working on your audit. Results will appear as they are ready.'}
          </p>
          {/* Progress bar */}
          {progress && (
            <div className="mt-2 h-1 w-full rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--signal) 15%, transparent)' }}>
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progress.progress > 0 ? progress.progress : Math.round((stagesCompleted / totalStages) * 100)}%`,
                  background: 'var(--signal)',
                }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isStuck && (
            <button
              type="button"
              onClick={handleRestart}
              disabled={restartState === 'pending'}
              className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Restart this audit"
            >
              {restartState === 'pending' ? (
                <><Loader2 size={12} className="animate-spin" /> Restarting...</>
              ) : (
                <><RefreshCw size={12} /> Restart</>
              )}
            </button>
          )}
          <Link
            href={`${_dp}/audits/${audit.id}`}
            className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface-alt transition-colors"
          >
            View progress <ChevronRight size={12} />
          </Link>
        </div>
      </div>
      {/* Restart error message */}
      {restartError && (
        <div className="mb-3 px-3 py-2 rounded-lg text-[12px]" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', color: 'var(--severe)' }}>
          {restartError}
        </div>
      )}

      {/* Row 1 — Health Score, Score Over Time, Heuristic Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 auto-rows-fr">
        {/* Health Score — reveals when overallScore arrives */}
        {hasScore ? (
          <PopulatedCard>
            <div className="flex items-start gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}>
                <Heart size={14} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Website Health Score</h3>
                <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>Overall performance</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <ScoreCircle score={partial!.overallScore!} size="big" />
            </div>
          </PopulatedCard>
        ) : (
          <SkeletonCard title="Website Health Score" subtitle="Calculating..." icon={Heart} />
        )}
        <SkeletonCard title="Score Over Time" subtitle="Trend will appear after this audit" icon={TrendingUp} />
        <SkeletonCard title="Heuristic Breakdown" subtitle="Radar populates when the audit completes" icon={Target} />
      </div>

      {/* Row 2 — Categories grid */}
      <div className="mb-2 flex items-center gap-2">
        <ListChecks size={14} style={{ color: 'var(--m-muted)' }} />
        <h2 className="text-[15px] font-semibold tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Categories</h2>
        {hasModuleScores ? (
          <p className="text-[11px]" style={{ color: 'var(--ok)' }}>· scored</p>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>· populating</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {PILLAR_NAMES.map((name, i) => {
          const tint = MODULE_TINTS[i] || MODULE_TINTS[0];
          const PIcon = PILLAR_ICONS[i] || Scale;
          // Check if we have a score for this module
          const moduleKey = name.toLowerCase().replace(/[^a-z]/g, '_')
          const moduleScore = partial?.moduleScores?.[moduleKey] ?? partial?.moduleScores?.[name] ?? null
          const isPopulated = moduleScore != null

          return (
            <div
              key={name}
              className={`rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${isPopulated ? 'progressive-card-reveal' : ''}`}
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
                    {isPopulated ? `${Math.round(moduleScore)}%` : 'Auditing...'}
                  </p>
                </div>
              </div>
              <div className="px-3 pb-3 pt-1">
                {isPopulated ? (
                  <span className={`text-[28px] font-bold tabular-nums leading-none ${scoreColor(Math.round(moduleScore))}`}>{Math.round(moduleScore)}</span>
                ) : (
                  <div
                    className="h-5 w-12 rounded-md animate-pulse"
                    style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Row 3 — Issues / Speed / Brand Intelligence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 auto-rows-fr">
        {/* Issues card — reveals when findings arrive */}
        {hasFindings ? (
          <PopulatedCard>
            <div className="flex items-start gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}>
                <AlertTriangle size={14} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Issues found</h3>
                <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>{partial!.findingsCount} total</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5 justify-center">
              {partial!.severityBreakdown.critical > 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>Critical</span>
                  <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: 'var(--severe)' }}>{partial!.severityBreakdown.critical}</span>
                </div>
              )}
              {partial!.severityBreakdown.major > 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--warn) 6%, transparent)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>Major</span>
                  <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: 'var(--warn)' }}>{partial!.severityBreakdown.major}</span>
                </div>
              )}
              {partial!.severityBreakdown.moderate > 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--m-muted)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>Moderate</span>
                  <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: 'var(--m-muted)' }}>{partial!.severityBreakdown.moderate}</span>
                </div>
              )}
              {partial!.severityBreakdown.minor > 0 && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--m-muted)' }} />
                  <span className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>Minor</span>
                  <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: 'var(--m-muted)' }}>{partial!.severityBreakdown.minor}</span>
                </div>
              )}
            </div>
          </PopulatedCard>
        ) : (
          <SkeletonCard title="Issues by importance" subtitle="Findings will appear here" icon={AlertTriangle} />
        )}

        {/* Speed card — reveals when speed data arrives */}
        {hasSpeed ? (
          <PopulatedCard>
            <div className="flex items-start gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}>
                <Gauge size={14} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.005em]" style={{ color: 'var(--ink)' }}>Website speed</h3>
                <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>PageSpeed Insights</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center gap-4">
              {partial!.speedData.mobile && (
                <div className="flex flex-col items-center gap-1">
                  <ScoreCircle score={partial!.speedData.mobile.score} size="small" />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--m-muted)' }}>Mobile</span>
                </div>
              )}
              {partial!.speedData.desktop && (
                <div className="flex flex-col items-center gap-1">
                  <ScoreCircle score={partial!.speedData.desktop.score} size="small" />
                  <span className="text-[10px] font-medium" style={{ color: 'var(--m-muted)' }}>Desktop</span>
                </div>
              )}
            </div>
          </PopulatedCard>
        ) : (
          <SkeletonCard title="Website speed" subtitle="Performance metrics" icon={Gauge} />
        )}

        <SkeletonCard title="Brand Intelligence" subtitle="AI + human perception unified" icon={Radio} />
      </div>
    </div>
  );
}

/* ── Populated card wrapper with reveal animation ───── */
function PopulatedCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col h-full progressive-card-reveal"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      {children}
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
          className="h-4 w-3/4 rounded shimmer-pulse"
          style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
        />
        <div
          className="h-4 w-1/2 rounded shimmer-pulse"
          style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)', animationDelay: '150ms' }}
        />
        <div
          className="h-4 w-2/3 rounded shimmer-pulse"
          style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)', animationDelay: '300ms' }}
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
  workspace,
}: {
  audit: Audit;
  brandName: string | null;
  workspace: Workspace | null;
}) {
  const { workspaceSlug: _ws } = useWorkspace();
  const _dp = _ws ? `/dashboard/${_ws}` : '/dashboard';
  let domain: string | null = null;
  try { domain = new URL(audit.product_url || '').hostname.replace(/^www\./, ''); } catch {}
  const displayTitle = !workspace?.primary_domain && brandName
    ? brandName
    : (domain || 'Your website');
  const isBrand = !workspace?.primary_domain;
  const productUrl = audit.product_url || (domain ? `https://${domain}` : '');
  const retryHref = productUrl
    ? `${_dp}/new-audit?url=${encodeURIComponent(productUrl)}`
    : `${_dp}/new-audit`;

  return (
    <div className="w-full">

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            {isBrand
              ? <Fingerprint size={20} className="text-muted flex-shrink-0" />
              : <SiteFavicon hostname={domain || ''} size={18} className="text-muted flex-shrink-0" />}
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
        {audit.crawl_error?.startsWith('BLOCKED:') ? (
          /* ── Blocked by anti-bot protection ── */
          <>
            <div className="flex items-start gap-3">
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }}
              >
                <Shield size={18} />
              </span>
              <div>
                <h2 className="text-[18px] font-sans font-semibold" style={{ color: 'var(--ink)' }}>
                  This site blocked our crawler
                </h2>
                <p className="text-[13px] mt-1.5 max-w-[560px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  {domain ? <span className="font-medium" style={{ color: 'var(--ink)' }}>{domain}</span> : 'This website'}{' '}uses
                  anti-bot protection that prevents automated tools from accessing its content.
                  This is not an error on our end{' '}&mdash; it means the site&apos;s security is working as intended.
                </p>
                <div
                  className="mt-3 px-3 py-2.5 rounded-lg text-[12px] leading-relaxed"
                  style={{ background: 'color-mix(in srgb, var(--warn) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 15%, transparent)' }}
                >
                  <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>Your credit has been refunded</p>
                  <p style={{ color: 'var(--m-muted)' }}>
                    No charge was applied for this audit. To audit this site, ask the site owner to whitelist
                    the Fixpath crawler user-agent, or try again later if the protection is temporary.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={retryHref}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-lg"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                <RefreshCw size={13} />
                Try again
              </Link>
              <a
                href="/contact?subject=blocked-site"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg transition-colors hover:opacity-80"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              >
                Contact support
              </a>
            </div>
          </>
        ) : audit.crawl_error?.startsWith('UNREACHABLE:') ? (
          /* ── Domain unreachable ── */
          <>
            <div className="flex items-start gap-3">
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--severe) 12%, transparent)', color: 'var(--severe)' }}
              >
                <WifiOff size={18} />
              </span>
              <div>
                <h2 className="text-[18px] font-sans font-semibold" style={{ color: 'var(--ink)' }}>
                  We couldn&apos;t reach {domain ? <span>{domain}</span> : 'this site'}
                </h2>
                <p className="text-[13px] mt-1.5 max-w-[560px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                  The URL may be incorrect, the site may be offline, or the domain may not exist.
                  Please check the URL and try again.
                </p>
                <div
                  className="mt-3 px-3 py-2.5 rounded-lg text-[12px] leading-relaxed"
                  style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid var(--rule)' }}
                >
                  <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>Your credit has been refunded</p>
                  <p style={{ color: 'var(--m-muted)' }}>
                    No charge was applied for this audit attempt.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={retryHref}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-lg"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                <RefreshCw size={13} />
                Check URL and try again
              </Link>
            </div>
          </>
        ) : (
          /* ── Generic audit failure ── */
          <>
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
                href={`${_dp}/audits/${audit.id}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg bg-card border border-border text-text hover:bg-surface-alt transition-colors"
              >
                View details <ChevronRight size={12} />
              </Link>
            </div>
          </>
        )}
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
