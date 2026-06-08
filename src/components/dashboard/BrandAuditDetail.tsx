'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Palette,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  FileSearch,
  Loader2,
  Globe,
  Trash2,
  RefreshCw,
  MoreVertical,
  Share2,
  LinkIcon,
  ChevronDown,
  ChevronRight,
  Eye,
  MessageSquare,
  PenTool,
  ShieldCheck,
  Target,
  BarChart3,
  Type,
  Layers,
  Lightbulb,
  TrendingUp,
  X,
  Download,
  Search,
  Check,
  Copy,
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ScoreRing from '@/components/ui/ScoreRing';
import { HeuristicRadarChart } from '@/components/dashboard/AuditDashboard';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { AuditWithReport, AuditFinding, FindingSeverity, Report } from '@/types/database';
import { BRAND_AUDIT_CATEGORIES } from '@/lib/brand-audit-modules';
import clsx from 'clsx';

/* ── Types ──────────────────────────────────────────────── */

interface BrandCategoryScore {
  slug: string;
  name: string;
  score: number;
  summary: string;
}

interface BrandReportJson {
  type: 'brand_identity';
  categoryResults: BrandCategoryScore[];
  topRecommendations: string[];
  filesAnalyzed: number;
  brandName: string;
}

/* ── Category icons & colors ────────────────────────────── */

/* Module tint colors — matches the website audit MODULE_TINTS pattern */
const MODULE_TINTS = [
  { dot: '#6366F1', bg: 'rgba(99, 102, 241, 0.04)',  border: 'rgba(99, 102, 241, 0.12)' },  // Visual Consistency — indigo
  { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.04)',  border: 'rgba(236, 72, 153, 0.12)' },  // Tone of Voice — pink
  { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.04)',  border: 'rgba(16, 185, 129, 0.12)' },  // Professionalism — emerald
  { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.04)',  border: 'rgba(245, 158, 11, 0.12)' },  // Value Proposition — amber
  { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.04)',  border: 'rgba(59, 130, 246, 0.12)' },  // Structure — blue
  { dot: '#14B8A6', bg: 'rgba(20, 184, 166, 0.04)',  border: 'rgba(20, 184, 166, 0.12)' },  // Wording — teal
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  visual_consistency:      Eye,
  tone_of_voice:           MessageSquare,
  professionalism:         ShieldCheck,
  value_proposition:       Target,
  structure_organization:  Layers,
  wording_quality:         Type,
};

const CATEGORY_SLUG_ORDER = [
  'visual_consistency', 'tone_of_voice', 'professionalism', 'value_proposition',
  'structure_organization', 'wording_quality',
];

function getCategoryIcon(slug: string): React.ElementType {
  return CATEGORY_ICONS[slug] || Sparkles;
}

function getCategoryTint(slug: string) {
  const idx = CATEGORY_SLUG_ORDER.indexOf(slug);
  return MODULE_TINTS[idx >= 0 ? idx : 0];
}

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateString));
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-ok';
  if (s >= 40) return 'text-warn';
  return 'text-severe';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-ok/10';
  if (s >= 40) return 'bg-warn/10';
  return 'bg-severe/10';
}

function scoreBarColor(s: number) {
  if (s >= 70) return 'bg-ok';
  if (s >= 40) return 'bg-warn';
  return 'bg-severe';
}

const SEVERITY_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; impactBg: string }> = {
  critical: { label: 'Critical', dot: 'bg-severe', text: 'text-severe', bg: 'bg-paper', border: 'border-rule/60', impactBg: 'bg-severe/5' },
  high:     { label: 'High',     dot: 'bg-warn',   text: 'text-warn',   bg: 'bg-paper', border: 'border-rule/60', impactBg: 'bg-warn/5' },
  medium:   { label: 'Medium',   dot: 'bg-signal',  text: 'text-signal',  bg: 'bg-paper', border: 'border-rule/60', impactBg: 'bg-signal/5' },
  low:      { label: 'Low',      dot: 'bg-ok',     text: 'text-ok',     bg: 'bg-paper', border: 'border-rule/60', impactBg: 'bg-ok/5' },
};

