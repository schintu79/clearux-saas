'use client';

/**
 * Brand DNA — selected-brand workspace.
 *
 * Surfaces and edits the Phase 1 Brand DNA fields on brand_identities
 * (migration 031) for the SINGLE brand currently selected in the
 * dashboard switcher. Mirrors the selected-brand rule that Overview /
 * Find / Fix / Track follow: this page never lists portfolio data and
 * never falls back to another brand's DNA when the selected brand has
 * none. Portfolio remains reachable as a parent context via the "All
 * brands" link in the sidebar.
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
  Image as ImageIcon,
  Palette,
  Volume2,
  Upload,
  Loader2,
  Trash2,
  File as FileIcon,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';

interface BrandFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

const ACCEPTED_FILE_EXTS = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg,.webp';
const ACCEPTED_LOGO_EXTS = '.png,.jpg,.jpeg,.svg,.webp';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(name: string): boolean {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext);
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

function fileKindLabel(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) return 'Visual';
  if (['pdf', 'docx', 'doc', 'txt'].includes(ext)) return 'Document';
  return 'File';
}

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
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null }
}

export default function BrandDnaPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [identity, setIdentity] = useState<BrandIdentity | null>(null);
  const [siteLabel, setSiteLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<BrandEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshIdentity = useCallback(async (idToFetch: string) => {
    const res = await fetch(`/api/brand-identities/${idToFetch}`);
    if (!res.ok) return;
    const data = await res.json();
    setIdentity(data.identity || null);
  }, []);

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

    (async () => {
      try {
        if (!selection) {
          if (!cancelled) setLoading(false);
          return;
        }

        if (selection.kind === 'brand') {
          const res = await fetch(`/api/brand-identities/${selection.brandId}`);
          if (cancelled) return;
          if (res.status === 404) {
            setLoading(false);
            return;
          }
          if (!res.ok) throw new Error('Failed to load brand DNA');
          const data = await res.json();
          if (cancelled) return;
          setIdentity(data.identity || null);
          setLoading(false);
          return;
        }

        // selection.kind === 'site' — find the brand_identity linked to the
        // most recent audit for this host, if any.
        setSiteLabel(selection.host);
        const supabase = createBrowserSupabase();
        const { data: audits } = await supabase
          .from('audits')
          .select('product_url, brand_identity_id, completed_at, created_at')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false, nullsFirst: false } as any)
          .limit(100);
        if (cancelled) return;
        const match = (audits || []).find((a: any) =>
          hostnameOf(a.product_url) === selection.host && !!a.brand_identity_id,
        );
        if (!match) {
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/brand-identities/${(match as any).brand_identity_id}`);
        if (cancelled) return;
        if (res.status === 404) {
          setLoading(false);
          return;
        }
        if (!res.ok) throw new Error('Failed to load brand DNA');
        const data = await res.json();
        if (cancelled) return;
        setIdentity(data.identity || null);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError('Could not load Brand DNA. Try again.');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, ready, selection]);

  const beginEdit = () => {
    if (!identity) return;
    setEditing(true);
    setEditState(toEditState(identity));
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditState(null);
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!identity || !editState) return;
    if (!editState.name.trim()) {
      setSaveError('Brand name is required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name: editState.name.trim(),
        description: editState.description.trim() || null,
        website_url: editState.website_url.trim() || null,
        brand_voice: editState.brand_voice.trim() || null,
        tone_keywords: editState.tone_keywords.split(',').map((s) => s.trim()).filter(Boolean),
        primary_colors: editState.primary_colors.split(',').map((s) => s.trim()).filter(Boolean),
        logo_url: editState.logo_url.trim() || null,
      };
      const res = await fetch(`/api/brand-identities/${identity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      setIdentity((prev) => prev ? { ...prev, ...(data.identity || {}) } : prev);
      setEditing(false);
      setEditState(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading || !ready) {
    return (
      <div>
        <div className="h-8 w-40 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-[120px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  const selectedLabel = selection?.kind === 'brand'
    ? (identity?.name || 'this brand')
    : (selection?.kind === 'site' ? selection.host : null);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Brand DNA</h1>
          <p className="text-[13px] mt-1 max-w-[640px]" style={{ color: 'var(--m-muted)' }}>
            What should Fixpath compare {selectedLabel ? <strong style={{ color: 'var(--ink)' }}>{selectedLabel}</strong> : 'this brand'} against? Capture your brand name, URL, tone of voice, colours, and logo so the audit can flag drift between your real brand and what the site or AI engines describe.
          </p>
        </div>
        {identity && (
          <Link
            href={`/dashboard/brand-identity/${identity.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 flex-shrink-0"
            style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--rule)' }}
          >
            <FileText size={13} /> Manage files
          </Link>
        )}
      </div>

      {error && (
        <div
          className="rounded-xl p-3 mb-4 flex items-center gap-2"
          style={{ background: 'color-mix(in srgb, var(--severe) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 14%, transparent)' }}
        >
          <AlertCircle size={13} style={{ color: 'var(--severe)' }} />
          <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>{error}</span>
        </div>
      )}

      {!selection ? (
        <EmptyState
          title="Pick a brand to see its DNA"
          body="Brand DNA is scoped to the brand you have selected in the sidebar. Choose a brand or site to view and edit its DNA."
          ctaHref="/dashboard/new-audit"
          ctaLabel="Run your first audit"
        />
      ) : !identity ? (
        <EmptyState
          title={selection.kind === 'brand' ? 'No Brand DNA on file yet' : `No Brand DNA on file for ${siteLabel || 'this site'}`}
          body={selection.kind === 'brand'
            ? 'Capture this brand’s name, URL, tone of voice, colours, and logo so Fixpath can score brand consistency.'
            : 'Link this site to a brand identity (or create one) so Fixpath can score brand consistency against your real brand DNA.'}
          ctaHref="/dashboard/brand-identity/new"
          ctaLabel="Add brand DNA"
        />
      ) : (
        <>
          <BrandCard
            brand={identity}
            editing={editing}
            editState={editing ? editState : null}
            onEditChange={setEditState}
            onBeginEdit={beginEdit}
            onCancelEdit={cancelEdit}
            onSave={saveEdit}
            saving={saving}
            saveError={editing ? saveError : null}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
            <LogoUploader
              identityId={identity.id}
              logoUrl={identity.logo_url}
              onChanged={() => refreshIdentity(identity.id)}
            />
            <BrandAssets
              identityId={identity.id}
              brandName={identity.name}
              files={identity.brand_identity_files}
              currentLogoUrl={identity.logo_url}
              onChanged={() => refreshIdentity(identity.id)}
            />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div
      className="rounded-xl p-8"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      data-testid="brand-dna-empty"
    >
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center mb-4"
        style={{ background: 'color-mix(in srgb, #8B5CF6 10%, transparent)' }}
      >
        <Fingerprint size={20} strokeWidth={1.6} style={{ color: '#8B5CF6' }} />
      </div>
      <p className="text-[16px] font-sans font-semibold" style={{ color: 'var(--ink)' }}>
        {title}
      </p>
      <p className="text-[13px] mt-1.5 max-w-[560px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
        {body}
      </p>
      <ul className="text-[12px] mt-4 space-y-1.5" style={{ color: 'var(--ink-2)' }}>
        <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Brand name + primary URL</li>
        <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Tone of voice / brand voice keywords</li>
        <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Colour palette + logo URL</li>
        <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Short brand promise / positioning</li>
      </ul>
      <Link
        href={ctaHref}
        className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        {ctaLabel}
        <ArrowRight size={13} />
      </Link>
    </div>
  );
}

function BrandCard({
  brand: b,
  editing,
  editState,
  onEditChange,
  onBeginEdit,
  onCancelEdit,
  onSave,
  saving,
  saveError,
}: {
  brand: BrandIdentity;
  editing: boolean;
  editState: BrandEditState | null;
  onEditChange: (s: BrandEditState) => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  const tone = (b.tone_keywords || []);
  const colors = (b.primary_colors || []);
  const completion = useMemo(() => {
    const slots = [b.name, b.description, b.website_url, b.brand_voice, tone.length > 0, colors.length > 0, b.logo_url];
    const filled = slots.filter(Boolean).length;
    return Math.round((filled / slots.length) * 100);
  }, [b, tone.length, colors.length]);

  return (
    <article
      className="rounded-xl p-5"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      data-testid="brand-card"
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, #8B5CF6 10%, transparent)' }}
        >
          <Fingerprint size={16} strokeWidth={1.6} style={{ color: '#8B5CF6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>{b.name}</h2>
          {b.description ? (
            <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--m-muted)' }}>{b.description}</p>
          ) : (
            <p className="text-[12px] mt-1 italic" style={{ color: 'var(--m-muted)' }}>
              No brand promise on file yet — add one to sharpen consistency scoring.
            </p>
          )}
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Brand DNA captured: <span style={{ color: completion >= 70 ? 'var(--ok)' : completion >= 40 ? 'var(--warn)' : 'var(--severe)' }} className="font-semibold">{completion}%</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {editing ? (
            <>
              <button
                onClick={onCancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-md"
                style={{ color: 'var(--m-muted)', border: '1px solid var(--rule)' }}
              >
                <X size={11} /> Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-md"
                style={{ background: 'var(--ink)', color: 'var(--paper)', opacity: saving ? 0.6 : 1 }}
              >
                <Save size={11} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onBeginEdit}
                className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-md"
                style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '1px solid var(--rule)' }}
              >
                <Edit2 size={11} /> Edit DNA
              </button>
              <Link
                href={`/dashboard/brand-identity/${b.id}`}
                className="inline-flex items-center gap-1 text-[12px] font-semibold"
                style={{ color: 'var(--signal)' }}
              >
                Files
                <ArrowRight size={11} />
              </Link>
            </>
          )}
        </div>
      </div>

      {editing && editState ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Brand name" required>
            <input
              value={editState.name}
              onChange={(e) => onEditChange({ ...editState, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-[13px]"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Brand name"
              maxLength={120}
            />
          </Field>
          <Field label="Primary website URL">
            <input
              value={editState.website_url}
              onChange={(e) => onEditChange({ ...editState, website_url: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-3 py-2 rounded-lg text-[13px]"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Website URL"
              maxLength={2048}
            />
          </Field>
          <Field label="Brand promise / positioning" full>
            <textarea
              value={editState.description}
              onChange={(e) => onEditChange({ ...editState, description: e.target.value })}
              placeholder="Short one-liner: who you serve and the change you create."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-[13px] resize-y"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Brand promise"
              maxLength={600}
            />
          </Field>
          <Field label="Brand voice description" full>
            <textarea
              value={editState.brand_voice}
              onChange={(e) => onEditChange({ ...editState, brand_voice: e.target.value })}
              placeholder="How does your brand sound? Confident but not corporate. Warm but not casual."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-[13px] resize-y"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Brand voice"
              maxLength={4000}
            />
          </Field>
          <Field label="Tone keywords (comma-separated)">
            <input
              value={editState.tone_keywords}
              onChange={(e) => onEditChange({ ...editState, tone_keywords: e.target.value })}
              placeholder="confident, warm, direct"
              className="w-full px-3 py-2 rounded-lg text-[13px]"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Tone keywords"
            />
          </Field>
          <Field label="Primary colours (comma-separated hex)">
            <input
              value={editState.primary_colors}
              onChange={(e) => onEditChange({ ...editState, primary_colors: e.target.value })}
              placeholder="#0A84FF, #111111"
              className="w-full px-3 py-2 rounded-lg text-[13px]"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Primary colours"
            />
          </Field>
          <Field label="Logo URL" full>
            <input
              value={editState.logo_url}
              onChange={(e) => onEditChange({ ...editState, logo_url: e.target.value })}
              placeholder="https://cdn.example.com/logo.svg"
              className="w-full px-3 py-2 rounded-lg text-[13px]"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Logo URL"
              maxLength={2048}
            />
          </Field>
          {saveError && (
            <div className="md:col-span-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', color: 'var(--severe)' }}>
              {saveError}
            </div>
          )}
          <p className="md:col-span-2 text-[11px]" style={{ color: 'var(--m-muted)' }}>
            File uploads (bible, voice doc, visual assets) live on the brand identity detail page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <BrandSlot
            icon={Fingerprint}
            label="Brand name"
            value={b.name}
            filled
          />
          <BrandSlot
            icon={GlobeIcon}
            label="Website"
            value={b.website_url || 'Not set'}
            filled={!!b.website_url}
          />
          <BrandSlot
            icon={Volume2}
            label="Voice + tone"
            value={tone.length > 0 ? tone.slice(0, 3).join(', ') + (tone.length > 3 ? '…' : '') : (b.brand_voice ? 'On file' : 'Not set')}
            filled={tone.length > 0 || !!b.brand_voice}
          />
          <BrandSlot
            icon={Palette}
            label="Colour palette"
            value={colors.length > 0 ? `${colors.length} colour${colors.length === 1 ? '' : 's'}` : 'Not set'}
            filled={colors.length > 0}
            colors={colors}
          />
          <BrandSlot
            icon={ImageIcon}
            label="Logo"
            value={b.logo_url ? 'On file' : 'Not set'}
            filled={!!b.logo_url}
            logoUrl={b.logo_url}
          />
          <BrandSlot
            icon={FileText}
            label="Voice / brand docs"
            value={`${b.brand_identity_files.filter((f) => fileKindLabel(f.file_name) === 'Document').length} document${b.brand_identity_files.filter((f) => fileKindLabel(f.file_name) === 'Document').length === 1 ? '' : 's'}`}
            filled={b.brand_identity_files.some((f) => fileKindLabel(f.file_name) === 'Document')}
          />
          <BrandSlot
            icon={ImageIcon}
            label="Visual assets"
            value={`${b.brand_identity_files.filter((f) => fileKindLabel(f.file_name) === 'Visual').length} asset${b.brand_identity_files.filter((f) => fileKindLabel(f.file_name) === 'Visual').length === 1 ? '' : 's'}`}
            filled={b.brand_identity_files.some((f) => fileKindLabel(f.file_name) === 'Visual')}
          />
          <BrandSlot
            icon={FileText}
            label="Promise"
            value={b.description ? (b.description.length > 38 ? b.description.slice(0, 36) + '…' : b.description) : 'Not set'}
            filled={!!b.description}
          />
        </div>
      )}

      {!editing && b.brand_identity_files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {b.brand_identity_files.slice(0, 5).map((f) => (
            <span
              key={f.id}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
            >
              <FileText size={10} />
              {f.file_name}
            </span>
          ))}
          {b.brand_identity_files.length > 5 && (
            <span className="inline-flex items-center text-[11px] px-2 py-1" style={{ color: 'var(--m-muted)' }}>
              +{b.brand_identity_files.length - 5} more
            </span>
          )}
        </div>
      )}
    </article>
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

function BrandSlot({
  icon: Icon,
  label,
  value,
  filled,
  colors,
  logoUrl,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  filled: boolean;
  colors?: string[];
  logoUrl?: string | null;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5 min-w-0"
      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          <Icon size={10} strokeWidth={1.6} />
          {label}
        </span>
        {filled && <CheckCircle2 size={10} style={{ color: 'var(--ok)' }} />}
      </div>
      {colors && colors.length > 0 && (
        <div className="flex items-center gap-1 mb-1">
          {colors.slice(0, 6).map((c, i) => (
            <span
              key={`${c}-${i}`}
              className="w-3 h-3 rounded-sm border"
              style={{ background: c, borderColor: 'var(--rule)' }}
              title={c}
              aria-label={c}
            />
          ))}
        </div>
      )}
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Brand logo"
          loading="lazy"
          className="h-6 max-w-full object-contain mb-1 rounded-sm"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <p className="text-[12px] truncate font-medium" style={{ color: filled ? 'var(--ink)' : 'var(--m-muted)' }}>
        {value}
      </p>
    </div>
  );
}

function LogoUploader({
  identityId,
  logoUrl,
  onChanged,
}: {
  identityId: string;
  logoUrl: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => { setImgFailed(false); }, [logoUrl]);

  const upload = async (file: File) => {
    setErr(null);
    if (file.size > MAX_FILE_SIZE) {
      setErr('Logo exceeds 10MB limit.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErr('Logo must be an image (PNG, JPG, SVG, WebP).');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('as_logo', 'true');
      const res = await fetch(`/api/brand-identities/${identityId}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Logo upload failed');
      }
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Logo upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <section
      className="rounded-xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      data-testid="brand-dna-logo-uploader"
    >
      <header className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, #8B5CF6 10%, transparent)' }}
        >
          <ImageIcon size={13} strokeWidth={1.6} style={{ color: '#8B5CF6' }} />
        </div>
        <div>
          <h3 className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Brand logo</h3>
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>PNG, JPG, SVG, WebP — max 10MB</p>
        </div>
      </header>

      <div className="flex items-stretch gap-3">
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', width: 96, height: 96 }}
        >
          {logoUrl && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Current brand logo"
              className="max-w-full max-h-full object-contain p-2"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ImageIcon size={20} style={{ color: 'var(--m-muted)' }} />
          )}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) fileInputRef.current?.click(); }}
          aria-label={logoUrl ? 'Replace brand logo' : 'Upload brand logo'}
          className={`flex-1 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center px-3 py-4 transition-all ${
            uploading ? 'cursor-wait' : 'cursor-pointer hover:bg-off'
          }`}
          style={{
            borderColor: dragOver ? 'var(--ink)' : 'var(--rule)',
            background: dragOver ? 'var(--paper-2)' : 'transparent',
          }}
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="animate-spin mb-1" style={{ color: 'var(--ink)' }} />
              <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Uploading logo…</p>
            </>
          ) : (
            <>
              {logoUrl ? (
                <RefreshCw size={14} className="mb-1" style={{ color: 'var(--m-muted)' }} />
              ) : (
                <Upload size={14} className="mb-1" style={{ color: 'var(--m-muted)' }} />
              )}
              <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
                {logoUrl ? 'Replace logo' : 'Upload logo'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                Drop a file or click to browse
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_LOGO_EXTS}
            className="hidden"
            onChange={onSelect}
            disabled={uploading}
          />
        </div>
      </div>

      {err && (
        <div
          className="mt-3 rounded-lg flex items-center gap-2 px-3 py-2"
          style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 18%, transparent)' }}
        >
          <AlertCircle size={12} style={{ color: 'var(--severe)' }} />
          <span className="text-[12px]" style={{ color: 'var(--severe)' }}>{err}</span>
        </div>
      )}
    </section>
  );
}

function BrandAssets({
  identityId,
  brandName,
  files,
  currentLogoUrl,
  onChanged,
}: {
  identityId: string;
  brandName: string;
  files: BrandFile[];
  currentLogoUrl: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingLogoId, setSettingLogoId] = useState<string | null>(null);

  const upload = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setErr(null);
    setUploading(true);
    let failed = 0;
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      setProgress(arr.length === 1 ? `Uploading ${f.name}…` : `Uploading ${i + 1} of ${arr.length}…`);
      if (f.size > MAX_FILE_SIZE) {
        setErr(`${f.name} exceeds 10MB limit.`);
        failed++;
        continue;
      }
      try {
        const formData = new FormData();
        formData.append('file', f);
        const res = await fetch(`/api/brand-identities/${identityId}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }
      } catch (e) {
        failed++;
        setErr(e instanceof Error ? e.message : `Failed to upload ${f.name}`);
      }
    }
    setUploading(false);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await onChanged();
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) upload(e.target.files);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) upload(e.dataTransfer.files);
  };

  const removeFile = async (fileId: string) => {
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/brand-identities/${identityId}/files?fileId=${fileId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      await onChanged();
    } catch {
      setErr('Failed to remove file.');
    } finally {
      setDeletingId(null);
    }
  };

  const setAsLogo = async (file: BrandFile) => {
    if (!isImageFile(file.file_name)) return;
    setSettingLogoId(file.id);
    try {
      const res = await fetch(`/api/brand-identities/${identityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brandName, logo_url: file.file_url }),
      });
      if (!res.ok) throw new Error('Could not set as logo');
      await onChanged();
    } catch {
      setErr('Could not set this asset as the brand logo.');
    } finally {
      setSettingLogoId(null);
    }
  };

  return (
    <section
      className="rounded-xl p-4"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      data-testid="brand-dna-assets"
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, #8B5CF6 10%, transparent)' }}
          >
            <FileText size={13} strokeWidth={1.6} style={{ color: '#8B5CF6' }} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>Brand assets</h3>
            <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
              Logos, guidelines, screenshots & references
            </p>
          </div>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) fileInputRef.current?.click(); }}
        aria-label="Upload brand assets"
        className={`rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center px-3 py-4 transition-all ${
          uploading ? 'cursor-wait' : 'cursor-pointer hover:bg-off'
        }`}
        style={{
          borderColor: dragOver ? 'var(--ink)' : 'var(--rule)',
          background: dragOver ? 'var(--paper-2)' : 'transparent',
        }}
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin mb-1" style={{ color: 'var(--ink)' }} />
            <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{progress || 'Uploading…'}</p>
          </>
        ) : (
          <>
            <Upload size={14} className="mb-1" style={{ color: 'var(--m-muted)' }} />
            <p className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>Drop assets here or click to browse</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
              PDF, DOCX, TXT, PNG, JPG, SVG, WebP — max 10MB each
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_EXTS}
          multiple
          className="hidden"
          onChange={onSelect}
          disabled={uploading}
        />
      </div>

      {err && (
        <div
          className="mt-3 rounded-lg flex items-center gap-2 px-3 py-2"
          style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 18%, transparent)' }}
        >
          <AlertCircle size={12} style={{ color: 'var(--severe)' }} />
          <span className="text-[12px]" style={{ color: 'var(--severe)' }}>{err}</span>
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-[12px] mt-3" style={{ color: 'var(--m-muted)' }}>
          No assets uploaded yet. Add brand guidelines, logo variants, or visual references so Fixpath has source material to compare against.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5" data-testid="brand-dna-assets-list">
          {files.map((f) => {
            const isImg = isImageFile(f.file_name);
            const isCurrentLogo = !!currentLogoUrl && f.file_url === currentLogoUrl;
            return (
              <li
                key={f.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg group"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                >
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.file_url}
                      alt={f.file_name}
                      className="max-w-full max-h-full object-contain"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <FileIcon size={13} style={{ color: 'var(--m-muted)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-medium truncate block hover:underline"
                    style={{ color: 'var(--ink)' }}
                  >
                    {f.file_name}
                  </a>
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--m-muted)' }}>
                    <span className="uppercase tracking-wide">{(f.file_type || '').toUpperCase() || 'FILE'}</span>
                    {f.file_size_bytes != null && (
                      <>
                        <span>·</span>
                        <span>{formatBytes(f.file_size_bytes)}</span>
                      </>
                    )}
                    {f.created_at && (
                      <>
                        <span>·</span>
                        <span>{new Date(f.created_at).toLocaleDateString()}</span>
                      </>
                    )}
                    {isCurrentLogo && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: 'var(--ok)' }}>
                          <CheckCircle2 size={10} /> Logo
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {isImg && !isCurrentLogo && (
                  <button
                    type="button"
                    onClick={() => setAsLogo(f)}
                    disabled={settingLogoId === f.id}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
                    style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--rule)' }}
                    title="Use this image as the brand logo"
                  >
                    {settingLogoId === f.id ? 'Setting…' : 'Set as logo'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  disabled={deletingId === f.id}
                  aria-label={`Remove ${f.file_name}`}
                  className="p-1.5 rounded-md transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
                  style={{ color: 'var(--m-muted)' }}
                >
                  {deletingId === f.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

