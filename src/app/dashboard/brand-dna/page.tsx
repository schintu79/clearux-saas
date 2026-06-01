'use client';

/**
 * Brand DNA Console — a clean workspace for managing brand identity inputs,
 * assets, readiness state, and Brand DNA audit.
 *
 * Sections:
 *  1. Readiness — completeness %, eligibility for Brand DNA Audit and Website Audit inclusion
 *  2. Brand Profile — structured editable fields (name, website, logo, voice, colours, promise)
 *  3. Assets — drag/drop upload, file list with type tagging
 *  4. Brand DNA Audit — run, results, and recommendations
 *  5. Include in Website Audit — eligibility control
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Fingerprint,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  X,
  Globe as GlobeIcon,
  Palette,
  Volume2,
  Upload,
  Trash2,
  Loader2,
  Play,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Sparkles,
  MoreVertical,
  File,
  Image as ImageIcon,
  Link2,
  Share2,
  Check,
  Eye,
  MessageSquare,
  ShieldCheck,
  Target,
  Layers,
  Type,
  Lightbulb,
  CircleDot,
  Tag,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { useWorkspace } from '@/context/WorkspaceContext';
import { BRAND_AUDIT_CATEGORIES } from '@/lib/brand-audit-modules';
import ScoreCircle from '@/components/ui/ScoreCircle';
import { useAuditProgress } from '@/hooks/useAuditProgress';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import clsx from 'clsx';

/* ── Types ──────────────────────────────────────────────── */

interface BrandFile {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes?: number | null;
  created_at?: string;
  tag?: string | null;
}

interface BrandIdentity {
  id: string;
  name: string;
  description: string | null;
  website_url: string | null;
  brand_voice: string | null;
  tone_keywords: string[] | null;
  primary_colors: string[] | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  brand_identity_files: BrandFile[];
}

interface BrandEditState {
  name: string;
  description: string;
  website_url: string;
  brand_voice: string;
  tone_keywords: string;
  primary_colors: string;
  logo_url: string;
}

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

interface AuditRecord {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  brand_identity_id: string | null;
  crawl_error?: string | null;
}

