'use client';

/**
 * Find — answers "What is hurting my score?"
 *
 * Ranked finding list with filters (module, severity, fix effort) and
 * helpful empty states. Read-only summary; the Fix tab is where users
 * act on findings.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Filter, Search, AlertTriangle } from 'lucide-react';
import {
  loadLatestAuditBundle,
  rankFindings,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  fixEffort,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';

const SEVERITIES: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> = ['all', 'critical', 'high', 'medium', 'low'];
const EFFORTS: Array<'all' | 'Quick win' | 'Standard' | 'Complex'> = ['all', 'Quick win', 'Standard', 'Complex'];

export default function FindPage() {
  const { user, loading: authLoading } = useAuth();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<typeof SEVERITIES[number]>('all');
  const [effortFilter, setEffortFilter] = useState<typeof EFFORTS[number]>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    loadLatestAuditBundle(user.id)
      .then(setBundle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  const findings = useMemo(() => {
    if (!bundle) return [];
    const open = bundle.findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
    return rankFindings(open);
  }, [bundle]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (moduleFilter !== 'all' && moduleNameForFinding(f) !== moduleFilter) return false;
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (effortFilter !== 'all' && fixEffort(f) !== effortFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${f.title} ${f.description} ${f.page_url || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [findings, moduleFilter, sevFilter, effortFilter, query]);

  if (authLoading || loading) {
    return (
      <div>
        <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-80 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-[88px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}
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
            What is hurting your score? Run an audit to find out.
          </p>
        </div>
        <EmptyAudit
          title="No findings yet"
          body="Run your first audit and ClearUX will rank every issue by severity, module, and fix effort."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Find</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What is hurting your score, ranked by severity and impact.
        </p>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 mb-4 flex flex-col gap-3"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="flex items-center gap-2">
          <Filter size={13} style={{ color: 'var(--m-muted)' }} />
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
            Filter findings
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
            <input
              type="search"
              placeholder="Search findings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Search findings"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            aria-label="Filter by module"
          >
            <option value="all">All modules</option>
            {PHASE1_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={sevFilter}
            onChange={(e) => setSevFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            aria-label="Filter by severity"
          >
            {SEVERITIES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All severities' : severityLabel(s)}</option>)}
          </select>
          <select
            value={effortFilter}
            onChange={(e) => setEffortFilter(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            aria-label="Filter by fix effort"
          >
            {EFFORTS.map((e) => <option key={e} value={e}>{e === 'all' ? 'All effort' : e}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-[12px]" style={{ color: 'var(--m-muted)' }}>
        <span>
          Showing {filtered.length} of {findings.length} open finding{findings.length === 1 ? '' : 's'}
        </span>
        <Link href="/dashboard/fix" className="font-medium" style={{ color: 'var(--signal)' }}>
          Go to Fix →
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="find-empty"
        >
          {findings.length === 0 ? (
            <>
              <AlertTriangle size={20} style={{ color: 'var(--ok)' }} className="mx-auto mb-3" />
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                Nothing is currently hurting your score
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
                Every open finding is resolved. Run a re-audit to confirm.
              </p>
              <Link
                href="/dashboard/new-audit"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Run re-audit
                <ArrowRight size={12} />
              </Link>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                No findings match these filters
              </p>
              <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
                Clear a filter to see more results.
              </p>
              <button
                onClick={() => { setModuleFilter('all'); setSevFilter('all'); setEffortFilter('all'); setQuery(''); }}
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((f) => (
            <li key={f.id}>
              <Link
                href={`/dashboard/fix#finding-${f.id}`}
                className="block rounded-xl p-4 transition-all hover:shadow-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                data-testid="find-row"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: severityColor(f.severity) }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                      {f.title}
                    </p>
                    <p className="text-[12px] mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--m-muted)' }}>
                      {f.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]" style={{ color: 'var(--m-muted)' }}>
                      <span className="font-semibold" style={{ color: severityColor(f.severity) }}>
                        {severityLabel(f.severity)}
                      </span>
                      <span>{moduleNameForFinding(f)}</span>
                      <span>{fixEffort(f)}</span>
                      {f.page_url && <span className="truncate">{f.page_url}</span>}
                    </div>
                  </div>
                  <ArrowRight size={13} className="flex-shrink-0 mt-1" style={{ color: 'var(--m-muted)' }} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
