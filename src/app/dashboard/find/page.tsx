'use client';

/**
 * Find — diagnostic discovery view. The "what is wrong" inventory,
 * grouped by module, with severity at a glance.
 *
 * Visual rules (Fix-aligned redesign):
 *  - Filters are compact select dropdowns (severity + module), matching
 *    the Fix page's filter language. An active dropdown turns dark.
 *  - Module groupings stay so users can see where the work concentrates,
 *    but selecting a module short-circuits to that bucket.
 *  - Each finding row is expandable — click to reveal description,
 *    impact, and a "Fix now" button linking to the Fix workspace.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  ExternalLink,
  Wrench,
  Scale,
  Heart,
  Accessibility,
  Brain,
  FileSearch,
  ShieldCheck,
  Lightbulb,
  Search as SearchIcon,
  X,
  Download,
} from 'lucide-react';
import {
  prepareFindingsForExport,
  buildExportMeta,
  renderMarkdown,
  processExportPipeline,
} from '@/lib/export/findings-formatter';
import {
  severityColor,
  severityLabel,
  moduleIndexForFinding,
  MODULE_TINTS,
  PHASE1_MODULES,
} from '@/lib/dashboard/latest-audit';
import { useAuditBundle } from '@/context/AuditBundleContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PriorityRecommendations, { derivePriorityRecs } from '@/components/dashboard/v2/PriorityRecommendations';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import FindingText from '@/components/dashboard/v2/FindingText';
import DashCard from '@/components/dashboard/v2/DashCard';
import ActionLink from '@/components/dashboard/v2/ActionLink';
import { hostOf } from '@/components/dashboard/v2/score-utils';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import CustomSelect from '@/components/ui/CustomSelect';
import { groupFindingsForDisplay, type GroupedFinding } from '@/lib/audit-findings-presentation';
import {
  getDisplayTitle,
  getWhatFound,
  getWhyMatters,
  getTechnicalNote,
  getFixPlain,
  getFixTechnical,
  hasCommunication,
} from '@/lib/finding-communication-helpers';
import {
  AuditConfidenceStrip,
  CategoryTrustMeta as CategoryTrustMetaComponent,
  FindingEvidenceBadge,
  FindingSourceLabel,
  FindingSurfaceScope,
  FindingEvidencePanel,
} from '@/components/dashboard/v2/AuditTrustLayer';
import { computeCoverageLabel } from '@/lib/audit-engine/pipeline/trust-summary';
import { applySeverityCap, composeModuleScores } from '@/lib/scoring/severity-cap';
import type { CrawlSummary } from '@/types/database';

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEVERITIES: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> = ['all', 'critical', 'high', 'medium', 'low'];

/** Compact label shown before the View CTA — tells the user if the issue is fixable in console or needs design work. */
function fixTypeLabel(finding: any): { text: string; console: boolean } | null {
  const ft = finding.finding_type;
  const fxt = finding.fix_type;
  if (ft === 'strategic') return { text: 'Design', console: false };
  if (!fxt) return null;
  if (['meta', 'html', 'schema', 'file', 'config'].includes(fxt)) return { text: 'Console', console: true };
  if (fxt === 'copy') return { text: 'Copy', console: true };
  return null;
}

// Module-aligned icons. Order must match PHASE1_MODULES in latest-audit.ts.
const MODULE_ICONS: React.ElementType[] = [Scale, Heart, Accessibility, Brain, FileSearch, ShieldCheck, Eye];

interface ModuleBucket {
  index: number;
  name: string;
  groups: GroupedFinding[];
  counts: { critical: number; high: number; medium: number; low: number };
}

/** Filter dropdown — shared visual language with Fix. Goes dark when active. */
function FilterDropdown({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <CustomSelect
      value={value}
      onChange={onChange}
      options={options}
      label={label}
      isActive={value !== 'all'}
      size="md"
    />
  );
}