interface ReportRecord {
  overall_score: number | null;
  executive_summary: string | null;
  raw_json: any;
  total_issues: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

interface FindingRecord {
  id: string;
  audit_id: string;
  title: string;
  description: string;
  recommendation: string | null;
  severity: string;
  status: string;
  page_url: string | null;
  estimated_impact: string | null;
  sort_order: number;
  dismissed: boolean;
  dismissal_reason: string | null;
}

/* ── Helpers ─────────────────────────────────────────────── */

function toEditState(b: BrandIdentity): BrandEditState {
  return {
    name: b.name || '',
    description: b.description || '',
    website_url: b.website_url || '',
    brand_voice: b.brand_voice || '',
    tone_keywords: (b.tone_keywords || []).join(', '),
    primary_colors: (b.primary_colors || []).join(', '),
    logo_url: b.logo_url || '',
  };
}

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExt(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

function fileTypeLabel(name: string): string {
  const ext = fileExt(name);
  const map: Record<string, string> = { pdf: 'PDF', docx: 'DOCX', doc: 'DOC', txt: 'TXT', png: 'PNG', jpg: 'JPG', jpeg: 'JPG', svg: 'SVG', webp: 'WebP' };
  return map[ext] || ext.toUpperCase();
}

function isDocFile(name: string): boolean {
  return ['pdf', 'docx', 'doc', 'txt'].includes(fileExt(name));
}

function scoreColor(s: number): string {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function sevColor(sev: string): string {
  switch (sev) {
    case 'critical': return 'var(--severe)';
    case 'high': return 'var(--warn)';
    case 'medium': return 'var(--signal)';
    default: return 'var(--ok)';
  }
}

function sevLabel(sev: string): string {
  return sev.charAt(0).toUpperCase() + sev.slice(1);
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/* ── File tag options ──────────────────────────────────────── */

const FILE_TAGS = ['Logo', 'Brand guide', 'Voice', 'Colours', 'Messaging', 'Other'] as const;
type FileTag = typeof FILE_TAGS[number];

/* ── Category UI config ──────────────────────────────────── */

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  visual_consistency: Eye,
  tone_of_voice: MessageSquare,
  professionalism: ShieldCheck,
  value_proposition: Target,
  structure_organization: Layers,
  wording_quality: Type,
};

const CATEGORY_TINTS: Record<string, { dot: string; bg: string; border: string }> = {
  visual_consistency: { dot: '#6366F1', bg: 'rgba(99,102,241,0.04)', border: 'rgba(99,102,241,0.12)' },
  tone_of_voice: { dot: '#EC4899', bg: 'rgba(236,72,153,0.04)', border: 'rgba(236,72,153,0.12)' },
  professionalism: { dot: '#10B981', bg: 'rgba(16,185,129,0.04)', border: 'rgba(16,185,129,0.12)' },
  value_proposition: { dot: '#F59E0B', bg: 'rgba(245,158,11,0.04)', border: 'rgba(245,158,11,0.12)' },
  structure_organization: { dot: '#3B82F6', bg: 'rgba(59,130,246,0.04)', border: 'rgba(59,130,246,0.12)' },
  wording_quality: { dot: '#14B8A6', bg: 'rgba(20,184,166,0.04)', border: 'rgba(20,184,166,0.12)' },
};

/* ── Readiness requirements ──────────────────────────────── */

interface ReadinessItem {
  key: string;
  label: string;
  check: (identity: BrandIdentity) => boolean;
}

const READINESS_ITEMS: ReadinessItem[] = [
  { key: 'logo', label: 'Logo', check: (i) => !!i.logo_url || i.brand_identity_files.some(f => (f.tag || '').toLowerCase() === 'logo') },
  { key: 'voice', label: 'Voice', check: (i) => !!(i.brand_voice || (i.tone_keywords && i.tone_keywords.length > 0)) },
  { key: 'guide', label: 'Brand identity guide', check: (i) => i.brand_identity_files.some(f => (f.tag || '').toLowerCase() === 'brand guide' || isDocFile(f.file_name)) },
  { key: 'colours', label: 'Colours', check: (i) => !!(i.primary_colors && i.primary_colors.length > 0) },
  { key: 'promise', label: 'Promise', check: (i) => !!i.description },
];

/* ══════════════════════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════════════════════ */

export default function BrandDnaPage() {
  const { user, loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';

  /* ── Brand identity state ── */
  const [identity, setIdentity] = useState<BrandIdentity | null>(null);
  const [siteLabel, setSiteLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<BrandEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ── File upload state ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  /* ── Brand audit state ── */
  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [triggeringAudit, setTriggeringAudit] = useState(false);

  /* ── Share / delete state ── */
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [deletingAudit, setDeletingAudit] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Close menu on outside click / Escape ── */
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

  /* ── Load brand identity ── */
  const loadIdentity = useCallback(async () => {
    if (!user || !workspace) return null;
    try {
      if (workspace.active_brand_identity_id) {
        const res = await fetch(`/api/brand-identities/${workspace.active_brand_identity_id}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Failed to load brand DNA');
        const data = await res.json();
        return data.identity || null;
      } else if (workspace.primary_domain) {
        const supabase = createBrowserSupabase();
        const { data: audits } = await supabase
          .from('audits')
          .select('product_url, brand_identity_id, completed_at')
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .order('completed_at', { ascending: false, nullsFirst: false } as any)
          .limit(100);
        const match = (audits || []).find((a: any) => hostnameOf(a.product_url) === workspace.primary_domain && !!a.brand_identity_id);
        if (!match) return null;
        const res = await fetch(`/api/brand-identities/${(match as any).brand_identity_id}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Failed to load brand DNA');
        const data = await res.json();
        return data.identity || null;
      }
      return null;
    } catch { return null; }
  }, [user, workspace]);

  /* ── Load latest brand audit for this identity ── */
  const loadBrandAudit = useCallback(async (brandId: string) => {
    const supabase = createBrowserSupabase();
    const { data: audits } = await supabase
      .from('audits')
      .select('*')
      .eq('brand_identity_id', brandId)
      .eq('audit_type', 'brand_identity')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    const latest = audits?.[0] || null;
    if (!latest) { setAudit(null); setReport(null); setFindings([]); return null; }
    setAudit(latest as AuditRecord);

    if (latest.status === 'completed') {
      const [{ data: rep }, { data: finds }] = await Promise.all([
        supabase.from('reports').select('*').eq('audit_id', latest.id).maybeSingle(),
        supabase.from('audit_findings').select('*').eq('audit_id', latest.id).order('severity').order('sort_order'),
      ]);
      setReport(rep as ReportRecord | null);
      setFindings((finds || []) as FindingRecord[]);
    } else {
      setReport(null);
      setFindings([]);
    }
    return latest;
  }, []);

  /* ── Master load ── */
  useEffect(() => {
    if (authLoading || !user || wsLoading) {
      if (!authLoading && !wsLoading) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIdentity(null);
    setSiteLabel(null);
    setEditing(false);
    setEditState(null);
    setAudit(null);
    setReport(null);
    setFindings([]);

    (async () => {
      if (!workspace) { if (!cancelled) setLoading(false); return; }
      if (workspace.primary_domain) setSiteLabel(workspace.primary_domain);
      try {
        const id = await loadIdentity();
        if (cancelled) return;
        setIdentity(id);
        if (id) {
          setAuditLoading(true);
          await loadBrandAudit(id.id);
          if (!cancelled) setAuditLoading(false);
        }
      } catch {
        if (!cancelled) setError('Could not load Brand DNA.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, wsLoading, workspace, loadIdentity, loadBrandAudit]);

  /* ── Poll in-progress audits ── */
  useEffect(() => {
    if (!audit || !identity) return;
    const inProgress = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
    if (!inProgress) return;
    const iv = setInterval(async () => {
      const latest = await loadBrandAudit(identity.id);
      if (latest && (latest.status === 'completed' || latest.status === 'failed')) clearInterval(iv);
    }, 5000);
    return () => clearInterval(iv);
  }, [audit?.status, audit?.id, identity, loadBrandAudit]);

  /* ── Edit handlers ── */
  const beginEdit = () => { if (!identity) return; setEditing(true); setEditState(toEditState(identity)); setSaveError(null); };
  const cancelEdit = () => { setEditing(false); setEditState(null); setSaveError(null); };

  const saveEdit = async () => {
    if (!identity || !editState) return;
    if (!editState.name.trim()) { setSaveError('Brand name is required.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: editState.name.trim(),
        description: editState.description.trim() || null,
        website_url: editState.website_url.trim() || null,
        brand_voice: editState.brand_voice.trim() || null,
        tone_keywords: editState.tone_keywords.split(',').map(s => s.trim()).filter(Boolean),
        primary_colors: editState.primary_colors.split(',').map(s => s.trim()).filter(Boolean),
        logo_url: editState.logo_url.trim() || null,
      };
      const res = await fetch(`/api/brand-identities/${identity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to save'); }
      const data = await res.json();
      setIdentity(prev => prev ? { ...prev, ...(data.identity || {}) } : prev);
      setEditing(false);
      setEditState(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  /* ── File upload ── */
  const uploadFiles = async (files: FileList | File[]) => {
    if (!identity) return;
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    setUploadMsg(null);
    let ok = 0;
    for (const file of arr) {
      if (file.size > MAX_FILE_SIZE) { setUploadMsg(`${file.name} exceeds 10 MB`); continue; }
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/brand-identities/${identity.id}/upload`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error();
        ok++;
      } catch { setUploadMsg(`Failed to upload ${file.name}`); }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const updated = await loadIdentity();
    if (updated) setIdentity(updated);
    if (ok > 0 && !uploadMsg) setUploadMsg(`${ok} file${ok > 1 ? 's' : ''} uploaded`);
    setTimeout(() => setUploadMsg(null), 3000);
  };

  const deleteFile = async (fileId: string) => {
    if (!identity) return;
    setDeletingFileId(fileId);
    try {
      const res = await fetch(`/api/brand-identities/${identity.id}/files?fileId=${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setIdentity(prev => prev ? { ...prev, brand_identity_files: prev.brand_identity_files.filter(f => f.id !== fileId) } : prev);
    } catch { setUploadMsg('Failed to delete file'); }
    setDeletingFileId(null);
  };

  /* ── Trigger brand audit ── */
  const triggerAudit = async () => {
    if (!identity || !user) return;
    setTriggeringAudit(true);
    try {
      const creditCheck = await fetch('/api/credits');
      const creditData = await creditCheck.json();
      const canAudit = creditData.can_audit === true;
      const firstAuditFree = creditData.first_audit_free === true;

      const supabase = createBrowserSupabase();
      const { data: newAudit, error: err } = await supabase
        .from('audits')
        .insert({
          user_id: user.id,
          status: canAudit ? 'payment_received' : 'pending_payment',
          product_type: 'auto_detect',
          ux_concern: 'Brand identity audit',
          notes: null,
          plan: 'full_audit',
          language: 'en',
          audit_type: 'brand_identity',
          brand_identity_id: identity.id,
          depth_mode: 'deep',
          progress_percent: canAudit ? 1 : 0,
          audit_stage: canAudit ? 'preflight' : null,
        })
        .select('id, status, created_at, updated_at, brand_identity_id')
        .single();

      if (err) throw err;

      if (canAudit) {
        const creditRes = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_id: newAudit!.id, is_free_first: firstAuditFree }),
        });
        if (!creditRes.ok) console.error('Failed to apply credit for brand audit');
      } else {
        const checkoutRes = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_id: newAudit!.id }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.url) {
          window.location.href = checkoutData.url;
          return;
        }
      }

      setAudit(newAudit as AuditRecord);
      setReport(null);
      setFindings([]);
    } catch (err) {
      setError('Failed to start brand audit.');
    } finally { setTriggeringAudit(false); }
  };

  /* ── Share audit ── */
  const handleShare = async () => {
    if (!audit) return;
    setShareLoading(true);
    try {
      const res = await fetch(`/api/audits/${audit.id}/share`, { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const url = data.share_url || data.url;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      setError('Failed to generate share link.');
    } finally { setShareLoading(false); }
  };

  /* ── Delete audit (soft) ── */
  const handleDeleteAudit = async () => {
    if (!audit) return;
    if (!window.confirm('Delete this brand audit? You can re-run a new audit at any time.')) return;
    setDeletingAudit(true);
    try {
      const res = await fetch(`/api/audits/${audit.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setAudit(null);
      setReport(null);
      setFindings([]);
      setShareUrl(null);
    } catch {
      setError('Failed to delete audit.');
    } finally { setDeletingAudit(false); }
  };

  /* ── Computed ── */
  const reportJson = useMemo<BrandReportJson | null>(() => {
    if (!report?.raw_json) return null;
    const rj = report.raw_json as any;
    if (rj.type !== 'brand_identity') return null;
    return rj as BrandReportJson;
  }, [report]);

  const categoryScores = useMemo(() => reportJson?.categoryResults || [], [reportJson]);

  /* ── Readiness computation ── */
  const readinessChecks = useMemo(() => {
    if (!identity) return READINESS_ITEMS.map(r => ({ ...r, met: false }));
    return READINESS_ITEMS.map(r => ({ ...r, met: r.check(identity) }));
  }, [identity]);

  const readinessPercent = useMemo(() => {
    const met = readinessChecks.filter(r => r.met).length;
    return Math.round((met / readinessChecks.length) * 100);
  }, [readinessChecks]);

  const readyForBrandAudit = useMemo(() => {
    // Need at least one file to run the brand audit
    return !!(identity && identity.brand_identity_files.length > 0);
  }, [identity]);

  const readyForWebsiteAudit = useMemo(() => {
    // All 5 readiness items must be met
    return readinessChecks.every(r => r.met);
  }, [readinessChecks]);

  const missingItems = useMemo(() => readinessChecks.filter(r => !r.met), [readinessChecks]);

  /* ── Recommendations ── */
  const recommendations = useMemo(() => {
    if (!identity) return [];
    const recs: string[] = [];
    if (!identity.logo_url && !identity.brand_identity_files.some(f => (f.tag || '').toLowerCase() === 'logo'))
      recs.push('Add a primary logo file to enable logo consistency checks.');
    if (!identity.brand_voice && (!identity.tone_keywords || identity.tone_keywords.length === 0))
      recs.push('Define 3-5 brand voice traits to compare against website copy.');
    if (!identity.brand_identity_files.some(f => (f.tag || '').toLowerCase() === 'brand guide' || isDocFile(f.file_name)))
      recs.push('Upload a brand identity guide to unlock full Brand DNA analysis.');
    if (!identity.primary_colors || identity.primary_colors.length === 0)
      recs.push('Add approved brand colours to compare live-site palette usage.');
    if (!identity.description)
      recs.push('Write a brand promise to enable value proposition checks.');
    return recs;
  }, [identity]);

  /* ── Audit state ── */
  const isAuditInProgress = audit && ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
  const isAuditCompleted = audit?.status === 'completed';
  const isAuditFailed = audit?.status === 'failed';
  const overallScore = report?.overall_score ?? null;
  const hasFiles = identity ? identity.brand_identity_files.length > 0 : false;

  /* ── Skeleton ── */
  if (authLoading || loading || wsLoading) {
    return (
      <div>
        <div className="h-7 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-4 w-72 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-[80px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  /* ── Empty states ── */
  if (!workspace) {
    return (
      <div>
        <PageHeader
          icon={<Fingerprint size={18} strokeWidth={1.6} />}
          title="Brand DNA"
          subtitle="Manage your brand identity source of truth."
        />
        <EmptyState
          title="Select a workspace"
          body="Brand DNA is scoped to the workspace you have selected in the sidebar."
          ctaHref={`${dashPrefix}/new-audit`}
          ctaLabel="Run your first audit"
        />
      </div>
    );
  }

  if (!identity) {
    return (
      <div>
        <PageHeader
          icon={<Fingerprint size={18} strokeWidth={1.6} />}
          title="Brand DNA"
          subtitle={siteLabel ? `Brand identity for ${siteLabel}` : 'Manage your brand identity source of truth.'}
        />
        <EmptyState
          title={!workspace.primary_domain ? 'No Brand DNA on file yet' : `No Brand DNA for ${siteLabel || 'this site'}`}
          body="Add your brand name, voice, colours, and upload guidelines so audits can score design consistency against your brand standards."
          ctaHref={`${dashPrefix}/brand-identity/new`}
          ctaLabel="Add Brand DNA"
        />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Full page — Brand DNA Console
     ══════════════════════════════════════════════════════════ */

  return (
    <div>
      {/* ── Page header ── */}
      <PageHeader
        icon={<Fingerprint size={18} strokeWidth={1.6} />}
        title="Brand DNA"
        subtitle={siteLabel ? `Brand identity console for ${siteLabel}` : 'Your brand identity source of truth.'}
      />

      {error && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 14%, transparent)' }}>
          <AlertCircle size={13} style={{ color: 'var(--severe)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ink)' }}>{error}</span>
        </div>
      )}

      <div className="space-y-5">

        {/* ══════════════════════════════════════════════════════
           SECTION 1: Readiness
           ══════════════════════════════════════════════════════ */}
        <section
          className="rounded-xl p-5"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-start gap-5">
            {/* Completion ring */}
            <div className="flex-shrink-0">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="var(--rule)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="14" fill="none"
                    stroke={readinessPercent === 100 ? 'var(--ok)' : readinessPercent >= 60 ? 'var(--signal)' : 'var(--warn)'}
                    strokeWidth="3"
                    strokeDasharray={`${readinessPercent * 0.88} 88`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold" style={{ color: 'var(--ink)' }}>
                  {readinessPercent}%
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>Brand DNA readiness</h3>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                <StatusLine
                  label="Brand DNA audit"
                  ready={readyForBrandAudit}
                  reason={readyForBrandAudit ? undefined : 'Upload at least one brand file'}
                />
                <StatusLine
                  label="Include in website audit"
                  ready={readyForWebsiteAudit}
                  reason={readyForWebsiteAudit ? undefined : `${missingItems.length} item${missingItems.length === 1 ? '' : 's'} missing`}
                />
              </div>

              {/* Missing items checklist */}
              {missingItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {readinessChecks.map(item => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: item.met ? 'color-mix(in srgb, var(--ok) 8%, transparent)' : 'var(--paper-2)',
                        color: item.met ? 'var(--ok)' : 'var(--m-muted)',
                        border: `1px solid ${item.met ? 'color-mix(in srgb, var(--ok) 20%, transparent)' : 'var(--rule)'}`,
                      }}
                    >
                      {item.met ? <CheckCircle2 size={10} /> : <CircleDot size={10} />}
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           SECTION 2: Brand Profile
           ══════════════════════════════════════════════════════ */}
        <section
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center justify-between p-4 pb-0">
            <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Brand profile</h3>
            {!editing && (
              <button
                onClick={beginEdit}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors hover:opacity-80"
                style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--rule)' }}
              >
                <Edit2 size={10} /> Edit
              </button>
            )}
          </div>

          <div className="p-4">
            {editing && editState ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Brand name" required>
                    <input value={editState.name} onChange={e => setEditState({ ...editState, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={120} />
                  </Field>
                  <Field label="Website URL">
                    <input value={editState.website_url} onChange={e => setEditState({ ...editState, website_url: e.target.value })} placeholder="https://example.com" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={2048} />
                  </Field>
                </div>
                <Field label="Logo URL">
                  <input value={editState.logo_url} onChange={e => setEditState({ ...editState, logo_url: e.target.value })} placeholder="https://cdn.example.com/logo.svg or upload in Assets" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={2048} />
                </Field>
                <Field label="Brand voice">
                  <textarea value={editState.brand_voice} onChange={e => setEditState({ ...editState, brand_voice: e.target.value })} placeholder="How does your brand sound? e.g. Confident but approachable, technical but not cold." rows={2} className="w-full px-3 py-2 rounded-lg text-[13px] resize-y outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={4000} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Tone keywords">
                    <input value={editState.tone_keywords} onChange={e => setEditState({ ...editState, tone_keywords: e.target.value })} placeholder="confident, warm, direct" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} />
                  </Field>
                  <Field label="Brand colours">
                    <input value={editState.primary_colors} onChange={e => setEditState({ ...editState, primary_colors: e.target.value })} placeholder="#0A84FF, #111111, #F5F5F5" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} />
                  </Field>
                </div>
                <Field label="Brand promise">
                  <textarea value={editState.description} onChange={e => setEditState({ ...editState, description: e.target.value })} placeholder="Who you serve and the change you create." rows={2} className="w-full px-3 py-2 rounded-lg text-[13px] resize-y outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={600} />
                </Field>
                {saveError && (
                  <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }}>{saveError}</div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={cancelEdit} disabled={saving} className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1.5 rounded-md" style={{ color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                    <X size={11} /> Cancel
                  </button>
                  <button onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-md" style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: saving ? 0.6 : 1 }}>
                    <Save size={11} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              /* View mode — compact two-column grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <ProfileSlot label="Name" value={identity.name} filled />
                <ProfileSlot label="Website" value={identity.website_url || 'Not set'} filled={!!identity.website_url} />
                <ProfileSlot label="Logo" value={identity.logo_url ? 'On file' : 'Not set'} filled={!!identity.logo_url} />
                <ProfileSlot label="Voice" value={(identity.tone_keywords || []).length > 0 ? (identity.tone_keywords || []).slice(0, 3).join(', ') : (identity.brand_voice ? 'Defined' : 'Not set')} filled={!!(identity.brand_voice || (identity.tone_keywords || []).length)} />
                <ProfileSlot label="Colours" value={(identity.primary_colors || []).length > 0 ? `${(identity.primary_colors || []).length} defined` : 'Not set'} filled={(identity.primary_colors || []).length > 0} colors={identity.primary_colors || undefined} />
                <ProfileSlot label="Promise" value={identity.description ? (identity.description.length > 40 ? identity.description.slice(0, 38) + '...' : identity.description) : 'Not set'} filled={!!identity.description} />
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           SECTION 3: Assets
           ══════════════════════════════════════════════════════ */}
        {!editing && (
          <section
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div className="p-4 pb-0">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                  Assets
                  <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--m-muted)' }}>
                    {identity.brand_identity_files.length} file{identity.brand_identity_files.length === 1 ? '' : 's'}
                  </span>
                </h3>
              </div>
            </div>

            <div className="p-4">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className="flex items-center justify-center gap-3 px-5 py-5 rounded-xl border-2 border-dashed transition-all cursor-pointer"
                style={{
                  borderColor: dragOver ? 'var(--signal)' : 'color-mix(in srgb, var(--signal) 30%, var(--rule))',
                  background: dragOver ? 'color-mix(in srgb, var(--signal) 6%, transparent)' : 'color-mix(in srgb, var(--signal) 2%, transparent)',
                }}
              >
                {uploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" style={{ color: 'var(--signal)' }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Uploading...</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                      <Upload size={14} style={{ color: 'var(--signal)' }} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
                        Drop files or click to browse
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                        Brand guides, logos, style assets (PDF, DOCX, PNG, JPG, SVG)
                      </p>
                    </div>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg,.webp" multiple onChange={e => { if (e.target.files) uploadFiles(e.target.files); }} className="hidden" />

              {uploadMsg && (
                <p className="text-[11px] mt-2" style={{ color: uploadMsg.includes('Failed') || uploadMsg.includes('exceeds') ? 'var(--severe)' : 'var(--ok)' }}>{uploadMsg}</p>
              )}

              {/* File list */}
              {identity.brand_identity_files.length > 0 && (
                <div className="mt-3 space-y-1">
                  {identity.brand_identity_files.map(f => (
                    <div key={f.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg group transition-all" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                      <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card)' }}>
                        {isDocFile(f.file_name) ? <FileText size={11} style={{ color: 'var(--m-muted)' }} /> : <ImageIcon size={11} style={{ color: 'var(--m-muted)' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>{f.file_name}</p>
                        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--m-muted)' }}>
                          <span>{fileTypeLabel(f.file_name)}</span>
                          {f.file_size_bytes && <><span style={{ color: 'var(--rule)' }}>·</span><span>{formatBytes(f.file_size_bytes)}</span></>}
                          {f.tag && <><span style={{ color: 'var(--rule)' }}>·</span><span className="font-medium" style={{ color: 'var(--signal)' }}>{f.tag}</span></>}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteFile(f.id); }}
                        disabled={deletingFileId === f.id}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: 'var(--m-muted)' }}
                      >
                        {deletingFileId === f.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ══════════════════════════════════════════════════════
           SECTION 4: Brand DNA Audit
           ══════════════════════════════════════════════════════ */}
        <section
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Brand DNA audit</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                  Checks uploaded brand identity, assets, and structured inputs for completeness, consistency, and usability.
                </p>
              </div>

              {/* Audit actions */}
              <div className="flex items-center gap-2 flex-shrink-0" ref={menuRef}>
                {isAuditCompleted && (
                  <>
                    <button
                      onClick={triggerAudit}
                      disabled={triggeringAudit}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all hover:opacity-80"
                      style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                    >
                      <RefreshCw size={10} /> Re-audit
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpen(v => !v)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors"
                        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                        aria-label="More actions"
                      >
                        <MoreVertical size={12} />
                      </button>
                      {menuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-9 z-50 w-52 rounded-xl py-1 shadow-lg"
                          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                        >
                          <button
                            type="button"
                            onClick={() => { handleShare(); setMenuOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-black/[0.03] transition-colors text-left"
                            style={{ color: 'var(--ink)' }}
                          >
                            <Share2 size={11} className="text-m-muted" />
                            {shareUrl ? 'Copy share link' : 'Create share link'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMenuOpen(false); handleDeleteAudit(); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-red-50 transition-colors text-left"
                            style={{ color: 'var(--severe)' }}
                          >
                            <Trash2 size={11} />
                            Delete audit
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {!isAuditCompleted && !isAuditInProgress && (
                  <button
                    onClick={triggerAudit}
                    disabled={triggeringAudit || !readyForBrandAudit}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                    style={{
                      background: readyForBrandAudit ? 'var(--ink)' : 'var(--paper-2)',
                      color: readyForBrandAudit ? 'var(--paper)' : 'var(--m-muted)',
                      opacity: triggeringAudit ? 0.6 : 1,
                      cursor: readyForBrandAudit ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {triggeringAudit ? <><Loader2 size={11} className="animate-spin" /> Starting...</> : <><Play size={11} /> Run Brand DNA audit</>}
                  </button>
                )}
              </div>
            </div>

            {/* Audit in progress */}
            {isAuditInProgress && audit && (
              <BrandAuditInProgress audit={audit} />
            )}

            {/* Audit failed */}
            {isAuditFailed && audit && (
              <div className="rounded-lg p-3 flex items-center justify-between gap-3" style={{ background: 'color-mix(in srgb, var(--severe) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 12%, transparent)' }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} style={{ color: 'var(--severe)' }} />
                  <div>
                    <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Audit failed</p>
                    <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{(audit as any).crawl_error || 'Something went wrong.'}</p>
                  </div>
                </div>
                <button onClick={triggerAudit} disabled={triggeringAudit} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
                  <RefreshCw size={10} /> Retry
                </button>
              </div>
            )}

            {/* Audit completed — score + categories */}
            {isAuditCompleted && report && (
              <div className="space-y-4">
                {/* Score summary */}
                <div className="flex items-center gap-4">
                  <ScoreCircle score={overallScore || 0} size="big" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Brand identity score</p>
                    {report.total_issues > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        {report.critical_count > 0 && <span className="text-[10px] font-semibold" style={{ color: 'var(--severe)' }}>{report.critical_count} critical</span>}
                        {report.high_count > 0 && <span className="text-[10px] font-semibold" style={{ color: 'var(--warn)' }}>{report.high_count} high</span>}
                        {(report.medium_count + report.low_count) > 0 && <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{report.medium_count + report.low_count} more</span>}
                      </div>
                    )}
                    {report.executive_summary && (
                      <p className="text-[11px] leading-relaxed mt-1.5 line-clamp-2" style={{ color: 'var(--m-muted)' }}>{report.executive_summary}</p>
                    )}
                  </div>
                </div>

                {/* Category scores */}
                {categoryScores.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                    {categoryScores.map(cat => {
                      const tint = CATEGORY_TINTS[cat.slug] || CATEGORY_TINTS.visual_consistency;
                      const CatIcon = CATEGORY_ICONS[cat.slug] || Target;
                      return (
                        <div
                          key={cat.slug}
                          className="rounded-lg p-2.5"
                          style={{ background: tint.bg, border: `1px solid ${tint.border}` }}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <CatIcon size={11} style={{ color: tint.dot }} />
                            <span className="text-[10px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{cat.name}</span>
                          </div>
                          <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: scoreColor(cat.score) }}>{cat.score}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Top findings */}
                {findings.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--m-muted)' }}>
                      Top findings ({findings.filter(f => !f.dismissed).length})
                    </p>
                    <div className="space-y-1">
                      {findings.filter(f => !f.dismissed).slice(0, 5).map(f => (
                        <div key={f.id} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                          <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full" style={{ background: sevColor(f.severity) }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>{f.title}</p>
                            {f.recommendation && (
                              <p className="text-[10px] leading-relaxed mt-0.5 line-clamp-1" style={{ color: 'var(--m-muted)' }}>{f.recommendation}</p>
                            )}
                          </div>
                          <span className="text-[9px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${sevColor(f.severity)} 10%, transparent)`, color: sevColor(f.severity) }}>
                            {sevLabel(f.severity)}
                          </span>
                        </div>
                      ))}
                      {findings.filter(f => !f.dismissed).length > 5 && (
                        <p className="text-[10px] pl-3 pt-1" style={{ color: 'var(--m-muted)' }}>
                          + {findings.filter(f => !f.dismissed).length - 5} more findings
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No audit yet */}
            {!audit && !auditLoading && !isAuditInProgress && (
              <div className="text-center py-4">
                <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                  {readyForBrandAudit
                    ? 'Run a Brand DNA audit to score your brand materials across 6 categories.'
                    : 'Upload brand files above to enable auditing.'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           SECTION 5: Include in Website Audit
           ══════════════════════════════════════════════════════ */}
        <section
          className="rounded-xl p-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Include in website audit</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                When enabled, your website audit will check design consistency against your brand standards.
              </p>
            </div>
            <div className="flex-shrink-0 ml-4">
              {readyForWebsiteAudit ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md" style={{ background: 'color-mix(in srgb, var(--ok) 8%, transparent)', color: 'var(--ok)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}>
                  <CheckCircle2 size={11} /> Available
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                  <AlertCircle size={11} /> Not ready
                </span>
              )}
            </div>
          </div>
          {!readyForWebsiteAudit && missingItems.length > 0 && (
            <div className="mt-3 rounded-lg p-2.5" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
              <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--m-muted)' }}>Missing requirements:</p>
              <div className="flex flex-wrap gap-1.5">
                {missingItems.map(item => (
                  <span key={item.key} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--warn) 8%, transparent)', color: 'var(--warn)', border: '1px solid color-mix(in srgb, var(--warn) 15%, transparent)' }}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
           SECTION 6: Recommendations
           ══════════════════════════════════════════════════════ */}
        {recommendations.length > 0 && (
          <section
            className="rounded-xl p-4"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--ink)' }}>Recommendations</h3>
            <div className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--signal) 3%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                  <Lightbulb size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
                  <p className="text-[12px] leading-snug" style={{ color: 'var(--ink)' }}>{rec}</p>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

function EmptyState({ title, body, ctaHref, ctaLabel }: { title: string; body: string; ctaHref: string; ctaLabel: string }) {
  return (
    <div className="rounded-xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'color-mix(in srgb, #8B5CF6 10%, transparent)' }}>
        <Fingerprint size={18} strokeWidth={1.6} style={{ color: '#8B5CF6' }} />
      </div>
      <p className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</p>
      <p className="text-[13px] mt-1 max-w-[500px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{body}</p>
      <Link href={ctaHref} className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
        {ctaLabel} <ArrowRight size={13} />
      </Link>
    </div>
  );
}

function StatusLine({ label, ready, reason }: { label: string; ready: boolean; reason?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ready ? (
        <CheckCircle2 size={11} style={{ color: 'var(--ok)' }} />
      ) : (
        <AlertCircle size={11} style={{ color: 'var(--warn)' }} />
      )}
      <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
      {ready ? (
        <span className="text-[10px] font-semibold" style={{ color: 'var(--ok)' }}>Ready</span>
      ) : reason ? (
        <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>— {reason}</span>
      ) : null}
    </div>
  );
}

function ProfileSlot({ label, value, filled, colors }: { label: string; value: string; filled: boolean; colors?: string[] }) {
  return (
    <div className="rounded-lg px-3 py-2 min-w-0" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          {label}
        </span>
        {filled && <CheckCircle2 size={9} style={{ color: 'var(--ok)' }} />}
      </div>
      {colors && colors.length > 0 && (
        <div className="flex items-center gap-1 mb-0.5">
          {colors.slice(0, 6).map((c, i) => (
            <span key={`${c}-${i}`} className="w-2.5 h-2.5 rounded-sm" style={{ background: c, border: '1px solid var(--rule)' }} title={c} />
          ))}
        </div>
      )}
      <p className="text-[12px] truncate font-medium" style={{ color: filled ? 'var(--ink)' : 'var(--m-muted)' }}>{value}</p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold tracking-[0.06em] uppercase mb-1" style={{ color: 'var(--m-muted)' }}>
        {label}{required && <span style={{ color: 'var(--severe)' }}> *</span>}
      </span>
      {children}
    </label>
  );
}

/* ── Brand audit in-progress ── */

function BrandAuditInProgress({ audit }: { audit: AuditRecord }) {
  const { data: progress } = useAuditProgress(audit.id);

  const steps = ['payment_received', 'crawling', 'analysing', 'generating_report'] as const;
  const currentIdx = steps.indexOf(audit.status as any);
  const stageLabels: Record<string, string> = {
    payment_received: 'Queued...',
    crawling: 'Extracting brand files...',
    analysing: 'Analyzing brand identity...',
    generating_report: 'Generating report...',
  };

  const progressPct = progress?.progress || Math.round(((currentIdx + 1) / steps.length) * 100);

  return (
    <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 15%, transparent)' }}>
      <div className="flex items-center gap-2.5">
        <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--signal)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>
            {stageLabels[audit.status] || 'Processing...'}
          </p>
          <div className="mt-1.5 h-1 w-full rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)' }}>
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%`, background: 'var(--signal)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
