'use client';

/**
 * Find — diagnostic discovery view. The "what is wrong" inventory,
 * grouped by module, with severity at a glance. Heavy filtering and
 * remediation copy live on Fix; Find stays minimal so users can
 * understand the audit before they triage it.
 *
 * Each row links straight to the corresponding card on Fix.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import {
  loadLatestAuditBundle,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  moduleIndexForFinding,
  MODULE_TINTS,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';
import PriorityRecommendations, { derivePriorityRecs } from '@/components/dashboard/v2/PriorityRecommendations';
import { groupFindingsForDisplay, type GroupedFinding } from '@/lib/audit-findings-presentation';
import type { AuditFinding } from '@/types/database';

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

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

export default function FindPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

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

  const buckets = useMemo<ModuleBucket[]>(() => {
    if (!bundle) return [];
    const open = bundle.findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
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

  const totalOpen = useMemo(() => buckets.reduce((acc, b) => acc + b.groups.length, 0), [buckets]);

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
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[72px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
        </div>
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Find</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What the audit found, grouped by module so you can see where the work sits. Head to{' '}
          <Link href="/dashboard/fix" className="font-medium underline-offset-2 hover:underline" style={{ color: 'var(--signal)' }}>
            Fix
          </Link>{' '}
          to triage, filter, and track status — or{' '}
          <Link href={`/dashboard/audits/${bundle.audit.id}`} className="font-medium underline-offset-2 hover:underline" style={{ color: 'var(--signal)' }}>
            open the audit detail
          </Link>{' '}
          for evidence and per-page data.
        </p>
      </div>

      {priorityRecs.length > 0 && bundle?.audit && (
        <div className="mb-4">
          <PriorityRecommendations
            recs={priorityRecs}
            findings={openFindings}
            auditId={bundle.audit.id}
          />
        </div>
      )}

      {totalOpen === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="find-empty"
        >
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            Nothing is currently hurting your score
          </p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Run a re-audit to confirm.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Run re-audit
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {buckets.map((b) => {
            const tint = b.index >= 0 ? MODULE_TINTS[b.index] : null;
            const isCollapsed = !!collapsed[b.index];
            return (
              <section
                key={b.index}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                data-testid="find-module-bucket"
              >
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [b.index]: !c[b.index] }))}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[color:var(--paper-2)]/40 transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: tint?.dot || 'var(--m-muted)' }}
                    aria-hidden
                  />
                  <h2 className="text-[14px] font-semibold flex-shrink-0" style={{ color: 'var(--ink)' }}>{b.name}</h2>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                      const n = b.counts[sev];
                      if (!n) return null;
                      return (
                        <span
                          key={sev}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-[0.04em]"
                          style={{
                            background: `color-mix(in srgb, ${severityColor(sev)} 10%, transparent)`,
                            color: severityColor(sev),
                          }}
                        >
                          {n} {sev}
                        </span>
                      );
                    })}
                  </div>
                  <span className="ml-auto text-[12px] tabular-nums" style={{ color: 'var(--m-muted)' }}>
                    {b.groups.length} {b.groups.length === 1 ? 'issue' : 'issues'}
                  </span>
                  <span className="text-[var(--m-muted)]" aria-hidden>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </span>
                </button>

                {!isCollapsed && (
                  <ul style={{ borderTop: '1px solid var(--rule)' }}>
                    {b.groups.map((g) => {
                      const f = g.primary;
                      const host = hostnameOf(f.page_url);
                      const moduleNames = g.affectedModuleIndices.filter((i) => i >= 0).map((i) => PHASE1_MODULES[i]);
                      const multiModule = moduleNames.length > 1;
                      return (
                        <li key={f.id} style={{ borderBottom: '1px solid var(--rule)' }}>
                          <Link
                            href={`/dashboard/fix#finding-${f.id}`}
                            className="block px-4 py-3 transition-colors hover:bg-[color:var(--paper-2)]/40"
                            data-testid="find-row"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                                style={{ background: severityColor(f.severity) }}
                                aria-hidden
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium leading-snug" style={{ color: 'var(--ink)' }}>
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
                              <ArrowRight size={13} className="flex-shrink-0 mt-1" style={{ color: 'var(--m-muted)' }} />
                            </div>
                          </Link>
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
    </div>
  );
}
