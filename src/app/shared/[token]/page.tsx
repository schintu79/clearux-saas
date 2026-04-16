'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Eye, Sparkles, Lock, Zap, Scale, Heart, Accessibility, Brain } from 'lucide-react';
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

function scoreBgClass(s: number) {
  if (s >= 70) return 'bg-emerald-500';
  if (s >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 60) return 'Decent';
  if (s >= 40) return 'Needs Work';
  return 'Poor';
}

const PILLAR_STYLE = [
  { color: 'violet', gradient: 'from-violet-500 to-violet-600', bg: 'bg-violet-500/10', text: 'text-violet-500', badgeBg: 'bg-violet-500', Icon: Scale },
  { color: 'pink', gradient: 'from-pink-500 to-pink-600', bg: 'bg-pink-500/10', text: 'text-pink-500', badgeBg: 'bg-pink-500', Icon: Heart },
  { color: 'amber', gradient: 'from-amber-500 to-amber-600', bg: 'bg-amber-500/10', text: 'text-amber-500', badgeBg: 'bg-amber-500', Icon: Accessibility },
  { color: 'emerald', gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500/10', text: 'text-emerald-500', badgeBg: 'bg-emerald-500', Icon: Brain },
];

const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness'];
const PILLAR_RANGES = [[0, 4], [4, 8], [8, 12], [12, 16]];

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
      } catch {
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
            <h1 className="font-heading font-semibold text-2xl text-text mb-2">Link unavailable</h1>
            <p className="text-muted text-sm mb-6">{error || 'This shared audit link is invalid or has been revoked.'}</p>
            <Link href="/" className="inline-flex items-center gap-2 text-white text-sm font-semibold px-6 py-3 rounded-full transition-all hover:brightness-110" style={{ background: 'var(--gradient-brand)' }}>
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
  const topRecs: string[] = rawJson?.topRecommendations || (rawJson?.keyRecommendation ? [rawJson.keyRecommendation] : []);

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  let domain = 'audit';
  try { domain = new URL(audit.product_url).hostname.replace(/^www\./, ''); } catch {}

  // Calculate pillar averages
  const pillarData = PILLAR_STYLE.map((style, i) => {
    const cats = categoryScores.slice(PILLAR_RANGES[i][0], PILLAR_RANGES[i][1]);
    const avg = cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 0;
    return { ...style, name: PILLAR_NAMES[i], avg, cats };
  });

  return (
    <>
      <Navbar />
      <main className="min-h-[60vh] bg-surface">
        <div className="max-w-4xl mx-auto py-8 sm:py-10 px-4">
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
              {/* ── Score Hero ─────────────────────────────── */}
              <div className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card overflow-hidden mb-6 shadow-lg shadow-black/[0.03]">
                <div className="h-1.5" style={{ background: 'var(--gradient-brand)' }} />
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    <div className="flex-shrink-0">
                      <ScoreRing score={overall} size={100} strokeWidth={6} />
                    </div>
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                      <h1 className="font-heading font-semibold text-xl sm:text-2xl text-text mb-1">
                        UX Audit: {domain}
                      </h1>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm">
                        <span className={`font-semibold ${scoreColor(overall)}`}>{scoreLabel(overall)}</span>
                        <span className="text-border">|</span>
                        <span className="text-muted">{report.total_issues} issues found</span>
                      </div>
                      {/* Severity pills */}
                      <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
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
              </div>

              {/* ── Top 3 Recommendations ─────────────────── */}
              {topRecs.length > 0 && (
                <div className="mb-6 p-5 rounded-2xl border border-violet-200/40 dark:border-violet-800/20" style={{ background: 'var(--gradient-brand-subtle)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gradient-brand)' }}>
                      <Zap size={14} className="text-white" />
                    </div>
                    <p className="text-sm font-bold text-text">Top Priority Recommendations</p>
                  </div>
                  <div className="space-y-3">
                    {topRecs.slice(0, 3).map((rec, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white mt-0.5" style={{ background: 'var(--gradient-brand)' }}>
                          {i + 1}
                        </span>
                        <p className="text-sm text-text/80 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 4 Pillar Cards ────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {pillarData.map((pillar, i) => {
                  const PillarIcon = pillar.Icon;
                  return (
                    <div key={i} className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card overflow-hidden">
                      {/* Pillar header */}
                      <div className={`px-5 py-4 bg-gradient-to-r from-${pillar.color}-50/50 to-transparent dark:from-${pillar.color}-950/20`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center`}>
                              <PillarIcon size={16} className="text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-text">{pillar.name}</p>
                              <p className="text-[11px] text-muted">{pillar.cats.length} categories</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold font-heading ${scoreColor(pillar.avg)}`}>{pillar.avg}</p>
                            <p className="text-[10px] text-muted">{scoreLabel(pillar.avg)}</p>
                          </div>
                        </div>
                      </div>
                      {/* Category scores */}
                      <div className="px-5 py-3 space-y-2">
                        {pillar.cats.map((cat, j) => (
                          <div key={j} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted truncate flex-1">{cat.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="w-16 h-1.5 rounded-full bg-border/15 dark:bg-white/[0.06] overflow-hidden">
                                <div className={`h-full rounded-full ${scoreBgClass(cat.score)}`} style={{ width: `${cat.score}%` }} />
                              </div>
                              <span className={`text-xs font-bold w-6 text-right ${scoreColor(cat.score)}`}>{cat.score}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Executive Summary ─────────────────────── */}
              {report.executive_summary && (
                <div className="rounded-2xl border border-border/30 dark:border-white/[0.06] bg-card p-5 sm:p-6 mb-6">
                  <h2 className="font-heading font-semibold text-lg text-text mb-3">Executive Summary</h2>
                  <div className="text-muted text-sm leading-relaxed whitespace-pre-line">
                    {report.executive_summary}
                  </div>
                </div>
              )}

              {/* ── CTA ──────────────────────────────────── */}
              <div className="text-center mt-10 mb-6 px-4">
                <p className="text-muted text-sm mb-2">Want a detailed audit like this for your website?</p>
                <p className="text-muted text-xs mb-5">64 checkpoints. 16 categories. Results in minutes. First audit free.</p>
                <Link href="/register" className="inline-flex items-center gap-2 text-white text-sm font-semibold px-8 py-3.5 rounded-full transition-all hover:brightness-110 hover:-translate-y-0.5" style={{ background: 'var(--gradient-brand)', boxShadow: '0 8px 24px rgba(124,58,237,.2)' }}>
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