function FindPageInner() {
  const { loading: authLoading } = useAuth();
  const { workspace, workspaceSlug, loading: wsLoading } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const { bundle, loading: bundleLoading } = useAuditBundle();
  const searchParams = useSearchParams();
  const loading = authLoading || wsLoading || bundleLoading || !bundle;
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // techExpanded state removed 2026-06-10 — technical notes are now always
  // visible (green block under the recommendation), no dropdown.
  const [activeTab, setActiveTab] = useState<'priority' | 'strategic'>('priority');

  // Module filter — chip-driven, with URL hydration on first mount so the
  // category-card deep links from Overview keep working.
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<typeof SEVERITIES[number]>('all');

  useEffect(() => {
    const m = searchParams.get('module');
    if (m && ((PHASE1_MODULES as readonly string[]).includes(m) || m === 'speed')) {
      setModuleFilter(m);
    }
    const sev = searchParams.get('severity');
    if (sev && (SEVERITIES as readonly string[]).includes(sev)) {
      setSevFilter(sev as typeof SEVERITIES[number]);
    }
  }, [searchParams]);

  // Strategic observations — shown in a separate section below fixable findings
  const strategicFindings = useMemo(() => {
    if (!bundle) return [];
    return bundle.findings.filter(
      (f) => (f as any).finding_type === 'strategic' && f.status !== 'fixed' && !f.dismissed && (f as any).verification_status !== 'verified_fixed',
    );
  }, [bundle]);

  const buckets = useMemo<ModuleBucket[]>(() => {
    if (!bundle) return [];
    // Only fixable findings go into the module buckets
    const open = bundle.findings.filter(
      (f) => (f.status === 'open' || f.status === 'in_progress') && (f as any).finding_type !== 'strategic',
    );
    const grouped = groupFindingsForDisplay(open, (f) => moduleIndexForFinding(f));

    const byModule = new Map<number, GroupedFinding[]>();
    for (const g of grouped) {
      const idx = g.affectedModuleIndices.find((i) => i >= 0) ?? -1;
      const arr = byModule.get(idx) || [];
      arr.push(g);
      byModule.set(idx, arr);
    }

    const result: ModuleBucket[] = [];
    for (let i = 0; i < PHASE1_MODULES.length; i++) {
      const arr = byModule.get(i);
      if (!arr || arr.length === 0) continue;
      const sorted = [...arr].sort((a, b) => (SEVERITY_RANK[b.primary.severity] || 0) - (SEVERITY_RANK[a.primary.severity] || 0));
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const g of sorted) {
        const sev = g.primary.severity as keyof typeof counts;
        if (counts[sev] != null) counts[sev]++;
      }
      result.push({ index: i, name: PHASE1_MODULES[i], groups: sorted, counts });
    }
    const uncategorized = byModule.get(-1);
    if (uncategorized && uncategorized.length > 0) {
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const g of uncategorized) {
        const sev = g.primary.severity as keyof typeof counts;
        if (counts[sev] != null) counts[sev]++;
      }
      result.push({ index: -1, name: 'General', groups: uncategorized, counts });
    }
    return result;
  }, [bundle]);

  // Per-module aggregate score for bucket headers — runs the IDENTICAL
  // shared chain as the Overview category cards (raw category means →
  // overall severity cap → per-module caps → composition). Before this,
  // Find showed the raw mean (81) while Overview showed the composed
  // score (48) for the same module.
  const moduleScores = useMemo<Record<string, number>>(() => {
    const rawJson = (bundle?.report?.raw_json || null) as any;
    if (!rawJson?.categoryScores || !Array.isArray(rawJson.categoryScores)) return {};

    // Raw per-module means from category scores
    const rawModules: Array<{ name: string; score: number }> = [];
    const allCatScores: number[] = [];
    for (let i = 0; i < PHASE1_MODULES.length; i++) {
      const cats = rawJson.categoryScores.filter((_: any, idx: number) => Math.floor(idx / 4) === i).filter((c: any) => c.score >= 0);
      if (cats.length > 0) {
        rawModules.push({ name: PHASE1_MODULES[i], score: Math.round(cats.reduce((s: number, c: any) => s + c.score, 0) / cats.length) });
        for (const c of cats) allCatScores.push(c.score);
      }
    }
    if (rawModules.length === 0) return {};

    // Open findings grouped by module — same population the Overview uses
    const openAll = (bundle?.findings || []).filter(
      (f: any) => f.status !== 'fixed' && !f.dismissed && f.verification_status !== 'verified_fixed',
    );
    const byModule: Record<string, Array<{ severity: string }>> = {};
    for (const name of PHASE1_MODULES) byModule[name] = [];
    for (const f of openAll) {
      const mi = moduleIndexForFinding(f);
      if (mi >= 0 && mi < PHASE1_MODULES.length) byModule[PHASE1_MODULES[mi]].push(f);
    }

    const rawOverall = Math.round(allCatScores.reduce((s, v) => s + v, 0) / allCatScores.length);
    const { overall: cappedOverall, capInfo } = applySeverityCap(rawOverall, openAll);
    const composed = composeModuleScores(rawModules, byModule, cappedOverall, capInfo.applied);
    const out: Record<string, number> = {};
    for (const m of composed) out[m.name] = m.score;
    return out;
  }, [bundle]);

  const visibleBuckets = useMemo<ModuleBucket[]>(() => {
    let bs = buckets;
    if (moduleFilter === 'speed') {
      // Special: filter to speed/performance findings across all modules
      bs = bs
        .map((b) => ({
          ...b,
          groups: b.groups.filter((g) => {
            const f = g.primary as any;
            return f.detection_source === 'pagespeed_api' || f.detection_source === 'performance_checker' || f.performance_metric_type || (f.category || '').toLowerCase().includes('speed') || (f.category || '').toLowerCase().includes('performance');
          }),
        }))
        .filter((b) => b.groups.length > 0);
    } else if (moduleFilter !== 'all') {
      bs = bs.filter((b) => b.name === moduleFilter);
    }
    if (sevFilter !== 'all') {
      bs = bs
        .map((b) => ({
          ...b,
          groups: b.groups.filter((g) => g.primary.severity === sevFilter),
        }))
        .filter((b) => b.groups.length > 0);
    }
    return bs;
  }, [buckets, moduleFilter, sevFilter]);

  // When a module filter is active, auto-expand the matching bucket.
  useEffect(() => {
    if (moduleFilter === 'all' || buckets.length === 0) return;
    const next: Record<number, boolean> = {};
    for (const b of buckets) next[b.index] = b.name !== moduleFilter;
    setCollapsed(next);
  }, [moduleFilter, buckets]);

  const totalOpen = useMemo(() => visibleBuckets.reduce((acc, b) => acc + b.groups.length, 0), [visibleBuckets]);

  const sevCounts = useMemo(() => {
    const out: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const b of buckets) {
      out.critical += b.counts.critical;
      out.high += b.counts.high;
      out.medium += b.counts.medium;
      out.low += b.counts.low;
    }
    return out;
  }, [buckets]);

  const totalAll = useMemo(() => buckets.reduce((s, b) => s + b.groups.length, 0), [buckets]);

  const crawlCoverageLabel = useMemo(() => {
    const cs = (bundle?.audit as any)?.crawl_summary as CrawlSummary | null | undefined;
    return computeCoverageLabel(cs ?? null).label;
  }, [bundle]);

  const openFindings = useMemo(
    () => (bundle?.findings ?? []).filter((f) => f.status !== 'fixed' && !f.dismissed && (f as any).verification_status !== 'verified_fixed'),
    [bundle],
  );
  const priorityRecs = useMemo(
    () => derivePriorityRecs(bundle?.report ?? null, openFindings),
    [bundle, openFindings],
  );

  const toggleFinding = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div>
        <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[140px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
        <OverviewBreadcrumb current="Find" />
        <PageHeader
          icon={<SearchIcon size={18} style={{ color: 'var(--ink)' }} />}
          title="Find"
          subtitle={workspace ? 'No audit for this brand yet.' : 'Run an audit to see what needs fixing.'}
        />
        <EmptyAudit
          title="No findings yet"
          body="Run your first audit to find what is hurting your site. Every issue comes with a severity rank and a clear fix path."
        />
      </div>
    );
  }

  const hasActive = moduleFilter !== 'all' || sevFilter !== 'all';

  // Same Markdown handoff export as the Fix page (identical pipeline + file).
  const allGroups = buckets.flatMap((b) => b.groups);
  const handleExportFindings = () => {
    const exportFindings = prepareFindingsForExport(allGroups, PHASE1_MODULES);
    const siteName = workspace?.primary_domain || workspace?.name || 'brand';
    const siteHostname = workspace?.primary_domain || '';
    const auditDate = bundle.audit?.completed_at || bundle.audit?.created_at || new Date().toISOString();
    const auditId = bundle.audit?.id || 'unknown';
    const { clusters, originalCount, uniqueCount } = processExportPipeline(exportFindings, siteHostname);
    const dedupedFindings = clusters.flatMap((c) => c.members);
    const meta = buildExportMeta(dedupedFindings, siteName, auditDate, auditId, { originalCount, uniqueCount });
    const md = renderMarkdown(dedupedFindings, meta, clusters);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const hostname = workspace?.primary_domain || 'brand';
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixpath-fixes-${hostname}-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <OverviewBreadcrumb current="Find" />
      <PageHeader
        icon={<SearchIcon size={18} style={{ color: 'var(--ink)' }} />}
        title="Find"
        subtitle="What is hurting your site right now, ranked by impact."
      >
        {allGroups.length > 0 && (
          <button
            onClick={handleExportFindings}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Download size={14} strokeWidth={2} />
            Export fixes
          </button>
        )}
      </PageHeader>

      {/* Trust layer — page-level confidence strip */}
      <AuditConfidenceStrip
        findings={bundle.findings}
        crawlSummary={(bundle.audit as any)?.crawl_summary as CrawlSummary | null ?? null}
        className="mb-4"
      />

      {/* Tab navigation */}
      <div className="flex items-center gap-0 mb-5" style={{ borderBottom: '2px solid var(--rule)' }}>
        {[
          { key: 'priority' as const, label: 'Fixes & recommendations', count: totalAll },
          { key: 'strategic' as const, label: 'Strategic observations', count: strategicFindings.length },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 text-[13px] font-semibold transition-colors relative -mb-[2px]"
            style={{
              color: activeTab === tab.key ? 'var(--ink)' : 'var(--m-muted)',
              background: 'transparent',
              border: 'none',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="ml-1.5 text-[11px] tabular-nums font-medium"
                style={{ color: activeTab === tab.key ? 'var(--ink-2)' : 'var(--m-muted)' }}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <span
                className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                style={{ background: 'var(--ink)' }}
              />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'priority' && priorityRecs.length > 0 && bundle?.audit && moduleFilter === 'all' && sevFilter === 'all' && (
        <div className="mb-4">
          <PriorityRecommendations
            recs={priorityRecs}
            findings={openFindings}
            auditId={bundle.audit.id}
          />
        </div>
      )}

      {/* Filter rail — Severity + Module as compact dropdowns, aligned with Fix */}
      {activeTab === 'priority' && <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <FilterDropdown
            value={sevFilter}
            onChange={(v) => setSevFilter(v as typeof SEVERITIES[number])}
            label="Severity"
            options={[
              { value: 'all', label: `All severities (${totalAll})` },
              ...(SEVERITIES.filter((s) => s !== 'all') as Array<'critical' | 'high' | 'medium' | 'low'>).map((s) => ({
                value: s,
                label: `${severityLabel(s)} (${sevCounts[s] || 0})`,
              })),
            ]}
          />

          <FilterDropdown
            value={moduleFilter}
            onChange={setModuleFilter}
            label="Module"
            options={[
              { value: 'all', label: 'All modules' },
              ...buckets.map((b) => ({ value: b.name, label: `${b.name} (${b.groups.length})` })),
            ]}
          />

          {hasActive && (
            <button
              onClick={() => { setModuleFilter('all'); setSevFilter('all'); }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium"
              style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
            >
              <X size={11} /> Clear
            </button>
          )}

          <span className="ml-auto text-[11.5px]" style={{ color: 'var(--m-muted)' }}>
            {totalOpen} of {totalAll} findings
          </span>
        </div>
      </div>}

      {activeTab === 'priority' && (totalOpen === 0 ? (
        <DashCard className="text-center" padding="lg">
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            {hasActive ? 'No findings match these filters' : 'Nothing is currently hurting your score'}
          </p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            {hasActive ? 'Try clearing the filters or run a re-audit.' : 'Run a re-audit to confirm.'}
          </p>
          {hasActive ? (
            <ActionLink onClick={() => { setModuleFilter('all'); setSevFilter('all'); }} icon={ArrowRight} className="mt-4">
              Clear filters
            </ActionLink>
          ) : (
            <ActionLink href={`${dashPrefix}/new-audit`} icon={ArrowRight} className="mt-4">
              Run re-audit
            </ActionLink>
          )}
        </DashCard>
      ) : (
        <div className="space-y-3">
          {visibleBuckets.map((b) => {
            const tint = b.index >= 0 ? MODULE_TINTS[b.index] : null;
            const Icon = b.index >= 0 ? (MODULE_ICONS[b.index] || Scale) : Scale;
            const score = moduleScores[b.name];
            const hasScore = typeof score === 'number';
            const scoreCls = hasScore
              ? (score >= 70 ? 'text-ok' : score >= 40 ? 'text-warn' : 'text-severe')
              : '';
            const isCollapsed = !!collapsed[b.index];
            return (
              <section
                key={b.index}
                className="rounded-lg overflow-hidden"
                style={{
                  background: tint ? tint.bg : 'var(--card)',
                  border: tint ? `1px solid ${tint.border}` : '1px solid var(--rule)',
                }}
                data-testid="find-module-bucket"
              >
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [b.index]: !c[b.index] }))}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-black/[0.02] transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  <span
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: tint ? `${tint.dot}15` : 'var(--paper-2)' }}
                  >
                    <Icon size={15} style={{ color: tint?.dot || 'var(--m-muted)' }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h2 className="text-[13.5px] font-semibold" style={{ color: 'var(--ink)' }}>{b.name}</h2>
                      {hasScore && (
                        <span className={`text-[12.5px] font-bold tabular-nums ${scoreCls}`}>
                          {score}
                          <span className="text-[10px] font-medium" style={{ color: 'var(--m-muted)' }}>/100</span>
                        </span>
                      )}
                      <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                        · {b.groups.length} {b.groups.length === 1 ? 'finding' : 'findings'}
                      </span>
                      <CategoryTrustMetaComponent
                        findings={b.groups.map(g => g.primary)}
                        coverageLabel={crawlCoverageLabel}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                        const n = b.counts[sev];
                        if (!n) return null;
                        return (
                          <span
                            key={sev}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.04em]"
                            style={{
                              background: `color-mix(in srgb, ${severityColor(sev)} 12%, transparent)`,
                              color: severityColor(sev),
                            }}
                          >
                            {n} {sev}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <span className="text-[var(--m-muted)] flex-shrink-0" aria-hidden>
                    {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </span>
                </button>

                {!isCollapsed && (
                  <ul style={{ borderTop: tint ? `1px solid ${tint.border}` : '1px solid var(--rule)', background: 'var(--card)' }}>
                    {b.groups.map((g) => {
                      const f = g.primary;
                      const host = hostOf(f.page_url);
                      const moduleNames = g.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
                      const multiModule = moduleNames.length > 1;
                      const isExpanded = !!expanded[f.id];
                      return (
                        <li
                          key={f.id}
                          style={{
                            // Expanded cards get a clear visual break from the
                            // next card: tinted background, severity accent bar,
                            // and a strong bottom rule (was clashing with the
                            // card below when open).
                            borderBottom: isExpanded ? '2px solid var(--ink-2)' : '1px solid var(--rule)',
                            borderLeft: isExpanded ? `3px solid ${severityColor(f.severity)}` : '3px solid transparent',
                            background: isExpanded ? 'color-mix(in srgb, var(--ink) 2.5%, transparent)' : undefined,
                          }}
                        >
                          <div
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-black/[0.02] transition-colors"
                            data-testid="find-row"
                          >
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: severityColor(f.severity) }}
                              aria-hidden
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-medium leading-snug tracking-normal" style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: 500, letterSpacing: '0' }}>
                                {getDisplayTitle(f)}
                              </p>
                              <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--m-muted)' }}>
                                <span className="font-semibold" style={{ color: severityColor(f.severity) }}>
                                  {severityLabel(f.severity)}
                                </span>
                                <span aria-hidden>·</span>
                                <FindingEvidenceBadge finding={f} />
                                <FindingSourceLabel finding={f} />
                                <FindingSurfaceScope finding={f} />
                                {multiModule && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>Affects {moduleNames.length} modules</span>
                                  </>
                                )}
                                {g.isConsolidated && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span>{g.members.length} similar</span>
                                  </>
                                )}
                                {host && (
                                  <>
                                    <span aria-hidden>·</span>
                                    <span className="inline-flex items-center gap-1 truncate max-w-[280px]">
                                      <ExternalLink size={9} />
                                      {host}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {(() => {
                                const label = fixTypeLabel(f);
                                return label ? (
                                  <span
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                    style={{
                                      color: label.console ? 'var(--ink-2)' : 'var(--m-muted)',
                                      background: label.console ? 'color-mix(in srgb, var(--signal) 10%, transparent)' : 'var(--paper-2)',
                                    }}
                                  >
                                    {label.text}
                                  </span>
                                ) : null;
                              })()}
                              <button
                                type="button"
                                onClick={() => toggleFinding(f.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                                style={{ color: 'var(--ink)', background: isExpanded ? 'var(--paper-2)' : 'transparent', border: '1px solid var(--rule)' }}
                                aria-expanded={isExpanded}
                                title={isExpanded ? 'Collapse' : 'View details'}
                              >
                                <Eye size={12} strokeWidth={1.75} />
                                View
                              </button>
                              <Link
                                href={`${dashPrefix}/fix#finding-${f.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                                style={{ color: 'var(--paper)', background: 'var(--ink)' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Wrench size={11} strokeWidth={1.75} />
                                Fix
                              </Link>
                              <button
                                type="button"
                                onClick={() => toggleFinding(f.id)}
                                className="w-7 h-7 rounded-md inline-flex items-center justify-center transition-colors hover:bg-black/[0.04]"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded
                                  ? <ChevronUp size={16} strokeWidth={2} style={{ color: 'var(--ink)' }} />
                                  : <ChevronDown size={16} strokeWidth={2} style={{ color: 'var(--ink)' }} />}
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="rounded-lg p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5 block" style={{ color: 'var(--ink-2)' }}>What we found</span>
                                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                                  <FindingText text={getWhatFound(f)} />
                                </div>
                              </div>
                              <div className="rounded-lg p-3" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5 block" style={{ color: 'var(--ink-2)' }}>Why it matters</span>
                                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                                  <FindingText text={getWhyMatters(f) || 'Resolving this issue improves your overall site quality.'} />
                                </div>
                              </div>
                              <div className="rounded-lg p-3 col-span-full" style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5 block" style={{ color: 'var(--ink-2)' }}>Recommendation</span>
                                <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                                  <FindingText text={getFixPlain(f)} />
                                </div>
                              </div>
                              {/* Technical note — always visible, right under the
                                  recommendation, green background (was a dropdown) */}
                              {hasCommunication(f) && getTechnicalNote(f) && (
                                <div
                                  className="rounded-lg p-3 col-span-full"
                                  style={{
                                    background: 'color-mix(in srgb, var(--ok) 8%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)',
                                  }}
                                >
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5 block" style={{ color: 'var(--ok)' }}>Technical note</span>
                                  <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                                    <FindingText text={getTechnicalNote(f)!} />
                                  </div>
                                </div>
                              )}
                              {hasCommunication(f) && getFixTechnical(f) && (
                                <div
                                  className="rounded-lg p-3 col-span-full"
                                  style={{
                                    background: 'color-mix(in srgb, var(--ok) 8%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)',
                                  }}
                                >
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-1.5 block" style={{ color: 'var(--ok)' }}>Technical fix</span>
                                  <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                                    <FindingText text={getFixTechnical(f)!} />
                                  </div>
                                </div>
                              )}
                              {/* Evidence row — pill style for visibility */}
                              <div className="col-span-full">
                                <FindingEvidencePanel finding={f} />
                              </div>
                              {/* "Open in fix console" removed — it clashed with the
                                  next finding's CTAs; the Fix button in the card
                                  header is the single fix entry point. */}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ))}

      {/* ── Strategic observations tab ───────────────────────────── */}
      {activeTab === 'strategic' && strategicFindings.length === 0 && (
        <DashCard className="text-center" padding="lg">
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            No strategic observations
          </p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            This audit found no broader design or strategy issues. All findings are actionable in the Fix console.
          </p>
        </DashCard>
      )}
      {activeTab === 'strategic' && strategicFindings.length > 0 && (
        <div>
          <p className="text-[12px] mb-3" style={{ color: 'var(--m-muted)' }}>
            Broader insights that require strategy, redesign, or judgment — not console-fixable.
          </p>
          <DashCard padding="none" className="overflow-hidden">
            <ul>
              {strategicFindings.map((f, i) => {
                const host = hostOf(f.page_url);
                return (
                  <li
                    key={f.id}
                    style={{ borderBottom: i < strategicFindings.length - 1 ? '1px solid var(--rule)' : 'none' }}
                  >
                    <div className="px-4 py-3 flex items-start gap-3">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: severityColor(f.severity) }}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[14px] font-medium leading-snug tracking-normal"
                          style={{ color: 'var(--ink)' }}
                        >
                          {getDisplayTitle(f)}
                        </p>
                        {/* WCAG AA: body text uses ink-2 (m-muted was too light for paragraph text) */}
                        <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                          {getWhatFound(f)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--m-muted)' }}>
                          <span className="font-semibold" style={{ color: severityColor(f.severity) }}>
                            {severityLabel(f.severity)}
                          </span>
                          <span aria-hidden>·</span>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              background: 'color-mix(in srgb, var(--signal) 10%, transparent)',
                              color: 'var(--signal)',
                            }}
                          >
                            Strategic
                          </span>
                          {host && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="inline-flex items-center gap-1 truncate max-w-[280px]">
                                <ExternalLink size={9} />
                                {host}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </DashCard>
        </div>
      )}
    </div>
  );
}

export default function FindPage() {
  return (
    <Suspense
      fallback={
        <div>
          <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
          <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        </div>
      }
    >
      <FindPageInner />
    </Suspense>
  );
}
