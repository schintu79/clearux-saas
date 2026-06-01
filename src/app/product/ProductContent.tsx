'use client'

import { SectionMarker } from '@/components/marketing/SectionMarker'
import { Button } from '@/components/marketing/Button'
import { ArrowRightIcon } from '@/components/marketing/icons'
import { HomeCta } from '@/components/marketing/HomeCta'
import { FaqPreview } from '@/components/marketing/FaqPreview'
import { Bot, Database, FileCode, Quote, FileSearch, Eye, Server, ShieldCheck, Users, MessageSquareText, Blocks, Layers, Fingerprint, ArrowUpDown, Lightbulb, TrendingUp, GitCompareArrows, Target, type LucideIcon } from 'lucide-react'

/* ── FAQ data ── */
const PRODUCT_FAQS = [
  { q: 'How does Fixpath work?', a: 'Fixpath crawls your website, analyses every page against 112 checkpoints across seven modules, and surfaces only the issues that matter. Findings are ranked by severity with real evidence — no noise, no inflated findings.' },
  { q: 'Can I fix issues directly through Fixpath?', a: 'Yes. Every finding includes a concrete fix. For code-level issues, Fixpath generates a surgical fix you can preview, edit, and deploy directly to your server via FTP or SFTP. For content and strategy issues, you get clear recommendations to share with your team.' },
  { q: 'What is the Website Health Score?', a: 'Your Website Health Score is a composite metric across all seven audit modules. It gives your team a single number to track over time. Re-audit after making fixes and see exactly how your score improves.' },
  { q: 'Does Fixpath check AI visibility?', a: 'Yes. The Future Readiness module checks how LLMs interpret your pages, validates structured data for AI consumption, probes multiple AI models for accuracy, and audits your llms.txt and AI discovery files.' },
  { q: 'How is this different from Lighthouse or PageSpeed?', a: 'Lighthouse focuses on performance and basic accessibility. Fixpath covers 112 checkpoints across UX, accessibility, AI readiness, design consistency, SEO, and more. It also helps you fix issues and tracks improvement, rather than just listing problems.' },
]

/* ── Supporting proof data ── */
const PROOF_ITEMS: { title: string; desc: string; Icon: LucideIcon }[] = [
  { title: 'LLM probe testing', desc: 'We ask multiple AI models about your business and compare their answers to what is actually on your site.', Icon: Bot },
  { title: 'Structured data audit', desc: 'Validates JSON-LD, Open Graph, and schema markup that AI agents rely on to understand your pages.', Icon: Database },
  { title: 'AI discovery files', desc: 'Checks for llms.txt, robots.txt AI directives, and other files that guide AI crawlers to your content.', Icon: FileCode },
  { title: 'Citation monitoring', desc: 'Tracks when and how AI models cite your content, and whether the citations are accurate.', Icon: Quote },
  { title: 'Professional reports', desc: 'Export your audit as a PDF or Word document. Share a live link with clients or stakeholders — no login required.', Icon: FileSearch },
  { title: 'Competitor benchmarking', desc: 'Audit a competitor site and compare scores across all seven modules. See where you lead and where to focus.', Icon: Eye },
]

