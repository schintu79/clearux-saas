'use client';

/**
 * Brand DNA — answers "What should ClearUX compare the site against?"
 *
 * Surfaces the brand identities the user already has on file (name,
 * description, uploaded brand bible / voice / visual assets) and lets them
 * jump to the existing upload flow. The underlying data model is the
 * brand_identities + brand_identity_files tables; this page is a Phase 1
 * presentation layer that aligns with the dashboard restructure brief.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Fingerprint,
  Plus,
  FileText,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
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
  created_at: string;
  updated_at: string;
  brand_identity_files: BrandFile[];
}

interface UserSite {
  domain: string;
  audits: number;
}

function fileKindLabel(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) return 'Visual';
  if (['pdf', 'docx', 'doc', 'txt'].includes(ext)) return 'Document';
  return 'File';
}

export default function BrandDnaPage() {
  const { user, loading: authLoading } = useAuth();
  const [identities, setIdentities] = useState<BrandIdentity[]>([]);
  const [sites, setSites] = useState<UserSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      {/* Sites we already know about */}
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
            Upload your brand bible, voice document, visual guidelines, or logo files. ClearUX uses them to measure consistency across your site and to flag tone or visual drift.
          </p>
          <ul className="text-[12px] mt-4 space-y-1.5" style={{ color: 'var(--ink-2)' }}>
            <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Brand name + primary URL</li>
            <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Tone of voice / brand voice keywords</li>
            <li className="flex items-start gap-2"><span className="w-1 h-1 rounded-full mt-2" style={{ background: 'var(--m-muted)' }} />Colour palette + logo files</li>
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
              <article
                className="rounded-xl p-5"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
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
                  </div>
                  <Link
                    href={`/dashboard/brand-identity/${b.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold flex-shrink-0"
                    style={{ color: 'var(--signal)' }}
                  >
                    Open
                    <ArrowRight size={11} />
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <BrandSlot
                    label="Brand name"
                    value={b.name}
                    filled
                  />
                  <BrandSlot
                    label="Promise / positioning"
                    value={b.description || 'Not set'}
                    filled={!!b.description}
                  />
                  <BrandSlot
                    label="Voice / tone files"
                    value={`${b.brand_identity_files.filter((f) => fileKindLabel(f.file_name) === 'Document').length} doc(s)`}
                    filled={b.brand_identity_files.some((f) => fileKindLabel(f.file_name) === 'Document')}
                  />
                  <BrandSlot
                    label="Visuals / logo"
                    value={`${b.brand_identity_files.filter((f) => fileKindLabel(f.file_name) === 'Visual').length} asset(s)`}
                    filled={b.brand_identity_files.some((f) => fileKindLabel(f.file_name) === 'Visual')}
                  />
                </div>

                {b.brand_identity_files.length > 0 && (
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BrandSlot({ label, value, filled }: { label: string; value: string; filled: boolean }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          {label}
        </p>
        {filled && <CheckCircle2 size={10} style={{ color: 'var(--ok)' }} />}
      </div>
      <p className="text-[12px] mt-1 truncate font-medium" style={{ color: filled ? 'var(--ink)' : 'var(--m-muted)' }}>
        {value}
      </p>
    </div>
  );
}
