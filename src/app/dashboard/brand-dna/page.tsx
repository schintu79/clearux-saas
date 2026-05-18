'use client';

/**
 * Brand DNA — unified workspace for brand identity + brand audit.
 *
 * Three zones:
 *  1. Brand DNA card — view / edit brand fields + inline file upload
 *  2. Run Brand Audit — trigger from this tab (audit lives only here)
 *  3. Audit results — score card + flat findings list
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
  Zap,
  Download,
  Share2,
  Check,
  Eye,
  MessageSquare,
  ShieldCheck,
  Target,
  Layers,
  Type,
  Sparkles,
  TrendingUp,
  Lightbulb,
  MoreVertical,
  File,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import { BRAND_AUDIT_CATEGORIES } from '@/lib/brand-audit-modules';
import ScoreRing from '@/components/ui/ScoreRing';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import clsx from 'clsx';

/* ── Types ──────────────────────────────────────────────── */

interface BrandFile {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes?: number | null;
  created_at?: string;
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

function sevCardBg(sev: string): string {
  const v = sev === 'critical' ? 'var(--severe)'
    : sev === 'high' ? 'var(--warn)'
    : sev === 'low' ? 'var(--ok)'
    : 'var(--signal)';
  return `color-mix(in srgb, ${v} 4%, #ffffff)`;
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

/* ══════════════════════════════════════════════════════════
   Main Page
   ══════════════════════════════════════════════════════════ */

export default function BrandDnaPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();

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

  /* ── Load brand identity ── */
  const loadIdentity = useCallback(async () => {
    if (!user || !selection) return null;
    try {
      if (selection.kind === 'brand') {
        const res = await fetch(`/api/brand-identities/${selection.brandId}`);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Failed to load brand DNA');
        const data = await res.json();
        return data.identity || null;
      }
      // site selection — find linked brand identity
      const supabase = createBrowserSupabase();
      const { data: audits } = await supabase
        .from('audits')
        .select('product_url, brand_identity_id, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false, nullsFirst: false } as any)
        .limit(100);
      const match = (audits || []).find((a: any) => hostnameOf(a.product_url) === selection.host && !!a.brand_identity_id);
      if (!match) return null;
      const res = await fetch(`/api/brand-identities/${(match as any).brand_identity_id}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to load brand DNA');
      const data = await res.json();
      return data.identity || null;
    } catch { return null; }
  }, [user, selection]);

  /* ── Load latest brand audit for this identity ── */
  const loadBrandAudit = useCallback(async (brandId: string) => {
    const supabase = createBrowserSupabase();
    const { data: audits } = await supabase
      .from('audits')
      .select('*')
      .eq('brand_identity_id', brandId)
      .eq('audit_type', 'brand_identity')
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
    if (authLoading || !user || !ready) {
      if (!authLoading && ready) setLoading(false);
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
      if (!selection) { if (!cancelled) setLoading(false); return; }
      if (selection.kind === 'site') setSiteLabel(selection.host);
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
  }, [authLoading, user, ready, selection, loadIdentity, loadBrandAudit]);

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
    // Reload identity to get updated file list
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
      const supabase = createBrowserSupabase();
      // Check credits
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('credits_remaining, plan_type')
        .eq('user_id', user.id)
        .maybeSingle();
      const hasCredits = (profile as any)?.credits_remaining > 0 || (profile as any)?.plan_type === 'unlimited';

      const { data: newAudit, error: err } = await supabase
        .from('audits')
        .insert({
          user_id: user.id,
          status: hasCredits ? 'payment_received' : 'pending_payment',
          product_type: 'auto_detect',
          ux_concern: 'Brand identity audit',
          notes: null,
          plan: 'full_audit',
          language: 'en',
          audit_type: 'brand_identity',
          brand_identity_id: identity.id,
          depth_mode: 'deep',
        })
        .select('id, status, created_at, updated_at, brand_identity_id')
        .single();

      if (err) throw err;
      setAudit(newAudit as AuditRecord);
      setReport(null);
      setFindings([]);
    } catch (err) {
      setError('Failed to start brand audit.');
    } finally { setTriggeringAudit(false); }
  };

  /* ── Computed ── */
  const reportJson = useMemo<BrandReportJson | null>(() => {
    if (!report?.raw_json) return null;
    const rj = report.raw_json as any;
    if (rj.type !== 'brand_identity') return null;
    return rj as BrandReportJson;
  }, [report]);

  const categoryScores = useMemo(() => reportJson?.categoryResults || [], [reportJson]);

  const selectedLabel = selection?.kind === 'brand'
    ? (identity?.name || 'this brand')
    : (selection?.kind === 'site' ? selection.host : null);

  const completion = useMemo(() => {
    if (!identity) return 0;
    const tone = identity.tone_keywords || [];
    const colors = identity.primary_colors || [];
    const slots = [identity.name, identity.description, identity.website_url, identity.brand_voice, tone.length > 0, colors.length > 0, identity.logo_url];
    return Math.round((slots.filter(Boolean).length / slots.length) * 100);
  }, [identity]);

  const docs = useMemo(() => identity?.brand_identity_files.filter(f => isDocFile(f.file_name)) || [], [identity]);
  const visuals = useMemo(() => identity?.brand_identity_files.filter(f => !isDocFile(f.file_name)) || [], [identity]);

  /* ── Skeleton ── */
  if (authLoading || loading || !ready) {
    return (
      <div>
        <OverviewBreadcrumb current="Brand DNA" />
        <div className="h-7 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-4 w-72 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-[100px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  /* ── Empty states ── */
  if (!selection) {
    return (
      <div>
        <Header label={null} />
        <EmptyState
          title="Pick a brand to see its DNA"
          body="Brand DNA is scoped to the brand you have selected in the sidebar."
          ctaHref="/dashboard/new-audit"
          ctaLabel="Run your first audit"
        />
      </div>
    );
  }

  if (!identity) {
    return (
      <div>
        <Header label={selectedLabel} />
        <EmptyState
          title={selection.kind === 'brand' ? 'No Brand DNA on file yet' : `No Brand DNA for ${siteLabel || 'this site'}`}
          body="Add your brand name, voice, colours, and upload guidelines so we can audit brand consistency."
          ctaHref="/dashboard/brand-identity/new"
          ctaLabel="Add brand DNA"
        />
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     Full page — DNA card + file upload + audit section
     ══════════════════════════════════════════════════════════ */

  const isAuditInProgress = audit && ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit.status);
  const isAuditCompleted = audit?.status === 'completed';
  const isAuditFailed = audit?.status === 'failed';
  const overallScore = report?.overall_score ?? null;
  const hasFiles = identity.brand_identity_files.length > 0;

  return (
    <div>
      <Header label={selectedLabel} />

      {error && (
        <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 14%, transparent)' }}>
          <AlertCircle size={13} style={{ color: 'var(--severe)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ink)' }}>{error}</span>
        </div>
      )}

      {/* ── 1. DNA Card ───────────────────────────────────── */}
      <section
        className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, #8B5CF6 10%, transparent)' }}>
              <Fingerprint size={15} strokeWidth={1.6} style={{ color: '#8B5CF6' }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{identity.name}</h2>
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                DNA captured: <span style={{ color: completion >= 70 ? 'var(--ok)' : completion >= 40 ? 'var(--warn)' : 'var(--severe)' }} className="font-semibold">{completion}%</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={cancelEdit} disabled={saving} className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-md" style={{ color: 'var(--m-muted)', border: '1px solid var(--rule)' }}>
                  <X size={11} /> Cancel
                </button>
                <button onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-md" style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: saving ? 0.6 : 1 }}>
                  <Save size={11} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button onClick={beginEdit} className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-md" style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--rule)' }}>
                <Edit2 size={11} /> Edit DNA
              </button>
            )}
          </div>
        </div>

        {/* Edit form */}
        {editing && editState ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Brand name" required>
              <input value={editState.name} onChange={e => setEditState({ ...editState, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={120} />
            </Field>
            <Field label="Website URL">
              <input value={editState.website_url} onChange={e => setEditState({ ...editState, website_url: e.target.value })} placeholder="https://example.com" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={2048} />
            </Field>
            <Field label="Brand promise" full>
              <textarea value={editState.description} onChange={e => setEditState({ ...editState, description: e.target.value })} placeholder="Who you serve and the change you create." rows={2} className="w-full px-3 py-2 rounded-lg text-[13px] resize-y outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={600} />
            </Field>
            <Field label="Brand voice" full>
              <textarea value={editState.brand_voice} onChange={e => setEditState({ ...editState, brand_voice: e.target.value })} placeholder="How does your brand sound? Confident but not corporate." rows={2} className="w-full px-3 py-2 rounded-lg text-[13px] resize-y outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={4000} />
            </Field>
            <Field label="Tone keywords (comma-separated)">
              <input value={editState.tone_keywords} onChange={e => setEditState({ ...editState, tone_keywords: e.target.value })} placeholder="confident, warm, direct" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} />
            </Field>
            <Field label="Brand colours (comma-separated hex)">
              <input value={editState.primary_colors} onChange={e => setEditState({ ...editState, primary_colors: e.target.value })} placeholder="#0A84FF, #111111" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} />
            </Field>
            <Field label="Logo URL" full>
              <input value={editState.logo_url} onChange={e => setEditState({ ...editState, logo_url: e.target.value })} placeholder="https://cdn.example.com/logo.svg" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }} maxLength={2048} />
            </Field>
            {saveError && (
              <div className="md:col-span-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }}>{saveError}</div>
            )}
          </div>
        ) : (
          /* View mode — compact grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <Slot icon={Fingerprint} label="Name" value={identity.name} filled />
            <Slot icon={GlobeIcon} label="Website" value={identity.website_url || 'Not set'} filled={!!identity.website_url} />
            <Slot icon={Volume2} label="Voice" value={(identity.tone_keywords || []).length > 0 ? (identity.tone_keywords || []).slice(0, 3).join(', ') : (identity.brand_voice ? 'On file' : 'Not set')} filled={!!(identity.brand_voice || (identity.tone_keywords || []).length)} />
            <Slot icon={Palette} label="Colours" value={(identity.primary_colors || []).length > 0 ? `${(identity.primary_colors || []).length} colour${(identity.primary_colors || []).length === 1 ? '' : 's'}` : 'Not set'} filled={(identity.primary_colors || []).length > 0} colors={identity.primary_colors || undefined} />
            <Slot icon={ImageIcon} label="Logo" value={identity.logo_url ? 'On file' : 'Not set'} filled={!!identity.logo_url} />
            <Slot icon={FileText} label="Promise" value={identity.description ? (identity.description.length > 32 ? identity.description.slice(0, 30) + '...' : identity.description) : 'Not set'} filled={!!identity.description} />
            <Slot icon={FileText} label="Documents" value={`${docs.length} file${docs.length === 1 ? '' : 's'}`} filled={docs.length > 0} />
            <Slot icon={ImageIcon} label="Assets" value={`${visuals.length} file${visuals.length === 1 ? '' : 's'}`} filled={visuals.length > 0} />
          </div>
        )}
      </section>

      {/* ── 2. File Upload ────────────────────────────────── */}
      {!editing && (
        <section
          className="rounded-xl p-4 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Brand files</h3>
            <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
              {identity.brand_identity_files.length} file{identity.brand_identity_files.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files); }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-4 rounded-lg border-2 border-dashed transition-all cursor-pointer"
            style={{
              borderColor: dragOver ? 'var(--signal)' : 'var(--rule)',
              background: dragOver ? 'color-mix(in srgb, var(--signal) 4%, transparent)' : 'transparent',
            }}
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" style={{ color: 'var(--signal)' }} /><span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Uploading...</span></>
            ) : (
              <><Upload size={14} style={{ color: 'var(--m-muted)' }} /><span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>Drop brand guidelines, logos, or assets here</span></>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg,.webp" multiple onChange={e => { if (e.target.files) uploadFiles(e.target.files); }} className="hidden" />

          {uploadMsg && (
            <p className="text-[11px] mt-2" style={{ color: uploadMsg.includes('Failed') ? 'var(--severe)' : 'var(--ok)' }}>{uploadMsg}</p>
          )}

          {/* File list */}
          {identity.brand_identity_files.length > 0 && (
            <div className="mt-3 space-y-1">
              {identity.brand_identity_files.map(f => (
                <div key={f.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg group transition-all" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                  <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--card)' }}>
                    {isDocFile(f.file_name) ? <FileText size={11} style={{ color: 'var(--m-muted)' }} /> : <File size={11} style={{ color: 'var(--m-muted)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>{f.file_name}</p>
                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--m-muted)' }}>
                      <span>{fileTypeLabel(f.file_name)}</span>
                      {f.file_size_bytes && <><span style={{ color: 'var(--rule)' }}>·</span><span>{formatBytes(f.file_size_bytes)}</span></>}
                      {f.created_at && <><span style={{ color: 'var(--rule)' }}>·</span><span>{new Date(f.created_at).toLocaleDateString()}</span></>}
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
        </section>
      )}

      {/* ── 3. Brand Audit ────────────────────────────────── */}
      <section>
        {/* No audit yet — trigger CTA */}
        {!audit && !auditLoading && (
          <div
            className="rounded-xl p-5 text-center"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)' }}>
              <Sparkles size={18} style={{ color: 'var(--signal)' }} />
            </div>
            <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Audit your brand identity</p>
            <p className="text-[12px] mb-4 max-w-sm mx-auto" style={{ color: 'var(--m-muted)' }}>
              {hasFiles
                ? 'We will analyze your brand files across 6 categories and score consistency, voice, and professionalism.'
                : 'Upload brand guidelines or assets first, then run an audit to score your brand identity.'}
            </p>
            <button
              onClick={triggerAudit}
              disabled={triggeringAudit || !hasFiles}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
              style={{
                background: hasFiles ? 'var(--ink)' : 'var(--paper-2)',
                color: hasFiles ? 'var(--paper)' : 'var(--m-muted)',
                opacity: triggeringAudit ? 0.6 : 1,
                cursor: hasFiles ? 'pointer' : 'not-allowed',
              }}
            >
              {triggeringAudit ? <><Loader2 size={13} className="animate-spin" /> Starting...</> : <><Play size={13} /> Run brand audit</>}
            </button>
            {!hasFiles && (
              <p className="text-[11px] mt-2" style={{ color: 'var(--m-muted)' }}>Upload at least one brand file to enable auditing.</p>
            )}
          </div>
        )}

        {/* In progress */}
        {isAuditInProgress && audit && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--signal)' }} />
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {audit.status === 'payment_received' && 'Queued...'}
                  {audit.status === 'crawling' && 'Extracting brand files...'}
                  {audit.status === 'analysing' && 'Analyzing brand identity...'}
                  {audit.status === 'generating_report' && 'Generating report...'}
                </p>
                <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>This updates automatically.</p>
              </div>
            </div>
            <div className="flex gap-1">
              {['payment_received', 'crawling', 'analysing', 'generating_report'].map((step, idx) => {
                const currentIdx = ['payment_received', 'crawling', 'analysing', 'generating_report'].indexOf(audit.status);
                return (
                  <div key={step} className="flex-1 h-1.5 rounded-full transition-colors" style={{ background: idx <= currentIdx ? 'var(--signal)' : 'var(--paper-2)' }} />
                );
              })}
            </div>
          </div>
        )}

        {/* Failed */}
        {isAuditFailed && audit && (
          <div
            className="rounded-xl p-5 flex items-center justify-between gap-4"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} style={{ color: 'var(--severe)' }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Audit failed</p>
                <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>{(audit as any).crawl_error || 'Something went wrong.'}</p>
              </div>
            </div>
            <button onClick={triggerAudit} disabled={triggeringAudit} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* ── Completed: Score card + findings ──────────── */}
        {isAuditCompleted && report && (
          <div className="space-y-4">
            {/* Score card */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <div className="p-5 flex items-center gap-5">
                <ScoreRing score={overallScore || 0} size={80} strokeWidth={5} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[16px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Brand Identity Score</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {categoryScores.map(cat => {
                      const tint = CATEGORY_TINTS[cat.slug] || CATEGORY_TINTS.visual_consistency;
                      return (
                        <div key={cat.slug} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: tint.dot }} />
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{cat.name}</span>
                          <span className="text-[11px] font-semibold" style={{ color: scoreColor(cat.score) }}>{cat.score}</span>
                        </div>
                      );
                    })}
                  </div>
                  {report.total_issues > 0 && (
                    <div className="flex items-center gap-3 mt-2">
                      {report.critical_count > 0 && <span className="text-[11px] font-semibold" style={{ color: 'var(--severe)' }}>{report.critical_count} critical</span>}
                      {report.high_count > 0 && <span className="text-[11px] font-semibold" style={{ color: 'var(--warn)' }}>{report.high_count} high</span>}
                      {(report.medium_count + report.low_count) > 0 && <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{report.medium_count + report.low_count} more</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Action strip */}
              <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: '1px solid var(--rule)' }}>
                <a href={`/api/reports/${audit!.id}/pdf`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all" style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}>
                  <Download size={11} /> PDF
                </a>
                <a href={`/api/reports/${audit!.id}/docx`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all" style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}>
                  <Download size={11} /> Word
                </a>
                <div className="flex-1" />
                <button
                  onClick={triggerAudit}
                  disabled={triggeringAudit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
                  style={{ color: 'var(--ink)', border: '1px solid var(--rule)' }}
                >
                  <RefreshCw size={11} /> Re-audit
                </button>
              </div>
            </div>

            {/* Executive summary */}
            {report.executive_summary && (
              <div className="rounded-xl px-5 py-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--m-muted)' }}>Summary</p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink)' }}>{report.executive_summary}</p>
              </div>
            )}

            {/* Findings — flat list grouped by category */}
            {findings.length > 0 && (
              <div>
                <p className="text-[11px] mb-2 px-1" style={{ color: 'var(--m-muted)' }}>{findings.filter(f => !f.dismissed).length} findings</p>
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                  {findings.filter(f => !f.dismissed).map(f => (
                    <FindingRow key={f.id} finding={f} categoryScores={categoryScores} />
                  ))}
                </div>
                {/* Dismissed count */}
                {findings.filter(f => f.dismissed).length > 0 && (
                  <p className="text-[11px] mt-2 px-1" style={{ color: 'var(--m-muted)' }}>
                    {findings.filter(f => f.dismissed).length} dismissed
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

function Header({ label }: { label: string | null }) {
  return (
    <div className="mb-5">
      <OverviewBreadcrumb current="Brand DNA" />
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Brand DNA</h1>
      <p className="text-[13px] mt-0.5 max-w-[600px]" style={{ color: 'var(--m-muted)' }}>
        {label
          ? <>Your brand identity for <strong style={{ color: 'var(--ink)' }}>{label}</strong>. Upload guidelines, edit DNA fields, and audit brand consistency.</>
          : 'Capture your brand identity so audits can score consistency.'}
      </p>
    </div>
  );
}

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

function Slot({ icon: Icon, label, value, filled, colors }: { icon: React.ElementType; label: string; value: string; filled: boolean; colors?: string[] }) {
  return (
    <div className="rounded-lg px-3 py-2 min-w-0" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          <Icon size={9} strokeWidth={1.6} /> {label}
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

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? 'md:col-span-2' : ''}`}>
      <span className="block text-[10px] font-semibold tracking-[0.06em] uppercase mb-1" style={{ color: 'var(--m-muted)' }}>
        {label}{required && <span style={{ color: 'var(--severe)' }}> *</span>}
      </span>
      {children}
    </label>
  );
}

/* ── Finding Row ─────────────────────────────────────────── */

function FindingRow({ finding: f, categoryScores }: { finding: FindingRecord; categoryScores: BrandCategoryScore[] }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(f.status);
  const [updating, setUpdating] = useState(false);

  // Estimate category from sort_order
  const catIndex = categoryScores.length > 0
    ? Math.min(Math.floor((f.sort_order || 0) / Math.max(1, 100 / categoryScores.length)), categoryScores.length - 1)
    : 0;
  const cat = categoryScores[catIndex];
  const tint = cat ? (CATEGORY_TINTS[cat.slug] || CATEGORY_TINTS.visual_consistency) : CATEGORY_TINTS.visual_consistency;
  const CatIcon = cat ? (CATEGORY_ICONS[cat.slug] || Sparkles) : Sparkles;

  const handleStatus = async (s: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/findings/${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: s }),
      });
      if (res.ok) setStatus(s);
    } catch {}
    setUpdating(false);
  };

