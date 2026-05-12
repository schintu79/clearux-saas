'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Sparkles,
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  FileSearch,
  Coins,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Bell,
  Loader2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  ExternalLink,
  RotateCcw,
  Palette,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createBrowserSupabase } from '@/lib/supabase-ssr';
import type { Audit, Report, AuditFinding } from '@/types/database';

/* ── Types ────────────────────────────────────────────────── */

interface AuditWithReport extends Audit {
  report: Report | null;
  brandName?: string;
}

interface ProjectData {
  key: string;
  label: string;
  type: 'website' | 'brand';
  audits: AuditWithReport[];
  latestCompleted: AuditWithReport | null;
  previousCompleted: AuditWithReport | null;
  findings: AuditFinding[];
  inProgress: AuditWithReport[];
}

/* ── Helpers ──────────────────────────────────────────────── */

const statusMeta: Record<string, { label: string; icon: React.ElementType }> = {
  pending_payment:   { label: 'Awaiting payment', icon: Clock },
  payment_received:  { label: 'Processing',       icon: Zap },
  crawling:          { label: 'Crawling',          icon: Globe },
  analysing:         { label: 'Analysing',         icon: Sparkles },
  generating_report: { label: 'Generating',        icon: FileSearch },
  completed:         { label: 'Completed',         icon: CheckCircle2 },
  failed:            { label: 'Failed',            icon: AlertTriangle },
};

function formatDate(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(d));
}

function formatDateFull(d: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
}

function formatUrl(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function scoreColor(s: number): string {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function scoreBg(s: number): string {
  if (s >= 70) return 'rgba(63,107,63,0.08)';
  if (s >= 40) return 'rgba(180,130,40,0.08)';
  return 'rgba(139,58,44,0.08)';
}

function severityColor(s: string): string {
  if (s === 'critical') return 'var(--severe)';
  if (s === 'high') return 'var(--warn)';
  if (s === 'medium') return 'var(--signal)';
  return 'var(--m-muted)';
}

function severityBg(s: string): string {
  if (s === 'critical') return 'rgba(139,58,44,0.08)';
  if (s === 'high') return 'rgba(180,130,40,0.08)';
  if (s === 'medium') return 'rgba(130,150,60,0.08)';
  return 'rgba(128,128,128,0.06)';
}

const MODULE_LABELS: Record<string, string> = {
  ux_score: 'Foundation',
  conversion_score: 'Human Experience',
  mobile_score: 'Inclusive Design',
  ai_discoverability_score: 'Future Readiness',
  content_score: 'SEO & Content',
};

/* ── Score Ring (mini) ───────────────────────────────────── */

function MiniScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={scoreColor(score)} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill={scoreColor(score)} fontSize={size * 0.3} fontWeight={600} fontFamily="var(--font-sans)">
        {score}
      </text>
    </svg>
  );
}

/* ── Project Card ─────────────────────────────────────────── */

