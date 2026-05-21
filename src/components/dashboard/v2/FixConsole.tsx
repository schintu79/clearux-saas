'use client';

/**
 * FixConsole — unified Deploy Console for a single finding.
 *
 * Two resolution paths:
 *  1. "Fix it yourself" — Generate Fix → Preview → Approve → Deploy.
 *     Status tracking is fully manual — nothing here auto-changes status.
 *     Every deployed change is reversible (backup + undo).
 *  2. "Let your team handle it" — read-only recommendation + Copy / Download.
 *     Lightweight handoff, no deploy controls.
 *
 * Scope boundary:
 *  - SURGICAL (deployable): copy edits, typos, HTML strings, schema, meta tags,
 *    scripts, semantic HTML, new files in the FTP root.
 *  - DESIGN WORK (not deployable): new sections, FAQ blocks, testimonials,
 *    visuals, imagery, layout redesign.
 *
 * Strategic findings (finding_type === 'strategic') never appear in the Fix
 * Console — they're filtered at the page level. This component only handles
 * findings where finding_type === 'fixable'.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  Download,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Loader2,
  HelpCircle,
  Upload,
  X,
  Server,
  Wrench,
  Users,
  Palette,
  ClipboardList,
  ArrowRight,
  FileText,
  Globe,
  Code,
  Tag,
  FileCode,
  PenLine,
  FilePlus,
  Settings,
  Layers,
  Languages,
  Eye,
} from 'lucide-react';
// FixPreviewPanel removed — search/social/assistant previews were causing confusion
import type { AuditFinding, FixType as DbFixType } from '@/types/database';
import DiffPreview from './DiffPreview';
import type { SurgicalFixResult } from '@/lib/surgical-fix';
import { detectBatchPattern } from '@/lib/surgical-fix';

export interface FtpConnectionForDeploy {
  id: string;
  label: string;
  protocol: string;
  host: string;
  remote_path: string;
}

/* ── Fix type classification (UI-level) ─────────────────── */

type UiFixType =
  | 'copy'
  | 'heading'
  | 'meta'
  | 'schema'
  | 'accessibility'
  | 'content'
  | 'technical'
  | 'design';

/**
 * Fix classification — the 4-way gate that determines what the console
 * shows for each finding. Every finding MUST be classified before render.
 *
 *  fixable_surgical    → Can be deployed via FTP. Purely textual / code changes
 *                        to EXISTING elements (copy edits, meta tags, schema,
 *                        alt text, heading text, scripts, technical files).
 *  fixable_bulk        → Same as surgical but affects multiple pages.
 *  requires_design_work → Needs new UI sections, visual assets, layout changes,
 *                        or content that can't be auto-generated. Show guidance
 *                        and handoff brief, NOT a deploy button.
 *  strategic_comment   → High-level strategic recommendation with no concrete
 *                        fix. Show as read-only insight.
 */
export type FixClassification =
  | 'fixable_surgical'
  | 'fixable_bulk'
  | 'requires_design_work'
  | 'strategic_comment';

/** Fix types that require design assets — cannot be deployed via FTP. */
const DESIGN_FIX_TYPES = new Set<UiFixType>(['design']);

/** Fix types where the change is visible on the rendered page. */
export const VISUAL_FIX_TYPES = new Set<UiFixType>(['copy', 'heading', 'content']);

/** Surgical scope: fix types that CAN be auto-generated and deployed. */
const SURGICAL_SCOPE = new Set<DbFixType | null>(['html', 'meta', 'schema', 'copy', 'file', 'config']);

/**
 * Patterns that signal the fix requires creating NEW UI sections or visual
 * assets — not just editing existing content. These trigger the hard gate:
 * "Can this be applied safely without creating new UI?"
 */
const REQUIRES_NEW_UI_PATTERNS = [
  // New sections / blocks
  /\b(add|create|build|introduce|insert|include)\b.*\b(section|block|module|component|widget|panel|area|zone)\b/,
  /\bnew\s+(section|block|module|component|widget|panel|area)\b/,
  // FAQ, testimonials, reviews — always new UI
  /\b(faq\s+section|faq\s+block|faq\s+page|frequently\s+asked|add\s+faq|create\s+faq)\b/,
  /\b(testimonial|review\s+section|customer\s+stories|social\s+proof\s+section|trust\s+section)\b/,
  // Visual/imagery creation
  /\b(add|create|design|produce|commission)\b.*\b(infographic|illustration|photograph|custom\s+image|video|animation|interactive)\b/,
  // Layout redesign
  /\b(redesign|restructure|reorganize|rearrange|rebuild|overhaul)\b.*\b(layout|page|section|navigation|header|footer)\b/,
  /\b(layout\s+change|new\s+layout|different\s+layout)\b/,
  // New pages
  /\b(create|build|add)\b.*\b(landing\s+page|new\s+page|dedicated\s+page)\b/,
  // Visual elements that need design work
  /\b(icon\s+set|icon\s+system|custom\s+icons|branded\s+icons)\b/,
  /\b(hero\s+banner|hero\s+image|banner\s+design|feature\s+image)\b/,
  /\b(brand\s+visual|visual\s+identity|design\s+system)\b/,
  // Comparison tables, pricing tables (new structured UI)
  /\b(comparison\s+table|pricing\s+table|feature\s+matrix)\b/,
  // Call-to-action blocks (not just CTA text changes)
  /\b(cta\s+section|cta\s+block|call.to.action\s+section)\b/,
];

/**
 * Hard gate: "Can this be applied safely without creating new UI?"
 * Returns true if the recommendation text signals that new UI elements,
 * visual assets, or layout restructuring is required.
 */
function requiresNewUi(finding: AuditFinding): boolean {
  const blob = `${finding.title} ${finding.description} ${finding.recommendation || ''}`.toLowerCase();
  return REQUIRES_NEW_UI_PATTERNS.some((pattern) => pattern.test(blob));
}

/** Impact category for a finding — what dimension of the site it affects. */
export type ImpactCategory =
  | 'ai_visibility'
  | 'seo'
  | 'perception'
  | 'readability'
  | 'technical'
  | 'accessibility';

/** Infer the primary impact category from the finding content. */
export function inferImpact(finding: AuditFinding): ImpactCategory {
  const blob = `${finding.title} ${finding.description} ${finding.recommendation || ''}`.toLowerCase();
  if (/\b(ai\s+visibility|llm|ai\s+bot|ai\s+assistant|machine\s+read|structured\s+data|schema|json-?ld|llms\.txt)\b/.test(blob)) return 'ai_visibility';
  if (/\b(seo|search\s+engine|rank|index|crawl|sitemap|canonical|meta\s+description|title\s+tag|og:|open\s+graph|robots)\b/.test(blob)) return 'seo';
  if (/\b(aria|wcag|screen\s+reader|accessib|contrast|alt\s+text|keyboard\s+nav|focus\s+indicator)\b/.test(blob)) return 'accessibility';
  if (/\b(readab|clarity|comprehensi|plain\s+language|jargon|sentence\s+length|paragraph)\b/.test(blob)) return 'readability';
  if (/\b(redirect|performance|cache|lazy|speed|load\s+time|minif|compress|cdn|ssl|https|security|header)\b/.test(blob)) return 'technical';
  return 'perception';
}

const IMPACT_META: Record<ImpactCategory, { label: string; color: string }> = {
  ai_visibility: { label: 'AI visibility', color: 'var(--signal)' },
  seo:           { label: 'SEO', color: 'var(--signal)' },
  perception:    { label: 'Brand perception', color: 'var(--signal)' },
  readability:   { label: 'Readability', color: 'var(--signal)' },
  technical:     { label: 'Technical health', color: 'var(--signal)' },
  accessibility: { label: 'Accessibility', color: 'var(--signal)' },
};

