'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Globe, Sparkles, Coins, CheckCircle, Zap, Languages, Building2, Upload, X, ChevronDown, Scale, Heart, Accessibility, Brain, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/languages';
import AllAuditsInclude from '@/components/ui/AllAuditsInclude';

const AUDIT_FEATURES = [
  '64-point deep analysis',
  '16 UX categories audited',
  'AI discoverability check',
  'PDF + DOCX professional reports',
  'Prioritised findings & recommendations',
];

const PILLARS = [
  { idx: 0, name: 'Foundation', desc: 'Visual design, messaging, navigation, content', Icon: Scale, color: '#6366F1', bg: 'bg-[#6366F1]/10' },
  { idx: 1, name: 'Human Experience', desc: 'Conversion, trust, ethics, psychology', Icon: Heart, color: '#EC4899', bg: 'bg-pink-500/10' },
  { idx: 2, name: 'Inclusive Design', desc: 'Accessibility, cognitive, wellbeing, mobile', Icon: Accessibility, color: '#F59E0B', bg: 'bg-amber-500/10' },
  { idx: 3, name: 'Future Readiness', desc: 'Performance, AI, agents, global', Icon: Brain, color: '#10B981', bg: 'bg-[#10B981]/10' },
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

  // Pillar selection (only for re-audits by paying users)
  const [selectedPillars, setSelectedPillars] = useState<number[]>([0, 1, 2, 3]); // all selected by default
  const [showPillarPicker, setShowPillarPicker] = useState(false);
  const [hasPriorAudit, setHasPriorAudit] = useState(false);
  const isAllPillars = selectedPillars.length === 4;

  // White-label fields (Agency/Scale only)
  const [whiteLabelOpen, setWhiteLabelOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isWhiteLabelEligible = packageTier === 'agency' || packageTier === 'scale';

  useEffect(() => {
    if (!userLoading && user && urlInputRef.current) {
      urlInputRef.current.focus();
    }
  }, [userLoading, user]);

  // Check if this URL already has a completed audit (enables pillar picker for re-audits)
  useEffect(() => {
    if (!user || !url.trim()) { setHasPriorAudit(false); return; }
    const checkPrior = async () => {
      try {
        const supabase = createBrowserSupabase();
        const productUrl = url.startsWith('http') ? url : `https://${url}`;
        let hostname = '';
        try { hostname = new URL(productUrl).hostname.replace(/^www\./, ''); } catch { return; }
        const { data } = await supabase
          .from('audits')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .ilike('product_url', `%${hostname}%`)
          .limit(1);
        setHasPriorAudit(!!(data && data.length > 0));
      } catch { setHasPriorAudit(false); }
    };
    const timeout = setTimeout(checkPrior, 500); // debounce
    return () => clearTimeout(timeout);
  }, [user, url]);

  // Fetch credits + package tier
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
  }, [user]);

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
        <a href="/login" className="inline-flex items-center gap-2 bg-brand text-surface dark:text-[#111111] font-medium text-[15px] px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110">
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

  const handleSubmit = async () => {
    if (!validateUrl(url)) return;
    if (hasPriorAudit && selectedPillars.length === 0) {
      setGeneralError('Select at least one pillar to audit.');
      return;
    }

    setLoading(true);
    setGeneralError('');

    try {
      const supabase = createBrowserSupabase();
      const productUrl = url.startsWith('http') ? url : `https://${url}`;

      // Upload white-label logo if provided
      let whitelabelLogoUrl: string | null = null;
      if (isWhiteLabelEligible && logoFile) {
        setLogoUploading(true);
        const ext = logoFile.name.split('.').pop() || 'png';
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('white-label-logos')
          .upload(filePath, logoFile, { cacheControl: '31536000', upsert: false });
        setLogoUploading(false);
        if (uploadErr) {
          console.error('Logo upload error:', uploadErr);
          throw new Error('Failed to upload logo. Please try again.');
        }
        const { data: urlData } = supabase.storage.from('white-label-logos').getPublicUrl(filePath);
        whitelabelLogoUrl = urlData.publicUrl;
      }

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
          ...(hasPriorAudit && !isAllPillars && selectedPillars.length > 0 ? { selected_pillars: selectedPillars } : {}),
          ...(isWhiteLabelEligible && companyName.trim() ? { white_label_company_name: companyName.trim() } : {}),
          ...(isWhiteLabelEligible && whitelabelLogoUrl ? { white_label_logo_url: whitelabelLogoUrl } : {}),
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

      {/* ── URL Input ──────────────────────────────────────── */}
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

      {/* ── Report Language ───────────────────────────────── */}
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

      {/* ── Pillar Selection (re-audit only, paying users) ─────── */}
      {hasPriorAudit && !firstAuditFree && (
        <div className="mb-6 rounded-xl border-2 border-border/60 dark:border-white/[0.08] bg-card overflow-hidden">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setShowPillarPicker(!showPillarPicker)}
            className="w-full flex items-center justify-between gap-2 px-5 py-4 hover:bg-off/50 dark:hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-brand" />
              <span className="text-sm font-medium text-text">Audit Scope</span>
              {!showPillarPicker && (
                <span className="text-[10px] font-medium text-muted bg-off dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
                  {isAllPillars ? 'All 4 pillars' : `${selectedPillars.length} pillar${selectedPillars.length !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>
            <ChevronDown size={14} className={`text-muted transition-transform duration-200 ${showPillarPicker ? 'rotate-180' : ''}`} />
          </button>

          {showPillarPicker && (
            <div className="px-5 pb-5 border-t border-border/40 dark:border-white/[0.04]">
              <p className="text-xs text-muted mt-3 mb-4">
                Focus your re-audit on specific pillars, or run all four for a complete analysis.
              </p>

              {/* Select All toggle */}
              <button
                type="button"
                onClick={() => setSelectedPillars(isAllPillars ? [] : [0, 1, 2, 3])}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 mb-3 transition-all ${
                  isAllPillars
                    ? 'border-[#22C55E]/50 bg-[#22C55E]/5 dark:bg-[#22C55E]/10'
                    : 'border-border/60 dark:border-white/[0.08] hover:border-border'
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                  isAllPillars ? 'bg-[#22C55E]' : 'bg-white dark:bg-white/10 border-2 border-border'
                }`}>
                  {isAllPillars && <Check size={12} className="text-white" />}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium text-text">Complete audit</p>
                  <p className="text-[11px] text-muted">All 4 pillars, 16 categories, 64 checkpoints</p>
                </div>
              </button>

              {/* Individual pillar toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PILLARS.map((p) => {
                  const selected = selectedPillars.includes(p.idx);
                  const PIcon = p.Icon;
                  return (
                    <button
                      key={p.idx}
                      type="button"
                      onClick={() => {
                        setSelectedPillars(prev =>
                          selected
                            ? prev.filter(i => i !== p.idx)
                            : [...prev, p.idx].sort()
                        );
                      }}
                      className={`flex items-start gap-3 px-3.5 py-3 rounded-lg border-2 transition-all text-left ${
                        selected
                          ? 'border-[#22C55E]/40 dark:border-[#22C55E]/30 bg-[#22C55E]/5 dark:bg-[#22C55E]/[0.06]'
                          : 'border-border/40 dark:border-white/[0.06] hover:border-border opacity-60'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        selected ? 'bg-[#22C55E]' : 'bg-white dark:bg-white/10 border-2 border-border'
                      }`}>
                        {selected && <Check size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <PIcon size={13} style={{ color: p.color }} />
                          <span className="text-xs font-medium text-text">{p.name}</span>
                        </div>
                        <p className="text-[10px] text-muted leading-snug">{p.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedPillars.length === 0 && (
                <p className="text-red-500 dark:text-red-400 text-xs mt-2">Select at least one pillar to audit.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── White-label branding (Agency/Scale only) — collapsible ── */}
      {isWhiteLabelEligible && (
        <div className="mb-6 rounded-xl border-2 border-dashed border-brand/20 dark:border-brand/10 bg-brand/5 dark:bg-brand/[0.03] overflow-hidden">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setWhiteLabelOpen(!whiteLabelOpen)}
            className="w-full flex items-center justify-between gap-2 px-5 py-4 hover:bg-brand/5 dark:hover:bg-brand/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-brand" />
              <span className="text-sm font-medium text-text">White-Label Branding</span>
              <span className="text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                {packageTier}
              </span>
              {!whiteLabelOpen && (companyName.trim() || logoPreview) && (
                <span className="text-[10px] text-[#22C55E] font-medium">Configured</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              {!whiteLabelOpen && <span className="text-xs">Optional</span>}
              <ChevronDown size={14} className={`transition-transform duration-200 ${whiteLabelOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Collapsible content */}
          {whiteLabelOpen && (
            <div className="px-5 pb-5 border-t border-brand/10 dark:border-brand/10">
              <p className="text-xs text-muted mt-3 mb-4">
                Replace ClearUX branding with your own in the PDF &amp; Word reports.
              </p>

              {/* Company name */}
              <div className="mb-4">
                <label htmlFor="wl-company" className="block text-xs font-medium text-text mb-1.5">
                  Company Name
                </label>
                <input
                  id="wl-company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your Company Name (optional)"
                  className="w-full px-4 py-2.5 border border-border rounded-lg font-body text-sm bg-input-bg text-text placeholder:text-placeholder transition-all focus:outline-none focus:ring-0 focus:border-brand"
                />
              </div>

              {/* Logo upload */}
              <div>
                <label className="block text-xs font-medium text-text mb-1.5">
                  Company Logo
                </label>
                {logoPreview ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-10 w-auto max-w-[120px] object-contain rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text font-medium truncate">{logoFile?.name}</p>
                      <p className="text-[10px] text-muted">{logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                      className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-muted hover:text-red-500 transition-colors"
                      aria-label="Remove logo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-border rounded-lg text-sm text-muted hover:text-text hover:border-brand hover:bg-brand/5 dark:hover:bg-brand/5 transition-all"
                  >
                    <Upload size={14} />
                    Upload logo (PNG, JPG, SVG — optional)
                  </button>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      setGeneralError('Logo must be under 2 MB');
                      return;
                    }
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── What's included ────────────────────────────────── */}
      <AllAuditsInclude compact className="mb-6" />

      {/* ── Free first audit banner ──────────────────────── */}
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

      {/* ── Credits banner ────────────────────────────────── */}
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
        className="w-full sm:max-w-md sm:mx-auto flex items-center justify-center gap-2.5 font-heading font-medium text-[15px] py-3 px-6 rounded-xl active:scale-[0.98] transition-all min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed text-[#111111]"
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
