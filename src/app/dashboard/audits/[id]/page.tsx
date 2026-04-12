'use client';

import React, { Suspense, useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Zap,
  Trash2,
  Globe,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSearch,
  Loader2,
  Eye,
  Target,
  Map,
  MousePointerClick,
  Smartphone,
  Shield,
  Type,
  Gauge,
  Brain,
  ExternalLink,
  Heart,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import ScoreRing from '@/components/ui/ScoreRing';
import type {
  AuditWithReport,
  AuditFinding,
  FindingSeverity,
  Report,
} from '@/types/database';
import clsx from 'clsx';

/* ── Helpers ─────────────────────────────────────────────── */

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function formatUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const severityConfig = {
  critical: {
    badge: 'danger' as const,
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  },
  high: {
    badge: 'failed' as const,
    bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  },
  medium: {
    badge: 'pending' as const,
    bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  },
  low: {
    badge: 'active' as const,
    bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  },
};

/* ── Category display config ─────────────────────────────── */
// Index-based icons matching the 19 UX categories (works with translated names)
const CATEGORY_ICONS_BY_INDEX: React.ElementType[] = [
  Eye,               // 0: First Impression & Visual Design
  Target,            // 1: Value Proposition & Messaging
  Map,               // 2: Navigation & Information Architecture
  Eye,               // 3: Visual Hierarchy & Layout
  Type,              // 4: Content Quality & Readability
  MousePointerClick, // 5: Calls-to-Action & Conversion
  Shield,            // 6: Trust & Credibility
  AlertTriangle,     // 7: Ethical UX & Dark Pattern Detection
  Heart,             // 8: Emotional Intelligence & Psychological Safety
  Brain,             // 9: Cognitive Accessibility & Neurodiversity
  Sparkles,          // 10: Digital Wellbeing & Responsible Design
  Users,             // 11: Age Inclusivity & Digital Literacy
  Gauge,             // 12: Performance & Page Speed
  Smartphone,        // 13: Mobile Experience
  FileSearch,        // 14: Accessibility & Inclusive Design
  FileSearch,        // 15: Technical SEO & Accessibility
  Brain,             // 16: AI Discoverability & LLM Readiness
  Zap,               // 17: AI Agent Readiness
  Globe,             // 18: Cultural Sensitivity & Global Readiness
];

// Keyword fallback for icon matching (handles edge cases)
const CATEGORY_ICON_KEYWORDS: Record<string, React.ElementType> = {
  'impression': Eye, 'visual design': Eye, 'diseño visual': Eye, 'design visuel': Eye, 'design visivo': Eye,
  'value': Target, 'valor': Target, 'valeur': Target, 'wert': Target, 'valore': Target,
  'navigation': Map, 'navegación': Map, 'navigazione': Map,
  'action': MousePointerClick, 'acción': MousePointerClick, 'azione': MousePointerClick, 'conversion': MousePointerClick,
  'performance': Gauge, 'rendimiento': Gauge, 'leistung': Gauge, 'prestazioni': Gauge, 'desempenho': Gauge,
  'mobile': Smartphone, 'móvil': Smartphone,
  'trust': Shield, 'confianza': Shield, 'confiance': Shield, 'vertrauen': Shield, 'fiducia': Shield, 'confiança': Shield,
  'content': Type, 'contenido': Type, 'contenu': Type, 'inhalt': Type, 'contenuti': Type, 'conteúdo': Type,
  'seo': FileSearch,
  'ai': Brain, 'ia': Brain, 'llm': Brain, 'ki': Brain,
  'hierarchy': Eye, 'jerarquía': Eye, 'hiérarchie': Eye, 'hierarchie': Eye, 'gerarchia': Eye, 'hierarquia': Eye,
  'accessibility': FileSearch, 'accesibilidad': FileSearch, 'accessibilité': FileSearch, 'barrierefreiheit': FileSearch, 'accessibilità': FileSearch, 'acessibilidade': FileSearch,
  'ethical': AlertTriangle, 'ético': AlertTriangle, 'éthique': AlertTriangle, 'ethisch': AlertTriangle, 'etico': AlertTriangle,
  'dark pattern': AlertTriangle, 'patrón oscuro': AlertTriangle, 'dark patterns': AlertTriangle,
  'emotional': Heart, 'emocional': Heart, 'émotionnelle': Heart, 'emotionale': Heart, 'emotiva': Heart,
  'wellbeing': Sparkles, 'bienestar': Sparkles, 'bien-être': Sparkles, 'wohlbefinden': Sparkles, 'benessere': Sparkles, 'bem-estar': Sparkles,
  'age': Users, 'edad': Users, 'âge': Users, 'alter': Users, 'età': Users, 'etária': Users,
  'agent': Zap,
  'cultural': Globe, 'sensibilidad cultural': Globe, 'sensibilité culturelle': Globe, 'kulturelle': Globe, 'sensibilità culturale': Globe,
};

function getCategoryIcon(name: string, index?: number): React.ElementType {
  // Prefer index-based mapping (reliable across languages)
  if (index !== undefined && index >= 0 && index < CATEGORY_ICONS_BY_INDEX.length) {
    return CATEGORY_ICONS_BY_INDEX[index];
  }
  // Keyword fallback
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICON_KEYWORDS)) {
    if (lower.includes(key)) return icon;
  }
  return Sparkles;
}

