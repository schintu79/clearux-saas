'use client';

/**
 * Reports — shared audit reports and exports.
 *
 * Thin wrapper over the existing audits index. Lists completed audits with
 * share-link state and an entry point into the full audit detail page (where
 * the proprietary algorithm output already lives).
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, FileText, Share2, ExternalLink } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase-ssr';

interface ReportRow {
  id: string;
  product_url: string | null;
  completed_at: string | null;
  share_enabled: boolean;
  share_token: string | null;
  overall_score: number | null;
}

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function host(url: string | null): string {
  if (!url) return '—';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: audits } = await supabase
        .from('audits')
        .select('id, product_url, completed_at, share_enabled, share_token')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
      const audIds = (audits || []).map((a: any) => a.id);
      const scoreMap = new Map<string, number | null>();
      if (audIds.length) {
        const { data: reports } = await supabase
          .from('reports')
          .select('audit_id, overall_score')
          .in('audit_id', audIds);
        for (const r of (reports || []) as any[]) scoreMap.set(r.audit_id, r.overall_score ?? null);
      }
      setRows(((audits || []) as any[]).map((a) => ({
        id: a.id,
        product_url: a.product_url,
        completed_at: a.completed_at,
        share_enabled: !!a.share_enabled,
        share_token: a.share_token,
        overall_score: scoreMap.get(a.id) ?? null,
      })));
      setLoading(false);
    })();
  }, [authLoading, user]);

  if (authLoading || loading) {
    return (
      <div>
        <div className="h-8 w-32 rounded-lg animate-pulse mb-2" style={{ background: 'var(--paper-2)' }} />
        <div className="h-5 w-72 rounded-md animate-pulse mb-8" style={{ background: 'var(--paper-2)' }} />
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-[68px] rounded-xl animate-pulse" style={{ background: 'var(--paper-2)' }} />)}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>Reports</h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Audit reports, exports, and shareable links.
        </p>
      </div>
      {rows.length === 0 ? (
        <div
          className="rounded-xl p-8"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          data-testid="reports-empty"
        >
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>No reports yet</p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Reports appear here once an audit completes. Each one comes with a downloadable PDF and an optional shareable link.
          </p>
          <Link
            href="/dashboard/new-audit"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            Run an audit
            <ArrowRight size={12} />
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/audits/${r.id}`}
                className="rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-sm"
                style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
              >
                <FileText size={16} style={{ color: 'var(--m-muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {host(r.product_url)}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                    {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                    {r.share_enabled && (
                      <span className="ml-2 inline-flex items-center gap-0.5" style={{ color: 'var(--signal)' }}>
                        <Share2 size={9} /> Shared
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-[16px] font-semibold tabular-nums" style={{ color: scoreColor(r.overall_score) }}>
                  {r.overall_score ?? '—'}
                </span>
                <ArrowRight size={13} style={{ color: 'var(--m-muted)' }} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
