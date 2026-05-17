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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { AuditDashboardOverview } from '@/components/dashboard/AuditDashboard';
import {
  loadLatestAuditBundle,
  moduleScoresFromReport,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
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
      <div className="max-w-5xl mx-auto">
        <div className="h-8 w-64 bg-off rounded-lg animate-pulse mb-2" />
        <div className="h-4 w-40 bg-off rounded-md animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="h-56 bg-off rounded-xl animate-pulse" />
          <div className="h-56 bg-off rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-off rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  /* ── Empty state — no audit for the selected brand ────── */
  if (!bundle?.audit || !bundle.report) {
    return (
      <div className="max-w-5xl mx-auto">
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

  return (
    <div className="max-w-5xl mx-auto">
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

      {/* ── Dashboard: score, trend, severity cards, radar, benchmarks ── */}
      <AuditDashboardOverview
        overallScore={overallScore}
        scoreTrend={scoreTrend}
        severityCounts={severityCounts}
        findings={findings}
        pillarScores={pillarScores}
        productUrl={productUrl}
        latestAuditId={audit.id}
        competitors={competitors.length > 0 ? competitors : undefined}
        detecting={detectingCompetitors}
        onBenchmark={handleBenchmark}
        onStatCardClick={handleStatCardClick}
        hideBenchmarks={hideBenchmarks}
        defaultOpenHeuristic
        defaultOpenBenchmarks
      />

      {/* ── Quick links into Find / Fix / Track ─────────────
          Three operator stages, color-coded so the user reads the
          intent at a glance: red/severe = problems to identify,
          amber/warn = take action, green/ok = monitor improvement.
          Same hue family as the severity counts above to keep the
          page's visual grammar consistent. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 mt-6">
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

      {/* ── Audit history for this brand/site ─────────────
          Always show a label that matches what we actually render. If
          the brand has more than 8 audits we collapse to the latest 8
          but let the user expand inline rather than silently lying. */}
      {(() => {
        const HISTORY_PREVIEW = 8;
        const showingAll = showAllHistory || auditCount <= HISTORY_PREVIEW;
        const shownCount = showingAll ? auditCount : Math.min(HISTORY_PREVIEW, auditCount);
        const label = showingAll
          ? `${auditCount} total`
          : `Latest ${shownCount} of ${auditCount}`;
        return (
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-text" style={{ color: 'var(--ink)' }}>Audit history</h2>
            <div className="flex items-center gap-2">
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{label}</p>
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
        );
      })()}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}>
        <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
          {(showAllHistory ? bundle.history : bundle.history.slice(0, 8)).map((h) => {
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

export default function OverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto">
          <div className="h-8 w-64 bg-off rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-40 bg-off rounded-md animate-pulse mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-56 bg-off rounded-xl animate-pulse" />
            <div className="h-56 bg-off rounded-xl animate-pulse" />
          </div>
        </div>
      }
    >
      <OverviewInner />
    </Suspense>
  );
}
