'use client';

/**
 * FixQueue — prioritized "ship these first" list.
 *
 * Pure presentation. Takes already-ranked findings and renders a compact,
 * scannable cockpit list with severity dot, title, module, page, and a
 * non-mutating "Copy recommendation" action. Clicking the row navigates the
 * caller (via onSelect) — typically to scroll to the full finding card.
 *
 * Ranking happens in the parent (severity weight × evidence × business
 * signals) to keep this component free of audit-engine assumptions.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  ListChecks,
} from 'lucide-react';
import type { AuditFinding } from '@/types/database';

export interface RankedFinding {
  finding: AuditFinding;
  moduleName?: string;
  moduleDot?: string;
  priorityLabel: 'Now' | 'Next' | 'Later';
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--severe)',
  high:     'var(--warn)',
  medium:   'var(--signal)',
  low:      'var(--ok)',
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: 'var(--m-muted)', bg: 'var(--paper-2)' },
  in_progress: { label: 'In progress', color: 'var(--warn)',    bg: 'color-mix(in srgb, var(--warn) 8%, transparent)' },
  fixed:       { label: 'Fixed',       color: 'var(--ok)',      bg: 'color-mix(in srgb, var(--ok) 8%, transparent)' },
  backlog:     { label: 'Backlog',     color: 'var(--signal)',  bg: 'color-mix(in srgb, var(--signal) 8%, transparent)' },
};

const PRIORITY_META: Record<RankedFinding['priorityLabel'], { color: string; bg: string }> = {
  Now:   { color: 'var(--severe)', bg: 'color-mix(in srgb, var(--severe) 10%, transparent)' },
  Next:  { color: 'var(--warn)',   bg: 'color-mix(in srgb, var(--warn) 10%, transparent)' },
  Later: { color: 'var(--m-muted)', bg: 'var(--paper-2)' },
};

interface FixQueueProps {
  items: RankedFinding[];
  total: number;
  onSelect?: (findingId: string) => void;
  emptyMessage?: string;
}

function pageHostPath(url?: string | null) {
  if (!url) return '';
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return u.hostname + (path === '/' ? '' : path);
  } catch {
    return url;
  }
}

const FixQueue: React.FC<FixQueueProps> = ({ items, total, onSelect, emptyMessage }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  };

  return (
    <div
      className="mb-6 rounded-xl overflow-hidden bg-card"
      style={{ border: '1px solid var(--rule)' }}
      data-testid="fix-queue"
    >
      <div className="px-5 py-4 border-b border-rule/40 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--severe) 10%, transparent)' }}>
          <ListChecks size={13} style={{ color: 'var(--severe)' }} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink">Prioritized fix queue</p>
          <p className="text-[11px] text-m-muted">Top {items.length} of {total} — ranked by severity and evidence strength.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-m-muted">
            {emptyMessage || 'No findings to prioritize.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-rule/40">
          {items.map(({ finding, moduleName, moduleDot, priorityLabel }, idx) => {
            const sevColor = SEVERITY_COLOR[finding.severity] || 'var(--m-muted)';
            const status = STATUS_LABEL[finding.status] || STATUS_LABEL.open;
            const prio = PRIORITY_META[priorityLabel];
            const isCopied = copiedId === finding.id;
            const isDismissed = finding.dismissed;

            return (
              <li
                key={finding.id}
                className="group transition-colors hover:bg-paper-2/40"
                style={{ opacity: isDismissed ? 0.5 : 1 }}
              >
                <div className="px-5 py-3 flex items-start gap-3">
                  <span
                    className="flex-shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums"
                    style={{ background: 'var(--paper-2)', color: 'var(--m-muted)' }}
                  >
                    {idx + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => onSelect?.(finding.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded-full"
                        style={{ color: prio.color, background: prio.bg }}
                      >
                        {priorityLabel === 'Now' && <AlertTriangle size={9} />}
                        {priorityLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ color: sevColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor }} />
                        {finding.severity}
                      </span>
                      {moduleName && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-m-muted">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: moduleDot || 'var(--m-muted)' }} />
                          {moduleName}
                        </span>
                      )}
                    </div>

                    <p className="text-[13px] font-medium text-ink leading-snug line-clamp-2">
                      {finding.title}
                    </p>

                    {finding.page_url && (
                      <p className="text-[11px] text-m-muted mt-0.5 inline-flex items-center gap-1 max-w-full truncate">
                        <ExternalLink size={9} className="flex-shrink-0" />
                        <span className="truncate">{pageHostPath(finding.page_url)}</span>
                      </p>
                    )}
                  </button>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span
                      className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.03em] uppercase px-2 py-1 rounded-full"
                      style={{ color: status.color, background: status.bg }}
                    >
                      {status.label}
                    </span>
                    {finding.recommendation && (
                      <button
                        type="button"
                        onClick={() => handleCopy(finding.id, finding.recommendation)}
                        title="Copy recommendation"
                        className="p-1.5 rounded-md text-m-muted hover:text-ink hover:bg-paper-2 transition-colors"
                      >
                        {isCopied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelect?.(finding.id)}
                      className="p-1.5 rounded-md text-m-muted hover:text-ink hover:bg-paper-2 transition-colors"
                      title="Jump to finding"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default FixQueue;