function scoreColor(s: number) {
  if (s >= 70) return 'text-green-600 dark:text-green-400';
  if (s >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(s: number) {
  if (s >= 70) return 'bg-green-500';
  if (s >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 60) return 'Decent';
  if (s >= 40) return 'Needs Work';
  return 'Poor';
}

const statusMeta: Record<
  string,
  { label: string; color: string; icon: React.ElementType; description: string }
> = {
  pending_payment: {
    label: 'Awaiting Payment',
    color: 'pending',
    icon: Clock,
    description: 'Complete payment to start the audit.',
  },
  payment_received: {
    label: 'Payment Confirmed',
    color: 'active',
    icon: CheckCircle2,
    description: 'Payment received. Your audit is being queued.',
  },
  crawling: {
    label: 'Crawling Website',
    color: 'active',
    icon: Globe,
    description: 'Our AI is crawling your website and collecting data...',
  },
  analysing: {
    label: 'Analysing UX',
    color: 'active',
    icon: Sparkles,
    description: 'Running 95-point UX analysis across 19 categories...',
  },
  generating_report: {
    label: 'Generating Report',
    color: 'active',
    icon: FileSearch,
    description: 'Compiling your professional UX report...',
  },
  completed: {
    label: 'Completed',
    color: 'completed',
    icon: CheckCircle2,
    description: 'Your audit is ready.',
  },
  failed: {
    label: 'Failed',
    color: 'failed',
    icon: AlertTriangle,
    description: 'Something went wrong. You can retry the audit.',
  },
};

/* ── Progress steps ──────────────────────────────────────── */
const progressSteps = [
  { key: 'payment_received', label: 'Payment' },
  { key: 'crawling', label: 'Crawling' },
  { key: 'analysing', label: 'Analysing' },
  { key: 'generating_report', label: 'Report' },
  { key: 'completed', label: 'Done' },
];

/* ── 56 checkpoint labels for rotating display ────────────── */
const auditCheckpoints = [
  'Checking navigation clarity & structure',
  'Evaluating page load performance',
  'Analysing mobile responsiveness',
  'Reviewing call-to-action effectiveness',
  'Assessing visual hierarchy',
  'Testing colour contrast & accessibility',
  'Checking form usability & validation',
  'Evaluating content readability',
  'Analysing search functionality',
  'Reviewing error handling & messaging',
  'Checking image optimisation',
  'Evaluating link consistency',
  'Analysing typography & spacing',
  'Reviewing onboarding experience',
  'Checking cart & checkout flow',
  'Evaluating trust signals & social proof',
  'Analysing breadcrumb navigation',
  'Reviewing footer content & links',
  'Checking ARIA labels & screen readers',
  'Evaluating keyboard navigation',
  'Analysing page title & meta structure',
  'Reviewing heading hierarchy (H1–H6)',
  'Checking button sizing & tap targets',
  'Evaluating scroll behaviour & anchors',
  'Analysing 404 & empty state handling',
  'Reviewing input field labelling',
  'Checking consistent branding',
  'Evaluating whitespace & layout balance',
  'Analysing cross-browser compatibility',
  'Reviewing cookie consent & privacy',
  'Checking AI discoverability (LLM readiness)',
  'Evaluating structured data & schema markup',
  'Analysing content freshness signals',
  'Reviewing FAQ & knowledge base structure',
  'Checking conversational search readiness',
  'Evaluating semantic HTML structure',
  'Analysing internal linking strategy',
  'Reviewing multimedia alt text & captions',
  'Checking progressive disclosure patterns',
  'Evaluating overall user satisfaction signals',
  'Analysing visual flow & eye-tracking patterns',
  'Reviewing element spacing & grouping',
  'Checking font size hierarchy & weight balance',
  'Evaluating CTA visual weight & prominence',
  'Analysing colour contrast ratios (WCAG AA)',
  'Reviewing keyboard-only navigation paths',
  'Checking form label associations',
  'Evaluating ARIA landmarks & roles',
];

function getStepIndex(status: string) {
  return progressSteps.findIndex((s) => s.key === status);
}

/* ── Rotating checkpoint text ─────────────────────────────── */
function RotatingCheckpoints() {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % auditCheckpoints.length);
        setFade(true);
      }, 300);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-5 text-center">
      <p
        className={`text-sm font-medium text-accent transition-opacity duration-300 ${
          fade ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {auditCheckpoints[idx]}...
      </p>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────── */

const AuditDetailInner = ({ params }: { params: Promise<{ id: string }> }) => {
  const { id: auditId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: userLoading } = useAuth();

  const [audit, setAudit] = useState<AuditWithReport | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [auditPages, setAuditPages] = useState<Array<{ url: string; title: string | null; status_code: number | null; load_time_ms: number | null; screenshot_url: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const isPaymentReturn = searchParams.get('payment') === 'success';

  // ── Fetch audit data ──────────────────────────────────
  const fetchAuditDetail = useCallback(
    async (silent = false) => {
      if (!user) return null;

      try {
        const supabase = createBrowserSupabase();

        const { data: auditData, error: auditError } = await supabase
          .from('audits')
          .select('*')
          .eq('id', auditId)
          .single();

        if (auditError) throw auditError;
        if (!auditData) throw new Error('Audit not found');

        // Fetch report if completed
        let reportData = null;
        if (auditData.status === 'completed') {
          const { data: r } = await supabase
            .from('reports')
            .select('*')
            .eq('audit_id', auditId)
            .maybeSingle();
          reportData = r;
        }

        const combined = {
          ...auditData,
          report: reportData || null,
          payment: null,
        } as AuditWithReport;

        setAudit(combined);

        // Fetch findings + pages if completed
        if (auditData.status === 'completed') {
          const [findingsRes, pagesRes] = await Promise.all([
            supabase
              .from('audit_findings')
              .select('*')
              .eq('audit_id', auditId)
              .order('severity', { ascending: true })
              .order('sort_order', { ascending: true }),
            supabase
              .from('audit_pages')
              .select('url, title, status_code, load_time_ms, screenshot_url')
              .eq('audit_id', auditId)
              .order('crawled_at', { ascending: true }),
          ]);
          setFindings(findingsRes.data || []);
          setAuditPages(pagesRes.data || []);
        }

        if (!silent) setLoading(false);
        return auditData.status;
      } catch (err) {
        console.error('[AuditDetail] Error:', err);
        if (!silent) {
          setError('Failed to load audit details');
          setLoading(false);
        }
        return null;
      }
    },
    [user, auditId],
  );

  // ── Initial fetch ─────────────────────────────────────
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchAuditDetail();
  }, [user, userLoading, fetchAuditDetail]);

  // ── Payment verification + polling ────────────────────
  // When returning from Stripe, verify payment and poll for status changes
  useEffect(() => {
    if (!user || !isPaymentReturn) return;

    let active = true;

    const verifyAndPoll = async () => {
      // Give webhook a moment, then verify directly
      await new Promise((r) => setTimeout(r, 2000));
      if (!active) return;

      // Check current status
      const status = await fetchAuditDetail(true);

      // If still pending_payment, verify with Stripe directly
      if (status === 'pending_payment') {
        setVerifying(true);
        try {
          const res = await fetch('/api/stripe/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audit_id: auditId }),
          });
          const data = await res.json();
          console.log('[AuditDetail] Verify result:', data);

          if (active) {
            await fetchAuditDetail();
          }
        } catch (err) {
          console.error('[AuditDetail] Verify error:', err);
        } finally {
          if (active) setVerifying(false);
        }
      }

      // Poll for status updates while in-progress
      if (active) {
        pollRef.current = setInterval(async () => {
          if (!active) return;
          const s = await fetchAuditDetail(true);
          if (s === 'completed' || s === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }, 5000);
      }
    };

    verifyAndPoll();

    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, isPaymentReturn, fetchAuditDetail]);

  // ── Also poll for in-progress audits (non-payment-return) ──
  useEffect(() => {
    if (isPaymentReturn) return; // handled above
    if (!audit) return;

    const inProgress = ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(
      audit.status,
    );
    if (!inProgress) return;

    pollRef.current = setInterval(async () => {
      const s = await fetchAuditDetail(true);
      if (s === 'completed' || s === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [audit?.status, isPaymentReturn, fetchAuditDetail]);

  // ── Handlers ──────────────────────────────────────────
  const isPaidAudit = audit?.status === 'failed' || audit?.status === 'completed' ||
    ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(audit?.status || '');

  const handleDelete = async () => {
    if (!audit || !auditId) return;
    const msg = isPaidAudit
      ? 'Delete this audit? Your payment will be kept as a credit for a future audit.'
      : 'Delete this audit? This cannot be undone.';
    if (!confirm(msg)) return;

    setDeleting(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.from('audits').delete().eq('id', auditId);
      if (error) throw error;
      router.push('/dashboard');
    } catch (err) {
      console.error('Error deleting audit:', err);
      alert('Failed to delete audit');
      setDeleting(false);
    }
  };

  const handleRetry = async () => {
    if (!audit || !auditId) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retry failed');
      // Refresh audit data — it should now be in payment_received/crawling state
      await fetchAuditDetail();
      // Start polling for progress
      pollRef.current = setInterval(async () => {
        const s = await fetchAuditDetail(true);
        if (s === 'completed' || s === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    } catch (err) {
      console.error('Error retrying audit:', err);
      alert(err instanceof Error ? err.message : 'Failed to retry audit');
    } finally {
      setRetrying(false);
    }
  };

  const handleRestart = async () => {
    if (!audit || !auditId) return;
    if (!confirm('Restart this audit from scratch? This will re-crawl and re-analyse the website.')) return;
    setRestarting(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/restart`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restart failed');
      await fetchAuditDetail();
      // Start polling
      pollRef.current = setInterval(async () => {
        const s = await fetchAuditDetail(true);
        if (s === 'completed' || s === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restart audit');
    } finally {
      setRestarting(false);
    }
  };

  const handlePayNow = async () => {
    if (!audit) return;
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: audit.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch {
      alert('Failed to start checkout');
    }
  };

  /* ── Loading states ────────────────────────────────────── */
  if (userLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="h-5 w-20 bg-off rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-off rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-off rounded animate-pulse mb-8" />
        <div className="h-32 bg-off rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-red-800 dark:text-red-300 text-sm">{error || 'Audit not found'}</p>
        </div>
      </div>
    );
  }

  /* ── Derived state ─────────────────────────────────────── */
  const report = audit.report as Report | null;
  const meta = statusMeta[audit.status] || statusMeta.pending_payment;
  const StatusIcon = meta.icon;
  const isCompleted = audit.status === 'completed';
  const isInProgress = ['crawling', 'analysing', 'generating_report', 'payment_received'].includes(
    audit.status,
  );
  const canDelete = audit.status === 'pending_payment';
  const currentStepIdx = getStepIndex(audit.status);

  const findingsByGroup = findings.reduce(
    (acc, f) => {
      if (!acc[f.severity]) acc[f.severity] = [];
      acc[f.severity].push(f);
      return acc;
    },
    {} as Record<FindingSeverity, AuditFinding[]>,
  );

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Dashboard
      </Link>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-manrope text-text mb-1">
            {formatUrl(audit.product_url)}
          </h1>
          <p className="text-muted text-sm">
            {formatDate(audit.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={deleting}
              disabled={deleting}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* ── Payment return: verifying ──────────────────────── */}
      {isPaymentReturn && verifying && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Loader2 size={20} className="text-blue animate-spin" />
            <div>
              <p className="font-semibold text-text">Confirming your payment...</p>
              <p className="text-sm text-muted">This only takes a moment.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Pending payment ────────────────────────────────── */}
      {audit.status === 'pending_payment' && !verifying && (
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
                <Clock size={20} className="text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="font-semibold text-text">Payment required</p>
                <p className="text-sm text-muted">Complete payment to start the audit.</p>
              </div>
            </div>
            <Button variant="primary" size="md" onClick={handlePayNow}>
              Pay Now
            </Button>
          </div>
        </Card>
      )}

      {/* ── In progress: progress bar ──────────────────────── */}
      {isInProgress && !verifying && (
        <Card className="mb-6">
          <div className="flex items-center gap-3 mb-5">
            <StatusIcon size={20} className="text-blue" />
            <div>
              <p className="font-semibold text-text">{meta.label}</p>
              <p className="text-sm text-muted">{meta.description}</p>
            </div>
            <Loader2 size={16} className="text-blue animate-spin ml-auto" />
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-1">
            {progressSteps.map((step, idx) => {
              const isActive = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;

              return (
                <React.Fragment key={step.key}>
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={clsx(
                        'w-full h-2 rounded-full transition-colors',
                        isActive ? 'bg-blue' : 'bg-off',
                        isCurrent && 'animate-pulse',
                      )}
                    />
                    <p
                      className={clsx(
                        'text-[10px] font-medium mt-1.5',
                        isActive ? 'text-blue' : 'text-muted',
                      )}
                    >
                      {step.label}
                    </p>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <RotatingCheckpoints />
          <p className="text-sm text-muted mt-2 text-center font-medium">
            This page updates automatically. No need to refresh.
          </p>

          {/* Show restart button if stuck for > 3 minutes */}
          {audit.updated_at && (Date.now() - new Date(audit.updated_at).getTime() > 3 * 60 * 1000) && (
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-[10px] text-muted">
                Taking longer than expected?
              </p>
              <button
                onClick={handleRestart}
                disabled={restarting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dk transition-colors disabled:opacity-60"
              >
                {restarting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Restarting...
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    Restart Audit
                  </>
                )}
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── Failed state ───────────────────────────────────── */}
      {audit.status === 'failed' && (
        <div className="mb-6 p-5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-900 dark:text-red-200">Audit failed</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                {audit.crawl_error || 'Something went wrong during processing.'}
              </p>
              <div className="flex items-center gap-2.5 mt-3">
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-dk transition-colors disabled:opacity-60"
                >
                  {retrying ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <Zap size={13} />
                      Retry Audit
                    </>
                  )}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-red-600 dark:hover:text-red-400 px-3 py-2 rounded-lg border border-border hover:border-red-300 dark:hover:border-red-700 transition-colors disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  {deleting ? 'Deleting...' : 'Delete (keep credit)'}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-2">
                Your payment is safe. Retry runs the audit again at no extra cost. Deleting keeps your credit for a new audit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Completed: Results ─────────────────────────────── */}
      {isCompleted && report && (
        <>
          {/* Overall score hero */}
          <Card className="mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                <div className="relative flex-shrink-0">
                  <ScoreRing score={report.overall_score ?? 0} size={100} strokeWidth={6} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted mb-0.5">Overall Score</p>
                  <p className="text-lg font-bold text-text">{scoreLabel(report.overall_score ?? 0)}</p>
                  {report.executive_summary && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{report.executive_summary}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-shrink-0">
                <a href={`/api/reports/${auditId}/pdf`} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
                  <button className="w-full flex items-center justify-center gap-2 bg-accent text-white text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-accent-dk transition-colors">
                    <Download size={14} />
                    PDF
                  </button>
                </a>
                <a href={`/api/reports/${auditId}/docx`} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
                  <button className="w-full flex items-center justify-center gap-2 bg-navy text-white dark:bg-card dark:border dark:border-border text-xs font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                    <Download size={14} />
                    Word
                  </button>
                </a>
              </div>
            </div>
          </Card>

          {/* ── 10 Category Scores ─────────────────────────────── */}
          {(() => {
            const rawJson = report.raw_json as any;
            const categoryScores: Array<{ name: string; score: number; summary: string }> =
              rawJson?.categoryScores && Array.isArray(rawJson.categoryScores)
                ? rawJson.categoryScores
                : [];

            const pillars = [
              { name: 'Foundation', range: [0, 6] },
              { name: 'Human Experience', range: [6, 12] },
              { name: 'Technical Excellence', range: [12, 16] },
              { name: 'Future Readiness', range: [16, 19] },
            ];

            return categoryScores.length > 0 ? (
              <div className="mb-6">
                <h2 className="text-base font-semibold text-text mb-4">Audit Categories</h2>
                <div className="space-y-5">
                  {pillars.map((pillar) => {
                    const pillarCategories = categoryScores.filter((_, idx) => idx >= pillar.range[0] && idx < pillar.range[1]);
                    if (pillarCategories.length === 0) return null;
                    return (
                      <div key={pillar.name}>
                        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2.5">{pillar.name}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {pillarCategories.map((cat, relIdx) => {
                            const idx = categoryScores.indexOf(cat);
                            const Icon = getCategoryIcon(cat.name, idx);
                            return (
                              <div
                                key={idx}
                                className="bg-card border border-border rounded-lg p-3.5 hover:border-accent/30 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-8 h-8 rounded-md bg-accent-lt flex items-center justify-center flex-shrink-0">
                                    <Icon size={15} className="text-accent" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-sm font-semibold text-text truncate pr-2">{cat.name}</p>
                                      <span className={`text-sm font-bold flex-shrink-0 ${scoreColor(cat.score)}`}>
                                        {cat.score}
                                      </span>
                                    </div>
                                    <div className="w-full bg-off rounded-full h-1.5 mb-1.5">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${scoreBg(cat.score)}`}
                                        style={{ width: `${cat.score}%` }}
                                      />
                                    </div>
                                    {cat.summary && (
                                      <p className="text-[11px] text-muted leading-snug line-clamp-2">{cat.summary}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Fallback: show 6 score rings if no category scores */
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                {[
                  { score: report.ux_score, label: 'UX' },
                  { score: report.conversion_score, label: 'Conversion' },
                  { score: report.mobile_score, label: 'Mobile' },
                  { score: report.ai_discoverability_score, label: 'AI' },
                  { score: report.content_score, label: 'Content' },
                ].map(
                  (item, idx) =>
                    item.score != null && (
                      <Card key={idx} className="flex flex-col items-center py-4 px-2">
                        <ScoreRing score={item.score} size={72} strokeWidth={5} />
                        <p className="text-[10px] text-muted font-medium mt-2">{item.label}</p>
                      </Card>
                    ),
                )}
              </div>
            );
          })()}

          {/* Executive Summary */}
          {report.executive_summary && (
            <Card className="mb-6">
              <h2 className="text-base font-semibold text-text mb-2">Executive Summary</h2>
              <p className="text-muted text-sm leading-relaxed whitespace-pre-line">
                {report.executive_summary}
              </p>
              {(report.raw_json as any)?.keyRecommendation && (
                <div className="mt-3 p-3 bg-accent-lt/50 rounded-lg border border-accent/20">
                  <div className="flex gap-2">
                    <Zap size={13} className="text-accent flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold text-text mb-0.5">Top Recommendation</p>
                      <p className="text-sm text-muted">{(report.raw_json as any).keyRecommendation}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Issue summary bar */}
          {report.total_issues > 0 && (
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="text-sm font-semibold text-text">
                {report.total_issues} issues found
              </span>
              {report.critical_count > 0 && (
                <span className="text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                  {report.critical_count} critical
                </span>
              )}
              {report.high_count > 0 && (
                <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                  {report.high_count} high
                </span>
              )}
              {report.medium_count > 0 && (
                <span className="text-[11px] text-muted bg-off px-1.5 py-0.5 rounded">{report.medium_count} medium</span>
              )}
              {report.low_count > 0 && (
                <span className="text-[11px] text-muted bg-off px-1.5 py-0.5 rounded">{report.low_count} low</span>
              )}
            </div>
          )}

          {/* Findings */}
          {Object.keys(findingsByGroup).length > 0 && (
            <div className="space-y-4">
              {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                const items = findingsByGroup[severity] || [];
                if (items.length === 0) return null;
                const config = severityConfig[severity];

                return (
                  <div key={severity}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={config.badge}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </Badge>
                      <span className="text-[11px] text-muted">
                        {items.length} issue{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {items.map((finding) => (
                        <Card key={finding.id} className={`border ${config.bg}`}>
                          <h3 className="font-semibold text-text text-sm">
                            {finding.title}
                          </h3>
                          {finding.page_url && (
                            <a
                              href={finding.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] text-muted hover:text-accent transition-colors mt-1"
                            >
                              <ExternalLink size={10} className="flex-shrink-0" />
                              {(() => {
                                try {
                                  return new URL(finding.page_url).pathname || '/';
                                } catch {
                                  return finding.page_url;
                                }
                              })()}
                            </a>
                          )}
                          <p className="text-muted text-xs mt-1 leading-relaxed">
                            {finding.description}
                          </p>

                          {finding.recommendation && (
                            <div className="mt-2.5 p-2.5 bg-surface-alt/50 rounded-md border border-border">
                              <div className="flex gap-2">
                                <Zap size={12} className="text-accent flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-[11px] font-semibold text-text mb-0.5">
                                    Recommendation
                                  </p>
                                  <p className="text-xs text-muted leading-relaxed">
                                    {finding.recommendation}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {finding.screenshot_url && (
                            <div className="mt-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={finding.screenshot_url}
                                alt={finding.title}
                                className="rounded-lg border border-border/30 max-w-full max-h-48 object-contain"
                                loading="lazy"
                              />
                            </div>
                          )}

                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Pages Analysed ─────────────────────────────── */}
          {auditPages.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-text mb-1">Pages Analysed</h2>
              <p className="text-[10px] text-muted mb-3">
                {auditPages.length} page{auditPages.length !== 1 ? 's' : ''} crawled during this audit
              </p>
              {/* Page overview screenshot */}
              {auditPages[0]?.screenshot_url && (
                <div className="mb-4 rounded-lg overflow-hidden border border-border/40 dark:border-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={auditPages[0].screenshot_url}
                    alt="Website overview"
                    className="w-full h-auto max-h-80 object-cover object-top"
                    loading="lazy"
                  />
                  <div className="px-3 py-1.5 bg-surface-alt/50 border-t border-border/30 dark:border-white/[0.03]">
                    <p className="text-[10px] text-muted">Homepage captured at audit time</p>
                  </div>
                </div>
              )}

              <div className="bg-card border border-border rounded-lg overflow-hidden divide-y divide-border">
                {auditPages.map((pg, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-off/50 transition-colors">
                    <span className="text-[10px] text-muted w-5 text-right flex-shrink-0">{idx + 1}</span>
                    <Globe size={12} className="text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {pg.title && (
                        <p className="text-xs font-medium text-text truncate">{pg.title}</p>
                      )}
                      <a
                        href={pg.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-accent hover:underline truncate block"
                      >
                        {pg.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {pg.load_time_ms != null && (
                        <span className="text-[10px] text-muted">{pg.load_time_ms}ms</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom download CTA */}
          <div className="mt-8 mb-4 flex items-center justify-center gap-3">
            <a
              href={`/api/reports/${auditId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-accent text-white text-xs font-semibold px-6 py-3 rounded-lg hover:bg-accent-dk transition-colors"
            >
              <Download size={14} />
              Download PDF Report
            </a>
            <a
              href={`/api/reports/${auditId}/docx`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-navy text-white dark:bg-card dark:border dark:border-border text-xs font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Download size={14} />
              Download Word Report
            </a>
          </div>
        </>
      )}
    </div>
  );
};

// Wrap in Suspense — required by Next.js for useSearchParams()
const AuditDetailPage = (props: { params: Promise<{ id: string }> }) => (
  <Suspense
    fallback={
      <div className="max-w-3xl mx-auto py-8">
        <div className="h-5 w-20 bg-off rounded animate-pulse mb-6" />
        <div className="h-8 w-72 bg-off rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-48 bg-off rounded animate-pulse mb-8" />
        <div className="h-32 bg-off rounded-xl animate-pulse" />
      </div>
    }
  >
    <AuditDetailInner {...props} />
  </Suspense>
);

export default AuditDetailPage;
