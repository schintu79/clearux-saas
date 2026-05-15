'use client';

/**
 * CategoryChips — horizontal row of clickable module chips with score + count.
 *
 * Pure presentation. Clicking a chip toggles a module filter on the parent
 * (which then filters the Findings tab + scrolls into it). The active chip
 * highlights, others dim — matching the cockpit interaction model.
 */

import React from 'react';
import type { ModuleScore } from './AuditCockpit';

export interface CategoryChipsProps {
  modules: ModuleScore[];
  findingCountByModule: Record<number, number>;
  activeModuleIndex?: number | null;
  onModuleClick?: (moduleIndex: number) => void;
  /** Optional clear-filter callback (rendered only when activeModuleIndex != null). */
  onClear?: () => void;
}

function scoreColor(s: number) {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

const CategoryChips: React.FC<CategoryChipsProps> = ({
  modules,
  findingCountByModule,
  activeModuleIndex,
  onModuleClick,
  onClear,
}) => {
  if (modules.length === 0) return null;

  return (
    <div
      className="mb-6 rounded-xl bg-card overflow-hidden"
      style={{ border: '1px solid var(--rule)' }}
      data-testid="category-chips"
    >
      <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-rule/40 flex-wrap">
        <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-m-muted">
          Jump by category
        </p>
        {activeModuleIndex != null && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-medium text-signal hover:underline"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="p-3 flex flex-wrap gap-2">
        {modules.map((m) => {
          const isActive = activeModuleIndex === m.index;
          const isDimmed = activeModuleIndex != null && !isActive;
          const count = findingCountByModule[m.index] || 0;
          const disabled = !m.audited;
          return (
            <button
              key={m.index}
              type="button"
              disabled={disabled}
              onClick={() => onModuleClick?.(m.index)}
              data-testid={`category-chip-${m.index}`}
              aria-pressed={isActive}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-all hover:translate-y-[-1px] disabled:hover:translate-y-0"
              style={{
                background: isActive
                  ? `color-mix(in srgb, ${m.dot} 14%, transparent)`
                  : 'var(--paper-2)',
                border: `1px solid ${isActive ? m.dot : 'var(--rule)'}`,
                opacity: disabled ? 0.4 : isDimmed ? 0.55 : 1,
                cursor: disabled ? 'default' : 'pointer',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: m.dot }}
              />
              <span className="text-[12px] font-medium text-ink">{m.name}</span>
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ color: m.audited ? scoreColor(m.score) : 'var(--m-muted)' }}
              >
                {m.audited ? m.score : '--'}
              </span>
              {m.audited && count > 0 && (
                <span
                  className="text-[10px] font-semibold tracking-[0.04em] uppercase px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--card)',
                    color: 'var(--m-muted)',
                    border: '1px solid var(--rule)',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryChips;
