'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Globe, Sparkles, Coins, Zap, Languages, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/languages';
import { AUDIT_MODULES, COMPLETE_AUDIT_SLUGS } from '@/lib/audit-modules';
import AllAuditsInclude from '@/components/ui/AllAuditsInclude';
import { useWorkspace } from '@/context/WorkspaceContext';

type AuditType = 'website';

// Website audit only — Brand Identity audits are launched from the Brand DNA page.

const NewAuditInner: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();
  const { workspace, workspaceSlug } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Audit type — always website. Brand Identity audits redirect to Brand DNA.
  const typeParam = searchParams.get('type');
  const [auditType] = useState<AuditType>('website');

  // Mode: 'new-brand' (default) shows URL input; 're-audit' and 'dig-deeper' hide it
  const modeParam = searchParams.get('mode') as 'new-brand' | 're-audit' | 'dig-deeper' | null;
  const auditMode = modeParam === 're-audit' || modeParam === 'dig-deeper' ? modeParam : 'new-brand';
  const isReAuditMode = auditMode === 're-audit';
  const isDigDeeperMode = auditMode === 'dig-deeper';

  // Website audit state
  // Pre-fill URL from workspace domain so users don't re-enter it
  const workspaceDomain = workspace?.primary_domain || '';
  const initialUrl = searchParams.get('url') || (workspaceDomain ? `https://${workspaceDomain}` : '');
  const [url, setUrl] = useState(initialUrl);
  const domainPreFilled = !!workspaceDomain && auditMode === 'new-brand' && !searchParams.get('url');
  const depthParam = searchParams.get('depth');
  const [hasExistingAudit, setHasExistingAudit] = useState(depthParam === 'deep' || isReAuditMode || isDigDeeperMode);
  const isReAudit = hasExistingAudit;
  const [depthMode, setDepthMode] = useState<'standard' | 'deep'>(depthParam === 'deep' || isDigDeeperMode ? 'deep' : 'standard');
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [urlError, setUrlError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);
  const [firstAuditFree, setFirstAuditFree] = useState(false);
  const [canReaudit, setCanReaudit] = useState(false);
  const [canDeepAudit, setCanDeepAudit] = useState(false);
  const [reauditsRemaining, setReauditsRemaining] = useState(0);
  const [reauditsPerMonth, setReauditsPerMonth] = useState(0);
  const [deepAuditsRemaining, setDeepAuditsRemaining] = useState(0);
  const [deepAuditsPerMonth, setDeepAuditsPerMonth] = useState(0);
  // Entitlement state: true only after /api/credits resolves.
  // CRITICAL: CTA must NOT show pricing until this is true.
  const [entitlementLoaded, setEntitlementLoaded] = useState(false);

  // Module selection (slug-based) — website audits only
  const [selectedModules, setSelectedModules] = useState<string[]>([...COMPLETE_AUDIT_SLUGS]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const isCompleteAudit = COMPLETE_AUDIT_SLUGS.every((s) => selectedModules.includes(s));

  // Design consistency — workspace-scoped Brand DNA enrichment check
  const [workspaceBrandId, setWorkspaceBrandId] = useState<string | null>(null);
  const [workspaceBrandHasFiles, setWorkspaceBrandHasFiles] = useState(false);
  const [includeBrandConsistency, setIncludeBrandConsistency] = useState(false);

  // When workspace loads with a primary_domain, auto-fill url if still empty
  useEffect(() => {
    if (workspaceDomain && !url && auditMode === 'new-brand' && !searchParams.get('url')) {
      setUrl(`https://${workspaceDomain}`);
    }
  }, [workspaceDomain]);

  useEffect(() => {
    if (!userLoading && user && urlInputRef.current && auditType === 'website' && auditMode === 'new-brand' && !domainPreFilled) {
      urlInputRef.current.focus();
    }
  }, [userLoading, user, auditType, auditMode, domainPreFilled]);

  // Redirect brand_identity requests to Brand DNA page
  useEffect(() => {
    if (typeParam === 'brand_identity' || typeParam === 'design') {
      const brandParam = searchParams.get('brand');
      router.replace(`${dashPrefix}/brand-dna`);
    }
  }, [typeParam, searchParams, router]);

  // Fetch credits + subscription usage
  useEffect(() => {
    if (!user) return;
    fetch('/api/credits')
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? 0);
        if (d.first_audit_free) setFirstAuditFree(true);
        setCanReaudit(d.can_reaudit ?? false);
        setCanDeepAudit(d.can_deep_audit ?? false);
        setReauditsRemaining(d.reaudits_remaining ?? 0);
        setReauditsPerMonth(d.reaudits_per_month ?? 0);
        setDeepAuditsRemaining(d.deep_audits_remaining ?? 0);
        setDeepAuditsPerMonth(d.deep_audits_per_month ?? 0);
        setEntitlementLoaded(true);
      })
      .catch(() => {
        setCredits(0);
        setEntitlementLoaded(true);
      });
  }, [user]);

  // Check if current workspace has Brand DNA with files
  useEffect(() => {
    if (!user || !workspace) return;
    const brandId = (workspace as any).active_brand_identity_id;
    if (!brandId) {
      setWorkspaceBrandId(null);
      setWorkspaceBrandHasFiles(false);
      return;
    }
    setWorkspaceBrandId(brandId);
    fetch(`/api/brand-identities/${brandId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const files = d?.identity?.brand_identity_files || [];
        setWorkspaceBrandHasFiles(files.length > 0);
      })
      .catch(() => setWorkspaceBrandHasFiles(false));
  }, [user, workspace]);

  // In re-audit / dig-deeper mode, resolve the brand's website URL if not already set
  useEffect(() => {
    if (auditMode === 'new-brand' || !user) return;
    const brandParam = searchParams.get('brand');
    if (url) return; // URL already provided via param
    if (!brandParam) return;
    // Fetch brand details to get website_url
    fetch(`/api/brand-identities/${brandParam}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.identity?.website_url) {
          setUrl(d.identity.website_url);
        }
      })
      .catch(() => {});
  }, [user, auditMode, searchParams, url]);

  // Check if the domain has been audited before — show depth switcher if so
  useEffect(() => {
    if (!user || auditType !== 'website') return;
    // Already detected via URL param or re-audit/dig-deeper mode
    if (depthParam === 'deep' || isReAuditMode || isDigDeeperMode) return;

    let cancelled = false;
    const checkDomain = async () => {
      try {
        let parsed: URL;
        try {
          parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        } catch {
          if (!cancelled) setHasExistingAudit(false);
          return;
        }
        const domain = parsed.hostname.replace(/^www\./, '');
        if (!domain || domain.length < 3) {
          if (!cancelled) setHasExistingAudit(false);
          return;
        }
        const resp = await fetch(`/api/audits/check-domain?domain=${encodeURIComponent(domain)}`);
        if (!resp.ok) { if (!cancelled) setHasExistingAudit(false); return; }
        const data = await resp.json();
        if (!cancelled) setHasExistingAudit(data.hasExisting === true);
      } catch {
        if (!cancelled) setHasExistingAudit(false);
      }
    };

    // Debounce — only check after user stops typing for 600ms
    const timer = setTimeout(checkDomain, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [url, user, auditType, depthParam]);

  // Auto-add brand_consistency when checkbox is checked; remove when unchecked
  useEffect(() => {
    if (includeBrandConsistency && !selectedModules.includes('brand_consistency')) {
      setSelectedModules((prev) => [...prev, 'brand_consistency']);
    } else if (!includeBrandConsistency && selectedModules.includes('brand_consistency')) {
      setSelectedModules((prev) => prev.filter((s) => s !== 'brand_consistency'));
    }
  }, [includeBrandConsistency]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ink)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-muted mb-4">Please sign in to create an audit</p>
        <a href="/login" className="inline-flex items-center gap-2 font-medium text-[15px] px-6 py-3 min-h-[48px] rounded-lg transition-all hover:opacity-90" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
          Sign In
        </a>
      </div>
    );
  }

  // Determine if user can start this audit without Stripe checkout.
  // Logic depends on audit type:
  //   - Deep audit → needs deep audit allowance (subscription)
  //   - Re-audit (standard) → needs re-audit allowance (subscription)
  //   - Initial audit → needs credits or free first audit or re-audit allowance
  const isDeepAudit = depthMode === 'deep';
  const canStartAudit = credits !== null && (
    isDeepAudit
      ? canDeepAudit
      : isReAudit
        ? canReaudit
        : (credits > 0 || firstAuditFree || canReaudit)
  );
  // Keep hasCredits as alias for backward compat in the template
  const hasCredits = canStartAudit;
  // Subscriber with 0 credit-pack credits using re-audit allowance for an initial audit
  const isSubscriptionInitial = !isDeepAudit && !isReAudit && credits !== null && credits <= 0 && canReaudit;

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
      if (includeBrandConsistency && !next.includes('brand_consistency')) {
        next.push('brand_consistency');
      }
      setSelectedModules(next);
    }
  };

  const resolvedBrandIdRef = useRef<string | null>(null);

  /**
   * Find or create a workspace for the given domain.
   * If the current workspace already matches the domain, reuse it.
   * Otherwise look through existing workspaces or create a new one.
   * Returns { id, slug } of the resolved workspace.
   */
  const ensureWorkspaceForDomain = async (productUrl: string): Promise<{ id: string; slug: string } | null> => {
    try {
      const host = new URL(productUrl).hostname.replace(/^www\./, '');

      // If the current workspace matches this domain, no need to create/switch
      if (workspace?.primary_domain === host) {
        return { id: workspace.id, slug: (workspace as any).slug || workspaceSlug };
      }

      // Check if any existing workspace matches this domain
      const res = await fetch('/api/workspaces');
      if (!res.ok) return null;
      const { workspaces: allWs } = await res.json();
      const existing = (allWs || []).find((w: any) => w.primary_domain === host);
      if (existing) {
        return { id: existing.id, slug: existing.slug };
      }

      // Create a new workspace for this domain
      const prettyName = host.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      const createRes = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prettyName,
          primary_domain: host,
          workspace_type: 'website',
        }),
      });
      if (!createRes.ok) {
        console.warn('[new-audit] Failed to create workspace for', host);
        return workspace ? { id: workspace.id, slug: (workspace as any).slug || workspaceSlug } : null;
      }
      const { workspace: newWs } = await createRes.json();
      return { id: newWs.id, slug: newWs.slug };
    } catch (err) {
      console.warn('[new-audit] Error ensuring workspace:', err);
      return workspace ? { id: workspace.id, slug: (workspace as any).slug || workspaceSlug } : null;
    }
  };

  /**
   * Find or create a brand_identity for a website domain.
   * Every website audit needs a brand so the sidebar has a proper brand tab.
   */
  const ensureBrandForWebsite = async (productUrl: string): Promise<string | null> => {
    try {
      const host = new URL(productUrl).hostname.replace(/^www\./, '');
      // Fetch all brands to check if one already exists for this domain
      const wsParam = workspace?.id ? `?workspace_id=${workspace.id}` : '';
      const brandsRes = await fetch(`/api/brand-identities${wsParam}`).then(r => r.ok ? r.json() : { identities: [] }).catch(() => ({ identities: [] }));
      const allBrands = (brandsRes?.identities || []) as any[];
      // Match by website_url containing the same hostname
      const existing = allBrands.find((b: any) => {
        if (!b.website_url) return false;
        try {
          const bHost = new URL(b.website_url).hostname.replace(/^www\./, '');
          return bHost === host;
        } catch { return false; }
      });
      if (existing) return existing.id;

      // No existing brand — create one automatically
      const createRes = await fetch('/api/brand-identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: host, website_url: productUrl, workspace_id: workspace?.id ?? null }),
      });
      if (!createRes.ok) {
        console.warn('[new-audit] Failed to auto-create brand for', host);
        return null;
      }
      const createData = await createRes.json();
      return createData?.identity?.id || null;
    } catch (err) {
      console.warn('[new-audit] Error ensuring brand for website:', err);
      return null;
    }
  };

  const handleSubmit = async () => {
    // TRUST GUARD: Never allow submit while entitlements are unresolved.
    // Without this, a click during the loading window would route to
    // Stripe checkout even if the user has credits or a subscription.
    if (!entitlementLoaded) return;

    // Validation per audit type
    if (auditType === 'website') {
      if (!validateUrl(url)) return;
      if (selectedModules.length === 0) {
        setGeneralError('Select at least one module to audit.');
        return;
      }
    }

    setLoading(true);
    setGeneralError('');

    try {
      const supabase = createBrowserSupabase();

      // Resolve the correct workspace for the domain being audited.
      // This ensures new domains get their own workspace, and audits
      // for existing domains go to the right workspace — not the
      // currently selected one in the sidebar.
      const productUrl = url.startsWith('http') ? url : `https://${url}`;
      const resolvedWs = await ensureWorkspaceForDomain(productUrl);
      const targetWorkspaceId = resolvedWs?.id || workspace?.id || null;
      const targetSlug = resolvedWs?.slug || workspaceSlug;

      if (!targetWorkspaceId) {
        throw new Error('Could not resolve a workspace for this domain. Please try again.');
      }

      const isStarting = hasCredits;
      const insertPayload: Record<string, any> = {
        user_id: user.id,
        status: isStarting ? 'payment_received' : 'pending_payment',
        product_type: 'auto_detect',
        ux_concern: 'General UX audit',
        notes: null,
        plan: 'full_audit',
        language: language,
        audit_type: auditType,
        workspace_id: targetWorkspaceId,
        // Set initial progress so the UI shows activity immediately (no refresh needed)
        progress_percent: isStarting ? 1 : 0,
        audit_stage: isStarting ? 'preflight' : null,
      };

      if (auditType === 'website') {
        insertPayload.product_url = productUrl;
        insertPayload.depth_mode = (isReAuditMode || isDigDeeperMode) ? depthMode : 'standard';
        insertPayload.selected_modules = selectedModules;
        // Use workspace brand if design consistency Brand DNA is checked, otherwise
        // auto-create (or reuse) a brand for this domain so the sidebar
        // always has a proper brand tab for the user to navigate to.
        const brandId = (includeBrandConsistency && workspaceBrandId)
          ? workspaceBrandId
          : await ensureBrandForWebsite(productUrl);
        if (brandId) {
          insertPayload.brand_identity_id = brandId;
          resolvedBrandIdRef.current = brandId;
        }
      }

      const { data: audit, error: auditError } = await supabase
        .from('audits')
        .insert(insertPayload)
        .select('id')
        .single();

      // If the DB rejects because schema is out of date, fail
      // hard with a clear actionable message rather than silently
      // downgrading the audit. Quietly stripping selected_modules
      // / audit_type / brand_identity_id would charge the user
      // for an audit that can't produce the intended output.
      if (auditError?.message?.includes('selected_modules') ||
          auditError?.message?.includes('audit_type') ||
          auditError?.message?.includes('brand_identity_id')) {
        console.error('[new-audit] Required migration columns missing:', auditError);
        throw new Error(
          'This Fixpath instance is missing required database migrations. ' +
          'Please ask an admin to run supabase/migrations/021 and 022 before trying again.'
        );
      }

      if (auditError) {
        console.error('Audit insert error:', JSON.stringify(auditError));
        throw new Error(auditError.message || 'Failed to create audit');
      }
      if (!audit) throw new Error('Failed to create audit');

      // Use credits / subscription allowance
      // The backend derives billing class (initial/reaudit/deep) from the audit record.
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
        // Trigger the shell loading overlay before hard-navigating
        window.dispatchEvent(new Event('clearux:navigating'));
        window.location.href = `/dashboard/${targetSlug}/overview`;
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
        <h1 className="text-xl font-medium font-sans mb-2" style={{ color: 'var(--ink)' }}>
          {isReAuditMode ? 'Re-run Website Audit' : isDigDeeperMode ? 'Dig deeper' : domainPreFilled ? 'Run audit' : 'Add new site or brand'}
        </h1>
        <p className="text-[14px]" style={{ color: 'var(--m-muted)' }}>
          {isReAuditMode
            ? 'Run a fresh audit on this brand to check for improvements and new issues.'
            : isDigDeeperMode
            ? 'Run a deeper analysis with extended modules and additional checks.'
            : domainPreFilled
            ? 'Choose your modules and start the audit.'
            : 'Paste your URL and our AI does a deep analysis across all 112 checkpoints.'}
        </p>
      </div>

      {/* Audit type is always website — Brand DNA audits are launched from /dashboard/brand-dna */}

      {/* ══════════════════════════════════════════════════════════
          WEBSITE AUDIT FIELDS
          ══════════════════════════════════════════════════════════ */}
      {auditType === 'website' && (
        <>
          {/* Re-audit / Dig deeper mode: show brand context banner instead of URL input */}
          {(isReAuditMode || isDigDeeperMode) && url && (
            <div className="mb-6 px-4 py-3 rounded-xl" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                <RefreshCw size={13} className="inline mr-1.5 -mt-0.5" />
                {isReAuditMode ? 'Re-auditing' : 'Running deeper audit on'}:{' '}
                <span className="font-semibold">{url}</span>
              </p>
            </div>
          )}

          {/* Domain pre-filled from workspace — show banner, not input */}
          {domainPreFilled && url && (
            <div className="mb-6 px-4 py-3 rounded-xl" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                <Globe size={13} className="inline mr-1.5 -mt-0.5" />
                Auditing:{' '}
                <span className="font-semibold">{workspaceDomain}</span>
              </p>
            </div>
          )}

          {/* URL Input — only shown in new-brand mode when domain is NOT pre-filled */}
          {auditMode === 'new-brand' && !domainPreFilled && (
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
                className={`w-full px-5 py-4 text-lg border-2 rounded-xl font-sans bg-input-bg text-text placeholder:text-placeholder transition-all focus:outline-none focus:ring-0 ${
                  urlError
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-border focus:border-text'
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
              <p id="url-error" className="text-sm mt-2" style={{ color: 'var(--severe)' }} role="alert">{urlError}</p>
            )}
          </div>
          )}

          {/* Deep mode switcher — only shown for explicit re-audits / dig-deeper, never for new brands */}
          {(isReAuditMode || isDigDeeperMode) && (
            <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
                <Sparkles size={15} style={{ color: 'var(--ink)' }} />
                Analysis depth
              </label>
              <div className="flex rounded-lg overflow-hidden" style={{ border: '2px solid var(--rule)' }}>
                <button
                  type="button"
                  onClick={() => setDepthMode('standard')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all"
                  style={{
                    background: depthMode === 'standard' ? 'color-mix(in srgb, var(--ink) 6%, transparent)' : 'transparent',
                    color: depthMode === 'standard' ? 'var(--ink)' : 'var(--m-muted)',
                    borderRight: '1px solid var(--rule)',
                  }}
                >
                  <RefreshCw size={14} />
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setDepthMode('deep')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all"
                  style={{
                    background: depthMode === 'deep' ? 'color-mix(in srgb, var(--ink) 6%, transparent)' : 'transparent',
                    color: depthMode === 'deep' ? 'var(--ink)' : 'var(--m-muted)',
                  }}
                >
                  <Sparkles size={14} />
                  Deep
                </button>
              </div>
              <p className="text-xs text-muted mt-1.5">
                {depthMode === 'deep'
                  ? 'Full AI re-analysis. Finds new issues that may have appeared since the last audit.'
                  : 'Checks progress on previous findings. Fast and consistent scoring.'}
              </p>
            </div>
          )}

          {/* Audit Scope (Module Selection) */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-2">
              <Zap size={15} style={{ color: 'var(--ink)' }} />
              Audit Scope
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setScopeOpen(!scopeOpen)}
                className="w-full flex items-center justify-between px-4 py-3 border-2 border-border rounded-xl font-sans text-sm bg-input-bg text-text transition-all focus:outline-none focus:border-text"
              >
                <span>
                  {isCompleteAudit
                    ? 'Complete Audit — all core modules'
                    : `Custom — ${selectedModules.length} module${selectedModules.length !== 1 ? 's' : ''} selected`}
                </span>
                <ChevronDown size={14} className={`text-muted transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
              </button>

              {scopeOpen && (
                <div className="absolute z-[100] left-0 right-0 mt-1 rounded-xl shadow-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                  <button
                    type="button"
                    onClick={() => { toggleCompleteAudit(); if (!isCompleteAudit) setScopeOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors border-b border-border/50"
                  >
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                      style={isCompleteAudit ? { background: 'var(--ok)' } : { border: '2px solid var(--rule)' }}>
                      {isCompleteAudit && <Check size={10} className="text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-text">Complete Audit</p>
                      <p className="text-[11px] text-muted">All core modules — full coverage</p>
                    </div>
                  </button>

                  {AUDIT_MODULES.map((mod) => {
                    const selected = selectedModules.includes(mod.slug);

                    return (
                      <button
                        key={mod.slug}
                        type="button"
                        onClick={() => { toggleModule(mod.slug); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors text-left"
                      >
                        <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                          style={selected ? { background: 'var(--ok)' } : { border: '2px solid var(--rule)' }}>
                          {selected && <Check size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-text">{mod.name}</span>
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

          {/* Brand DNA comparison — opt-in to compare against uploaded brand guidelines */}
          <div className="mb-6">
            <label
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                workspaceBrandHasFiles ? 'hover:bg-surface' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ border: '1px solid var(--rule)', background: includeBrandConsistency ? 'color-mix(in srgb, var(--ok) 4%, transparent)' : 'transparent' }}
            >
              <input
                type="checkbox"
                checked={includeBrandConsistency}
                disabled={!workspaceBrandHasFiles}
                onChange={(e) => setIncludeBrandConsistency(e.target.checked)}
                className="sr-only"
              />
              <div
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                style={includeBrandConsistency ? { background: 'var(--ok)' } : { border: '2px solid var(--rule)' }}
              >
                {includeBrandConsistency && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  Include Brand DNA comparison
                </span>
                {workspaceBrandHasFiles ? (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    Compare your website against uploaded brand guidelines. Without this, Design Consistency still runs but scores based on the website's own internal visual consistency.
                  </p>
                ) : (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--m-muted)' }}>
                    Upload brand files on the{' '}
                    <Link href={`${dashPrefix}/brand-dna`} className="font-medium hover:underline" style={{ color: 'var(--ink)' }}>
                      Brand DNA tab
                    </Link>{' '}
                    to enable Brand DNA comparison. Design Consistency will still run based on your website's internal visual consistency.
                  </p>
                )}
              </div>
            </label>
          </div>
        </>
      )}

      {/* Brand Identity audit fields removed — Brand DNA audits launch from /dashboard/brand-dna */}

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
            className="w-full px-4 py-3 border-2 border-border rounded-xl font-sans text-sm bg-input-bg text-text transition-all focus:outline-none focus:ring-0 focus:border-text appearance-none cursor-pointer"
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

      {/* What's included — website audits only */}
      {auditType === 'website' && <AllAuditsInclude compact className="mb-6" />}

      {/* Free first audit banner */}
      {firstAuditFree && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ink)' }}>
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

      {/* Usage banner — shows what resource this audit will consume */}
      {!firstAuditFree && credits !== null && hasCredits && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: 'color-mix(in srgb, var(--ok) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--ok) 20%, transparent)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--ok)' }}>
              {isDeepAudit ? <Zap size={18} className="text-white" /> : isReAudit ? <RefreshCw size={18} className="text-white" /> : <Coins size={18} className="text-white" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text">
                {isDeepAudit
                  ? `${deepAuditsRemaining} deep audit${deepAuditsRemaining !== 1 ? 's' : ''} remaining`
                  : isReAudit
                    ? `${reauditsRemaining} re-audit${reauditsRemaining !== 1 ? 's' : ''} remaining`
                    : isSubscriptionInitial
                      ? `${reauditsRemaining} audit${reauditsRemaining !== 1 ? 's' : ''} remaining this month`
                      : `${credits} credit${credits !== 1 ? 's' : ''} available`}
              </p>
              <p className="text-xs text-muted">
                {isDeepAudit
                  ? `1 deep audit will be used. ${deepAuditsRemaining - 1} left this month.`
                  : isReAudit
                    ? `1 re-audit will be used. ${reauditsRemaining - 1} left this month.`
                    : isSubscriptionInitial
                      ? `1 audit from your subscription. ${reauditsRemaining - 1} left this month.`
                      : '1 credit will be used. No payment needed.'}
              </p>
            </div>
            <span className="text-2xl font-sans font-normal" style={{ color: 'var(--ok)' }}>
              {isDeepAudit ? deepAuditsRemaining : isReAudit ? reauditsRemaining : isSubscriptionInitial ? reauditsRemaining : credits}
            </span>
          </div>
        </div>
      )}

      {!firstAuditFree && credits !== null && !hasCredits && (
        <div className="mb-6 p-4 rounded-xl bg-off border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">
                {isDeepAudit
                  ? 'Deep audit allowance exhausted'
                  : isReAudit
                    ? 'Re-audit allowance exhausted'
                    : 'No credits remaining'}
              </p>
              <p className="text-xs text-muted">
                {isDeepAudit
                  ? `${deepAuditsPerMonth - deepAuditsRemaining}/${deepAuditsPerMonth} deep audits used this month. Resets next billing cycle.`
                  : isReAudit
                    ? `${reauditsPerMonth - reauditsRemaining}/${reauditsPerMonth} re-audits used this month. Resets next billing cycle.`
                    : 'Subscribe or buy credits to run this audit.'}
              </p>
            </div>
            {!isDeepAudit && !isReAudit && (
              <Link
                href={`${dashPrefix}/buy-credits`}
                className="text-xs font-medium text-text hover:underline transition-colors whitespace-nowrap ml-3"
              >
                Buy credits &rarr;
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {generalError && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: 'color-mix(in srgb, var(--severe) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 20%, transparent)' }}>
          <p className="text-sm" style={{ color: 'var(--severe)' }}>{generalError}</p>
        </div>
      )}

      {/* CTA — TRUST RULE: Never show paid pricing while entitlements are loading.
           The button uses an explicit entitlementLoaded guard so users with
           subscriptions or credits never see a "$13" flash. */}
      <button
        onClick={handleSubmit}
        disabled={loading || !entitlementLoaded}
        className="w-full flex items-center justify-center gap-2.5 font-sans font-medium text-[15px] py-3 px-6 rounded-lg active:scale-[0.98] transition-all min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {hasCredits ? 'Starting audit...' : 'Creating checkout...'}
          </>
        ) : !entitlementLoaded ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Checking your plan...
          </>
        ) : firstAuditFree ? (
          <>
            Start free website audit
            <ArrowRight size={20} />
          </>
        ) : hasCredits ? (
          <>
            {isDeepAudit
              ? 'Use 1 deep audit — start analysis'
              : isReAudit
                ? 'Use 1 re-audit — start website audit'
                : isSubscriptionInitial
                  ? 'Start website audit — included in plan'
                  : 'Use 1 credit — start website audit'}
            <ArrowRight size={20} />
          </>
        ) : (
          <>
            Start website audit — $13
            <ArrowRight size={20} />
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted mt-4">
        {!entitlementLoaded
          ? ' ' /* Non-breaking space — invisible placeholder while loading */
          : firstAuditFree
          ? 'Your first audit is on us. No credits will be deducted.'
          : isDeepAudit && canDeepAudit
          ? `1 deep audit will be used. ${deepAuditsRemaining - 1} of ${deepAuditsPerMonth} remaining this month.`
          : isReAudit && canReaudit
          ? `1 re-audit will be used. ${reauditsRemaining - 1} of ${reauditsPerMonth} remaining this month.`
          : hasCredits && credits !== null && credits > 0
          ? `1 credit will be deducted. ${credits - 1} remaining after this audit.`
          : isSubscriptionInitial
          ? `Included in your subscription. ${reauditsRemaining - 1} audits left this month.`
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
