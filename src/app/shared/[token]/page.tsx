'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Globe, CheckCircle2, AlertTriangle, Eye, Target, Map, Type, MousePointerClick, Shield, Heart, Brain, Sparkles, Smartphone, Gauge, Search, Zap, Accessibility, Lock } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import ScoreRing from '@/components/ui/ScoreRing';
import type { Report, AuditFinding } from '@/types/database';

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 60) return 'Decent';
  if (s >= 40) return 'Needs Work';
  return 'Poor';
}

export default function SharedAuditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<any>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const supabase = createBrowserSupabase();

        // Fetch audit by share token
        const { data: auditData, error: auditErr } = await supabase
          .from('audits')
          .select('*')
          .eq('share_token', token)
          .eq('share_enabled', true)
          .single();

        if (auditErr || !auditData) {
          setError('This shared audit link is invalid or has been revoked.');
          setLoading(false);
          return;
        }

        setAudit(auditData);

        if (auditData.status === 'completed') {
          const [reportRes, findingsRes] = await Promise.all([
            supabase.from('reports').select('*').eq('audit_id', auditData.id).single(),
            supabase.from('audit_findings').select('*').eq('audit_id', auditData.id).order('sort_order'),
          ]);
          if (reportRes.data) setReport(reportRes.data as any);
          if (findingsRes.data) setFindings(findingsRes.data as any[]);
        }
      } catch (err) {
        setError('Failed to load shared audit.');
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, [token]);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] flex items-center justify-center bg-surface">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </>
    );
  }

  if (error || !audit) {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] flex items-center justify-center bg-surface px-4">
          <div className="text-center max-w-md">
            <Lock size={40} className="text-muted mx-auto mb-4" />
            <h1 className="font-manrope font-bold text-2xl text-text mb-2">Link unavailable</h1>
            <p className="text-muted text-sm mb-6">{error || 'This shared audit link is invalid or has been revoked.'}</p>
            <Link href="/" className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:brightness-110" style={{ background: 'var(--gradient-brand)' }}>
              Go to ClearUX
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const overall = report?.overall_score ?? 0;
  const rawJson = report?.raw_json as any;
  const categoryScores: Array<{ name: string; score: number; summary: string }> = rawJson?.categoryScores || [];

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  let domain = 'audit';
  try { domain = new URL(audit.product_url).hostname.replace(/^www\./, ''); } catch {}

  return (
    <>
      <Navbar />
      <main className="min-h-[60vh] bg-surface">
        <div className="max-w-4xl mx-auto py-10 px-4">
          {/* Shared badge */}
          <div className="flex items-center gap-2 mb-6 text-xs text-muted">
            <Eye size={14} />
            <span>Shared audit report</span>
            <span className="text-border">|</span>
            <span className="font-medium text-text">{domain}</span>
          </div>

          {audit.status !== 'completed' ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted">This audit is still in progress. Check back soon.</p>
            </div>
          ) : report ? (
            <>
              {/* Score hero */}
              <div className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card overflow-hidden mb-6 shadow-lg shadow-black/[0.03]">
                <div className="h-1.5" style={{ background: 'var(--gradient-brand)' }} />
                <div className="p-6 flex flex-col sm:flex-row items-center gap-5">
                  <ScoreRing score={overall} size={100} strokeWidth={6} />
                  <div className="flex-1 text-center sm:text-left">
                    <h1 className="font-manrope font-bold text-2xl text-text mb-1">
                      UX Audit: {domain}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm">
                      <span className={`font-semibold ${scoreColor(overall)}`}>{scoreLabel(overall)}</span>
                      <span className="text-border">|</span>
                      <span className="text-muted">{report.total_issues} issues found</span>
                    </div>
                    {/* Severity pills */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {severityCounts.critical > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{severityCounts.critical} critical
                        </span>
                      )}
                      {severityCounts.high > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{severityCounts.high} high
                        </span>
                      )}
                      {severityCounts.medium > 0 && (
                        <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">{severityCounts.medium} medium</span>
                      )}
                      {severityCounts.low > 0 && (
                        <span className="text-[11px] text-muted bg-off px-2 py-0.5 rounded-full">{severityCounts.low} low</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              {report.executive_summary && (
                <div className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card p-6 mb-6">
                  <h2 className="font-manrope font-bold text-lg text-text mb-3">Executive Summary</h2>
                  <div className="text-muted text-sm leading-relaxed whitespace-pre-line">
                    {report.executive_summary}
                  </div>
                </div>
              )}

              {/* Category Scores */}
              {categoryScores.length > 0 && (
                <div className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card p-6 mb-6">
                  <h2 className="font-manrope font-bold text-lg text-text mb-4">Category Scores</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categoryScores.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-off/50 dark:bg-white/[0.03]">
                        <span className="text-xs font-medium text-text truncate flex-1">{cat.name}</span>
                        <span className={`text-sm font-bold ${scoreColor(cat.score)}`}>{cat.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="text-center mt-10 mb-6">
                <p className="text-muted text-sm mb-4">Want a detailed audit like this for your website?</p>
                <Link href="/register" className="inline-flex items-center gap-2 text-white text-sm font-semibold px-8 py-3.5 rounded-xl transition-all hover:brightness-110" style={{ background: 'var(--gradient-brand)' }}>
                  <Sparkles size={16} />
                  Get Your Free Audit
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
