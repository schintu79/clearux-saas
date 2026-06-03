'use client';

/**
 * Brand DNA Console — workspace for managing brand identity inputs, assets,
 * readiness state, and Brand DNA audit.
 *
 * Layout (redesigned):
 *  1. Top summary row — large readiness score (left), recommendations (right)
 *  2. Main row — Brand profile (left col) + Assets (right col)
 *  3. Brand DNA Audit — results section
 *  4. "Use in Website Audit" — popover CTA in page header
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Fingerprint,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Save,
  X,
  Palette,
  Upload,
  Trash2,
  Loader2,
  Play,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Sparkles,
  MoreVertical,
  Image as ImageIcon,
  Share2,
  Eye,
  MessageSquare,
  ShieldCheck,
  Target,
  Layers,
  Type,
  Lightbulb,
  CircleDot,
  Zap,
  Check,
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
  logo_file_id: string | null;
  brand_guide_file_id: string | null;
  brand_promise: string | null;
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
  brand_promise: string;
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

interface ClassifiedFileDetection {
  hasVoice: boolean;
  voice: string | null;
  toneKeywords: string[];
  hasColours: boolean;
  colours: string[];
  hasPromise: boolean;
  promise: string | null;
  isLogo: boolean;
  isIcon: boolean;
  isBrandGuide: boolean;
  classificationLabel: string;
  confidence: 'high' | 'medium' | 'low';
}

interface ClassifiedFile {
  fileName: string;
  fileType: string;
  detection: ClassifiedFileDetection;
}

interface BrandProfileSuggestion {
  brand_voice: string | null;
  tone_keywords: string[];
  primary_colors: string[];
  description: string | null;
  brandGuideFile: string | null;
  logoFile: string | null;
  logoFileUrl: string | null;
  files: ClassifiedFile[];
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
    brand_promise: b.brand_promise || '',
  };
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
// State model: Missing → Detected → Confirmed
// Readiness checks consider both confirmed (identity) AND detected (suggestion) state.

interface ReadinessItem {
  key: string;
  label: string;
  check: (identity: BrandIdentity, suggestion: BrandProfileSuggestion | null) => boolean;
}

const READINESS_ITEMS: ReadinessItem[] = [
  { key: 'logo', label: 'Logo', check: (i, s) =>
    !!i.logo_url
    || !!i.logo_file_id
    || i.brand_identity_files.some(f => (f.tag || '').toLowerCase() === 'logo')
    || !!(s?.logoFile) },
  { key: 'voice', label: 'Voice', check: (i, s) =>
    !!i.brand_voice || !!(s?.brand_voice) },
  { key: 'tone', label: 'Tone', check: (i, s) =>
    (i.tone_keywords && i.tone_keywords.length > 0)
    || (s?.tone_keywords && s.tone_keywords.length > 0)
    || false },
  { key: 'guide', label: 'Brand guide', check: (i, s) =>
    !!i.brand_guide_file_id
    || i.brand_identity_files.some(f =>
      (f.tag || '').toLowerCase() === 'brand guide'
      || (f.tag || '').toLowerCase() === 'voice'
      || (f.tag || '').toLowerCase() === 'messaging')
    || !!(s?.brandGuideFile) },
  { key: 'colours', label: 'Colours', check: (i, s) =>
    !!(i.primary_colors && i.primary_colors.length > 0)
    || (s?.primary_colors && s.primary_colors.length > 0)
    || false },
  { key: 'promise', label: 'Promise', check: (i, s) =>
    !!i.brand_promise || !!i.description || !!(s?.description) },
];

/* ══════════════════════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════════════════════ */

export default function BrandDnaPageWrapper() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto space-y-6"><div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--m-surface)' }} /><div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--m-surface)' }} /></div>}>
      <BrandDnaPage />
    </Suspense>
  );
}

