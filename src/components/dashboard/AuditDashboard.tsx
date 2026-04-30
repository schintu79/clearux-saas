'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  ChevronRight,
  BarChart3,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import ScoreRing from '@/components/ui/ScoreRing';
import type { AuditFinding } from '@/types/database';

/* ── Shared card style ─────────────────────────────────────── */
const CARD = 'rounded-2xl border border-border/20 dark:border-white/[0.05] bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none';

/* ── Score Over Time Chart ───────────────────────────────── */

export function ScoreOverTimeChart({ trend }: {
  trend: Array<{ auditId: string; date: string; overallScore: number }>;
}) {
  const router = useRouter();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (trend.length === 0) return null;

  const W = 320, H = 160, PAD_L = 32, PAD_R = 16, PAD_T = 24, PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const minScore = Math.max(0, Math.min(...trend.map(t => t.overallScore)) - 10);
  const maxScore = Math.min(100, Math.max(...trend.map(t => t.overallScore)) + 10);
  const range = maxScore - minScore || 1;

  const points = trend.map((t, i) => ({
    x: PAD_L + (trend.length === 1 ? chartW / 2 : (i / (trend.length - 1)) * chartW),
    y: PAD_T + chartH - ((t.overallScore - minScore) / range) * chartH,
    score: t.overallScore,
    date: t.date,
    auditId: t.auditId,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${PAD_T + chartH} L ${points[0].x} ${PAD_T + chartH} Z`;

  const gridLines = 4;
  const gridScores = Array.from({ length: gridLines + 1 }, (_, i) => Math.round(minScore + (range * i) / gridLines));

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-text mb-4">Score Over Time</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {gridScores.map((s, i) => {
          const y = PAD_T + chartH - ((s - minScore) / range) * chartH;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.4" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="8" fill="var(--muted)" fontFamily="var(--font-inter)">{s}</text>
            </g>
          );
        })}

        <defs>
          <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#scoreAreaGrad)" />
        <path d={pathD} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => {
          const isHovered = hoveredIdx === i;
          const isLast = i === points.length - 1;
          const showLabel = isHovered || isLast;
          return (
            <g key={i}>
              <circle
                cx={p.x} cy={p.y} r="14" fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => router.push(`/dashboard/audits/${p.auditId}`)}
                style={{ cursor: 'pointer' }}
              />
              <circle
                cx={p.x} cy={p.y}
                r={isHovered ? 5 : 3.5}
                fill={isHovered ? '#6366F1' : 'var(--card)'}
                stroke="#6366F1"
                strokeWidth="2"
                className="transition-all duration-200"
                style={{ pointerEvents: 'none' }}
              />
              {showLabel && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={p.x - 14} y={p.y - 20} width="28" height="15" rx="5" fill="#6366F1" />
                  <text x={p.x} y={p.y - 10.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white" fontFamily="var(--font-inter)">{p.score}</text>
                </g>
              )}
            </g>
          );
        })}

        {points.map((p, i) => {
          if (trend.length > 5 && i !== 0 && i !== trend.length - 1 && i !== Math.floor(trend.length / 2)) return null;
          const d = new Date(p.date);
          const label = `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
          return (
            <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="7.5" fill="var(--muted)" fontFamily="var(--font-inter)">{label}</text>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Stat Cards ──────────────────────────────────────────── */

export function DashboardStatCards({ severityCounts, totalCheckpoints, totalFindings, onCardClick }: {
  severityCounts: { critical: number; high: number; medium: number; low: number };
  totalCheckpoints: number;
  totalFindings: number;
  onCardClick?: (filter: string) => void;
}) {
  const passedChecks = Math.max(0, totalCheckpoints - totalFindings);
  const cards = [
    { key: 'critical', label: 'Critical', count: severityCounts.critical, description: 'Needs immediate attention', color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500', bgColor: 'bg-red-50/70 dark:bg-red-950/15', borderColor: 'border-red-100 dark:border-red-900/20' },
    { key: 'high', label: 'High', count: severityCounts.high, description: 'High impact to fix', color: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500', bgColor: 'bg-orange-50/70 dark:bg-orange-950/15', borderColor: 'border-orange-100 dark:border-orange-900/20' },
    { key: 'medium', label: 'Medium', count: severityCounts.medium + severityCounts.low, description: 'Low impact improvements', color: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50/70 dark:bg-amber-950/15', borderColor: 'border-amber-100 dark:border-amber-900/20' },
    { key: 'passed', label: 'Passed', count: passedChecks, description: 'Good practices followed', color: 'text-[#22C55E] dark:text-emerald-400', dotColor: 'bg-[#22C55E]', bgColor: 'bg-[#22C55E]/5 dark:bg-emerald-950/15', borderColor: 'border-[#22C55E]/15 dark:border-emerald-900/20' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <button
          key={card.key}
          onClick={() => onCardClick?.(card.key)}
          className={`rounded-2xl border ${card.borderColor} ${card.bgColor} p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 text-left cursor-pointer group`}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${card.dotColor}`} />
            <span className={`text-xs font-medium ${card.color}`}>{card.label}</span>
          </div>
          <p className={`text-3xl font-bold font-heading ${card.color} tracking-tight`}>{card.count}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-muted leading-relaxed">{card.description}</p>
            {card.key !== 'passed' && card.count > 0 && (
              <ChevronRight size={12} className="text-muted/30 group-hover:text-text/50 transition-colors" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Top Issues Panel ────────────────────────────────────── */

export function TopIssuesPanel({ findings, auditId }: {
  findings: AuditFinding[];
  auditId?: string;
}) {
  const sorted = [...findings]
    .filter(f => !f.dismissed && f.status !== 'fixed')
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    })
    .slice(0, 5);

  if (sorted.length === 0) {
    return (
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <h3 className="text-sm font-semibold text-text mb-4">Top Issues</h3>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-[#22C55E]/8 flex items-center justify-center mb-4">
            <CheckCircle2 size={24} className="text-[#22C55E]" />
          </div>
          <p className="text-base font-semibold text-text mb-1.5">No issues found</p>
          <p className="text-sm text-muted">Great job! Your site passed all checks.</p>
        </div>
      </div>
    );
  }

  const sevDotColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-400',
  };

  const sevLabelColors: Record<string, string> = {
    critical: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
    high: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30',
    medium: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    low: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
  };

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-text mb-4">Top Issues</h3>
      <div className="space-y-1">
        {sorted.map((f) => {
          const dotColor = sevDotColors[f.severity] || 'bg-gray-400';
          const labelColor = sevLabelColors[f.severity] || 'text-muted bg-off';
          const sevLabel = f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
          return (
            <Link
              key={f.id}
              href={auditId ? `/dashboard/audits/${auditId}?finding=${f.id}` : '#'}
              className="flex items-center gap-3 py-3 group hover:bg-off/60 dark:hover:bg-white/[0.02] rounded-xl px-3 -mx-3 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-sm text-text flex-1 min-w-0 truncate group-hover:text-brand transition-colors">{f.title}</span>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0 ${labelColor}`}>
                {sevLabel}
              </span>
              <ChevronRight size={14} className="text-muted/25 group-hover:text-brand flex-shrink-0 transition-colors" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ── Heuristic Breakdown Radar Chart ─────────────────────── */

const PILLAR_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#22C55E'];

export function HeuristicRadarChart({ pillarScores }: {
  pillarScores: Array<{ name: string; score: number }>;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const n = pillarScores.length;
  if (n < 3) return null;

  const cx = 320, cy = 175, R = 100;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const levels = [25, 50, 75, 100];
  const levelPolygons = levels.map((level) =>
    Array.from({ length: n }, (_, i) => {
      const angle = startAngle + i * angleStep;
      const r = (level / 100) * R;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ')
  );

  const dataPoints = pillarScores.map((ps, i) => {
    const angle = startAngle + i * angleStep;
    const r = (ps.score / 100) * R;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  const labelPoints = pillarScores.map((ps, i) => {
    const angle = startAngle + i * angleStep;
    const r = R + 55;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), name: ps.name, score: ps.score };
  });

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-text mb-4">Heuristic Breakdown</h3>
      <svg viewBox="0 0 640 390" className="w-full h-auto mx-auto" style={{ maxWidth: 540 }}>
        <polygon points={levelPolygons[0]} fill="var(--border)" fillOpacity="0.03" />

        {levelPolygons.map((polygon, i) => (
          <polygon key={i} points={polygon} fill="none" stroke="var(--border)" strokeWidth="0.5" opacity={0.2 + i * 0.1} />
        ))}

        {Array.from({ length: n }, (_, i) => {
          const angle = startAngle + i * angleStep;
          return (
            <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(angle)} y2={cy + R * Math.sin(angle)} stroke="var(--border)" strokeWidth="0.4" opacity="0.25" />
          );
        })}

        <defs>
          <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polygon points={dataPolygon} fill="url(#radarFill)" stroke="#6366F1" strokeWidth="1.5" strokeLinejoin="round" />

        {dataPoints.map((p, i) => {
          const isHovered = hoveredIdx === i;
          const color = PILLAR_COLORS[i] || '#6366F1';
          return (
            <g key={i}>
              <circle
                cx={p.x} cy={p.y} r="18" fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              />
              <circle
                cx={p.x} cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? color : 'var(--card)'}
                stroke={color}
                strokeWidth="2"
                className="transition-all duration-200"
                style={{ pointerEvents: 'none' }}
              />
              {isHovered && (() => {
                const tooltipText = `${pillarScores[i].name}: ${pillarScores[i].score}/100`;
                const tooltipW = tooltipText.length * 7.5 + 24;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={p.x - tooltipW / 2} y={p.y - 38}
                      width={tooltipW} height="30"
                      rx="8" fill="#1e1e2e" opacity="0.92"
                    />
                    <text x={p.x} y={p.y - 20} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="white" fontFamily="var(--font-inter)">
                      {tooltipText}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {labelPoints.map((lp, i) => {
          const anchor = Math.abs(lp.x - cx) < 5 ? 'middle' : lp.x > cx ? 'start' : 'end';
          const isTop = lp.y < cy;
          const color = PILLAR_COLORS[i] || '#6366F1';
          return (
            <g key={i}>
              <text x={lp.x} y={isTop ? lp.y - 3 : lp.y} textAnchor={anchor} dominantBaseline="middle" fontSize="13" fontWeight="500" fill="var(--text)" fontFamily="var(--font-inter)" opacity="0.75">
                {lp.name}
              </text>
              <text x={lp.x} y={isTop ? lp.y + 14 : lp.y + 17} textAnchor={anchor} dominantBaseline="middle" fontSize="16" fontWeight="700" fill={color} fontFamily="var(--font-inter)">
                {lp.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Benchmarks Section ──────────────────────────────────── */

export function BenchmarksSection({ overallScore, pillarScores, competitors, detecting, onBenchmark }: {
  overallScore: number;
  pillarScores: Array<{ name: string; score: number }>;
  competitors?: Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>;
  detecting?: boolean;
  onBenchmark?: (mode: 'auto' | 'manual', domains?: string[]) => void;
}) {
  const [manualInputs, setManualInputs] = useState<string[]>(['', '', '']);
  const [editing, setEditing] = useState(false);
  const maxCompetitors = competitors?.slice(0, 3) || [];
  const hasCompetitors = maxCompetitors.length > 0;

  const handleSubmit = () => {
    const domains = manualInputs.filter(d => d.trim().length > 0);
    if (domains.length > 0 && onBenchmark) {
      setEditing(false);
      onBenchmark('manual', domains);
    }
  };

  const scoreColor = (score: number, allScores: number[]) => {
    const best = Math.max(...allScores);
    const worst = Math.min(...allScores);
    if (allScores.length < 2 || best === worst) return 'text-muted';
    if (score === best) return 'text-[#22C55E] font-bold';
    if (score === worst) return 'text-[#EF4444] font-semibold';
    return 'text-amber-600 dark:text-amber-400 font-medium';
  };

  const renderForm = () => (
    <div className="px-7 pb-7 pt-3">
      <p className="text-sm text-muted mb-4 leading-relaxed">Enter up to 3 competitor domains to benchmark against:</p>
      <div className="space-y-3 mb-5">
        {manualInputs.map((val, i) => (
          <input
            key={i}
            type="text"
            value={val}
            onChange={e => {
              const updated = [...manualInputs];
              updated[i] = e.target.value;
              setManualInputs(updated);
            }}
            placeholder={`competitor${i + 1}.com`}
            className="w-full px-4 py-3 text-sm rounded-xl border border-border/30 dark:border-white/[0.06] bg-off/40 dark:bg-white/[0.02] text-text placeholder:text-muted/35 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/30 transition-all"
          />
        ))}
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={manualInputs.every(d => !d.trim())}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand px-6 py-2.5 rounded-xl hover:brightness-110 transition-all disabled:opacity-35 shadow-sm"
        >
          <BarChart3 size={14} />
          Run Benchmark
        </button>
        {hasCompetitors && (
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-muted hover:text-text px-4 py-2.5 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  if (!hasCompetitors || editing) {
    return (
      <div className={CARD + ' overflow-hidden'}>
        <div className="px-7 pt-7 pb-3 flex items-center gap-2.5">
          <BarChart3 size={15} className="text-brand" />
          <h3 className="text-sm font-semibold text-text">Benchmarks</h3>
        </div>

        {detecting ? (
          <div className="flex flex-col items-center justify-center text-center px-8 py-14">
            <Loader2 size={28} className="text-brand animate-spin mb-4" />
            <p className="text-sm font-semibold text-text mb-2">Analysing competitors...</p>
            <p className="text-sm text-muted animate-pulse max-w-xs leading-relaxed">
              Fetching real HTML from each site and scoring their UX across all pillars. This takes 15–30 seconds.
            </p>
          </div>
        ) : !hasCompetitors && manualInputs.every(d => !d.trim()) ? (
          <div className="flex flex-col items-center justify-center text-center px-8 py-10">
            <div className="w-14 h-14 rounded-2xl bg-off dark:bg-white/[0.04] flex items-center justify-center mb-5">
              <BarChart3 size={24} className="text-muted/50" />
            </div>
            <p className="text-lg font-semibold text-text mb-2">Benchmark against competitors</p>
            <p className="text-sm text-muted max-w-sm mb-8 leading-relaxed">
              Add up to 3 competitor domains. We analyse their real website and score their UX across all pillars.
            </p>
            {renderForm()}
          </div>
        ) : (
          renderForm()
        )}
      </div>
    );
  }

  const rows = [
    { label: 'Overall', yourScore: overallScore },
    ...pillarScores.map(ps => ({ label: ps.name, yourScore: ps.score })),
  ];

  return (
    <div className={CARD + ' overflow-hidden'}>
      <div className="px-7 pt-7 pb-4 flex items-center gap-2.5">
        <BarChart3 size={15} className="text-brand" />
        <h3 className="text-sm font-semibold text-text">Benchmarks</h3>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted">vs. {maxCompetitors.length} competitor{maxCompetitors.length !== 1 ? 's' : ''}</span>
          {onBenchmark && (
            <button
              onClick={() => {
                setManualInputs(maxCompetitors.map(c => c.domain).concat(['', '', '']).slice(0, 3));
                setEditing(true);
              }}
              disabled={detecting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand/8 px-3.5 py-2 rounded-xl hover:bg-brand/15 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={detecting ? 'animate-spin' : ''} />
              Replace competitors
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border/15 dark:border-white/[0.04]">
              <th className="text-left font-medium text-muted py-3 px-7 w-[160px]">Category</th>
              <th className="text-center font-medium text-brand py-3 px-4">You</th>
              {maxCompetitors.map((c, i) => (
                <th key={i} className="text-center font-medium text-muted py-3 px-4 truncate max-w-[100px]">
                  {c.domain}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10 dark:divide-white/[0.03]">
            {rows.map((row) => {
              const isOverall = row.label === 'Overall';
              const compScores = maxCompetitors.map(c =>
                row.label === 'Overall' ? c.score : (c.pillarScores?.find(ps => ps.name === row.label)?.score ?? null)
              );
              const allScores = [row.yourScore, ...compScores.filter((s): s is number => s != null)];

              return (
                <tr key={row.label} className={`hover:bg-off/50 dark:hover:bg-white/[0.02] transition-colors ${isOverall ? 'font-semibold' : ''}`}>
                  <td className="py-3.5 px-7 text-text">{row.label}</td>
                  <td className={`py-3.5 px-4 text-center ${scoreColor(row.yourScore, allScores)}`}>
                    {row.yourScore}
                  </td>
                  {maxCompetitors.map((c, ci) => {
                    const compScore = compScores[ci];
                    return (
                      <td key={ci} className={`py-3.5 px-4 text-center ${compScore != null ? scoreColor(compScore, allScores) : 'text-muted'}`}>
                        {compScore != null ? compScore : '—'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Full Dashboard Wrapper ──────────────────────────────── */

export function AuditDashboardOverview({
  overallScore,
  scoreTrend,
  severityCounts,
  findings,
  pillarScores,
  productUrl,
  latestAuditId,
  competitors,
  detecting,
  onBenchmark,
  onStatCardClick,
}: {
  overallScore: number;
  scoreTrend: Array<{ auditId: string; date: string; overallScore: number }>;
  severityCounts: { critical: number; high: number; medium: number; low: number };
  findings: AuditFinding[];
  pillarScores: Array<{ name: string; score: number }>;
  productUrl: string;
  latestAuditId: string;
  competitors?: Array<{ domain: string; score: number; pillarScores?: Array<{ name: string; score: number }> }>;
  detecting?: boolean;
  onBenchmark?: (mode: 'auto' | 'manual', domains?: string[]) => void;
  onStatCardClick?: (filter: string) => void;
}) {
  const totalFindings = findings.filter(f => !f.dismissed && f.status !== 'fixed').length;

  return (
    <div className="space-y-8">
      {/* Row 1: UX Score + Score Over Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className={CARD + ' p-7'}>
          <h3 className="text-sm font-semibold text-text mb-5">UX Score</h3>
          <div className="flex flex-col items-center">
            <ScoreRing score={overallScore} size={140} strokeWidth={8} />
            <p className="text-xs text-muted mt-3">/100</p>
            <span className={`text-sm font-semibold mt-2 px-4 py-1 rounded-full ${
              overallScore >= 70
                ? 'bg-[#22C55E]/8 text-[#22C55E] dark:text-emerald-400'
                : overallScore >= 40
                  ? 'bg-amber-100/60 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  : 'bg-red-100/60 dark:bg-red-900/20 text-[#EF4444] dark:text-red-400'
            }`}>
              {overallScore >= 70 ? 'Great UX' : overallScore >= 40 ? 'Needs Work' : 'Poor UX'}
            </span>
          </div>
        </div>

        <div className={CARD + ' p-7'}>
          {scoreTrend.length >= 2 ? (
            <ScoreOverTimeChart trend={scoreTrend} />
          ) : (
            <div className="h-full flex flex-col">
              <h3 className="text-sm font-semibold text-text mb-4">Score Over Time</h3>
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <TrendingUp size={28} className="text-muted/25 mb-3" />
                <p className="text-sm text-muted leading-relaxed">Re-audit to track your score over time</p>
                <Link
                  href={`/dashboard/new-audit?url=${encodeURIComponent(productUrl)}`}
                  className="text-sm font-semibold text-brand hover:text-brand/80 transition-colors mt-3"
                >
                  Re-audit (1 credit) →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Stat Cards */}
      <DashboardStatCards
        severityCounts={severityCounts}
        totalCheckpoints={64}
        totalFindings={totalFindings}
        onCardClick={onStatCardClick}
      />

      {/* Row 3: Heuristic Breakdown */}
      <div className={CARD + ' p-7'}>
        <HeuristicRadarChart pillarScores={pillarScores} />
      </div>

      {/* Row 4: Benchmarks */}
      <BenchmarksSection
        overallScore={overallScore}
        pillarScores={pillarScores}
        competitors={competitors}
        detecting={detecting}
        onBenchmark={onBenchmark}
      />
    </div>
  );
}