function ProjectCard({ project }: { project: ProjectData }) {
  const [expanded, setExpanded] = useState(false);
  const latest = project.latestCompleted;
  const prev = project.previousCompleted;
  const report = latest?.report;
  const score = report?.overall_score ?? null;
  const prevScore = prev?.report?.overall_score ?? null;
  const scoreDelta = score != null && prevScore != null ? score - prevScore : null;

  // Module scores from report
  const moduleScores = useMemo(() => {
    if (!report) return [];
    return Object.entries(MODULE_LABELS)
      .map(([key, label]) => ({
        label,
        score: (report as any)[key] as number | null,
      }))
      .filter(m => m.score != null);
  }, [report]);

  // Top findings to fix (critical + high, max 5)
  const topFindings = useMemo(() => {
    return project.findings
      .filter(f => !f.dismissed && f.status !== 'fixed' && (f.severity === 'critical' || f.severity === 'high'))
      .slice(0, 5);
  }, [project.findings]);

  // Audit history (last 5 completed)
  const auditHistory = useMemo(() => {
    return project.audits
      .filter(a => a.status === 'completed' && a.report?.overall_score != null)
      .slice(0, 5);
  }, [project.audits]);

  const projectHref = project.type === 'website'
    ? `/dashboard/audits/site/${encodeURIComponent(project.key)}`
    : `/dashboard/audits/brand/${encodeURIComponent(project.key)}`;

  const reAuditHref = project.type === 'website' && latest
    ? `/dashboard/new-audit?url=${encodeURIComponent(latest.product_url || '')}`
    : project.type === 'brand' ? '/dashboard/new-audit?type=brand' : '/dashboard/new-audit';

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
      {/* Card Header */}
      <div className="px-5 py-4 flex items-center gap-4">
        {/* Score ring or placeholder */}
        <div className="flex-shrink-0">
          {score != null ? (
            <MiniScoreRing score={score} size={52} />
          ) : (
            <div className="w-[52px] h-[52px] rounded-full flex items-center justify-center" style={{ border: '2px solid var(--rule)' }}>
              <Minus size={16} style={{ color: 'var(--m-muted)' }} />
            </div>
          )}
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {project.type === 'website' ? (
              <Globe size={14} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0" />
            ) : (
              <Palette size={14} style={{ color: 'var(--m-muted)' }} className="flex-shrink-0" />
            )}
            <Link href={projectHref} className="text-[15px] font-semibold truncate hover:underline" style={{ color: 'var(--ink)' }}>
              {project.label}
            </Link>
            {project.inProgress.length > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(130,150,60,0.1)', color: 'var(--signal)' }}>
                <Loader2 size={10} className="animate-spin" />
                In progress
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            {score != null && scoreDelta != null && (
              <span className="flex items-center gap-0.5 text-[12px] font-medium" style={{ color: scoreDelta > 0 ? 'var(--ok)' : scoreDelta < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                {scoreDelta > 0 ? <TrendingUp size={12} /> : scoreDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                {scoreDelta > 0 ? '+' : ''}{scoreDelta} pts
              </span>
            )}
            <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
              {project.audits.filter(a => a.status === 'completed').length} audit{project.audits.filter(a => a.status === 'completed').length !== 1 ? 's' : ''}
            </span>
            {latest && (
              <span className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                Last: {formatDate(latest.created_at)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={reAuditHref} className="p-2 rounded-lg transition-colors hover:bg-black/[0.04]" title="Re-audit" style={{ color: 'var(--m-muted)' }}>
            <RotateCcw size={15} />
          </Link>
          <Link href={projectHref} className="p-2 rounded-lg transition-colors hover:bg-black/[0.04]" title="View project" style={{ color: 'var(--m-muted)' }}>
            <ArrowUpRight size={15} />
          </Link>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-2 rounded-lg transition-colors hover:bg-black/[0.04] cursor-pointer"
            style={{ color: 'var(--m-muted)', background: 'none', border: 'none' }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Module scores bar — always visible */}
      {moduleScores.length > 0 && (
        <div className="px-5 pb-4 flex gap-2 flex-wrap">
          {moduleScores.map(m => (
            <span
              key={m.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium"
              style={{ background: scoreBg(m.score!), color: scoreColor(m.score!) }}
            >
              {m.label}
              <span className="font-semibold tabular-nums">{m.score}</span>
            </span>
          ))}
        </div>
      )}

      {/* Issue summary bar — always visible */}
      {report && (report.critical_count > 0 || report.high_count > 0 || report.medium_count > 0) && (
        <div className="px-5 pb-4 flex gap-3">
          {report.critical_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--severe)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--severe)' }} />
              {report.critical_count} critical
            </span>
          )}
          {report.high_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--warn)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} />
              {report.high_count} high
            </span>
          )}
          {report.medium_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--signal)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--signal)' }} />
              {report.medium_count} medium
            </span>
          )}
          {report.low_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: 'var(--m-muted)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--m-muted)' }} />
              {report.low_count} low
            </span>
          )}
        </div>
      )}

      {/* ── Expanded details ─── */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--rule)' }}>
          <div className="grid md:grid-cols-2 gap-0">
            {/* Left: Top findings to fix */}
            <div className="p-5" style={{ borderRight: '1px solid var(--rule)' }}>
              <h4 className="text-[11px] font-semibold tracking-[0.06em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
                Top issues to fix
              </h4>
              {topFindings.length > 0 ? (
                <div className="space-y-2">
                  {topFindings.map(f => (
                    <Link key={f.id} href={`/dashboard/audits/${f.audit_id}?tab=findings`} className="block">
                      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors hover:bg-black/[0.03]" style={{ background: severityBg(f.severity) }}>
                        <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: severityColor(f.severity) }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>{f.title}</p>
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--m-muted)' }}>
                            {f.severity.charAt(0).toUpperCase() + f.severity.slice(1)}
                            {f.page_url ? ` · ${formatUrl(f.page_url)}` : ''}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {project.findings.filter(f => !f.dismissed && f.status !== 'fixed').length > 5 && (
                    <Link href={`/dashboard/audits/${latest?.id}?tab=findings`} className="text-[11px] font-medium flex items-center gap-1 mt-1 ml-3" style={{ color: 'var(--signal)' }}>
                      View all {project.findings.filter(f => !f.dismissed && f.status !== 'fixed').length} findings
                      <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>
                  {project.findings.length > 0 ? 'No critical or high severity issues open.' : 'No findings data available.'}
                </p>
              )}
            </div>

            {/* Right: Audit history */}
            <div className="p-5">
              <h4 className="text-[11px] font-semibold tracking-[0.06em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
                Audit history
              </h4>
              {auditHistory.length > 0 ? (
                <div className="space-y-1.5">
                  {auditHistory.map((a, i) => {
                    const s = a.report?.overall_score ?? 0;
                    const prevA = auditHistory[i + 1];
                    const prevS = prevA?.report?.overall_score ?? null;
                    const delta = prevS != null ? s - prevS : null;
                    return (
                      <Link key={a.id} href={`/dashboard/audits/${a.id}`} className="block">
                        <div className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-black/[0.03]">
                          <span className="text-[14px] font-semibold tabular-nums w-8" style={{ color: scoreColor(s) }}>{s}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px]" style={{ color: 'var(--ink)' }}>
                              {formatDateFull(a.created_at)}
                              {a.depth_mode === 'deep' && (
                                <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}>Deep</span>
                              )}
                            </p>
                          </div>
                          {delta != null && (
                            <span className="text-[11px] font-medium tabular-nums" style={{ color: delta > 0 ? 'var(--ok)' : delta < 0 ? 'var(--severe)' : 'var(--m-muted)' }}>
                              {delta > 0 ? '+' : ''}{delta}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>No completed audits yet.</p>
              )}
            </div>
          </div>

          {/* Key recommendation */}
          {report?.key_recommendation && (
            <div className="px-5 py-3.5 flex items-start gap-2.5" style={{ borderTop: '1px solid var(--rule)', background: 'var(--paper-2)' }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
              <p className="text-[12px] leading-[1.5]" style={{ color: 'var(--ink)' }}>
                <span className="font-semibold">Key recommendation:</span> {report.key_recommendation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */

function DashboardInner() {
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading } = useAuth();
  const [audits, setAudits] = useState<AuditWithReport[]>([]);
  const [allFindings, setAllFindings] = useState<Record<string, AuditFinding[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditsBanner, setCreditsBanner] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [totalCompleted, setTotalCompleted] = useState<number | null>(null);
  const [totalFindings, setTotalFindings] = useState<number | null>(null);
  const [pinnedNotification, setPinnedNotification] = useState<{ id: string; title: string; message: string; color: string; icon: string } | null>(null);

  useEffect(() => {
    if (searchParams.get('credits') !== 'purchased') return;
    setCreditsBanner(true);
    window.history.replaceState({}, '', '/dashboard');
    const t = setTimeout(() => setCreditsBanner(false), 6000);
    fetch('/api/stripe/verify-credits', { method: 'POST' })
      .then((r) => r.json())
      .then((d) => { if (d.verified) window.dispatchEvent(new Event('focus')); })
      .catch(() => {});
    return () => clearTimeout(t);
  }, [searchParams]);

  const fetchAudits = useCallback(async (userId: string) => {
    try {
      const supabase = createBrowserSupabase();

      // Fetch all audits (not just 20)
      const [auditsRes, reportsRes, countRes, brandRes] = await Promise.all([
        supabase.from('audits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('reports').select('*').eq('user_id', userId),
        supabase.from('audits').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
        supabase.from('brand_identities').select('id, name').eq('user_id', userId),
      ]);

      if (countRes.count != null) setTotalCompleted(countRes.count);
      if (auditsRes.error) throw auditsRes.error;

      const reportsMap: Record<string, Report> = {};
      if (reportsRes.data) {
        for (const r of reportsRes.data) reportsMap[r.audit_id] = r as any;
      }

      const brandMap: Record<string, string> = {};
      if (brandRes.data) {
        for (const b of brandRes.data) brandMap[b.id] = b.name;
      }

      const enriched: AuditWithReport[] = (auditsRes.data || []).map((a: any) => ({
        ...a,
        report: reportsMap[a.id] || null,
        brandName: a.brand_identity_id ? brandMap[a.brand_identity_id] || 'Unnamed brand' : undefined,
      }));
      setAudits(enriched);

      // Fetch findings for latest completed audits per project
      const completedAudits = enriched.filter(a => a.status === 'completed' && a.report);
      // Group to find latest per project
      const latestPerProject: Record<string, string> = {};
      for (const a of completedAudits) {
        const key = a.audit_type === 'brand_identity'
          ? `brand:${a.brandName || 'unknown'}`
          : `site:${formatUrl(a.product_url || '')}`;
        if (!latestPerProject[key]) latestPerProject[key] = a.id;
      }
      const auditIdsForFindings = Object.values(latestPerProject);
      if (auditIdsForFindings.length > 0) {
        const { data: findingsData } = await supabase
          .from('audit_findings')
          .select('*')
          .in('audit_id', auditIdsForFindings)
          .order('sort_order', { ascending: true });
        if (findingsData) {
          const grouped: Record<string, AuditFinding[]> = {};
          let total = 0;
          for (const f of findingsData) {
            if (!grouped[f.audit_id]) grouped[f.audit_id] = [];
            grouped[f.audit_id].push(f as AuditFinding);
            if (!f.dismissed && f.status !== 'fixed') total++;
          }
          setAllFindings(grouped);
          setTotalFindings(total);
        }
      }
    } catch (err: any) {
      setError(`Failed to load audits: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/credits').then(r => r.json()).then(d => setCredits(d.credits ?? 0)).catch(() => {});
    fetch('/api/notifications').then(r => r.json()).then(d => {
      const pinned = (d.notifications || []).find((n: any) => n.show_in_overview && !n.is_read);
      if (pinned) setPinnedNotification(pinned);
    }).catch(() => {});
  }, [user]);

  const verifyPendingAudits = useCallback(async (auditList: AuditWithReport[]) => {
    const pending = auditList.filter((a) => a.status === 'pending_payment');
    if (pending.length === 0) return;
    for (const audit of pending) {
      try {
        await fetch('/api/stripe/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audit_id: audit.id }) });
      } catch {}
    }
    if (pending.length > 0 && user) setTimeout(() => fetchAudits(user.id), 1500);
  }, [user, fetchAudits]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    fetchAudits(user.id);
  }, [authLoading, user?.id, fetchAudits]);

  useEffect(() => {
    if (audits.length > 0) verifyPendingAudits(audits);
  }, [audits.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const hasInProgress = audits.some((a) =>
      ['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status)
    );
    if (!hasInProgress) return;
    const iv = setInterval(() => fetchAudits(user.id), 8000);
    return () => clearInterval(iv);
  }, [audits, user, fetchAudits]);

  /* ── Build project list ─── */
  const projects = useMemo<ProjectData[]>(() => {
    const projectMap: Record<string, ProjectData> = {};

    for (const a of audits) {
      let key: string;
      let label: string;
      let type: 'website' | 'brand';

      if (a.audit_type === 'brand_identity') {
        label = a.brandName || 'Unnamed brand';
        key = label;
        type = 'brand';
      } else {
        label = formatUrl(a.product_url || '');
        key = label;
        type = 'website';
      }

      const projectKey = `${type}:${key}`;
      if (!projectMap[projectKey]) {
        projectMap[projectKey] = {
          key,
          label,
          type,
          audits: [],
          latestCompleted: null,
          previousCompleted: null,
          findings: [],
          inProgress: [],
        };
      }
      projectMap[projectKey].audits.push(a);
      if (['payment_received', 'crawling', 'analysing', 'generating_report'].includes(a.status)) {
        projectMap[projectKey].inProgress.push(a);
      }
    }

    // Set latest/previous completed + findings for each project
    for (const p of Object.values(projectMap)) {
      const completed = p.audits.filter(a => a.status === 'completed' && a.report);
      p.latestCompleted = completed[0] || null;
      p.previousCompleted = completed[1] || null;
      if (p.latestCompleted) {
        p.findings = allFindings[p.latestCompleted.id] || [];
      }
    }

    // Sort: projects with in-progress audits first, then by latest completed score (ascending = worst first)
    return Object.values(projectMap).sort((a, b) => {
      if (a.inProgress.length > 0 && b.inProgress.length === 0) return -1;
      if (b.inProgress.length > 0 && a.inProgress.length === 0) return 1;
      const sa = a.latestCompleted?.report?.overall_score ?? 999;
      const sb = b.latestCompleted?.report?.overall_score ?? 999;
      return sa - sb; // Worst score first
    });
  }, [audits, allFindings]);

  // Global stats
  const globalStats = useMemo(() => {
    const completedAudits = audits.filter(a => a.status === 'completed' && a.report?.overall_score != null);
    const scores = completedAudits.map(a => a.report!.overall_score!);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const totalCritical = completedAudits.reduce((sum, a) => sum + (a.report?.critical_count || 0), 0);
    const worstProject = projects.find(p => p.latestCompleted?.report?.overall_score != null);
    return { avgScore, totalCritical, worstProject, projectCount: projects.length };
  }, [audits, projects]);

  /* ── Skeleton ─── */
  if (authLoading || (loading && user)) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-[72px] rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map(i => <div key={i} className="h-[100px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  const name = profile?.full_name?.split(' ')[0] || 'there';
  const isNewUser = audits.length === 0;

  return (
    <div>
      {/* Credits purchased banner */}
      {creditsBanner && (
        <div role="status" aria-live="polite" className="mb-5 px-4 py-3 rounded-lg flex items-center gap-3" style={{ background: 'rgba(63,107,63,0.06)', border: '1px solid rgba(63,107,63,0.12)' }}>
          <CheckCircle2 size={15} style={{ color: 'var(--ok)' }} />
          <p className="text-[13px]" style={{ color: 'var(--ink)' }}>Credits added to your account.</p>
        </div>
      )}

      {/* Pinned notification */}
      {pinnedNotification && (
        <div className="mb-5 px-4 py-3 rounded-lg flex items-start gap-3" style={{ background: 'var(--signal-soft)', border: '1px solid var(--signal-soft-2)' }}>
          <Bell size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{pinnedNotification.title}</p>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{pinnedNotification.message}</p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notification_id: pinnedNotification.id }) });
              setPinnedNotification(null);
              window.dispatchEvent(new Event('focus'));
            }}
            className="p-1 rounded-md transition-colors flex-shrink-0 hover:bg-black/5"
            style={{ color: 'var(--m-muted)' }}
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'rgba(139,58,44,0.06)', border: '1px solid rgba(139,58,44,0.12)' }}>
          <p className="text-[13px]" style={{ color: 'var(--severe)' }}>{error}</p>
        </div>
      )}

      {/* ── Global stats bar ──────────────────── */}
      {!isNewUser && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <div className="rounded-lg px-4 py-3.5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <p className="text-[11px] font-medium tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Projects</p>
            <p className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: 'var(--ink)' }}>{globalStats.projectCount}</p>
          </div>
          <div className="rounded-lg px-4 py-3.5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <p className="text-[11px] font-medium tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Audits</p>
            <p className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: 'var(--ink)' }}>{totalCompleted ?? 0}</p>
          </div>
          <div className="rounded-lg px-4 py-3.5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <p className="text-[11px] font-medium tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Open issues</p>
            <p className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: (totalFindings ?? 0) > 0 ? 'var(--warn)' : 'var(--ink)' }}>{totalFindings ?? 0}</p>
          </div>
          <Link href="/dashboard/buy-credits" className="rounded-lg px-4 py-3.5 transition-colors hover:bg-black/[0.02]" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <p className="text-[11px] font-medium tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>Credits</p>
            <p className="text-[22px] font-semibold tabular-nums mt-1" style={{ color: 'var(--ink)' }}>{credits ?? '--'}</p>
          </Link>
          <Link
            href="/dashboard/new-audit"
            className="rounded-lg px-4 py-3.5 flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Sparkles size={15} />
            <span className="text-[13px] font-semibold">New audit</span>
          </Link>
        </div>
      )}

      {/* Re-audit worst scorer */}
      {globalStats.worstProject && globalStats.worstProject.latestCompleted?.report?.overall_score != null && globalStats.worstProject.latestCompleted.report.overall_score < 70 && globalStats.projectCount > 1 && (
        <div className="mb-6 px-4 py-3 rounded-lg flex items-center gap-3" style={{ background: 'rgba(139,58,44,0.05)', border: '1px solid rgba(139,58,44,0.1)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--severe)' }} className="flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
              <span className="font-semibold">{globalStats.worstProject.label}</span> has your lowest score ({globalStats.worstProject.latestCompleted!.report!.overall_score})
            </p>
          </div>
          <Link
            href={globalStats.worstProject.type === 'website' && globalStats.worstProject.latestCompleted?.product_url
              ? `/dashboard/new-audit?url=${encodeURIComponent(globalStats.worstProject.latestCompleted.product_url)}`
              : '/dashboard/new-audit'}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md flex-shrink-0 transition-colors hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <RotateCcw size={11} />
            Re-audit
          </Link>
        </div>
      )}

      {/* ── Onboarding ── */}
      {isNewUser && (
        <div className="mb-8 rounded-xl p-8" style={{ border: '1px solid var(--rule)', background: 'var(--card)' }}>
          <h2 className="text-[17px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Welcome, {name}</h2>
          <p className="text-[13px] mb-6" style={{ color: 'var(--m-muted)' }}>Run your first UX audit to see your dashboard come to life.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
            {[
              { step: '1', title: 'Paste your URL', desc: 'Enter any website to audit', icon: Globe },
              { step: '2', title: 'AI runs 96 checks', desc: 'Across 6 UX modules', icon: Sparkles },
              { step: '3', title: 'Get your report', desc: 'Scores, findings, and actions', icon: FileSearch },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}>
                  {s.step}
                </span>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{s.title}</p>
                  <p className="text-[12px]" style={{ color: 'var(--m-muted)' }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 rounded-lg transition-all hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Sparkles size={14} />
            Start your first audit
          </Link>
        </div>
      )}

      {/* ── Projects ──────────────────────────── */}
      {projects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
              Projects ({projects.length})
            </h2>
            <Link href="/dashboard/audits" className="text-[12px] font-medium flex items-center gap-1 transition-colors hover:underline" style={{ color: 'var(--signal)' }}>
              View all audits
              <ArrowRight size={10} />
            </Link>
          </div>
          <div className="space-y-3">
            {projects.map(p => (
              <ProjectCard key={`${p.type}:${p.key}`} project={p} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for existing users with no projects */}
      {!isNewUser && projects.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 size={20} className="mx-auto mb-2" style={{ color: 'var(--ok)' }} />
          <p className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>All clear</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            No audits in progress. Your completed audits are in the Audits tab.
          </p>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-[72px] rounded-lg animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map(i => <div key={i} className="h-[100px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    }>
      <DashboardInner />
    </Suspense>
  );
}
