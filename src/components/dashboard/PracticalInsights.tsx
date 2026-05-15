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
 * category scores + their summary text; "Fix first" is the parent's
 * already-ranked queue (severity × evidence). We label conservatively so we
 * don't over-claim.
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
import type { RankedFinding } from './FixQueue';

export interface PracticalInsightsProps {
  modules: ModuleScore[];
  categoryScores: Array<{ name: string; score: number; summary?: string | null }>;
  fixQueue: RankedFinding[];
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

const PracticalInsights: React.FC<PracticalInsightsProps> = ({
  modules,
  categoryScores,
  fixQueue,
  onModuleClick,
  onFixSelect,
}) => {
  const auditedModules = modules.filter((m) => m.audited);
  const strengths = [...auditedModules]
    .filter((m) => strengthLabel(m.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const risks = [...auditedModules]
    .filter((m) => weaknessLabel(m.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const fixes = fixQueue.slice(0, 3);

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
        emptyMessage="No category is currently flagged for attention."
        isEmpty={risks.length === 0}
      >
        {risks.map((m) => {
          const label = weaknessLabel(m.score) || 'Attention';
          return (
            <LaneRow
              key={m.index}
              onClick={onModuleClick ? () => onModuleClick(m.index) : undefined}
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
                    style={{ color: m.score < 40 ? 'var(--severe)' : 'var(--warn)' }}
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
      </Lane>

      {/* ── Lane 3 — Fix first ─────────────────────────────── */}
      <Lane
        title="Fix first"
        accent="var(--signal)"
        Icon={Zap}
        emptyMessage="No critical or high-severity findings are open."
        isEmpty={fixes.length === 0}
      >
        {fixes.map(({ finding, moduleName, moduleDot }) => (
          <LaneRow
            key={finding.id}
            onClick={onFixSelect ? () => onFixSelect(finding.id) : undefined}
            left={
              <>
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: severityColor(finding.severity) }}
                  title={finding.severity}
                />
                <span className="text-[12px] font-medium text-ink truncate">
                  {finding.title}
                </span>
              </>
            }
            right={
              moduleName ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium tracking-[0.03em]"
                  style={{ color: 'var(--m-muted)' }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: moduleDot || 'var(--m-muted)' }}
                  />
                  <span className="truncate max-w-[7rem]">{moduleName}</span>
                </span>
              ) : null
            }
          />
        ))}
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
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const Wrapper: any = interactive ? 'button' : 'div';
  return (
    <Wrapper
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${
        interactive ? 'hover:bg-paper-2 transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">{left}</div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {right}
        {interactive && <ChevronRight size={12} className="text-m-muted" />}
      </div>
    </Wrapper>
  );
}

export default PracticalInsights;