export function inferFixType(finding: AuditFinding): UiFixType {
  const blob = `${finding.title} ${finding.description} ${finding.recommendation || ''}`.toLowerCase();
  // Schema/structured-data fixes are code, not design — check first to avoid
  // false positives when the recommendation mentions "logo" or "image" fields.
  if (/json|schema\.org|ld\+json|structured data|jsonld/.test(blob)) return 'schema';
  if (/meta description|og:|open graph|<meta/.test(blob)) return 'meta';
  // Design-type fixes: new visual assets, imagery, or layout work.
  // Expanded to catch FAQ sections, testimonials, new UI blocks, etc.
  if (/\b(icon|infographic|illustrat|photograph|image|visual|graphic|logo|banner|hero image|design element|custom art|brand.*visual)\b/.test(blob)
    && /\b(add|create|include|introduce|place|insert|design|produce)\b/.test(blob)) return 'design';
  // Hard gate: if the recommendation asks to create new sections/blocks, it's design work
  if (requiresNewUi(finding)) return 'design';
  if (/heading|h1|h2|h3|title tag/.test(blob)) return 'heading';
  if (/alt text|aria|contrast|wcag|screen reader|accessib/.test(blob)) return 'accessibility';
  // FAQ copy edits (not new sections) — e.g. "update FAQ answer text"
  if (/\b(paragraph|copy|tagline|wording|message|button text)\b/.test(blob)) return 'copy';
  if (/\bcta\b/.test(blob) && !/\bsection\b/.test(blob) && !/\bblock\b/.test(blob)) return 'copy';
  if (/redirect|sitemap|robots|canonical|performance|cache|lazy/.test(blob)) return 'technical';
  return 'content';
}

/**
 * Classify a finding into one of the 4 fix categories.
 * This is the HARD GATE — every finding must pass through this before
 * the console decides what UI to show.
 */
export function classifyFinding(
  finding: AuditFinding,
  uiFixType: UiFixType,
  affectedPages: string[],
): FixClassification {
  // Gate 1: strategic findings are always comments
  if (finding.finding_type === 'strategic') return 'strategic_comment';

  // Gate 2: design type (from inferFixType) → requires design work
  if (DESIGN_FIX_TYPES.has(uiFixType)) return 'requires_design_work';

  // Gate 3: HARD GATE — "Can this be applied safely without creating new UI?"
  // Skip for code-only fix types (schema, meta, technical) — these are never
  // design work even if the wording mentions "add block" or "add section".
  const CODE_ONLY_FIX_TYPES = new Set<UiFixType>(['schema', 'meta', 'technical', 'accessibility']);
  if (!CODE_ONLY_FIX_TYPES.has(uiFixType) && requiresNewUi(finding)) return 'requires_design_work';

  // Gate 4: if the DB fix_type is set and NOT in surgical scope → design work
  if (finding.fix_type && !SURGICAL_SCOPE.has(finding.fix_type)) return 'requires_design_work';

  // Gate 5: content-type fixes are ambiguous — check if they're truly surgical
  // Content fixes that just say "improve this paragraph" without a concrete
  // replacement are effectively design work (they need human judgment).
  if (uiFixType === 'content') {
    const rec = (finding.recommendation || '').trim();
    // If there's no concrete recommendation text, or it's very short and vague,
    // treat it as requiring design work
    if (!rec || rec.length < 20) return 'requires_design_work';
    // If the recommendation is just advice ("consider...", "you should...")
    // without actual replacement content, it's strategic
    if (/^(consider|you\s+should|we\s+recommend|it\s+would\s+be|try\s+to)\b/i.test(rec)) return 'strategic_comment';
  }

  // Passed all gates — it's surgical
  const pageCount = affectedPages.length || (finding.page_url ? 1 : 0);
  return pageCount > 1 ? 'fixable_bulk' : 'fixable_surgical';
}

/* ── Fix type metadata (for badges) ─────────────────────── */

const FIX_TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  html:    { label: 'HTML',    icon: <Code size={10} />,     color: 'var(--signal)' },
  meta:    { label: 'Meta',    icon: <Tag size={10} />,      color: 'var(--signal)' },
  schema:  { label: 'Schema',  icon: <FileCode size={10} />, color: 'var(--signal)' },
  copy:    { label: 'Copy',    icon: <PenLine size={10} />,  color: 'var(--signal)' },
  file:    { label: 'File',    icon: <FilePlus size={10} />, color: 'var(--signal)' },
  config:  { label: 'Config',  icon: <Settings size={10} />, color: 'var(--signal)' },
};

const CLASSIFICATION_META: Record<FixClassification, { label: string; color: string; icon: React.ReactNode }> = {
  fixable_surgical:     { label: 'Surgical fix', color: 'var(--ok)', icon: <Wrench size={10} /> },
  fixable_bulk:         { label: 'Bulk fix', color: 'var(--ok)', icon: <Layers size={10} /> },
  requires_design_work: { label: 'Requires design work', color: 'var(--warn)', icon: <Palette size={10} /> },
  strategic_comment:    { label: 'Strategic insight', color: 'var(--m-muted)', icon: <ClipboardList size={10} /> },
};

/* ── Language detection from URL ─────────────────────────── */

const LANG_PATTERNS: [RegExp, string][] = [
  [/\/it(\/|$)/i, 'Italian'],
  [/\/en(\/|$)/i, 'English'],
  [/\/de(\/|$)/i, 'German'],
  [/\/fr(\/|$)/i, 'French'],
  [/\/es(\/|$)/i, 'Spanish'],
  [/\/pt(\/|$)/i, 'Portuguese'],
  [/\/nl(\/|$)/i, 'Dutch'],
  [/\/ja(\/|$)/i, 'Japanese'],
  [/\/zh(\/|$)/i, 'Chinese'],
  [/\/ko(\/|$)/i, 'Korean'],
  [/\/ru(\/|$)/i, 'Russian'],
  [/\/ar(\/|$)/i, 'Arabic'],
  [/\/pl(\/|$)/i, 'Polish'],
  [/\/sv(\/|$)/i, 'Swedish'],
  [/\/da(\/|$)/i, 'Danish'],
  [/\/fi(\/|$)/i, 'Finnish'],
  [/\/no(\/|$)/i, 'Norwegian'],
  [/\/cs(\/|$)/i, 'Czech'],
  [/\/ro(\/|$)/i, 'Romanian'],
  [/\/hu(\/|$)/i, 'Hungarian'],
];

function detectLang(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    for (const [re, name] of LANG_PATTERNS) {
      if (re.test(pathname)) return name;
    }
  } catch {}
  return 'Default';
}

interface PageTarget {
  url: string;
  lang: string;
  path: string;
}

function buildPageTargets(pages: string[]): PageTarget[] {
  return pages.map((url) => {
    let path: string;
    try { path = new URL(url).pathname; } catch { path = url; }
    return { url, lang: detectLang(url), path };
  });
}

/** Group page targets by language. */
function groupByLang(targets: PageTarget[]): Map<string, PageTarget[]> {
  const map = new Map<string, PageTarget[]>();
  for (const t of targets) {
    const group = map.get(t.lang) || [];
    group.push(t);
    map.set(t.lang, group);
  }
  return map;
}

/* ── Helpers ─────────────────────────────────────────────── */

function isAiHelperApplicable(fixType: UiFixType, _recommendation: string): boolean {
  // AI Suggest is strictly for rewriting phrases or headings — nothing else.
  return fixType === 'copy' || fixType === 'heading';
}

function looksLikeJson(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!(t.startsWith('{') || t.startsWith('['))) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'fix';
}

