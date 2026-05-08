'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Globe, Sparkles, Coins, Zap, Languages, Building2, Check, Fingerprint, ChevronDown, FileText, Palette, Lock, AlertCircle, Upload, X, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/languages';
import { AUDIT_MODULES, COMPLETE_AUDIT_SLUGS } from '@/lib/audit-modules';
import AllAuditsInclude from '@/components/ui/AllAuditsInclude';

type AuditType = 'website' | 'brand_identity' | 'design';

const AUDIT_TYPE_CONFIG: { type: AuditType; label: string; description: string; icon: React.ReactNode; available: boolean }[] = [
  {
    type: 'website',
    label: 'Website',
    description: 'Full UX audit of your live site',
    icon: <Globe size={22} />,
    available: true,
  },
  {
    type: 'brand_identity',
    label: 'Brand Identity',
    description: 'Analyze uploaded brand materials',
    icon: <Fingerprint size={22} />,
    available: true,
  },
  {
    type: 'design',
    label: 'Design',
    description: 'Review designs before production',
    icon: <Palette size={22} />,
    available: false, // Coming soon
  },
];

const NewAuditInner: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Audit type
  const typeParam = searchParams.get('type') as AuditType | null;
  const [auditType, setAuditType] = useState<AuditType>(typeParam === 'brand_identity' ? 'brand_identity' : 'website');

  // Website audit state
  const [url, setUrl] = useState(searchParams.get('url') || '');
  const depthParam = searchParams.get('depth');
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [packageTier, setPackageTier] = useState<string>('starter');
  const [firstAuditFree, setFirstAuditFree] = useState(false);

  // Module selection (slug-based) — website audits only
  const [selectedModules, setSelectedModules] = useState<string[]>([...COMPLETE_AUDIT_SLUGS]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const isCompleteAudit = COMPLETE_AUDIT_SLUGS.every((s) => selectedModules.includes(s));

  const isWhiteLabelEligible = packageTier === 'growth' || packageTier === 'agency' || packageTier === 'scale';

  // Brand identity selection (shared between website + brand identity audit)
  const [brandIdentities, setBrandIdentities] = useState<{ id: string; name: string; fileCount: number }[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(searchParams.get('brand') || '');

  // Inline brand creation + file upload
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandFiles, setNewBrandFiles] = useState<File[]>([]);
  const [brandUploading, setBrandUploading] = useState(false);
  const [brandUploadError, setBrandUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userLoading && user && urlInputRef.current && auditType === 'website') {
      urlInputRef.current.focus();
    }
  }, [userLoading, user, auditType]);

  // Fetch credits + brand identities
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
      .then((d) => {
        const identities = (d.identities || []).map((bi: any) => ({
          id: bi.id,
          name: bi.name,
          fileCount: bi.brand_identity_files?.length ?? 0,
        }));
        setBrandIdentities(identities);
      })
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
      const next = [...COMPLETE_AUDIT_SLUGS];
      if (selectedBrandId && !next.includes('brand_consistency')) {
        next.push('brand_consistency');
      }
      setSelectedModules(next);
    }
  };

  const selectedBrand = brandIdentities.find((bi) => bi.id === selectedBrandId);

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    const maxSize = 10 * 1024 * 1024;
    const valid: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!allowed.includes(f.type)) {
        setBrandUploadError(`${f.name}: unsupported file type`);
        return;
      }
      if (f.size > maxSize) {
        setBrandUploadError(`${f.name}: exceeds 10 MB limit`);
        return;
      }
      valid.push(f);
    }
    setBrandUploadError('');
    setNewBrandFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (idx: number) => {
    setNewBrandFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const createBrandAndUpload = async (): Promise<string | null> => {
    if (!newBrandName.trim()) {
      setBrandUploadError('Enter a name for the brand identity.');
      return null;
    }
    if (newBrandFiles.length === 0) {
      setBrandUploadError('Upload at least one file.');
      return null;
    }

    setBrandUploading(true);
    setBrandUploadError('');

    try {
      // 1. Create brand identity
      const createRes = await fetch('/api/brand-identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBrandName.trim() }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create brand identity');

      const brandId = createData.identity.id;

      // 2. Upload each file
      for (const file of newBrandFiles) {
        const fd = new FormData();
        fd.append('file', file);
        const uploadRes = await fetch(`/api/brand-identities/${brandId}/upload`, {
          method: 'POST',
          body: fd,
        });
        if (!uploadRes.ok) {
          const uploadData = await uploadRes.json();
          throw new Error(uploadData.error || `Failed to upload ${file.name}`);
        }
      }

      // 3. Update local state
      setBrandIdentities((prev) => [
        { id: brandId, name: newBrandName.trim(), fileCount: newBrandFiles.length },
        ...prev,
      ]);
      setSelectedBrandId(brandId);
      setShowNewBrand(false);
      setNewBrandName('');
      setNewBrandFiles([]);

      return brandId;
    } catch (err) {
      setBrandUploadError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setBrandUploading(false);
    }
  };

  const handleSubmit = async () => {
    // Validation per audit type
    if (auditType === 'website') {
      if (!validateUrl(url)) return;
      if (selectedModules.length === 0) {
        setGeneralError('Select at least one module to audit.');
        return;
      }
    } else if (auditType === 'brand_identity') {
      // If user is creating a new brand inline, do that first
      if (showNewBrand) {
        const newId = await createBrandAndUpload();
        if (!newId) return; // error was set inside createBrandAndUpload
        // Update selectedBrandId for the rest of the flow
        setSelectedBrandId(newId);
        // Use newId directly since state update is async
        setLoading(true);
        setGeneralError('');
        try {
          const supabase = createBrowserSupabase();
          const insertPayload: Record<string, any> = {
            user_id: user.id,
            status: hasCredits ? 'payment_received' : 'pending_payment',
            product_type: 'auto_detect',
            ux_concern: 'Brand identity audit',
            notes: null,
            plan: 'full_audit',
            language: language,
            audit_type: 'brand_identity',
            brand_identity_id: newId,
            depth_mode: 'deep',
          };
          let { data: audit, error: auditError } = await supabase
            .from('audits').insert(insertPayload).select('id').single();
          if (auditError?.message?.includes('selected_modules') ||
              auditError?.message?.includes('audit_type') ||
              auditError?.message?.includes('brand_identity_id')) {
            delete insertPayload.selected_modules;
            delete insertPayload.audit_type;
            delete insertPayload.brand_identity_id;
            const retry = await supabase.from('audits').insert(insertPayload).select('id').single();
            audit = retry.data; auditError = retry.error;
          }
          if (auditError) throw new Error(auditError.message || 'Failed to create audit');
          if (!audit) throw new Error('Failed to create audit');
          if (hasCredits) {
            const creditRes = await fetch('/api/credits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audit_id: audit.id, is_free_first: firstAuditFree }) });
            if (!creditRes.ok) throw new Error('Failed to apply credit');
            router.push(`/dashboard/audits/${audit.id}?payment=success`);
            return;
          }
          const checkoutRes = await fetch('/api/stripe/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audit_id: audit.id }) });
          const checkoutData = await checkoutRes.json();
          if (!checkoutRes.ok || !checkoutData.url) throw new Error(checkoutData.error || 'Failed to create checkout');
          window.location.href = checkoutData.url;
          return;
        } catch (err) {
          setGeneralError(err instanceof Error ? err.message : 'Something went wrong.');
          setLoading(false);
          return;
        }
      }
      if (!selectedBrandId) {
        setGeneralError('Select a brand identity or create a new one.');
        return;
      }
      if (selectedBrand && selectedBrand.fileCount === 0) {
        setGeneralError('This brand identity has no files uploaded. Upload at least one file before running an audit.');
        return;
      }
    }

    setLoading(true);
    setGeneralError('');

    try {
      const supabase = createBrowserSupabase();

      const insertPayload: Record<string, any> = {
        user_id: user.id,
        status: hasCredits ? 'payment_received' : 'pending_payment',
        product_type: 'auto_detect',
        ux_concern: auditType === 'brand_identity' ? 'Brand identity audit' : 'General UX audit',
        notes: null,
        plan: 'full_audit',
        language: language,
        audit_type: auditType,
      };

      if (auditType === 'website') {
        const productUrl = url.startsWith('http') ? url : `https://${url}`;
        insertPayload.product_url = productUrl;
        insertPayload.depth_mode = depthParam === 'deep' ? 'deep' : 'standard';
        insertPayload.selected_modules = selectedModules;
        if (selectedBrandId) insertPayload.brand_identity_id = selectedBrandId;
      } else if (auditType === 'brand_identity') {
        insertPayload.brand_identity_id = selectedBrandId;
        insertPayload.depth_mode = 'deep'; // Brand audits always run full analysis
      }

      let { data: audit, error: auditError } = await supabase
        .from('audits')
        .insert(insertPayload)
        .select('id')
        .single();

      // Fallback: if new columns don't exist yet, retry without them
      // Note: this strips audit_type + selected_modules + brand_identity_id which
      // means brand identity audits will NOT work without the DB migration.
      if (auditError?.message?.includes('selected_modules') ||
          auditError?.message?.includes('audit_type') ||
          auditError?.message?.includes('brand_identity_id')) {
        console.warn('[new-audit] Fallback: retrying without new columns. Brand audits require DB migration.');
        delete insertPayload.selected_modules;
        delete insertPayload.audit_type;
        delete insertPayload.brand_identity_id;
        const retry = await supabase
          .from('audits')
          .insert(insertPayload)
          .select('id')
          .single();
        audit = retry.data;
        auditError = retry.error;
      }

      if (auditError) {
        console.error('Audit insert error:', JSON.stringify(auditError));
        throw new Error(auditError.message || 'Failed to create audit');
      }
      if (!audit) throw new Error('Failed to create audit');

      // Use credits
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
          {auditType === 'brand_identity'
            ? 'Upload your brand materials and get AI-powered analysis of consistency, messaging, and quality.'
            : 'Paste your URL and our AI does a deep analysis across all 96 checkpoints.'}
        </p>
      </div>

      {/* ── Audit Type Selector ── */}
      <div className="mb-8">
        <div className="grid grid-cols-3 gap-3">
          {AUDIT_TYPE_CONFIG.map((config) => {
            const isSelected = auditType === config.type;
            const isDisabled = !config.available;

            return (
              <button
                key={config.type}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    setAuditType(config.type);
                    setGeneralError('');
                  }
                }}
                className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 transition-all text-center ${
                  isSelected
                    ? 'border-brand bg-brand/5 dark:bg-brand/[0.03]'
                    : isDisabled
                    ? 'border-border/50 opacity-50 cursor-not-allowed'
                    : 'border-border hover:border-brand/40 cursor-pointer'
                }`}
              >
                <div className={`transition-colors ${isSelected ? 'text-brand' : 'text-muted'}`}>
                  {config.icon}
                </div>
                <div>
                  <p className={`text-sm font-medium ${isSelected ? 'text-text' : 'text-muted'}`}>
                    {config.label}
                  </p>
                  <p className="text-[11px] text-muted leading-tight mt-0.5">
                    {config.description}
                  </p>
                </div>
                {isDisabled && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-muted bg-off px-1.5 py-0.5 rounded-full">
                    <Lock size={8} />
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          WEBSITE AUDIT FIELDS
          ══════════════════════════════════════════════════════════ */}
      {auditType === 'website' && (
        <>
          {/* URL Input */}
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

          {/* Audit Scope (Module Selection) */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
              <Zap size={15} className="text-brand" />
              Audit Scope
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setScopeOpen(!scopeOpen)}
                className="w-full flex items-center justify-between px-4 py-3 border-2 border-border rounded-xl font-body text-sm bg-input-bg text-text transition-all focus:outline-none focus:border-brand"
              >
                <span>
                  {isCompleteAudit
                    ? 'Complete Audit — all core modules'
                    : `Custom — ${selectedModules.length} module${selectedModules.length !== 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown size={14} className={`text-muted transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
              </button>

              {scopeOpen && (
                <div className="absolute z-[100] left-0 right-0 mt-1 bg-white dark:bg-[#1E1E24] border border-border rounded-xl shadow-xl dark:shadow-black/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => { toggleCompleteAudit(); if (!isCompleteAudit) setScopeOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors border-b border-border/50"
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                      isCompleteAudit ? 'bg-[#22C55E]' : 'border-2 border-border'
                    }`}>
                      {isCompleteAudit && <Check size={10} className="text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-text">Complete Audit</p>
                      <p className="text-[11px] text-muted">All core modules — full coverage</p>
                    </div>
                  </button>

                  {AUDIT_MODULES.map((mod) => {
                    const selected = selectedModules.includes(mod.slug);
                    const brandRequired = mod.requiresBrandIdentity && !selectedBrandId;
                    const disabled = brandRequired;

                    return (
                      <button
                        key={mod.slug}
                        type="button"
                        disabled={disabled}
                        onClick={() => { if (!disabled) toggleModule(mod.slug); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors text-left ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected && !disabled ? 'bg-[#22C55E]' : 'border-2 border-border'
                        }`}>
                          {selected && !disabled && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-text">{mod.name}</span>
                          {mod.requiresBrandIdentity && (
                            <span className="text-[11px] font-medium text-muted bg-off px-1.5 py-0.5 rounded-full ml-2">
                              Requires brand
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  <div className="px-4 py-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => setScopeOpen(false)}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selectedModules.length === 0 && (
              <p className="text-red-500 text-xs mt-2">Select at least one module to audit.</p>
            )}
          </div>

          {/* Brand Identity selector (optional for website audits) */}
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
                className="w-full px-4 py-2.5 border border-border rounded-xl font-body text-sm bg-input-bg text-text transition-all focus:outline-none focus:border-brand appearance-none"
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          BRAND IDENTITY AUDIT FIELDS
          ══════════════════════════════════════════════════════════ */}
      {auditType === 'brand_identity' && (
        <>
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
              <Fingerprint size={15} className="text-brand" />
              Brand Identity
            </label>

            {/* Toggle: existing vs new */}
            {!showNewBrand ? (
              <>
                {/* Existing brand selector */}
                {brandIdentities.length > 0 && (
                  <>
                    <select
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-border rounded-xl font-body text-sm bg-input-bg text-text transition-all focus:outline-none focus:border-brand appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                    >
                      <option value="">Select a brand identity...</option>
                      {brandIdentities.map((bi) => (
                        <option key={bi.id} value={bi.id}>
                          {bi.name} ({bi.fileCount} file{bi.fileCount !== 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>

                    {selectedBrand && selectedBrand.fileCount === 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#92400E]/40 flex items-start gap-2">
                        <AlertCircle size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-[#92400E] dark:text-[#FDE68A]">
                          This brand has no files uploaded.{' '}
                          <Link href={`/dashboard/brand-identity/${selectedBrandId}`} className="font-medium underline">
                            Upload files
                          </Link>{' '}
                          before running an audit.
                        </p>
                      </div>
                    )}

                    {selectedBrand && selectedBrand.fileCount > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-[#F0FDF4] dark:bg-[#166534]/20 border border-[#BBF7D0] dark:border-[#166534]/40 flex items-start gap-2">
                        <FileText size={14} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-[#374151] dark:text-[#BBF7D0]">
                          {selectedBrand.fileCount} file{selectedBrand.fileCount !== 1 ? 's' : ''} will be analyzed.
                          The AI will evaluate visual consistency, tone of voice, professionalism, and wording quality.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Create new brand button */}
                <button
                  type="button"
                  onClick={() => { setShowNewBrand(true); setSelectedBrandId(''); }}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-brand/40 text-sm font-medium text-muted hover:text-text transition-all ${brandIdentities.length > 0 ? 'mt-3' : ''}`}
                >
                  <Plus size={16} />
                  Create New Brand Identity
                </button>

                {brandIdentities.length > 0 && (
                  <p className="text-xs text-muted mt-2">
                    <Link href="/dashboard/brand-identity" className="text-brand hover:underline">
                      Manage brands
                    </Link>
                  </p>
                )}
              </>
            ) : (
              /* ── Inline new brand creation ── */
              <div className="rounded-xl border-2 border-brand/30 bg-brand/[0.02] dark:bg-brand/[0.03] p-4 space-y-4">
                {/* Brand name */}
                <div>
                  <label htmlFor="new-brand-name" className="block text-xs font-medium text-text mb-1.5">
                    Brand Name
                  </label>
                  <input
                    id="new-brand-name"
                    type="text"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="e.g. My Company"
                    className="w-full px-3 py-2.5 border-2 border-border rounded-lg font-body text-sm bg-input-bg text-text placeholder:text-placeholder transition-all focus:outline-none focus:border-brand"
                  />
                </div>

                {/* File upload area */}
                <div>
                  <label className="block text-xs font-medium text-text mb-1.5">
                    Brand Files
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.svg,.webp"
                    className="hidden"
                    onChange={(e) => handleAddFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleAddFiles(e.dataTransfer.files); }}
                    className="w-full flex flex-col items-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed border-border hover:border-brand/40 bg-off/50 transition-all cursor-pointer"
                  >
                    <Upload size={20} className="text-muted" />
                    <span className="text-xs text-muted">
                      Click to upload or drag files here
                    </span>
                    <span className="text-[10px] text-muted/60">
                      PDF, DOCX, TXT, PNG, JPG, SVG, WebP — max 10 MB each
                    </span>
                  </button>
                </div>

                {/* File list */}
                {newBrandFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {newBrandFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/50">
                        <FileText size={14} className="text-muted flex-shrink-0" />
                        <span className="text-xs text-text flex-1 truncate">{f.name}</span>
                        <span className="text-[10px] text-muted flex-shrink-0">
                          {f.size < 1024 * 1024
                            ? `${Math.round(f.size / 1024)} KB`
                            : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-muted hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted">
                      {newBrandFiles.length} file{newBrandFiles.length !== 1 ? 's' : ''} ready to upload
                    </p>
                  </div>
                )}

                {/* Upload error */}
                {brandUploadError && (
                  <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-red-600 dark:text-red-400 text-xs">{brandUploadError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewBrand(false);
                      setNewBrandName('');
                      setNewBrandFiles([]);
                      setBrandUploadError('');
                    }}
                    className="text-xs font-medium text-muted hover:text-text transition-colors"
                  >
                    Cancel
                  </button>
                  {brandIdentities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewBrand(false);
                        setNewBrandName('');
                        setNewBrandFiles([]);
                        setBrandUploadError('');
                      }}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      Use existing brand instead
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          SHARED FIELDS (both audit types)
          ══════════════════════════════════════════════════════════ */}

      {/* Report Language */}
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

      {/* White-label info */}
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

      {/* What's included — website audits only */}
      {auditType === 'website' && <AllAuditsInclude compact className="mb-6" />}

      {/* Free first audit banner */}
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
                No credit card needed. No credits deducted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Credits banner */}
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

      {/* Error */}
      {generalError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-700 dark:text-red-300 text-sm">{generalError}</p>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={loading || brandUploading || (auditType === 'brand_identity' && !showNewBrand && (!selectedBrandId || (selectedBrand?.fileCount ?? 0) === 0)) || (auditType === 'brand_identity' && showNewBrand && (newBrandFiles.length === 0 || !newBrandName.trim()))}
        className="w-full flex items-center justify-center gap-2.5 font-heading font-medium text-[15px] py-3 px-6 rounded-xl active:scale-[0.98] transition-all min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed text-[#111111]"
        style={{ background: 'linear-gradient(135deg, #84CC16, #BEF264, #84CC16)' }}
      >
        {loading || brandUploading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {brandUploading ? 'Uploading brand files...' : hasCredits ? 'Starting audit...' : 'Creating checkout...'}
          </>
        ) : firstAuditFree ? (
          <>
            Start Free Audit
            <ArrowRight size={20} />
          </>
        ) : hasCredits ? (
          <>
            Use 1 Credit — Start {auditType === 'brand_identity' ? 'Brand' : ''} Audit
            <ArrowRight size={20} />
          </>
        ) : (
          <>
            Start {auditType === 'brand_identity' ? 'Brand ' : ''}Audit — $99
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
