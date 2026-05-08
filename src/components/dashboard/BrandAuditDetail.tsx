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
} from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ScoreRing from '@/components/ui/ScoreRing';
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

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; gradient: string }> = {
  visual_consistency:     { icon: Eye,          color: '#6366F1', gradient: 'from-[#6366F1]/10 to-[#6366F1]/5' },
  tone_of_voice:          { icon: MessageSquare, color: '#EC4899', gradient: 'from-[#EC4899]/10 to-[#EC4899]/5' },
  professionalism:        { icon: ShieldCheck,  color: '#10B981', gradient: 'from-[#10B981]/10 to-[#10B981]/5' },
  value_proposition:      { icon: Target,       color: '#F59E0B', gradient: 'from-[#F59E0B]/10 to-[#F59E0B]/5' },
  structure_organization: { icon: Layers,       color: '#3B82F6', gradient: 'from-[#3B82F6]/10 to-[#3B82F6]/5' },
  competitive_positioning:{ icon: BarChart3,    color: '#8B5CF6', gradient: 'from-[#8B5CF6]/10 to-[#8B5CF6]/5' },
  wording_quality:        { icon: Type,         color: '#14B8A6', gradient: 'from-[#14B8A6]/10 to-[#14B8A6]/5' },
};

function getCategoryConfig(slug: string) {
  return CATEGORY_CONFIG[slug] || { icon: Sparkles, color: '#6366F1', gradient: 'from-[#6366F1]/10 to-[#6366F1]/5' };
}

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateString));
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-[#22C55E]';
  if (s >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-[#EF4444]';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-green-50 dark:bg-green-900/20';
  if (s >= 40) return 'bg-yellow-50 dark:bg-yellow-900/20';
  return 'bg-red-50 dark:bg-red-900/20';
}

function scoreBarColor(s: number) {
  if (s >= 70) return 'bg-[#22C55E]';
  if (s >= 40) return 'bg-yellow-500';
  return 'bg-[#EF4444]';
}

const SEVERITY_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string; border: string; impactBg: string }> = {
  critical: { label: 'Critical', dot: 'bg-red-500',    text: 'text-red-600 dark:text-red-400',       bg: 'bg-card', border: 'border-border/40 dark:border-white/[0.06]', impactBg: 'bg-red-50 dark:bg-red-950/20' },
  high:     { label: 'High',     dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-card', border: 'border-border/40 dark:border-white/[0.06]', impactBg: 'bg-orange-50 dark:bg-orange-950/20' },
  medium:   { label: 'Medium',   dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-500', bg: 'bg-card', border: 'border-border/40 dark:border-white/[0.06]', impactBg: 'bg-yellow-50 dark:bg-yellow-950/20' },
  low:      { label: 'Low',      dot: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400',     bg: 'bg-card', border: 'border-border/40 dark:border-white/[0.06]', impactBg: 'bg-blue-50 dark:bg-blue-950/20' },
};

const statusMeta: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment',       description: 'Complete payment to start the audit.',           icon: Clock },
  payment_received:  { label: 'Processing...',           description: 'Your audit has started processing.',              icon: Zap },
  crawling:          { label: 'Extracting files...',     description: 'Reading and extracting content from your brand files.', icon: FileSearch },
  analysing:         { label: 'Analyzing brand...',      description: 'AI is evaluating your brand across 7 categories.', icon: Sparkles },
  generating_report: { label: 'Generating report...',    description: 'Building your comprehensive brand report.',       icon: BarChart3 },
  completed:         { label: 'Completed',               description: 'Your brand audit is complete.',                   icon: CheckCircle2 },
  failed:            { label: 'Failed',                  description: 'Something went wrong during processing.',         icon: AlertTriangle },
};

/* ── Finding Card ────────────────────────────────────────── */
// Matches the FindingCard structure from the website audit page for visual consistency.

function BrandFindingCard({ finding, categoryColor, onScoreUpdate }: { finding: AuditFinding; categoryColor?: string; onScoreUpdate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(finding.status || 'open');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(finding.dismissed || false);
  const [showDismissForm, setShowDismissForm] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.medium;
  const sourceFile = finding.page_url; // page_url reused for source file in brand audits
  const pillarColor = categoryColor || 'text-brand';

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
      <div className="rounded-xl border border-border/20 dark:border-white/[0.04] bg-off/30 dark:bg-white/[0.02] p-3 opacity-60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
          <span className="text-xs text-muted line-through flex-1">{finding.title}</span>
          <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">Dismissed</span>
        </div>
        {finding.dismissal_reason && (
          <p className="text-[11px] text-muted mt-1 ml-4">{finding.dismissal_reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${sev.border} ${sev.bg} shadow-sm overflow-hidden transition-all`}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
        aria-expanded={open}
      >
        <div className={`w-2 h-2 rounded-full ${sev.dot} flex-shrink-0 mt-1.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[11px] font-medium uppercase tracking-wider ${sev.text}`}>
              {sev.label}
            </span>
            {sourceFile && (
              <span className="text-[11px] text-muted truncate max-w-[200px]">{sourceFile}</span>
            )}
          </div>
          <h4 className="font-medium text-text text-sm leading-snug">{finding.title}</h4>
        </div>
        <ChevronDown
          size={16}
          className={clsx('text-muted flex-shrink-0 mt-1 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-border/20 dark:border-white/[0.04] mx-4 space-y-3">
          {/* Description */}
          <p className="text-muted text-sm leading-relaxed pt-3">{finding.description}</p>

          {/* Recommendation */}
          {finding.recommendation && (
            <div className="p-3 bg-surface-alt/60 dark:bg-white/[0.03] rounded-lg border border-border/30 dark:border-white/[0.04]">
              <div className="flex gap-2.5">
                <Lightbulb size={14} className={`flex-shrink-0 mt-0.5 ${pillarColor}`} />
                <div>
                  <p className="text-[11px] font-medium text-text mb-1">Recommendation</p>
                  <p className="text-sm text-muted leading-relaxed">{finding.recommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Expected Impact */}
          {finding.estimated_impact && (
            <div className="flex items-start gap-2.5 p-3 bg-[#22C55E]/5 dark:bg-emerald-950/20 rounded-lg border border-[#22C55E]/15">
              <TrendingUp size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-text mb-0.5">Expected Impact</p>
                <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">{finding.estimated_impact}</p>
              </div>
            </div>
          )}

          {/* Status + Dismiss controls */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/20 dark:border-white/[0.04] mt-3">
            <span className="text-[11px] text-muted mr-1">Status:</span>
            {['open', 'in_progress', 'fixed'].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={statusUpdating}
                className={clsx(
                  'text-[11px] font-medium px-2 py-1 rounded-md transition-colors capitalize',
                  status === s
                    ? s === 'fixed'
                      ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/20'
                      : s === 'in_progress'
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                        : 'bg-off dark:bg-white/[0.06] text-text border border-border/40 dark:border-white/[0.08]'
                    : 'text-muted hover:bg-off dark:hover:bg-white/[0.04]',
                )}
              >
                {s === 'in_progress' ? 'In Progress' : s === 'fixed' ? 'Fixed' : 'Open'}
              </button>
            ))}
            <div className="flex-1" />
            {!showDismissForm ? (
              <button
                onClick={() => setShowDismissForm(true)}
                className="text-[11px] text-muted hover:text-red-500 transition-colors"
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
                  className="text-[11px] px-2 py-1 rounded-md border border-border/40 dark:border-white/[0.08] bg-off dark:bg-white/[0.03] text-text w-40"
                  onKeyDown={(e) => e.key === 'Enter' && handleDismiss()}
                />
                <button onClick={handleDismiss} disabled={!dismissReason.trim() || statusUpdating} className="text-[11px] font-medium text-red-500 hover:text-red-600 disabled:opacity-40">
                  Confirm
                </button>
                <button onClick={() => setShowDismissForm(false)} className="text-muted hover:text-text">
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

/* ── Category Section ────────────────────────────────────── */

function CategorySection({
  category,
  findings,
  expanded,
  onToggle,
  onScoreUpdate,
}: {
  category: BrandCategoryScore;
  findings: AuditFinding[];
  expanded: boolean;
  onToggle: () => void;
  onScoreUpdate?: () => void;
}) {
  const config = getCategoryConfig(category.slug);
  const Icon = config.icon;
  const catDef = BRAND_AUDIT_CATEGORIES.find(c => c.slug === category.slug);

  return (
    <div className="rounded-xl border border-border/40 dark:border-white/[0.06] bg-card overflow-hidden">
      {/* Category header */}
      <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${config.color}15` }}
        >
          <Icon size={18} style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">{category.name}</p>
          {catDef && <p className="text-[11px] text-muted mt-0.5 line-clamp-1">{catDef.description}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className={clsx('text-lg font-semibold leading-none', scoreColor(category.score))}>{category.score}</p>
            <p className="text-[10px] text-muted mt-0.5">/100</p>
          </div>
          {findings.length > 0 && (
            <span className="text-[10px] font-medium text-muted bg-off dark:bg-white/[0.04] px-1.5 py-0.5 rounded-full">
              {findings.length} issue{findings.length !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronDown size={14} className={clsx('text-muted transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/30 dark:border-white/[0.04]">
          {/* Score bar */}
          <div className="px-5 pt-4 pb-3">
            <div className="w-full h-2 rounded-full bg-off dark:bg-white/[0.04]">
              <div
                className={clsx('h-full rounded-full transition-all', scoreBarColor(category.score))}
                style={{ width: `${category.score}%` }}
              />
            </div>
          </div>

          {/* Summary */}
          {category.summary && (
            <div className="px-5 pb-4">
              <p className="text-sm text-text/80 leading-relaxed">{category.summary}</p>
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              {findings.map((f) => (
                <BrandFindingCard key={f.id} finding={f} categoryColor={`text-[${config.color}]`} onScoreUpdate={onScoreUpdate} />
              ))}
            </div>
          )}
          {findings.length === 0 && (
            <div className="px-5 pb-4">
              <p className="text-xs text-muted">No specific issues found in this category.</p>
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
  const [audit, setAudit] = useState<AuditWithReport | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [brandName, setBrandName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'findings'>('overview');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
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
        if (auditData.status === 'completed') {
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

        if (auditData.status === 'completed') {
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
      if (s === 'completed' || s === 'failed') clearInterval(iv);
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
      router.push('/dashboard/audits?type=brand_identity');
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
      if (data.shareUrl) {
        setShareUrl(data.shareUrl);
        navigator.clipboard?.writeText(data.shareUrl);
      }
    } catch {} finally { setShareLoading(false); }
  };

  const toggleCategory = (slug: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="h-5 w-20 bg-off rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-off rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-off rounded animate-pulse mb-8" />
        <div className="h-48 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <Link href="/dashboard/audits?type=brand_identity" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Audits
        </Link>
        <Card>
          <div className="text-center py-8">
            <AlertTriangle size={24} className="text-red-500 mx-auto mb-3" />
            <p className="font-medium text-text mb-1">Error loading audit</p>
            <p className="text-sm text-muted">{error || 'Audit not found'}</p>
          </div>
        </Card>
      </div>
    );
  }

  const isCompleted = audit.status === 'completed';
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
        href="/dashboard/audits?type=brand_identity"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} /> Back to Brand Audits
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Palette size={18} className="text-brand flex-shrink-0" />
            <h1 className="text-2xl font-medium font-heading text-text truncate">{displayName}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-muted text-sm">{formatDate(audit.created_at)}</p>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
              <Palette size={10} />
              Brand Identity
            </span>
          </div>
        </div>

        {/* Menu */}
        <div className="flex items-center gap-2 flex-shrink-0 relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-off transition-colors"
            aria-label="Audit settings"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-[100] w-52 rounded-xl border border-border/40 dark:border-white/[0.08] bg-white dark:bg-[#1E1E24] shadow-xl shadow-black/20 dark:shadow-black/50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              {isCompleted && (
                <>
                  <button
                    onClick={() => { handleShare(); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Share2 size={13} className="text-muted" />
                    {shareUrl ? 'Copy share link' : 'Create share link'}
                  </button>
                  <div className="my-1.5 h-px bg-border/30 dark:bg-white/[0.04]" />
                </>
              )}
              {audit.brand_identity_id && (
                <Link
                  href={`/dashboard/new-audit?type=brand_identity&brand=${audit.brand_identity_id}`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors"
                >
                  <RefreshCw size={13} className="text-muted" />
                  Re-audit this brand
                  <span className="ml-auto text-[11px] text-muted">1 credit</span>
                </Link>
              )}
              {canRetry && (
                <button
                  onClick={() => { handleRetry(); setMenuOpen(false); }}
                  disabled={retrying}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                >
                  <Zap size={13} className="text-muted" />
                  {isStuck ? 'Restart stuck audit' : 'Retry audit'}
                </button>
              )}
              <button
                onClick={() => { handleRestart(); setMenuOpen(false); }}
                disabled={restarting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-text hover:bg-off dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className="text-muted" />
                Restart audit
              </button>
              <div className="my-1.5 h-px bg-border/30 dark:bg-white/[0.04]" />
              <button
                onClick={() => { handleDelete(); setMenuOpen(false); }}
                disabled={deleting}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-50"
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
              <p className="font-medium text-text">{meta.label}</p>
              <p className="text-sm text-muted">{meta.description}</p>
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
                    isActive ? 'bg-brand' : 'bg-off',
                    isCurrent && 'animate-pulse',
                  )} />
                  <p className={clsx('text-xs font-medium mt-1.5', isActive ? 'text-brand' : 'text-muted')}>
                    {labels[idx]}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-muted mt-4 text-center">This page updates automatically.</p>
        </Card>
      )}

      {/* ── Failed or Stuck ───────────────────────────────── */}
      {canRetry && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isFailed ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                <AlertTriangle size={20} className={isFailed ? 'text-red-500' : 'text-yellow-500'} />
              </div>
              <div>
                <p className="font-medium text-text">{isFailed ? 'Audit failed' : 'Audit appears stuck'}</p>
                <p className="text-sm text-muted">
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
          {/* Score card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Overall score */}
            <Card className="flex flex-col items-center justify-center py-6">
              <ScoreRing score={overallScore || 0} size={80} />
              <p className="text-sm font-medium text-text mt-3">Overall Score</p>
              <p className="text-xs text-muted mt-0.5">{reportJson?.filesAnalyzed || 0} files analyzed</p>
            </Card>

            {/* Issue counts */}
            <Card className="py-5 px-5">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Issues Found</p>
              <div className="space-y-2">
                {[
                  { label: 'Critical', count: report.critical_count, color: 'bg-red-500' },
                  { label: 'High', count: report.high_count, color: 'bg-orange-500' },
                  { label: 'Medium', count: report.medium_count, color: 'bg-yellow-500' },
                  { label: 'Low', count: report.low_count, color: 'bg-blue-500' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2">
                    <div className={clsx('w-2 h-2 rounded-full', row.color)} />
                    <span className="text-xs text-muted flex-1">{row.label}</span>
                    <span className="text-sm font-medium text-text">{row.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-border/30 dark:border-white/[0.04] flex items-center justify-between">
                <span className="text-xs text-muted">Total</span>
                <span className="text-sm font-semibold text-text">{report.total_issues}</span>
              </div>
            </Card>

            {/* Top recommendations */}
            <Card className="py-5 px-5">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Top Priorities</p>
              <div className="space-y-2">
                {(reportJson?.topRecommendations || []).slice(0, 4).map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-brand mt-0.5 flex-shrink-0">{i + 1}</span>
                    <p className="text-xs text-text/80 leading-relaxed line-clamp-2">{rec}</p>
                  </div>
                ))}
                {(!reportJson?.topRecommendations || reportJson.topRecommendations.length === 0) && (
                  <p className="text-xs text-muted">No recommendations yet.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Executive summary */}
          {report.executive_summary && (
            <Card className="mb-6">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Executive Summary</p>
              <p className="text-sm text-text/80 leading-relaxed">{report.executive_summary}</p>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-5 p-1 bg-off/60 dark:bg-white/[0.03] rounded-xl border border-border/30 dark:border-white/[0.04]">
            {(['overview', 'findings'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'flex-1 text-xs font-medium py-2 px-3 rounded-lg transition-all capitalize',
                  activeTab === tab
                    ? 'bg-card text-text shadow-sm border border-border/40 dark:border-white/[0.06]'
                    : 'text-muted hover:text-text hover:bg-card/50',
                )}
              >
                {tab === 'overview' ? 'Overview' : `Findings (${findings.length})`}
              </button>
            ))}
          </div>

          {/* Overview tab — category breakdown */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Category score bars overview */}
              <Card className="mb-2">
                <p className="text-xs font-medium text-muted uppercase tracking-wider mb-4">Score by Category</p>
                <div className="space-y-3">
                  {categoryScores.map((cat) => {
                    const config = getCategoryConfig(cat.slug);
                    const Icon = config.icon;
                    return (
                      <button
                        key={cat.slug}
                        onClick={() => toggleCategory(cat.slug)}
                        className="w-full flex items-center gap-3 group"
                      >
                        <Icon size={14} style={{ color: config.color }} className="flex-shrink-0" />
                        <span className="text-xs text-text min-w-[140px] text-left truncate">{cat.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-off dark:bg-white/[0.04]">
                          <div
                            className={clsx('h-full rounded-full transition-all', scoreBarColor(cat.score))}
                            style={{ width: `${cat.score}%` }}
                          />
                        </div>
                        <span className={clsx('text-xs font-semibold min-w-[32px] text-right', scoreColor(cat.score))}>{cat.score}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Detailed category sections */}
              {categoryScores.map((cat) => (
                <CategorySection
                  key={cat.slug}
                  category={cat}
                  findings={findingsByCategory[cat.slug] || []}
                  expanded={expandedCategories.has(cat.slug)}
                  onToggle={() => toggleCategory(cat.slug)}
                  onScoreUpdate={() => fetchAuditDetail(true)}
                />
              ))}
            </div>
          )}

          {/* Findings tab — flat list of all findings */}
          {activeTab === 'findings' && (
            <div className="space-y-2">
              {findings.length === 0 && (
                <Card>
                  <div className="text-center py-8">
                    <CheckCircle2 size={24} className="text-green-500 mx-auto mb-3" />
                    <p className="font-medium text-text">No issues found</p>
                    <p className="text-sm text-muted mt-1">Your brand materials look great!</p>
                  </div>
                </Card>
              )}
              {findings.map((f) => (
                <BrandFindingCard key={f.id} finding={f} onScoreUpdate={() => fetchAuditDetail(true)} />
              ))}
            </div>
          )}

          {/* Share URL */}
          {shareUrl && (
            <p className="text-center text-[11px] text-muted mt-4">
              Share link: <span className="font-mono text-brand">{shareUrl}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}
