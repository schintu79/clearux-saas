'use client';

/**
 * Find — selected brand only. Ranked list of open issues with the
 * minimum fields needed to pick what to fix: title, severity, module,
 * page (when relevant). Search + module + severity filters.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Search, AlertTriangle } from 'lucide-react';
import {
  loadLatestAuditBundle,
  rankFindings,
  severityColor,
  severityLabel,
  moduleNameForFinding,
  PHASE1_MODULES,
  type LatestAuditBundle,
} from '@/lib/dashboard/latest-audit';
import { useBrandSelection } from '@/lib/dashboard/useBrandSelection';
import EmptyAudit from '@/components/dashboard/v2/EmptyAudit';

const SEVERITIES: Array<'all' | 'critical' | 'high' | 'medium' | 'low'> = ['all', 'critical', 'high', 'medium', 'low'];

export default function FindPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<typeof SEVERITIES[number]>('all');
  const [query, setQuery] = useState('');

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

  const findings = useMemo(() => {
    if (!bundle) return [];
    const open = bundle.findings.filter((f) => f.status === 'open' || f.status === 'in_progress');
    return rankFindings(open);
  }, [bundle]);

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (moduleFilter !== 'all' && moduleNameForFinding(f) !== moduleFilter) return false;
      if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${f.title} ${f.description} ${f.page_url || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [findings, moduleFilter, sevFilter, query]);

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
          What is hurting your score, ranked by severity. For per-page AI readability, mobile checks, and the full breakdown,{' '}
          <Link
            href={`/dashboard/audits/${bundle.audit.id}`}
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: 'var(--signal)' }}
          >
            open the audit detail
          </Link>
          .
        </p>
      </div>

      {/* Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 mb-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
          <input
            type="search"
            placeholder="Search findings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
            aria-label="Search findings"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          aria-label="Filter by module"
        >
          <option value="all">All modules</option>
          {PHASE1_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          aria-label="Filter by severity"
        >
          {SEVERITIES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All severities' : severityLabel(s)}</option>)}
        </select>
      </div>

      <div className="mb-2 text-[12px]" style={{ color: 'var(--m-muted)' }}>
        {filtered.length} of {findings.length} open
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
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                No findings match these filters
              </p>
              <button
                onClick={() => { setModuleFilter('all'); setSevFilter('all'); setQuery(''); }}
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
                className="block rounded-xl px-4 py-3 transition-all hover:shadow-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
                data-testid="find-row"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: severityColor(f.severity) }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: 'var(--ink)' }}>
                      {f.title}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
                      <span className="font-semibold" style={{ color: severityColor(f.severity) }}>{severityLabel(f.severity)}</span>
                      <span className="mx-1.5">·</span>
                      <span>{moduleNameForFinding(f)}</span>
                      {f.page_url && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span className="truncate inline-block max-w-[280px] align-bottom">{f.page_url}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <ArrowRight size={13} className="flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
