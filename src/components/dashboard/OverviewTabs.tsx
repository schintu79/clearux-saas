'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Fingerprint } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';

const TAB_ROUTES = [
  { label: 'Website', route: '/overview', icon: Globe },
  { label: 'Brand DNA', route: '/brand-dna', icon: Fingerprint },
] as const;

export default function OverviewTabs() {
  const pathname = usePathname();
  const { workspaceSlug } = useWorkspace();

  // Build workspace-aware prefix: /dashboard/[slug] or /dashboard
  const prefix = workspaceSlug ? `/dashboard/${workspaceSlug}` : '/dashboard';

  return (
    <div
      className="inline-flex items-center rounded-lg p-1 gap-0.5 mb-5"
      style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
      role="tablist"
      aria-label="Overview scope"
    >
      {TAB_ROUTES.map((tab) => {
        const href = `${prefix}${tab.route}`;
        const active = pathname === href || pathname?.startsWith(href + '/');
        const Icon = tab.icon;
        return (
          <Link
            key={tab.route}
            href={href}
            role="tab"
            aria-selected={active}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all"
            style={{
              background: active ? 'var(--card)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--m-muted)',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={14} strokeWidth={1.75} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
