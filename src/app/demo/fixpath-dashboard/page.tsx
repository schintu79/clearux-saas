'use client';

/**
 * /demo/fixpath-dashboard — public, static design preview of the
 * simplified Fixpath.ai dashboard direction.
 *
 * SAFETY NOTES (read before editing):
 *  - This route is intentionally self-contained. It MUST NOT import any
 *    auth-protected hook, Supabase client, or server action. All data
 *    on this page is hardcoded fake mock data.
 *  - The page is not linked from the app and is `noindex` via layout
 *    metadata. It exists so design reviewers can inspect the new
 *    selected-brand-workspace structure without credentials.
 *  - If you need to extend it, add more mock data — do NOT reach for the
 *    real audit/finding types or fetchers.
 *
 * IA rule for this preview:
 *  - When viewing a brand, the shell shows ONLY that brand's workspace.
 *  - Portfolio is a separate parent context entered via "All brands".
 *  - There is no Portfolio peer tab inside a brand workspace.
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Filter,
  Search,
  Check,
  Copy,
  Sparkles,
  Globe,
  Fingerprint,
  Plus,
  LayoutDashboard,
  Wrench,
  LineChart,
  FileText,
  Settings,
  ChevronDown,
  RefreshCw,
  Bell,
} from 'lucide-react';

// ----------------------------------------------------------------
// Mock data — entirely fabricated. Do not connect to any real source.
// ----------------------------------------------------------------

type Severity = 'critical' | 'high' | 'medium' | 'low';
type Effort = 'Quick win' | 'Standard' | 'Complex';
type Status = 'open' | 'in_progress' | 'fixed' | 'backlog';

interface MockFinding {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  module: string;
  effort: Effort;
  status: Status;
  page_url: string;
  snippet?: string;
}

const MODULES = [
  'Foundation',
  'Clarity',
  'Conversion',
  'Accessibility',
  'AI Visibility',
  'Performance',
];

const MOCK_BRANDS = [
  {
    id: 'northwind',
    name: 'Northwind Apparel',
    domain: 'northwind-apparel.example',
    score: 64,
    priorScore: 58,
    completedAt: '2026-05-12T14:22:00Z',
    critical: 1,
    open: 6,
    fixedThisMonth: 4,
  },
  {
    id: 'helios',
    name: 'Helios Coffee Co.',
    domain: 'helioscoffee.example',
    score: 81,
    priorScore: 79,
    completedAt: '2026-05-09T10:11:00Z',
    critical: 0,
    open: 2,
    fixedThisMonth: 2,
  },
  {
    id: 'atlas',
    name: 'Atlas Outdoor',
    domain: 'atlasoutdoor.example',
    score: 38,
    priorScore: 41,
    completedAt: '2026-05-14T16:48:00Z',
    critical: 3,
    open: 11,
    fixedThisMonth: 1,
  },
  {
    id: 'lumen',
    name: 'Lumen Skincare',
    domain: 'lumenskincare.example',
    score: 72,
    priorScore: 68,
    completedAt: '2026-05-10T09:30:00Z',
    critical: 0,
    open: 4,
    fixedThisMonth: 3,
  },
];

const MOCK_MODULE_SCORES: Array<{ name: string; score: number; delta: number }> = [
  { name: 'Foundation',    score: 78, delta: 4 },
  { name: 'Clarity',       score: 52, delta: -3 },
  { name: 'Conversion',    score: 61, delta: 8 },
  { name: 'Accessibility', score: 44, delta: 6 },
  { name: 'AI Visibility', score: 71, delta: 12 },
  { name: 'Performance',   score: 80, delta: 2 },
];

const MOCK_FINDINGS: MockFinding[] = [
  {
    id: 'f1',
    title: 'Hero headline does not communicate value proposition',
    description: 'The above-the-fold headline reads "Welcome" instead of describing what the brand sells or to whom. First-time visitors and AI crawlers cannot infer the offer in under five seconds.',
    severity: 'critical',
    module: 'Clarity',
    effort: 'Quick win',
    status: 'open',
    page_url: 'https://northwind-apparel.example/',
    snippet: '<h1>Sustainable everyday wear, made in Portugal.</h1>',
  },
  {
    id: 'f2',
    title: 'Primary CTA contrast fails WCAG AA on hero background',
    description: 'The "Shop now" button uses #B8C4D0 on #A0AEC0, yielding a contrast ratio of 2.1:1 against the photographic hero. WCAG AA requires 4.5:1.',
    severity: 'high',
    module: 'Accessibility',
    effort: 'Quick win',
    status: 'open',
    page_url: 'https://northwind-apparel.example/',
    snippet: '.btn-primary { background: #0F172A; color: #FFFFFF; }',
  },
  {
    id: 'f3',
    title: 'Product pages missing structured data (Product / Offer)',
    description: 'No JSON-LD on /products/* — search engines and AI answer engines cannot extract price, availability, or rating.',
    severity: 'high',
    module: 'AI Visibility',
    effort: 'Standard',
    status: 'open',
    page_url: 'https://northwind-apparel.example/products/linen-shirt',
  },
  {
    id: 'f4',
    title: 'Checkout requires account creation before address entry',
    description: 'Forced-registration patterns reduce conversion by 24–35% across DTC verticals. Guest checkout is buried two clicks deep.',
    severity: 'high',
    module: 'Conversion',
    effort: 'Complex',
    status: 'in_progress',
    page_url: 'https://northwind-apparel.example/checkout',
  },
  {
    id: 'f5',
    title: 'LCP element is a 2.4 MB hero image without modern format',
    description: 'Hero JPEG is 2.4 MB, served at full resolution to mobile. LCP is 4.8s on a fast 3G profile. Target: <2.5s.',
    severity: 'medium',
    module: 'Performance',
    effort: 'Standard',
    status: 'open',
    page_url: 'https://northwind-apparel.example/',
  },
  {
    id: 'f6',
    title: 'Inconsistent brand voice between homepage and product copy',
    description: 'Homepage copy is warm and personal while product descriptions are passive and clinical. Mixed register erodes trust.',
    severity: 'medium',
    module: 'Clarity',
    effort: 'Standard',
    status: 'open',
    page_url: 'https://northwind-apparel.example/products',
  },
  {
    id: 'f7',
    title: 'Footer trust signals (returns policy, contact) below the fold',
    description: 'Returns, shipping, and contact links sit only in the footer. First-time buyers cannot locate them without scrolling past three sections.',
    severity: 'low',
    module: 'Conversion',
    effort: 'Quick win',
    status: 'open',
    page_url: 'https://northwind-apparel.example/products/linen-shirt',
  },
  {
    id: 'f8',
    title: 'Mobile nav drawer traps focus when opened via keyboard',
    description: 'Tab order escapes the drawer to underlying content. Screen-reader users hear stale page content while the drawer is open.',
    severity: 'medium',
    module: 'Accessibility',
    effort: 'Standard',
    status: 'fixed',
    page_url: 'https://northwind-apparel.example/',
  },
];

const MOCK_TREND: Array<{ score: number; date: string }> = [
  { score: 42, date: '2026-02-04' },
  { score: 47, date: '2026-02-25' },
  { score: 51, date: '2026-03-18' },
  { score: 58, date: '2026-04-22' },
  { score: 64, date: '2026-05-12' },
];

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--fp-muted)';
  if (s >= 70) return 'var(--fp-ok)';
  if (s >= 40) return 'var(--fp-warn)';
  return 'var(--fp-severe)';
}

function severityColor(sev: Severity): string {
  if (sev === 'critical') return 'var(--fp-severe)';
  if (sev === 'high')     return 'var(--fp-warn)';
  if (sev === 'medium')   return 'var(--fp-signal)';
  return 'var(--fp-muted)';
}

function severityLabel(sev: Severity): string {
  return sev.charAt(0).toUpperCase() + sev.slice(1);
}

function deltaTone(d: number | null): string {
  if (d == null || d === 0) return 'var(--fp-muted)';
  return d > 0 ? 'var(--fp-ok)' : 'var(--fp-severe)';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ----------------------------------------------------------------
// Shell — sidebar + topbar + content area
// ----------------------------------------------------------------

type BrandTab = 'overview' | 'find' | 'fix' | 'track' | 'brand-dna' | 'reports' | 'settings';
type Context = { kind: 'portfolio' } | { kind: 'brand'; brandId: string; tab: BrandTab };

function DemoBanner() {
  return (
    <div
      role="status"
      data-testid="demo-banner"
      className="w-full px-4 py-2 text-center text-[11px] font-medium tracking-[0.03em] uppercase"
      style={{
        background: '#fff7e0',
        color: '#8a6d10',
        borderBottom: '1px solid #f0e3b6',
      }}
    >
      Preview · Fixpath dashboard direction · Static mock data only
    </div>
  );
}

function SidebarLogo() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: '#14130F' }}
      >
        <Sparkles size={15} style={{ color: '#F2EDE3' }} />
      </span>
      <span className="font-sans font-semibold text-[15px] leading-none tracking-[-0.01em]" style={{ color: '#14130F' }}>
        Fixpath<span style={{ color: '#8A857A' }}>.ai</span>
      </span>
    </div>
  );
}

function BrandSwitcher({
  brand,
  open,
  setOpen,
  onPick,
  onAllBrands,
}: {
  brand: typeof MOCK_BRANDS[number];
  open: boolean;
  setOpen: (b: boolean) => void;
  onPick: (id: string) => void;
  onAllBrands: () => void;
}) {
  return (
    <div className="relative px-3 pb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors text-left"
        style={{ background: '#ffffff', border: '1px solid #e6e2d6' }}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="brand-switcher"
      >
        <span
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: '#14130F', color: '#F2EDE3' }}
        >
          <Fingerprint size={13} strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold leading-tight truncate" style={{ color: '#14130F' }}>
            {brand.name}
          </span>
          <span className="block text-[11px] leading-tight truncate mt-0.5" style={{ color: '#8A857A' }}>
            {brand.domain}
          </span>
        </span>
        <ChevronDown size={14} style={{ color: '#8A857A' }} />
      </button>

      {open && (
        <div
          className="absolute left-3 right-3 mt-1.5 rounded-lg overflow-hidden z-50 shadow-md"
          style={{ background: '#ffffff', border: '1px solid #e6e2d6' }}
          role="listbox"
        >
          <div className="max-h-[280px] overflow-y-auto py-1">
            {MOCK_BRANDS.map((b) => {
              const selected = b.id === brand.id;
              return (
                <button
                  key={b.id}
                  role="option"
                  aria-selected={selected}
                  onClick={() => { onPick(b.id); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#f5f3ee]"
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: '#f5f3ee', border: '1px solid #e6e2d6', color: '#8A857A' }}
                  >
                    <Globe size={11} strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px] font-medium truncate leading-tight" style={{ color: '#14130F' }}>
                      {b.name}
                    </span>
                    <span className="block text-[10px] truncate leading-tight mt-0.5" style={{ color: '#8A857A' }}>
                      {b.domain}
                    </span>
                  </span>
                  {selected && <Check size={12} style={{ color: '#5E6B2F' }} />}
                </button>
              );
            })}
          </div>
          <div style={{ borderTop: '1px solid #ece8db' }}>
            <button
              onClick={() => { onAllBrands(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors hover:bg-[#f5f3ee]"
              style={{ color: '#14130F' }}
            >
              <ArrowLeft size={12} />
              All brands
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandSidebar({
  ctx,
  setCtx,
  brand,
}: {
  ctx: Context;
  setCtx: (c: Context) => void;
  brand: typeof MOCK_BRANDS[number];
}) {
  const [open, setOpen] = useState(false);

  const items: { tab: BrandTab; label: string; icon: React.ElementType }[] = [
    { tab: 'overview',  label: 'Overview',  icon: LayoutDashboard },
    { tab: 'find',      label: 'Find',      icon: Search },
    { tab: 'fix',       label: 'Fix',       icon: Wrench },
    { tab: 'track',     label: 'Track',     icon: LineChart },
    { tab: 'brand-dna', label: 'Brand DNA', icon: Fingerprint },
    { tab: 'reports',   label: 'Reports',   icon: FileText },
    { tab: 'settings',  label: 'Settings',  icon: Settings },
  ];

  return (
    <aside
      className="flex flex-col w-[240px] flex-shrink-0"
      style={{ background: '#f3f2ee', borderRight: '1px solid #e6e2d6' }}
      data-testid="brand-sidebar"
      data-sidebar-bg="#f3f2ee"
      aria-label="Brand workspace navigation"
    >
      <SidebarLogo />

      <BrandSwitcher
        brand={brand}
        open={open}
        setOpen={setOpen}
        onPick={(id) => setCtx({ kind: 'brand', brandId: id, tab: ctx.kind === 'brand' ? ctx.tab : 'overview' })}
        onAllBrands={() => setCtx({ kind: 'portfolio' })}
      />

      <nav aria-label="Brand sections" className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: '#8A857A' }}>
          Workspace
        </p>
        <ul className="space-y-0.5">
          {items.map((it) => {
            const Icon = it.icon;
            const active = ctx.kind === 'brand' && ctx.tab === it.tab;
            return (
              <li key={it.tab}>
                <button
                  type="button"
                  onClick={() => setCtx({ kind: 'brand', brandId: brand.id, tab: it.tab })}
                  data-testid={`nav-${it.tab}`}
                  data-active={active ? 'true' : 'false'}
                  aria-current={active ? 'page' : undefined}
                  className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] text-left transition-colors"
                  style={{
                    color: active ? '#14130F' : '#3a372f',
                    background: active ? '#ffffff' : 'transparent',
                    boxShadow: active ? '0 1px 2px rgba(20,19,15,0.04)' : undefined,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon size={15} strokeWidth={1.75} style={{ color: active ? '#14130F' : '#8A857A' }} />
                  <span className="truncate">{it.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-3 py-3" style={{ borderTop: '1px solid #e6e2d6' }}>
        <button
          type="button"
          onClick={() => setCtx({ kind: 'portfolio' })}
          data-testid="nav-all-brands"
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors hover:bg-white"
          style={{ color: '#3a372f' }}
        >
          <ArrowLeft size={13} />
          Back to all brands
        </button>
      </div>
    </aside>
  );
}

function PortfolioSidebar({
  ctx,
  setCtx,
}: {
  ctx: Context;
  setCtx: (c: Context) => void;
}) {
  return (
    <aside
      className="flex flex-col w-[240px] flex-shrink-0"
      style={{ background: '#f3f2ee', borderRight: '1px solid #e6e2d6' }}
      data-testid="portfolio-sidebar"
      data-sidebar-bg="#f3f2ee"
      aria-label="Portfolio navigation"
    >
      <SidebarLogo />

      <div className="px-3 pb-3">
        <div
          className="px-3 py-2.5 rounded-lg"
          style={{ background: '#ffffff', border: '1px solid #e6e2d6' }}
        >
          <p className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: '#8A857A' }}>
            Context
          </p>
          <p className="text-[13px] font-semibold mt-1" style={{ color: '#14130F' }}>
            All brands
          </p>
          <p className="text-[11px]" style={{ color: '#8A857A' }}>
            {MOCK_BRANDS.length} brands tracked
          </p>
        </div>
      </div>

      <nav aria-label="Portfolio sections" className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: '#8A857A' }}>
          Portfolio
        </p>
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] text-left"
              style={{ color: '#14130F', background: '#ffffff', fontWeight: 600 }}
              aria-current="page"
            >
              <LayoutDashboard size={15} strokeWidth={1.75} style={{ color: '#14130F' }} />
              All brands
            </button>
          </li>
        </ul>

        <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: '#8A857A' }}>
          Quick pick
        </p>
        <ul className="space-y-0.5">
          {MOCK_BRANDS.slice(0, 4).map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => setCtx({ kind: 'brand', brandId: b.id, tab: 'overview' })}
                className="w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[12px] text-left transition-colors hover:bg-white"
                style={{ color: '#3a372f' }}
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: '#ffffff', border: '1px solid #e6e2d6', color: '#8A857A' }}
                >
                  <Globe size={10} strokeWidth={1.75} />
                </span>
                <span className="truncate">{b.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-3 py-3" style={{ borderTop: '1px solid #e6e2d6' }}>
        <p className="text-[10px]" style={{ color: '#8A857A' }}>
          Demo preview · not signed in
        </p>
      </div>
    </aside>
  );
}

function Topbar({
  title,
  subtitle,
  primaryAction,
}: {
  title: string;
  subtitle?: string;
  primaryAction?: { label: string; icon?: React.ElementType };
}) {
  const Icon = primaryAction?.icon;
  return (
    <div
      className="h-14 flex items-center justify-between px-6 gap-4"
      style={{ background: '#ffffff', borderBottom: '1px solid #ece8db' }}
    >
      <div className="min-w-0">
        <h1 className="text-[15px] font-semibold leading-none tracking-[-0.01em]" style={{ color: '#14130F' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] mt-1 leading-none truncate" style={{ color: '#8A857A' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="w-9 h-9 rounded-md inline-flex items-center justify-center transition-colors hover:bg-[#f5f3ee]"
          aria-label="Notifications"
          type="button"
        >
          <Bell size={15} strokeWidth={1.75} style={{ color: '#3a372f' }} />
        </button>
        {primaryAction && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#14130F', color: '#F2EDE3' }}
          >
            {Icon && <Icon size={13} strokeWidth={1.75} />}
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Cards / common UI
// ----------------------------------------------------------------

function MetricCard({
  label,
  value,
  delta,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  delta?: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: '#ffffff', border: '1px solid #ece8db' }}
    >
      <p className="text-[11px] font-medium tracking-[0.03em] uppercase" style={{ color: '#8A857A' }}>
        {label}
      </p>
      <p className="font-sans font-semibold tabular-nums mt-2 leading-none" style={{ color: tone || '#14130F', fontSize: 30 }}>
        {value}
      </p>
      {(delta || hint) && (
        <p className="text-[11px] mt-2" style={{ color: '#8A857A' }}>
          {delta && <span className="font-medium" style={{ color: tone }}>{delta}</span>}
          {delta && hint && ' · '}
          {hint}
        </p>
      )}
    </div>
  );
}

function ScoreRing({ score, size = 96, stroke = 8 }: { score: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const col = scoreColor(score);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ece8db" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={col} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-sans font-semibold tabular-nums leading-none" style={{ fontSize: size / 3.6, color: col }}>
          {score}
        </span>
        <span className="text-[9px] tracking-[0.06em] uppercase mt-1" style={{ color: '#8A857A' }}>
          Health
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Overview tab — simplified, 4 metrics + one obvious Next Best Fix
// ----------------------------------------------------------------

function OverviewPage({ brand }: { brand: typeof MOCK_BRANDS[number] }) {
  const delta = brand.score - brand.priorScore;
  const next = MOCK_FINDINGS.find((f) => f.status === 'open') || MOCK_FINDINGS[0];
  const topIssues = MOCK_FINDINGS
    .filter((f) => f.status === 'open' || f.status === 'in_progress')
    .slice(0, 3);

  return (
    <div className="p-6 lg:p-8 max-w-[1180px] mx-auto" data-testid="page-overview">
      {/* Top metric row — 4 simple cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
          <ScoreRing score={brand.score} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.03em] uppercase" style={{ color: '#8A857A' }}>
              Website Health Score
            </p>
            <p className="text-[12px] font-medium mt-1.5 inline-flex items-center gap-1" style={{ color: deltaTone(delta) }}>
              {delta > 0 ? <TrendingUp size={11} /> : delta < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
              {delta > 0 ? '+' : ''}{delta} pts
            </p>
          </div>
        </div>
        <MetricCard
          label="Open critical"
          value={brand.critical}
          tone={brand.critical > 0 ? 'var(--fp-severe)' : '#14130F'}
          hint={`${brand.open} total open`}
        />
        <MetricCard
          label="Fixed last 30 days"
          value={brand.fixedThisMonth}
          tone="var(--fp-ok)"
          hint="across all modules"
        />
        <MetricCard
          label="Last audit"
          value={fmtDate(brand.completedAt).split(',')[0]}
          hint="re-audit available"
        />
      </div>

      {/* Next best fix — one obvious card */}
      <div
        className="rounded-xl p-6 mb-6 flex flex-col lg:flex-row gap-5 lg:items-center"
        style={{ background: '#ffffff', border: '1px solid #ece8db' }}
        data-testid="next-best-fix"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#5E6B2F' }}>
            Next best fix
          </p>
          <h2 className="text-[18px] font-sans font-semibold mt-1.5 leading-snug" style={{ color: '#14130F' }}>
            {next.title}
          </h2>
          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#56524a' }}>
            {next.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px]" style={{ color: '#8A857A' }}>
            <span className="font-semibold" style={{ color: severityColor(next.severity) }}>
              {severityLabel(next.severity)}
            </span>
            <span>{next.module}</span>
            <span>{next.effort}</span>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-[13px] font-semibold self-start lg:self-auto"
          style={{ background: '#14130F', color: '#F2EDE3' }}
        >
          Fix this
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Two-up: Top issues + Module health */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <div
          className="rounded-xl p-5"
          style={{ background: '#ffffff', border: '1px solid #ece8db' }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-semibold tracking-[0.03em] uppercase" style={{ color: '#3a372f' }}>
              Top issues hurting your score
            </p>
            <span className="text-[11px]" style={{ color: '#8A857A' }}>3 of {brand.open}</span>
          </div>
          <ul className="space-y-1">
            {topIssues.map((f) => (
              <li
                key={f.id}
                className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
                style={{ borderColor: '#f0ecdf' }}
              >
                <span
                  className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ background: severityColor(f.severity) }}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium leading-snug" style={{ color: '#14130F' }}>
                    {f.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#8A857A' }}>
                    {severityLabel(f.severity)} · {f.module} · {f.effort}
                  </p>
                </div>
                <span className="text-[11px] font-semibold inline-flex items-center gap-1 mt-1" style={{ color: '#5E6B2F' }}>
                  Fix
                  <ArrowRight size={10} />
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: '#ffffff', border: '1px solid #ece8db' }}
        >
          <p className="text-[12px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#3a372f' }}>
            Module health
          </p>
          <ul className="space-y-2">
            {MOCK_MODULE_SCORES.map((m) => (
              <li key={m.name} className="flex items-center gap-3">
                <span className="text-[12px] flex-1 truncate" style={{ color: '#3a372f' }}>{m.name}</span>
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: '#f0ecdf' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${m.score}%`, background: scoreColor(m.score) }}
                  />
                </div>
                <span className="text-[12px] font-semibold tabular-nums w-7 text-right" style={{ color: scoreColor(m.score) }}>
                  {m.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Find tab
// ----------------------------------------------------------------

function FindPage() {
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const open = MOCK_FINDINGS.filter((f) => f.status === 'open' || f.status === 'in_progress');
  const filtered = open.filter((f) => {
    if (moduleFilter !== 'all' && f.module !== moduleFilter) return false;
    if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!`${f.title} ${f.description}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1180px] mx-auto" data-testid="page-find">
      <div
        className="rounded-xl p-4 mb-4 flex flex-col gap-3"
        style={{ background: '#ffffff', border: '1px solid #ece8db' }}
      >
        <div className="flex items-center gap-2">
          <Filter size={12} style={{ color: '#8A857A' }} />
          <p className="text-[11px] font-medium tracking-[0.03em] uppercase" style={{ color: '#8A857A' }}>
            Filters
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8A857A' }} />
            <input
              type="search"
              placeholder="Search findings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-md text-[13px] outline-none focus:ring-2 focus:ring-[#5E6B2F]/30"
              style={{ background: '#fbfaf6', border: '1px solid #ece8db', color: '#14130F' }}
              aria-label="Search findings"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-md text-[13px] outline-none"
            style={{ background: '#fbfaf6', border: '1px solid #ece8db', color: '#14130F' }}
          >
            <option value="all">All modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={sevFilter}
            onChange={(e) => setSevFilter(e.target.value)}
            className="px-3 py-2 rounded-md text-[13px] outline-none"
            style={{ background: '#fbfaf6', border: '1px solid #ece8db', color: '#14130F' }}
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <p className="text-[11px] mb-3" style={{ color: '#8A857A' }}>
        {filtered.length} of {open.length} open issues
      </p>

      <div className="rounded-xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: '#fbfaf6', borderBottom: '1px solid #ece8db' }}>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Issue</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Module</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Severity</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Effort</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-b last:border-b-0 hover:bg-[#fbfaf6] transition-colors" style={{ borderColor: '#f0ecdf' }}>
                <td className="px-4 py-3">
                  <p className="font-medium leading-tight" style={{ color: '#14130F' }}>{f.title}</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: '#8A857A' }}>{f.page_url.replace(/^https?:\/\//, '')}</p>
                </td>
                <td className="px-3 py-3 text-[12px]" style={{ color: '#3a372f' }}>{f.module}</td>
                <td className="px-3 py-3 text-[12px] font-semibold" style={{ color: severityColor(f.severity) }}>
                  {severityLabel(f.severity)}
                </td>
                <td className="px-3 py-3 text-[12px]" style={{ color: '#3a372f' }}>{f.effort}</td>
                <td className="px-4 py-3 text-right">
                  <button className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: '#5E6B2F' }}>
                    Fix
                    <ArrowRight size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Fix tab — kanban-style columns
// ----------------------------------------------------------------

function FixCard({ finding }: { finding: MockFinding }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    if (!finding.snippet) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(finding.snippet).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-lg p-3" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
      <div className="flex items-start gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ background: severityColor(finding.severity) }}
          aria-hidden
        />
        <p className="text-[12.5px] font-semibold leading-snug flex-1 min-w-0" style={{ color: '#14130F' }}>
          {finding.title}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px]" style={{ color: '#8A857A' }}>
        <span className="font-semibold" style={{ color: severityColor(finding.severity) }}>
          {severityLabel(finding.severity)}
        </span>
        <span>·</span>
        <span>{finding.module}</span>
        <span>·</span>
        <span>{finding.effort}</span>
      </div>
      {finding.snippet && (
        <button
          onClick={onCopy}
          className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-semibold"
          style={{ background: '#f5f3ee', border: '1px solid #e6e2d6', color: '#3a372f' }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Copied' : 'View fix'}
        </button>
      )}
    </div>
  );
}

