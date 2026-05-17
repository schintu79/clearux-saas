'use client';

/**
 * Overview — brand audit command center for the SELECTED brand/site.
 *
 * Lives at `/dashboard/overview` and is the landing page after a user
 * picks a brand or site from the sidebar selector. Mirrors the layout
 * of the per-domain dashboard at `/dashboard/audits/site/[domain]` —
 * brand-health score, score-over-time, severity cards, heuristic
 * radar, benchmarks, audit history — but scoped to the persisted
 * brand/site selection so the user does not bounce between
 * differently-shaped surfaces just because they switched brands.
 *
 * If the selected brand has no audit yet, render a clean empty state
 * pointing to "Run audit" — never another brand's data.
 */

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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

/* ── Pillar config (must match audit detail page) ────────── */
const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure', 'Brand Consistency'];
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]];

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

function langCode(code: string | null | undefined): string {
  if (!code || code === 'en') return 'EN';
  return code.toUpperCase();
}

function OverviewInner() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditsBanner, setCreditsBanner] = useState(false);

  // Extra data layered on top of the shared audit bundle. Loaded
  // separately so a slow trend/competitor fetch never blocks the
  // primary score render.
  const [scoreTrend, setScoreTrend] = useState<Array<{ auditId: string; date: string; overallScore: number }>>([]);
  const [competitors, setCompetitors] = useState<Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>>([]);
  const [detectingCompetitors, setDetectingCompetitors] = useState(false);
  const [categoryScores, setCategoryScores] = useState<Array<{ name: string; score: number; summary: string }>>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [brandName, setBrandName] = useState<string | null>(null);

  // Share + overflow menu state. Mirrors the audit detail page so the
  // operator gets the same affordance wherever they look at an audit.
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

  // Surfacing a one-shot "credits added" banner — only after the user
  // returns from the Stripe checkout. Same behaviour as before the
  // redesign so the existing checkout flow still gets confirmation.
  useEffect(() => {
    if (searchParams.get('credits') !== 'purchased') return;
    setCreditsBanner(true);
    window.history.replaceState({}, '', '/dashboard/overview');
    const t = setTimeout(() => setCreditsBanner(false), 6000);
    fetch('/api/stripe/verify-credits', { method: 'POST' }).catch(() => {});
    return () => clearTimeout(t);
  }, [searchParams]);

  // Load latest bundle whenever auth or selection changes.
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
    loadLatestAuditBundle(user.id, selection)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, ready, selection]);

  // Resolve a human-readable brand name when the selection is a brand
  // identity (the bundle only carries audits, not the brand row itself).
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

  // Defensive sync: if the loaded bundle's audit identity does NOT match
  // the current selection (e.g. selection was null on a direct visit and
  // the loader returned the globally-most-recent audit), write the
  // resolved audit's identity back to the selection store so the sidebar
  // selector + topbar "Viewing X" agree with what the body is showing.
  // Guarded by an equality check to avoid loops with the subscribe-
  // driven mirror in DashboardShell.
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

  // Once we have a latest completed audit, hydrate findings, category
  // scores, score trend, and stored competitor benchmarks. Each fetch
  // is independent so a single slow endpoint does not stall the page.
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

  // Reset share state when the active audit changes.
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
        // Clipboard API is gated on secure contexts and user gesture; if it
        // throws we surface the URL anyway so the user can copy manually.
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-60 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-72 rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  /* ── Empty state — no audit for the selected brand ────── */
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

  // Severity counts from open findings (mirror domain dashboard).
  const openFindings = findings.filter((f) => f.status !== 'fixed' && !f.dismissed);
  const severityCounts = {
    critical: openFindings.filter((f) => f.severity === 'critical').length,
    high: openFindings.filter((f) => f.severity === 'high').length,
    medium: openFindings.filter((f) => f.severity === 'medium').length,
    low: openFindings.filter((f) => f.severity === 'low').length,
  };

  // Pillar scores: prefer fine-grained categoryScores from raw_json
  // (matches the existing audit detail page). Fall back to the module
  // helper so a brand-identity-only audit still gets a radar chart.
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

  const hideBenchmarks = (audit as any).audit_type === 'brand_identity' || selection?.kind === 'brand';

  // ── Derived data for the new rows ─────────────────────
  // Row 2 cards. Prefer fine-grained categoryScores when available
  // (24 categories), otherwise fall back to the six pillar scores so
  // brand-identity audits still get a coherent grid. We surface six
  // cards either way: with categoryScores, six worst-scoring ones; with
  // pillars, all six pillars in pillar order.
  const row2Cards: Array<{ name: string; score: number; summary?: string }> =
    categoryScores.length > 0
      ? [...categoryScores].sort((a, b) => a.score - b.score).slice(0, 6)
          .map((c) => ({ name: c.name, score: c.score, summary: c.summary }))
      : pillarScores.map((p) => ({ name: p.name, score: p.score }));

  // Priority recommendations: prefer report.raw_json.topRecommendations,
  // fall back to key_recommendation, then to the top 3 critical/high
  // findings' recommendation field. Never fabricate — show a clean empty
  // state if there is genuinely nothing to recommend.
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

  // Alert / executive summary slot. If critical issues exist, lead with
  // them; otherwise show the human-written executive summary if present.
  const alertCritical = severityCounts.critical > 0;
  const execSummary = (report.executive_summary || '').trim();

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
                {/* Destructive option intentionally disabled: no DELETE
                    endpoint exists for audits today, and silently dropping
                    rows from the client would leave reports/findings/
                    storage orphaned. */}
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

      {/* ── Alert / executive summary slot ──────────────────
          Surface a single high-signal message at the top of the
          workspace: a critical-issues alert when applicable, otherwise
          the report's executive summary, otherwise a neutral status
          line. Never fabricated. Full-width so it acts as a banner. */}
      <AlertOrSummary
        critical={severityCounts.critical}
        execSummary={execSummary}
        overallScore={overallScore}
        latestAuditId={audit.id}
        completedAt={audit.completed_at || audit.created_at}
      />

      {/* ── Row 1: Brand Health Score · Score Over Time · Heuristic Breakdown ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Brand Health Score — score-first card */}
        <DashboardCard
          title="Brand Health Score"
          subtitle="Latest audit"
          rightLabel={audit.completed_at ? formatDate(audit.completed_at) : null}
        >
          <div className="flex flex-col items-center justify-center py-4">
            <ScoreRing score={overallScore} size={140} strokeWidth={9} />
            <p className="text-[11px] mt-2" style={{ color: 'var(--m-muted)' }}>/100</p>
            <span
              className="text-xs font-medium mt-2 px-3 py-0.5 rounded-full"
              style={{
                color: overallScore >= 70 ? 'var(--ok)' : overallScore >= 40 ? 'var(--warn)' : 'var(--severe)',
                background: `color-mix(in srgb, ${overallScore >= 70 ? 'var(--ok)' : overallScore >= 40 ? 'var(--warn)' : 'var(--severe)'} 10%, transparent)`,
              }}
            >
              {overallScore >= 70 ? 'Healthy' : overallScore >= 40 ? 'Needs work' : 'At risk'}
            </span>
          </div>
        </DashboardCard>

        {/* Score Over Time */}
        <DashboardCard
          title="Score Over Time"
          subtitle={scoreTrend.length >= 2 ? `${scoreTrend.length} audits` : 'Trend will appear after the next audit'}
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

        {/* Heuristic Breakdown — radar with hover-revealed labels */}
        <DashboardCard
          title="Heuristic Breakdown"
          subtitle={pillarScores.length >= 3 ? 'Hover a point for the category' : 'Not enough data for radar'}
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

      {/* ── Row 2: Category cards (up to 6, score-first) ────
          A row of compact category cards keyed off real category or
          pillar data. Score leads; the full category name is shown as
          a short label below and is also reachable as a `title=` on
          the card itself so keyboard / screen-reader users get the
          information that the visual layout abbreviates. */}
      {row2Cards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {row2Cards.map((c) => (
            <CategoryScoreCard
              key={c.name}
              name={c.name}
              score={c.score}
              auditId={audit.id}
              summary={c.summary}
            />
          ))}
        </div>
      )}

      {/* ── Row 3: Issues by Importance · Priority Recommendations · Checkpoint Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <IssuesByImportance
          severityCounts={severityCounts}
          onCardClick={handleStatCardClick}
        />
        <PriorityRecommendations
          recs={priorityRecs}
          findings={openFindings}
          auditId={audit.id}
        />
        <CheckpointHealthCard
          categoryScores={categoryScores}
          pillarScores={pillarScores}
          findings={findings}
        />
      </div>

      {/* ── Benchmarks (preserved for sites; hidden for brand audits) ── */}
      {!hideBenchmarks && competitors && competitors.length > 0 && (
        <BenchmarksSection
          overallScore={overallScore}
          pillarScores={pillarScores}
          competitors={competitors}
          detecting={detectingCompetitors}
          onBenchmark={handleBenchmark}
        />
      )}

      {/* ── Quick links into Find / Fix / Track ───────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <QuickLink
          href="/dashboard/find"
          title="Find"
          subtitle="Identify issues"
          body={severityCounts.critical + severityCounts.high > 0
            ? `${severityCounts.critical + severityCounts.high} high-impact issue${severityCounts.critical + severityCounts.high === 1 ? '' : 's'} waiting to be triaged.`
            : 'See every open issue, ranked by impact on your score.'}
          icon={Search}
          accent="severe"
        />
        <QuickLink
          href="/dashboard/fix"
          title="Fix"
          subtitle="Take action"
          body="Work through recommended fixes with copy-paste guidance and snippets."
          icon={Wrench}
          accent="warn"
        />
        <QuickLink
          href="/dashboard/track"
          title="Track"
          subtitle="Monitor improvement"
          body="Watch your Brand Health Score move as you ship fixes over time."
          icon={LineChart}
          accent="ok"
        />
      </div>

      {/* ── Row 4: Audit history ──────────────────────────
          Label always matches what we actually render. If the brand has
          more than `HISTORY_PREVIEW` audits we collapse and let the
          user expand inline rather than silently lying about the count. */}
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

