'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  Eye, Sparkles, Lock, Zap, Scale, Heart, Accessibility, Brain, Search,
  AlertTriangle, CheckCircle2, Target, Map, Type, MousePointerClick,
  Shield, Smartphone, Gauge, Globe, FileSearch, LinkIcon, Share2,
  MessageSquare, Lightbulb, ChevronDown, FileCode, Info, Download,
  Keyboard, Code2, FileText, ShieldCheck,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import ScoreRing from '@/components/ui/ScoreRing';
import type { Report, AuditFinding, FindingSeverity } from '@/types/database';
import { CHECKPOINT_LABELS } from '@/lib/audit-checkpoints';
import clsx from 'clsx';

/* ── Score helpers ─────────────────────────────────────── */

function scoreColor(s: number) {
  if (s >= 70) return 'text-[var(--ok)]';
  if (s >= 40) return 'text-[var(--warn)]';
  return 'text-[var(--severe)]';
}

function scoreBgVar(s: number) {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent';
  if (s >= 75) return 'Good';
  if (s >= 60) return 'Decent';
  if (s >= 40) return 'Needs work';
  return 'Poor';
}

/* ── Module configuration (mirrors audit detail page) ──── */

const CATEGORY_ICONS: React.ElementType[] = [
  Eye, Target, Map, Type,
  MousePointerClick, Shield, AlertTriangle, Heart,
  Accessibility, Brain, Sparkles, Smartphone,
  Gauge, Search, Zap, Globe,
  FileSearch, LinkIcon, Share2, Scale,
  Eye, Keyboard, FileText, Code2,
  Eye, MessageSquare, Target, CheckCircle2,
];

const MODULE_TINTS = [
  { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.04)', border: 'rgba(59, 130, 246, 0.12)' },
  { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.04)', border: 'rgba(236, 72, 153, 0.12)' },
  { dot: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.04)', border: 'rgba(139, 92, 246, 0.12)' },
  { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.04)', border: 'rgba(245, 158, 11, 0.12)' },
  { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.04)', border: 'rgba(16, 185, 129, 0.12)' },
  { dot: '#14B8A6', bg: 'rgba(20, 184, 166, 0.04)', border: 'rgba(20, 184, 166, 0.12)' },
  { dot: '#06B6D4', bg: 'rgba(6, 182, 212, 0.04)', border: 'rgba(6, 182, 212, 0.12)' },
];

const PILLAR_NAMES = ['Foundation', 'Human Experience', 'Inclusive Design', 'Future Readiness', 'SEO Structure & Rules', 'Accessibility Readiness', 'Brand Consistency'];
const PILLAR_RANGES: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24], [24, 28]];
const PILLAR_ICONS: React.ElementType[] = [Scale, Heart, Accessibility, Brain, FileSearch, ShieldCheck, Eye];

const severityConfig: Record<string, { label: string; text: string; dot: string; bg: string }> = {
  critical: { label: 'Critical', text: 'text-[var(--severe)]', dot: 'bg-[var(--severe)]', bg: 'bg-[var(--severe)]/5' },
  high:     { label: 'High', text: 'text-[var(--warn)]', dot: 'bg-[var(--warn)]', bg: 'bg-[var(--warn)]/5' },
  medium:   { label: 'Medium', text: 'text-[var(--signal)]', dot: 'bg-[var(--signal)]', bg: 'bg-[var(--signal)]/5' },
  low:      { label: 'Low', text: 'text-[var(--ok)]', dot: 'bg-[var(--ok)]', bg: 'bg-[var(--ok)]/5' },
};

/* ── Checkpoint Health (print-friendly, all expanded) ──── */

