'use client';

import React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  AlertTriangle,
  Globe,
  Smartphone,
  Brain,
  Sparkles,
  Fingerprint,
  FileSearch,
  LayoutDashboard,
  PlusCircle,
  Settings,
  Coins,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';

export type AuditTab =
  | 'overview'
  | 'summary'
  | 'findings'
  | 'pages'
  | 'responsive'
  | 'ai_xray'
  | 'intelligence'
  | 'brand_identity'
  | 'brand_audit';

interface AuditSidebarProps {
  domain: string;
  productUrl: string;
  activeTab: AuditTab;
  onTabChange: (tab: AuditTab) => void;
  findingsCount: number;
  pagesCount: number;
  responsiveCount: number;
  userName?: string | null;
  userEmail?: string | null;
}

interface NavItem {
  id: AuditTab;
  label: string;
  icon: React.ElementType;
  count?: number | null;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const AuditSidebar: React.FC<AuditSidebarProps> = ({
  domain,
  productUrl,
  activeTab,
  onTabChange,
  findingsCount,
  pagesCount,
  responsiveCount,
  userName,
  userEmail,
}) => {
  const sections: NavSection[] = [
    {
      title: 'Audit',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'summary', label: 'Summary', icon: BarChart3 },
        { id: 'findings', label: 'Findings', icon: AlertTriangle, count: findingsCount || null },
        { id: 'pages', label: 'Pages', icon: Globe, count: pagesCount || null },
        { id: 'responsive', label: 'Responsive', icon: Smartphone, count: responsiveCount || null },
        { id: 'ai_xray', label: 'AI X-Ray', icon: Brain },
        { id: 'intelligence', label: 'Intelligence', icon: Sparkles },
      ],
    },
    {
      title: 'Brand',
      items: [
        { id: 'brand_identity', label: 'Brand identity', icon: Fingerprint },
        { id: 'brand_audit', label: 'Brand audit', icon: FileSearch },
      ],
    },
  ];

  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : userEmail?.[0]?.toUpperCase() || '?';

  return (
    <aside
      className="hidden lg:flex flex-col w-[230px] flex-shrink-0 h-full overflow-hidden border-r border-rule"
      style={{ background: 'var(--card)' }}
    >
      {/* Top actions — New Audit + Dashboard */}
      <div className="px-3 pt-4 pb-2 space-y-1">
        <Link
          href="/dashboard/new-audit"
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: 'var(--signal)', color: 'var(--paper)' }}
        >
          <PlusCircle size={15} strokeWidth={2} />
          <span>New audit</span>
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-m-muted hover:text-ink hover:bg-paper-2 transition-colors"
        >
          <LayoutDashboard size={15} />
          <span>Dashboard</span>
        </Link>
      </div>

      {/* Brand / domain selection dropdown */}
      <div className="px-3 py-3 border-b border-rule">
        <a
          href={productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-3 rounded-xl border border-rule hover:border-signal/40 hover:bg-paper-2 transition-all group"
        >
          {/* Favicon */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: 'var(--signal)', color: 'var(--paper)' }}
          >
            {domain.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">{domain}</p>
            <p className="text-[10px] text-m-muted truncate">{productUrl}</p>
          </div>
          <ChevronDown size={13} className="text-m-muted flex-shrink-0" />
        </a>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold text-m-muted tracking-[0.06em] uppercase px-2 mb-1.5">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors text-left',
                      isActive
                        ? 'bg-signal/8 text-signal'
                        : 'text-m-muted hover:text-ink hover:bg-paper-2',
                    )}
                  >
                    <Icon size={15} className={clsx('flex-shrink-0', isActive && 'text-signal')} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.count != null && item.count > 0 && (
                      <span
                        className={clsx(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
                          isActive ? 'bg-signal/15 text-signal' : 'bg-paper-2 text-m-muted',
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — Account + Configuration */}
      <div className="border-t border-rule px-3 py-3 space-y-1">
        {/* Account holder */}
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: 'var(--paper-2)', color: 'var(--ink)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {userName && <p className="text-[12px] font-medium text-ink truncate">{userName}</p>}
            <p className="text-[10px] text-m-muted truncate">{userEmail}</p>
          </div>
        </div>
        {/* Config links */}
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-m-muted hover:text-ink hover:bg-paper-2 transition-colors"
        >
          <Settings size={14} className="flex-shrink-0" />
          <span>Settings</span>
        </Link>
        <Link
          href="/dashboard/settings?tab=billing"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-m-muted hover:text-ink hover:bg-paper-2 transition-colors"
        >
          <Coins size={14} className="flex-shrink-0" />
          <span>Buy credits</span>
        </Link>
      </div>
    </aside>
  );
};

export default AuditSidebar;