/* ── Mockup: Finding detail card — mirrors real dashboard findings panel ── */
function FindingMockup() {
  return (
    <div className="rounded-xl border border-rule overflow-hidden shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)]" style={{ background: 'var(--paper)' }}>
      {/* Filter bar */}
      <div className="px-5 py-3 border-b border-rule flex items-center justify-between" style={{ background: 'var(--paper)' }}>
        <div className="flex items-center gap-3">
          <span className="font-sans text-[11px] text-m-muted border border-rule rounded-md px-2.5 py-1">All severities (3)</span>
          <span className="font-sans text-[11px] text-m-muted border border-rule rounded-md px-2.5 py-1">All modules</span>
        </div>
        <span className="font-sans text-[10px] text-m-muted">3 of 3 findings</span>
      </div>

      {/* Category header — tinted background */}
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--severe) 6%, var(--paper))' }}>
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-md inline-flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--severe) 12%, transparent)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--severe)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </span>
          <div className="flex items-center gap-2.5">
            <span className="font-sans text-[13px] font-semibold text-ink">Human Experience</span>
            <span className="font-sans text-[12px] text-m-muted">62<span className="text-[10px]">/100</span></span>
            <span className="font-sans text-[11px] text-m-muted">· 3 findings</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded" style={{ color: 'var(--severe)', background: 'color-mix(in srgb, var(--severe) 10%, transparent)' }}>1 Critical</span>
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded" style={{ color: '#F97316', background: 'color-mix(in srgb, #F97316 10%, transparent)' }}>2 High</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </div>
      </div>

      {/* Finding row — expanded */}
      <div className="border-t border-rule">
        <div className="flex items-center px-5 py-3.5" style={{ borderLeft: '3px solid var(--severe)' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--signal)' }} />
            <div className="min-w-0">
              <p className="font-sans text-[13px] font-semibold text-ink leading-tight">Login flow uses 3 dark-pattern signals that erode trust</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-sans text-[10px] font-semibold" style={{ color: 'var(--severe)' }}>Critical</span>
                <span className="font-sans text-[10px] text-m-muted">·</span>
                <span className="font-sans text-[10px] text-m-muted flex items-center gap-1">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  example.com
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-sans text-[10px] font-medium px-2.5 py-1 rounded-md border border-rule text-ink">Console</span>
            <span className="font-sans text-[10px] font-medium px-2.5 py-1 rounded-md border border-rule text-ink flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              View
            </span>
            <span className="font-sans text-[10px] font-medium px-2.5 py-1 rounded-md bg-ink text-paper flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              Fix
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </div>
        </div>

        {/* Expanded detail — What we found + Why it matters */}
        <div className="px-5 pb-5 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)' }}>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-m-muted mb-2">What we found</p>
              <p className="font-sans text-[12px] text-ink-2 leading-[1.55]">
                The login page uses urgency messaging, pre-checked opt-ins, and a hidden close button. These patterns reduce user trust.
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'var(--paper-2)' }}>
              <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-m-muted mb-2">Why it matters</p>
              <p className="font-sans text-[12px] text-ink-2 leading-[1.55]">
                Dark patterns erode trust and may violate consumer protection regulations in the EU.
              </p>
            </div>
          </div>
          {/* Open in fix console button */}
          <div className="flex justify-end mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-sans font-medium bg-ink text-paper">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              Open in fix console
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Mockup: Fix console — mirrors real resolve-this-issue panel ── */
function FixMockup() {
  return (
    <div className="rounded-xl border border-rule overflow-hidden shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)]" style={{ background: 'var(--paper)' }}>
      {/* Header — Resolve this issue */}
      <div className="px-5 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-3">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <span className="font-sans text-[14px] font-semibold text-ink">Resolve this issue</span>
        </div>
        {/* Status badge */}
        <div className="rounded-md px-3 py-2 mb-4 flex items-center gap-2" style={{ background: 'var(--paper-2)' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--signal)' }} />
          <span className="font-sans text-[11px] text-ink">In progress</span>
        </div>
      </div>

      {/* Choose an action */}
      <div className="px-5 pb-4">
        <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.08em] text-m-muted mb-2.5">Choose an action</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-sans font-medium bg-ink text-paper" style={{ boxShadow: '0 0 0 2px color-mix(in srgb, var(--signal) 40%, transparent)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            Fix it yourself
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-sans font-medium border border-rule text-ink">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Send to your team
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-sans font-medium border border-rule text-ink">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Save for later
          </span>
        </div>
        <p className="font-sans text-[10px] text-m-muted mt-2">Deploy the fix directly from your dashboard</p>
      </div>

      {/* Evidence card */}
      <div className="mx-5 mb-4 rounded-lg border border-rule overflow-hidden">
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-rule" style={{ background: 'var(--paper-2)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.06em] text-ink">Evidence</span>
        </div>
        <div className="grid grid-cols-3 gap-px" style={{ background: 'var(--rule)' }}>
          {[
            { label: 'Fix type', value: 'Schema' },
            { label: 'Scope', value: 'Surgical fix', accent: true },
            { label: 'Impact', value: 'Trust signals', badge: true },
          ].map((item) => (
            <div key={item.label} className="px-3 py-2.5" style={{ background: 'var(--paper)' }}>
              <p className="font-sans text-[8px] font-semibold uppercase tracking-[0.08em] text-m-muted mb-1">{item.label}</p>
              {item.accent ? (
                <p className="font-sans text-[11px] text-signal flex items-center gap-1">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                  {item.value}
                </p>
              ) : item.badge ? (
                <span className="font-sans text-[10px] px-1.5 py-0.5 rounded border border-rule text-ink">{item.value}</span>
              ) : (
                <p className="font-sans text-[11px] text-ink">{item.value}</p>
              )}
            </div>
          ))}
          {[
            { label: 'Deploy target', value: 'HTML <head> section' },
            { label: 'Confidence', value: 'High confidence', accent: true },
            { label: 'Detected by', value: 'Dark pattern scan' },
          ].map((item) => (
            <div key={item.label} className="px-3 py-2.5" style={{ background: 'var(--paper)' }}>
              <p className="font-sans text-[8px] font-semibold uppercase tracking-[0.08em] text-m-muted mb-1">{item.label}</p>
              {item.accent ? (
                <span className="font-sans text-[10px] px-1.5 py-0.5 rounded text-signal" style={{ background: 'color-mix(in srgb, var(--signal) 10%, transparent)' }}>
                  {item.value}
                </span>
              ) : (
                <p className="font-sans text-[11px] text-ink">{item.value}</p>
              )}
            </div>
          ))}
        </div>
        <div className="px-3 py-2.5 border-t border-rule" style={{ background: 'var(--paper)' }}>
          <p className="font-sans text-[8px] font-semibold uppercase tracking-[0.08em] text-m-muted mb-1">Affected URL</p>
          <p className="font-sans text-[11px] text-ink">/login</p>
        </div>
      </div>

      {/* Review the fix */}
      <div className="px-5 pb-4">
        <p className="font-sans text-[12px] font-semibold text-ink mb-2">1. Review the fix</p>
        <div className="rounded-md border border-rule p-3 mb-2.5" style={{ background: 'var(--paper)' }}>
          <p className="font-mono text-[11px] text-ink-2 leading-[1.6]">
            Remove pre-checked opt-in and urgency messaging from the login modal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-sans font-medium border border-rule text-ink">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M3 12l9 9 9-9"/></svg>
            AI suggest
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-sans font-medium border border-rule text-ink">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Explain
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-sans font-medium border border-rule text-ink">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </span>
        </div>
      </div>

      {/* Deploy to server */}
      <div className="px-5 pb-5">
        <p className="font-sans text-[12px] font-semibold text-ink mb-2">2. Deploy to server</p>
        <div className="rounded-lg p-5 flex flex-col items-center text-center" style={{ background: 'var(--paper-2)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          <p className="font-sans text-[11px] font-semibold text-ink mb-0.5">No server connected</p>
          <p className="font-sans text-[10px] text-m-muted mb-3">Connect your FTP/SFTP server to deploy fixes directly.</p>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-sans font-medium bg-ink text-paper">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            Connect server
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Mockup: Track dashboard — mirrors real Track page layout ── */
function TrackMockup() {
  /* Score trend line data — dramatic improvement from 41 → 87 */
  const audits = [
    { date: '12/01', score: 41 },
    { date: '26/01', score: 52 },
    { date: '14/02', score: 61 },
    { date: '05/03', score: 72 },
    { date: '28/03', score: 79 },
    { date: '15/04', score: 87 },
  ]
  const w = 320
  const h = 90
  const pad = { top: 10, right: 12, bottom: 18, left: 28 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const minS = 30
  const maxS = 100
  const pts = audits.map((d, i) => ({
    x: pad.left + (i / (audits.length - 1)) * cw,
    y: pad.top + ch - ((d.score - minS) / (maxS - minS)) * ch,
    ...d,
  }))
  const linePath = `M${pts.map((p) => `${p.x},${p.y}`).join('L')}`
  const areaPath = `${linePath}L${pts[pts.length - 1].x},${pad.top + ch}L${pts[0].x},${pad.top + ch}Z`

  return (
    <div className="rounded-xl border border-rule overflow-hidden shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)]" style={{ background: 'var(--paper)' }}>
      {/* Page header — mirrors real Track page */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span className="font-sans text-[16px] font-semibold text-ink">Track</span>
        </div>
        <p className="font-sans text-[11px] text-m-muted">Website Health Score and issue trend. Re-audit to confirm fixes landed.</p>
      </div>

      {/* Score over time + Issues — side by side */}
      <div className="px-5 pb-4 grid grid-cols-[1fr_auto] gap-3">
        {/* Score over time card */}
        <div className="rounded-lg border border-rule p-4" style={{ background: 'var(--paper)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-sans text-[12px] font-semibold text-ink">Score over time</span>
            <span className="font-sans text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--ok)' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              +46 pts vs. previous
            </span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
            <defs>
              <linearGradient id="trackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--signal)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Y-axis labels */}
            {[40, 60, 80, 100].map((v) => {
              const y = pad.top + ch - ((v - minS) / (maxS - minS)) * ch
              return (
                <g key={v}>
                  <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="var(--rule)" strokeWidth="0.5" strokeDasharray="3 3" />
                  <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="6" fill="var(--m-muted)" style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>{v}</text>
                </g>
              )
            })}
            <path d={areaPath} fill="url(#trackGrad)" />
            <path d={linePath} fill="none" stroke="var(--signal)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={3} fill="var(--paper)" stroke="var(--signal)" strokeWidth={1.5} />
                <text x={p.x} y={pad.top + ch + 12} textAnchor="middle" fontSize="6" fill="var(--m-muted)" style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>{p.date}</text>
              </g>
            ))}
            {/* Last point score label */}
            <text x={pts[pts.length - 1].x} y={pts[pts.length - 1].y - 8} textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--signal)" style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>87</text>
          </svg>
          <p className="font-sans text-[9px] text-m-muted mt-2">6 audits · 12/01/2026 → 15/04/2026</p>
        </div>

        {/* Issues card */}
        <div className="rounded-lg border border-rule p-4 w-[140px]" style={{ background: 'var(--paper)' }}>
          <span className="font-sans text-[12px] font-semibold text-ink">Issues</span>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] text-ink-2">Open</span>
              <span className="font-sans text-[13px] font-semibold" style={{ color: 'var(--severe)' }}>2</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] text-ink-2">Fixed</span>
              <span className="font-sans text-[13px] font-semibold" style={{ color: 'var(--ok)' }}>14</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] text-ink-2">Backlog</span>
              <span className="font-sans text-[13px] font-semibold text-ink">3</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent audits card */}
      <div className="mx-5 mb-5 rounded-lg border border-rule overflow-hidden" style={{ background: 'var(--paper)' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="font-sans text-[12px] font-semibold text-ink">Recent audits</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-sans font-medium bg-ink text-paper">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
            Run re-audit
          </span>
        </div>
        <div className="border-t border-rule">
          {[
            { date: '15/04/2026', score: 87 },
            { date: '28/03/2026', score: 79 },
            { date: '05/03/2026', score: 72 },
            { date: '14/02/2026', score: 61 },
          ].map((a, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: i > 0 ? '1px solid var(--rule)' : 'none', background: i === 0 ? 'color-mix(in srgb, var(--signal) 3%, var(--paper))' : 'var(--paper)' }}>
              <div className="flex items-center gap-2">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="font-sans text-[11px] text-ink">{a.date}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-sans text-[12px] font-semibold" style={{ color: i === 0 ? 'var(--signal)' : 'var(--ink)' }}>{a.score}</span>
                <span className="font-sans text-[10px] text-m-muted">View</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProductContent() {
  return (
    <main>
      {/* Hero */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5 text-center">
          <SectionMarker number="00" label="The product" centered />
          <h1
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            From issue to{' '}
            <em className="italic text-signal">improvement.</em>
          </h1>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto font-sans mb-10">
            One system to find what matters, fix it clearly, and track what changed.
          </p>
          <div className="flex gap-3.5 justify-center max-sm:flex-col max-sm:items-stretch">
            <Button href="/register" size="large">
              Start free audit
              <ArrowRightIcon size={14} />
            </Button>
            <Button href="#find" variant="ghost" size="large">
              See what we cover
            </Button>
          </div>
        </div>
      </section>

      {/* Step 1: Find */}
      <section id="find" className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="01" label="Find" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Find what{' '}
            <em className="italic text-signal">matters.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
            Fixpath crawls your site, checks every page, and surfaces the issues that actually need attention.
          </p>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-32 space-y-5">
              <div className="flex items-start gap-3.5">
                <Layers size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>One audit across 7 modules</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Foundation, human experience, inclusive design, accessibility, AI readiness, design consistency, and SEO — 28 categories in a single run.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Fingerprint size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Evidence from the real site</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Every issue includes the affected page, the element, and why it matters. Real evidence you can verify.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <ArrowUpDown size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Ranked by severity</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Critical issues surface first. Advisory items stay visible but never dominate.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Lightbulb size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Fix guidance included</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Every finding comes with a concrete action — code diffs, copy suggestions, or clear next steps.</p>
                </div>
              </div>
            </div>
            <FindingMockup />
          </div>
        </div>
      </section>

      {/* Step 2: Fix */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="02" label="Fix" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Fix what{' '}
            <em className="italic text-signal">you find.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
            Deploy code fixes, send recommendations, or move work into your existing workflow.
          </p>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="order-2 lg:order-1">
              <FixMockup />
            </div>
            <div className="order-1 lg:order-2 lg:sticky lg:top-32 space-y-5">
              <div className="flex items-start gap-3.5">
                <Server size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Connect your server</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>FTP or SFTP deployment from Fixpath.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <ShieldCheck size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Deploy approved fixes</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Review, edit, and push with control.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Users size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Send to your internal team or developer</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Pass the issue and fix path to the right person.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <MessageSquareText size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Share clear recommendations</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Keep everyone aligned on what to fix next.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Blocks size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Use WordPress when that's your stack</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Act inside your CMS workflow.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Step 3: Track */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="03" label="Track" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            Track what{' '}
            <em className="italic text-signal">changed.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
            Re-audit, compare results, and see what improved over time.
          </p>

          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="lg:sticky lg:top-32 space-y-5">
              <div className="flex items-start gap-3.5">
                <TrendingUp size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Score history</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Track your Website Health Score over time. See which fixes moved the needle most.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <GitCompareArrows size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Before / after comparison</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Compare any two audits side by side. Resolved findings, new issues, score changes by module.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <Target size={18} strokeWidth={1.5} className="shrink-0 mt-0.5" style={{ color: 'var(--ink-2)' }} />
                <div>
                  <h3 className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-1" style={{ color: 'var(--ink)' }}>Competitor benchmarking</h3>
                  <p className="font-sans text-[13px] leading-[1.55]" style={{ color: 'var(--m-muted)' }}>Audit a competitor and compare scores across all seven modules. See where you lead.</p>
                </div>
              </div>
            </div>
            <TrackMockup />
          </div>
        </div>
      </section>

      {/* Supporting Proof — AI readiness, reports, and platform */}
      <section className="py-[100px] border-b border-rule max-sm:py-16">
        <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
          <SectionMarker number="04" label="What else is included" centered />
          <h2
            className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
            style={{ fontSize: 'clamp(48px, 7vw, 96px)' }}
          >
            AI readiness. Reports.{' '}
            <em className="italic text-signal">All built in.</em>
          </h2>
          <p className="text-[18px] leading-[1.6] text-ink-2 max-w-[560px] mx-auto mb-16 font-sans text-center">
            Beyond Find, Fix, Track — every audit includes AI visibility testing, professional
            reporting, and competitive analysis out of the box.
          </p>

          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)' }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {PROOF_ITEMS.map((item, i) => {
                const col = i % 3
                const isTopRow = i < 3
                return (
                  <div
                    key={item.title}
                    className="flex flex-col items-center text-center px-8 py-10 max-sm:px-6 max-sm:py-8"
                    style={{
                      borderRight: col < 2 ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                      borderBottom: isTopRow ? '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' : 'none',
                    }}
                  >
                    <item.Icon
                      size={20}
                      strokeWidth={1.5}
                      style={{ color: 'var(--ink-2)' }}
                      className="mb-4"
                    />
                    <h3
                      className="font-sans text-[15px] font-semibold tracking-[-0.01em] mb-2"
                      style={{ color: 'var(--ink)' }}
                    >
                      {item.title}
                    </h3>
                    <p
                      className="font-sans text-[13px] leading-[1.55] max-w-[220px]"
                      style={{ color: 'var(--m-muted)' }}
                    >
                      {item.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqPreview sectionNumber="05" items={PRODUCT_FAQS} />

      {/* CTA */}
      <HomeCta />
    </main>
  )
}
