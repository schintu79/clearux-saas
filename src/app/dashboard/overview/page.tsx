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
  Wrench,
  LineChart,
  Check,
  Trash2,
  Lightbulb,
  ListChecks,
  Info,
  TrendingUp,
  ArrowRight,
  Brain,
  Eye,
  Heart,
  Accessibility,
  Scale,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import {
  ScoreOverTimeChart,
  HeuristicRadarChart,
  BenchmarksSection,
} from '@/components/dashboard/AuditDashboard';
import ScoreRing from '@/components/ui/ScoreRing';
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints';
import {
  loadLatestAuditBundle,
  moduleScoresFromReport,
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
  // showing. Guarded by an equality check to avoid loops with the
  // subscribe-driven mirror in DashboardShell.
  useEffect(() => {
    const resolved = bundle?.audit;
    if (!resolved) return;
    let resolvedSel: { kind: 'brand'; brandId: string } | { kind: 'site'; host: string } | null = null;
    if ((resolved as any).audit_type === 'brand_identity' && (resolved as any).brand_identity_id) {
      resolvedSel = { kind: 'brand', brandId: (resolved as any).brand_identity_id };
    } else if (resolved.product_url) {
      try {
        const host = new URL(resolved.product_url).hostname.replace(/^www\./, '');
        if (host) resolvedSel = { kind: 'site', host };
      } catch {}
    }
    if (!resolvedSel) return;
    const matches =
      (selection?.kind === 'site' && resolvedSel.kind === 'site' && selection.host === resolvedSel.host) ||
      (selection?.kind === 'brand' && resolvedSel.kind === 'brand' && selection.brandId === resolvedSel.brandId);
    if (!matches) writeSelection(resolvedSel);
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
  }, [latestCompleted, bundle]);

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
    router.push(`/dashboard/audits/${latestCompleted.id}?tab=findings&severity=${filter}`);
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

  // Priority recommendations.
  const rawJson = (report.raw_json || null) as any;
  const recommendationsFromRaw: string[] = Array.isArray(rawJson?.topRecommendations)
    ? rawJson.topRecommendations.filter((r: any) => typeof r === 'string' && r.trim().length > 0).slice(0, 3)
    : [];
  const recommendationsFromKey: string[] = !recommendationsFromRaw.length && report.key_recommendation
    ? [report.key_recommendation]
    : [];
  const recommendationsFromFindings: string[] = !recommendationsFromRaw.length && !recommendationsFromKey.length
    ? openFindings
        .filter((f) => (f.severity === 'critical' || f.severity === 'high') && f.recommendation)
        .slice(0, 3)
        .map((f) => f.recommendation as string)
    : [];
  const priorityRecs = recommendationsFromRaw.length
    ? recommendationsFromRaw
    : recommendationsFromKey.length
      ? recommendationsFromKey
      : recommendationsFromFindings;

  const alertCritical = severityCounts.critical > 0;
  const execSummary = (report.executive_summary || '').trim();

  // AI readability summary (Row 1, card 4).
  const aiPagesScored = auditPages.filter(p => (p as any).ai_readability?.overallScore != null);
  const avgAi = aiPagesScored.length > 0
    ? Math.round(aiPagesScored.reduce((s, p) => s + ((p as any).ai_readability.overallScore || 0), 0) / aiPagesScored.length)
    : null;
  const aiBuckets = {
    green: aiPagesScored.filter(p => (p as any).ai_readability?.status === 'green' || (p as any).ai_readability?.overallScore >= 70).length,
    amber: aiPagesScored.filter(p => (p as any).ai_readability?.status === 'amber' || ((p as any).ai_readability?.overallScore >= 40 && (p as any).ai_readability?.overallScore < 70)).length,
    red:   aiPagesScored.filter(p => (p as any).ai_readability?.status === 'red'   || (p as any).ai_readability?.overallScore < 40).length,
  };

  // History toggle
  const HISTORY_PREVIEW = 8;
  const showingAll = showAllHistory || auditCount <= HISTORY_PREVIEW;

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
                <Link
                  href="/dashboard/audits"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs hover:bg-black/[0.04] transition-colors"
                  style={{ color: 'var(--ink)' }}
                >
                  <FileSearch size={13} className="text-m-muted" />
                  View all audits
                </Link>
                <button
                  type="button"
                  disabled
                  title="Coming soon — audit deletion is not available yet."
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs opacity-50 cursor-not-allowed text-left"
                  style={{ color: 'var(--m-muted)' }}
                >
                  <Trash2 size={13} />
                  Delete audit
                  <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Alert / executive summary slot ───────────────── */}
      <AlertOrSummary
        critical={severityCounts.critical}
        execSummary={execSummary}
        overallScore={overallScore}
        latestAuditId={audit.id}
        completedAt={audit.completed_at || audit.created_at}
      />

      {/* ── Row 1: 4 cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* 1) Brand Health Score + module dots */}
        <DashboardCard
          title="Brand Health Score"
          subtitle="Latest audit"
          rightLabel={audit.completed_at ? formatDate(audit.completed_at) : null}
          titleSize="lg"
        >
          <div className="flex flex-col items-center justify-center pt-1 pb-2">
            <ScoreRing score={overallScore} size={130} strokeWidth={9} />
            <p className="text-[11px] mt-2" style={{ color: 'var(--m-muted)' }}>/100</p>
            <span
              className="text-[11px] font-medium mt-2 px-3 py-0.5 rounded-full"
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

        {/* 4) AI Readability — single clickable Kime-style card */}
        <AIReadabilityCard
          auditId={audit.id}
          avgAi={avgAi}
          aiBuckets={aiBuckets}
          scoredPages={aiPagesScored.length}
          totalPages={auditPages.length || aiPagesScored.length}
        />
      </div>

      {/* ── Row 2: Category/module cards — clean layered excerpts ── */}
      {pillarScores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          {pillarScores.map((p) => {
            const pillarIdx = PILLAR_NAMES.indexOf(p.name);
            if (pillarIdx < 0) return null;
            const tint = MODULE_TINTS[pillarIdx] || MODULE_TINTS[0];
            const PIcon = PILLAR_ICONS[pillarIdx] || Scale;
            const findingCount = findingsByPillarName[p.name]?.length || 0;
            return (
              <Link
                key={p.name}
                href={`/dashboard/audits/${audit.id}?tab=findings`}
                aria-label={`Open ${p.name} findings — score ${p.score} out of 100, ${findingCount} finding${findingCount === 1 ? '' : 's'}`}
                className="text-left rounded-xl overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer group flex flex-col"
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
                      className="font-sans font-medium text-[12px] leading-tight truncate"
                      style={{ color: 'var(--ink)' }}
                      title={p.name}
                    >
                      {p.name}
                    </h3>
                    <p className="text-[10px] leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                      {findingCount} finding{findingCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="px-3 pb-3 flex items-baseline gap-1 flex-1">
                  <span className={`text-[26px] font-bold leading-none tabular-nums ${scoreColor(p.score)}`}>{p.score}</span>
                  <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>/100</span>
                </div>

                <div
                  className="px-3 py-1.5 flex items-center justify-between gap-1 text-[10px] font-medium mt-auto"
                  style={{ borderTop: `1px solid ${tint.border}`, color: tint.dot }}
                >
                  <span>Open findings</span>
                  <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Row 3: Issues · Checkpoint Health · Benchmarks ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <IssuesByImportance
          severityCounts={severityCounts}
          onCardClick={handleStatCardClick}
        />
        <CheckpointHealthCard
          categoryScores={categoryScores}
          pillarScores={pillarScores}
          findings={openFindings}
          auditId={audit.id}
        />
        <BenchmarksColumn
          overallScore={overallScore}
          pillarScores={pillarScores}
          competitors={competitors}
          detecting={detectingCompetitors}
          onBenchmark={handleBenchmark}
          hidden={hideBenchmarks}
          auditId={audit.id}
        />
      </div>

      {/* ── Row 3.5: Find/Fix/Track + Priority Recommendations ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <FindFixTrackCard severityCounts={severityCounts} />
        <PriorityRecommendations
          recs={priorityRecs}
          findings={openFindings}
          auditId={audit.id}
        />
      </div>

      {/* ── Row 4: Audit history ───────────────────────── */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Audit history</h2>
        <div className="flex items-center gap-2">
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            {showingAll ? `${auditCount} total` : `Latest ${Math.min(HISTORY_PREVIEW, auditCount)} of ${auditCount}`}
          </p>
          {auditCount > HISTORY_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllHistory((v) => !v)}
              className="text-[11px] font-medium hover:underline"
              style={{ color: 'var(--ink)' }}
              aria-expanded={showingAll}
            >
              {showingAll ? 'Show less' : 'View all'}
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}>
        <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
          {(showingAll ? bundle.history : bundle.history.slice(0, HISTORY_PREVIEW)).map((h) => {
            const a = h.audit;
            const r = h.report;
            const meta = statusMeta[a.status] || statusMeta.pending_payment;
            const Icon = meta.icon;
            const done = a.status === 'completed';
            const aLang = langCode((a as any).language);
            return (
              <Link
                key={a.id}
                href={`/dashboard/audits/${a.id}`}
                className="flex items-center gap-2 hover:bg-black/[0.02] transition-colors group/row"
              >
                <div className="flex-1 min-w-0 px-4 py-3 flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[11px] text-muted flex-1 min-w-0 flex-wrap">
                    <span className="text-text font-medium" style={{ color: 'var(--ink)' }}>
                      {formatDate(a.completed_at || a.created_at)}
                    </span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-0.5"><Icon size={10} />{meta.label}</span>
                    <span className="text-border">·</span>
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                      style={{ color: 'var(--m-muted)', background: 'var(--paper-2)' }}
                    >
                      {aLang}
                    </span>
                    {done && r?.overall_score != null && (
                      <>
                        <span className="text-border">·</span>
                        <span className={`font-medium ${scoreColor(r.overall_score)}`}>{r.overall_score} pts</span>
                      </>
                    )}
                    {(a as any).depth_mode === 'deep' && (
                      <span className="text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded uppercase tracking-wide">Deep</span>
                    )}
                  </div>
                  <ChevronRight size={12} className="text-muted/40 group-hover/row:text-brand transition-colors flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
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
  titleSize = 'md',
}: {
  title: string;
  subtitle?: string | null;
  rightLabel?: string | null;
  children: React.ReactNode;
  titleSize?: 'md' | 'lg';
}) {
  const titleCls = titleSize === 'lg'
    ? 'text-[15px] font-semibold leading-tight'
    : 'text-[13px] font-semibold leading-tight';
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className={titleCls} style={{ color: 'var(--ink)' }}>{title}</h3>
          {subtitle && (
            <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>{subtitle}</p>
          )}
        </div>
        {rightLabel && (
          <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--m-muted)' }}>{rightLabel}</span>
        )}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/* ── Row 3 — Issues by importance (colored urgency cards) ── */
function IssuesByImportance({
  severityCounts,
  onCardClick,
}: {
  severityCounts: { critical: number; high: number; medium: number; low: number };
  onCardClick?: (filter: string) => void;
}) {
  const total =
    severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low;
  const rows: Array<{ key: string; label: string; count: number; colorVar: string }> = [
    { key: 'critical', label: 'Critical', count: severityCounts.critical, colorVar: '--severe' },
    { key: 'high', label: 'High', count: severityCounts.high, colorVar: '--warn' },
    { key: 'medium', label: 'Medium', count: severityCounts.medium, colorVar: '--signal' },
    { key: 'low', label: 'Low', count: severityCounts.low, colorVar: '--ok' },
  ];
  return (
    <DashboardCard
      title="Issues by importance"
      subtitle={total === 0 ? 'No open issues — nice.' : `${total} open issue${total === 1 ? '' : 's'}`}
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
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onCardClick?.(r.key)}
                className="w-full text-left rounded-lg px-3 py-2.5 transition-colors flex items-center gap-3 hover:shadow-sm"
                style={{
                  background: `color-mix(in srgb, var(${r.colorVar}) 6%, transparent)`,
                  border: `1px solid color-mix(in srgb, var(${r.colorVar}) 18%, transparent)`,
                  color: `var(${r.colorVar})`,
                }}
                aria-label={`${r.count} ${r.label.toLowerCase()} severity issues`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: `var(${r.colorVar})` }}
                />
                <span className="text-[12px] font-semibold flex-1" style={{ color: `var(${r.colorVar})` }}>{r.label}</span>
                <span className="text-[16px] font-bold tabular-nums" style={{ color: `var(${r.colorVar})` }}>
                  {r.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* ── Row 3 — Priority recommendations ────────────────── */
function PriorityRecommendations({
  recs,
  findings,
  auditId,
}: {
  recs: string[];
  findings: AuditFinding[];
  auditId: string;
}) {
  const topFindings = findings
    .filter((f) => (f.severity === 'critical' || f.severity === 'high') && f.recommendation)
    .slice(0, 3);

  return (
    <DashboardCard
      title="Priority recommendations"
      subtitle={recs.length > 0 ? `Top ${recs.length} action${recs.length === 1 ? '' : 's'}` : 'Nothing flagged'}
      titleSize="lg"
    >
      {recs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Lightbulb size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} className="mb-2" />
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            No priority recommendations from the latest audit.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {recs.slice(0, 3).map((rec, i) => {
            const linkedFinding = topFindings[i];
            return (
              <li
                key={i}
                className="rounded-lg p-3"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-semibold"
                    style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[12px] leading-snug line-clamp-3"
                      style={{ color: 'var(--ink)' }}
                    >
                      {rec}
                    </p>
                    {linkedFinding && (
                      <Link
                        href={`/dashboard/audits/${auditId}?finding=${linkedFinding.id}`}
                        className="text-[10px] mt-1.5 inline-flex items-center gap-0.5 hover:underline"
                        style={{ color: 'var(--m-muted)' }}
                      >
                        View finding <ChevronRight size={10} />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}

/* ── Row 1 — AI Readability (clickable Kime-style excerpt) ─── */
function AIReadabilityCard({
  auditId,
  avgAi,
  aiBuckets,
  scoredPages,
  totalPages,
}: {
  auditId: string;
  avgAi: number | null;
  aiBuckets: { green: number; amber: number; red: number };
  scoredPages: number;
  totalPages: number;
}) {
  const href = `/dashboard/audits/${auditId}#ai_xray`;
  const subtitle = avgAi != null
    ? `${scoredPages} of ${totalPages || scoredPages} pages scored`
    : 'No AI readability data yet';

  return (
    <Link
      href={href}
      aria-label={avgAi != null
        ? `Open AI Readability details — average score ${avgAi} percent`
        : 'Open AI Readability details'}
      className="group rounded-xl p-4 sm:p-5 flex flex-col cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)', color: 'var(--signal)' }}
          >
            <Brain size={13} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>AI Readability</h3>
            <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>{subtitle}</p>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-1"
          style={{ color: 'var(--m-muted)' }}
        />
      </div>

      <div className="flex-1 min-h-0">
        {avgAi != null ? (
          <div className="flex flex-col items-center justify-center pt-1">
            <div className="flex items-baseline gap-1">
              <span className={`text-[40px] font-bold leading-none tabular-nums ${scoreColor(avgAi)}`}>{avgAi}</span>
              <span className="text-[12px] font-medium" style={{ color: 'var(--m-muted)' }}>%</span>
            </div>
            <p className="text-[10px] uppercase font-semibold tracking-[0.06em] mt-1" style={{ color: 'var(--m-muted)' }}>
              Avg readability
            </p>
            <div className="mt-3 w-full flex items-center gap-3 text-[11px] justify-center">
              <span className="flex items-center gap-1" style={{ color: 'var(--ok)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--ok)' }} /> {aiBuckets.green} green
              </span>
              <span className="flex items-center gap-1" style={{ color: 'var(--warn)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} /> {aiBuckets.amber} amber
              </span>
              <span className="flex items-center gap-1" style={{ color: 'var(--severe)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} /> {aiBuckets.red} red
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Brain size={26} style={{ color: 'var(--m-muted)', opacity: 0.4 }} className="mb-2" />
            <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
              AI readability data appears here after a deeper audit.
            </p>
          </div>
        )}
      </div>

      <div
        className="mt-3 pt-3 flex items-center justify-between gap-1 text-[11px] font-medium"
        style={{ borderTop: '1px solid var(--rule)', color: 'var(--ink)' }}
      >
        <span>Open details</span>
        <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

/* ── Row 3 — Checkpoint Health: full list with expandable rows ── */
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
      className="rounded-xl flex flex-col overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Checkpoint health</h3>
          {totalCategories > 0 && (
            <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>
              {totalCategories * 4} checkpoints across {totalCategories} categories
            </p>
          )}
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
                                href={`/dashboard/audits/${auditId}?finding=${finding.id}`}
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

/* ── Row 3 — Benchmarks column (layered: excerpt → details) ── */
function BenchmarksColumn({
  overallScore,
  pillarScores,
  competitors,
  detecting,
  onBenchmark,
  hidden,
  auditId,
}: {
  overallScore: number;
  pillarScores: Array<{ name: string; score: number }>;
  competitors: Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>;
  detecting: boolean;
  onBenchmark: (mode: 'auto' | 'manual', domains?: string[]) => void;
  hidden: boolean;
  auditId: string;
}) {
  if (hidden) {
    return (
      <DashboardCard
        title="Benchmarks"
        subtitle="Not available for brand audits"
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

  const hasCompetitors = competitors.length > 0;

  // With competitors: compact Kime-style excerpt; whole card click-through
  // to the audit's intelligence tab (industry benchmark + competitor data).
  if (hasCompetitors) {
    const top = competitors.slice(0, 3);
    const intelHref = `/dashboard/audits/${auditId}#intelligence`;
    return (
      <Link
        href={intelHref}
        aria-label={`Open benchmark details — ${overallScore} vs ${top.length} competitor${top.length === 1 ? '' : 's'}`}
        className="group rounded-xl flex flex-col cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--brand) 12%, transparent)', color: 'var(--brand)' }}
            >
              <LineChart size={13} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Benchmarks</h3>
              <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--m-muted)' }}>
                You vs. {top.length} competitor{top.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <ChevronRight
            size={14}
            className="group-hover:translate-x-0.5 transition-transform flex-shrink-0 mt-1"
            style={{ color: 'var(--m-muted)' }}
          />
        </div>

        <div className="px-4 sm:px-5 pb-3 space-y-1.5">
          <BenchmarkRow label="You" score={overallScore} highlight />
          {top.map((c) => {
            const delta = overallScore - c.score;
            return <BenchmarkRow key={c.domain} label={c.domain} score={c.score} delta={delta} />;
          })}
        </div>

        <div
          className="px-4 sm:px-5 py-2 flex items-center justify-between gap-1 text-[11px] font-medium mt-auto"
          style={{ borderTop: '1px solid var(--rule)', color: 'var(--ink)' }}
        >
          <span>Open intelligence</span>
          <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    );
  }

  // No competitors yet — preserve inline setup form via BenchmarksSection
  // (this is the only "controls" surface; making it a link with no
  // destination would be a broken affordance).
  return (
    <div className="[&>div]:mb-0 [&>div]:h-full">
      <BenchmarksSection
        overallScore={overallScore}
        pillarScores={pillarScores}
        competitors={competitors}
        detecting={detecting}
        onBenchmark={onBenchmark}
      />
    </div>
  );
}

/* Compact benchmark row used by BenchmarksColumn excerpt. */
function BenchmarkRow({
  label,
  score,
  delta,
  highlight,
}: {
  label: string;
  score: number;
  delta?: number;
  highlight?: boolean;
}) {
  const tone = score >= 70 ? 'var(--ok)' : score >= 40 ? 'var(--warn)' : 'var(--severe)';
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
      style={{
        background: highlight ? 'color-mix(in srgb, var(--brand) 6%, transparent)' : 'var(--paper-2)',
        border: highlight ? '1px solid color-mix(in srgb, var(--brand) 18%, transparent)' : '1px solid transparent',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: tone }}
      />
      <span
        className="flex-1 text-[12px] truncate font-medium"
        style={{ color: 'var(--ink)' }}
        title={label}
      >
        {label}
      </span>
      {delta != null && (
        <span
          className="text-[10px] font-semibold tabular-nums flex-shrink-0"
          style={{ color: delta >= 0 ? 'var(--ok)' : 'var(--severe)' }}
        >
          {delta >= 0 ? '+' : ''}{delta}
        </span>
      )}
      <span
        className="text-[13px] font-bold tabular-nums flex-shrink-0"
        style={{ color: tone }}
      >
        {score}
      </span>
    </div>
  );
}

/* ── Row 3.5 — Find / Fix / Track grouped card ─────────── */
function FindFixTrackCard({
  severityCounts,
}: {
  severityCounts: { critical: number; high: number; medium: number; low: number };
}) {
  const topPainCount = severityCounts.critical + severityCounts.high;
  const items: Array<{
    href: string;
    title: string;
    subtitle: string;
    body: string;
    icon: React.ElementType;
    accentVar: string;
  }> = [
    {
      href: '/dashboard/find',
      title: 'Find',
      subtitle: 'Identify issues',
      body: topPainCount > 0
        ? `${topPainCount} high-impact issue${topPainCount === 1 ? '' : 's'} waiting to be triaged.`
        : 'See every open issue, ranked by impact on your score.',
      icon: Search,
      accentVar: 'var(--severe)',
    },
    {
      href: '/dashboard/fix',
      title: 'Fix',
      subtitle: 'Take action',
      body: 'Work through recommended fixes with copy-paste guidance and snippets.',
      icon: Wrench,
      accentVar: 'var(--warn)',
    },
    {
      href: '/dashboard/track',
      title: 'Track',
      subtitle: 'Monitor improvement',
      body: 'Watch your Brand Health Score move as you ship fixes over time.',
      icon: LineChart,
      accentVar: 'var(--ok)',
    },
  ];
  return (
    <DashboardCard
      title="Find · Fix · Track"
      subtitle="Your remediation workflow"
      titleSize="lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.title}
              href={it.href}
              className="group rounded-xl p-3 transition-all hover:shadow-sm flex flex-col gap-2 relative overflow-hidden"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--rule)',
                borderLeft: `3px solid ${it.accentVar}`,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${it.accentVar} 12%, transparent)`,
                    color: it.accentVar,
                  }}
                >
                  <Icon size={13} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{it.title}</p>
                  <p
                    className="text-[9px] font-semibold uppercase tracking-[0.05em] leading-tight mt-0.5"
                    style={{ color: it.accentVar }}
                  >
                    {it.subtitle}
                  </p>
                </div>
                <ChevronRight size={12} className="ml-auto group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--m-muted)' }} />
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{it.body}</p>
            </Link>
          );
        })}
      </div>
    </DashboardCard>
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
          href={`/dashboard/audits/${latestAuditId}?tab=findings&severity=critical`}
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
