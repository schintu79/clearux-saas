'use client'

import { useEffect, useState } from 'react'
import { SectionMarker } from './SectionMarker'
import { Layers, SlidersHorizontal, ShieldCheck } from 'lucide-react'

/**
 * HomeModelLayer — "One system. Multiple AI perspectives."
 * Left: heading + paragraph + 3 bullets.
 * Right: animated visual showing model names routing into workflow blocks.
 */

const MODELS = [
  { name: 'Claude', color: '#D97706' },
  { name: 'ChatGPT', color: '#10A37F' },
  { name: 'Gemini', color: '#4285F4' },
  { name: 'Perplexity', color: '#6366F1' },
  { name: 'Grok', color: '#EF4444' },
  { name: 'Meta AI', color: '#0668E1' },
  { name: 'DeepSeek', color: '#0EA5E9' },
]

const WORKFLOWS = [
  'Competitors',
  'AI perception',
  'Brand intelligence',
  'Reports',
]

const BULLETS = [
  {
    Icon: SlidersHorizontal,
    text: 'Choose which AI engines are enabled and what they are used for',
  },
  {
    Icon: ShieldCheck,
    text: 'Reduce single-model blind spots across every workflow',
  },
  {
    Icon: Layers,
    text: 'Get a broader, more reliable view of your brand',
  },
]

/* ── Animated visual ─────────────────────────────────────── */

function ModelVisual() {
  const [activeModel, setActiveModel] = useState(0)
  const [activeWorkflow, setActiveWorkflow] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveModel((p) => (p + 1) % MODELS.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveWorkflow((p) => (p + 1) % WORKFLOWS.length)
    }, 2400)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: 'color-mix(in srgb, var(--ink) 2.5%, var(--paper))',
        border: '1px solid color-mix(in srgb, var(--ink) 8%, transparent)',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid color-mix(in srgb, var(--ink) 6%, transparent)' }}
      >
        <Layers size={13} strokeWidth={1.5} style={{ color: 'var(--signal)' }} />
        <span className="font-sans text-[11px] font-semibold tracking-[0.02em]" style={{ color: 'var(--ink)' }}>
          Model configuration
        </span>
      </div>

      <div className="p-5 sm:p-6">
        {/* Models column */}
        <div className="mb-5">
          <p
            className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] mb-3"
            style={{ color: 'var(--m-muted)' }}
          >
            Active models
          </p>
          <div className="flex flex-wrap gap-2">
            {MODELS.map((m, i) => {
              const isActive = i === activeModel
              return (
                <span
                  key={m.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-sans text-[12px] font-medium transition-all duration-300"
                  style={{
                    background: isActive
                      ? `color-mix(in srgb, ${m.color} 12%, var(--paper))`
                      : 'color-mix(in srgb, var(--ink) 4%, var(--paper))',
                    border: `1px solid ${
                      isActive
                        ? `color-mix(in srgb, ${m.color} 30%, transparent)`
                        : 'color-mix(in srgb, var(--ink) 8%, transparent)'
                    }`,
                    color: isActive ? m.color : 'var(--m-muted)',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  <span
                    className="w-[6px] h-[6px] rounded-full transition-all duration-300"
                    style={{
                      background: isActive ? m.color : 'color-mix(in srgb, var(--ink) 20%, transparent)',
                    }}
                  />
                  {m.name}
                </span>
              )
            })}
          </div>
        </div>

        {/* Routing arrow */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <div
            className="flex-1 h-px"
            style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}
          />
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
            <path
              d="M10 4L10 16M10 16L6 12M10 16L14 12"
              stroke="var(--signal)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            className="flex-1 h-px"
            style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}
          />
        </div>

        {/* Workflow blocks */}
        <div>
          <p
            className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] mb-3"
            style={{ color: 'var(--m-muted)' }}
          >
            Routed to workflows
          </p>
          <div className="grid grid-cols-2 gap-2">
            {WORKFLOWS.map((w, i) => {
              const isActive = i === activeWorkflow
              return (
                <div
                  key={w}
                  className="px-4 py-3 rounded-lg font-sans text-[12px] font-medium transition-all duration-300 text-center"
                  style={{
                    background: isActive
                      ? 'color-mix(in srgb, var(--signal) 8%, var(--paper))'
                      : 'color-mix(in srgb, var(--ink) 3%, var(--paper))',
                    border: `1px solid ${
                      isActive
                        ? 'color-mix(in srgb, var(--signal) 25%, transparent)'
                        : 'color-mix(in srgb, var(--ink) 6%, transparent)'
                    }`,
                    color: isActive ? 'var(--signal)' : 'var(--m-muted)',
                  }}
                >
                  {w}
                </div>
              )
            })}
          </div>
        </div>

        {/* Closing label */}
        <p
          className="font-sans text-[11px] mt-5 pt-4 text-center"
          style={{
            color: 'var(--m-muted)',
            borderTop: '1px solid color-mix(in srgb, var(--ink) 6%, transparent)',
          }}
        >
          Choose the models. Choose the questions. See the full picture.
        </p>
      </div>
    </div>
  )
}

/* ── Section ─────────────────────────────────────────────── */

export function HomeModelLayer() {
  return (
    <section className="py-[100px] border-b border-rule max-sm:py-16">
      <div className="max-w-mkt mx-auto px-8 max-sm:px-5">
        <SectionMarker number="05" label="The model layer" centered />

        <h2
          className="font-serif font-normal text-ink leading-[0.94] tracking-[-0.025em] mb-6 text-center"
          style={{ fontSize: 'clamp(36px, 7vw, 96px)' }}
        >
          One system.{' '}
          <em className="italic text-signal">Multiple AI perspectives.</em>
        </h2>

        <p className="text-[18px] max-sm:text-[15px] leading-[1.6] text-ink-2 max-w-[600px] mx-auto mb-16 max-sm:mb-10 font-sans text-center">
          Fixpath lets you choose which AI engines participate in each
          workflow — from competitor analysis and AI perception to brand
          intelligence and reports — so your audits are not shaped by a single
          model{"'"}s blind spots.
        </p>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 max-sm:gap-8 items-start max-w-[960px] mx-auto">
          {/* Left — bullets */}
          <div className="flex flex-col gap-6 max-lg:order-2">
            {BULLETS.map((b) => (
              <div key={b.text} className="flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: 'color-mix(in srgb, var(--signal) 8%, var(--paper))',
                    border: '1px solid color-mix(in srgb, var(--signal) 15%, transparent)',
                  }}
                >
                  <b.Icon size={16} strokeWidth={1.5} style={{ color: 'var(--signal)' }} />
                </div>
                <p
                  className="font-sans text-[15px] leading-[1.6]"
                  style={{ color: 'var(--ink)' }}
                >
                  {b.text}
                </p>
              </div>
            ))}

            {/* Subtle trust note */}
            <div
              className="mt-2 px-4 py-3 rounded-lg font-sans text-[12px] leading-[1.6]"
              style={{
                color: 'var(--m-muted)',
                background: 'color-mix(in srgb, var(--ink) 2%, var(--paper))',
                border: '1px solid color-mix(in srgb, var(--ink) 6%, transparent)',
              }}
            >
              This is not a list of integrations. It is a configurable
              orchestration layer — you decide which models run, and where.
            </div>
          </div>

          {/* Right — animated visual */}
          <div className="max-lg:order-1">
            <ModelVisual />
          </div>
        </div>
      </div>
    </section>
  )
}