  return (
    <div style={{ borderBottom: '1px solid var(--rule)', background: sevCardBg(f.severity) }}>
      {/* Row header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 text-left transition-colors"
        style={{ background: open ? 'var(--paper-2)' : 'transparent', paddingTop: '1rem', paddingBottom: '1rem' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: 'var(--ink)' }}>{f.title}</p>
          <div className="flex items-center gap-x-2 text-[11px]" style={{ color: 'var(--m-muted)', marginTop: '0.6rem' }}>
            <span className="font-semibold" style={{ color: sevColor(f.severity) }}>{sevLabel(f.severity)}</span>
            {cat && (
              <>
                <span style={{ color: 'var(--rule)' }}>|</span>
                <span className="flex items-center gap-1"><CatIcon size={9} style={{ color: tint.dot }} /> {cat.name}</span>
              </>
            )}
          </div>
        </div>
        {/* Status chip */}
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: status === 'fixed' ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : status === 'in_progress' ? 'color-mix(in srgb, var(--signal) 12%, transparent)' : 'var(--paper-2)',
            color: status === 'fixed' ? 'var(--ok)' : status === 'in_progress' ? 'var(--signal)' : 'var(--m-muted)',
          }}
        >
          {status === 'in_progress' ? 'In progress' : status === 'fixed' ? 'Fixed' : 'Open'}
        </span>
        <ChevronDown size={13} className="flex-shrink-0 transition-transform" style={{ color: 'var(--m-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Issue + Fix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={11} style={{ color: sevColor(f.severity) }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ink)' }}>Issue</span>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{f.description}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'color-mix(in srgb, var(--ok) 3%, var(--paper-2))', border: '1px solid var(--rule)' }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb size={11} style={{ color: tint.dot }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ink)' }}>How to fix</span>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>{f.recommendation || 'No specific recommendation.'}</p>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>Status:</span>
            {['open', 'in_progress', 'fixed'].map(s => (
              <button
                key={s}
                onClick={() => handleStatus(s)}
                disabled={updating}
                className="text-[11px] font-medium px-2 py-1 rounded-md transition-colors capitalize"
                style={{
                  background: status === s
                    ? s === 'fixed' ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : s === 'in_progress' ? 'color-mix(in srgb, var(--signal) 12%, transparent)' : 'var(--paper-2)'
                    : 'transparent',
                  color: status === s
                    ? s === 'fixed' ? 'var(--ok)' : s === 'in_progress' ? 'var(--signal)' : 'var(--ink)'
                    : 'var(--m-muted)',
                  border: status === s ? '1px solid var(--rule)' : '1px solid transparent',
                }}
              >
                {s === 'in_progress' ? 'In progress' : s === 'fixed' ? 'Fixed' : 'Open'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