const statusMeta: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment',       description: 'Complete payment to start the audit.',           icon: Clock },
  payment_received:  { label: 'Processing...',           description: 'Your audit has started processing.',              icon: Zap },
  crawling:          { label: 'Extracting files...',     description: 'Reading and extracting content from your brand files.', icon: FileSearch },
  analysing:         { label: 'Analyzing brand...',      description: 'AI is evaluating your brand across 6 categories.', icon: Sparkles },
  generating_report: { label: 'Generating report...',    description: 'Building your comprehensive brand report.',       icon: BarChart3 },
  completed:         { label: 'Completed',               description: 'Your brand audit is complete.',                   icon: CheckCircle2 },
  completed_with_warnings: { label: 'Completed',        description: 'Your brand audit is complete (with warnings).',   icon: CheckCircle2 },
  failed:            { label: 'Failed',                  description: 'Something went wrong during processing.',         icon: AlertTriangle },
};

/* ── Finding Card ────────────────────────────────────────── */
// Matches the FindingCard structure from the website audit page for visual consistency.

function BrandFindingCard({ finding, tintColor, onScoreUpdate }: { finding: AuditFinding; tintColor?: string; onScoreUpdate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(finding.status || 'open');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(finding.dismissed || false);
  const [showDismissForm, setShowDismissForm] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.medium;
  const sourceFile = finding.page_url; // page_url reused for source file in brand audits

  const handleStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    const previousStatus = status;
    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus as any);
        const involvesFixed = newStatus === 'fixed' || previousStatus === 'fixed';
        if (involvesFixed && onScoreUpdate) onScoreUpdate();
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
    setStatusUpdating(false);
  };

  const handleDismiss = async () => {
    if (!dismissReason.trim()) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/findings/${finding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true, dismissal_reason: dismissReason }),
      });
      if (res.ok) {
        setDismissed(true);
        setShowDismissForm(false);
        if (onScoreUpdate) onScoreUpdate();
      }
    } catch {}
    setStatusUpdating(false);
  };

  if (dismissed) {
    return (
      <div className="rounded-xl border border-rule/20 bg-paper-2/30 p-3 opacity-60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rule flex-shrink-0" />
          <span className="text-xs text-m-muted line-through flex-1">{finding.title}</span>
          <span className="text-[11px] text-m-muted bg-paper-2 px-2 py-0.5 rounded-full">Dismissed</span>
        </div>
        {finding.dismissal_reason && (
          <p className="text-[11px] text-m-muted mt-1 ml-4">{finding.dismissal_reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${sev.border} ${sev.bg} shadow-sm overflow-hidden transition-all`}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/[0.02] transition-colors"
        aria-expanded={open}
      >
        <div className={`w-2 h-2 rounded-full ${sev.dot} flex-shrink-0 mt-1.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[11px] font-medium uppercase tracking-wider ${sev.text}`}>
              {sev.label}
            </span>
            {sourceFile && (
              <span className="text-[11px] text-m-muted truncate max-w-[200px]">{sourceFile}</span>
            )}
          </div>
          <h4 className="font-medium text-ink text-sm leading-snug">{finding.title}</h4>
        </div>
        <ChevronDown
          size={16}
          className={clsx('text-m-muted flex-shrink-0 mt-1 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {/* Expanded detail — 3-panel layout: Issue / Fix / Impact */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-rule/20 mx-4 space-y-3">
          {/* 3-Panel Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-rule/30 overflow-hidden mt-3">
            {/* Panel 1: Issue */}
            <div className="p-4 border-b md:border-b-0 md:border-r border-rule/30">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={13} className={sev.text} />
                <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">Issue</p>
              </div>
              <p className="text-m-muted text-[13px] leading-[1.65]">{finding.description}</p>
            </div>
            {/* Panel 2: Fix */}
            <div className="p-4 border-b md:border-b-0 md:border-r border-rule/30 bg-paper-2/30">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={13} style={tintColor ? { color: tintColor } : undefined} className={tintColor ? '' : 'text-signal'} />
                <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">How to fix</p>
              </div>
              <p className="text-[13px] text-m-muted leading-[1.65]">{finding.recommendation || 'No specific recommendation provided.'}</p>
            </div>
            {/* Panel 3: Impact */}
            <div className="p-4 bg-emerald-500/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={13} className="text-emerald-500" />
                <p className="text-[11px] font-mono font-medium text-ink tracking-[0.06em] uppercase">Impact</p>
              </div>
              <p className="text-[13px] text-emerald-700 leading-[1.65]">{finding.estimated_impact || 'Fixing this will improve brand consistency and professional perception.'}</p>
            </div>
          </div>

          {/* Status + Dismiss controls */}
          <div className="flex items-center gap-2 pt-1 border-t border-rule/20 mt-3">
            <span className="text-[11px] text-m-muted mr-1">Status:</span>
            {['open', 'in_progress', 'fixed'].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={statusUpdating}
                className={clsx(
                  'text-[11px] font-medium px-2 py-1 rounded-md transition-colors capitalize',
                  status === s
                    ? s === 'fixed'
                      ? 'bg-emerald-500/15 text-ok border border-emerald-500/20'
                      : s === 'in_progress'
                        ? 'bg-blue-500/15 text-signal border border-blue-500/20'
                        : 'bg-paper-2 text-ink border border-rule/40'
                    : 'text-m-muted hover:bg-paper-2',
                )}
              >
                {s === 'in_progress' ? 'In Progress' : s === 'fixed' ? 'Fixed' : 'Open'}
              </button>
            ))}
            <div className="flex-1" />
            {!showDismissForm ? (
              <button
                onClick={() => setShowDismissForm(true)}
                className="text-[11px] text-m-muted hover:text-red-500 transition-colors"
              >
                Dismiss
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="Reason..."
                  className="text-[11px] px-2 py-1 rounded-md border border-rule/40 bg-paper-2 text-ink w-40"
                  onKeyDown={(e) => e.key === 'Enter' && handleDismiss()}
                />
                <button onClick={handleDismiss} disabled={!dismissReason.trim() || statusUpdating} className="text-[11px] font-medium text-red-500 hover:text-red-600 disabled:opacity-40">
                  Confirm
                </button>
                <button onClick={() => setShowDismissForm(false)} className="text-m-muted hover:text-ink">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Heuristic Breakdown Card ───────────────────────────── */

function HeuristicBreakdownCard({ categoryScores }: { categoryScores: BrandCategoryScore[] }) {
  const [open, setOpen] = useState(false);
  const pillarScores = categoryScores.map(c => ({ name: c.name, score: c.score }));

  return (
    <div className="rounded-xl border border-rule bg-card shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-black/[0.02] transition-colors"
      >
        <h3 className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Heuristic breakdown</h3>
        {open
          ? <ChevronDown size={16} style={{ color: 'var(--m-muted)' }} />
          : <ChevronRight size={16} style={{ color: 'var(--m-muted)' }} />
        }
      </button>
      {open && (
        <div className="px-5 pb-5">
          <HeuristicRadarChart pillarScores={pillarScores} />
        </div>
      )}
    </div>
  );
}

/* ── Category Section ────────────────────────────────────── */

function CategorySection({
  category,
  categoryIndex,
  findings,
  onScoreUpdate,
}: {
  category: BrandCategoryScore;
  categoryIndex: number;
  findings: AuditFinding[];
  onScoreUpdate?: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const Icon = getCategoryIcon(category.slug);
  const tint = getCategoryTint(category.slug);
  const catDef = BRAND_AUDIT_CATEGORIES.find(c => c.slug === category.slug);
  const totalFindings = findings.length;

  const sorted = [...findings].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  return (
    <div className="mb-6 rounded-xl overflow-hidden" style={{ background: tint.bg, border: `1px solid ${tint.border}` }}>
      {/* Module header — clickable toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity"
      >
        <Icon size={18} className="flex-shrink-0" style={{ color: tint.dot }} />
        <div className="flex-1 min-w-0">
          <h2 className="font-sans font-medium text-[15px] text-ink truncate">{category.name}</h2>
          <p className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">
            {catDef?.description || ''}{totalFindings > 0 ? ` · ${totalFindings} finding${totalFindings !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0 mr-2">
          <p className={clsx('font-mono text-[22px] font-medium', scoreColor(category.score))}>{category.score}</p>
          <p className="font-mono text-[10px] text-m-muted tracking-[0.06em] uppercase">/100</p>
        </div>
        <ChevronDown size={16} className={clsx('text-m-muted flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${tint.border}` }}>
          {/* Score bar + summary */}
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${tint.border}` }}>
            <div className="w-full h-[3px] rounded-full mb-3" style={{ background: `${tint.dot}15` }}>
              <div className="h-full rounded-full" style={{ width: `${category.score}%`, background: tint.dot, opacity: 0.6 }} />
            </div>
            {category.summary && (
              <p className="text-sm text-ink/80 leading-relaxed">{category.summary}</p>
            )}
          </div>

          {/* Findings */}
          {sorted.length > 0 ? (
            <div className="px-5 py-4 space-y-2">
              {sorted.map((f) => (
                <BrandFindingCard key={f.id} finding={f} tintColor={tint.dot} onScoreUpdate={onScoreUpdate} />
              ))}
            </div>
          ) : (
            <div className="px-5 py-4">
              <p className="text-xs text-m-muted">No specific issues found in this category.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */

export default function BrandAuditDetail({
  auditId,
  user,
}: {
  auditId: string;
  user: { id: string };
}) {
  const router = useRouter();
  const { workspaceSlug } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const [audit, setAudit] = useState<AuditWithReport | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [brandName, setBrandName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Tabs removed — modules shown directly with tinted collapsible sections
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch audit data ──
  const fetchAuditDetail = useCallback(
    async (silent = false) => {
      try {
        const supabase = createBrowserSupabase();

        const { data: auditData, error: auditError } = await supabase
          .from('audits')
          .select('*')
          .eq('id', auditId)
          .single();

        if (auditError) throw auditError;
        if (!auditData) throw new Error('Audit not found');

        // Fetch brand name
        if ((auditData as any).brand_identity_id) {
          const { data: brand } = await supabase
            .from('brand_identities')
            .select('name')
            .eq('id', (auditData as any).brand_identity_id)
            .single();
          if (brand) setBrandName((brand as any).name);
        }

        let reportData = null;
        if (auditData.status === 'completed' || auditData.status === 'completed_with_warnings') {
          const { data: r } = await supabase
            .from('reports')
            .select('*')
            .eq('audit_id', auditId)
            .maybeSingle();
          reportData = r;
        }

        const combined = {
          ...auditData,
          report: reportData || null,
          payment: null,
        } as AuditWithReport;

        setAudit(combined);

        if (auditData.status === 'completed' || auditData.status === 'completed_with_warnings') {
          const { data: findingsData } = await supabase
            .from('audit_findings')
            .select('*')
            .eq('audit_id', auditId)
            .order('severity', { ascending: true })
            .order('sort_order', { ascending: true });
          setFindings(findingsData || []);
        }

        if (!silent) setLoading(false);
        return auditData.status;
      } catch (err) {
        console.error('[BrandAuditDetail] Error:', err);
        if (!silent) {
          setError('Failed to load audit details');
          setLoading(false);
        }
        return null;
      }
    },
    [auditId],
  );

  useEffect(() => { fetchAuditDetail(); }, [fetchAuditDetail]);

  // Polling for in-progress audits
  useEffect(() => {
    if (!audit) return;
    const inProgress = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
    if (!inProgress) return;
    const iv = setInterval(async () => {
      const s = await fetchAuditDetail(true);
      if (s === 'completed' || s === 'completed_with_warnings' || s === 'failed') clearInterval(iv);
    }, 5000);
    return () => clearInterval(iv);
  }, [audit?.status, fetchAuditDetail]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // ── Parsed report data ──
  const reportJson = useMemo<BrandReportJson | null>(() => {
    if (!audit?.report?.raw_json) return null;
    const rj = audit.report.raw_json as any;
    if (rj.type !== 'brand_identity') return null;
    return rj as BrandReportJson;
  }, [audit]);

  const categoryScores = useMemo(() => {
    if (!reportJson?.categoryResults) return [];
    return reportJson.categoryResults;
  }, [reportJson]);

  // Map findings to categories by matching the page_url field (source file) or
  // by sorting order — findings are stored with sort_order matching category order
  const findingsByCategory = useMemo(() => {
    const map: Record<string, AuditFinding[]> = {};
    for (const cat of BRAND_AUDIT_CATEGORIES) map[cat.slug] = [];

    // Findings are stored in order: all findings for category 0, then category 1, etc.
    // We reconstruct the mapping by matching against category results order
    if (categoryScores.length > 0) {
      let catIdx = 0;
      let countInCat = 0;
      const catCounts: number[] = [];

      // Estimate findings per category by examining the data
      // Since findings have sort_order, we use the gap detection approach
      // Actually simpler: just distribute findings by checking title patterns
      // For now, assign all findings flat and let them be in the "all" tab
      for (const f of findings) {
        // Try to match by examining which category this finding likely belongs to
        // Use sort_order ranges: each category's findings are contiguous
        let assigned = false;
        for (const cat of categoryScores) {
          const catDef = BRAND_AUDIT_CATEGORIES.find(c => c.slug === cat.slug);
          if (!catDef) continue;
          // Check if finding title/description mentions category keywords
          // This is a best-effort approach
          if (!assigned) {
            // Put in first matching or the catch-all
          }
        }
        // Fallback: distribute by sort_order proportionally
        if (!assigned && categoryScores.length > 0) {
          const catIndex = Math.min(
            Math.floor((findings.indexOf(f) / Math.max(findings.length, 1)) * categoryScores.length),
            categoryScores.length - 1
          );
          const slug = categoryScores[catIndex]?.slug;
          if (slug && map[slug]) {
            map[slug].push(f);
          }
        }
      }
    }

    return map;
  }, [findings, categoryScores]);

  // ── Handlers ──
  const handleDelete = async () => {
    if (!audit) return;
    if (!confirm('Delete this audit? Your payment will be kept as a credit for a future audit.')) return;
    setDeleting(true);
    try {
      const supabase = createBrowserSupabase();
      await supabase.from('audits').delete().eq('id', auditId);
      router.push(`${dashPrefix}/audits?type=brand_identity`);
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete audit');
      setDeleting(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');
      await fetchAuditDetail();
    } catch (err) {
      console.error('Error retrying:', err);
      alert(err instanceof Error ? err.message : 'Failed to retry');
    } finally {
      setRetrying(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/restart`, { method: 'POST' });
      if (!res.ok) throw new Error('Restart failed');
      await fetchAuditDetail();
    } catch (err) {
      console.error('Error restarting:', err);
      alert('Failed to restart');
    } finally {
      setRestarting(false);
    }
  };

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/share`, { method: 'POST' });
      const data = await res.json();
      if (data.shareUrl || data.share_url) {
        const url = data.shareUrl || data.share_url;
        setShareUrl(url);
        navigator.clipboard?.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 3000);
      }
    } catch {} finally { setShareLoading(false); }
  };

  // toggleCategory removed — each CategorySection manages its own expanded state

  // ── Render ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="h-5 w-20 bg-paper-2 rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-paper-2 rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-paper-2 rounded animate-pulse mb-8" />
        <div className="h-48 bg-paper-2 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Link href={`${dashPrefix}/audits?type=brand_identity`} className="inline-flex items-center gap-1.5 text-sm text-m-muted hover:text-ink transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Audits
        </Link>
        <Card>
          <div className="text-center py-8">
            <AlertTriangle size={24} className="text-red-500 mx-auto mb-3" />
            <p className="font-medium text-ink mb-1">Error loading audit</p>
            <p className="text-sm text-m-muted">{error || 'Audit not found'}</p>
          </div>
        </Card>
      </div>
    );
  }

  const isCompleted = audit.status === 'completed' || audit.status === 'completed_with_warnings';
  const isFailed = audit.status === 'failed';
  const isInProgress = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
  // Show retry if stuck for more than 5 minutes in a processing state
  const stuckMinutes = isInProgress && audit.updated_at
    ? (Date.now() - new Date(audit.updated_at).getTime()) / 60_000
    : 0;
  const isStuck = isInProgress && stuckMinutes > 5;
  const canRetry = isFailed || isStuck;
  const meta = statusMeta[audit.status] || statusMeta.pending_payment;
  const StatusIcon = meta.icon;
  const overallScore = audit.report?.overall_score ?? null;
  const report = audit.report;
  const displayName = brandName || reportJson?.brandName || 'Brand Audit';

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Back */}
      <Link
        href={`${dashPrefix}/audits?type=brand_identity`}
        className="inline-flex items-center gap-1.5 text-sm text-m-muted hover:text-ink transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back to Brand Audits
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Palette size={18} className="text-brand flex-shrink-0" />
            <h1 className="text-2xl font-medium font-sans text-ink truncate">{displayName}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-m-muted text-sm">{formatDate(audit.created_at)}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              <Palette size={10} />
              Brand Identity
            </span>
          </div>
        </div>

        {/* Menu */}
        <div className="flex items-center gap-2 flex-shrink-0 relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-m-muted hover:text-ink hover:bg-paper-2 transition-colors"
            aria-label="Audit settings"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-[100] w-52 rounded-xl border border-rule/40 bg-paper shadow-xl shadow-black/20 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {isCompleted && (
                <>
                  <button
                    onClick={() => { handleShare(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors"
                  >
                    <Share2 size={13} className="text-m-muted" />
                    {shareUrl ? 'Copy share link' : 'Create share link'}
                  </button>
                  <div className="my-1.5 h-px bg-rule/30" />
                </>
              )}
              {audit.brand_identity_id && (
                <Link
                  href={`${dashPrefix}/brand-dna`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors"
                >
                  <RefreshCw size={13} className="text-m-muted" />
                  Re-audit this brand
                  <span className="ml-auto text-[11px] text-m-muted">1 credit</span>
                </Link>
              )}
              {canRetry && (
                <button
                  onClick={() => { handleRetry(); setMenuOpen(false); }}
                  disabled={retrying}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors disabled:opacity-50"
                >
                  <Zap size={13} className="text-m-muted" />
                  {isStuck ? 'Restart stuck audit' : 'Retry audit'}
                </button>
              )}
              <button
                onClick={() => { handleRestart(); setMenuOpen(false); }}
                disabled={restarting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-ink hover:bg-paper-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className="text-m-muted" />
                Restart audit
              </button>
              <div className="my-1.5 h-px bg-rule/30" />
              <button
                onClick={() => { handleDelete(); setMenuOpen(false); }}
                disabled={deleting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                Delete audit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── In Progress ──────────────────────────────────── */}
      {isInProgress && (
        <Card className="mb-6">
          <div className="flex items-center gap-3 mb-5">
            <StatusIcon size={20} className="text-brand" />
            <div>
              <p className="font-medium text-ink">{meta.label}</p>
              <p className="text-sm text-m-muted">{meta.description}</p>
            </div>
            <Loader2 size={16} className="text-brand animate-spin ml-auto" />
          </div>
          <div className="flex items-center gap-1">
            {['payment_received', 'crawling', 'analysing', 'generating_report'].map((step, idx) => {
              const currentIdx = ['payment_received', 'crawling', 'analysing', 'generating_report'].indexOf(audit.status);
              const isActive = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              const labels = ['Queued', 'Extracting', 'Analyzing', 'Report'];
              return (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={clsx(
                    'w-full h-2 rounded-full transition-colors',
                    isActive ? 'bg-brand' : 'bg-paper-2',
                    isCurrent && 'animate-pulse',
                  )} />
                  <p className={clsx('text-xs font-medium mt-1.5', isActive ? 'text-brand' : 'text-m-muted')}>
                    {labels[idx]}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-m-muted mt-4 text-center">This page updates automatically.</p>
        </Card>
      )}

      {/* ── Failed or Stuck ───────────────────────────────── */}
      {canRetry && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isFailed ? 'bg-red-50' : 'bg-yellow-50'}`}>
                <AlertTriangle size={20} className={isFailed ? 'text-red-500' : 'text-yellow-500'} />
              </div>
              <div>
                <p className="font-medium text-ink">{isFailed ? 'Audit failed' : 'Audit appears stuck'}</p>
                <p className="text-sm text-m-muted">
                  {isFailed
                    ? ((audit as any).crawl_error || 'An error occurred during processing.')
                    : `Processing hasn't progressed in ${Math.round(stuckMinutes)} minutes. You can restart it.`}
                </p>
              </div>
            </div>
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 text-sm font-medium bg-brand text-surface px-4 py-2 rounded-lg hover:brightness-110 disabled:opacity-50"
            >
              {retrying ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {isStuck ? 'Restart' : 'Retry'}
            </button>
          </div>
        </Card>
      )}

      {/* ── Completed: Report ────────────────────────────── */}
      {isCompleted && report && (
        <>
          {/* ── Hero Score Card (v2 editorial style matching website audit) ───── */}
          <div className="border border-rule overflow-hidden mb-6 bg-paper">
            <div className="p-6 sm:p-8">
              {/* Mobile: centered stack — Desktop: horizontal row */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Score ring */}
                <div className="flex-shrink-0">
                  <ScoreRing score={overallScore || 0} size={110} strokeWidth={7} />
                </div>

                {/* Score details */}
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                    <h2 className="font-sans text-[22px] text-ink font-medium tracking-[-0.01em]">{displayName}</h2>
                  </div>
                  <p className="font-mono text-[11px] text-m-muted tracking-[0.06em] uppercase mb-1">
                    {findings.length} findings · {categoryScores.length} categories
                  </p>

                  {/* Module mini-scores with colored dots */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                    {categoryScores.map((cat) => {
                      const tint = getCategoryTint(cat.slug);
                      return (
                        <div key={cat.slug} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tint.dot }} />
                          <span className="text-xs text-m-muted">{cat.name}</span>
                          <span className={clsx('text-xs font-medium', scoreColor(cat.score))}>{cat.score}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Severity counts in mono uppercase */}
                  {report.total_issues > 0 && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                      {(report.critical_count || 0) > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-severe">
                          <span className="w-2 h-2 rounded-full bg-severe" /> {report.critical_count} critical
                        </span>
                      )}
                      {(report.high_count || 0) > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.06em] uppercase text-warn">
                          <span className="w-2 h-2 rounded-full bg-warn" /> {report.high_count} high
                        </span>
                      )}
                      {((report.medium_count || 0) + (report.low_count || 0)) > 0 && (
                        <span className="text-[11px] font-mono text-m-muted tracking-[0.06em] uppercase">
                          {(report.medium_count || 0) + (report.low_count || 0)} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action strip */}
            <div className="border-t border-rule px-6 sm:px-8 py-4 flex flex-wrap gap-2.5">
              <a href={`/api/reports/${auditId}/pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors">
                <Download size={13} /> PDF
              </a>
              <a href={`/api/reports/${auditId}/docx`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors">
                <Download size={13} /> Word
              </a>
              {findings.length > 0 && (
                <button
                  onClick={() => {
                    // Build structured markdown from brand audit findings
                    const dateStr = new Date().toISOString().slice(0, 10);
                    const name = brandName || 'Brand';
                    const lines: string[] = [
                      `# ${name} — Brand DNA Audit Findings`,
                      ``,
                      `**Date:** ${audit.completed_at ? new Date(audit.completed_at).toLocaleDateString() : dateStr}`,
                      `**Score:** ${report.overall_score ?? '—'}/100`,
                      `**Findings:** ${findings.length}`,
                      ``,
                    ];

                    // Group findings by their brand category slug
                    for (const cat of categoryScores) {
                      const catFindings = findingsByCategory[cat.slug] || [];
                      if (catFindings.length === 0) continue;
                      lines.push(`## ${cat.name} — ${cat.score}/100`);
                      lines.push(``);
                      for (const f of catFindings) {
                        const sev = (f.severity || 'medium').toUpperCase();
                        lines.push(`### [${sev}] ${f.title}`);
                        if (f.description) lines.push(``, f.description);
                        if (f.recommendation) lines.push(``, `**Recommendation:** ${f.recommendation}`);
                        lines.push(``);
                      }
                    }

                    const md = lines.join('\n');
                    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `fixpath-brand-findings-${(brandName || 'brand').toLowerCase().replace(/\s+/g, '-')}-${dateStr}.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors"
                >
                  <Download size={13} /> Download all findings
                </button>
              )}
              {audit.brand_identity_id && (
                <Link
                  href={`${dashPrefix}/brand-dna`}
                  className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors"
                >
                  <RefreshCw size={13} /> Re-audit
                </Link>
              )}
              <button
                onClick={handleShare}
                disabled={shareLoading}
                className="flex items-center gap-2 border border-ink/20 text-ink text-[11px] font-mono tracking-[0.06em] uppercase px-4 py-2 rounded-lg hover:bg-paper-2 transition-colors disabled:opacity-50"
              >
                {shareCopied ? <><Check size={13} className="text-ok" /> Copied</> : <><Share2 size={13} /> Share</>}
              </button>
            </div>
          </div>

          {/* Share URL */}
          {shareUrl && (
            <p className="text-center text-[11px] text-m-muted mb-4">
              Share link: <span className="font-mono text-brand">{shareUrl}</span>
            </p>
          )}

          {/* Track progress tip */}
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-brand/5 border border-brand/20">
            <RefreshCw size={15} className="text-brand flex-shrink-0" />
            <p className="text-xs text-m-muted">
              <span className="font-medium text-ink">Track your progress</span> — update finding statuses as you fix them, dismiss false positives with a reason, then re-audit to compare your score.
            </p>
          </div>

          {/* Executive summary */}
          {report.executive_summary && (
            <Card className="mb-6">
              <p className="text-xs font-medium text-m-muted uppercase tracking-wider mb-2">Executive Summary</p>
              <p className="text-sm text-ink/80 leading-relaxed">{report.executive_summary}</p>
            </Card>
          )}

          {/* Heuristic Breakdown — radar chart of category scores */}
          {categoryScores.length >= 3 && (
            <HeuristicBreakdownCard categoryScores={categoryScores} />
          )}

          {/* Module sections with tinted backgrounds */}
          {categoryScores.map((cat, idx) => (
            <CategorySection
              key={cat.slug}
              category={cat}
              categoryIndex={idx}
              findings={findingsByCategory[cat.slug] || []}
              onScoreUpdate={() => fetchAuditDetail(true)}
            />
          ))}

          {/* AI transparency note */}
          <div className="mb-6 px-4 py-3 rounded-xl bg-paper-2/40 border border-rule/15">
            <p className="text-[11px] text-m-muted/70 leading-relaxed">
              <span className="font-medium text-m-muted">About this audit</span> — This report was generated by AI analysing your uploaded brand materials across {categoryScores.length} categories. It cannot test live web experiences or real user interactions. For brand compliance and legal copy, we recommend pairing these results with manual review. Dismiss any finding that doesn&apos;t apply to your context — the AI will learn from your feedback on re-audits.
            </p>
          </div>

        </>
      )}
    </div>
  );
}
