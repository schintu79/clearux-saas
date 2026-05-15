'use client';

/**
 * AuditCockpit — visual overview card for an audit report.
 *
 * Pure presentation. Receives already-derived numbers (overall score, per-module
 * scores, severity counts, finding totals) and renders:
 *   • An overall score gauge with verdict label
 *   • A severity distribution stacked bar (clickable)
 *   • Per-module score bars (clickable)
 *
 * Clicking a severity or module dot calls back to the parent so the page can
 * apply filters or scroll to the relevant section. No data fetching here.
 */

import React from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';

export type CockpitSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ModuleScore {
  index: number;
  name: string;
  score: number;
  dot: string; // hex/css color for the module dot
  audited: boolean;
}

interface AuditCockpitProps {
  overallScore: number;
  scoreLabel?: string;
  totalFindings: number;
  activeModuleCount: number;
  totalModuleCount: number;
  severityCounts: Record<CockpitSeverity, number>;
  modules: ModuleScore[];
  activeSeverity?: CockpitSeverity | null;
  activeModuleIndex?: number | null;
  onSeverityClick?: (sev: CockpitSeverity) => void;
  onModuleClick?: (moduleIndex: number) => void;
}

function scoreColor(s: number) {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function scoreVerdict(s: number): { label: string; Icon: React.ElementType } {
  if (s >= 80) return { label: 'Strong', Icon: ShieldCheck };
  if (s >= 60) return { label: 'Solid, with room to grow', Icon: Sparkles };
  if (s >= 40) return { label: 'Needs attention', Icon: ShieldAlert };
  return { label: 'Critical gaps', Icon: AlertTriangle };
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
  overallScore,
  scoreLabel,
  totalFindings,
  activeModuleCount,
  totalModuleCount,
  severityCounts,
  modules,
  activeSeverity,
  activeModuleIndex,
  onSeverityClick,
  onModuleClick,
}) => {
  const sevTotal =
    severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low;
  const verdict = scoreVerdict(overallScore);
  const VerdictIcon = verdict.Icon;

  return (
    <div
      className="mb-6 rounded-xl overflow-hidden bg-card"
      style={{ border: '1px solid var(--rule)' }}
      data-testid="audit-cockpit"
    >
      <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center gap-2.5 border-b border-rule/40">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
          <VerdictIcon size={13} style={{ color: 'var(--signal)' }} />
        </div>
        <h3 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-m-muted">
          Audit cockpit
        </h3>
        <span className="ml-auto text-[11px] font-medium text-m-muted tracking-[0.03em] uppercase">
          {totalFindings} finding{totalFindings === 1 ? '' : 's'} · {activeModuleCount}
          {totalModuleCount > activeModuleCount ? `/${totalModuleCount}` : ''} module
          {activeModuleCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6 px-5 sm:px-6 py-6">
        {/* ─ Score gauge ─ */}
        <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:gap-3">
          <ScoreGauge score={overallScore} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.04em] uppercase text-m-muted mb-0.5">
              Overall score
            </p>
            <p className="text-[14px] font-medium text-ink">{verdict.label}</p>
            {scoreLabel && (
              <p className="text-[11px] text-m-muted mt-0.5">{scoreLabel}</p>
            )}
          </div>
        </div>

        {/* ─ Right column: severity + modules ─ */}
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

          {/* Module score bars */}
          {modules.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold tracking-[0.04em] uppercase text-m-muted">
                  Module scores
                </p>
                {activeModuleIndex != null && (
                  <button
                    onClick={() => onModuleClick?.(activeModuleIndex)}
                    className="text-[11px] font-medium text-signal hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {modules.map((m) => {
                  const isActive = activeModuleIndex === m.index;
                  const isDimmed = activeModuleIndex != null && !isActive;
                  return (
                    <button
                      key={m.index}
                      type="button"
                      disabled={!m.audited}
                      onClick={() => onModuleClick?.(m.index)}
                      data-testid={`module-bar-${m.index}`}
                      aria-pressed={isActive}
                      className="w-full text-left rounded-lg px-3 py-2 transition-all hover:bg-paper-2 disabled:hover:bg-transparent"
                      style={{
                        background: isActive ? 'color-mix(in srgb, var(--ink) 4%, transparent)' : 'transparent',
                        border: `1px solid ${isActive ? m.dot : 'transparent'}`,
                        opacity: !m.audited ? 0.35 : isDimmed ? 0.55 : 1,
                        cursor: m.audited ? 'pointer' : 'default',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: m.dot }}
                        />
                        <span className="text-[12px] font-medium text-ink truncate flex-1">
                          {m.name}
                        </span>
                        <span
                          className="text-[12px] font-semibold tabular-nums flex-shrink-0"
                          style={{ color: m.audited ? scoreColor(m.score) : 'var(--m-muted)' }}
                        >
                          {m.audited ? m.score : '--'}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 w-full h-1 rounded-full overflow-hidden"
                        style={{ background: 'var(--paper-2)' }}
                      >
                        {m.audited && (
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(100, m.score))}%`,
                              background: scoreColor(m.score),
                            }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Score gauge — pure SVG, no extra dependencies ── */
function ScoreGauge({ score }: { score: number }) {
  const size = 130;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = scoreColor(score);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--rule)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-sans font-medium leading-none tabular-nums"
          style={{ fontSize: `${size * 0.32}px`, color }}
        >
          {Math.round(score)}
        </span>
        <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-m-muted mt-1">
          / 100
        </span>
      </div>
    </div>
  );
}

export default AuditCockpit;
