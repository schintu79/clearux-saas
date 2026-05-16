'use client';

/**
 * /demo/fixpath-dashboard — public, static design preview of the
 * Fixpath.ai dashboard direction.
 *
 * SAFETY NOTES (read before editing):
 *  - This route is intentionally self-contained. It MUST NOT import any
 *    auth-protected hook, Supabase client, or server action. All data
 *    on this page is hardcoded fake mock data.
 *  - The page is not linked from the app and is `noindex` via layout
 *    metadata. It exists so design reviewers can inspect the new
 *    Find/Fix/Track structure without credentials.
 *  - If you need to extend it, add more mock data — do NOT reach for the
 *    real audit/finding types or fetchers.
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Filter,
  Search,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  Globe,
  Fingerprint,
  Plus,
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

const MOCK_BRAND = {
  name: 'Northwind Apparel',
  domain: 'northwind-apparel.example',
  score: 64,
  priorScore: 58,
  completedAt: '2026-05-12T14:22:00Z',
};

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
    description: 'The above-the-fold headline reads "Welcome" instead of describing what the brand sells or to whom. First-time visitors and AI crawlers cannot infer the offer in under five seconds, which is the strongest known predictor of bounce on landing pages.',
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
    description: 'The "Shop now" button uses #B8C4D0 on #A0AEC0, yielding a contrast ratio of 2.1:1 against the photographic hero. WCAG AA requires 4.5:1 for text and 3:1 for graphical controls.',
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
    description: 'No JSON-LD on /products/* — search engines and AI answer engines cannot extract price, availability, or rating. This blocks rich results and reduces AI-citation likelihood.',
    severity: 'high',
    module: 'AI Visibility',
    effort: 'Standard',
    status: 'open',
    page_url: 'https://northwind-apparel.example/products/linen-shirt',
  },
  {
    id: 'f4',
    title: 'Checkout requires account creation before address entry',
    description: 'Forced-registration patterns reduce conversion by 24–35% across DTC verticals. The current flow asks for an account before showing guest checkout, which is buried two clicks deep.',
    severity: 'high',
    module: 'Conversion',
    effort: 'Complex',
    status: 'in_progress',
    page_url: 'https://northwind-apparel.example/checkout',
  },
  {
    id: 'f5',
    title: 'LCP element is a 2.4 MB hero image without modern format',
    description: 'Hero JPEG is 2.4 MB, served at full resolution to mobile. Largest Contentful Paint is 4.8s on a fast 3G profile. Targets: <2.5s.',
    severity: 'medium',
    module: 'Performance',
    effort: 'Standard',
    status: 'open',
    page_url: 'https://northwind-apparel.example/',
    snippet: '<picture><source type="image/avif" srcset="hero.avif"/><img src="hero.jpg" loading="eager"/></picture>',
  },
  {
    id: 'f6',
    title: 'Inconsistent brand voice between homepage and product copy',
    description: 'Homepage copy is warm and personal ("we") while product descriptions are passive and clinical. Mixed register erodes perceived brand trust.',
    severity: 'medium',
    module: 'Clarity',
    effort: 'Standard',
    status: 'open',
    page_url: 'https://northwind-apparel.example/products',
  },
  {
    id: 'f7',
    title: 'Footer trust signals (returns policy, contact) below the fold',
    description: 'Returns, shipping, and contact links sit only in the footer. First-time buyers cannot locate them from the product page without scrolling past three sections.',
    severity: 'low',
    module: 'Conversion',
    effort: 'Quick win',
    status: 'open',
    page_url: 'https://northwind-apparel.example/products/linen-shirt',
  },
  {
    id: 'f8',
    title: 'Mobile nav drawer traps focus when opened via keyboard',
    description: 'Tab order escapes the drawer to underlying content. Screen-reader users hear stale page content while the drawer is visually open.',
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

const MOCK_PORTFOLIO = [
  { name: 'Northwind Apparel',  url: 'northwind-apparel.example',  score: 64, prior: 58, critical: 1, open: 6 },
  { name: 'Helios Coffee Co.',  url: 'helioscoffee.example',       score: 81, prior: 79, critical: 0, open: 2 },
  { name: 'Atlas Outdoor',      url: 'atlasoutdoor.example',       score: 38, prior: 41, critical: 3, open: 11 },
  { name: 'Lumen Skincare',     url: 'lumenskincare.example',      score: 72, prior: 68, critical: 0, open: 4 },
];

// ----------------------------------------------------------------
// Helpers (mirror the real app's tone, but operate on mock types)
// ----------------------------------------------------------------

function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)';
  if (s >= 70) return 'var(--ok)';
  if (s >= 40) return 'var(--warn)';
  return 'var(--severe)';
}

function severityColor(sev: Severity): string {
  if (sev === 'critical') return 'var(--severe)';
  if (sev === 'high')     return 'var(--warn)';
  if (sev === 'medium')   return 'var(--signal)';
  return 'var(--m-muted)';
}

function severityLabel(sev: Severity): string {
  return sev.charAt(0).toUpperCase() + sev.slice(1);
}

function deltaTone(d: number | null): string {
  if (d == null || d === 0) return 'var(--m-muted)';
  return d > 0 ? 'var(--ok)' : 'var(--severe)';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ----------------------------------------------------------------
// Shared chrome
// ----------------------------------------------------------------

function DemoBanner() {
  return (
    <div
      role="status"
      className="w-full px-4 py-2 text-center text-[12px] font-semibold tracking-[0.04em] uppercase"
      style={{
        background: 'color-mix(in srgb, var(--warn) 12%, transparent)',
        color: 'var(--warn)',
        borderBottom: '1px solid color-mix(in srgb, var(--warn) 24%, transparent)',
      }}
    >
      Preview · Fixpath Dashboard Design Direction · Static mock data only
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--ink)' }}
        >
          <Sparkles size={16} style={{ color: 'var(--paper)' }} />
        </div>
        <div>
          <p className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            Fixpath<span style={{ color: 'var(--m-muted)' }}>.ai</span>
          </p>
          <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
            Find. Fix. Track.
          </p>
        </div>
      </div>
      <div className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
        Demo preview · not signed in
      </div>
    </div>
  );
}

const TABS = ['Overview', 'Find', 'Fix', 'Track', 'Portfolio'] as const;
type Tab = typeof TABS[number];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      className="flex items-center gap-1 mb-6 p-1 rounded-xl"
      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
    >
      {TABS.map((t) => {
        const isActive = t === active;
        return (
          <button
            key={t}
            onClick={() => onChange(t)}
            className="flex-1 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all"
            style={{
              background: isActive ? 'var(--card)' : 'transparent',
              color: isActive ? 'var(--ink)' : 'var(--m-muted)',
              boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------
// Overview tab
// ----------------------------------------------------------------

function ScoreCard() {
  const score = MOCK_BRAND.score;
  const delta = score - MOCK_BRAND.priorScore;
  const size = 110;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const col = scoreColor(score);
  return (
    <div
      className="rounded-xl p-6 flex items-center gap-6"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={col}
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-sans font-semibold tabular-nums leading-none" style={{ fontSize: 32, color: col }}>
            {score}
          </span>
          <span className="text-[10px] tracking-[0.08em] uppercase mt-1.5" style={{ color: 'var(--m-muted)' }}>
            Brand Health
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          Latest audit
        </p>
        <p className="text-[18px] font-sans font-semibold mt-1 truncate" style={{ color: 'var(--ink)' }}>
          {MOCK_BRAND.domain}
        </p>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: deltaTone(delta) }}
          >
            {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
            {delta > 0 ? '+' : ''}{delta} pts vs. previous
          </span>
          <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--m-muted)' }}>
            <Clock size={11} />
            Completed {fmtDate(MOCK_BRAND.completedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

function NextActionCard() {
  const next = MOCK_FINDINGS[0];
  return (
    <div
      className="rounded-xl p-5 flex flex-col justify-between gap-3"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div>
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
          Next action
        </p>
        <p className="text-[14px] font-sans font-semibold mt-1.5 leading-snug" style={{ color: 'var(--ink)' }}>
          Fix this: {next.title}
        </p>
        <p className="text-[12px] mt-1.5 leading-relaxed line-clamp-3" style={{ color: 'var(--m-muted)' }}>
          {next.description}
        </p>
      </div>
      <button
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all hover:opacity-90 self-start"
        style={{ background: 'var(--ink)', color: 'var(--paper)' }}
      >
        Fix this
        <ArrowRight size={13} />
      </button>
    </div>
  );
}

function ModuleStrip() {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
        Module scores
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {MOCK_MODULE_SCORES.map((m) => (
          <div
            key={m.name}
            className="rounded-lg px-3 py-3"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
          >
            <p className="text-[10px] font-semibold tracking-[0.04em] uppercase leading-tight" style={{ color: 'var(--m-muted)' }}>
              {m.name}
            </p>
            <p className="text-[20px] font-sans font-semibold tabular-nums mt-1" style={{ color: scoreColor(m.score) }}>
              {m.score}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab() {
  const top3 = MOCK_FINDINGS.filter((f) => f.status === 'open' || f.status === 'in_progress').slice(0, 3);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Overview
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What you should do next, in order of impact.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
        <ScoreCard />
        <NextActionCard />
      </div>

      <div className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
          Top 3 issues hurting your score
        </p>
        <ul className="space-y-2">
          {top3.map((f) => (
            <li
              key={f.id}
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: severityColor(f.severity) }}
                aria-hidden
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  {f.title}
                </span>
                <span className="block text-[11px] mt-1" style={{ color: 'var(--m-muted)' }}>
                  {severityLabel(f.severity)} · {f.module} · {f.page_url.replace(/^https?:\/\//, '')}
                </span>
              </span>
              <span
                className="inline-flex items-center gap-1 text-[12px] font-medium"
                style={{ color: 'var(--signal)' }}
              >
                Fix
                <ArrowRight size={11} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ModuleStrip />

      <div
        className="mt-6 rounded-xl p-4 flex items-start gap-3"
        style={{ background: 'color-mix(in srgb, var(--signal) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--signal) 12%, transparent)' }}
      >
        <RefreshCw size={15} style={{ color: 'var(--signal)' }} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
            Re-audit to track your progress
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted)' }}>
            Fixpath scores the delta between audits and surfaces regressions.
          </p>
        </div>
      </div>

      <p className="text-[11px] mt-4" style={{ color: 'var(--m-muted)' }}>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle size={10} />
          Last audit completed {fmtDate(MOCK_BRAND.completedAt)}.
        </span>
      </p>
    </div>
  );
}

// ----------------------------------------------------------------
// Find tab
// ----------------------------------------------------------------

function FindTab() {
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [effortFilter, setEffortFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const open = MOCK_FINDINGS.filter((f) => f.status === 'open' || f.status === 'in_progress');
  const filtered = open.filter((f) => {
    if (moduleFilter !== 'all' && f.module !== moduleFilter) return false;
    if (sevFilter !== 'all' && f.severity !== sevFilter) return false;
    if (effortFilter !== 'all' && f.effort !== effortFilter) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      const hay = `${f.title} ${f.description} ${f.page_url}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Find
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What is hurting your score, ranked by severity and impact.
        </p>
      </div>

      <div
        className="rounded-xl p-4 mb-4 flex flex-col gap-3"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="flex items-center gap-2">
          <Filter size={13} style={{ color: 'var(--m-muted)' }} />
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
            Filter findings
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--m-muted)' }} />
            <input
              type="search"
              placeholder="Search findings..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg text-[13px] outline-none"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Search findings"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          >
            <option value="all">All modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={sevFilter}
            onChange={(e) => setSevFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={effortFilter}
            onChange={(e) => setEffortFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-[13px] outline-none"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
          >
            <option value="all">All effort</option>
            <option value="Quick win">Quick win</option>
            <option value="Standard">Standard</option>
            <option value="Complex">Complex</option>
          </select>
        </div>
      </div>

      <div className="mb-2 text-[12px]" style={{ color: 'var(--m-muted)' }}>
        Showing {filtered.length} of {open.length} open finding{open.length === 1 ? '' : 's'}
      </div>

      <ul className="space-y-2">
        {filtered.map((f) => (
          <li
            key={f.id}
            className="rounded-xl p-4"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
          >
            <div className="flex items-start gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: severityColor(f.severity) }}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  {f.title}
                </p>
                <p className="text-[12px] mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--m-muted)' }}>
                  {f.description}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]" style={{ color: 'var(--m-muted)' }}>
                  <span className="font-semibold" style={{ color: severityColor(f.severity) }}>
                    {severityLabel(f.severity)}
                  </span>
                  <span>{f.module}</span>
                  <span>{f.effort}</span>
                  <span className="truncate">{f.page_url.replace(/^https?:\/\//, '')}</span>
                </div>
              </div>
              <ArrowRight size={13} className="flex-shrink-0 mt-1" style={{ color: 'var(--m-muted)' }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------
// Fix tab
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
    <article
      className="rounded-xl p-5"
      style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
          style={{ background: severityColor(finding.severity) }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {finding.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]" style={{ color: 'var(--m-muted)' }}>
            <span className="font-semibold" style={{ color: severityColor(finding.severity) }}>
              {severityLabel(finding.severity)}
            </span>
            <span>{finding.module}</span>
            <span>{finding.effort}</span>
            <span className="inline-flex items-center gap-0.5 truncate max-w-[260px]">
              {finding.page_url.replace(/^https?:\/\//, '')}
              <ExternalLink size={9} />
            </span>
          </div>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed mb-3" style={{ color: 'var(--ink-2)' }}>
        {finding.description}
      </p>

      {finding.snippet && (
        <div
          className="rounded-lg p-3 font-mono text-[11px] leading-relaxed relative"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink)' }}
        >
          <button
            onClick={onCopy}
            className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold"
            style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
            aria-label="Copy snippet"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre className="whitespace-pre-wrap pr-16">{finding.snippet}</pre>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          Mark fixed
          <CheckCircle2 size={11} />
        </button>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}
        >
          Move to backlog
        </button>
      </div>
    </article>
  );
}

function FixTab() {
  const queue = MOCK_FINDINGS
    .filter((f) => f.status === 'open' || f.status === 'in_progress')
    .slice(0, 5);
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Fix
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          What you can fix right now — quick wins first, then severity.
        </p>
      </div>
      <ul className="space-y-3">
        {queue.map((f) => (
          <li key={f.id}>
            <FixCard finding={f} />
          </li>
        ))}
      </ul>
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
  const min = 0;
  const range = max - min;
  const stepX = w / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = h - ((p.score - min) / range) * h;
    return [x, y] as const;
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 12}`} width="100%" height={h + 12} role="img" aria-label="Score trend">
      <path d={path} fill="none" stroke="var(--signal)" strokeWidth={2} />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="var(--signal)" />
      ))}
    </svg>
  );
}

function TrackTab() {
  const score = MOCK_BRAND.score;
  const priorScore = MOCK_BRAND.priorScore;
  const delta = score - priorScore;
  const open = MOCK_FINDINGS.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const fixed = MOCK_FINDINGS.filter((f) => f.status === 'fixed').length;
  const backlog = MOCK_FINDINGS.filter((f) => f.status === 'backlog').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
          Track
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
          Are you getting better? Compare scores, fixed vs. open issues, and module shifts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-6">
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
              Score over time
            </p>
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: deltaTone(delta) }}>
              {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
              {delta > 0 ? '+' : ''}{delta} pts vs. previous
            </span>
          </div>
          <ScoreLine points={MOCK_TREND} />
          <p className="text-[11px] mt-2" style={{ color: 'var(--m-muted)' }}>
            {MOCK_TREND.length} audits · oldest {fmtDate(MOCK_TREND[0].date)} · latest {fmtDate(MOCK_TREND[MOCK_TREND.length - 1].date)}
          </p>
        </div>

        <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <p className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--m-muted)' }}>
            Issues
          </p>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Open</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--severe)' }}>{open}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Fixed</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--ok)' }}>{fixed}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>Backlog</span>
              <span className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--signal)' }}>{backlog}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
          Module deltas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MOCK_MODULE_SCORES.map((m) => (
            <div
              key={m.name}
              className="rounded-lg px-3 py-3"
              style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
            >
              <p className="text-[10px] font-semibold tracking-[0.04em] uppercase leading-tight" style={{ color: 'var(--m-muted)' }}>
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

      <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase mb-3" style={{ color: 'var(--m-muted)' }}>
          Recent audits
        </p>
        <ul className="space-y-2">
          {[...MOCK_TREND].reverse().map((h, idx, arr) => {
            const prev = arr[idx + 1]?.score ?? null;
            const d = prev != null ? h.score - prev : null;
            return (
              <li
                key={h.date}
                className="flex items-center gap-3 rounded-lg px-3 py-2"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
              >
                <Clock size={12} style={{ color: 'var(--m-muted)' }} />
                <span className="text-[12px] flex-1" style={{ color: 'var(--ink-2)' }}>
                  {fmtDate(h.date)}
                </span>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: scoreColor(h.score) }}>
                  {h.score}
                </span>
                {d != null && d !== 0 && (
                  <span className="text-[11px] font-semibold" style={{ color: deltaTone(d) }}>
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
// Portfolio tab (agency view)
// ----------------------------------------------------------------

function PortfolioTab() {
  const sorted = [...MOCK_PORTFOLIO].sort((a, b) => {
    if (a.critical !== b.critical) return b.critical - a.critical;
    return a.score - b.score;
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-sans font-semibold tracking-[-0.01em]" style={{ color: 'var(--ink)' }}>
            Portfolio
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--m-muted)' }}>
            Which brand needs attention first? Sorted by risk.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-semibold"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          <Plus size={13} />
          Add brand
        </button>
      </div>

      <ul className="space-y-2">
        {sorted.map((b) => {
          const delta = b.score - b.prior;
          return (
            <li
              key={b.url}
              className="rounded-xl p-4 flex items-center gap-4"
              style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
              >
                <Fingerprint size={15} style={{ color: 'var(--m-muted)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
                  {b.name}
                </p>
                <p className="text-[11px] mt-0.5 inline-flex items-center gap-1" style={{ color: 'var(--m-muted)' }}>
                  <Globe size={10} />
                  {b.url}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-[0.04em] font-semibold" style={{ color: 'var(--m-muted)' }}>
                  Open
                </p>
                <p className="text-[14px] font-semibold tabular-nums" style={{ color: 'var(--ink-2)' }}>
                  {b.open} <span className="text-[11px]" style={{ color: 'var(--severe)' }}>({b.critical} crit)</span>
                </p>
              </div>
              <div className="text-right min-w-[64px]">
                <p className="text-[11px] uppercase tracking-[0.04em] font-semibold" style={{ color: 'var(--m-muted)' }}>
                  Score
                </p>
                <p className="text-[20px] font-semibold tabular-nums" style={{ color: scoreColor(b.score) }}>
                  {b.score}
                </p>
                <p className="text-[10px] font-semibold" style={{ color: deltaTone(delta) }}>
                  {delta > 0 ? '+' : ''}{delta} pts
                </p>
              </div>
              <ArrowRight size={14} style={{ color: 'var(--m-muted)' }} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------------
// Page
// ----------------------------------------------------------------

export default function FixpathDashboardPreviewPage() {
  const [tab, setTab] = useState<Tab>('Overview');

  return (
    <div style={{ background: 'var(--paper)', minHeight: '100vh' }}>
      <DemoBanner />
      <main className="max-w-[1100px] mx-auto px-5 py-8">
        <BrandHeader />
        <TabBar active={tab} onChange={setTab} />
        {tab === 'Overview'  && <OverviewTab />}
        {tab === 'Find'      && <FindTab />}
        {tab === 'Fix'       && <FixTab />}
        {tab === 'Track'     && <TrackTab />}
        {tab === 'Portfolio' && <PortfolioTab />}

        <footer className="mt-12 pt-6 text-center text-[11px]" style={{ color: 'var(--m-muted)', borderTop: '1px solid var(--rule)' }}>
          Fixpath.ai — Find. Fix. Track. · Design preview with mock data · Not connected to any user account.
        </footer>
      </main>
    </div>
  );
}