/** Map a finding's page_url to a likely server file path. */
function suggestRemotePath(pageUrl: string | null | undefined, remoteRoot: string, fixType?: UiFixType): string {
  if (!pageUrl) {
    // For schema/meta fixes with no page, default to homepage
    if (fixType === 'schema' || fixType === 'meta') {
      const root = remoteRoot.replace(/\/+$/, '') || '';
      return `${root}/index.html`;
    }
    return '';
  }
  let pathname: string;
  try { pathname = new URL(pageUrl).pathname; } catch { return ''; }
  const root = remoteRoot.replace(/\/+$/, '') || '';
  if (/\.\w{2,5}$/.test(pathname)) return `${root}${pathname}`;
  const clean = pathname.replace(/\/+$/, '') || '';
  if (!clean || clean === '/') return `${root}/index.html`;
  return `${root}${clean}/index.html`;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Determine if the finding is deployable (surgical) or requires design work. */
function isDeployable(finding: AuditFinding, uiFixType: UiFixType, affectedPages: string[] = []): boolean {
  const classification = classifyFinding(finding, uiFixType, affectedPages);
  return classification === 'fixable_surgical' || classification === 'fixable_bulk';
}

/* ── "What will change" Panel (mandatory) ────────────────── */

function WhatWillChange({
  finding,
  uiFixType,
  classification,
  impact,
  pageTargets,
  langGroups,
}: {
  finding: AuditFinding;
  uiFixType: UiFixType;
  classification: FixClassification;
  impact: ImpactCategory;
  pageTargets: PageTarget[];
  langGroups: Map<string, PageTarget[]>;
}) {
  const deployable = classification === 'fixable_surgical' || classification === 'fixable_bulk';
  const classificationMeta = CLASSIFICATION_META[classification];
  const dbType = finding.fix_type;
  const hasMultiplePages = pageTargets.length > 1;
  const hasMultipleLangs = langGroups.size > 1;
  const currentValue = finding.target_element || finding.evidence || null;
  const impactMeta = IMPACT_META[impact];

  // Always resolve an affected page — even if no explicit page_url
  const resolvedPageLabel = pageTargets.length > 0
    ? null // will render the list
    : finding.page_url
      ? (() => { try { const p = new URL(finding.page_url).pathname; return p || '/'; } catch { return finding.page_url; } })()
      : '/';

  // Detect language from the primary page
  const primaryLang = pageTargets.length > 0
    ? pageTargets[0].lang
    : finding.page_url
      ? detectLang(finding.page_url)
      : 'Default';

  return (
    <div
      className="rounded-lg overflow-hidden mb-4"
      style={{ border: '1px solid var(--rule)' }}
    >
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'var(--paper)', borderBottom: '1px solid var(--rule)' }}
      >
        <Eye size={12} style={{ color: 'var(--ink)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ink)' }}>
          What will change
        </span>
      </div>

      <div className="px-4 py-3 space-y-3 text-[12px]" style={{ background: '#ffffff' }}>
        {/* Uniform 3-column grid for all metadata */}
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {/* Row 1 */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] block mb-1" style={{ color: 'var(--m-muted)' }}>
              Fix type
            </span>
            <span className="text-[12px]" style={{ color: 'var(--ink)' }}>
              {dbType ? FIX_TYPE_META[dbType]?.label || dbType : uiFixType.charAt(0).toUpperCase() + uiFixType.slice(1)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] block mb-1" style={{ color: 'var(--m-muted)' }}>
              Scope
            </span>
            <span
              className="inline-flex items-center gap-1 text-[12px]"
              style={{ color: classificationMeta.color }}
            >
              {classificationMeta.icon}
              {classificationMeta.label}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] block mb-1" style={{ color: 'var(--m-muted)' }}>
              Impact
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)', color: impactMeta.color }}
            >
              {impactMeta.label}
            </span>
          </div>

          {/* Row 2 */}
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] block mb-1" style={{ color: 'var(--m-muted)' }}>
              Affected {hasMultiplePages ? `pages (${pageTargets.length})` : 'page'}
            </span>
            {pageTargets.length > 0 ? (
              hasMultipleLangs ? (
                <div className="space-y-2">
                  {Array.from(langGroups.entries()).map(([lang, targets]) => (
                    <div key={lang}>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded mb-1"
                        style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)', color: 'var(--signal)' }}
                      >
                        <Languages size={9} />
                        {lang}
                      </span>
                      <ul className="mt-1 space-y-0.5">
                        {targets.map((t) => (
                          <li key={t.url} className="text-[11px] font-mono truncate" style={{ color: 'var(--ink-2)' }}>
                            {t.path}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {pageTargets.slice(0, 8).map((t) => (
                    <li key={t.url} className="text-[11px] font-mono truncate" style={{ color: 'var(--ink-2)' }}>
                      {t.path || '/'}
                      {pageTargets.length === 1 && t.lang !== 'Default' && (
                        <span className="ml-2 text-[10px] font-sans" style={{ color: 'var(--m-muted)' }}>({t.lang})</span>
                      )}
                    </li>
                  ))}
                  {pageTargets.length > 8 && (
                    <li className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
                      +{pageTargets.length - 8} more pages
                    </li>
                  )}
                </ul>
              )
            ) : (
              <span className="text-[11px] font-mono" style={{ color: 'var(--ink-2)' }}>
                {resolvedPageLabel}
              </span>
            )}
          </div>
          {deployable && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] block mb-1" style={{ color: 'var(--m-muted)' }}>
                Deploy target
              </span>
              <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                {uiFixType === 'schema' || uiFixType === 'meta'
                  ? 'HTML <head> section'
                  : uiFixType === 'technical'
                    ? 'Server config / root files'
                    : 'Page HTML body'}
              </span>
            </div>
          )}
          {primaryLang !== 'Default' && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] block mb-1" style={{ color: 'var(--m-muted)' }}>
                Language
              </span>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)', color: 'var(--signal)' }}
              >
                <Languages size={9} />
                {primaryLang}
              </span>
            </div>
          )}
        </div>

        {/* Current value */}
        {currentValue && (
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] block mb-1" style={{ color: 'var(--severe)' }}>
              Current
            </span>
            <div
              className="px-2.5 py-1.5 rounded text-[11px] font-mono leading-relaxed whitespace-pre-wrap max-h-[80px] overflow-y-auto"
              style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--severe) 15%, transparent)', color: 'var(--ink-2)' }}
            >
              {currentValue.length > 200 ? currentValue.slice(0, 200) + '...' : currentValue}
            </div>
          </div>
        )}

        {/* Bulk action info */}
        {hasMultiplePages && deployable && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px]"
            style={{ background: 'color-mix(in srgb, var(--signal) 6%, transparent)', color: 'var(--signal)' }}
          >
            <Layers size={11} className="mt-0.5 flex-shrink-0" />
            <span>
              This fix affects {pageTargets.length} pages{hasMultipleLangs ? ` in ${langGroups.size} languages` : ''}.
              You can deploy to each page individually, or review all targets before bulk deployment.
            </span>
          </div>
        )}

        {/* Design work gate notice */}
        {classification === 'requires_design_work' && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px]"
            style={{ background: 'color-mix(in srgb, var(--warn) 6%, transparent)', color: 'var(--warn)' }}
          >
            <Palette size={11} className="mt-0.5 flex-shrink-0" />
            <span>
              This fix cannot be applied without creating new UI elements or visual assets.
              No deployable fix will be generated — hand this off to your design team.
            </span>
          </div>
        )}

        {/* Strategic comment notice */}
        {classification === 'strategic_comment' && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-md text-[11px]"
            style={{ background: 'color-mix(in srgb, var(--m-muted) 8%, transparent)', color: 'var(--m-muted)' }}
          >
            <ClipboardList size={11} className="mt-0.5 flex-shrink-0" />
            <span>
              This is a strategic recommendation — no surgical fix is available.
              Review the insight and consider how it fits your broader strategy.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── DesignFixGuidance ─────────────────────────────────────── */

function DesignFixGuidance({ finding }: { finding: AuditFinding }) {
  const [copied, setCopied] = useState(false);

  const brief = [
    `Finding: ${finding.title}`,
    finding.description ? `\nDescription: ${finding.description}` : '',
    finding.recommendation ? `\nRecommendation: ${finding.recommendation}` : '',
    finding.page_url ? `\nPage: ${finding.page_url}` : '',
  ].filter(Boolean).join('');

  const handleCopy = () => {
    navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { icon: ClipboardList, label: 'Share the brief with your design team or freelancer' },
    { icon: Palette, label: 'They create the required visual assets (icons, images, graphics)' },
    { icon: Upload, label: 'Upload the new assets to your website via FTP or CMS' },
    { icon: Check, label: 'Mark this finding as Fixed once the assets are live' },
  ];

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2.5" style={{ color: 'var(--ink)' }}>
        2. Team handoff
      </p>

      <div
        className="px-4 py-4 rounded-lg space-y-4"
        style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
      >
        <div className="flex items-start gap-2.5">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0 mt-0.5"
            style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}
          >
            <Palette size={14} style={{ color: 'var(--signal)' }} />
          </div>
          <div>
            <p className="text-[12.5px] font-semibold" style={{ color: 'var(--ink)' }}>
              This fix requires design work
            </p>
            <p className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--m-muted)' }}>
              Custom visual assets are needed — icons, images, or graphics that can't be auto-generated.
              Hand this off to your design team or a freelancer.
            </p>
          </div>
        </div>

        <div className="space-y-2 pl-0.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 mt-px text-[10px] font-bold"
                style={{ background: 'var(--rule)', color: 'var(--m-muted)' }}
              >
                {i + 1}
              </div>
              <p className="text-[11.5px] leading-snug" style={{ color: 'var(--ink-2)' }}>
                {step.label}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-opacity"
          style={{ background: 'var(--ink)', color: 'var(--paper)' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied brief' : 'Copy brief for team'}
        </button>
      </div>
    </div>
  );
}