function FixPage() {
  const ready = MOCK_FINDINGS.filter((f) => f.status === 'open' && f.effort === 'Quick win');
  const inProgress = MOCK_FINDINGS.filter((f) => f.status === 'in_progress');
  const fixed = MOCK_FINDINGS.filter((f) => f.status === 'fixed');
  const backlog = MOCK_FINDINGS.filter((f) => f.status === 'open' && f.effort !== 'Quick win');

  const cols: Array<{ label: string; items: MockFinding[]; tone: string }> = [
    { label: 'Ready',    items: ready,      tone: '#5E6B2F' },
    { label: 'In progress', items: inProgress, tone: '#9A7A2C' },
    { label: 'Fixed',    items: fixed,      tone: '#3F6B3F' },
    { label: 'Backlog',  items: backlog,    tone: '#8A857A' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-[1320px] mx-auto" data-testid="page-fix">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cols.map((col) => (
          <div key={col.label} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold tracking-[0.06em] uppercase" style={{ color: col.tone }}>
                {col.label}
              </p>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#8A857A' }}>
                {col.items.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 min-h-[120px]">
              {col.items.length === 0 ? (
                <p className="text-[11px] px-1 py-3" style={{ color: '#8A857A' }}>
                  Nothing here yet.
                </p>
              ) : col.items.map((f) => <FixCard key={f.id} finding={f} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Track tab
// ----------------------------------------------------------------

function ScoreLine({ points }: { points: Array<{ score: number; date: string }> }) {
  const w = 600;
  const h = 120;
  const max = 100;
  const stepX = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = h - (p.score / max) * h;
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const fillPath = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 12}`} width="100%" height={h + 12} role="img" aria-label="Score trend">
      <path d={fillPath} fill="rgba(94, 107, 47, 0.08)" />
      <path d={path} fill="none" stroke="#5E6B2F" strokeWidth={2} />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#5E6B2F" />
      ))}
    </svg>
  );
}

function TrackPage({ brand }: { brand: typeof MOCK_BRANDS[number] }) {
  const delta = brand.score - brand.priorScore;
  const open = MOCK_FINDINGS.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const fixed = MOCK_FINDINGS.filter((f) => f.status === 'fixed').length;

  return (
    <div className="p-6 lg:p-8 max-w-[1180px] mx-auto" data-testid="page-track">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-4">
        <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[0.03em] uppercase" style={{ color: '#8A857A' }}>
              Score over time
            </p>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: deltaTone(delta) }}>
              {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {delta > 0 ? '+' : ''}{delta} pts vs. previous
            </span>
          </div>
          <ScoreLine points={MOCK_TREND} />
          <p className="text-[11px] mt-2" style={{ color: '#8A857A' }}>
            {MOCK_TREND.length} audits · {fmtDate(MOCK_TREND[0].date)} → {fmtDate(MOCK_TREND[MOCK_TREND.length - 1].date)}
          </p>
        </div>
        <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
          <p className="text-[11px] font-semibold tracking-[0.03em] uppercase" style={{ color: '#8A857A' }}>
            Issues
          </p>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: '#3a372f' }}>Open</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: '#8B3A2C' }}>{open}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: '#3a372f' }}>Fixed</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: '#3F6B3F' }}>{fixed}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 mb-4" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
        <p className="text-[11px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#8A857A' }}>
          Module deltas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MOCK_MODULE_SCORES.map((m) => (
            <div key={m.name} className="rounded-lg px-3 py-3" style={{ background: '#fbfaf6', border: '1px solid #f0ecdf' }}>
              <p className="text-[10px] font-medium tracking-[0.03em] uppercase leading-tight" style={{ color: '#8A857A' }}>
                {m.name}
              </p>
              <p className="text-[18px] font-sans font-semibold tabular-nums mt-1" style={{ color: scoreColor(m.score) }}>
                {m.score}
              </p>
              <p className="text-[11px] mt-0.5 font-semibold" style={{ color: deltaTone(m.delta) }}>
                {m.delta > 0 ? '+' : ''}{m.delta} pts
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
        <p className="text-[11px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#8A857A' }}>
          Recent audits
        </p>
        <ul className="space-y-1">
          {[...MOCK_TREND].reverse().map((h, idx, arr) => {
            const prev = arr[idx + 1]?.score ?? null;
            const d = prev != null ? h.score - prev : null;
            return (
              <li
                key={h.date}
                className="flex items-center gap-3 py-2 border-b last:border-b-0"
                style={{ borderColor: '#f0ecdf' }}
              >
                <Clock size={12} style={{ color: '#8A857A' }} />
                <span className="text-[12px] flex-1" style={{ color: '#3a372f' }}>
                  {fmtDate(h.date)}
                </span>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: scoreColor(h.score) }}>
                  {h.score}
                </span>
                {d != null && d !== 0 && (
                  <span className="text-[11px] font-semibold w-10 text-right" style={{ color: deltaTone(d) }}>
                    {d > 0 ? '+' : ''}{d}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Brand DNA, Reports, Settings — lightweight pages so demo IA is complete
// ----------------------------------------------------------------

function BrandDnaPage({ brand }: { brand: typeof MOCK_BRANDS[number] }) {
  return (
    <div className="p-6 lg:p-8 max-w-[1180px] mx-auto" data-testid="page-brand-dna">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
          <p className="text-[11px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#8A857A' }}>
            Brand basics
          </p>
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt style={{ color: '#8A857A' }}>Name</dt>
              <dd style={{ color: '#14130F' }} className="font-medium">{brand.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: '#8A857A' }}>Domain</dt>
              <dd style={{ color: '#14130F' }} className="font-medium">{brand.domain}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: '#8A857A' }}>Category</dt>
              <dd style={{ color: '#14130F' }} className="font-medium">Apparel · DTC</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt style={{ color: '#8A857A' }}>Audience</dt>
              <dd style={{ color: '#14130F' }} className="font-medium">25–45, urban, EU</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
          <p className="text-[11px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#8A857A' }}>
            Voice & tone
          </p>
          <ul className="space-y-2 text-[13px]" style={{ color: '#3a372f' }}>
            <li>Warm, plainspoken, confident.</li>
            <li>Short sentences. Specific nouns.</li>
            <li>Avoid superlatives and marketing filler.</li>
          </ul>
        </div>
        <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
          <p className="text-[11px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#8A857A' }}>
            Visual identity
          </p>
          <div className="flex gap-2 mb-3">
            {['#14130F', '#5E6B2F', '#F3F2EE', '#FFFFFF'].map((c) => (
              <div key={c} className="w-9 h-9 rounded-md" style={{ background: c, border: '1px solid #ece8db' }} />
            ))}
          </div>
          <p className="text-[12px]" style={{ color: '#3a372f' }}>
            DM Sans · 4-color palette · subtle texture
          </p>
        </div>
        <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
          <p className="text-[11px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#8A857A' }}>
            Completeness
          </p>
          <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: '#f0ecdf' }}>
            <div className="h-full rounded-full" style={{ width: '72%', background: '#5E6B2F' }} />
          </div>
          <p className="text-[12px]" style={{ color: '#8A857A' }}>
            72% complete — add tagline and voice examples to reach 100%.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportsPage({ brand }: { brand: typeof MOCK_BRANDS[number] }) {
  const reports = [
    { id: 'r1', label: 'Full audit · May 12', when: '2026-05-12' },
    { id: 'r2', label: 'Full audit · Apr 22', when: '2026-04-22' },
    { id: 'r3', label: 'Full audit · Mar 18', when: '2026-03-18' },
  ];
  return (
    <div className="p-6 lg:p-8 max-w-[1180px] mx-auto" data-testid="page-reports">
      <div className="rounded-xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: '#fbfaf6', borderBottom: '1px solid #ece8db' }}>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Report</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Date</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0" style={{ borderColor: '#f0ecdf' }}>
                <td className="px-4 py-3 font-medium" style={{ color: '#14130F' }}>
                  {brand.name} — {r.label}
                </td>
                <td className="px-3 py-3" style={{ color: '#3a372f' }}>{fmtDate(r.when)}</td>
                <td className="px-4 py-3 text-right">
                  <button className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: '#5E6B2F' }}>
                    Download
                    <ArrowRight size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsPage({ brand }: { brand: typeof MOCK_BRANDS[number] }) {
  return (
    <div className="p-6 lg:p-8 max-w-[760px] mx-auto" data-testid="page-settings">
      <div className="rounded-xl p-5" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
        <p className="text-[11px] font-semibold tracking-[0.03em] uppercase mb-3" style={{ color: '#8A857A' }}>
          Brand settings
        </p>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium block mb-1" style={{ color: '#3a372f' }}>Brand name</label>
            <input
              type="text" defaultValue={brand.name}
              className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
              style={{ background: '#fbfaf6', border: '1px solid #ece8db', color: '#14130F' }}
            />
          </div>
          <div>
            <label className="text-[12px] font-medium block mb-1" style={{ color: '#3a372f' }}>Primary domain</label>
            <input
              type="text" defaultValue={brand.domain}
              className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
              style={{ background: '#fbfaf6', border: '1px solid #ece8db', color: '#14130F' }}
            />
          </div>
          <div>
            <label className="text-[12px] font-medium block mb-1" style={{ color: '#3a372f' }}>Audit cadence</label>
            <select
              defaultValue="monthly"
              className="w-full px-3 py-2 rounded-md text-[13px] outline-none"
              style={{ background: '#fbfaf6', border: '1px solid #ece8db', color: '#14130F' }}
            >
              <option value="monthly">Monthly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Portfolio page (parent context)
// ----------------------------------------------------------------

function PortfolioPage({ setCtx }: { setCtx: (c: Context) => void }) {
  const sorted = [...MOCK_BRANDS].sort((a, b) => {
    if (a.critical !== b.critical) return b.critical - a.critical;
    return a.score - b.score;
  });
  return (
    <div className="p-6 lg:p-8 max-w-[1180px] mx-auto" data-testid="page-portfolio">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Brands" value={MOCK_BRANDS.length} hint="tracked" />
        <MetricCard
          label="Average score"
          value={Math.round(MOCK_BRANDS.reduce((s, b) => s + b.score, 0) / MOCK_BRANDS.length)}
          tone="#14130F"
        />
        <MetricCard
          label="Critical issues"
          value={MOCK_BRANDS.reduce((s, b) => s + b.critical, 0)}
          tone="var(--fp-severe)"
          hint="across portfolio"
        />
        <MetricCard
          label="Fixed last 30 days"
          value={MOCK_BRANDS.reduce((s, b) => s + b.fixedThisMonth, 0)}
          tone="var(--fp-ok)"
        />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #ece8db' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: '#fbfaf6', borderBottom: '1px solid #ece8db' }}>
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Brand</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Score</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Critical</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Last audit</th>
              <th className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}>Next best fix</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-semibold tracking-[0.06em] uppercase" style={{ color: '#8A857A' }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const delta = b.score - b.priorScore;
              return (
                <tr
                  key={b.id}
                  className="border-b last:border-b-0 hover:bg-[#fbfaf6] transition-colors cursor-pointer"
                  style={{ borderColor: '#f0ecdf' }}
                  onClick={() => setCtx({ kind: 'brand', brandId: b.id, tab: 'overview' })}
                  data-testid={`portfolio-row-${b.id}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold leading-tight" style={{ color: '#14130F' }}>{b.name}</p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: '#8A857A' }}>{b.domain}</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[15px] font-semibold tabular-nums" style={{ color: scoreColor(b.score) }}>
                      {b.score}
                    </span>
                    <span className="text-[10px] ml-2 font-semibold" style={{ color: deltaTone(delta) }}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: b.critical > 0 ? 'var(--fp-severe)' : '#3a372f' }}>
                      {b.critical}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: '#3a372f' }}>
                    {fmtDate(b.completedAt).split(',')[0]}
                  </td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: '#3a372f' }}>
                    {b.critical > 0 ? 'Critical issue blocking conversion' : 'Improve module deltas'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ArrowRight size={13} style={{ color: '#8A857A' }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

const DEMO_SCOPED_STYLES = `
[data-testid="fixpath-demo-root"] {
  --fp-paper: #f9f8f4;
  --fp-card:  #ffffff;
  --fp-ink:   #14130F;
  --fp-ink-2: #3a372f;
  --fp-muted: #8A857A;
  --fp-rule:  #ece8db;
  --fp-signal:#5E6B2F;
  --fp-ok:    #3F6B3F;
  --fp-warn:  #9A7A2C;
  --fp-severe:#8B3A2C;
  background: var(--fp-paper);
  color: var(--fp-ink);
  font-family: var(--font-sans, system-ui, sans-serif);
  min-height: 100vh;
}
[data-testid="fixpath-demo-root"] * { box-sizing: border-box; }
`;

export default function FixpathDashboardPreviewPage() {
  const [ctx, setCtx] = useState<Context>({ kind: 'brand', brandId: 'northwind', tab: 'overview' });

  const brand = ctx.kind === 'brand'
    ? MOCK_BRANDS.find((b) => b.id === ctx.brandId) ?? MOCK_BRANDS[0]
    : MOCK_BRANDS[0];

  const tabTitleMap: Record<BrandTab, { title: string; subtitle: string }> = {
    'overview':  { title: 'Overview',  subtitle: 'What you should do next, in order of impact.' },
    'find':      { title: 'Find',      subtitle: 'What is hurting this brand, ranked by severity.' },
    'fix':       { title: 'Fix',       subtitle: 'Quick wins first. Track each fix from ready to done.' },
    'track':     { title: 'Track',     subtitle: 'Is this brand improving? Score, deltas, and audit history.' },
    'brand-dna': { title: 'Brand DNA', subtitle: 'What Fixpath compares this brand against.' },
    'reports':   { title: 'Reports',   subtitle: 'Download or share audit reports.' },
    'settings':  { title: 'Settings',  subtitle: 'Domain, cadence, and brand preferences.' },
  };

  return (
    <div data-testid="fixpath-demo-root">
      <style dangerouslySetInnerHTML={{ __html: DEMO_SCOPED_STYLES }} />
      <DemoBanner />
      <div className="flex" style={{ minHeight: 'calc(100vh - 38px)' }}>
        {ctx.kind === 'brand' ? (
          <BrandSidebar ctx={ctx} setCtx={setCtx} brand={brand} />
        ) : (
          <PortfolioSidebar ctx={ctx} setCtx={setCtx} />
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {ctx.kind === 'brand' ? (
            <>
              <Topbar
                title={`${brand.name} — ${tabTitleMap[ctx.tab].title}`}
                subtitle={tabTitleMap[ctx.tab].subtitle}
                primaryAction={{ label: 'Re-audit', icon: RefreshCw }}
              />
              <main className="flex-1 overflow-auto" data-testid="brand-workspace" data-brand-id={brand.id} data-tab={ctx.tab}>
                {ctx.tab === 'overview'  && <OverviewPage brand={brand} />}
                {ctx.tab === 'find'      && <FindPage />}
                {ctx.tab === 'fix'       && <FixPage />}
                {ctx.tab === 'track'     && <TrackPage brand={brand} />}
                {ctx.tab === 'brand-dna' && <BrandDnaPage brand={brand} />}
                {ctx.tab === 'reports'   && <ReportsPage brand={brand} />}
                {ctx.tab === 'settings'  && <SettingsPage brand={brand} />}
              </main>
            </>
          ) : (
            <>
              <Topbar
                title="All brands"
                subtitle="Which brand needs attention first? Sorted by risk."
                primaryAction={{ label: 'Add brand', icon: Plus }}
              />
              <main className="flex-1 overflow-auto" data-testid="portfolio-workspace">
                <PortfolioPage setCtx={setCtx} />
              </main>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
