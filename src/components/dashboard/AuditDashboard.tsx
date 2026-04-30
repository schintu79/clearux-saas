'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  ChevronRight,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  Loader2,
  Search,
  RefreshCw,
} from 'lucide-react';
import ScoreRing from '@/components/ui/ScoreRing';
import type { AuditFinding } from '@/types/database';

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
      <h3 className="text-sm font-semibold text-text mb-3">Score Over Time</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {gridScores.map((s, i) => {
          const y = PAD_T + chartH - ((s - minScore) / range) * chartH;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.5" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="8" fill="var(--muted)" fontFamily="var(--font-inter)">{s}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <defs>
          <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#scoreAreaGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Hover hit areas + points */}
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
                className="transition-all duration-150"
                style={{ pointerEvents: 'none' }}
              />
              {showLabel && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect x={p.x - 14} y={p.y - 20} width="28" height="15" rx="4" fill="#6366F1" />
                  <text x={p.x} y={p.y - 10.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="white" fontFamily="var(--font-inter)">{p.score}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* X-axis date labels */}
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
    { key: 'critical', label: 'Critical Issues', count: severityCounts.critical, description: 'Needs immediate attention', color: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500', bgColor: 'bg-red-50 dark:bg-red-950/20', borderColor: 'border-red-200/50 dark:border-red-800/20' },
    { key: 'high', label: 'High Issues', count: severityCounts.high, description: 'High impact issues to fix', color: 'text-orange-600 dark:text-orange-400', dotColor: 'bg-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/20', borderColor: 'border-orange-200/50 dark:border-orange-800/20' },
    { key: 'medium', label: 'Medium Issues', count: severityCounts.medium + severityCounts.low, description: 'Low impact improvements', color: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-950/20', borderColor: 'border-amber-200/50 dark:border-amber-800/20' },
    { key: 'passed', label: 'Passed Checks', count: passedChecks, description: 'Good practices followed', color: 'text-[#22C55E] dark:text-emerald-400', dotColor: 'bg-[#22C55E]', bgColor: 'bg-[#22C55E]/5 dark:bg-emerald-950/20', borderColor: 'border-[#22C55E]/20 dark:border-emerald-800/20' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cards.map((card) => (
        <button
          key={card.key}
          onClick={() => onCardClick?.(card.key)}
          className={`rounded-xl border ${card.borderColor} ${card.bgColor} p-4 transition-all hover:shadow-md hover:-translate-y-0.5 text-left cursor-pointer group`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${card.dotColor}`} />
            <span className={`text-xs font-semibold ${card.color}`}>{card.label}</span>
          </div>
          <p className={`text-2xl font-bold font-heading ${card.color}`}>{card.count}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted">{card.description}</p>
            {card.key !== 'passed' && card.count > 0 && (
              <ChevronRight size={12} className="text-muted group-hover:text-text transition-colors" />
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
    .filter(f => !f.dismissed)
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    })
    .slice(0, 5);

  if (sorted.length === 0) {
    return (
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <h3 className="text-sm font-semibold text-text mb-3">Top Issues</h3>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-[#22C55E]/10 flex items-center justify-center mb-3">
            <CheckCircle2 size={22} className="text-[#22C55E]" />
          </div>
          <p className="text-base font-semibold text-text mb-1">No issues found</p>
          <p className="text-sm text-muted">Great job! Your site passed all checks.</p>
        </div>
      </div>
    );
  }

  const sevBadgeColors: Record<string, string> = {
    critical: 'bg-red-500 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-amber-400 text-amber-900',
    low: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  };

  const sevDotColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
  };

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-text mb-3">Top Issues</h3>
      <div className="space-y-0 divide-y divide-border/20 dark:divide-white/[0.04]">
        {sorted.map((f) => {
          const badgeColor = sevBadgeColors[f.severity] || sevBadgeColors.medium;
          const dotColor = sevDotColors[f.severity] || 'bg-gray-400';
          const sevLabel = f.severity.charAt(0).toUpperCase() + f.severity.slice(1);
          return (
            <Link
              key={f.id}
              href={auditId ? `/dashboard/audits/${auditId}?finding=${f.id}` : '#'}
              className="flex items-center gap-3 py-2.5 group hover:bg-brand/5 dark:hover:bg-brand/[0.03] rounded-lg px-2 -mx-2 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-xs font-medium text-text flex-1 min-w-0 truncate group-hover:text-brand transition-colors">{f.title}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide ${badgeColor}`}>
                {sevLabel}
              </span>
              <ChevronRight size={12} className="text-muted/40 group-hover:text-brand flex-shrink-0 transition-colors" />
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

  const cx = 250, cy = 155, R = 95;
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

  // Labels placed further out with score underneath
  const labelPoints = pillarScores.map((ps, i) => {
    const angle = startAngle + i * angleStep;
    const r = R + 48;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), name: ps.name, score: ps.score };
  });

  return (
    <div className="flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-text mb-3">Heuristic Breakdown</h3>
      <svg viewBox="0 0 500 340" className="w-full h-auto mx-auto" style={{ maxWidth: 460 }}>
        {/* Background fill for innermost area */}
        <polygon points={levelPolygons[0]} fill="var(--border)" fillOpacity="0.04" />

        {/* Grid polygons */}
        {levelPolygons.map((polygon, i) => (
          <polygon key={i} points={polygon} fill="none" stroke="var(--border)" strokeWidth="0.6" opacity={0.3 + i * 0.12} />
        ))}

        {/* Axis lines */}
        {Array.from({ length: n }, (_, i) => {
          const angle = startAngle + i * angleStep;
          return (
            <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(angle)} y2={cy + R * Math.sin(angle)} stroke="var(--border)" strokeWidth="0.5" opacity="0.3" />
          );
        })}

        {/* Data polygon — gradient fill */}
        <defs>
          <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <polygon points={dataPolygon} fill="url(#radarFill)" stroke="#6366F1" strokeWidth="2" strokeLinejoin="round" />

        {/* Data points + hover areas */}
        {dataPoints.map((p, i) => {
          const isHovered = hoveredIdx === i;
          const color = PILLAR_COLORS[i] || '#6366F1';
          return (
            <g key={i}>
              <circle
                cx={p.x} cy={p.y} r="16" fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              />
              <circle
                cx={p.x} cy={p.y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? color : 'var(--card)'}
                stroke={color}
                strokeWidth="2.5"
                className="transition-all duration-150"
                style={{ pointerEvents: 'none' }}
              />
              {/* Hover tooltip — dynamic width based on text length */}
              {isHovered && (() => {
                const tooltipText = `${pillarScores[i].name}: ${pillarScores[i].score}/100`;
                const tooltipW = tooltipText.length * 7.5 + 20;
                return (
                  <g style={{ pointerEvents: 'none' }}>
                    <rect
                      x={p.x - tooltipW / 2} y={p.y - 36}
                      width={tooltipW} height="28"
                      rx="7" fill="#1e1e2e" opacity="0.94"
                    />
                    <text x={p.x} y={p.y - 19} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="white" fontFamily="var(--font-inter)">
                      {tooltipText}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Labels — full name + score below */}
        {labelPoints.map((lp, i) => {
          const anchor = Math.abs(lp.x - cx) < 5 ? 'middle' : lp.x > cx ? 'start' : 'end';
          const isTop = lp.y < cy;
          const color = PILLAR_COLORS[i] || '#6366F1';
          return (
            <g key={i}>
              <text x={lp.x} y={isTop ? lp.y - 3 : lp.y} textAnchor={anchor} dominantBaseline="middle" fontSize="13.5" fontWeight="600" fill="var(--text)" fontFamily="var(--font-inter)" opacity="0.85">
                {lp.name}
              </text>
              <text x={lp.x} y={isTop ? lp.y + 13 : lp.y + 16} textAnchor={anchor} dominantBaseline="middle" fontSize="15" fontWeight="700" fill={color} fontFamily="var(--font-inter)">
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
  const [showManual, setShowManual] = useState(false);
  const maxCompetitors = competitors?.slice(0, 3) || [];
  const hasCompetitors = maxCompetitors.length > 0;

  const handleManualSubmit = () => {
    const domains = manualInputs.filter(d => d.trim().length > 0);
    if (domains.length > 0 && onBenchmark) {
      onBenchmark('manual', domains);
    }
  };

  // Empty state — no competitors yet
  if (!hasCompetitors) {
    return (
      <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card shadow-sm overflow-hidden mb-6">
        <div className="px-5 pt-5 pb-2 flex items-center gap-2">
          <BarChart3 size={14} className="text-brand" />
          <h3 className="text-sm font-semibold text-text">Benchmarks</h3>
        </div>

        {detecting ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-10">
            <Loader2 size={28} className="text-brand animate-spin mb-3" />
            <p className="text-sm font-semibold text-text mb-1">Analysing competitors...</p>
            <p className="text-xs text-muted animate-pulse max-w-xs">
              Fetching real HTML from each site and scoring their UX across all pillars. This takes 15–30 seconds.
            </p>
          </div>
        ) : showManual ? (
          /* Manual input form */
          <div className="px-5 pb-5 pt-2">
            <p className="text-xs text-muted mb-3">Enter up to 3 competitor domains to benchmark against:</p>
            <div className="space-y-2 mb-4">
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border/40 dark:border-white/[0.08] bg-off/50 dark:bg-white/[0.03] text-text placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleManualSubmit}
                disabled={manualInputs.every(d => !d.trim())}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand px-4 py-2 rounded-lg hover:brightness-110 transition-all disabled:opacity-40 shadow-sm"
              >
                <BarChart3 size={14} />
                Run Benchmark
              </button>
              <button
                onClick={() => setShowManual(false)}
                className="text-sm text-muted hover:text-text px-3 py-2 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          /* Choice: auto or manual */
          <div className="flex flex-col items-center justify-center text-center px-6 py-8">
            <div className="w-12 h-12 rounded-2xl bg-brand/8 dark:bg-brand/10 flex items-center justify-center mb-4">
              <BarChart3 size={22} className="text-brand" />
            </div>
            <p className="text-base font-semibold text-text mb-1">Benchmark against competitors</p>
            <p className="text-sm text-muted max-w-sm mb-6">
              Compare your UX score against up to 3 competitors. We analyse their real website to produce accurate scores.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <button
                onClick={() => onBenchmark?.('auto')}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-brand px-4 py-2.5 rounded-xl hover:brightness-110 transition-all shadow-sm"
              >
                <Search size={15} />
                Auto-detect
              </button>
              <button
                onClick={() => setShowManual(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-text border border-border/50 dark:border-white/[0.1] bg-off/60 dark:bg-white/[0.04] px-4 py-2.5 rounded-xl hover:bg-off dark:hover:bg-white/[0.07] transition-all"
              >
                <ChevronRight size={15} />
                Enter manually
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Competitors found — show comparison table
  const rows = [
    { label: 'Overall', yourScore: overallScore },
    ...pillarScores.map(ps => ({ label: ps.name, yourScore: ps.score })),
  ];

  const getCompAvg = (label: string) => {
    const scores = maxCompetitors
      .map(c => label === 'Overall' ? c.score : c.pillarScores?.find(ps => ps.name === label)?.score)
      .filter((s): s is number => s != null);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  };

  return (
    <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card shadow-sm overflow-hidden mb-6">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2">
        <BarChart3 size={14} className="text-brand" />
        <h3 className="text-sm font-semibold text-text">Benchmarks</h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted">vs. {maxCompetitors.length} competitor{maxCompetitors.length !== 1 ? 's' : ''}</span>
          {onBenchmark && (
            <button
              onClick={() => { setShowManual(false); onBenchmark('auto'); }}
              disabled={detecting}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-brand transition-colors disabled:opacity-50"
              title="Re-run benchmark with new competitors"
            >
              <RefreshCw size={11} className={detecting ? 'animate-spin' : ''} />
              Re-run
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-y border-border/20 dark:border-white/[0.04]">
              <th className="text-left font-semibold text-muted py-2 px-5 w-[140px]">Category</th>
              <th className="text-center font-semibold text-brand py-2 px-3">You</th>
              {maxCompetitors.map((c, i) => (
                <th key={i} className="text-center font-semibold text-muted py-2 px-3 truncate max-w-[90px]">
                  {c.domain}
                </th>
              ))}
              <th className="text-center font-semibold text-muted py-2 px-3">vs Avg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10 dark:divide-white/[0.03]">
            {rows.map((row) => {
              const avg = getCompAvg(row.label);
              const diff = avg != null ? row.yourScore - avg : 0;
              const isOverall = row.label === 'Overall';
              return (
                <tr key={row.label} className={`hover:bg-brand/5 dark:hover:bg-brand/[0.03] transition-colors ${isOverall ? 'font-semibold' : ''}`}>
                  <td className="py-2.5 px-5 text-text">{row.label}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`font-bold ${row.yourScore >= 70 ? 'text-[#22C55E]' : row.yourScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                      {row.yourScore}
                    </span>
                  </td>
                  {maxCompetitors.map((c, ci) => {
                    const compScore = row.label === 'Overall'
                      ? c.score
                      : c.pillarScores?.find(ps => ps.name === row.label)?.score ?? null;
                    return (
                      <td key={ci} className="py-2.5 px-3 text-center text-muted">
                        {compScore != null ? compScore : '—'}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-center">
                    {avg != null ? (
                      <span className={`inline-flex items-center gap-0.5 font-semibold ${
                        diff > 0 ? 'text-[#22C55E]' : diff < 0 ? 'text-red-500' : 'text-muted'
                      }`}>
                        {diff > 0 ? <ArrowUpRight size={10} /> : diff < 0 ? <ArrowDownRight size={10} /> : <Minus size={10} />}
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
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
  const totalFindings = findings.filter(f => !f.dismissed).length;

  return (
    <>
      {/* Row 1: UX Score + Score Over Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* UX Score Card */}
        <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-text mb-4">UX Score</h3>
          <div className="flex flex-col items-center">
            <ScoreRing score={overallScore} size={130} strokeWidth={8} />
            <p className="text-xs text-muted mt-2">/100</p>
            <span className={`text-sm font-semibold mt-1 px-3 py-0.5 rounded-full ${
              overallScore >= 70
                ? 'bg-[#22C55E]/10 text-[#22C55E] dark:text-emerald-400'
                : overallScore >= 40
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  : 'bg-red-100 dark:bg-red-900/30 text-[#EF4444] dark:text-red-400'
            }`}>
              {overallScore >= 70 ? 'Great UX' : overallScore >= 40 ? 'Needs Work' : 'Poor UX'}
            </span>
          </div>
        </div>

        {/* Score Over Time Card */}
        <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-5 shadow-sm">
          {scoreTrend.length >= 2 ? (
            <ScoreOverTimeChart trend={scoreTrend} />
          ) : (
            <div className="h-full flex flex-col">
              <h3 className="text-sm font-semibold text-text mb-3">Score Over Time</h3>
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                <TrendingUp size={28} className="text-muted/30 mb-2" />
                <p className="text-xs text-muted">Re-audit to track your score over time</p>
                <Link
                  href={`/dashboard/new-audit?url=${encodeURIComponent(productUrl)}`}
                  className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors mt-2"
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

      {/* Row 3: Heuristic Breakdown — full width */}
      <div className="rounded-xl border border-border/30 dark:border-white/[0.06] bg-card p-5 shadow-sm mb-6">
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
    </>
  );
}