type QuickLinkAccent = 'severe' | 'warn' | 'ok';

function QuickLink({
  href,
  title,
  subtitle,
  body,
  icon: Icon,
  accent,
}: {
  href: string;
  title: string;
  subtitle: string;
  body: string;
  icon: React.ElementType;
  accent: QuickLinkAccent;
}) {
  // Map accent to a CSS variable so the cards stay theme-aware.
  const accentVar =
    accent === 'severe' ? 'var(--severe)' :
    accent === 'warn' ? 'var(--warn)' : 'var(--ok)';
  return (
    <Link
      href={href}
      className="group rounded-xl p-4 transition-all hover:shadow-sm flex flex-col gap-2 relative overflow-hidden"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--rule)',
        // Tinted left edge — readable color signal without flooding the card.
        borderLeft: `3px solid ${accentVar}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: `color-mix(in srgb, ${accentVar} 12%, transparent)`,
              color: accentVar,
            }}
          >
            <Icon size={13} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{title}</p>
            <p
              className="text-[10px] font-medium uppercase tracking-wide leading-tight mt-0.5"
              style={{ color: accentVar }}
            >
              {subtitle}
            </p>
          </div>
        </div>
        <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--m-muted)' }} />
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{body}</p>
    </Link>
  );
}

/* ── Reusable dashboard card wrapper ─────────────────── */
function DashboardCard({
  title,
  subtitle,
  rightLabel,
  children,
}: {
  title: string;
  subtitle?: string | null;
  rightLabel?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{title}</h3>
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

/* ── Row 2 — single category score card ──────────────── */
function CategoryScoreCard({
  name,
  score,
  auditId,
  summary,
}: {
  name: string;
  score: number;
  auditId: string;
  summary?: string;
}) {
  const color =
    score >= 70 ? 'var(--ok)' :
    score >= 40 ? 'var(--warn)' : 'var(--severe)';
  return (
    <Link
      href={`/dashboard/audits/${auditId}?tab=findings`}
      title={summary ? `${name} — ${summary}` : name}
      aria-label={`${name}: ${score} out of 100`}
      className="group rounded-xl p-3 transition-all hover:shadow-sm flex flex-col gap-1.5 relative overflow-hidden"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--rule)',
        borderTop: `3px solid ${color}`,
      }}
    >
      <p className="text-2xl font-semibold tabular-nums leading-none" style={{ color }}>
        {Math.round(score)}
      </p>
      <p
        className="text-[11px] font-medium leading-tight line-clamp-2"
        style={{ color: 'var(--ink)' }}
      >
        {name}
      </p>
      <p className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--m-muted)' }}>
        /100
      </p>
    </Link>
  );
}

/* ── Row 3 — Issues by importance ────────────────────── */
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
    { key: 'medium', label: 'Medium', count: severityCounts.medium, colorVar: '--warn' },
    { key: 'low', label: 'Low', count: severityCounts.low, colorVar: '--ok' },
  ];
  return (
    <DashboardCard
      title="Issues by importance"
      subtitle={total === 0 ? 'No open issues — nice.' : `${total} open issue${total === 1 ? '' : 's'}`}
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
        <div className="space-y-1.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => onCardClick?.(r.key)}
                className="w-full text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.03]"
                aria-label={`${r.count} ${r.label.toLowerCase()} severity issues`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: `var(${r.colorVar})` }}
                    />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{r.label}</span>
                  </div>
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: `var(${r.colorVar})` }}>
                    {r.count}
                  </span>
                </div>
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: 'var(--paper-2)' }}
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: `var(${r.colorVar})` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
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
  // Prefer text recs; if we fell back to finding recommendations, surface
  // the matching finding title for context.
  const topFindings = findings
    .filter((f) => (f.severity === 'critical' || f.severity === 'high') && f.recommendation)
    .slice(0, 3);

  return (
    <DashboardCard
      title="Priority recommendations"
      subtitle={recs.length > 0 ? `Top ${recs.length} action${recs.length === 1 ? '' : 's'}` : 'Nothing flagged'}
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

/* ── Row 3 — Checkpoint health list ──────────────────── */
function CheckpointHealthCard({
  categoryScores,
  pillarScores,
  findings,
}: {
  categoryScores: Array<{ name: string; score: number; summary: string }>;
  pillarScores: Array<{ name: string; score: number }>;
  findings: AuditFinding[];
}) {
  // Compact, list-style checkpoint health. Uses categoryScores when
  // available (24 categories) and falls back to pillarScores. For each
  // category we report pass / fail counts derived from open findings —
  // exactly the same calculation as the audit-detail Checkpoint Health
  // section, just rendered compactly so it fits a single dashboard cell.
  const rows = categoryScores.length > 0
    ? categoryScores.map((c) => {
        const checkpoints = CHECKPOINT_LABELS[c.name] || [];
        const total = checkpoints.length || 4;
        const words = c.name.toLowerCase().split(/[&,\s]+/).filter((w) => w.length > 3);
        const fails = Math.min(
          findings.filter((f) => {
            if (f.dismissed || f.status === 'fixed') return false;
            const text = `${f.title} ${f.description}`.toLowerCase();
            return words.some((w) => text.includes(w));
          }).length,
          total,
        );
        return { name: c.name, score: c.score, pass: total - fails, fail: fails, total };
      })
    : pillarScores.map((p) => ({ name: p.name, score: p.score, pass: -1, fail: -1, total: 0 }));

  // Show the worst-scoring 6 to keep the cell scannable.
  const top = [...rows].sort((a, b) => a.score - b.score).slice(0, 6);
  const totalCheckpoints = rows.reduce((sum, r) => sum + (r.total || 4), 0);

  return (
    <DashboardCard
      title="Checkpoint health"
      subtitle={totalCheckpoints > 0 ? `${totalCheckpoints} checkpoints across ${rows.length} categories` : `${rows.length} pillars`}
    >
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <ListChecks size={20} style={{ color: 'var(--m-muted)', opacity: 0.5 }} className="mb-2" />
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            Checkpoint data will appear after the next audit.
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {top.map((r) => {
            const color =
              r.score >= 70 ? 'var(--ok)' :
              r.score >= 40 ? 'var(--warn)' : 'var(--severe)';
            return (
              <li
                key={r.name}
                className="flex items-center gap-2 px-1.5 py-1.5 rounded-md"
                title={r.name}
              >
                <span
                  className="text-[11px] font-semibold tabular-nums w-7 text-right flex-shrink-0"
                  style={{ color }}
                >
                  {Math.round(r.score)}
                </span>
                <span
                  className="text-[11px] flex-1 min-w-0 truncate"
                  style={{ color: 'var(--ink)' }}
                >
                  {r.name}
                </span>
                {r.fail >= 0 && r.fail > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--severe)' }}>
                    {r.fail} fail
                  </span>
                )}
                {r.pass >= 0 && r.fail === 0 && (
                  <span className="text-[10px] font-semibold tabular-nums flex-shrink-0" style={{ color: 'var(--ok)' }}>
                    {r.pass} pass
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
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

  // Neutral status line — no fabricated copy.
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
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
