'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Fingerprint } from 'lucide-react';

const tabs = [
  { label: 'Website', href: '/dashboard/overview', icon: Globe },
  { label: 'Brand DNA', href: '/dashboard/brand-dna', icon: Fingerprint },
] as const;

export default function OverviewTabs() {
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-1 mb-5 pb-3"
      style={{ borderBottom: '1px solid var(--rule)' }}
      role="tablist"
      aria-label="Overview scope"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(tab.href + '/');
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors"
            style={{
              color: active ? 'var(--ink)' : 'var(--m-muted)',
              background: active ? 'var(--paper-2)' : 'transparent',
              border: active ? '1px solid var(--rule)' : '1px solid transparent',
            }}
          >
            <Icon size={13} strokeWidth={1.75} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
