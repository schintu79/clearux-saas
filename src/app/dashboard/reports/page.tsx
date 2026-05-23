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
import { ArrowRight, FileText, Share2 } from 'lucide-react';
import PageHeader from '@/components/dashboard/v2/PageHeader';
import DashCard from '@/components/dashboard/v2/DashCard';
import ActionLink from '@/components/dashboard/v2/ActionLink';
import { scoreColor, formatDate, hostOf } from '@/components/dashboard/v2/score-utils';
import { createBrowserSupabase } from '@/lib/supabase-ssr';

interface ReportRow {
  id: string;
  product_url: string | null;
  completed_at: string | null;
  share_enabled: boolean;
  share_token: string | null;
  overall_score: number | null;
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
      <PageHeader
        icon={<FileText size={18} strokeWidth={1.75} style={{ color: 'var(--ink)' }} />}
        title="Reports"
        subtitle="Download, share, or export your audit results."
      />
      {rows.length === 0 ? (
        <DashCard padding="none" className="p-8">
          <p className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>No reports yet</p>
          <p className="text-[12px] mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Reports appear here once an audit completes. Download as PDF, share with your team, or export findings for your workflow.
          </p>
          <div className="mt-4">
            <ActionLink href="/dashboard/new-audit" icon={ArrowRight}>
              Run an audit
            </ActionLink>
          </div>
        </DashCard>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <DashCard padding="none">
                <Link
                  href={`/dashboard/audits/${r.id}`}
                  className="p-4 flex items-center gap-4 transition-all hover:opacity-90"
                >
                  <FileText size={16} style={{ color: 'var(--m-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                      {hostOf(r.product_url) ?? '—'}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                      {formatDate(r.completed_at)}
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
              </DashCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
