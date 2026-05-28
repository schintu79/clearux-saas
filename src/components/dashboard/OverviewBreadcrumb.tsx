'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * Sub-page breadcrumb shown above the page heading on detail pages
 * launched from Overview cards (Benchmarks, AI Readability, Fix, Track,
 * Brand DNA, Connect, audit detail). Provides a one-click path back to
 * Overview plus a static breadcrumb trail.
 */
export default function OverviewBreadcrumb({
  current,
  parent,
}: {
  current: string;
  parent?: { label: string; href: string };
}) {
  const { workspaceSlug } = useWorkspace();
  const prefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-[12px] flex-wrap">
        <li className="inline-flex items-center">
          <Link
            href={`${prefix}/overview`}
            className="inline-flex items-center gap-1 hover:underline"
            style={{ color: 'var(--m-muted)' }}
          >
            <ArrowLeft size={11} />
            Overview
          </Link>
        </li>
        {parent && (
          <li className="inline-flex items-center gap-1.5">
            <ChevronRight size={11} style={{ color: 'var(--m-muted)', opacity: 0.6 }} />
            <Link
              href={parent.href}
              className="hover:underline"
              style={{ color: 'var(--m-muted)' }}
            >
              {parent.label}
            </Link>
          </li>
        )}
        <li className="inline-flex items-center gap-1.5">
          <ChevronRight size={11} style={{ color: 'var(--m-muted)', opacity: 0.6 }} />
          <span className="font-medium" style={{ color: 'var(--ink)' }}>{current}</span>
        </li>
      </ol>
    </nav>
  );
}
