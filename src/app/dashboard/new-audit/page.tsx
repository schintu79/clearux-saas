'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Globe, Sparkles, Coins, Zap, Languages, Building2, Check, Fingerprint } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/languages';
import { AUDIT_MODULES, COMPLETE_AUDIT_SLUGS } from '@/lib/audit-modules';
import AllAuditsInclude from '@/components/ui/AllAuditsInclude';

const AUDIT_FEATURES = [
  '64-point deep analysis',
  '16 UX categories audited',
  'AI discoverability check',
  'PDF + DOCX professional reports',
  'Prioritised findings & recommendations',
];

const NewAuditInner: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState(searchParams.get('url') || '');
  const depthParam = searchParams.get('depth'); // 'deep' for Dig Deeper, null for standard
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [packageTier, setPackageTier] = useState<string>('starter');
  const [firstAuditFree, setFirstAuditFree] = useState(false);

  // Module selection (slug-based)
  const [selectedModules, setSelectedModules] = useState<string[]>([...COMPLETE_AUDIT_SLUGS]);
  const isCompleteAudit = COMPLETE_AUDIT_SLUGS.every((s) => selectedModules.includes(s));

  // White-label is now managed at profile level via /dashboard/white-label
  const isWhiteLabelEligible = packageTier === 'growth' || packageTier === 'agency' || packageTier === 'scale';

  // Brand identity selection
  const [brandIdentities, setBrandIdentities] = useState<{ id: string; name: string }[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');

  useEffect(() => {
    if (!userLoading && user && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [userLoading, user]);

  // Fetch credits + package tier + brand identities
  useEffect(() => {
    if (!user) return;
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? 0);
        if (d.package_tier) setPackageTier(d.package_tier);
        if (d.first_audit_free) setFirstAuditFree(true);
      })
      .catch(() => setCredits(0));

    fetch('/api/brand-identities')
      .then((r) => r.json())
      .then((d) => setBrandIdentities((d.identities || []).map((bi: any) => ({ id: bi.id, name: bi.name }))))
      .catch(() => {});
  }, [user]);

  // When brand identity is deselected, remove brand_consistency from selection
  useEffect(() => {
    if (!selectedBrandId && selectedModules.includes('brand_consistency')) {
      setSelectedModules((prev) => prev.filter((s) => s !== 'brand_consistency'));
    }
  }, [selectedBrandId]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Please sign in to create an audit</p>
        <a href="/login" className="inline-flex items-center gap-2 bg-brand text-surface font-medium text-[15px] px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110">
          Sign In
        </a>
      </div>
    );
  }

  const hasCredits = credits !== null && (credits > 0 || firstAuditFree);

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setUrlError('Enter your website URL to get started');
      return false;
    }
    try {
      new URL(value.startsWith('http') ? value : `https://${value}`);
      setUrlError('');
      return true;
    } catch {
      setUrlError('That doesn\'t look like a valid URL');
      return false;
    }
  };

  const toggleModule = (slug: string) => {
    setSelectedModules((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const toggleCompleteAudit = () => {
    if (isCompleteAudit) {
      setSelectedModules([]);
    } else {
      // Select all "complete" modules, plus keep brand_consistency if brand is selected
      const next = [...COMPLETE_AUDIT_SLUGS];
      if (selectedBrandId && !next.includes('brand_consistency')) {
        next.push('brand_consistency');
      }
      setSelectedModules(next);
    }
  };

  const handleSubmit = async () => {
    if (!validateUrl(url)) return;
    if (selectedModules.length === 0) {
      setGeneralError('Select at least one module to audit.');
      return;
    }

    setLoading(true);
    setGeneralError('');

    try {
      const supabase = createBrowserSupabase();
      const productUrl = url.startsWith('http') ? url : `https://${url}`;

      // White-label branding is now managed at profile level (/dashboard/white-label)
      // and resolved at report-generation time from the white_label_settings table.

      const { data: audit, error: auditError } = await supabase
        .from('audits')
        .insert({
          user_id: user.id,
          status: hasCredits ? ('payment_received' as const) : ('pending_payment' as const),
          product_url: productUrl,
          product_type: 'auto_detect',
          ux_concern: 'General UX audit',
          notes: null,
          plan: 'full_audit',
          language: language,
          depth_mode: depthParam === 'deep' ? 'deep' : 'standard',
          selected_modules: selectedModules,
          ...(selectedBrandId ? { brand_identity_id: selectedBrandId } : {}),
        })
        .select('id')
        .single();

      if (auditError) {
        console.error('Audit insert error:', JSON.stringify(auditError));
        throw new Error(auditError.message || 'Failed to create audit');
      }
      if (!audit) throw new Error('Failed to create audit');

      // If user has credits or first audit is free, use it
      if (hasCredits) {
        const creditRes = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_id: audit.id, is_free_first: firstAuditFree }),
        });
        const creditData = await creditRes.json();
        if (!creditRes.ok) {
          throw new Error(creditData.error || 'Failed to apply credit');
        }
        router.push(`/dashboard/audits/${audit.id}?payment=success`);
        return;
      }

      // No credits — Stripe checkout
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: audit.id }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok || !checkoutData.url) {
        throw new Error(checkoutData.error || 'Failed to create checkout session');
      }
      window.location.href = checkoutData.url;
    } catch (err) {
      console.error('Error creating audit:', err);
      setGeneralError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-4">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--gradient-brand-subtle)' }}>
          <Sparkles size={28} className="text-brand" />
        </div>
        <h1 className="text-3xl font-medium font-heading text-text mb-2">
          New Audit
        </h1>
        <p className="text-muted">
          Paste your URL and our AI does a deep analysis across all 64 checkpoints.
        </p>
      </div>

      {/* -- URL Input -- */}
      <div className="mb-6">
        <label htmlFor="audit-url" className="block text-sm font-medium text-text mb-2">
          <Globe size={14} className="inline mr-1.5 -mt-0.5" />
          Website URL
        </label>
        <div className="relative">
          <input
            ref={urlInputRef}
            id="audit-url"
            type="url"
            name="url"
            autoComplete="url"
            aria-required="true"
            aria-describedby={urlError ? 'url-error' : undefined}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) validateUrl(e.target.value);
            }}
            onBlur={() => url && validateUrl(url)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="example.com"
            className={`w-full px-5 py-4 text-lg border-2 rounded-xl font-body bg-input-bg text-text placeholder:text-placeholder transition-all focus:outline-none focus:ring-0 ${
              urlError
                ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                : 'border-border focus:border-brand'
            }`}
          />
          {url && !urlError && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs">&#10003;</span>
              </div>
            </div>
          )}
        </div>
        {urlError && (
          <p id="url-error" className="text-red-500 dark:text-red-400 text-sm mt-2" role="alert">{urlError}</p>
        )}
      </div>

      {/* -- Report Language -- */}
      <div className="mb-6">
        <label htmlFor="audit-language" className="block text-sm font-medium text-text mb-2">
          <Languages size={14} className="inline mr-1.5 -mt-0.5" />
          Report Language
        </label>
        <div className="relative">
          <select
            id="audit-language"
            name="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 border-2 border-border rounded-xl font-body text-sm bg-input-bg text-text transition-all focus:outline-none focus:ring-0 focus:border-brand appearance-none cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag}  {lang.label} — {lang.nativeLabel}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        {language !== 'en' && (
          <p className="text-muted text-xs mt-1.5">
            All findings, recommendations, and the full report will be in {SUPPORTED_LANGUAGES.find(l => l.code === language)?.label}.
          </p>
        )}
      </div>

      {/* -- Audit Scope (Module Selection) -- */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={15} className="text-brand" />
          <span className="text-sm font-medium text-text">Audit Scope</span>
        </div>

        {/* Complete Audit toggle */}
        <button
          type="button"
          onClick={toggleCompleteAudit}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 mb-3 transition-all ${
            isCompleteAudit
              ? 'border-[#22C55E]/50 bg-[#22C55E]/5 dark:bg-[#22C55E]/10'
              : 'border-border/60 dark:border-white/[0.08] hover:border-border'
          }`}
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
            isCompleteAudit ? 'bg-[#22C55E]' : 'bg-white dark:bg-white/10 border-2 border-border'
          }`}>
            {isCompleteAudit && <Check size={12} className="text-white" />}
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-medium text-text">Complete Audit</p>
            <p className="text-[11px] text-muted">All core modules — full coverage across every checkpoint</p>
          </div>
        </button>

        {/* Individual module toggles */}
        <div className="space-y-1.5">
          {AUDIT_MODULES.map((mod) => {
            const selected = selectedModules.includes(mod.slug);
            const brandRequired = mod.requiresBrandIdentity && !selectedBrandId;
            const disabled = brandRequired;

            return (
              <button
                key={mod.slug}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  toggleModule(mod.slug);
                }}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                  disabled
                    ? 'border-border/30 dark:border-white/[0.04] opacity-40 cursor-not-allowed'
                    : selected
                    ? 'border-[#22C55E]/40 dark:border-[#22C55E]/30 bg-[#22C55E]/5 dark:bg-[#22C55E]/[0.06]'
                    : 'border-border/40 dark:border-white/[0.06] hover:border-border'
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                  disabled
                    ? 'bg-off dark:bg-white/5 border-2 border-border/50'
                    : selected
                    ? 'bg-[#22C55E]'
                    : 'bg-white dark:bg-white/10 border-2 border-border'
                }`}>
                  {selected && !disabled && <Check size={12} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-text">{mod.name}</span>
                    {mod.requiresBrandIdentity && (
                      <span className="text-[10px] font-medium text-muted bg-off dark:bg-white/[0.06] px-1.5 py-0.5 rounded-full">
                        Requires brand
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted leading-snug">{mod.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {selectedModules.length === 0 && (
          <p className="text-red-500 dark:text-red-400 text-xs mt-2">Select at least one module to audit.</p>
        )}
      </div>

      {/* -- Brand Identity selector -- */}
      {brandIdentities.length > 0 && (
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
            <Fingerprint size={15} className="text-brand" />
            Brand Identity
            <span className="text-xs font-normal text-muted">(optional)</span>
          </label>
          <select
            value={selectedBrandId}
            onChange={(e) => setSelectedBrandId(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl font-body text-sm bg-input-bg text-text transition-all focus:outline-none focus:border-brand focus:shadow-[0_0_0_3px_rgba(124,58,237,.08)] appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            <option value="">No brand identity</option>
            {brandIdentities.map((bi) => (
              <option key={bi.id} value={bi.id}>{bi.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1.5">
            Select a brand to check website consistency against your brand guidelines.{' '}
            <Link href="/dashboard/brand-identity" className="text-brand hover:underline">
              Manage brands
            </Link>
          </p>
        </div>
      )}

      {/* -- White-label info (managed at profile level) -- */}
      {isWhiteLabelEligible && (
        <div className="mb-6 flex items-center gap-2.5 px-4 py-3 rounded-xl border border-brand/15 bg-brand/5 dark:bg-brand/[0.03]">
          <Building2 size={15} className="text-brand flex-shrink-0" />
          <p className="text-xs text-muted flex-1">
            White-label branding is applied automatically from your{' '}
            <Link href="/dashboard/white-label" className="text-brand hover:underline font-medium">
              White Label settings
            </Link>.
          </p>
        </div>
      )}

      {/* -- What's included -- */}
      <AllAuditsInclude compact className="mb-6" />

      {/* -- Free first audit banner -- */}
      {firstAuditFree && (
        <div className="mb-6 p-4 rounded-xl bg-[#22C55E]/5 dark:bg-[#22C55E]/10 border border-[#22C55E]/20 dark:border-[#22C55E]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-brand">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text">
                Your first audit is free
              </p>
              <p className="text-xs text-muted">
                No credit card needed. No credits deducted. Just paste your URL and go.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* -- Credits banner -- */}
      {!firstAuditFree && credits !== null && hasCredits && (
        <div className="mb-6 p-4 rounded-xl bg-[#22C55E]/5 dark:bg-[#22C55E]/10 border border-[#22C55E]/20 dark:border-[#22C55E]/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0">
              <Coins size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text">
                {credits} credit{credits !== 1 ? 's' : ''} available
              </p>
              <p className="text-xs text-muted">
                1 credit will be used. No payment needed.
              </p>
            </div>
            <span className="text-2xl font-medium text-[#22C55E]">{credits}</span>
          </div>
        </div>
      )}

      {!firstAuditFree && credits !== null && !hasCredits && (
        <div className="mb-6 p-4 rounded-xl bg-off border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">No credits remaining</p>
              <p className="text-xs text-muted">This audit costs $99 or buy a credit pack to save.</p>
            </div>
            <Link
              href="/dashboard/buy-credits"
              className="text-xs font-medium text-text hover:underline transition-colors whitespace-nowrap ml-3"
            >
              Buy Credits &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* -- Error -- */}
      {generalError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-sm">{generalError}</p>
        </div>
      )}

      {/* -- CTA -- */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 font-heading font-medium text-[15px] py-3 px-6 rounded-xl active:scale-[0.98] transition-all min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed text-[#111111]"
        style={{ background: 'linear-gradient(135deg, #84CC16, #BEF264, #84CC16)' }}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {hasCredits ? 'Starting audit...' : 'Creating checkout...'}
          </>
        ) : firstAuditFree ? (
          <>
            Start Free Audit
            <ArrowRight size={20} />
          </>
        ) : hasCredits ? (
          <>
            Use 1 Credit — Start Audit
            <ArrowRight size={20} />
          </>
        ) : (
          <>
            Start Audit — $99
            <ArrowRight size={20} />
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted mt-4">
        {firstAuditFree
          ? 'Your first audit is on us. No credits will be deducted.'
          : hasCredits
          ? `1 credit will be deducted. ${(credits ?? 0) - 1} remaining after this audit.`
          : 'Secure payment via Stripe. Credits never expire.'}
      </p>
    </div>
  );
};

const NewAuditPage: React.FC = () => (
  <Suspense fallback={
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  }>
    <NewAuditInner />
  </Suspense>
);

export default NewAuditPage;
