'use client'

/**
 * Human Perception Intelligence Sections — Tier 2
 *
 * Renders Sections 3, 5, and 6 from the Brand Intelligence brief:
 * - Section 3: Human Perception (reviews, Reddit, web mentions)
 * - Section 5: Sentiment Deep Dive (themes + causal links)
 * - Section 6: Share of Voice visual
 */

import React, { useState } from 'react'
import {
  MessageSquare,
  Globe,
  Star,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Zap,
  ArrowRight,
  BarChart3,
  Users,
  FileText,
  Target,
} from 'lucide-react'

/* ── Types ───────────────────────────────────────────── */

interface HumanPerceptionData {
  reviewScore: number | null
  reviewCount: number
  webMentionCount: number
  redditMentionCount: number
  socialSentiment: number
  topPositiveThemes: Array<{ theme: string; source: string; count: number }>
  topNegativeThemes: Array<{ theme: string; source: string; count: number }>
  promptLibraryVisibility: number | null
  contentGapsCount: number
  causalLinksCount: number
  fetchedAt: string
}

interface Props {
  humanPerception: HumanPerceptionData | null
  redditMentions: any[]
  webMentions: any[]
  reviewData: any[]
  promptResults: any[]
  contentGaps: any[]
  trendSnapshots: any[]
  brandIntelligence: any | null
}

/* ── Helpers ─────────────────────────────────────────── */

function sentimentPill(score: number) {
  if (score >= 65) return { label: 'Positive', bg: 'color-mix(in srgb, var(--ok) 12%, transparent)', color: 'var(--ok)' }
  if (score >= 40) return { label: 'Neutral', bg: 'color-mix(in srgb, var(--warn) 12%, transparent)', color: 'var(--warn)' }
  return { label: 'Negative', bg: 'color-mix(in srgb, var(--severe) 12%, transparent)', color: 'var(--severe)' }
}

function sourceIcon(source: string) {
  switch (source) {
    case 'reddit': return <MessageSquare size={10} />
    case 'reviews': return <Star size={10} />
    case 'web': return <Globe size={10} />
    default: return <Globe size={10} />
  }
}

/* ── Component ───────────────────────────────────────── */

