'use client';

/**
 * PriorityRecommendations — surfaces the top 1-3 actions from the latest
 * audit's executive summary or, failing that, the most severe open findings.
 *
 * Designed to live on the Find page so discovery flows directly into Fix.
 * Each card links to the matching finding and offers a CTA into Fix.
 */

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Lightbulb, Wrench } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { AuditFinding, Report } from '@/types/database';

export function derivePriorityRecs(
  report: Report | null | undefined,
  openFindings: AuditFinding[],
): string[] {
  const rawJson = (report?.raw_json || null) as any;
  const fromRaw: string[] = Array.isArray(rawJson?.topRecommendations)
    ? rawJson.topRecommendations
        .filter((r: any) => typeof r === 'string' && r.trim().length > 0)
        .slice(0, 3)
    : [];
  if (fromRaw.length > 0) return fromRaw;
  if (report?.key_recommendation) return [report.key_recommendation];
  return openFindings
    .filter((f) => (f.severity === 'critical' || f.severity === 'high') && f.recommendation)
    .slice(0, 3)
    .map((f) => f.recommendation as string);
}

interface Props {
  recs: string[];
  findings: AuditFinding[];
  auditId: string;
}

export default function PriorityRecommendations({ recs, findings, auditId }: Props) {
  const { workspaceSlug } = useWorkspace();
  const dashPrefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';
  const topFindings = findings
    .filter((f) => (f.severity === 'critical' || f.severity === 'high') && f.recommendation)
    .slice(0, 3);

  return (
    <section
      className="rounded-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      aria-labelledby="priority-recs-heading"
    >
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink)' }}
          >
            <Lightbulb size={14} />
          </span>
          <div className="min-w-0">
            <h2
              id="priority-recs-heading"
              className="text-[15px] font-semibold leading-tight tracking-[-0.005em]"
              style={{ color: 'var(--ink)' }}
            >
              Priority recommendations
            </h2>
            <p className="text-[11px] leading-tight mt-1" style={{ color: 'var(--m-muted)' }}>
              {recs.length > 0
                ? `Top ${recs.length} action${recs.length === 1 ? '' : 's'} to fix next`
                : 'No priority actions right now'}
            </p>
          </div>
        </div>
        {recs.length > 0 && (
          <Link
            href={`${dashPrefix}/fix`}
            className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg hover:underline"
            style={{ color: 'var(--ink)' }}
          >
            Open Fix <ArrowRight size={11} />
          </Link>
        )}
      </div>

      {recs.length === 0 ? (
        <div className="px-5 pb-5 flex flex-col items-center justify-center py-3 text-center">
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            Run a fresh audit to find what should be fixed next.
          </p>
        </div>
      ) : (
        <ul className="px-4 sm:px-5 pb-4 space-y-2">
          {recs.slice(0, 3).map((rec, i) => {
            const linkedFinding = topFindings[i];
            return (
              <li
                key={i}
                className="rounded-lg p-3"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-semibold"
                    style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] leading-snug" style={{ color: 'var(--ink)' }}>
                      {rec}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px]">
                      {linkedFinding && (
                        <Link
                          href={`${dashPrefix}/fix#finding-${linkedFinding.id}`}
                          className="inline-flex items-center gap-1 font-semibold hover:underline"
                          style={{ color: 'var(--signal)' }}
                        >
                          <Wrench size={10} /> Open in Fix
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
