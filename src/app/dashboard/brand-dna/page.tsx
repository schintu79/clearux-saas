'use client';

/**
 * Brand DNA — answers "What should ClearUX compare the site against?"
 *
 * Surfaces and edits the Phase 1 Brand DNA fields on brand_identities
 * (migration 031): brand name, website URL, brand voice, tone keywords,
 * primary colours, logo URL, and brand promise. File uploads remain on
 * the existing /dashboard/brand-identity/[id] flow — the inline editor
 * here only covers the structured fields the bible calls out.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Fingerprint,
  Plus,
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';

interface BrandFile {
  id: string;
  file_name: string;
  file_type: string | null;
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

interface UserSite {
  domain: string;
  audits: number;
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

export default function BrandDnaPage() {
  const { user, loading: authLoading } = useAuth();
  const [identities, setIdentities] = useState<BrandIdentity[]>([]);
  const [sites, setSites] = useState<UserSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<BrandEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    (async () => {
      try {
        const [identitiesRes, sitesRes] = await Promise.all([
          fetch('/api/brand-identities').then((r) => r.ok ? r.json() : { identities: [] }),
          (async () => {
            const supabase = createBrowserSupabase();
            const { data } = await supabase
              .from('audits')
              .select('product_url')
              .eq('user_id', user.id)
              .or('audit_type.is.null,audit_type.eq.website');
            return (data || []) as Array<{ product_url: string | null }>;
          })(),
        ]);
        setIdentities(identitiesRes.identities || []);
        const counts = new Map<string, number>();
        for (const row of sitesRes) {
          if (!row.product_url) continue;
          try {
            const host = new URL(row.product_url).hostname.replace(/^www\./, '');
            counts.set(host, (counts.get(host) || 0) + 1);
          } catch {}
        }
        setSites(Array.from(counts.entries()).map(([domain, audits]) => ({ domain, audits })));
      } catch {
        setError('Could not load your brand DNA. Try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, user]);

  const beginEdit = (b: BrandIdentity) => {
    setEditingId(b.id);
    setEditState(toEditState(b));
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
    setSaveError(null);
  };

  const saveEdit = async (id: string) => {
    if (!editState) return;
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
      const res = await fetch(`/api/brand-identities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      const data = await res.json();
      setIdentities((prev) => prev.map((b) => b.id === id ? { ...b, ...(data.identity || {}) } : b));
      setEditingId(null);
      setEditState(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
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

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Brand DNA</h1>
          <p className="text-[13px] mt-1 max-w-[640px]" style={{ color: 'var(--m-muted)' }}>
            What should ClearUX compare the site against? Capture your brand name, URL, tone of voice, colours, and logo so the audit can flag drift between your real brand and what the site or AI engines describe.
          </p>
        </div>
        <Link
          href="/dashboard/brand-identity/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          <Plus size={13} /> Add brand
        </Link>
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

      {sites.length > 0 && (
        <div
          className="rounded-xl p-5 mb-5"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
            Sites we audit for you
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sites.map((s) => (
              <li
                key={s.domain}
                className="rounded-lg px-3 py-2.5 flex items-center justify-between"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{s.domain}</p>
                  <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>{s.audits} audit{s.audits === 1 ? '' : 's'}</p>
                </div>
                <Link
                  href={`/dashboard/audits/site/${encodeURIComponent(s.domain)}`}
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--signal)' }}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {identities.length === 0 ? (
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
            Capture your brand DNA
          </p>
          <p className="text-[13px] mt-1.5 max-w-[560px] leading-relaxed" style={{ color: 'var(--m-muted)' }}>
            Add the structured fields ClearUX uses to score brand consistency — and upload your bible, voice doc, or guidelines for richer comparison.
          </p>
          <ul className="text-[12px] mt-4 space-y-1.5" style={{ color: 'var(--ink-2)' }}>
            <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Brand name + primary URL</li>
            <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Tone of voice / brand voice keywords</li>
            <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Colour palette + logo URL</li>
            <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Short brand promise / positioning</li>
          </ul>
          <Link
            href="/dashboard/brand-identity/new"
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Add your brand DNA
            <ArrowRight size={13} />
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {identities.map((b) => (
            <li key={b.id}>
              <BrandCard
                brand={b}
                editing={editingId === b.id}
                editState={editingId === b.id ? editState : null}
                onEditChange={setEditState}
                onBeginEdit={() => beginEdit(b)}
                onCancelEdit={cancelEdit}
                onSave={() => saveEdit(b.id)}
                saving={saving}
                saveError={editingId === b.id ? saveError : null}
              />
            </li>
          ))}
        </ul>
      )}
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
