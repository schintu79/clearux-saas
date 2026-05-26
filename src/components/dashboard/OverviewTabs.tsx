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
      className="inline-flex items-center rounded-lg p-1 gap-0.5 mb-5"
      style={{ background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
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
