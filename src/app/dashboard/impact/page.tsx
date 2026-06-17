'use client';

/**
 * Impact — Phase 3. The "we proved it" view: fixes that an automated re-check
 * confirmed actually landed, with time-to-fix. V1 is RLS-scoped to the user
 * (workspace filtering is a fast follow). See docs/FIX_OUTCOMES_ARCHITECTURE.md.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, RotateCcw } from 'lucide-react';

interface Outcome {
  id: string;
  title: string | null;
  page_url: string;
  detection_source: string | null;
  outcome: 'verified_fixed' | 'not_fixed' | 'inconclusive';
  severity_before: string | null;
  evidence_after: string | null;
  time_to_fix_seconds: number | null;
  verified_at: string;
}
interface Summary { verified_fixed: number; not_fixed: number; median_time_to_fix_days: number | null }

function pagePath(url: string): string {
  try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; }
}
function fmtDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const days = seconds / 86400;
  if (days >= 1) return `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`;
  const hours = seconds / 3600;
  if (hours >= 1) return `${Math.round(hours)} hr`;
  return '<1 hr';
}

export default function ImpactPage() {
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fix-outcomes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) { setOutcomes(d.outcomes || []); setSummary(d.summary || null); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const verified = outcomes.filter((o) => o.outcome === 'verified_fixed');

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-[22px] font-semibold text-ink">Impact</h1>
      <p className="text-[13px] text-m-muted mt-1 mb-6">
        Fixes an automated re-check confirmed actually landed. We re-ran the original test on the page and proved the issue is gone.
      </p>

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard icon={<CheckCircle2 size={15} className="text-ok" />} label="Verified fixed" value={String(summary.verified_fixed)} />
          <StatCard icon={<Clock size={15} className="text-signal" />} label="Median time to fix" value={summary.median_time_to_fix_days != null ? `${summary.median_time_to_fix_days} d` : '—'} />
          <StatCard icon={<RotateCcw size={15} className="text-m-muted" />} label="Re-opened (not fixed)" value={String(summary.not_fixed)} />
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-m-muted">Loading…</p>
      ) : verified.length === 0 ? (
        <div className="rounded-xl border border-rule/50 p-6 text-center">
          <CheckCircle2 size={22} className="text-m-muted mx-auto mb-2" />
          <p className="text-[14px] font-medium text-ink">No verified fixes yet</p>
          <p className="text-[12px] text-m-muted mt-1 max-w-md mx-auto">
            When you mark a measured (accessibility, speed, or SEO) finding as fixed, we re-check that page and, if the issue is gone, it appears here as proof.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-rule/50 divide-y divide-rule/40 overflow-hidden">
          {verified.map((o) => {
            const dur = fmtDuration(o.time_to_fix_seconds);
            return (
              <div key={o.id} className="flex items-start gap-3 px-4 py-3">
                <CheckCircle2 size={15} className="text-ok flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink truncate">{o.title || 'Finding'}</p>
                  <p className="text-[11px] text-m-muted mt-0.5 truncate">
                    {pagePath(o.page_url)}{o.detection_source ? ` · ${o.detection_source}` : ''}{o.severity_before ? ` · was ${o.severity_before}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] font-semibold text-ok">Verified fixed</p>
                  <p className="text-[10.5px] text-m-muted mt-0.5">
                    {fmtDate(o.verified_at)}{dur ? ` · ${dur}` : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-rule/50 p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className="text-[10.5px] font-semibold text-m-muted uppercase tracking-[0.04em]">{label}</span></div>
      <p className="text-[20px] font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}
