'use client';

/**
 * PracticalInsights — three-lane answer card for the audit page.
 *
 * Pure presentation. Replaces the duplicated score gauge / cockpit summary
 * with the three questions a user actually opens the audit to answer:
 *   • What's working
 *   • What's hurting performance
 *   • Fix first
 *
 * The component never invents data. Strengths/risks come from explicit
 * category scores + severity counts of real findings; "Fix first" is the
 * parent's already-grouped queue (severity × evidence, deduped across
 * modules). We label conservatively so we don't over-claim.
 */

import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { strengthLabel, weaknessLabel } from '@/lib/audit-findings-presentation';
import type { ModuleScore } from './AuditCockpit';
import type { AuditFinding } from '@/types/database';

export interface ModuleSeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface GroupedFix {
  /** Primary finding id — used as scroll target on the Findings tab. */
  primaryId: string;
  title: string;
  severity: AuditFinding['severity'];
  /** Module indices this grouped issue spans (deduped). */
  affectedModuleIndices: number[];
}

export interface PracticalInsightsProps {
  modules: ModuleScore[];
  categoryScores: Array<{ name: string; score: number; summary?: string | null }>;
  /** Open + non-fixed findings, grouped/deduped, ranked by severity & evidence. */
  groupedFixes: GroupedFix[];
  /** Severity counts of OPEN findings per module index. */
  moduleSeverityCounts: ModuleSeverityCounts[];
  onModuleClick?: (moduleIndex: number) => void;
  onFixSelect?: (findingId: string) => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--severe)',
  high: 'var(--warn)',
  medium: 'var(--signal)',
  low: 'var(--ok)',
};

function severityColor(sev: string) {
  return SEVERITY_COLOR[sev] || 'var(--m-muted)';
}