function CheckpointHealth({ categoryScores, findings }: {
  categoryScores: Array<{ name: string; score: number; summary: string }>;
  findings: AuditFinding[];
}) {
  if (categoryScores.length === 0) return null;

  const findingsByCategory: Record<string, AuditFinding[]> = {};
  for (const cat of categoryScores) findingsByCategory[cat.name] = [];
  for (const f of findings) {
    let matched = false;
    for (const cat of categoryScores) {
      const words = cat.name.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3);
      const text = `${f.title} ${f.description}`.toLowerCase();
      if (words.some(w => text.includes(w))) {
        findingsByCategory[cat.name].push(f);
        matched = true;
        break;
      }
    }
    if (!matched && categoryScores.length > 0) {
      const catIdx = Math.min(Math.floor(f.sort_order / Math.max(1, findings.length / categoryScores.length)), categoryScores.length - 1);
      findingsByCategory[categoryScores[catIdx].name]?.push(f);
    }
  }

  return (
    <div className="border border-[var(--rule)] overflow-hidden" style={{ background: '#FFFFFF' }}>
      <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--rule)', background: '#F7F8F9' }}>
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
            {categoryScores.length * 4}-Checkpoint health
          </h3>
          <span className="text-[11px] font-medium ml-auto tracking-[0.03em] uppercase" style={{ color: 'var(--m-muted)' }}>
            {findings.filter(f => !f.dismissed).length} issues · {categoryScores.length} categories
          </span>
        </div>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--rule)' }}>
        {categoryScores.map((cat, catIdx) => {
          const checkpoints = CHECKPOINT_LABELS[cat.name] || ['Check 1', 'Check 2', 'Check 3', 'Check 4'];
          const catFindings = findingsByCategory[cat.name] || [];
          const failCount = Math.min(catFindings.length, checkpoints.length);
          const passCount = checkpoints.length - failCount;

          return (
            <div key={catIdx}>
              <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--rule) 60%, transparent)' }}>
                <span className={`text-[11px] font-semibold w-6 text-right ${scoreColor(cat.score)}`}>{cat.score}</span>
                <span className="text-[11px] font-medium flex-1 truncate" style={{ color: 'var(--ink)' }}>{cat.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {passCount > 0 && <span className="text-[11px] font-semibold" style={{ color: 'var(--ok)' }}>{passCount} pass</span>}
                  {failCount > 0 && <span className="text-[11px] font-semibold" style={{ color: 'var(--severe)' }}>{failCount} fail</span>}
                </div>
              </div>
              {/* Always expanded for print */}
              <div className="px-5 pb-3 pt-1.5 space-y-1.5">
                {checkpoints.map((checkpoint, i) => {
                  const hasFinding = i < failCount;
                  const finding = hasFinding ? catFindings[i] : null;
                  return (
                    <div key={i} className="flex items-start gap-2.5 py-1.5 px-3 rounded-lg" style={{ background: hasFinding ? 'color-mix(in srgb, var(--severe) 5%, transparent)' : 'color-mix(in srgb, var(--ok) 5%, transparent)' }}>
                      {hasFinding ? (
                        <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--severe)' }} />
                      ) : (
                        <CheckCircle2 size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--ok)' }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium" style={{ color: hasFinding ? 'var(--severe)' : 'var(--ok)' }}>
                          {checkpoint}
                        </p>
                        {finding && (
                          <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--m-muted)' }}>{finding.title}</p>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: hasFinding ? 'var(--severe)' : 'var(--ok)' }}>
                        {hasFinding ? 'Fail' : 'Pass'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Finding Card (compact, print-friendly) ────────────── */

function FindingCard({ finding, categoryScores }: { finding: AuditFinding; categoryScores?: Array<{ name: string; score: number; summary: string }> }) {
  const sev = severityConfig[finding.severity] || severityConfig.medium;
  const catName = finding.category_index != null && categoryScores?.[finding.category_index]
    ? categoryScores[finding.category_index].name
    : null;
  return (
    <div className="border overflow-hidden" style={{ borderColor: 'var(--rule)', background: '#FFFFFF' }}>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <span className={`w-2 h-2 rounded-full inline-block ${sev.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-semibold uppercase tracking-[0.04em] ${sev.text}`}>{sev.label}</span>
            {catName && (
              <span className="text-[10px] font-medium uppercase tracking-[0.03em]" style={{ color: 'var(--m-muted)' }}>
                {catName}
              </span>
            )}
          </div>
          <p className="text-[13px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>{finding.title}</p>
          {finding.description && (
            <p className="text-[12px] leading-relaxed mt-1" style={{ color: 'var(--m-muted)' }}>{finding.description}</p>
          )}
          {finding.recommendation && (
            <div className="mt-2 px-3 py-2 rounded-lg text-[11px] leading-relaxed" style={{ background: 'color-mix(in srgb, var(--signal) 5%, transparent)', color: 'var(--ink)' }}>
              <span className="font-semibold" style={{ color: 'var(--signal)' }}>Recommendation: </span>
              {finding.recommendation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────── */

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

  /* ── Loading state ──────────────────────────────────── */
  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] flex flex-col items-center justify-center gap-3" style={{ background: '#FFFFFF' }}>
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--signal)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--m-muted)' }}>Loading shared report...</p>
        </main>
        <Footer />
      </>
    );
  }

  /* ── Error / invalid state ──────────────────────────── */
  if (error || !audit) {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] flex items-center justify-center px-4" style={{ background: '#FFFFFF' }}>
          <div className="text-center max-w-md">
            <Lock size={40} className="mx-auto mb-4" style={{ color: 'var(--m-muted)' }} />
            <h1 className="font-sans font-medium text-2xl mb-2" style={{ color: 'var(--ink)' }}>Link unavailable</h1>
            <p className="text-sm mb-2" style={{ color: 'var(--m-muted)' }}>{error || 'This shared audit link is invalid or has been revoked.'}</p>
            <p className="text-xs mb-6" style={{ color: 'var(--m-muted)' }}>The owner may have turned sharing off, or the link expired. Ask them for a fresh one.</p>
            <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-medium px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110" style={{ background: 'var(--ink)', color: '#FFFFFF' }}>
              Run your own audit
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  /* ── Pending / failed state ─────────────────────────── */
  if (audit.status === 'failed') {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] flex items-center justify-center" style={{ background: '#FFFFFF' }}>
          <div className="text-center py-16 max-w-md mx-auto">
            <Lock size={32} className="mx-auto mb-3" style={{ color: 'var(--m-muted)' }} />
            <h2 className="font-sans font-medium text-lg mb-2" style={{ color: 'var(--ink)' }}>Audit didn&apos;t complete</h2>
            <p className="text-sm" style={{ color: 'var(--m-muted)' }}>
              This audit was unable to finish. The owner can re-run it from their Fixpath dashboard.
            </p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (audit.status !== 'completed' || !report) {
    return (
      <>
        <Navbar />
        <main className="min-h-[60vh] flex items-center justify-center" style={{ background: '#FFFFFF' }}>
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--signal)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--m-muted)' }}>This audit is still being analysed.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--m-muted)' }}>Fixpath runs 112 checkpoints across 7 modules - most audits finish in a few minutes.</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  /* ── Completed audit — data extraction ──────────────── */
  const rawJson = report.raw_json as any;
  const categoryScores: Array<{ name: string; score: number; summary: string }> = rawJson?.categoryScores || [];
  const topRecs: string[] = rawJson?.topRecommendations || (rawJson?.keyRecommendation ? [rawJson.keyRecommendation] : []);
  const selectedModules: string[] | null = rawJson?.selectedModules ?? null;
  const selectedPillars: number[] | null = rawJson?.selectedPillars ?? null;
  const totalModuleCount = PILLAR_NAMES.length;
  const activeModuleCount = selectedModules ? selectedModules.length : (selectedPillars ? selectedPillars.length : totalModuleCount);
  const isPartialAudit = activeModuleCount < totalModuleCount;

  // Calculate overall from category averages (same as dashboard)
  // Filter -1 sentinel (unanalyzed categories) — use >= 0 not > 0 since 0 is valid
  const scoredCats = categoryScores.filter(c => c.score >= 0);
  const calculatedOverallScore = scoredCats.length > 0
    ? Math.round(scoredCats.reduce((s, c) => s + c.score, 0) / scoredCats.length)
    : (report.overall_score ?? 0);

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical' && !f.dismissed).length,
    high: findings.filter(f => f.severity === 'high' && !f.dismissed).length,
    medium: findings.filter(f => f.severity === 'medium' && !f.dismissed).length,
    low: findings.filter(f => f.severity === 'low' && !f.dismissed).length,
  };

  let domain = 'audit';
  try { domain = new URL(audit.product_url).hostname.replace(/^www\./, ''); } catch {}

  const auditDate = audit.created_at
    ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(audit.created_at))
    : '';

  // Group findings by pillar
  const findingsByPillar: Record<string, AuditFinding[]> = {};
  for (const name of PILLAR_NAMES) findingsByPillar[name] = [];
  for (const f of findings) {
    if (f.dismissed || f.status === 'fixed' || (f as any).verification_status === 'verified_fixed') continue;
    const catIdx = (f as any).category_index;
    if (catIdx != null) {
      const pillarIdx = Math.floor(catIdx / 4);
      if (pillarIdx >= 0 && pillarIdx < PILLAR_NAMES.length) {
        findingsByPillar[PILLAR_NAMES[pillarIdx]].push(f);
        continue;
      }
    }
    // Fallback: keyword match
    const text = `${f.title} ${f.description}`.toLowerCase();
    let matched = false;
    for (let pi = 0; pi < PILLAR_NAMES.length; pi++) {
      const words = PILLAR_NAMES[pi].toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3);
      if (words.some(w => text.includes(w))) {
        findingsByPillar[PILLAR_NAMES[pi]].push(f);
        matched = true;
        break;
      }
    }
    if (!matched) findingsByPillar[PILLAR_NAMES[0]].push(f);
  }

  // AI Visibility breakdown
  const aiVis = rawJson?.aiVisibilityBreakdown;

  return (
    <>
      <Navbar />
      <main className="min-h-[60vh] print:min-h-0" style={{ background: '#FFFFFF' }}>
        <div className="max-w-4xl mx-auto py-8 sm:py-10 px-4 print:py-4 print:px-2">

          {/* ── Shared badge ──────────────────────────────── */}
          <div className="flex items-center gap-2 mb-6 text-xs print:mb-4" style={{ color: 'var(--m-muted)' }}>
            <Eye size={14} />
            <span>Shared audit report</span>
            <span style={{ color: 'var(--rule)' }}>|</span>
            <span className="font-medium" style={{ color: 'var(--ink)' }}>{domain}</span>
            {auditDate && (
              <>
                <span style={{ color: 'var(--rule)' }}>|</span>
                <span>{auditDate}</span>
              </>
            )}
            <a
              href={`/api/shared/${token}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:brightness-95 print:hidden"
              style={{ background: 'var(--ink)', color: '#FFFFFF' }}
            >
              <Download size={12} />
              Download PDF
            </a>
          </div>

          {/* ── Hero Score Card ────────────────────────────── */}
          <div className="border overflow-hidden mb-6" style={{ borderColor: 'var(--rule)', background: '#FFFFFF' }}>
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="flex-shrink-0">
                  <ScoreRing score={calculatedOverallScore} size={110} strokeWidth={7} />
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <h1 className="font-sans text-[22px] font-medium tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>
                    {domain}
                  </h1>
                  <p className="text-[11px] font-medium tracking-[0.03em] uppercase mb-1" style={{ color: 'var(--m-muted)' }}>
                    {findings.filter(f => !f.dismissed).length} findings · {activeModuleCount} modules{isPartialAudit ? ` of ${totalModuleCount}` : ''}
                  </p>

                  {/* Module mini-scores */}
                  {categoryScores.length > 0 && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                      {PILLAR_NAMES.map((name, idx) => {
                        const [start, end] = PILLAR_RANGES[idx];
                        const cats = categoryScores.filter((c, i) => i >= start && i < end && c.score >= 0);
                        if (cats.length === 0) return null;
                        const avg = Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length);
                        return (
                          <div key={idx} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MODULE_TINTS[idx].dot }} />
                            <span className="text-xs" style={{ color: 'var(--m-muted)' }}>{name}</span>
                            <span className={`text-xs font-medium ${scoreColor(avg)}`}>{avg}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Severity counts */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3">
                    {severityCounts.critical > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.03em] uppercase" style={{ color: 'var(--severe)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} /> {severityCounts.critical} critical
                      </span>
                    )}
                    {severityCounts.high > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.03em] uppercase" style={{ color: 'var(--warn)' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} /> {severityCounts.high} high
                      </span>
                    )}
                    {(severityCounts.medium + severityCounts.low) > 0 && (
                      <span className="text-[11px] font-medium tracking-[0.03em] uppercase" style={{ color: 'var(--m-muted)' }}>
                        {severityCounts.medium + severityCounts.low} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Top Priority Recommendations ───────────────── */}
          {topRecs.length > 0 && (
            <div className="mb-6 border overflow-hidden" style={{ borderColor: 'var(--rule)', background: '#FFFFFF' }}>
              <div
                className="flex items-center gap-3 px-5 py-4 border-b"
                style={{ borderColor: 'color-mix(in srgb, var(--rule) 40%, transparent)', background: 'color-mix(in srgb, var(--signal) 4%, transparent)' }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--signal)' }}>
                  <Zap size={13} style={{ color: '#FFFFFF' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Top priority recommendations</p>
                  <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>Ranked by business impact, fix effort, and evidence strength.</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-[0.04em] uppercase" style={{ color: 'var(--signal)', background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                  {topRecs.length} actions
                </span>
              </div>
              <div className="divide-y" style={{ borderColor: 'color-mix(in srgb, var(--rule) 30%, transparent)' }}>
                {topRecs.map((rec, i) => (
                  <div key={i} className="flex gap-4 items-start px-5 py-4">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: 'var(--signal)', color: '#FFFFFF' }}>
                        {i + 1}
                      </span>
                      <span className="text-[9px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Priority</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Lightbulb size={11} style={{ color: 'var(--signal)' }} />
                        <span className="text-[10px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--signal)' }}>Recommended fix</span>
                      </div>
                      <p className="text-[13px] leading-[1.7] font-medium" style={{ color: 'var(--ink)' }}>{rec}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Executive Summary ──────────────────────────── */}
          {report.executive_summary && (
            <div className="border overflow-hidden mb-6" style={{ borderColor: 'var(--rule)', background: '#FFFFFF' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'color-mix(in srgb, var(--rule) 40%, transparent)' }}>
                <h2 className="font-sans font-medium text-[15px]" style={{ color: 'var(--ink)' }}>Executive summary</h2>
              </div>
              <div className="px-5 py-4">
                <div className="text-[13px] leading-[1.7] whitespace-pre-line" style={{ color: 'var(--m-muted)' }}>
                  {report.executive_summary}
                </div>
              </div>
            </div>
          )}

          {/* ── Module Grid (2x3) ─────────────────────────── */}
          {categoryScores.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 print:grid-cols-2">
              {PILLAR_NAMES.map((name, pillarIdx) => {
                const [start, end] = PILLAR_RANGES[pillarIdx];
                const pillarCats = categoryScores.filter((c, idx) => idx >= start && idx < end && c.score >= 0);
                if (pillarCats.length === 0) return null;
                const avgScore = Math.round(pillarCats.reduce((sum, c) => sum + c.score, 0) / pillarCats.length);
                const tint = MODULE_TINTS[pillarIdx] || MODULE_TINTS[0];
                const PIcon = PILLAR_ICONS[pillarIdx] || Scale;
                const pillarFindings = findingsByPillar[name] || [];
                const findingCount = pillarFindings.length;

                return (
                  <div
                    key={name}
                    className="rounded-xl overflow-hidden"
                    style={{ background: tint.bg, border: `1px solid ${tint.border}` }}
                  >
                    {/* Module header */}
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${tint.dot}15` }}>
                        <PIcon size={16} style={{ color: tint.dot }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-sans font-medium text-[14px] truncate" style={{ color: 'var(--ink)' }}>{name}</h3>
                        {findingCount > 0 && (
                          <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                            {findingCount} finding{findingCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[24px] font-bold leading-none ${scoreColor(avgScore)}`}>{avgScore}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>/100</p>
                      </div>
                    </div>

                    {/* Category scores */}
                    <div className="px-5 pb-4 space-y-2" style={{ borderTop: `1px solid ${tint.border}` }}>
                      <div className="pt-3" />
                      {pillarCats.map((cat, relIdx) => {
                        const CatIcon = CATEGORY_ICONS[start + relIdx] || Sparkles;
                        return (
                          <div key={relIdx} className="flex items-center gap-2.5">
                            <CatIcon size={13} className="flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
                            <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--ink)' }}>{cat.name}</span>
                            <div className="w-16 h-[3px] rounded-full flex-shrink-0" style={{ background: `${tint.dot}15` }}>
                              <div className="h-full rounded-full" style={{ width: `${cat.score}%`, background: tint.dot, opacity: 0.55 }} />
                            </div>
                            <span className={`text-[13px] font-semibold w-7 text-right flex-shrink-0 ${scoreColor(cat.score)}`}>{cat.score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Checkpoint Health (all expanded) ───────────── */}
          <div className="mb-6">
            <CheckpointHealth categoryScores={categoryScores} findings={findings} />
          </div>

          {/* ── AI Visibility Breakdown ────────────────────── */}
          {aiVis && (
            <div className="border p-5 mb-6" style={{ borderColor: 'var(--rule)', background: '#FFFFFF' }}>
              <div className="flex items-center gap-2 mb-4">
                <Brain size={16} style={{ color: 'var(--signal)' }} />
                <h3 className="text-sm font-sans font-semibold" style={{ color: 'var(--ink)' }}>AI visibility breakdown</h3>
                <span className="ml-auto text-lg font-sans font-bold" style={{ color: 'var(--ink)' }}>
                  {aiVis.overall}<span className="text-sm font-normal" style={{ color: 'var(--m-muted)' }}>/100</span>
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'LLM knowledge accuracy', value: aiVis.llmAccuracy, desc: 'How accurately AI describes your site' },
                  { label: 'Structured data coverage', value: aiVis.structuredData, desc: 'JSON-LD completeness for rich results' },
                  { label: 'Content extractability', value: aiVis.contentExtractability, desc: 'How well AI can read your pages' },
                  { label: 'Crawl infrastructure', value: aiVis.crawlInfrastructure, desc: 'robots.txt, llms.txt, ai-plugin.json' },
                ].map((bar, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--m-muted)' }}>{bar.label}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{bar.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--rule) 20%, transparent)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${bar.value}%`, background: scoreBgVar(bar.value) }}
                      />
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: 'color-mix(in srgb, var(--m-muted) 60%, transparent)' }}>{bar.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── All Findings (grouped by module, all expanded) ── */}
          {findings.filter(f => !f.dismissed).length > 0 && (
            <div className="mb-6">
              {/* Severity summary bar */}
              <div className="border overflow-hidden mb-4" style={{ borderColor: 'var(--rule)', background: '#FFFFFF' }}>
                <div className="px-4 py-3 border-b flex items-center gap-2 flex-wrap" style={{ borderColor: 'color-mix(in srgb, var(--rule) 40%, transparent)' }}>
                  <FileSearch size={14} style={{ color: 'var(--signal)' }} />
                  <h3 className="text-sm font-medium" style={{ color: 'var(--ink)' }}>All findings</h3>
                  <span className="text-[11px] font-medium tracking-[0.03em] uppercase" style={{ color: 'var(--m-muted)' }}>
                    {findings.filter(f => !f.dismissed).length} active
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x" style={{ borderColor: 'color-mix(in srgb, var(--rule) 30%, transparent)' }}>
                  {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                    const count = severityCounts[sev];
                    const cfg = severityConfig[sev];
                    return (
                      <div key={sev} className="px-4 py-3 text-left">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <span className={`text-[10px] font-semibold uppercase tracking-[0.04em] ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className={`text-[20px] font-bold leading-none ${count === 0 ? '' : cfg.text}`} style={count === 0 ? { color: 'var(--m-muted)' } : {}}>
                          {count}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Findings by pillar */}
              {PILLAR_NAMES.map((pillarName, pillarIdx) => {
                const pillarFindings = findingsByPillar[pillarName];
                if (!pillarFindings || pillarFindings.length === 0) return null;
                const tint = MODULE_TINTS[pillarIdx];
                const PIcon = PILLAR_ICONS[pillarIdx];

                return (
                  <div key={pillarName} className="mb-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <PIcon size={14} style={{ color: tint.dot }} />
                      <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{pillarName}</h4>
                      <span className="text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>
                        {pillarFindings.length} finding{pillarFindings.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pillarFindings.map((f) => (
                        <FindingCard key={f.id} finding={f} categoryScores={categoryScores} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── AI transparency note ──────────────────────── */}
          <div className="mb-6 px-4 py-3 rounded-xl" style={{ background: '#F7F8F9', border: '1px solid color-mix(in srgb, var(--rule) 15%, transparent)' }}>
            <p className="text-[11px] leading-relaxed" style={{ color: 'color-mix(in srgb, var(--m-muted) 70%, transparent)' }}>
              <span className="font-medium" style={{ color: 'var(--m-muted)' }}>About this audit</span> — This report was generated by AI analysing publicly visible page content across up to 7 modules and 28 categories. It cannot test JavaScript interactions, real load times, or content behind authentication. For accessibility compliance and security-critical findings, we recommend pairing these results with manual review.
            </p>
          </div>

          {/* ── CTA ───────────────────────────────────────── */}
          <div className="text-center mt-10 mb-6 px-4 print:hidden">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>Audit your own site with the same engine</p>
            <p className="text-xs mb-1" style={{ color: 'var(--m-muted)' }}>Human experience + AI readability + brand consistency + conversion evidence - in one pass.</p>
            <p className="text-xs mb-5" style={{ color: 'var(--m-muted)' }}>112 checkpoints, 7 modules, client-ready PDF. First audit is free.</p>
            <Link href="/register" className="inline-flex items-center gap-2 text-[15px] font-medium px-6 py-3 min-h-[48px] rounded-xl transition-all hover:brightness-110 hover:-translate-y-0.5" style={{ background: 'var(--ink)', color: '#FFFFFF' }}>
              <Sparkles size={16} />
              Get your free audit
            </Link>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
