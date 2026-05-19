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
 *  - Each row links straight to the corresponding card on Fix.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Wrench,
  Scale,
  Heart,
  Accessibility,
  Brain,
  FileSearch,
  Eye,
  Lightbulb,
  X,
} from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  moduleIndexForFinding,
  MODULE_TINTS,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PriorityRecommendations, { derivePriorityRecs } from '@/components/dashboard/v2/PriorityRecommendations';
import OverviewBreadcrumb from '@/components/dashboard/OverviewBreadcrumb';
import { groupFindingsForDisplay, type GroupedFinding } from '@/lib/audit-findings-presentation';

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEVERITIES: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> = ['all', 'critical', 'high', 'medium', 'low'];

// Module-aligned icons. Order must match PHASE1_MODULES in latest-audit.ts.
const MODULE_ICONS: React.ElementType[] = [Scale, Heart, Accessibility, Brain, FileSearch, Eye];

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

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
  const isActive = value !== 'all';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[12px] font-medium pl-3 pr-7 py-1.5 rounded-md outline-none cursor-pointer appearance-none focus-visible:ring-2 focus-visible:ring-signal/30"
      style={{
        background: isActive ? 'var(--ink)' : 'var(--card)',
        color: isActive ? 'var(--paper)' : 'var(--ink)',
        border: `1px solid ${isActive ? 'var(--ink)' : 'var(--rule)'}`,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='${isActive ? '%23fff' : '%23999'}' stroke-width='1.5'%3E%3Cpath d='M3 4.5L6 7.5l3-3'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
      }}
      aria-label={label}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function FindPageInner() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const searchParams = useSearchParams();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  // Module filter — chip-driven, with URL hydration on first mount so the
  // category-card deep links from Overview keep working.
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<typeof SEVERITIES[number]>('all');

  useEffect(() => {
    const m = searchParams.get('module');
    if (m && (PHASE1_MODULES as readonly string[]).includes(m)) {
      setModuleFilter(m);
    }
    const sev = searchParams.get('severity');
    if (sev && (SEVERITIES as readonly string[]).includes(sev)) {
      setSevFilter(sev as typeof SEVERITIES[number]);
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading || !user || !ready) {
      if (!authLoading) setLoading(false);
      return;
    }
    setLoading(true);
    loadLatestAuditBundle(user.id, selection)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user, ready, selection]);

  // Strategic observations — shown in a separate section below fixable findings
  const strategicFindings = useMemo(() => {
    if (!bundle) return [];
    return bundle.findings.filter(
      (f) => (f as any).finding_type === 'strategic' && f.status !== 'fixed' && !f.dismissed,
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

  // Per-module aggregate score, used as the at-a-glance number on each
  // bucket header. Mirrors the Overview category cards.
  const moduleScores = useMemo<Record<string, number>>(() => {
    const rawJson = (bundle?.report?.raw_json || null) as any;
    if (!rawJson?.categoryScores || !Array.isArray(rawJson.categoryScores)) return {};
    const out: Record<string, number> = {};
    for (let i = 0; i < PHASE1_MODULES.length; i++) {
      const cats = rawJson.categoryScores.filter((_: any, idx: number) => Math.floor(idx / 4) === i);
      if (cats.length > 0) {
        out[PHASE1_MODULES[i]] = Math.round(cats.reduce((s: number, c: any) => s + (c.score || 0), 0) / cats.length);
      }
    }
    return out;
  }, [bundle]);

  const visibleBuckets = useMemo<ModuleBucket[]>(() => {
    let bs = buckets;
    if (moduleFilter !== 'all') bs = bs.filter((b) => b.name === moduleFilter);
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

  const openFindings = useMemo(
    () => (bundle?.findings ?? []).filter((f) => f.status !== 'fixed' && !f.dismissed),
    [bundle],
  );
  const priorityRecs = useMemo(
    () => derivePriorityRecs(bundle?.report ?? null, openFindings),
    [bundle, openFindings],
  );

  if (authLoading || loading || !ready) {
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
        <div className="mb-6">
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Find</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection ? 'No audit for this brand yet.' : 'Run an audit to surface issues.'}
          </p>
        </div>
        <EmptyAudit
          title="No findings yet"
          body="Run your first audit and Fixpath will rank every issue by severity and module."
        />
      </div>
    );
  }

  const hasActive = moduleFilter !== 'all' || sevFilter !== 'all';

  return (
    <div>
      <OverviewBreadcrumb current="Find" />
      <div className="mb-5">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Find</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What the audit found, grouped by module so you can see where the work sits. Click{' '}
          <span className="inline-flex items-center gap-0.5 font-medium" style={{ color: 'var(--signal)' }}>
            <Wrench size={11} /> Fix
          </span>{' '}
          on any finding to open it inside the Fix workspace.
        </p>
      </div>

      {priorityRecs.length > 0 && bundle?.audit && moduleFilter === 'all' && sevFilter === 'all' && (
        <div className="mb-4">
          <PriorityRecommendations
            recs={priorityRecs}
            findings={openFindings}
            auditId={bundle.audit.id}
          />
        </div>
      )}

      {/* Filter rail — Severity + Module as compact dropdowns, aligned with Fix */}
      <div className="mb-4">
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
      </div>

      {totalOpen === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="find-empty"
        >
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            {hasActive ? 'No findings match these filters' : 'Nothing is currently hurting your score'}
          </p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            {hasActive ? 'Try clearing the filters or run a re-audit.' : 'Run a re-audit to confirm.'}
          </p>
          {hasActive ? (
            <button
              onClick={() => { setModuleFilter('all'); setSevFilter('all'); }}
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-md text-[13px] font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              Clear filters
              <ArrowRight size={12} />
            </button>
          ) : (
            <Link
              href="/dashboard/new-audit"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-md text-[13px] font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              Run re-audit
              <ArrowRight size={12} />
            </Link>
          )}
        </div>
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
                      const host = hostnameOf(f.page_url);
                      const moduleNames = g.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
                      const multiModule = moduleNames.length > 1;
                      return (
                        <li key={f.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                          <div className="px-4 py-3 flex items-start gap-3" data-testid="find-row">
                            <span
                              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                              style={{ background: severityColor(f.severity) }}
                              aria-hidden
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-medium leading-snug tracking-normal" style={{ color: 'var(--ink)', fontSize: '14px', fontWeight: 500, letterSpacing: '0' }}>
                                {f.title}
                              </p>
                              <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]" style={{ color: 'var(--m-muted)' }}>
                                <span className="font-semibold" style={{ color: severityColor(f.severity) }}>
                                  {severityLabel(f.severity)}
                                </span>
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
                            <Link
                              href={`/dashboard/fix#finding-${f.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold flex-shrink-0 transition-all hover:opacity-90"
                              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                              data-testid="find-fix-link"
                              aria-label={`Open "${f.title}" in Fix`}
                            >
                              <Wrench size={11} />
                              Fix
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* ── Strategic observations ─────────────────────────────── */}
      {strategicFindings.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--signal) 12%, transparent)' }}
            >
              <Lightbulb size={14} style={{ color: 'var(--signal)' }} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                Strategic observations
              </h2>
              <p className="text-[11.5px]" style={{ color: 'var(--m-muted)' }}>
                Broader insights that require strategy, redesign, or judgment — not console-fixable.
              </p>
            </div>
          </div>

          <div
            className="rounded-lg overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <ul>
              {strategicFindings.map((f, i) => {
                const host = hostnameOf(f.page_url);
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
                          {f.title}
                        </p>
                        <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--m-muted)' }}>
                          {f.description}
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
          </div>
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