function scoreColor(s: number) {
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

interface RiskRow {
  module: ModuleScore;
  /** Reason this module is in the risk lane. */
  reason: 'critical' | 'high' | 'score';
  critical: number;
  high: number;
}

function buildRiskRows(
  modules: ModuleScore[],
  counts: ModuleSeverityCounts[],
): RiskRow[] {
  const audited = modules.filter((m) => m.audited);
  const rows: RiskRow[] = audited.map((m) => {
    const c = counts[m.index] || { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    let reason: RiskRow['reason'] | null = null;
    if (c.critical > 0) reason = 'critical';
    else if (c.high > 0) reason = 'high';
    else if (weaknessLabel(m.score)) reason = 'score';
    return reason ? { module: m, reason, critical: c.critical, high: c.high } : null;
  }).filter((r): r is RiskRow => r !== null);

  // Rank: critical desc → high desc → lower score → total findings desc.
  rows.sort((a, b) => {
    if (a.critical !== b.critical) return b.critical - a.critical;
    if (a.high !== b.high) return b.high - a.high;
    if (a.module.score !== b.module.score) return a.module.score - b.module.score;
    const ta = counts[a.module.index]?.total ?? 0;
    const tb = counts[b.module.index]?.total ?? 0;
    return tb - ta;
  });

  return rows.slice(0, 3);
}

function riskRowLabel(row: RiskRow): { text: string; color: string } {
  if (row.reason === 'critical') {
    return {
      text: `${row.critical} critical`,
      color: 'var(--severe)',
    };
  }
  if (row.reason === 'high') {
    return {
      text: `${row.high} high`,
      color: 'var(--warn)',
    };
  }
  const wl = weaknessLabel(row.module.score) || 'Attention';
  return {
    text: wl,
    color: row.module.score < 40 ? 'var(--severe)' : 'var(--warn)',
  };
}

const PracticalInsights: React.FC<PracticalInsightsProps> = ({
  modules,
  categoryScores: _categoryScores,
  groupedFixes,
  moduleSeverityCounts,
  onModuleClick,
  onFixSelect,
}) => {
  const auditedModules = modules.filter((m) => m.audited);
  const strengths = [...auditedModules]
    .filter((m) => strengthLabel(m.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const risks = buildRiskRows(modules, moduleSeverityCounts);
  const fixes = groupedFixes.slice(0, 3);

  // Conservative fallback: if no category clears the "strong/solid" bar but at
  // least one was audited, surface the highest-scoring module without a
  // strength label so the user still sees a relative bright spot.
  const showStrengthFallback = strengths.length === 0 && auditedModules.length > 0;
  const fallbackStrength = showStrengthFallback
    ? [...auditedModules].sort((a, b) => b.score - a.score)[0]
    : null;

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6"
      data-testid="practical-insights"
    >
      {/* ── Lane 1 — What's working ───────────────────────── */}
      <Lane
        title="What's working"
        accent="var(--ok)"
        Icon={ShieldCheck}
        emptyMessage="No category scored as a clear strength yet."
        isEmpty={strengths.length === 0 && !fallbackStrength}
      >
        {strengths.map((m) => {
          const label = strengthLabel(m.score) || 'Solid';
          return (
            <LaneRow
              key={m.index}
              onClick={onModuleClick ? () => onModuleClick(m.index) : undefined}
              ariaLabel={`Filter findings by ${m.name} (score ${m.score}, ${label.toLowerCase()})`}
              left={
                <>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: m.dot }}
                  />
                  <span className="text-[12px] font-medium text-ink truncate">{m.name}</span>
                </>
              }
              right={
                <>
                  <span
                    className="text-[10px] font-semibold tracking-[0.04em] uppercase"
                    style={{ color: 'var(--ok)' }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[12px] font-semibold tabular-nums"
                    style={{ color: scoreColor(m.score) }}
                  >
                    {m.score}
                  </span>
                </>
              }
            />
          );
        })}
        {fallbackStrength && (
          <LaneRow
            onClick={onModuleClick ? () => onModuleClick(fallbackStrength.index) : undefined}
            ariaLabel={`Filter findings by ${fallbackStrength.name} (highest scoring module, ${fallbackStrength.score})`}
            left={
              <>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: fallbackStrength.dot }}
                />
                <span className="text-[12px] font-medium text-ink truncate">
                  {fallbackStrength.name}
                </span>
              </>
            }
            right={
              <>
                <span className="text-[10px] font-medium text-m-muted tracking-[0.04em] uppercase">
                  Highest
                </span>
                <span
                  className="text-[12px] font-semibold tabular-nums"
                  style={{ color: scoreColor(fallbackStrength.score) }}
                >
                  {fallbackStrength.score}
                </span>
              </>
            }
          />
        )}
      </Lane>

      {/* ── Lane 2 — What's hurting performance ───────────── */}
      <Lane
        title="What's hurting performance"
        accent="var(--warn)"
        Icon={AlertTriangle}
        emptyMessage="No critical or high-severity issues, and no weak category scores."
        isEmpty={risks.length === 0}
      >
        {risks.map((row, idx) => {
          const { text, color } = riskRowLabel(row);
          const m = row.module;
          // Mark the top-ranked module as "Highest risk" when it has critical/high.
          const isTop = idx === 0 && (row.critical > 0 || row.high > 0);
          return (
            <LaneRow
              key={m.index}
              onClick={onModuleClick ? () => onModuleClick(m.index) : undefined}
              ariaLabel={`Filter findings by ${m.name} (${text}${isTop ? ', highest risk' : ''})`}
              left={
                <>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: m.dot }}
                  />
                  <span className="text-[12px] font-medium text-ink truncate">{m.name}</span>
                  {isTop && (
                    <span
                      className="text-[9px] font-semibold tracking-[0.05em] uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        color: 'var(--severe)',
                        background: 'color-mix(in srgb, var(--severe) 10%, transparent)',
                      }}
                    >
                      Highest risk
                    </span>
                  )}
                </>
              }
              right={
                <>
                  <span
                    className="text-[10px] font-semibold tracking-[0.04em] uppercase"
                    style={{ color }}
                  >
                    {text}
                  </span>
                  <span
                    className="text-[12px] font-semibold tabular-nums"
                    style={{ color: scoreColor(m.score) }}
                  >
                    {m.score}
                  </span>
                </>
              }
            />
          );
        })}
      </Lane>

      {/* ── Lane 3 — Fix first ─────────────────────────────── */}
      <Lane
        title="Fix first"
        accent="var(--signal)"
        Icon={Zap}
        emptyMessage="No open critical or high-severity findings."
        isEmpty={fixes.length === 0}
      >
        {fixes.map((fix) => {
          const affectedCount = fix.affectedModuleIndices.length;
          const firstModule =
            affectedCount > 0 ? modules[fix.affectedModuleIndices[0]] : undefined;
          return (
            <LaneRow
              key={fix.primaryId}
              onClick={onFixSelect ? () => onFixSelect(fix.primaryId) : undefined}
              ariaLabel={`Open finding "${fix.title}" (${fix.severity}${
                affectedCount > 1 ? `, affects ${affectedCount} modules` : ''
              })`}
              left={
                <>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: severityColor(fix.severity) }}
                    title={fix.severity}
                  />
                  <span className="text-[12px] font-medium text-ink truncate">
                    {fix.title}
                  </span>
                </>
              }
              right={
                affectedCount > 1 ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.03em]"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: firstModule?.dot || 'var(--m-muted)' }}
                    />
                    Affects {affectedCount} modules
                  </span>
                ) : firstModule ? (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.03em]"
                    style={{ color: 'var(--m-muted)' }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: firstModule.dot || 'var(--m-muted)' }}
                    />
                    <span className="truncate max-w-[7rem]">{firstModule.name}</span>
                  </span>
                ) : null
              }
            />
          );
        })}
      </Lane>
    </div>
  );
};

function Lane({
  title,
  Icon,
  accent,
  children,
  isEmpty,
  emptyMessage,
}: {
  title: string;
  Icon: React.ElementType;
  accent: string;
  children: React.ReactNode;
  isEmpty: boolean;
  emptyMessage: string;
}) {
  return (
    <div
      className="rounded-xl bg-card overflow-hidden"
      style={{ border: '1px solid var(--rule)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          borderBottom: '1px solid var(--rule)',
          background: `color-mix(in srgb, ${accent} 6%, transparent)`,
        }}
      >
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)` }}
        >
          <Icon size={13} style={{ color: accent }} />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-m-muted">
          {title}
        </p>
      </div>
      <div className="p-2">
        {isEmpty ? (
          <p className="px-3 py-3 text-[12px] text-m-muted leading-relaxed">{emptyMessage}</p>
        ) : (
          <div className="space-y-1">{children}</div>
        )}
      </div>
    </div>
  );
}

function LaneRow({
  left,
  right,
  onClick,
  ariaLabel,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer hover:bg-paper-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">{left}</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {right}
          <ChevronRight
            size={12}
            className="text-m-muted group-hover:text-ink transition-colors"
          />
        </div>
      </button>
    );
  }
  return (
    <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left">
      <div className="flex items-center gap-2 min-w-0 flex-1">{left}</div>
      <div className="flex items-center gap-2 flex-shrink-0">{right}</div>
    </div>
  );
}

export default PracticalInsights;
