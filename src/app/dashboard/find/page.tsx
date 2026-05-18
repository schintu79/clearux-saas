'use client';

/**
 * Find — Ranked list of open issues. Quick filters as chips,
 * search bar, and links into the Fix page for each finding.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Search, AlertTriangle, X, ExternalLink } from 'lucide-react';
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

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;

function FindFilterDropdown({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: { value: string; label: string }[] }) {
  const isActive = value !== 'all';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[12px] font-medium pl-3 pr-7 py-2 rounded-lg outline-none cursor-pointer appearance-none"
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

export default function FindPage() {
  const { user, loading: authLoading } = useAuth();
  const { selection, ready } = useBrandSelection();
  const [bundle, setBundle] = useState<LatestAuditBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
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

  const moduleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) {
      const m = moduleNameForFinding(f);
      c[m] = (c[m] || 0) + 1;
    }
    return c;
  }, [findings]);

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
        <div className="h-7 w-24 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-4 w-72 rounded-md animate-pulse mb-6" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-0">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[56px] animate-pulse" style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--rule)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!bundle?.audit) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Find</h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            {selection ? 'No audit for this brand yet.' : 'Run an audit to surface issues.'}
          </p>
        </div>
        <EmptyAudit
          title="No findings yet"
          body="Run your first audit and we will rank every issue by severity and module."
        />
      </div>
    );
  }

  const hasFilters = moduleFilter !== 'all' || sevFilter !== 'all' || query;

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Find</h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
          What is hurting your score, ranked by severity. For the full breakdown,{' '}
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

      {/* ── Filter bar: search + 2 dropdowns ── */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
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

        {/* Severity dropdown */}
        <FindFilterDropdown
          value={sevFilter}
          onChange={setSevFilter}
          label="Severity"
          options={[
            { value: 'all', label: 'All severities' },
            ...SEVERITY_ORDER.map(s => ({
              value: s,
              label: `${severityLabel(s)} (${findings.filter(f => f.severity === s).length})`,
            })),
          ]}
        />

        {/* Module dropdown */}
        <FindFilterDropdown
          value={moduleFilter}
          onChange={setModuleFilter}
          label="Module"
          options={[
            { value: 'all', label: 'All modules' },
            ...PHASE1_MODULES.filter(m => moduleCounts[m]).map(m => ({
              value: m,
              label: `${m} (${moduleCounts[m]})`,
            })),
          ]}
        />

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => { setModuleFilter('all'); setSevFilter('all'); setQuery(''); }}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-all hover:bg-paper-2"
            style={{ color: 'var(--m-muted)' }}
          >
            <X size={10} /> Clear
          </button>
        )}
      </div>

      {/* ── Count ── */}
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
          {filtered.length === findings.length ? `${findings.length} open` : `${filtered.length} of ${findings.length} open`}
        </span>
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          {findings.length === 0 ? (
            <>
              <AlertTriangle size={20} style={{ color: 'var(--ok)' }} className="mx-auto mb-3" />
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                Nothing is currently hurting your score
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--m-muted)' }}>Run a re-audit to confirm.</p>
              <Link
                href="/dashboard/new-audit"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: 'var(--ink)', color: 'var(--paper)' }}
              >
                Run re-audit <ArrowRight size={12} />
              </Link>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>No findings match these filters</p>
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
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          {filtered.map((f) => (
            <Link
              key={f.id}
              href={`/dashboard/fix#finding-${f.id}`}
              className="flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors hover:bg-paper-2/40"
              style={{ borderBottom: '1px solid var(--rule)' }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: severityColor(f.severity) }}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold leading-snug truncate" style={{ color: 'var(--ink)' }}>
                  {f.title}
                </p>
                <div className="flex items-center gap-x-2 mt-0.5 text-[11px]" style={{ color: 'var(--m-muted)' }}>
                  <span className="font-semibold" style={{ color: severityColor(f.severity) }}>{severityLabel(f.severity)}</span>
                  <span style={{ color: 'var(--rule)' }}>|</span>
                  <span>{moduleNameForFinding(f)}</span>
                  {f.page_url && (
                    <>
                      <span style={{ color: 'var(--rule)' }}>|</span>
                      <span className="truncate max-w-[200px]">
                        {(() => { try { return new URL(f.page_url).pathname || '/'; } catch { return f.page_url; } })()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight size={13} className="flex-shrink-0" style={{ color: 'var(--m-muted)' }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
