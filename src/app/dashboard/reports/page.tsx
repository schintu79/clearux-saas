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
import { useWorkspace } from '@/context/WorkspaceContext';
import { ArrowRight, Download, FileSpreadsheet, FileText, Share2 } from 'lucide-react';
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
  const { workspaceSlug, workspaceId } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    (async () => {
      const supabase = createBrowserSupabase();
      let query = supabase
        .from('audits')
        .select('id, product_url, completed_at, share_enabled, share_token')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .is('deleted_at', null);
      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }
      const { data: audits } = await query.order('completed_at', { ascending: false });
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
  }, [authLoading, user, workspaceId]);

  const handleDownload = async (auditId: string, format: 'pdf' | 'docx', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/reports/${auditId}/${format}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to download ${format}:`, err);
    }
  };

  const handleCSVExport = async (auditId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const supabase = createBrowserSupabase();
      const { data: findings } = await supabase
        .from('audit_findings')
        .select('title, description, severity, status, recommendation, page_url, category_index, action_mode, fix_status')
        .eq('audit_id', auditId)
        .order('severity', { ascending: true })
        .order('sort_order', { ascending: true });
      if (!findings || findings.length === 0) return;
      const headers = ['Title', 'Severity', 'Status', 'Page URL', 'Recommendation', 'Action', 'Fix Status', 'Description'];
      const rows = (findings as any[]).map((f) => [
        f.title, f.severity, f.status, f.page_url || '', f.recommendation || '',
        f.action_mode || '', f.fix_status || '', (f.description || '').replace(/[\n\r]+/g, ' '),
      ]);
      const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `findings-${auditId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
    }
  };

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
            <ActionLink href={`${dashPrefix}/new-audit`} icon={ArrowRight}>
              Run an audit
            </ActionLink>
          </div>
        </DashCard>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <DashCard padding="none">
                <div className="p-4 flex items-center gap-4">
                  <Link href={`${dashPrefix}/audits/${r.id}`} className="flex items-center gap-4 flex-1 min-w-0 transition-all hover:opacity-90">
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
                  </Link>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={(e) => handleDownload(r.id, 'pdf', e)}
                      className="p-1.5 rounded-md transition-all hover:bg-black/[0.04]"
                      title="Download PDF"
                      style={{ color: 'var(--m-muted)' }}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDownload(r.id, 'docx', e)}
                      className="p-1.5 rounded-md transition-all hover:bg-black/[0.04]"
                      title="Download DOCX"
                      style={{ color: 'var(--m-muted)' }}
                    >
                      <FileText size={14} />
                    </button>
                    <button
                      onClick={(e) => handleCSVExport(r.id, e)}
                      className="p-1.5 rounded-md transition-all hover:bg-black/[0.04]"
                      title="Export findings as CSV"
                      style={{ color: 'var(--m-muted)' }}
                    >
                      <FileSpreadsheet size={14} />
                    </button>
                  </div>
                  <Link href={`${dashPrefix}/audits/${r.id}`}>
                    <ArrowRight size={13} style={{ color: 'var(--m-muted)' }} />
                  </Link>
                </div>
              </DashCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