function BrandDnaPage() {
  const { user, loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const searchParams = useSearchParams();
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

  /* ── Content analysis state ── */
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestion, setSuggestion] = useState<BrandProfileSuggestion | null>(null);
  const [applyingProfile, setApplyingProfile] = useState(false);

  /* ── Brand audit state ── */
  const [audit, setAudit] = useState<AuditRecord | null>(null);
  const [report, setReport] = useState<ReportRecord | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [triggeringAudit, setTriggeringAudit] = useState(false);

  /* ── Share / delete / menu state ── */
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [deletingAudit, setDeletingAudit] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ── Website audit popover state ── */
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  /* ── Close menu on outside click / Escape ── */
  useEffect(() => {
    if (!menuOpen && !popoverOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (popoverOpen && popoverRef.current && !popoverRef.current.contains(e.target as Node)) setPopoverOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); setPopoverOpen(false); }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, popoverOpen]);

  /* ── Load brand identity ── */
  const loadIdentity = useCallback(async () => {
    if (!user || !workspace) return null;
    try {
      // Primary path: query brand_identities by workspace_id (single source of truth)
      const res = await fetch(`/api/brand-identities?workspace_id=${workspace.id}`);
      if (!res.ok) {
        console.error('[BrandDNA] loadIdentity failed:', res.status, res.statusText);
        throw new Error('Failed to load brand DNA');
      }
      const data = await res.json();
      const identities = data.identities || [];

      if (identities.length > 0) {
        const latest = identities[0]; // already sorted by created_at desc

        // Self-heal: backfill workspace.active_brand_identity_id if stale or missing
        if (workspace.active_brand_identity_id !== latest.id) {
          fetch(`/api/workspaces/${workspace.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active_brand_identity_id: latest.id }),
          }).catch(() => {}); // fire-and-forget
        }

        // Self-heal: auto-populate website_url from workspace primary_domain
        if (!latest.website_url && workspace.primary_domain) {
          const domain = workspace.primary_domain;
          const url = domain.startsWith('http') ? domain : `https://${domain}`;
          latest.website_url = url; // update local copy immediately
          fetch(`/api/brand-identities/${latest.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ website_url: url }),
          }).catch(() => {}); // fire-and-forget persist
        }

        return latest;
      }

      return null;
    } catch (err) {
      console.error('[BrandDNA] loadIdentity error:', err);
      return null;
    }
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
    setSuggestion(null);

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

  /* ── Fallback: retry load when redirected from brand creation ──
   *  When the creation page does router.push() with ?newBrandId=...,
   *  React state from refreshWorkspace() may not have committed yet,
   *  causing the master useEffect to be skipped or to run with stale
   *  context. This effect retries after a short delay to catch those
   *  cases. It only fires once per newBrandId and cleans up the URL.
   */
  const retryAttemptedRef = useRef(false);
  useEffect(() => {
    const newBrandId = searchParams?.get('newBrandId');
    if (!newBrandId || identity || loading || retryAttemptedRef.current) return;
    // Only attempt once per mount
    retryAttemptedRef.current = true;

    const timer = setTimeout(async () => {
      if (!user || !workspace) return;
      try {
        const res = await fetch(`/api/brand-identities?workspace_id=${workspace.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const identities = data.identities || [];
        if (identities.length > 0) {
          setIdentity(identities[0]);
          setLoading(false);
          // Clean up the URL param so it doesn't interfere on refresh
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('newBrandId');
            window.history.replaceState({}, '', url.pathname);
          }
        }
      } catch (err) {
        console.error('[BrandDNA] newBrandId fallback error:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchParams, identity, loading, user, workspace]);

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
        brand_promise: editState.brand_promise.trim() || null,
        // Always send workspace_id — heals orphan records that had NULL workspace_id
        workspace_id: workspace?.id || undefined,
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Upload failed (${res.status})`);
        }
        ok++;
      } catch (err) { setUploadMsg(err instanceof Error ? err.message : `Failed to upload ${file.name}`); }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const updated = await loadIdentity();
    if (updated) setIdentity(updated);
    if (ok > 0 && !uploadMsg) setUploadMsg(`${ok} file${ok > 1 ? 's' : ''} uploaded`);
    setTimeout(() => setUploadMsg(null), 3000);

    // Auto-trigger content analysis after successful upload
    if (ok > 0 && updated) {
      autoAnalyzeAfterUpload(updated.id);
    }
  };

  /* ── Auto-analyze after upload ── */
  const autoAnalyzeAfterUpload = async (brandId: string) => {
    setAnalyzing(true);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/brand-identities/${brandId}/analyze-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Analysis failed');
      }
      const data = await res.json();
      setSuggestion(data.suggestion || null);
      // Reload identity to pick up file tags from classification
      const refreshed = await loadIdentity();
      if (refreshed) setIdentity(refreshed);
    } catch (err) {
      console.warn('Auto-analysis after upload failed:', err);
      setError(err instanceof Error ? err.message : 'File analysis failed. Try again.');
    } finally { setAnalyzing(false); }
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

  /* ── Analyze files (content-based classification) ── */
  const analyzeFiles = async () => {
    if (!identity) return;
    setAnalyzing(true);
    setSuggestion(null);
    setError(null);
    try {
      const res = await fetch(`/api/brand-identities/${identity.id}/analyze-files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Analysis failed');
      }
      const data = await res.json();
      setSuggestion(data.suggestion || null);
      // Reload identity to pick up file tags
      const refreshed = await loadIdentity();
      if (refreshed) setIdentity(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File analysis failed. Try again.');
    } finally { setAnalyzing(false); }
  };

  /* ── Apply detected profile fields (fast path — no re-classification) ── */
  const applyProfile = async () => {
    if (!identity || !suggestion) return;
    setApplyingProfile(true);
    try {
      const res = await fetch(`/api/brand-identities/${identity.id}/apply-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Update identity immediately from response (no reload needed)
      if (data.identity) {
        setIdentity(prev => prev ? { ...prev, ...data.identity } : prev);
      } else {
        // Fallback: reload from server
        const updated = await loadIdentity();
        if (updated) setIdentity(updated);
      }
      setSuggestion(null);
    } catch {
      setError('Failed to apply profile data.');
    } finally { setApplyingProfile(false); }
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
    return READINESS_ITEMS.map(r => ({ ...r, met: r.check(identity, suggestion) }));
  }, [identity, suggestion]);

  const readinessPercent = useMemo(() => {
    const met = readinessChecks.filter(r => r.met).length;
    return Math.round((met / readinessChecks.length) * 100);
  }, [readinessChecks]);

  const readyForBrandAudit = useMemo(() => {
    return !!(identity && identity.brand_identity_files.length > 0);
  }, [identity]);

  const readyForWebsiteAudit = useMemo(() => {
    return readinessChecks.every(r => r.met);
  }, [readinessChecks]);

  const missingItems = useMemo(() => readinessChecks.filter(r => !r.met), [readinessChecks]);

  /* ── Recommendations ── */
  const recommendations = useMemo(() => {
    if (!identity) return [];
    const recs: string[] = [];
    if (!identity.logo_url && !identity.logo_file_id && !identity.brand_identity_files.some(f => (f.tag || '').toLowerCase() === 'logo'))
      recs.push('Add a logo file to enable logo consistency checks.');
    if (!identity.brand_voice)
      recs.push('Define your brand voice — describe how your brand sounds and communicates.');
    if (!identity.tone_keywords || identity.tone_keywords.length === 0)
      recs.push('Add 3-5 tone keywords (e.g. "direct, warm, confident") for copy analysis.');
    if (!identity.brand_guide_file_id && !identity.brand_identity_files.some(f => ['brand guide', 'voice', 'messaging'].includes((f.tag || '').toLowerCase()) || isDocFile(f.file_name)))
      recs.push('Upload a brand guide to unlock full analysis.');
    if (!identity.primary_colors || identity.primary_colors.length === 0)
      recs.push('Add approved brand colours to check palette usage.');
    if (!identity.brand_promise && !identity.description)
      recs.push('Write a brand promise for value proposition checks.');
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
        <PageHeader icon={<Fingerprint size={18} strokeWidth={1.6} />} title="Brand DNA" subtitle="Manage your brand identity source of truth." />
        <EmptyState title="Select a workspace" body="Brand DNA is scoped to the workspace you have selected in the sidebar." ctaHref={`${dashPrefix}/new-audit`} ctaLabel="Run your first audit" />
      </div>
    );
  }

  if (!identity) {
    return (
      <div>
        <PageHeader icon={<Fingerprint size={18} strokeWidth={1.6} />} title="Brand DNA" subtitle={siteLabel ? `Brand identity for ${siteLabel}` : 'Manage your brand identity source of truth.'} />
        <EmptyState title={!workspace.primary_domain ? 'No Brand DNA on file yet' : `No Brand DNA for ${siteLabel || 'this site'}`} body="Add your brand name, voice, colours, and upload guidelines so audits can score design consistency against your brand standards." ctaHref={`${dashPrefix}/brand-identity/new`} ctaLabel="Add Brand DNA" />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Full page — Brand DNA Console
     ══════════════════════════════════════════════════════════ */

  return (
    <div>
      {/* ── Page header with "Use in Website Audit" popover ── */}
      <PageHeader
        icon={<Fingerprint size={18} strokeWidth={1.6} />}
        title="Brand DNA"
        subtitle={siteLabel ? `Brand identity console for ${siteLabel}` : 'Your brand identity source of truth.'}
      >
        {/* "Use in Website Audit" CTA — popover in header */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setPopoverOpen(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all hover:opacity-90"
            style={{
              background: readyForWebsiteAudit ? 'var(--ink)' : 'var(--paper-2)',
              color: readyForWebsiteAudit ? 'var(--paper)' : 'var(--m-muted)',
              border: readyForWebsiteAudit ? 'none' : '1px solid var(--rule)',
            }}
          >
            <Zap size={11} />
            Use in website audit
            <ChevronDown size={10} className={clsx('transition-transform', popoverOpen && 'rotate-180')} />
          </button>

          {popoverOpen && (
            <div
              className="absolute right-0 top-10 z-50 w-80 rounded-xl p-4 shadow-lg"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                Design consistency check
              </p>
              <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--m-muted)' }}>
                When enabled, your next website audit will include a Design Consistency module that checks your live site against these brand standards.
              </p>

              {/* Readiness status */}
              <div className="rounded-lg p-2.5 mb-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  {readyForWebsiteAudit ? (
                    <>
                      <CheckCircle2 size={12} style={{ color: 'var(--ok)' }} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>Ready to use</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} style={{ color: 'var(--warn)' }} />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>
                        {missingItems.length} item{missingItems.length === 1 ? '' : 's'} missing
                      </span>
                    </>
                  )}
                </div>
                {!readyForWebsiteAudit && (
                  <div className="flex flex-wrap gap-1">
                    {readinessChecks.map(item => (
                      <span
                        key={item.key}
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: item.met ? 'color-mix(in srgb, var(--ok) 8%, transparent)' : 'color-mix(in srgb, var(--warn) 8%, transparent)',
                          color: item.met ? 'var(--ok)' : 'var(--warn)',
                        }}
                      >
                        {item.met ? <Check size={8} /> : <CircleDot size={8} />}
                        {item.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {readyForWebsiteAudit ? (
                <Link
                  href={`${dashPrefix}/new-audit`}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all hover:opacity-90"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                  onClick={() => setPopoverOpen(false)}
                >
                  <Play size={11} /> Run website audit with Brand DNA
                </Link>
              ) : (
                <p className="text-[10px] text-center" style={{ color: 'var(--m-muted)' }}>
                  Complete the missing items above to enable this feature.
                </p>
              )}
            </div>
          )}
        </div>
      </PageHeader>

      {error && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 14%, transparent)' }}>
          <AlertCircle size={13} style={{ color: 'var(--severe)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ink)' }}>{error}</span>
        </div>
      )}

      <div className="space-y-5">

        {/* ══════════════════════════════════════════════════════
           TOP SUMMARY ROW — Readiness score (left) + Recommendations (right)
           ══════════════════════════════════════════════════════ */}
        <section
          className="rounded-xl p-5"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left — Readiness score */}
            <div className="flex items-center gap-5 flex-1 min-w-0">
              {/* Completion ring — larger */}
              <div className="flex-shrink-0">
                <div className="relative w-20 h-20">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="var(--rule)" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="14" fill="none"
                      stroke={readinessPercent === 100 ? 'var(--ok)' : readinessPercent >= 60 ? 'var(--signal)' : 'var(--warn)'}
                      strokeWidth="2.5"
                      strokeDasharray={`${readinessPercent * 0.88} 88`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[18px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                    {readinessPercent}%
                  </span>
                </div>
              </div>

              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>Brand DNA readiness</h2>
                {/* Status pills — small and secondary */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {readinessChecks.map(item => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: item.met ? 'color-mix(in srgb, var(--ok) 8%, transparent)' : 'var(--paper-2)',
                        color: item.met ? 'var(--ok)' : 'var(--m-muted)',
                        border: `1px solid ${item.met ? 'color-mix(in srgb, var(--ok) 20%, transparent)' : 'var(--rule)'}`,
                      }}
                    >
                      {item.met ? <CheckCircle2 size={8} /> : <CircleDot size={8} />}
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — Recommendations */}
            {recommendations.length > 0 && (
              <div className="lg:w-[340px] flex-shrink-0 lg:border-l lg:pl-5" style={{ borderColor: 'var(--rule)' }}>
                <h3 className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-2" style={{ color: 'var(--m-muted)' }}>
                  Recommendations
                </h3>
                <div className="space-y-1">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Lightbulb size={10} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
                      <p className="text-[11px] leading-snug" style={{ color: 'var(--ink)' }}>{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
           MAIN ROW — Brand Profile (left) + Assets (right)
           ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Brand Profile ── */}
          <section
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div className="flex items-center justify-between p-4 pb-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                  <Fingerprint size={12} style={{ color: 'var(--ink)' }} />
                </div>
                <h3 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Brand profile</h3>
              </div>
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
                    <input value={editState.logo_url} onChange={e => setEditState({ ...editState, logo_url: e.target.value })} placeholder="https://cdn.example.com/logo.svg" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={2048} />
                  </Field>
                  <Field label="Brand voice">
                    <textarea value={editState.brand_voice} onChange={e => setEditState({ ...editState, brand_voice: e.target.value })} placeholder="How does your brand sound?" rows={2} className="w-full px-3 py-2 rounded-lg text-[13px] resize-y outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={4000} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Tone keywords">
                      <input value={editState.tone_keywords} onChange={e => setEditState({ ...editState, tone_keywords: e.target.value })} placeholder="confident, warm, direct" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} />
                    </Field>
                    <Field label="Brand colours">
                      <input value={editState.primary_colors} onChange={e => setEditState({ ...editState, primary_colors: e.target.value })} placeholder="#0A84FF, #111111" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} />
                    </Field>
                  </div>
                  <Field label="Brand promise">
                    <textarea value={editState.brand_promise} onChange={e => setEditState({ ...editState, brand_promise: e.target.value })} placeholder="Who you serve and the change you create." rows={2} className="w-full px-3 py-2 rounded-lg text-[13px] resize-y outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={600} />
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
                <div className="space-y-1.5">
                  <ProfileRow label="Name" value={identity.name} filled />
                  <ProfileRow label="Website" value={identity.website_url || 'Not set'} filled={!!identity.website_url} />
                  <ProfileRow label="Logo" value={(identity.logo_url || identity.logo_file_id) ? 'On file' : 'Not set'} filled={!!(identity.logo_url || identity.logo_file_id)} />
                  <ProfileRow label="Voice" value={identity.brand_voice ? (identity.brand_voice.length > 60 ? identity.brand_voice.slice(0, 58) + '...' : identity.brand_voice) : 'Not set'} filled={!!identity.brand_voice} />
                  <ProfileRow label="Tone" value={(identity.tone_keywords || []).length > 0 ? (identity.tone_keywords || []).slice(0, 4).join(', ') : 'Not set'} filled={(identity.tone_keywords || []).length > 0} />
                  <ProfileRow label="Colours" value={(identity.primary_colors || []).length > 0 ? `${(identity.primary_colors || []).length} defined` : 'Not set'} filled={(identity.primary_colors || []).length > 0} colors={identity.primary_colors || undefined} />
                  <ProfileRow label="Promise" value={(identity.brand_promise || identity.description) ? ((identity.brand_promise || identity.description || '').length > 50 ? (identity.brand_promise || identity.description || '').slice(0, 48) + '...' : (identity.brand_promise || identity.description || '')) : 'Not set'} filled={!!(identity.brand_promise || identity.description)} />
                </div>
              )}
            </div>
          </section>

          {/* ── Assets ── */}
          {!editing && (
            <section
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <div className="p-4 pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                      <Upload size={12} style={{ color: 'var(--ink)' }} />
                    </div>
                    <h3 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                      Assets
                      <span className="ml-2 text-[11px] font-normal" style={{ color: 'var(--m-muted)' }}>
                        {identity.brand_identity_files.length} file{identity.brand_identity_files.length === 1 ? '' : 's'}
                      </span>
                    </h3>
                  </div>
                  {/* Analyze button */}
                  {identity.brand_identity_files.length > 0 && !suggestion && (
                    <button
                      onClick={analyzeFiles}
                      disabled={analyzing}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all hover:opacity-80"
                      style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)', color: 'var(--signal)', border: '1px solid color-mix(in srgb, var(--signal) 20%, transparent)' }}
                    >
                      {analyzing ? <><Loader2 size={10} className="animate-spin" /> Analyzing...</> : <><Sparkles size={10} /> Detect brand info</>}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4">
                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed transition-all cursor-pointer"
                  style={{
                    borderColor: dragOver ? 'var(--signal)' : 'color-mix(in srgb, var(--signal) 30%, var(--rule))',
                    background: dragOver ? 'color-mix(in srgb, var(--signal) 6%, transparent)' : 'color-mix(in srgb, var(--signal) 2%, transparent)',
                  }}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--signal)' }} />
                      <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                        <Upload size={12} style={{ color: 'var(--signal)' }} />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Drop files or click to browse</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>Brand guides, logos, style assets</p>
                      </div>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg,.webp" multiple onChange={e => { if (e.target.files) uploadFiles(e.target.files); }} className="hidden" />

                {uploadMsg && (
                  <p className="text-[11px] mt-2" style={{ color: uploadMsg.includes('Failed') || uploadMsg.includes('exceeds') ? 'var(--severe)' : 'var(--ok)' }}>{uploadMsg}</p>
                )}

                {/* Content analysis suggestion banner */}
                {suggestion && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--signal) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 15%, transparent)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={12} style={{ color: 'var(--signal)' }} />
                      <span className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Brand info detected</span>
                    </div>
                    <div className="space-y-1 mb-3">
                      {suggestion.brand_voice && <DetectedField label="Voice" value={suggestion.brand_voice.slice(0, 80) + (suggestion.brand_voice.length > 80 ? '...' : '')} />}
                      {suggestion.tone_keywords.length > 0 && <DetectedField label="Tone" value={suggestion.tone_keywords.join(', ')} />}
                      {suggestion.primary_colors.length > 0 && <DetectedField label="Colours" value={suggestion.primary_colors.join(', ')} colors={suggestion.primary_colors} />}
                      {suggestion.description && <DetectedField label="Promise" value={suggestion.description.slice(0, 80) + (suggestion.description.length > 80 ? '...' : '')} />}
                      {suggestion.brandGuideFile && <DetectedField label="Brand guide" value={suggestion.brandGuideFile} />}
                      {suggestion.logoFile && <DetectedField label="Logo" value={suggestion.logoFile} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={applyProfile}
                        disabled={applyingProfile}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md transition-all"
                        style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: applyingProfile ? 0.6 : 1 }}
                      >
                        {applyingProfile ? <><Loader2 size={10} className="animate-spin" /> Applying...</> : <><Check size={10} /> Apply to profile</>}
                      </button>
                      <button
                        onClick={() => setSuggestion(null)}
                        className="text-[11px] font-medium px-2 py-1.5 rounded-md"
                        style={{ color: 'var(--m-muted)' }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* File list */}
                {identity.brand_identity_files.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {identity.brand_identity_files.map(f => {
                      const classified = suggestion?.files.find(cf => cf.fileName === f.file_name);
                      return (
                        <div key={f.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg group transition-all" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card)' }}>
                            {isDocFile(f.file_name) ? <FileText size={11} style={{ color: 'var(--m-muted)' }} /> : <ImageIcon size={11} style={{ color: 'var(--m-muted)' }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>{f.file_name}</p>
                            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--m-muted)' }}>
                              <span>{fileTypeLabel(f.file_name)}</span>
                              {f.file_size_bytes && <><span style={{ color: 'var(--rule)' }}>·</span><span>{formatBytes(f.file_size_bytes)}</span></>}
                              {(f.tag || classified?.detection.classificationLabel) && (
                                <><span style={{ color: 'var(--rule)' }}>·</span><span className="font-medium" style={{ color: 'var(--signal)' }}>{f.tag || classified?.detection.classificationLabel}</span></>
                              )}
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
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════
           Brand DNA Audit
           ══════════════════════════════════════════════════════ */}
        <section
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)' }}>
                  <Target size={12} style={{ color: 'var(--ink)' }} />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Brand DNA audit</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    Scores your brand materials across 6 categories.
                  </p>
                </div>
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
                        <div role="menu" className="absolute right-0 top-9 z-50 w-52 rounded-xl py-1 shadow-lg" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                          <button type="button" onClick={() => { handleShare(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-black/[0.03] transition-colors text-left" style={{ color: 'var(--ink)' }}>
                            <Share2 size={11} style={{ color: 'var(--m-muted)' }} />
                            {shareUrl ? 'Copy share link' : 'Create share link'}
                          </button>
                          <button type="button" onClick={() => { setMenuOpen(false); handleDeleteAudit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-red-50 transition-colors text-left" style={{ color: 'var(--severe)' }}>
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
            {isAuditInProgress && audit && <BrandAuditInProgress audit={audit} />}

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

                {categoryScores.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                    {categoryScores.map(cat => {
                      const tint = CATEGORY_TINTS[cat.slug] || CATEGORY_TINTS.visual_consistency;
                      const CatIcon = CATEGORY_ICONS[cat.slug] || Target;
                      return (
                        <div key={cat.slug} className="rounded-lg p-2.5" style={{ background: tint.bg, border: `1px solid ${tint.border}` }}>
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
                  {readyForBrandAudit ? 'Run a Brand DNA audit to score your brand materials across 6 categories.' : 'Upload brand files above to enable auditing.'}
                </p>
              </div>
            )}
          </div>
        </section>

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

function ProfileRow({ label, value, filled, colors }: { label: string; value: string; filled: boolean; colors?: string[] }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
      <span className="text-[10px] font-semibold tracking-[0.04em] uppercase w-16 flex-shrink-0" style={{ color: 'var(--m-muted)' }}>
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {colors && colors.length > 0 && (
          <div className="flex items-center gap-1">
            {colors.slice(0, 6).map((c, i) => (
              <span key={`${c}-${i}`} className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: c, border: '1px solid var(--rule)' }} title={c} />
            ))}
          </div>
        )}
        <p className="text-[12px] truncate font-medium" style={{ color: filled ? 'var(--ink)' : 'var(--m-muted)' }}>{value}</p>
      </div>
      {filled && <CheckCircle2 size={10} className="flex-shrink-0" style={{ color: 'var(--ok)' }} />}
    </div>
  );
}

function DetectedField({ label, value, colors }: { label: string; value: string; colors?: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-[0.04em] uppercase w-14 flex-shrink-0" style={{ color: 'var(--signal)' }}>{label}</span>
      {colors && colors.length > 0 && (
        <div className="flex items-center gap-0.5">
          {colors.slice(0, 6).map((c, i) => (
            <span key={`${c}-${i}`} className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
          ))}
        </div>
      )}
      <span className="text-[11px] truncate" style={{ color: 'var(--ink)' }}>{value}</span>
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
