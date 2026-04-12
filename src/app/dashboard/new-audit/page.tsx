'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Globe, Sparkles, Coins, CheckCircle, Zap, Languages } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/languages';

const AUDIT_FEATURES = [
  '48-point deep analysis',
  '12 UX categories audited',
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
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!userLoading && user && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [userLoading, user]);

  // Fetch credits
  useEffect(() => {
    if (!user) return;
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => setCredits(d.credits ?? 0))
      .catch(() => setCredits(0));
  }, [user]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.replace('/login?redirectTo=/dashboard/new-audit');
    }
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasCredits = credits !== null && credits > 0;

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

  const handleSubmit = async () => {
    if (!validateUrl(url)) return;

    setLoading(true);
    setGeneralError('');

    try {
      const supabase = createBrowserSupabase();
      const productUrl = url.startsWith('http') ? url : `https://${url}`;

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
        })
        .select('id')
        .single();

      if (auditError) {
        console.error('Audit insert error:', JSON.stringify(auditError));
        throw new Error(auditError.message || 'Failed to create audit');
      }
      if (!audit) throw new Error('Failed to create audit');

      // If user has credits, use one
      if (hasCredits) {
        const creditRes = await fetch('/api/credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audit_id: audit.id }),
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
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles size={28} className="text-accent" />
        </div>
        <h1 className="text-3xl font-bold font-manrope text-text mb-2">
          New Audit
        </h1>
        <p className="text-muted">
          Paste your URL and our AI does a deep analysis across all 48 checkpoints.
        </p>
      </div>

      {/* ── URL Input ──────────────────────────────────────── */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-text mb-2">
          <Globe size={14} className="inline mr-1.5 -mt-0.5" />
          Website URL
        </label>
        <div className="relative">
          <input
            ref={urlInputRef}
            type="text"
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
            className={`w-full px-5 py-4 text-lg border-2 rounded-xl font-inter bg-input-bg text-text placeholder:text-placeholder transition-all focus:outline-none focus:ring-0 ${
              urlError
                ? 'border-red-400 dark:border-red-500 focus:border-red-500'
                : 'border-border focus:border-accent'
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
          <p className="text-red-500 dark:text-red-400 text-sm mt-2">{urlError}</p>
        )}
      </div>

      {/* ── Report Language ───────────────────────────────── */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-text mb-2">
          <Languages size={14} className="inline mr-1.5 -mt-0.5" />
          Report Language
        </label>
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-3 border-2 border-border rounded-xl font-inter text-sm bg-input-bg text-text transition-all focus:outline-none focus:ring-0 focus:border-accent appearance-none cursor-pointer"
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

      {/* ── What's included ────────────────────────────────── */}
      <div className="mb-6 p-4 rounded-xl bg-off border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-accent" />
          <span className="text-sm font-bold text-text">Full Deep Audit</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {AUDIT_FEATURES.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckCircle size={13} className="text-accent flex-shrink-0" />
              <span className="text-xs text-muted">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Credits banner ────────────────────────────────── */}
      {credits !== null && hasCredits && (
        <div className="mb-6 p-4 rounded-xl bg-accent/5 border border-accent/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
              <Coins size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text">
                {credits} credit{credits !== 1 ? 's' : ''} available
              </p>
              <p className="text-xs text-muted">
                1 credit will be used. No payment needed.
              </p>
            </div>
            <span className="text-2xl font-bold text-accent">{credits}</span>
          </div>
        </div>
      )}

      {credits !== null && !hasCredits && (
        <div className="mb-6 p-4 rounded-xl bg-off border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text">No credits remaining</p>
              <p className="text-xs text-muted">This audit costs $99 or buy a credit pack to save.</p>
            </div>
            <Link
              href="/dashboard/buy-credits"
              className="text-xs font-semibold text-accent hover:text-accent-dk transition-colors whitespace-nowrap ml-3"
            >
              Buy Credits &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────── */}
      {generalError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-sm">{generalError}</p>
        </div>
      )}

      {/* ── CTA ────────────────────────────────────────────── */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 bg-accent text-white font-manrope font-bold text-lg py-4 px-8 rounded-xl hover:bg-accent-dk active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {hasCredits ? 'Starting audit...' : 'Creating checkout...'}
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
        {hasCredits
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