/* ── Tab Bar (shared between both panels) ────────────────── */

function TabBar({
  active,
  onSwitch,
}: {
  active: 'self' | 'handoff';
  onSwitch: (tab: 'self' | 'handoff') => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-lg p-0.5"
      style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
    >
      {(['self', 'handoff'] as const).map((tab) => {
        const isActive = active === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onSwitch(tab)}
            className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold rounded-md transition-all"
            style={{
              color: isActive ? 'var(--ink)' : 'var(--m-muted)',
              background: isActive ? 'var(--card)' : 'transparent',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab === 'self' ? <Wrench size={12} /> : <Users size={12} />}
            {tab === 'self' ? 'Fix it yourself' : 'Let your team handle it'}
          </button>
        );
      })}
    </div>
  );
}

/* ── Reversibility Notice ────────────────────────────────── */

function ReversibilityNotice() {
  return (
    <p className="text-[10.5px] flex items-center gap-1.5" style={{ color: 'var(--m-muted)' }}>
      <RotateCcw size={10} />
      Every deployed change is reversible. A backup is captured before each deploy.
    </p>
  );
}

/* ── Handoff Panel (read-only + Copy/Download) ────────────── */

function HandoffPanel({
  finding,
  patch,
  fixType,
}: {
  finding: AuditFinding;
  patch: string;
  fixType: UiFixType;
}) {
  const [copied, setCopied] = useState(false);
  const isJson = fixType === 'schema' || looksLikeJson(patch);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(patch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  };

  const handleDownload = () => {
    const base = slugify(finding.title);
    if (isJson) {
      downloadFile(`${base}.json`, patch, 'application/json');
      return;
    }
    const md = [
      `# ${finding.title}`,
      '',
      `## Finding`,
      finding.description || '(no description)',
      '',
      `## Recommended fix`,
      patch,
      '',
      `## Business impact`,
      finding.estimated_impact || '(not captured)',
      '',
    ].join('\n');
    downloadFile(`${base}.md`, md, 'text/markdown');
  };

  return (
    <div className="space-y-4 pt-4">
      <p className="text-[12px] leading-[1.6]" style={{ color: 'var(--m-muted)' }}>
        Share the recommended fix below with your developer or content team. Update the status manually once the fix is live.
      </p>

      {/* Read-only recommendation */}
      <div
        className="px-3 py-3 rounded-lg text-[12.5px] leading-[1.65] whitespace-pre-wrap font-mono"
        style={{
          background: 'var(--paper-2)',
          border: '1px solid var(--rule)',
          color: 'var(--ink)',
          minHeight: '80px',
        }}
      >
        {patch || (
          <span style={{ color: 'var(--m-muted)', fontStyle: 'italic' }}>
            No recommendation captured for this finding.
          </span>
        )}
      </div>

      {/* Copy / Download bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!patch.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-colors disabled:opacity-50"
          style={{
            background: copied ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--ink)',
            color: copied ? 'var(--ok)' : 'var(--paper)',
            border: copied ? '1px solid var(--ok)' : '1px solid var(--ink)',
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy to clipboard'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={!patch.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-50"
          style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink)' }}
        >
          <Download size={11} />
          {isJson ? 'Download .json' : 'Download .md'}
        </button>
      </div>
    </div>
  );
}

/* ── Bulk Deploy Review Step ─────────────────────────────── */

function BulkDeployReview({
  pages,
  deployPaths,
  deployResults,
  onConfirm,
  onCancel,
}: {
  pages: string[];
  deployPaths: Record<number, string>;
  deployResults: Record<number, { ok: boolean; msg: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pending = pages.filter((_, i) => !deployResults[i]?.ok);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--signal)' }}
    >
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)', borderBottom: '1px solid var(--signal)' }}
      >
        <Layers size={12} style={{ color: 'var(--signal)' }} />
        <span className="text-[11px] font-semibold" style={{ color: 'var(--signal)' }}>
          Review bulk deployment — {pending.length} page{pending.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2" style={{ background: '#ffffff' }}>
        <p className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
          The surgical fix will be generated and deployed to each of these pages:
        </p>
        <ul className="space-y-1">
          {pages.map((pageUrl, idx) => {
            const done = deployResults[idx]?.ok;
            const path = deployPaths[idx] || '(no path set)';
            return (
              <li key={idx} className="flex items-center gap-2 text-[11px]">
                {done ? (
                  <Check size={10} style={{ color: 'var(--ok)' }} />
                ) : (
                  <FileText size={10} style={{ color: 'var(--m-muted)' }} />
                )}
                <span className="font-mono truncate flex-1" style={{ color: done ? 'var(--m-muted)' : 'var(--ink)' }}>
                  {path}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
                  {detectLang(pageUrl) !== 'Default' ? detectLang(pageUrl) : ''}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold"
            style={{ background: 'var(--ink)', color: 'var(--paper)' }}
          >
            <Sparkles size={11} />
            Generate and deploy to {pending.length} page{pending.length === 1 ? '' : 's'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-[11.5px] font-medium"
            style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Self-Serve Console (edit + AI + deploy) ──────────────── */

function SelfServeConsole({
  finding,
  ftpConnections = [],
  onStatusChange,
  onPatchChange,
  affectedPages = [],
  allCrawledPages = [],
}: {
  finding: AuditFinding;
  ftpConnections?: FtpConnectionForDeploy[];
  onStatusChange?: (status: string) => void;
  onPatchChange?: (patch: string) => void;
  affectedPages?: string[];
  allCrawledPages?: string[];
}) {
  const initialPatch = (finding.recommendation || '').trim();
  const [patch, setPatch] = useState<string>(initialPatch);

  // Report patch changes to parent for live preview
  useEffect(() => {
    onPatchChange?.(patch);
  }, [patch, onPatchChange]);
  const [copied, setCopied] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const lastPatchRef = useRef<string>(initialPatch);
  const [hasRefined, setHasRefined] = useState(false);
  const [showBulkReview, setShowBulkReview] = useState(false);

  // Multi-page support: determine actual pages to deploy.
  // For batch-capable patterns (scope:'all-pages'), expand to ALL crawled pages
  // even if the finding only references one page — e.g. lang attribute fix
  // affects every HTML file on the site, not just the page that was flagged.
  const _batchCheck = useMemo(() => detectBatchPattern({
    title: finding.title || '',
    description: finding.description || '',
    recommendation: (finding.recommendation || '').trim(),
  }), [finding.title, finding.description, finding.recommendation]);

  const pages = useMemo(() => {
    // If batch pattern says "all-pages" and we have crawled pages, use those
    if (_batchCheck?.scope === 'all-pages' && allCrawledPages.length > 1) {
      return allCrawledPages;
    }
    return affectedPages.length > 1 ? affectedPages : [finding.page_url || ''];
  }, [_batchCheck, allCrawledPages, affectedPages, finding.page_url]);

  const hasMultiplePages = pages.length > 1;
  const [activePageIdx, setActivePageIdx] = useState(0);

  // Language + target analysis
  const pageTargets = useMemo(() => buildPageTargets(pages.filter(Boolean)), [pages]);
  const langGroups = useMemo(() => groupByLang(pageTargets), [pageTargets]);

  // Deploy state — per-page maps keyed by page index
  const [deployConnectionId, setDeployConnectionId] = useState<string>(
    ftpConnections.length === 1 ? ftpConnections[0].id : '',
  );
  const [deployPaths, setDeployPaths] = useState<Record<number, string>>({});
  const [deployResults, setDeployResults] = useState<Record<number, { ok: boolean; msg: string; deployLogId?: string }>>({});
  const [lastDeployIds, setLastDeployIds] = useState<Record<number, string>>({});
  const [deploying, setDeploying] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Convenience accessors for the active page
  const deployPath = deployPaths[activePageIdx] || '';
  const setDeployPath = (val: string) => setDeployPaths((prev) => ({ ...prev, [activePageIdx]: val }));
  const deployResult = deployResults[activePageIdx] || null;
  const setDeployResult = (val: { ok: boolean; msg: string; deployLogId?: string } | null) =>
    val ? setDeployResults((prev) => ({ ...prev, [activePageIdx]: val })) : setDeployResults((prev) => { const n = { ...prev }; delete n[activePageIdx]; return n; });
  const lastDeployId = lastDeployIds[activePageIdx] || null;
  const setLastDeployId = (val: string | null) =>
    val ? setLastDeployIds((prev) => ({ ...prev, [activePageIdx]: val })) : setLastDeployIds((prev) => { const n = { ...prev }; delete n[activePageIdx]; return n; });

  // Surgical fix state — per-page
  const [surgicalResults, setSurgicalResults] = useState<Record<number, SurgicalFixResult>>({});
  const [surgicalErrors, setSurgicalErrors] = useState<Record<number, string>>({});
  const [surgicalLoading, setSurgicalLoading] = useState(false);

  const surgicalResult = surgicalResults[activePageIdx] || null;
  const setSurgicalResult = (val: SurgicalFixResult | null) =>
    val ? setSurgicalResults((prev) => ({ ...prev, [activePageIdx]: val })) : setSurgicalResults((prev) => { const n = { ...prev }; delete n[activePageIdx]; return n; });
  const surgicalError = surgicalErrors[activePageIdx] || null;
  const setSurgicalError = (val: string | null) =>
    val ? setSurgicalErrors((prev) => ({ ...prev, [activePageIdx]: val })) : setSurgicalErrors((prev) => { const n = { ...prev }; delete n[activePageIdx]; return n; });

  // Batch fix detection — deterministic patterns that apply to all pages
  const batchPattern = useMemo(() => {
    if (!hasMultiplePages) return null;
    return detectBatchPattern({
      title: finding.title || '',
      description: finding.description || '',
      recommendation: patch,
    });
  }, [finding.title, finding.description, patch, hasMultiplePages]);

  // Batch fix state
  const [batchFixRunning, setBatchFixRunning] = useState(false);
  const [batchFixProgress, setBatchFixProgress] = useState<{
    current: number;
    total: number;
    results: Record<number, { ok: boolean; msg: string; patchedContent?: string }>
  } | null>(null);

  // Load most recent deploy log for this finding (so Undo works across page reloads)
  React.useEffect(() => {
    if (!finding.id || ftpConnections.length === 0) return;
    fetch('/api/ftp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deploy-history', findingId: finding.id, limit: 1 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.entries?.[0]?.id && data.entries[0].hasBackup) {
          setLastDeployId(data.entries[0].id);
        }
      })
      .catch(() => {});
  }, [finding.id, ftpConnections.length]);

  const selectedConn = useMemo(
    () => ftpConnections.find((c) => c.id === deployConnectionId),
    [ftpConnections, deployConnectionId],
  );

  // Auto-suggest deploy paths — one per affected page.
  // Runs when connection changes OR when pages expand (batch pattern detection).
  React.useEffect(() => {
    const root = selectedConn?.remote_path || '';
    if (!root && !selectedConn) return;
    const updates: Record<number, string> = {};
    pages.forEach((pageUrl, idx) => {
      if (deployPaths[idx]) return; // don't overwrite user edits
      const suggested = suggestRemotePath(pageUrl, root, fixType);
      if (suggested) updates[idx] = suggested;
    });
    if (Object.keys(updates).length > 0) {
      setDeployPaths((prev) => ({ ...prev, ...updates }));
    }
  }, [selectedConn, pages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFtp = ftpConnections.length > 0;
  const fixType = useMemo(() => inferFixType(finding), [finding]);
  const classification = useMemo(() => classifyFinding(finding, fixType, pages), [finding, fixType, pages]);
  const impact = useMemo(() => inferImpact(finding), [finding]);
  const deployable = useMemo(() => classification === 'fixable_surgical' || classification === 'fixable_bulk', [classification]);
  const aiApplicable = useMemo(
    () => isAiHelperApplicable(fixType, finding.recommendation || ''),
    [fixType, finding.recommendation],
  );
  const isJson = useMemo(() => fixType === 'schema' || looksLikeJson(patch), [fixType, patch]);
  const dirty = patch !== initialPatch;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(patch);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  };

  const handleAiRefine = async () => {
    if (!instruction.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    setAiNote(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}/rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patch, instruction }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setAiError(data?.error || `Could not generate a suggestion (status ${res.status}).`);
        return;
      }
      if (typeof data.suggestion === 'string' && data.suggestion.trim()) {
        lastPatchRef.current = patch;
        setHasRefined(true);
        setPatch(data.suggestion);
        setInstruction('');
        if (data.source === 'fallback') {
          setAiNote(data.note || 'Used a basic local rewrite. Review before approving.');
        }
      } else {
        setAiError('No suggestion returned.');
      }
    } catch {
      setAiError('Network error. Try again.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleExplain = async () => {
    if (explainBusy) return;
    setShowExplain(true);
    if (explainText) return;
    setExplainBusy(true);
    setExplainError(null);
    try {
      const res = await fetch(`/api/findings/${finding.id}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setExplainError(data?.error || `Could not generate guidance (status ${res.status}).`);
        return;
      }
      const t = typeof data.explanation === 'string' ? data.explanation.trim() : '';
      if (!t) { setExplainError('No guidance returned.'); return; }
      setExplainText(t);
    } catch {
      setExplainError('Network error. Try again.');
    } finally {
      setExplainBusy(false);
    }
  };

  const handleUndo = () => {
    setPatch(lastPatchRef.current);
    setHasRefined(false);
    setAiNote(null);
  };

  const handleReset = () => {
    setPatch(initialPatch);
    setAiNote(null);
    setAiError(null);
  };

  const handleSurgicalFix = async () => {
    const resolvedPath = deployPath.trim() || suggestRemotePath(pages[activePageIdx], selectedConn?.remote_path || '', fixType);
    if (!deployConnectionId || !resolvedPath || !patch.trim()) return;
    setSurgicalLoading(true);
    setSurgicalError(null);
    setSurgicalResult(null);
    try {
      const res = await fetch('/api/surgical-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: deployConnectionId,
          filePath: resolvedPath,
          recommendation: patch,
          findingId: finding.id,
          findingTitle: finding.title,
          findingDescription: finding.description || '',
          findingCategory: '',
          pageUrl: pages[activePageIdx] || finding.page_url || null,
          language: pageTargets[activePageIdx]?.lang || pageTargets[0]?.lang || 'Default',
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setSurgicalError(data?.error || `Surgical fix failed (${res.status}).`);
        return;
      }
      setSurgicalResult(data as SurgicalFixResult);
    } catch (err: any) {
      setSurgicalError(err?.message || 'Network error generating surgical fix.');
    } finally {
      setSurgicalLoading(false);
    }
  };

  const handleSurgicalDeploy = async (finalContent: string) => {
    const resolvedDeployPath = deployPath.trim() || suggestRemotePath(pages[activePageIdx], selectedConn?.remote_path || '', fixType);
    if (!deployConnectionId || !resolvedDeployPath) return;
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'write',
          connectionId: deployConnectionId,
          filePath: resolvedDeployPath,
          content: finalContent,
          auditId: finding.audit_id,
          findingId: finding.id,
          createBackup: true,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDeployResult({ ok: false, msg: data?.error || `Deploy failed (${res.status}).` });
        return;
      }
      setDeployResult({
        ok: true,
        msg: data?.hadBackup
          ? 'Deployed successfully — backup captured. You can undo this at any time.'
          : 'Deployed successfully.',
        deployLogId: data?.deployLogId,
      });
      if (data?.deployLogId) setLastDeployId(data.deployLogId);
      // Auto-set finding status to "fixed" after successful deploy
      onStatusChange?.('fixed');
    } catch (err: any) {
      setDeployResult({ ok: false, msg: err?.message || 'Network error during deploy.' });
    } finally {
      setDeploying(false);
    }
  };

  const handleRollback = async () => {
    const logId = deployResult?.deployLogId || lastDeployId;
    if (!logId || restoring) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/ftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          deployLogId: logId,
          connectionId: deployConnectionId,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setDeployResult({ ok: false, msg: data?.error || 'Rollback failed.' });
      } else {
        setDeployResult({ ok: true, msg: 'Original file restored.' });
        setLastDeployId(null);
      }
    } catch (err: any) {
      setDeployResult({ ok: false, msg: err?.message || 'Network error during rollback.' });
    } finally {
      setRestoring(false);
    }
  };

  // ── Batch fix: generate + deploy across all pages ─────────
  const handleBatchFix = async () => {
    if (!deployConnectionId || !patch.trim() || batchFixRunning) return;
    setBatchFixRunning(true);
    const total = pages.length;
    const results: Record<number, { ok: boolean; msg: string; patchedContent?: string }> = {};
    setBatchFixProgress({ current: 0, total, results });

    // Auto-resolve remote paths from page URLs when not manually set
    const connRoot = selectedConn?.remote_path || '';

    for (let idx = 0; idx < total; idx++) {
      const pagePath = deployPaths[idx] || suggestRemotePath(pages[idx], connRoot, fixType);
      if (!pagePath) {
        results[idx] = { ok: false, msg: 'Could not resolve remote path for this page.' };
        setBatchFixProgress({ current: idx + 1, total, results: { ...results } });
        continue;
      }

      try {
        // Step 1: Generate surgical fix
        const fixRes = await fetch('/api/surgical-fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId: deployConnectionId,
            filePath: pagePath.trim(),
            recommendation: patch,
            findingId: finding.id,
            findingTitle: finding.title,
            findingDescription: finding.description || '',
            findingCategory: '',
            pageUrl: pages[idx] || finding.page_url || null,
            language: pageTargets[idx]?.lang || pageTargets[0]?.lang || 'Default',
          }),
        });
        const fixData = await fixRes.json().catch(() => ({} as any));
        if (!fixRes.ok) {
          results[idx] = { ok: false, msg: fixData?.error || `Fix failed (${fixRes.status})` };
          setBatchFixProgress({ current: idx + 1, total, results: { ...results } });
          continue;
        }

        // Check if already fixed or no changes
        const sr = fixData as SurgicalFixResult;
        if (sr.warning && sr.changes.length === 0) {
          results[idx] = { ok: true, msg: sr.warning || 'Already correct.' };
          setBatchFixProgress({ current: idx + 1, total, results: { ...results } });
          // Store result so page tab shows check
          setDeployResults((prev) => ({ ...prev, [idx]: { ok: true, msg: sr.warning || 'Already correct.' } }));
          continue;
        }

        // Step 2: Deploy the patched content
        const deployRes = await fetch('/api/ftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'write',
            connectionId: deployConnectionId,
            filePath: pagePath.trim(),
            content: sr.patchedContent,
            auditId: finding.audit_id,
            findingId: finding.id,
            createBackup: true,
          }),
        });
        const deployData = await deployRes.json().catch(() => ({} as any));
        if (!deployRes.ok) {
          results[idx] = { ok: false, msg: deployData?.error || `Deploy failed (${deployRes.status})` };
        } else {
          results[idx] = { ok: true, msg: 'Fixed and deployed.', patchedContent: sr.patchedContent };
          setDeployResults((prev) => ({
            ...prev,
            [idx]: { ok: true, msg: 'Deployed successfully.', deployLogId: deployData?.deployLogId },
          }));
          if (deployData?.deployLogId) {
            setLastDeployIds((prev) => ({ ...prev, [idx]: deployData.deployLogId }));
          }
        }
      } catch (err: any) {
        results[idx] = { ok: false, msg: err?.message || 'Network error.' };
      }
      setBatchFixProgress({ current: idx + 1, total, results: { ...results } });
    }

    // Mark finding as fixed if all pages succeeded
    const allOk = Object.values(results).every((r) => r.ok);
    if (allOk) onStatusChange?.('fixed');

    setBatchFixRunning(false);
  };

  const canDeploy = hasFtp && deployConnectionId && (batchPattern || deployPath.trim()) && patch.trim();
  const canBatchDeploy = hasFtp && deployConnectionId && patch.trim() && (
    batchPattern
      ? pages.length > 0  // batch patterns auto-resolve paths from page URLs
      : Object.keys(deployPaths).length === pages.length && Object.values(deployPaths).every((p) => p.trim())
  );

  return (
    <section aria-label="Self-serve deploy console" className="text-[12px] space-y-5 pt-4">
      {/* ── What will change (mandatory) ───────────────────── */}
      <WhatWillChange
        finding={finding}
        uiFixType={fixType}
        classification={classification}
        impact={impact}
        pageTargets={pageTargets}
        langGroups={langGroups}
      />

      {/* ── Section 1: Review the fix ─────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2.5" style={{ color: 'var(--ink)' }}>
          1. Review the fix
        </p>
        <textarea
          id={`patch-${finding.id}`}
          value={patch}
          onChange={(e) => setPatch(e.target.value)}
          spellCheck
          rows={Math.min(12, Math.max(3, (patch || '').split('\n').length + 1))}
          className="w-full px-3 py-2.5 text-[12.5px] leading-[1.6] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 font-mono"
          style={{
            background: '#ffffff',
            border: '1px solid var(--rule)',
            borderRadius: '8px',
            color: 'var(--ink)',
            minHeight: '96px',
            resize: 'vertical',
          }}
          placeholder={
            initialPatch
              ? undefined
              : 'No recommendation captured — draft your fix here, or use the AI helper if available.'
          }
          aria-label="Editable fix text"
        />

        {/* Inline action bar: AI suggest, Explain, Copy, Reset */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {aiApplicable && (
            <button
              type="button"
              onClick={() => setShowAi((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors"
              style={{
                background: showAi ? 'color-mix(in srgb, var(--signal) 10%, transparent)' : 'var(--paper-2)',
                border: `1px solid ${showAi ? 'var(--signal)' : 'var(--rule)'}`,
                color: showAi ? 'var(--signal)' : 'var(--ink)',
              }}
              aria-expanded={showAi}
            >
              <Sparkles size={11} />
              AI suggest
            </button>
          )}

          <button
            type="button"
            onClick={handleExplain}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors"
            style={{
              background: showExplain ? 'color-mix(in srgb, var(--signal) 10%, transparent)' : 'var(--paper-2)',
              border: `1px solid ${showExplain ? 'var(--signal)' : 'var(--rule)'}`,
              color: showExplain ? 'var(--signal)' : 'var(--ink)',
            }}
            aria-expanded={showExplain}
          >
            <HelpCircle size={11} />
            Explain
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!patch.trim()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-50"
            style={{
              background: copied ? 'color-mix(in srgb, var(--ok) 12%, transparent)' : 'var(--paper-2)',
              border: '1px solid var(--rule)',
              color: copied ? 'var(--ok)' : 'var(--ink)',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          {dirty && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium"
              style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* AI suggest panel */}
      {showAi && aiApplicable && (
        <div
          className="px-3 py-2.5 rounded-md"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-stretch gap-2 flex-col sm:flex-row">
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiRefine(); }
              }}
              placeholder='e.g. "tighten this", "make it warmer", "shorten to one sentence"'
              disabled={aiBusy}
              className="flex-1 rounded-md px-2.5 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30"
              style={{ background: '#ffffff', border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="AI rewrite instruction"
            />
            <button
              type="button"
              onClick={handleAiRefine}
              disabled={aiBusy || !instruction.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-opacity disabled:opacity-50"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              {aiBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {aiBusy ? 'Thinking...' : patch.trim() ? 'Suggest' : 'Draft'}
            </button>
            {hasRefined && (
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium"
                style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
              >
                <RotateCcw size={11} />
                Undo
              </button>
            )}
          </div>
          {aiError && (
            <div className="mt-1.5 flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--warn)' }}>
              <AlertCircle size={11} className="mt-px flex-shrink-0" />
              <span>{aiError}</span>
            </div>
          )}
          {aiNote && (
            <p className="mt-1.5 text-[11px]" style={{ color: 'var(--m-muted)' }}>{aiNote}</p>
          )}
        </div>
      )}

      {/* Explain panel */}
      {showExplain && (
        <div
          className="px-3 py-2.5 rounded-md"
          style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <HelpCircle size={12} style={{ color: 'var(--signal)' }} aria-hidden />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--m-muted)' }}>
              Step-by-step
            </span>
            <button
              onClick={() => setShowExplain(false)}
              className="ml-auto text-[var(--m-muted)] hover:text-[var(--ink)]"
              aria-label="Close explain panel"
            >
              <X size={12} />
            </button>
          </div>
          {explainBusy && (
            <div className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--m-muted)' }}>
              <Loader2 size={11} className="animate-spin" />
              Generating guidance...
            </div>
          )}
          {explainError && (
            <div className="flex items-start gap-1.5 text-[11.5px]" style={{ color: 'var(--warn)' }}>
              <AlertCircle size={11} className="mt-px flex-shrink-0" />
              <span>{explainError}</span>
            </div>
          )}
          {explainText && !explainBusy && (
            <div className="text-[12.5px] leading-[1.65] whitespace-pre-wrap" style={{ color: 'var(--ink-2)' }}>
              {explainText}
            </div>
          )}
        </div>
      )}

      {/* ── Section 2: Deploy or Team Guidance ────────────── */}
      {!deployable ? (
        <DesignFixGuidance finding={finding} />
      ) : (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2.5" style={{ color: 'var(--ink)' }}>
          2. Deploy to server
          {hasMultiplePages && (
            <span className="ml-2 normal-case tracking-normal font-normal" style={{ color: 'var(--m-muted)' }}>
              {Object.values(deployResults).filter((r) => r?.ok).length}/{pages.length} pages deployed
            </span>
          )}
        </p>

        {/* Page tabs — shown when finding affects 2+ pages */}
        {hasMultiplePages && !showBulkReview && (
          <div className="flex items-center gap-0 mb-2.5 overflow-x-auto" style={{ borderBottom: '1px solid var(--rule)' }}>
            {pages.map((pageUrl, idx) => {
              const isActive = idx === activePageIdx;
              const pageDeployResult = deployResults[idx];
              const isDone = pageDeployResult?.ok === true;
              const lang = detectLang(pageUrl);
              let label: string;
              try { label = new URL(pageUrl).pathname; } catch { label = pageUrl; }
              if (label.length > 30) label = '...' + label.slice(-27);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePageIdx(idx)}
                  className="relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0"
                  style={{
                    color: isActive ? 'var(--ink)' : 'var(--m-muted)',
                    borderBottom: isActive ? '2px solid var(--ink)' : '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                >
                  {isDone ? (
                    <Check size={10} style={{ color: 'var(--ok)' }} />
                  ) : (
                    <FileText size={10} />
                  )}
                  {label}
                  {lang !== 'Default' && (
                    <span className="text-[9px] px-1 py-px rounded" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)', color: 'var(--signal)' }}>
                      {lang}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Bulk deploy review */}
        {showBulkReview && (
          <BulkDeployReview
            pages={pages}
            deployPaths={deployPaths}
            deployResults={deployResults}
            onConfirm={() => {
              setShowBulkReview(false);
              // Start surgical fix for current page
              handleSurgicalFix();
            }}
            onCancel={() => setShowBulkReview(false)}
          />
        )}

        {!showBulkReview && hasFtp ? (
          <div
            className="px-3 py-3 rounded-lg space-y-2.5"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
          >
            {/* Connection selector */}
            {ftpConnections.length > 1 && (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                  Server
                </label>
                <select
                  value={deployConnectionId}
                  onChange={(e) => {
                    setDeployConnectionId(e.target.value);
                    setDeployPaths({});
                  }}
                  className="w-full px-2.5 py-1.5 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-signal/30 rounded-md"
                  style={{ background: '#ffffff', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                >
                  <option value="">Select a target...</option>
                  {ftpConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.protocol.toUpperCase()} · {c.host})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Remote file path — hidden for batch patterns (paths auto-resolved from page URLs) */}
            {!batchPattern ? (
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--m-muted)' }}>
                  Remote file path
                </label>
                <input
                  type="text"
                  value={deployPath}
                  onChange={(e) => setDeployPath(e.target.value)}
                  placeholder="/path/to/file.html"
                  className="w-full px-2.5 py-1.5 text-[12px] font-mono outline-none focus-visible:ring-2 focus-visible:ring-signal/30 rounded-md"
                  style={{ background: '#ffffff', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                />
                {(pages[activePageIdx] || finding.page_url) && deployPath && (
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--signal)' }}>
                    Suggested from crawled page: {pages[activePageIdx] || finding.page_url}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px]" style={{ color: 'var(--m-muted)' }}>
                Paths auto-resolved from {pages.length} crawled page URLs.
              </p>
            )}

            {/* Deploy result */}
            {deployResult && (
              <div
                className="flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md"
                style={{
                  background: deployResult.ok
                    ? 'color-mix(in srgb, var(--ok) 8%, transparent)'
                    : 'color-mix(in srgb, var(--warn) 8%, transparent)',
                  color: deployResult.ok ? 'var(--ok)' : 'var(--warn)',
                }}
              >
                {deployResult.ok ? <Check size={11} className="mt-px flex-shrink-0" /> : <AlertCircle size={11} className="mt-px flex-shrink-0" />}
                <span>{deployResult.msg}</span>
              </div>
            )}

            {/* Multi-page: nudge to fix remaining pages */}
            {hasMultiplePages && deployResult?.ok && (() => {
              const doneCount = Object.values(deployResults).filter((r) => r?.ok).length;
              const remaining = pages.length - doneCount;
              if (remaining <= 0) return null;
              const nextIdx = pages.findIndex((_, i) => !deployResults[i]?.ok);
              return (
                <button
                  type="button"
                  onClick={() => nextIdx >= 0 && setActivePageIdx(nextIdx)}
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors"
                  style={{ background: 'color-mix(in srgb, var(--signal) 8%, transparent)', color: 'var(--signal)' }}
                >
                  <ArrowRight size={11} />
                  Deploy to {remaining} remaining {remaining === 1 ? 'page' : 'pages'}
                </button>
              );
            })()}

            {/* Surgical fix error */}
            {surgicalError && (
              <div
                className="flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md"
                style={{
                  background: 'color-mix(in srgb, var(--warn) 8%, transparent)',
                  color: 'var(--warn)',
                }}
              >
                <AlertCircle size={11} className="mt-px flex-shrink-0" />
                <span>{surgicalError}</span>
              </div>
            )}

            {/* Batch fix progress */}
            {(batchFixRunning || batchFixProgress) && batchFixProgress && (
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--rule)', background: 'var(--paper-2)' }}
              >
                <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--rule)' }}>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {batchFixRunning ? 'Fixing all pages...' : 'Batch fix complete'}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--m-muted)' }}>
                    {batchFixProgress.current}/{batchFixProgress.total}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1" style={{ background: 'var(--rule)' }}>
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${(batchFixProgress.current / batchFixProgress.total) * 100}%`,
                      background: 'var(--ok)',
                    }}
                  />
                </div>
                {/* Per-page results */}
                <div className="px-3 py-2 space-y-1">
                  {pages.map((pageUrl, idx) => {
                    const result = batchFixProgress.results[idx];
                    let label: string;
                    try { label = new URL(pageUrl).pathname; } catch { label = pageUrl; }
                    if (label.length > 40) label = '...' + label.slice(-37);
                    return (
                      <div key={idx} className="flex items-center gap-2 text-[11px]">
                        {result ? (
                          result.ok ? (
                            <Check size={10} style={{ color: 'var(--ok)' }} className="flex-shrink-0" />
                          ) : (
                            <AlertCircle size={10} style={{ color: 'var(--warn)' }} className="flex-shrink-0" />
                          )
                        ) : idx < batchFixProgress.current ? (
                          <Loader2 size={10} className="animate-spin flex-shrink-0" style={{ color: 'var(--signal)' }} />
                        ) : (
                          <span className="w-[10px] h-[10px] flex-shrink-0 rounded-full" style={{ background: 'var(--rule)' }} />
                        )}
                        <span className="font-mono" style={{ color: result ? (result.ok ? 'var(--ink)' : 'var(--warn)') : 'var(--m-muted)' }}>
                          {label}
                        </span>
                        {result && (
                          <span className="ml-auto text-[10px]" style={{ color: result.ok ? 'var(--ok)' : 'var(--warn)' }}>
                            {result.msg.length > 50 ? result.msg.slice(0, 47) + '...' : result.msg}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!batchFixRunning && batchFixProgress && (
                  <div className="px-3 py-2" style={{ borderTop: '1px solid var(--rule)' }}>
                    <button
                      type="button"
                      onClick={() => setBatchFixProgress(null)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                      style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--m-muted)' }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Surgical diff preview */}
            {surgicalResult && !deployResult?.ok && (
              <DiffPreview
                filePath={deployPath.trim()}
                operation={surgicalResult.operation}
                originalContent={surgicalResult.originalContent}
                patchedContent={surgicalResult.patchedContent}
                changes={surgicalResult.changes}
                confidence={surgicalResult.confidence}
                aiExplanation={surgicalResult.aiExplanation}
                warning={surgicalResult.warning}
                onApprove={handleSurgicalDeploy}
                onCancel={() => setSurgicalResult(null)}
                deploying={deploying}
              />
            )}

            {/* Deploy actions — hidden after successful surgical deploy */}
            {!surgicalResult && !deployResult?.ok && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleSurgicalFix}
                  disabled={surgicalLoading || deploying || restoring || !canDeploy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-semibold disabled:opacity-50 transition-opacity"
                  style={{ background: 'var(--ink)', color: 'var(--paper)' }}
                >
                  {surgicalLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {surgicalLoading ? 'Generating fix...' : 'Generate surgical fix'}
                </button>

                {/* Batch fix button — deterministic patterns that apply to all pages */}
                {batchPattern && !surgicalLoading && !batchFixRunning && (
                  <button
                    type="button"
                    onClick={handleBatchFix}
                    disabled={!canBatchDeploy || deploying || restoring}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[12px] font-semibold disabled:opacity-50 transition-opacity"
                    style={{ background: 'var(--ok)', color: '#fff' }}
                    title={`Deterministic fix: ${batchPattern.patternName} — applies to all ${pages.length} pages`}
                  >
                    <Layers size={12} />
                    Fix all {pages.length} pages
                  </button>
                )}

                {/* Bulk review button for multi-page (non-batch) */}
                {hasMultiplePages && !batchPattern && !surgicalLoading && !batchFixRunning && (
                  <button
                    type="button"
                    onClick={() => setShowBulkReview(true)}
                    disabled={!canDeploy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium disabled:opacity-50"
                    style={{ background: 'transparent', border: '1px solid var(--rule)', color: 'var(--ink)' }}
                  >
                    <Layers size={11} />
                    Review all {pages.length} pages
                  </button>
                )}

                {(lastDeployId || (deployResult?.ok && deployResult.deployLogId)) && (
                  <button
                    type="button"
                    onClick={handleRollback}
                    disabled={restoring}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold disabled:opacity-50"
                    style={{ background: 'transparent', border: '1px solid var(--warn)', color: 'var(--warn)' }}
                  >
                    {restoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    {restoring ? 'Restoring...' : 'Undo deploy'}
                  </button>
                )}

                <ReversibilityNotice />
              </div>
            )}
          </div>
        ) : !showBulkReview ? (
          <div
            className="px-4 py-4 rounded-lg text-center"
            style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)' }}
          >
            <Server size={20} style={{ color: 'var(--m-muted)' }} className="mx-auto mb-2" />
            <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--ink)' }}>
              No server connected
            </p>
            <p className="text-[11px] mb-3" style={{ color: 'var(--m-muted)' }}>
              Connect your FTP/SFTP server to deploy fixes directly.
            </p>
            <Link
              href="/dashboard/connect"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold"
              style={{ background: 'var(--ink)', color: 'var(--paper)' }}
            >
              <Server size={11} />
              Connect server
            </Link>
          </div>
        ) : null}
      </div>
      )}
    </section>
  );
}

/* ── Main FixConsole Export ────────────────────────────────── */

export default function FixConsole({
  finding,
  pending,
  ftpConnections = [],
  onStatusChange,
  affectedPages = [],
  allCrawledPages = [],
}: {
  finding: AuditFinding;
  pending: boolean;
  /** Site-scoped FTP connections — when present, enables inline deploy. */
  ftpConnections?: FtpConnectionForDeploy[];
  /** Called when deploy auto-transitions the finding status (e.g. to 'fixed'). */
  onStatusChange?: (status: string) => void;
  /** All page URLs affected by this grouped finding. */
  affectedPages?: string[];
  /** All unique pages from the entire audit — used for batch patterns with scope:'all-pages'. */
  allCrawledPages?: string[];
}) {
  const [activeTab, setActiveTab] = useState<'self' | 'handoff'>('self');
  const fixType = useMemo(() => inferFixType(finding), [finding]);
  const classification = useMemo(() => classifyFinding(finding, fixType, affectedPages), [finding, fixType, affectedPages]);
  const basePatch = (finding.recommendation || '').trim();
  // livePatch state removed — preview panel no longer used
  const deployable = useMemo(() => classification === 'fixable_surgical' || classification === 'fixable_bulk', [classification]);

  return (
    <div className="space-y-4">
      <TabBar active={activeTab} onSwitch={setActiveTab} />

      {activeTab === 'handoff' ? (
        <HandoffPanel
          finding={finding}
          patch={basePatch}
          fixType={fixType}
        />
      ) : (
        <SelfServeConsole
          finding={finding}
          ftpConnections={ftpConnections}
          onStatusChange={onStatusChange}
          affectedPages={affectedPages}
          allCrawledPages={allCrawledPages}
        />
      )}
    </div>
  );
}