export default function HumanPerceptionSection({
  humanPerception,
  redditMentions,
  webMentions,
  reviewData,
  promptResults,
  contentGaps,
  trendSnapshots,
  brandIntelligence,
}: Props) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  if (!humanPerception && redditMentions.length === 0 && webMentions.length === 0 && reviewData.length === 0) {
    return null // No human perception data yet
  }

  const hp = humanPerception
  const hasData = hp && (hp.reviewCount > 0 || hp.webMentionCount > 0 || hp.redditMentionCount > 0)

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          Section 3 — Human Perception Intelligence
         ═══════════════════════════════════════════════════════════ */}
      <section
        className="rounded-xl p-5 mb-4"
        style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} style={{ color: 'var(--ink)' }} />
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
            Human perception
          </h2>
        </div>
        <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
          What real humans say about your brand across reviews, Reddit, and the web.
        </p>

        {/* Overview metrics */}
        {hp && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <MetricBlock label="Review score" value={hp.reviewScore != null ? `${hp.reviewScore}/5` : '--'} sub={`${hp.reviewCount} reviews`} />
            <MetricBlock label="Web mentions" value={String(hp.webMentionCount)} sub="Last 30 days" />
            <MetricBlock label="Reddit mentions" value={String(hp.redditMentionCount)} sub="Last 30 days" />
            <MetricBlock label="Social sentiment" value={`${hp.socialSentiment}/100`} sub={sentimentPill(hp.socialSentiment).label} sentimentScore={hp.socialSentiment} />
          </div>
        )}

        {/* Review platforms */}
        {reviewData.length > 0 && (
          <CollapsiblePanel
            title="Reviews"
            icon={<Star size={12} />}
            count={reviewData.length}
            expanded={expandedSection === 'reviews'}
            onToggle={() => setExpandedSection(expandedSection === 'reviews' ? null : 'reviews')}
          >
            <div className="space-y-2">
              {reviewData.map((review: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold capitalize" style={{ color: 'var(--ink)' }}>{review.platform}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] tabular-nums font-medium" style={{ color: 'var(--ink)' }}>
                      {review.aggregate_score}/5
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>
                      {review.review_count} reviews
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        )}

        {/* Reddit mentions */}
        {redditMentions.length > 0 && (
          <CollapsiblePanel
            title="Reddit"
            icon={<MessageSquare size={12} />}
            count={redditMentions.length}
            expanded={expandedSection === 'reddit'}
            onToggle={() => setExpandedSection(expandedSection === 'reddit' ? null : 'reddit')}
          >
            <div className="space-y-2">
              {redditMentions.slice(0, 10).map((mention: any, i: number) => (
                <div key={i} className="px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--ink)' }}>{mention.post_title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>r/{mention.subreddit}</span>
                        <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{mention.score} upvotes</span>
                        <SentimentDot sentiment={mention.sentiment} />
                      </div>
                    </div>
                    <a href={mention.post_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 mt-0.5">
                      <ExternalLink size={10} style={{ color: 'var(--m-muted)' }} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        )}

        {/* Web mentions */}
        {webMentions.length > 0 && (
          <CollapsiblePanel
            title="Web and press"
            icon={<Globe size={12} />}
            count={webMentions.length}
            expanded={expandedSection === 'web'}
            onToggle={() => setExpandedSection(expandedSection === 'web' ? null : 'web')}
          >
            <div className="space-y-2">
              {webMentions.slice(0, 10).map((mention: any, i: number) => (
                <div key={i} className="px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--ink)' }}>{mention.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{mention.source_domain}</span>
                        <SentimentDot sentiment={mention.sentiment} />
                      </div>
                    </div>
                    <a href={mention.source_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 mt-0.5">
                      <ExternalLink size={10} style={{ color: 'var(--m-muted)' }} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        )}

        {/* No data state */}
        {!hasData && redditMentions.length === 0 && webMentions.length === 0 && reviewData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Users size={20} style={{ color: 'var(--m-muted)' }} />
            <p className="text-[11px] text-center" style={{ color: 'var(--m-muted)' }}>
              Human perception data will appear after your next audit completes.
              Configure API keys (Reddit, SerpAPI, G2) for richer data.
            </p>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          Section 5 — Sentiment Deep Dive + Causal Links
         ═══════════════════════════════════════════════════════════ */}
      {hp && (hp.topPositiveThemes.length > 0 || hp.topNegativeThemes.length > 0) && (
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
              Sentiment deep dive
            </h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            What drives perception — human signals that AI models learn from.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Positive themes */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--ok)' }}>
                Positive themes
              </h3>
              <div className="space-y-1.5">
                {hp.topPositiveThemes.slice(0, 6).map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ok) 5%, transparent)' }}>
                    <div className="flex items-center gap-2">
                      {sourceIcon(t.source)}
                      <span className="text-[11px]" style={{ color: 'var(--ink)' }}>{t.theme}</span>
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--m-muted)' }}>{t.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative themes */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--severe)' }}>
                Negative themes
              </h3>
              <div className="space-y-1.5">
                {hp.topNegativeThemes.slice(0, 6).map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--severe) 5%, transparent)' }}>
                    <div className="flex items-center gap-2">
                      {sourceIcon(t.source)}
                      <span className="text-[11px]" style={{ color: 'var(--ink)' }}>{t.theme}</span>
                    </div>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--m-muted)' }}>{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Causal connection callout */}
          {hp.causalLinksCount > 0 && (
            <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', border: '1px solid var(--rule)' }}>
              <div className="flex items-start gap-2">
                <ArrowRight size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ink)' }} />
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  {hp.causalLinksCount} causal connection{hp.causalLinksCount !== 1 ? 's' : ''} found between what humans say and what AI reflects.
                  Human themes drive AI perception — fixing the source signal changes the AI output.
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Section 6 — Prompt Library Visibility + Content Gaps
         ═══════════════════════════════════════════════════════════ */}
      {(promptResults.length > 0 || contentGaps.length > 0) && (
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
              Category visibility
            </h2>
          </div>
          <p className="text-[12px] mb-4" style={{ color: 'var(--m-muted)' }}>
            How visible your brand is when AI answers non-branded category questions.
          </p>

          {/* Visibility metrics */}
          {hp?.promptLibraryVisibility != null && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <MetricBlock
                label="Category visibility"
                value={`${hp.promptLibraryVisibility}%`}
                sub={`${promptResults.length} prompts tested`}
                sentimentScore={hp.promptLibraryVisibility}
              />
              <MetricBlock
                label="Content gaps"
                value={String(contentGaps.length)}
                sub="Opportunities to publish"
              />
              {hp.promptLibraryVisibility < 50 && (
                <MetricBlock
                  label="Potential impact"
                  value="High"
                  sub="Publishing can increase visibility"
                />
              )}
            </div>
          )}

          {/* Content gap briefs */}
          {contentGaps.length > 0 && (
            <div className="mt-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--ink)' }}>
                Content to publish
              </h3>
              <div className="space-y-2">
                {contentGaps.slice(0, 5).map((gap: any, i: number) => (
                  <div key={i} className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
                    <div className="flex items-start gap-2">
                      <FileText size={11} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ink)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium" style={{ color: 'var(--ink)' }}>{gap.recommended_topic}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] capitalize" style={{ color: 'var(--m-muted)' }}>{(gap.recommended_format || '').replace(/_/g, ' ')}</span>
                          <span className="text-[10px]" style={{ color: 'var(--m-muted)' }}>{gap.target_word_count} words</span>
                          <span
                            className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                            style={{
                              color: gap.estimated_impact === 'high' ? 'var(--severe)' : gap.estimated_impact === 'medium' ? 'var(--warn)' : 'var(--m-muted)',
                              background: gap.estimated_impact === 'high'
                                ? 'color-mix(in srgb, var(--severe) 10%, transparent)'
                                : gap.estimated_impact === 'medium'
                                  ? 'color-mix(in srgb, var(--warn) 10%, transparent)'
                                  : 'color-mix(in srgb, var(--ink) 6%, transparent)',
                            }}
                          >
                            {gap.estimated_impact}
                          </span>
                        </div>
                        {gap.recommended_angle && (
                          <p className="text-[10px] mt-1" style={{ color: 'var(--m-muted)' }}>{gap.recommended_angle}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          Trend chart (snapshots over time)
         ═══════════════════════════════════════════════════════════ */}
      {trendSnapshots.length >= 2 && (
        <section
          className="rounded-xl p-5 mb-4"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={14} style={{ color: 'var(--ink)' }} />
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
              Intelligence trend
            </h2>
          </div>
          <p className="text-[12px] mb-3" style={{ color: 'var(--m-muted)' }}>
            How your brand intelligence metrics have changed over time.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TrendMetric
              label="BI Score"
              current={trendSnapshots[trendSnapshots.length - 1]?.bi_score}
              previous={trendSnapshots[0]?.bi_score}
            />
            <TrendMetric
              label="AI Visibility"
              current={trendSnapshots[trendSnapshots.length - 1]?.ai_visibility}
              previous={trendSnapshots[0]?.ai_visibility}
              suffix="%"
            />
            <TrendMetric
              label="Sentiment"
              current={trendSnapshots[trendSnapshots.length - 1]?.overall_sentiment}
              previous={trendSnapshots[0]?.overall_sentiment}
            />
            <TrendMetric
              label="Share of voice"
              current={trendSnapshots[trendSnapshots.length - 1]?.share_of_voice}
              previous={trendSnapshots[0]?.share_of_voice}
              suffix="%"
            />
          </div>
        </section>
      )}
    </>
  )
}

/* ── Sub-components ──────────────────────────────────── */

function MetricBlock({ label, value, sub, sentimentScore }: { label: string; value: string; sub: string; sentimentScore?: number }) {
  const color = sentimentScore != null
    ? (sentimentScore >= 65 ? 'var(--ok)' : sentimentScore >= 40 ? 'var(--warn)' : 'var(--severe)')
    : 'var(--ink)'

  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>{label}</p>
      <p className="text-[18px] font-bold tabular-nums leading-tight" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--m-muted)' }}>{sub}</p>
    </div>
  )
}

function CollapsiblePanel({ title, icon, count, expanded, onToggle, children }: {
  title: string; icon: React.ReactNode; count: number; expanded: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {icon}
        <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>{title}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)', color: 'var(--m-muted)' }}>{count}</span>
      </button>
      {expanded && <div className="mt-2 pl-2">{children}</div>}
    </div>
  )
}

function SentimentDot({ sentiment }: { sentiment: string }) {
  const color = sentiment === 'positive' ? 'var(--ok)' : sentiment === 'negative' ? 'var(--severe)' : 'var(--warn)'
  return <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
}

function TrendMetric({ label, current, previous, suffix = '' }: { label: string; current: number | null; previous: number | null; suffix?: string }) {
  const delta = current != null && previous != null ? current - previous : null
  const isPositive = delta != null && delta > 0
  const isNegative = delta != null && delta < 0

  return (
    <div className="px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 3%, transparent)' }}>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] mb-1" style={{ color: 'var(--m-muted)' }}>{label}</p>
      <p className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: 'var(--ink)' }}>
        {current != null ? `${current}${suffix}` : '--'}
      </p>
      {delta != null && (
        <div className="flex items-center gap-1 mt-0.5">
          {isPositive && <TrendingUp size={10} style={{ color: 'var(--ok)' }} />}
          {isNegative && <TrendingDown size={10} style={{ color: 'var(--severe)' }} />}
          <span className="text-[10px] font-medium" style={{ color: isPositive ? 'var(--ok)' : isNegative ? 'var(--severe)' : 'var(--m-muted)' }}>
            {isPositive ? '+' : ''}{Math.round(delta)}{suffix}
          </span>
        </div>
      )}
    </div>
  )
}
