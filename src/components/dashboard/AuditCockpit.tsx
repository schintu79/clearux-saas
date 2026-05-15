'use client';

/**
 * AuditCockpit — interactive severity + module filter strip.
 *
 * Pure presentation. The overall score / verdict is owned by the hero card at
 * the top of the audit page; this cockpit deliberately does NOT render a
 * second score gauge. It focuses on what users actually need to drill into:
 *   • Severity distribution (clickable, filters Findings tab)
 *   • Per-module score bars (clickable, filters Findings tab)
 *
 * Clicking a severity or module bar calls back to the parent so the page can
 * apply filters or scroll to the relevant section. No data fetching here.
 */

import React from 'react';
import { ShieldCheck, Filter } from 'lucide-react';

export type CockpitSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ModuleScore {
  index: number;
  name: string;
  score: number;
  dot: string; // hex/css color for the module dot
  audited: boolean;
}

interface AuditCockpitProps {
  totalFindings: number;
  activeModuleCount: number;
  totalModuleCount: number;
  severityCounts: Record<CockpitSeverity, number>;
  activeSeverity?: CockpitSeverity | null;
  onSeverityClick?: (sev: CockpitSeverity) => void;
}

const SEVERITY_META: Record<
  CockpitSeverity,
  { label: string; color: string; bg: string }
> = {
  critical: { label: 'Critical', color: 'var(--severe)', bg: 'color-mix(in srgb, var(--severe) 12%, transparent)' },
  high:     { label: 'High',     color: 'var(--warn)',   bg: 'color-mix(in srgb, var(--warn) 12%, transparent)' },
  medium:   { label: 'Medium',   color: 'var(--signal)', bg: 'color-mix(in srgb, var(--signal) 12%, transparent)' },
  low:      { label: 'Low',      color: 'var(--ok)',     bg: 'color-mix(in srgb, var(--ok) 12%, transparent)' },
};

const AuditCockpit: React.FC<AuditCockpitProps> = ({
  totalFindings,
  activeModuleCount,
  totalModuleCount,
  severityCounts,
  activeSeverity,
  onSeverityClick,
}) => {
  const sevTotal =
    severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low;

  return (
    <div
      className="mb-6 rounded-xl overflow-hidden bg-card"
      style={{ border: '1px solid var(--rule)' }}
      data-testid="audit-cockpit"
    >
      <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5 border-b border-rule/40">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
          <Filter size={13} style={{ color: 'var(--signal)' }} />
        </div>
        <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-m-muted">
          Filter findings
        </h3>
        <span className="ml-auto text-[11px] font-medium text-m-muted tracking-[0.03em] uppercase">
          {totalFindings} finding{totalFindings === 1 ? '' : 's'} · {activeModuleCount}
          {totalModuleCount > activeModuleCount ? `/${totalModuleCount}` : ''} module
          {activeModuleCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="px-5 sm:px-6 py-6">
        <div className="space-y-5 min-w-0">
          {/* Severity distribution */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold tracking-[0.04em] uppercase text-m-muted">
                Severity distribution
              </p>
              {activeSeverity && (
                <button
                  onClick={() => onSeverityClick?.(activeSeverity)}
                  className="text-[11px] font-medium text-signal hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>

            {sevTotal === 0 ? (
              <div className="rounded-lg border border-rule/40 px-3 py-3 flex items-center gap-2">
                <ShieldCheck size={13} className="text-ok" />
                <p className="text-[12px] text-ink">No issues detected. Strong result.</p>
              </div>
            ) : (
              <>
                <div
                  className="w-full h-2 rounded-full overflow-hidden flex"
                  style={{ background: 'var(--paper-2)' }}
                  role="img"
                  aria-label="Severity distribution bar"
                >
                  {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                    const count = severityCounts[sev];
                    if (count === 0) return null;
                    const pct = (count / sevTotal) * 100;
                    return (
                      <div
                        key={sev}
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, background: SEVERITY_META[sev].color }}
                        title={`${SEVERITY_META[sev].label}: ${count}`}
                      />
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-3">
                  {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                    const count = severityCounts[sev];
                    const meta = SEVERITY_META[sev];
                    const isActive = activeSeverity === sev;
                    const isDimmed = activeSeverity && !isActive;
                    const disabled = count === 0;
                    return (
                      <button
                        key={sev}
                        type="button"
                        disabled={disabled}
                        onClick={() => onSeverityClick?.(sev)}
                        data-testid={`severity-chip-${sev}`}
                        aria-pressed={isActive}
                        className="text-left rounded-lg px-3 py-2 transition-all hover:translate-y-[-1px] disabled:hover:translate-y-0"
                        style={{
                          background: isActive ? meta.bg : 'var(--paper-2)',
                          border: `1px solid ${isActive ? meta.color : 'var(--rule)'}`,
                          opacity: disabled ? 0.4 : isDimmed ? 0.55 : 1,
                          cursor: disabled ? 'default' : 'pointer',
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span
                            className="text-[10px] font-semibold tracking-[0.04em] uppercase"
                            style={{ color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[18px] font-medium tabular-nums mt-0.5 leading-none text-ink">
                          {count}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Module score bars are intentionally not duplicated here — the
              CategoryChips above this card already render clickable per-module
              scores with finding counts. The cockpit owns severity filtering. */}
        </div>
      </div>
    </div>
  );
};

export default AuditCockpit;
