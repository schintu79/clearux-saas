// ============================================================
// ClearUX Audit Engine — Claude AI Analyzer
// Produces comprehensive, professional UX audit analysis
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { Audit, FindingSeverity, FindingType, FixType, AuditFinding } from '@/types/database'
import { getLanguagePromptInstruction, getLanguageLabel, getCategoryNames, getBaselineSummary } from '@/lib/languages'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Cannot run AI analysis.')
    _anthropic = new Anthropic({ apiKey, timeout: 45_000 }) // 45s per request — Haiku is fast
  }
  return _anthropic
}

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms),
    ),
  ])
}

/**
 * Retry an async function with exponential backoff (rate limit resilience ONLY).
 *
 * IMPORTANT: Does NOT retry on timeouts. Timeout errors are terminal — the API
 * took too long, and retrying burns rate-limit quota while orphaned promises
 * from the timed-out call continue running in the background. This was the root
 * cause of batch 4/4 stalls: 3 × 45s retries = 142s worst case per category,
 * with orphaned HTTP requests causing cascading rate limits on parallel categories.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 1,
  baseDelayMs: number = 2000,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const isRateLimit = err instanceof Error && (
        err.message.includes('rate') ||
        err.message.includes('429') ||
        err.message.includes('overloaded') ||
        err.message.includes('529')
      )
      // Timeouts are NOT retried — they are terminal failures.
      // The outer withTimeout in process-audit.ts handles graceful degradation.
      if (attempt < maxRetries && isRateLimit) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000
        console.warn(`[${label}] Attempt ${attempt + 1} failed (rate limit), retrying in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

export interface AnalysisFinding {
  severity: FindingSeverity
  title: string
  description: string
  recommendation: string
  estimatedImpact?: string
  targetElement?: string | null
  pageUrl?: string | null
  categoryIndex?: number              // 0-27 explicit category — set by runFullAnalysis
  /** 'fixable' = concrete, deployable from console. 'strategic' = broader observation. */
  findingType?: FindingType
  /** For fixable findings: deployment mechanism (html, meta, schema, copy, file, config). */
  fixType?: FixType
  /** AI X-Ray: how AI interprets this element vs how a human sees it */
  aiInterpretation?: string | null
  /** AI X-Ray: how a human interprets this element */
  humanInterpretation?: string | null
  /** Viewport context: which viewport(s) this finding applies to */
  viewport?: 'mobile' | 'desktop' | 'tablet' | 'all' | 'cross-viewport' | 'technical' | 'brand-dna' | null
  /** Dual-layer communication — plain-language issue title */
  titlePlain?: string | null
  /** Dual-layer communication — what we found in plain language */
  whatFound?: string | null
  /** Dual-layer communication — why it matters in business/user terms */
  whyMatters?: string | null
  /** Dual-layer communication — developer-facing technical note */
  technicalNote?: string | null
  /** Dual-layer communication — plain-language fix recommendation */
  fixPlain?: string | null
  /** Dual-layer communication — technical fix implementation */
  fixTechnical?: string | null
}

export interface CategoryScore {
  name: string
  score: number
  summary: string
  /** Score state metadata — drives UI messaging. Added 2026-06-08. */
  score_state?: 'scored' | 'clean' | 'evidence_limited' | 'baseline_derived' | 'unanalyzed'
}

export interface SiteProfile {
  /** e.g. "Design SaaS", "E-commerce", "Developer Tools", "FinTech", "Healthcare", "Education" */
  industryVertical: string
  /** e.g. "Professional designers", "Enterprise IT teams", "Small business owners" */
  targetAudience: string
  /** How technically/professionally sophisticated the audience is */
  audienceSophistication: 'expert' | 'professional' | 'general' | 'mixed'
  /** The communication style norms for this industry + audience */
  communicationStyle: string
  /** Where this site sits in its market */
  marketPosition: 'leader' | 'challenger' | 'niche' | 'emerging' | 'unknown'
  /** Free-form notes about what's normal/expected for this type of site */
  contextNotes: string
}

/**
 * Severity cap (score model v2, 2026-06-10).
 * Moved to @/lib/scoring/severity-cap so the dashboard (client) can apply
 * the SAME cap to its live recompute without dragging the Anthropic SDK
 * into the client bundle. Re-exported here for engine-side callers.
 */
export { applySeverityCap, capSummarySentence, type ScoreCapInfo } from '@/lib/scoring/severity-cap'
import { applyScoringSeverityCap, capSummarySentence, type ScoreCapInfo } from '@/lib/scoring/severity-cap'

export interface ReportData {
  executiveSummary: string
  keyRecommendation: string | null          // kept for backwards compat
  topRecommendations: string[]              // top 3 priority recommendations
  overallScore: number
  uxScore: number
  conversionScore: number
  mobileScore: number
  aiDiscoverabilityScore: number
  contentScore: number
  categoryScores: CategoryScore[]
  /** Score model v2: set when the overall was capped by open severity counts */
  scoreCapInfo?: ScoreCapInfo
  siteProfile?: SiteProfile
  verificationSummary?: {
    likelyFixed: number
    poorlyFixed?: number
    confirmedOpen: number
    totalVerified: number
    nothingChanged: boolean
  }
  verificationResults?: Array<{
    findingId: string
    status: string
    note: string
  }>
}

// ════════════════════════════════════════════════════════════════
// SITE PROFILE DETECTION
// Lightweight AI call that profiles the site BEFORE analysis begins.
// Identifies: industry, audience, sophistication, communication norms.
// This ensures findings are evaluated against the RIGHT standards.
// ════════════════════════════════════════════════════════════════

/**
 * Detect the site's industry, audience, and communication context.
 * Called once early in the pipeline, before any analyzeCategory() calls.
 * The returned SiteProfile is passed to analyzeCategory() and generateReport()
 * so they evaluate the site against appropriate standards.
 */
export async function detectSiteProfile(
  pageContent: string,
  siteUrl: string,
): Promise<SiteProfile> {
  const anthropic = getAnthropicClient()

  const prompt = `Analyze this website and determine its profile. Be specific and accurate.

WEBSITE: ${siteUrl}

CONTENT (first 6000 chars):
${pageContent.substring(0, 6000)}

Based on the content, determine:

1. INDUSTRY VERTICAL — What industry/sector is this? Be specific (e.g. "Design SaaS" not just "Technology", "B2B Marketing Platform" not just "SaaS", "Specialty Coffee E-commerce" not just "E-commerce").

2. TARGET AUDIENCE — Who is the primary user? Be specific about their role, expertise, and context (e.g. "Professional UI/UX designers at agencies and product teams" not just "designers").

3. AUDIENCE SOPHISTICATION — How technically/professionally sophisticated is the target audience?
   - "expert": Deep domain expertise expected (developers, scientists, designers, engineers)
   - "professional": Business-savvy but not necessarily technical (managers, marketers, executives)
   - "general": Everyday consumers, no special expertise assumed
   - "mixed": Serves multiple audience tiers

4. COMMUNICATION STYLE — What communication norms are appropriate for this industry + audience? Consider:
   - Is subtle, understated messaging appropriate (e.g., design tools for designers)?
   - Is direct, benefit-driven copy expected (e.g., B2B SaaS for marketers)?
   - Is technical precision valued over persuasion (e.g., developer tools)?
   - Is emotional appeal central (e.g., health/wellness, nonprofits)?
   Write 1-2 sentences describing the expected style.

5. MARKET POSITION — Where does this site/brand sit in its market?
   - "leader": Established, well-known, market-defining (top 3 in their space)
   - "challenger": Credible competitor aiming to disrupt the leader
   - "niche": Serves a specific segment very well
   - "emerging": New or early-stage, building presence
   - "unknown": Cannot determine from content alone

6. CONTEXT NOTES — Write 2-3 sentences about what's NORMAL and EXPECTED for this type of site. What should NOT be penalized because it's standard for this industry/audience? What evaluation standards should be applied?
   Example for a design SaaS: "Subtle, craft-focused CTAs are standard — aggressive 'BUY NOW' messaging would feel off-brand. Clean minimalism is a feature, not a gap. The audience evaluates tools by exploring, not by reading sales copy."

Return ONLY valid JSON:
{
  "industryVertical": "...",
  "targetAudience": "...",
  "audienceSophistication": "expert|professional|general|mixed",
  "communicationStyle": "...",
  "marketPosition": "leader|challenger|niche|emerging|unknown",
  "contextNotes": "..."
}`

  try {
    const message = await withRetry(
      () => withTimeout(
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
        15_000,
        'detectSiteProfile',
      ),
      'detectSiteProfile',
      1, // single retry — this is fast and cheap
      2000,
    )

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const jsonMatch = text.match(/\{[\s\S]*\}/m)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const validSophistication = ['expert', 'professional', 'general', 'mixed']
      const validPosition = ['leader', 'challenger', 'niche', 'emerging', 'unknown']
      return {
        industryVertical: parsed.industryVertical || 'Unknown',
        targetAudience: parsed.targetAudience || 'General audience',
        audienceSophistication: validSophistication.includes(parsed.audienceSophistication)
          ? parsed.audienceSophistication : 'professional',
        communicationStyle: parsed.communicationStyle || 'Standard professional tone',
        marketPosition: validPosition.includes(parsed.marketPosition)
          ? parsed.marketPosition : 'unknown',
        contextNotes: parsed.contextNotes || '',
      }
    }
  } catch (err) {
    console.warn('[detectSiteProfile] Failed, using defaults:', err instanceof Error ? err.message : err)
  }

  // Safe defaults — don't block the pipeline if detection fails
  return {
    industryVertical: 'Unknown',
    targetAudience: 'General audience',
    audienceSophistication: 'professional',
    communicationStyle: 'Standard professional tone',
    marketPosition: 'unknown',
    contextNotes: '',
  }
}

// ── The UX categories we evaluate ────────────────────────────
// Grouped into 7 modules (4 categories each = 28 categories):
//   FOUNDATION (0-3): Does the site look right?
//   HUMAN EXPERIENCE (4-7): Does the site feel right?
//   INCLUSIVE DESIGN (8-11): Does the site work for everyone?
//   FUTURE READINESS (12-15): Is the site ready for what's next?
//   SEO STRUCTURE & RULES (16-19): Is the site search-engine friendly?
//   ACCESSIBILITY READINESS (20-23): Is the site accessible to all users?
//   DESIGN CONSISTENCY (24-27): Is the visual system internally consistent?
export const UX_CATEGORIES = [
  // ═══ PILLAR 1: FOUNDATION ═══════════════════════════════════
  // Core visual design, messaging, navigation, and content quality
  {
    name: 'Visual Design & First Impression',
    pillar: 'Foundation',
    items: [
      'ABOVE THE FOLD: Does the first screen immediately communicate what the site does and who it\'s for? Evaluate the H1/headline, hero section, and above-the-fold layout. A visitor should understand the core offering within 5 seconds. Quote the actual headline and assess if it passes the "5-second test."',
      'VISUAL HIERARCHY: Is there a clear visual flow guiding the eye from headline → supporting text → CTA? Check font sizes, weights, spacing, and whitespace. The most important element (usually the CTA or headline) should have the highest visual weight. Flag specific areas where hierarchy breaks down.',
      'CONSISTENCY: Does the site use a consistent color palette, typography system, and component style across pages? Check for mixed fonts, inconsistent button styles, or pages that feel like different sites. Minor inconsistencies are LOW severity — only flag when it breaks trust or causes confusion.',
      'PROFESSIONAL QUALITY: Does the overall design inspire enough trust for the site\'s context? A fintech needs bank-level polish; a personal blog can be simpler. Evaluate relative to the site type and target audience, not an absolute standard. Reference specific elements that build or erode trust.',
    ],
  },
  {
    name: 'Value Proposition & Messaging',
    pillar: 'Foundation',
    items: [
      'CLARITY: Can a first-time visitor explain what this product/service does after reading just the headline and subheadline? Quote the actual headline and subheadline text. If they\'re vague, generic, or feature-focused rather than benefit-focused, flag it with a specific rewrite suggestion.',
      'DIFFERENTIATION: Does the messaging clearly explain why someone should choose THIS over alternatives? Look for unique selling points, competitive positioning, or a clear "only we do X" statement. If the value prop could apply to any competitor in the space, that\'s a real gap.',
      'AUDIENCE FIT: Does the copy speak directly to the target user\'s pain points, goals, and language? Check whether the site uses "we/our" (company-focused) vs "you/your" (user-focused). Flag jargon, insider language, or feature dumps that don\'t connect to user benefits.',
      'PROOF & EVIDENCE: Does the site back up its claims with concrete evidence — numbers, case studies, demos, or specific examples? Vague promises like "the best solution" without evidence erode trust. Flag claims that need substantiation and suggest what evidence would strengthen them.',
    ],
  },
  {
    name: 'Navigation & Information Architecture',
    pillar: 'Foundation',
    items: [
      'PRIMARY NAVIGATION: Is the main nav intuitive, well-organized, and limited to 5-7 items? Are labels descriptive (what users expect to find) vs clever (creative labels that confuse)? Check if critical pages (pricing, about, contact, docs) are findable within 1-2 clicks from any page.',
      'PAGE STRUCTURE: Does each page have a logical content flow with clear sections? Check for proper use of headings (H1 → H2 → H3), section breaks, and content grouping. A user scanning the page should understand the structure at a glance.',
      'FOOTER & SECONDARY NAV: Does the footer provide useful links for users who scroll to the bottom — contact info, legal pages, social links, sitemap? A footer is the last chance to keep a visitor engaged. Flag empty or unhelpful footers.',
      'INTERNAL LINKING: Are related pages cross-linked logically? Can users discover deeper content naturally through the content itself (not just the nav)? Check for orphan pages, dead ends, or pages that don\'t link back to key conversion paths.',
    ],
  },
  {
    name: 'Content Quality & Readability',
    pillar: 'Foundation',
    items: [
      'SCANNABILITY: Is content structured for how people actually read online (F-pattern, scanning)? Check for short paragraphs (3-4 lines max), descriptive subheadings every 2-3 paragraphs, bullet points for lists, and bold text for key phrases. Flag large walls of text.',
      'WRITING QUALITY: Is the copy clear, concise, and free of errors? Check for grammar/spelling issues, passive voice, unnecessarily complex sentences, and filler words. The writing should feel confident and direct. Quote specific examples of weak or strong copy.',
      'TONE & VOICE: Is the tone consistent and appropriate for the audience? A B2B enterprise product should feel authoritative; a consumer app can be playful. Flag tonal inconsistencies between pages or sections that feel "off" for the target audience.',
      'MEDIA QUALITY: Are images, icons, and illustrations purposeful (not just decorative stock photos)? Do all meaningful images have alt text? Are videos captioned? Flag generic stock imagery that doesn\'t add value, and missing alt text on informational images.',
    ],
  },

  // ═══ PILLAR 2: HUMAN EXPERIENCE ═════════════════════════════
  // Conversion, trust, ethics, and emotional design
  {
    name: 'Calls-to-Action & Conversion Path',
    pillar: 'Human Experience',
    items: [
      'PRIMARY CTA: Is the main call-to-action visible above the fold, with action-oriented copy that tells users what happens when they click? "Start Free Trial" beats "Submit." "Get My Report" beats "Continue." Quote the actual CTA text and evaluate its effectiveness. Suggest a specific improvement if weak.',
      'CONVERSION FLOW: How many steps from "interested visitor" to "converted user"? Map the actual path. Each additional step loses ~20% of users. Flag unnecessary steps, confusing form fields, or moments where a user might abandon. A great conversion path feels effortless.',
      'SUPPORTING ELEMENTS: Is there social proof (testimonials, logos, user counts), urgency, or risk-reducers (free trial, money-back guarantee, "no credit card required") near the CTA? These elements can boost conversion 20-40%. Flag CTAs that are isolated without supporting context.',
      'SECONDARY CTAs: Beyond the primary action, are there appropriate secondary paths for users not ready to convert (learn more, see pricing, read case studies, watch demo)? A site with only one CTA ("Buy Now") loses everyone who isn\'t ready yet. Flag missing nurture paths.',
    ],
  },
  {
    name: 'Trust, Credibility & Social Proof',
    pillar: 'Human Experience',
    items: [
      'SOCIAL PROOF: Are there real testimonials, reviews, case studies, or user counts? Check if they feel authentic (named people, photos, specific results) vs generic ("Great product!" — Anonymous). Specific results ("Increased conversions by 34%") are 3x more persuasive than vague praise.',
      'AUTHORITY SIGNALS: Does the site display logos of known clients, media mentions, certifications, awards, or team credentials? For B2B: client logos and case studies matter most. For B2C: user reviews and ratings matter most. Evaluate based on what\'s appropriate for the business type.',
      'TRANSPARENCY: Can users easily find pricing, contact information, company details (who\'s behind this?), and terms/privacy policy? Hidden pricing is the #1 trust killer for SaaS. Missing "About" or team info raises legitimacy concerns. Flag anything that feels deliberately hidden.',
      'SECURITY & SAFETY: For sites handling money or data — are there SSL indicators, payment security badges, data handling explanations, or compliance mentions (GDPR, SOC2)? For informational sites, this is less critical. Evaluate based on what the site asks users to do (sign up, pay, share data).',
    ],
  },
  {
    name: 'Ethical UX & Dark Pattern Detection',
    pillar: 'Human Experience',
    items: [
      'CONFIRMSHAMING: Does the site use guilt-based language to manipulate decisions? Look for reject buttons like "No thanks, I don\'t want to save money" or "I\'ll stay uninformed." These erode trust and are increasingly flagged by regulators. Quote any examples found verbatim.',
      'FAKE URGENCY & SCARCITY: Are there countdown timers that reset, "only X left" badges without real inventory limits, or "limited time" offers that never end? Genuine urgency is fine — fake urgency is a dark pattern. Check if urgency elements reset on page reload or seem artificial.',
      'HIDDEN COSTS & DRIP PRICING: Does the final price differ from what was initially shown? Check for fees, taxes, or mandatory add-ons that only appear at checkout. Also check if the cancellation/unsubscribe process is deliberately buried or made unnecessarily difficult.',
      'CONSENT & PRIVACY: Is cookie consent implemented fairly (equal visual weight for Accept/Reject, no pre-checked boxes)? Are privacy defaults set to benefit the user or the company? Are there forced account creation walls blocking basic content? Flag any pattern that tricks users into giving up more than they intended.',
    ],
  },
  {
    name: 'Emotional Design & Psychological Safety',
    pillar: 'Human Experience',
    items: [
      'ANXIETY REDUCTION: Does the site create unnecessary stress through alarming language, loss aversion messaging, pressure tactics, or fear-based copy? A sign-up flow should feel inviting, not pressured. Quote specific anxiety-inducing copy and suggest calmer alternatives.',
      'ERROR HANDLING: When things go wrong (invalid input, 404 pages, failed actions), does the site respond with compassion and clear guidance — or with blame, jargon, or dead ends? Check form validation messages, error pages, and empty states. "Something went wrong" is never acceptable — the user needs to know what happened and what to do next.',
      'TONE & RESPECT: Is the overall voice respectful, empowering, and human? Does it talk TO users or AT them? Check for condescending language, corporate jargon that alienates, or overly casual tone that undermines credibility. The tone should match what users need to feel to take the desired action.',
      'PROCESS TRANSPARENCY: For multi-step flows (signup, checkout, onboarding) — can users see where they are, what\'s next, how long it takes, and easily go back? Surprise steps, hidden requirements, or inability to undo create anxiety. Flag any flow where the user might feel "trapped."',
    ],
  },

  // ═══ PILLAR 3: INCLUSIVE DESIGN ═════════════════════════════
  // Accessibility, cognitive design, wellbeing, and mobile
  {
    name: 'Accessibility & WCAG Compliance',
    pillar: 'Inclusive Design',
    items: [
      'PERCEIVABLE: Can all users perceive the content? Check colour contrast (WCAG AA = 4.5:1 for text, 3:1 for large text), alt text on meaningful images, captions on videos, and whether information is conveyed by colour alone (red/green without labels). Quote specific contrast failures if found.',
      'OPERABLE: Can all interactive elements be used via keyboard alone? Check for visible focus indicators on links/buttons, logical tab order, no keyboard traps, and touch targets ≥44×44px. Check if the site has skip-to-content links. Flag any interactive element that\'s mouse-only.',
      'UNDERSTANDABLE: Are form inputs properly labeled (not just placeholder text), error messages specific and helpful, and the page language declared (html lang="...")? Check for inputs without associated <label> elements — placeholder text disappears when typing and fails accessibility.',
      'ROBUST: Are ARIA roles and landmarks used correctly (not excessively)? Check for semantic HTML structure (<nav>, <main>, <aside>, <article>) that screen readers can parse. Misused ARIA is worse than no ARIA — flag aria roles that contradict the HTML element\'s native role.',
    ],
  },
  {
    name: 'Cognitive Accessibility & Neurodiversity',
    pillar: 'Inclusive Design',
    items: [
      'COGNITIVE LOAD: Is the layout clean with clear visual grouping, or cluttered with competing elements? Users with ADHD, anxiety, or cognitive differences are disproportionately affected by visual noise. Check for excessive pop-ups, auto-playing media, simultaneous animations, or more than 3 competing calls-to-action on one screen.',
      'READABILITY: Are fonts readable (sans-serif for body, ≥16px, line-height ≥1.5, line length 50-75 characters, no justified text)? Users with dyslexia struggle with small fonts, tight spacing, and justified text. Check body text specifically — headings can be more stylized.',
      'PREDICTABILITY: Is navigation consistent across pages? Do similar elements behave the same way throughout? Unexpected layout shifts, inconsistent menus, or buttons that do different things on different pages disrupt cognitive flow. Flag any "surprise" in the interface.',
      'MULTI-MODAL COMMUNICATION: Is important information conveyed through multiple channels (text + icons + colour, not just one)? A form error shown only by a red border fails for colourblind users and users who don\'t notice subtle visual changes. Check status messages, errors, and navigation states.',
    ],
  },
  {
    name: 'Digital Wellbeing & Responsible Design',
    pillar: 'Inclusive Design',
    items: [
      'RESPECTFUL ENGAGEMENT: Does the site use addictive patterns — infinite scroll without endpoints, notification manipulation, engagement loops, or guilt-based re-engagement ("We miss you!")? Ethical sites respect users\' time and attention. Flag patterns designed to exploit rather than serve.',
      'TIME RESPECT: Does the site create unnecessary friction to increase time-on-site? Forced multi-page articles, artificial pagination, mandatory account creation to view content, or hidden "close" buttons on modals all disrespect the user\'s time. Flag anything that adds steps without adding value.',
      'INCLUSIVE OF ALL ABILITIES: Are essential functions accessible without advanced digital skills? Check for: drag-and-drop as the only option, gesture-only interactions, hidden navigation (e.g., swipe-to-reveal), or tiny close buttons. Older users and users with motor impairments need forgiving, discoverable interfaces.',
      'HEALTHY DEFAULTS: Are default settings user-friendly? Check for pre-checked marketing opt-ins, privacy defaults that favour the company, auto-enrollment in features, or dark patterns in notification preferences. The default state should always favour the user\'s interests, not the business\'s.',
    ],
  },
  {
    name: 'Mobile Experience & Responsive Design',
    pillar: 'Inclusive Design',
    items: [
      'VIEWPORT & RESPONSIVENESS: Does the site have a proper viewport meta tag and responsive layout? Check the "RESPONSIVE DESIGN CHECK" section in the context for browser-verified results at 375px, 768px, 1024px, and 1440px viewports. Reference any confirmed horizontal overflow, fixed-width elements, or image overflow findings. If no responsive check data is available, assess from text content only.',
      'TOUCH INTERACTION: Are all interactive elements (buttons, links, form fields) at least 44×44px with adequate spacing between them? The responsive checker measures actual rendered touch target sizes — reference any confirmed findings about small targets. On mobile, fat-finger errors from tiny or cramped targets are the #1 usability killer.',
      'MOBILE NAVIGATION: Does the site have a mobile-appropriate navigation pattern (hamburger menu, bottom nav, or simplified nav)? The responsive checker detects whether navigation is adapted for mobile — reference those findings if available. Check that the mobile menu is easy to open, navigate, and close.',
      'MOBILE CONTENT PRIORITY: Is the most important content (value prop, CTA, key info) accessible without excessive scrolling on mobile? Desktop pages often have content spread across wide layouts that become extremely long on mobile. Check if the mobile experience respects the user\'s vertical scroll budget.',
    ],
  },

  // ═══ PILLAR 4: FUTURE READINESS ═════════════════════════════
  // Performance, AI discoverability, agent readiness, global reach
  {
    name: 'Performance & Technical Health',
    pillar: 'Future Readiness',
    items: [
      'PAGE WEIGHT: Evaluate the HTML for signs of heavy pages — large inline styles, excessive script tags, unoptimized image references (no srcset, no lazy loading, no WebP/AVIF), or heavy third-party embeds (chat widgets, analytics, social buttons). Each script tag and embed adds load time. Flag specific heavy elements.',
      'RENDER STRATEGY: Is critical content in the HTML (server-rendered) or does it require JavaScript to appear? Check if the page\'s main content, headings, and navigation are present in the raw HTML vs injected by JS. Content that requires JS to render is slower, less accessible, and invisible to many crawlers.',
      'TECHNICAL SEO: Does the page have a descriptive title tag (50-60 chars), meta description (120-160 chars), a single H1, and a logical heading hierarchy (H1→H2→H3, no skipped levels)? These are foundational signals for both search engines and AI systems. Quote the actual title/description and flag issues.',
      'STRUCTURED DATA: Does the site implement JSON-LD, schema.org, or Open Graph markup? Check for og:title, og:description, og:image, og:type, and any schema.org types (Organization, Product, SoftwareApplication, FAQPage, etc.). Having OG + meta description = baseline (60). Adding JSON-LD = good (75+). Full implementation = excellent (90+).',
    ],
  },
  {
    name: 'AI Discoverability & LLM Readiness',
    pillar: 'Future Readiness',
    items: [
      'THE LLM TEST: If someone asked an AI "What is [this website/product]?" — could it give an accurate, complete answer from the HTML alone? Evaluate whether purpose, audience, value proposition, and key differentiators are stated in text (not only in images/videos/JS). A site that tells its story clearly in text IS AI-discoverable — it doesn\'t need an FAQ page or knowledge base.',
      'SEMANTIC STRUCTURE: Is content organized with semantic HTML that AI can parse — proper headings (H1-H6), semantic elements (<article>, <section>, <nav>, <main>), and a logical information architecture? Clean HTML with logical hierarchy scores high. Minor semantic imperfections are LOW severity.',
      'CONTENT ACCESSIBILITY: Does the site surface its key facts as crawlable text? CONTEXT-AWARE: A SaaS should have features and pricing in text; a portfolio should describe its work; a blog should have articles accessible. Do NOT penalize for missing content types irrelevant to the business model.',
      'MACHINE-READABLE IDENTITY: Can AI systems accurately categorize what this site is and what it offers? Check structured data, meta tags, and whether the site\'s "about" information is machine-readable. Look for llms.txt or ai-plugin.json as bonus signals (absence is neutral, not a penalty).',
    ],
  },
  {
    name: 'AI Agent Readiness',
    pillar: 'Future Readiness',
    items: [
      'NAVIGABILITY: Can an AI agent follow the site\'s link structure to find key pages (pricing, features, about, contact, docs)? Check that navigation uses semantic HTML (<nav>, descriptive <a> tags with meaningful link text, not "click here"). A well-structured site IS agent-ready — it doesn\'t need e-commerce features.',
      'INTERACTIVE ELEMENTS: For whatever forms, buttons, and inputs exist — are they built with standard, labeled HTML? Check <label> associations, descriptive button text, input types, and autocomplete attributes. IMPORTANT: A site with no forms isn\'t "failing" — score based on what IS present. One well-built form beats ten poorly-labeled ones.',
      'CRAWL INFRASTRUCTURE: Does the site allow AI crawlers to access it? Check robots.txt (not blocking AI user agents), sitemap.xml presence, clean URL structure, and server-rendered content. Having all three = high score. Actively blocking AI crawlers = critical issue. Missing sitemap but otherwise open = medium.',
      'THE REAL-WORLD TEST: Could an AI assistant give someone accurate, helpful information about this business — its product, pricing, and how to get started — based on the HTML? This is the ultimate measure. If yes, the site is agent-ready regardless of technical details. If the AI would struggle with basic questions, that\'s the real gap to fix.',
    ],
  },
  {
    name: 'Cultural Sensitivity & Global Readiness',
    pillar: 'Future Readiness',
    items: [
      'LANGUAGE CLARITY: Is content written in plain language that non-native speakers and translation tools can process? Check for idioms, slang, or culture-specific references that wouldn\'t translate. IMPORTANT: Technical jargon is fine on technical products — evaluate based on the target audience.',
      'INTERNATIONALIZATION: Does the site declare its language (html lang="..."), handle text direction correctly, and format numbers/dates/currency appropriately for its audience? SCORING: A single-market site with correct local formatting = good. Not having RTL on an English-only site = LOW severity at most. Only flag RTL as high if the site explicitly targets global/multilingual audiences.',
      'CULTURAL NEUTRALITY: Are design choices and imagery neutral across major cultures? PRACTICAL: Standard web conventions (blue links, red errors, green success) are universal and should NEVER be flagged. Only flag genuinely problematic imagery, offensive symbols, or stereotypical representations.',
      'LEGAL & PRIVACY: Does the site have appropriate legal infrastructure for its markets? Check for privacy policy, cookie consent (if applicable), and data handling disclosures. A US site with a solid privacy policy = good. A site targeting EU users without GDPR basics = real gap. Evaluate based on actual target market, not theoretical global compliance.',
    ],
  },

  // ═══ MODULE 5: SEO STRUCTURE & RULES ═══════════════════════
  // Technical SEO, meta tags, structured data, crawlability
  {
    name: 'On-Page SEO Fundamentals',
    pillar: 'SEO Structure & Rules',
    items: [
      'TITLE TAGS: Does every page have a unique, descriptive title tag between 50-60 characters? The title should include the primary keyword near the beginning and the brand name. Quote the actual title tag for each crawled page and flag issues: too long (truncated in SERPs), too short (wasted opportunity), duplicate across pages, or missing entirely.',
      'META DESCRIPTIONS: Does every page have a unique meta description between 120-160 characters that summarizes the page content and includes a call-to-action? Quote actual meta descriptions. Flag: missing descriptions, duplicate descriptions across pages, descriptions that don\'t match page content, or descriptions that exceed the character limit.',
      'HEADING HIERARCHY: Does each page have exactly ONE H1 that clearly describes the page topic? Is the heading structure logical (H1 → H2 → H3) with no skipped levels? Check every crawled page. Flag: missing H1, multiple H1s, skipped heading levels (H1 → H3), headings used for styling rather than structure, or H1 that doesn\'t match the page\'s primary topic.',
      'URL STRUCTURE: Are URLs clean, descriptive, and human-readable? Check for: unnecessary parameters, session IDs in URLs, non-descriptive slugs (/page1, /post-123), excessive depth (/a/b/c/d/e/page), mixed case URLs, and special characters. Good URLs use hyphens, are lowercase, and describe the content (/pricing, /about, /blog/how-to-audit-ux).',
    ],
  },
  {
    name: 'Technical SEO & Crawlability',
    pillar: 'SEO Structure & Rules',
    items: [
      'ROBOTS & CRAWL DIRECTIVES: Check robots.txt for proper configuration. Are important pages accessible to crawlers? Are admin/private pages blocked? Look for overly restrictive rules that block CSS/JS (preventing proper rendering), or missing robots.txt entirely. Check for noindex/nofollow meta tags that might accidentally block important pages.',
      'SITEMAP: Does the site have an XML sitemap (usually at /sitemap.xml)? Is it referenced in robots.txt? Check if the sitemap includes all important pages and excludes non-indexable ones. Flag: missing sitemap, sitemap with errors, sitemap not referenced in robots.txt, or sitemap that includes redirected/404 URLs.',
      'CANONICAL URLS: Does the site use canonical tags to prevent duplicate content issues? Check for: missing canonical tags on important pages, self-referencing canonicals (good practice), canonical tags pointing to wrong URLs, HTTP vs HTTPS inconsistencies, and www vs non-www inconsistencies. Proper canonicalization prevents search engines from splitting page authority.',
      'INTERNAL LINKING & CRAWL DEPTH: Can search engines reach all important pages within 3 clicks from the homepage? Check the link structure: are key pages (pricing, features, about, contact) linked from the main navigation? Are there orphan pages with no internal links pointing to them? Is link text descriptive (not "click here")? Flag pages that are deeply buried or poorly interconnected.',
    ],
  },
  {
    name: 'Structured Data & Rich Results',
    pillar: 'SEO Structure & Rules',
    items: [
      'JSON-LD IMPLEMENTATION: Does the site use JSON-LD structured data? Check for common types: Organization, WebSite, WebPage, BreadcrumbList, FAQPage, Product, SoftwareApplication, LocalBusiness. Each type should have all required properties filled correctly. Flag: missing JSON-LD entirely, invalid JSON-LD syntax, incomplete required fields, or types that don\'t match the page content.',
      'OPEN GRAPH TAGS: Does every page have proper og:title, og:description, og:image, og:url, and og:type tags? These control how the site appears when shared on social media. Check: missing OG tags, OG image with wrong dimensions (should be 1200x630), og:title different from page title without good reason, and og:url not matching canonical URL.',
      'TWITTER/X CARDS: Does the site implement Twitter Card meta tags (twitter:card, twitter:title, twitter:description, twitter:image)? While less critical than OG tags, they provide control over Twitter/X appearance. Check for summary_large_image card type for maximum visual impact. Flag only if OG tags are also missing — having OG tags alone is acceptable as Twitter falls back to them.',
      'SCHEMA BREADCRUMBS & NAVIGATION: Does the site use BreadcrumbList schema for navigation hierarchy? Are breadcrumbs visible on the page AND marked up in structured data? Check that the breadcrumb trail matches the actual page hierarchy. For e-commerce and content-heavy sites, breadcrumbs are particularly important for both users and search engines.',
    ],
  },
  {
    name: 'SEO Content & Link Strategy',
    pillar: 'SEO Structure & Rules',
    items: [
      'CONTENT OPTIMIZATION: Is the page content optimized for its target keywords without keyword stuffing? Check: does the H1 include the primary topic, are subheadings descriptive and keyword-relevant, is the content comprehensive enough to satisfy search intent, and is there enough text content (thin pages rank poorly)? Flag pages with very little text content or content that doesn\'t match the page\'s apparent purpose.',
      'IMAGE SEO: Do all meaningful images have descriptive alt text that includes relevant context? Are images using modern formats (WebP/AVIF) with fallbacks? Do images have descriptive filenames (not IMG_001.jpg)? Are images properly sized (not 4000px wide loaded in a 400px container)? Check for lazy loading on below-fold images and eager loading on above-fold images.',
      'MOBILE SEO: Does the site have a proper viewport meta tag? Is the site mobile-responsive (not a separate m.domain)? Check for mobile-specific SEO issues: text too small to read, touch targets too close together, content wider than screen, and interstitials that block content on mobile. Google uses mobile-first indexing, so mobile experience directly impacts rankings.',
      'LINK EQUITY DISTRIBUTION: Are the most important pages (homepage, key landing pages, pricing) receiving the most internal links? Check for: excessive links in the footer/header that dilute equity, important pages with very few internal links, broken internal links (404s), and redirect chains. The site\'s most valuable pages should be the most interconnected.',
    ],
  },

  // ═══ MODULE 6: ACCESSIBILITY READINESS ═══════════════════════
  // WCAG 2.1 AA compliance, keyboard access, screen reader support, EAA readiness
  {
    name: 'Perceivable — Text Alternatives & Contrast',
    pillar: 'Accessibility Readiness',
    items: [
      'ALT TEXT COMPLETENESS: Do ALL meaningful images have descriptive alt text that conveys the image\'s purpose? Check every <img> tag: informational images need descriptive alt (what the image shows and why it matters), decorative images need alt="" (empty), functional images (links, buttons) need alt describing the action. Quote actual alt text found and flag missing or unhelpful alt (e.g., "image1.jpg", "photo", "banner"). Missing alt text on informational images is a WCAG 2.1 Level A failure (1.1.1).',
      'COLOUR CONTRAST: Does all text meet WCAG AA contrast ratios — 4.5:1 for normal text (<18pt / <14pt bold) and 3:1 for large text (≥18pt / ≥14pt bold)? Check: body text, headings, link text, button labels, placeholder text, and text over images/gradients. Also check non-text contrast (3:1) for UI components like form borders, icons, and focus indicators. Quote specific failures with actual ratios where possible. This is WCAG 2.1 Level AA (1.4.3, 1.4.11).',
      'MEDIA ALTERNATIVES: Do videos have captions and audio descriptions? Does audio content have transcripts? Check for <track> elements on video, caption/subtitle availability, and whether auto-play media can be paused. Also check that information conveyed through audio alone (e.g., podcast embeds) has a text alternative. This covers WCAG 2.1 Level A (1.2.1-1.2.3) and Level AA (1.2.5).',
      'NON-TEXT CONTENT LABELS: Is information conveyed by more than just colour, shape, or position? Check: error states that rely only on red colour (needs icon + text too), charts/graphs that use colour alone to distinguish data series, instructions like "click the green button" or "see the sidebar." Also check that CSS background images carrying meaning have text alternatives. WCAG 2.1 Level A (1.3.3, 1.4.1).',
    ],
  },
  {
    name: 'Operable — Keyboard & Navigation',
    pillar: 'Accessibility Readiness',
    items: [
      'KEYBOARD ACCESSIBILITY: Can ALL interactive elements (links, buttons, form fields, menus, modals, tabs, accordions, sliders, custom widgets) be reached and operated using only the keyboard? Check for: elements only accessible via mouse hover, click handlers on non-focusable elements (div, span without tabindex), and custom components that don\'t support Enter/Space activation. Every mouse action must have a keyboard equivalent. WCAG 2.1 Level A (2.1.1).',
      'FOCUS MANAGEMENT: Is there a visible focus indicator on all interactive elements? Check: do focused elements show a clear outline/ring (not just browser default that may be removed by CSS outline:none)? Is focus order logical (follows visual layout)? After modal/dialog opens, does focus move into it? After it closes, does focus return to the trigger? Are there any keyboard traps where Tab gets stuck? WCAG 2.1 Level A (2.4.3, 2.4.7, 2.1.2).',
      'SKIP LINKS & BYPASS BLOCKS: Does the page have a "Skip to main content" link as the first focusable element? Users who navigate by keyboard or screen reader shouldn\'t have to Tab through the entire header/nav on every page. Check: is the skip link present, does it become visible on focus, does it actually move focus to the main content area? Also check for proper use of landmark regions (<main>, <nav>) that enable screen reader users to jump between sections. WCAG 2.1 Level A (2.4.1).',
      'TOUCH TARGET SIZING: Are all interactive elements at least 44×44 CSS pixels with adequate spacing between them? Check: navigation links, buttons, form inputs, checkboxes, radio buttons, close buttons on modals, and icon-only buttons. Targets smaller than 44px cause usability issues on mobile and for users with motor impairments. Also check that targets don\'t overlap and have at least 8px spacing between them. WCAG 2.1 Level AAA (2.5.5) but widely adopted as best practice.',
    ],
  },
  {
    name: 'Understandable — Labels & Errors',
    pillar: 'Accessibility Readiness',
    items: [
      'FORM LABEL ASSOCIATION: Does every form input have a programmatically associated <label> element (using for/id or wrapping)? Check: text inputs, selects, checkboxes, radio buttons, textareas, and file inputs. Placeholder text is NOT a substitute for labels — it disappears when typing and isn\'t reliably read by screen readers. Also check that related inputs are grouped with <fieldset> and <legend> (e.g., radio button groups, address fields). WCAG 2.1 Level A (1.3.1, 3.3.2).',
      'ERROR IDENTIFICATION: When form validation fails, are errors clearly identified in text (not just colour), associated with the specific field, and announced to screen readers? Check: does the error message explain WHAT went wrong and HOW to fix it? Is error text placed near the relevant field (not just at the top of the form)? Are required fields indicated BEFORE submission (not just after failure)? Use aria-describedby or aria-errormessage to associate errors with inputs. WCAG 2.1 Level A (3.3.1, 3.3.3).',
      'HELP TEXT & INSTRUCTIONS: Are complex form fields accompanied by help text, input format hints, or examples? Check: date fields (expected format), password fields (requirements), phone/postal code fields (format). Are instructions provided BEFORE the form, not just in error messages after? Is help text programmatically associated with the field via aria-describedby? WCAG 2.1 Level A (3.3.2) and Level AA (3.3.5).',
      'CONSISTENT NAVIGATION: Is navigation consistent across all pages — same order, same labels, same structure? Does the site behave predictably — no unexpected context changes on focus or input (like auto-submitting forms, auto-navigating on select change)? Check that the page language is declared (html lang="xx") and that any language changes within the page are marked with lang attributes. WCAG 2.1 Level AA (3.2.3, 3.2.4, 3.1.1, 3.1.2).',
    ],
  },
  {
    name: 'Robust — ARIA & Semantic HTML',
    pillar: 'Accessibility Readiness',
    items: [
      'ARIA USAGE CORRECTNESS: Is ARIA used correctly and only when necessary? Check the "First Rule of ARIA" — don\'t use ARIA if a native HTML element exists (use <button> not <div role="button">). Verify: aria-label values are meaningful (not empty or redundant), aria-hidden="true" isn\'t used on visible interactive elements, role values are valid and match the element\'s behaviour, and required ARIA attributes are present (e.g., aria-expanded on disclosure widgets). Incorrect ARIA is WORSE than no ARIA. WCAG 2.1 Level A (4.1.2).',
      'LANDMARK REGIONS: Does the page use HTML5 landmark elements to define its structure — <header>, <nav>, <main>, <aside>, <footer>? There should be exactly ONE <main> element. Check that landmarks aren\'t nested incorrectly (no <main> inside <main>), and that multiple landmarks of the same type have aria-label to distinguish them (e.g., two <nav> elements should be labeled "Primary navigation" and "Footer navigation"). Screen reader users rely on landmarks to jump between page sections. WCAG 2.1 Level A (1.3.1).',
      'SEMANTIC ELEMENT STRUCTURE: Is the page built with semantic HTML — <article>, <section>, <figure>, <figcaption>, <time>, <address>, <details>, <summary> — or is it a sea of <div> and <span> elements? Check: are lists marked up as <ul>/<ol>/<li>, are tables used for tabular data (with <th> and scope), are headings used for structure (not styling), and is <strong>/<em> used for emphasis (not <b>/<i>)? Semantic HTML provides inherent accessibility. WCAG 2.1 Level A (1.3.1).',
      'ASSISTIVE TECHNOLOGY SUPPORT: Does the site work with screen readers and other assistive technologies? Check: do custom widgets (tabs, accordions, dropdowns, modals) follow WAI-ARIA authoring practices with correct roles, states, and properties? Are live regions (aria-live) used for dynamic content updates (toast notifications, loading states, chat messages)? Is the document outline logical when headings are extracted? Do all interactive elements have accessible names? WCAG 2.1 Level A (4.1.2, 4.1.3).',
    ],
  },

  // ═══ MODULE 7: DESIGN CONSISTENCY ═══════════════════════════
  // Evaluates whether the site applies its own visual system consistently.
  // This is a systems audit — not a taste audit, not brand strategy.
  // Strictly: does the site use its own patterns consistently across pages?
  {
    name: 'Typography & Type System',
    pillar: 'Design Consistency',
    items: [
      'FONT FAMILY CONSISTENCY: Does the site use a consistent set of font families across all pages? Check if the same heading font and body font are used everywhere, or if different pages load different typefaces. Flag: pages that introduce a font not used elsewhere, fallback system fonts appearing where a web font should load, or mixed serif/sans-serif usage without clear intent.',
      'HEADING HIERARCHY CONSISTENCY: Is the heading hierarchy (H1–H6) styled consistently across all pages? Check: are H1s the same size/weight on every page, are H2s styled the same way in blog posts as on landing pages? Flag: heading sizes that vary between pages, inconsistent use of heading levels (H2 on one page looks like H3 on another), or heading styles that break the established pattern.',
      'TYPE SCALE CONSISTENCY: Does the site use a consistent type scale (a defined set of font sizes)? Check: body text, captions, labels, navigation items, and UI text. Flag: arbitrary font sizes that don\'t follow a scale, text elements that are nearly-but-not-quite the same size (16px vs 15px vs 14px without clear purpose), or inconsistent line-height ratios.',
      'FONT WEIGHT & STYLE CONSISTENCY: Are font weights (bold, semibold, regular, light) applied consistently for the same purposes? Check: is bold always used for emphasis the same way, are link styles consistent, are navigation items the same weight? Flag: inconsistent use of bold/semibold for similar elements, italic used arbitrarily, or uppercase styling applied inconsistently.',
    ],
  },
  {
    name: 'Color & Visual Language',
    pillar: 'Design Consistency',
    items: [
      'COLOR USAGE CONSISTENCY: Does the site use its primary, secondary, and accent colors consistently for the same purposes? Check: is the primary color always used for primary CTAs, is the accent color always used for highlights, do background colors follow a pattern? Flag: the same color meaning different things on different pages, or multiple competing accent colors without hierarchy.',
      'PRIMARY CTA COLOR CONSISTENCY: Are primary call-to-action buttons always the same color, size class, and style? Check: hero CTAs, form submit buttons, checkout buttons, sign-up buttons. Flag: primary CTAs that change color between pages, buttons that look like primary CTAs but use a different color, or inconsistent hover/active states.',
      'SECONDARY CTA & LINK CONSISTENCY: Are secondary buttons and text links styled consistently? Check: do secondary buttons always use the same outline/ghost style, are text links always the same color and underline treatment? Flag: secondary buttons that look different on different pages, links that are sometimes underlined and sometimes not, or competing link colors.',
      'BACKGROUND & SURFACE TREATMENT: Are page backgrounds, card surfaces, and section treatments applied consistently? Check: do content cards always use the same background, border, and shadow treatment? Are section backgrounds alternating consistently? Flag: cards with different border-radius on different pages, inconsistent shadow depths, or surface colors that vary without purpose.',
    ],
  },
  {
    name: 'Component & Pattern Consistency',
    pillar: 'Design Consistency',
    items: [
      'BUTTON SIZE & STYLE CONSISTENCY: Are buttons of the same importance always the same size and shape? Check: do all primary buttons share the same height, padding, border-radius, and text style? Are icon buttons consistently sized? Flag: buttons that should be the same tier but have different heights, inconsistent border-radius (some rounded, some pill-shaped, some square), or varying padding.',
      'CARD & COMPONENT PATTERN CONSISTENCY: Are recurring UI patterns (cards, list items, testimonials, feature blocks) styled consistently? Check: do all product cards use the same layout, spacing, and typography? Flag: the same component type rendered differently in different sections, inconsistent image aspect ratios in grids, or card layouts that shift between pages.',
      'FORM FIELD CONSISTENCY: Are input fields, selects, checkboxes, and other form elements styled consistently? Check: do all text inputs have the same height, border style, focus state, and label placement? Flag: form inputs that look different on the contact page vs the signup page, inconsistent error state styling, or varying placeholder text styles.',
      'ICON & IMAGERY STYLE CONSISTENCY: Do icons follow a consistent style (line vs filled, same stroke width, same grid size)? Check: are icons from the same icon set, or are mixed styles used? Are photos treated consistently (filters, crops, overlays)? Flag: mixing thin-line icons with filled icons, inconsistent icon sizes in navigation, or photos with different treatment (some have overlays, some don\'t).',
    ],
  },
  {
    name: 'Layout & Spacing System',
    pillar: 'Design Consistency',
    items: [
      'SPACING RHYTHM CONSISTENCY: Does the site use a consistent spacing scale (e.g., 8px grid)? Check: are margins and padding between sections consistent, do cards have the same internal padding, is the gap between elements predictable? Flag: arbitrary spacing values that don\'t follow a system, sections with dramatically different vertical spacing without clear reason, or padding that varies between similar components.',
      'LAYOUT & ALIGNMENT CONSISTENCY: Are page layouts aligned to a consistent grid system? Check: do content sections use the same max-width, are elements aligned to the same vertical grid, is the overall page structure predictable? Flag: content that shifts width between pages, inconsistent sidebar/main proportions, or elements that break the grid without purpose.',
      'NAVIGATION CONSISTENCY: Is the navigation structure and styling consistent across all pages? Check: does the header look the same on every page, are breadcrumbs styled consistently, is the footer layout identical throughout? Flag: navigation items that change style on different pages, inconsistent active-state indicators, or mobile navigation that differs from desktop in unnecessary ways.',
      'RESPONSIVE PATTERN CONSISTENCY: Do breakpoint behaviors follow consistent rules across all pages? Check: do all grids collapse at the same breakpoints, are text sizes scaled consistently on mobile, do all cards stack the same way? Flag: pages that break differently at the same viewport, inconsistent mobile padding, or components that hide on mobile without clear pattern.',
    ],
  },
]

/**
 * Post-processing filter: reject findings that contain speculative language
 * or reference third-party infrastructure the site owner can't control.
 * This is a programmatic safety net — the prompt already instructs the AI
 * not to generate these, but some slip through.
 */
function isSpeculativeFinding(f: AnalysisFinding): boolean {
  const text = `${f.title} ${f.description}`.toLowerCase()

  // Speculative language patterns — findings that admit they can't verify
  const speculativePatterns = [
    'not verified',
    'could not verify',
    'could not confirm',
    'unable to verify',
    'unable to confirm',
    'not tested',
    'could not be tested',
    'cannot be confirmed',
    'unclear whether',
    'unclear if',
    'it is unclear',
    'potentially missing',
    'potentially lacks',
    'possible lack of',
    'appears to be missing',
    'appears to lack',
    'no evidence of.*but',  // "no evidence of X but could be"
    'without further testing',
    'would need to be tested',
    'requires manual testing',
    'requires further investigation',
    'cannot determine from',
    'not possible to assess',
    // New patterns: "can't see it from crawled content" admissions
    'provided content does not',
    'provided content doesn\'t',
    'not included in the provided',
    'not visible in the provided',
    'not visible in provided',
    'not included in provided',
    'cannot be completed without',
    'cannot be verified without',
    'not available in the provided',
    'not shown in the provided',
    'not mentioned in the provided',
    'full.*cannot be completed',
    'full.*audit cannot',
    'without interactive testing',
    'without live testing',
    'without visual evidence',
    'without css',
    'no css.*information',
    'cannot.*from text content',
    'cannot.*from crawled',
    'unverified',
    'conditional.*if applicable',
    'if applicable.*not applicable',
    'this finding is conditional',
  ]

  for (const pattern of speculativePatterns) {
    if (pattern.includes('.*')) {
      if (new RegExp(pattern).test(text)) return true
    } else {
      if (text.includes(pattern)) return true
    }
  }

  // Third-party infrastructure — site owner can't fix these
  const infrastructurePatterns = [
    'cloudflare',
    'email obfuscat',
    'email protect',
    'cdn-cgi',
    '/cdn-cgi/',
    'edge cach',
    'server header',
    'x-powered-by',
    'cf-ray',
  ]

  for (const pattern of infrastructurePatterns) {
    if (text.includes(pattern)) return true
  }

  return false
}

/**
 * Programmatic contradiction net (2026-06-10) — safety net behind the
 * MISSING-vs-WEAK prompt rule. If a finding claims an element is absent
 * while the crawled content demonstrably contains it, the finding is
 * dropped before it ever reaches the report. A report that says "you have
 * no testimonials" to a site with a visible testimonials section loses
 * the client's trust in every other finding.
 */
const ABSENCE_CONTRADICTION_RULES: Array<{ claim: RegExp; evidence: RegExp; label: string }> = [
  {
    claim: /\b(no|missing|lacks?|without|absence of|doesn'?t (have|include|contain))\b[^.]{0,60}\b(testimonials?|reviews?|social proof)\b/i,
    // Evidence must show testimonial STRUCTURE (quoted praise with attribution
    // or a testimonials section heading) — NOT the bare word "testimonial",
    // which product/marketing copy mentions descriptively (fixpath.ai itself
    // describes testimonial checks as a feature without having any).
    evidence: /["“][^"”]{25,300}["”]\s*[—–-]\s*[A-Z][\w.]+|from our (students|customers|clients)|what (our )?(customers|clients|students|users) say|^\s*#*\s*testimonials\s*$/im,
    label: 'testimonials',
  },
  {
    claim: /\b(no|missing|lacks?|without)\b[^.]{0,40}\b(faq|frequently asked)\b/i,
    evidence: /\bfaq\b|frequently asked/i,
    label: 'FAQ',
  },
  {
    claim: /\b(no|missing|lacks?|without)\b[^.]{0,50}\b(contact (information|details|page)|phone number|email address)\b/i,
    evidence: /contact (us|&|and|form|support)|@[a-z0-9-]+\.[a-z]{2,}|\+?\d[\d\s().-]{7,}/i,
    label: 'contact information',
  },
  {
    claim: /\b(no|missing|lacks?|without)\b[^.]{0,40}\b(pricing|prices)\b/i,
    evidence: /\$\s?\d|\d+\s?(€|CAD|USD)|\/(hour|month|session)\b|pricing/i,
    label: 'pricing',
  },
]

/**
 * Reverse direction (2026-06-11): findings that critique the QUALITY of an
 * element the site doesn't have. The fixpath.ai audit claimed "the site
 * includes customer quotes, but they lack attribution" — the site has zero
 * testimonials. A presence-critique requires structural evidence the
 * element exists; the bare concept word in marketing copy is not enough.
 */
const PRESENCE_FABRICATION_RULES: Array<{ claim: RegExp; evidence: RegExp; label: string }> = [
  {
    claim: /\b(testimonials?|customer quotes?|reviews?)\b[^.]{0,80}\b(lack|without|don'?t (show|include)|are (generic|anonymous|unattributed)|appear to be|missing (attribution|names))/i,
    evidence: /["“][^"”]{25,300}["”]\s*[—–-]\s*[A-Z][\w.]+|from our (students|customers|clients)|what (our )?(customers|clients|students|users) say|^\s*#*\s*testimonials\s*$/im,
    label: 'testimonials/customer quotes',
  },
  {
    claim: /\b(client|customer|partner) logos?\b[^.]{0,60}\b(lack|low[- ]quality|outdated|too small|inconsistent)/i,
    evidence: /\b(trusted by|used by|our (clients|customers|partners))\b/i,
    label: 'client logos',
  },
  {
    claim: /\bcase stud(y|ies)\b[^.]{0,70}\b(lack|don'?t|without|too (short|vague)|missing (results|metrics))/i,
    evidence: /\bcase stud(y|ies)\b[^.]{0,120}\b(read|view|see|results?|how )/i,
    label: 'case studies',
  },
]

export function contradictsContent(f: Pick<AnalysisFinding, 'title' | 'description'>, pageContent: string): boolean {
  // Test title and description as SEPARATE segments. Concatenating them let
  // "…attribution. Testimonials lack links…" match the absence pattern
  // ("lack …60 chars… testimonials") ACROSS the title/description seam,
  // wrongly dropping legitimate quality critiques (caught by the
  // contradiction-net test suite on day one, 2026-06-11).
  const segments = [f.title || '', f.description || '']
  const claimMatches = (re: RegExp) => segments.some((t) => re.test(t))
  for (const rule of ABSENCE_CONTRADICTION_RULES) {
    if (claimMatches(rule.claim) && rule.evidence.test(pageContent)) {
      console.warn(`[contradiction-net] Dropped finding "${f.title.slice(0, 80)}" — claims missing ${rule.label}, but content contains it`)
      return true
    }
  }
  for (const rule of PRESENCE_FABRICATION_RULES) {
    if (claimMatches(rule.claim) && !rule.evidence.test(pageContent)) {
      console.warn(`[contradiction-net] Dropped finding "${f.title.slice(0, 80)}" — critiques ${rule.label} the content shows no evidence of`)
      return true
    }
  }
  return false
}

/**
 * Programmatic deduplication — removes findings that are near-duplicates of each other.
 * Uses title similarity and description overlap to detect the same issue reported multiple times.
 */
function deduplicateFindings(findings: AnalysisFinding[]): AnalysisFinding[] {
  if (findings.length <= 1) return findings

  // Normalize text for comparison
  function normalize(s: string): string {
    return s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Extract key "topic" words — nouns and adjectives that define the finding
  function topicWords(s: string): Set<string> {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'and', 'but',
      'or', 'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither',
      'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
      'such', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'while',
      'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
      'what', 'which', 'who', 'whom', 'how', 'where', 'why', 'there', 'here',
      'page', 'pages', 'site', 'website', 'users', 'user', 'content', 'data',
    ])
    const words = normalize(s).split(' ')
    return new Set(words.filter((w) => w.length > 2 && !stopWords.has(w)))
  }

  // Jaccard similarity between two sets
  function similarity(a: Set<string>, b: Set<string>): number {
    let intersectionSize = 0
    a.forEach((x) => { if (b.has(x)) intersectionSize++ })
    const unionSize = a.size + b.size - intersectionSize
    return unionSize > 0 ? intersectionSize / unionSize : 0
  }

  const kept: AnalysisFinding[] = []
  const keptTopics: Set<string>[] = []

  // Sort by severity (critical first) so we keep the highest-severity version
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
  )

  for (const finding of sorted) {
    const titleTopics = topicWords(finding.title)
    const descTopics = topicWords(finding.description.substring(0, 300))
    const allTopics = new Set<string>()
    titleTopics.forEach((w) => allTopics.add(w))
    descTopics.forEach((w) => allTopics.add(w))

    let isDuplicate = false
    for (const existing of keptTopics) {
      const sim = similarity(allTopics, existing)
      if (sim > 0.45) {
        isDuplicate = true
        break
      }
      // Also check title-only similarity (catches renamed duplicates)
      const titleSim = similarity(titleTopics, existing)
      if (titleSim > 0.55) {
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      kept.push(finding)
      keptTopics.push(allTopics)
    }
  }

  if (kept.length < findings.length) {
    console.log(`[dedup] Removed ${findings.length - kept.length} duplicate findings (${findings.length} → ${kept.length})`)
  }

  return kept
}

/**
 * Analyze a single UX category — called once per category
 * @param depthMode 'deep' = find new issues freely (first audit or explicit Dig Deeper)
 *                  'baseline' = ONLY check status of previous findings, no new issues
 */
export async function analyzeCategory(
  pageContent: string,
  category: string,
  checklistItems: Array<{ title: string; description: string; whatToCheck: string }>,
  userFocus?: string | null,
  language: string = 'en',
  depthMode: 'deep' | 'baseline' = 'deep',
  siteProfile?: SiteProfile | null,
): Promise<AnalysisFinding[]> {
  // If checklist is empty (DB not seeded), use our built-in category
  const builtIn = UX_CATEGORIES.find((c) => c.name.toLowerCase().includes(category.toLowerCase()))
  const itemsToCheck =
    checklistItems.length > 0
      ? checklistItems.map((i, idx) => `${idx + 1}. ${i.title}\n   What to check: ${i.whatToCheck}`).join('\n')
      : builtIn
        ? builtIn.items.map((item, idx) => `${idx + 1}. ${item}`).join('\n')
        : `Evaluate all aspects of the "${category}" category for UX quality.`

  const focusBlock = userFocus && userFocus.trim() && userFocus.trim().toLowerCase() !== 'general ux audit'
    ? `\nUSER PRIORITY — The client has specifically asked to focus on:\n"${userFocus.trim()}"\nPay EXTRA attention to anything related to this concern. If this category is relevant to their focus area, add more detailed findings about it. Increase severity for issues directly impacting their stated concern.\n`
    : ''

  const languageInstruction = getLanguagePromptInstruction(language)

  // Translate the category name for the prompt (keep English internally for lookup)
  const englishCategoryNames = getCategoryNames('en')
  const translatedCategoryNames = getCategoryNames(language)
  const categoryIndex = englishCategoryNames.findIndex(
    (n) => n.toLowerCase() === category.toLowerCase()
  )
  const displayCategoryName = categoryIndex >= 0 && translatedCategoryNames[categoryIndex]
    ? translatedCategoryNames[categoryIndex]
    : category

  // Extract available page URLs from the aggregated content for the prompt
  const availableUrls = pageContent
    .split('\n')
    .filter((line) => line.startsWith('URL: '))
    .map((line) => line.replace('URL: ', '').trim())
  const pageUrlIndex = availableUrls.length > 0
    ? `\nAVAILABLE PAGE URLs (use ONLY these exact URLs for the "pageUrl" field):\n${availableUrls.map((u, i) => `  [${i + 1}] ${u}`).join('\n')}\n`
    : ''

  // ── Prompt caching strategy ───────────────────────────────────
  // The static instruction block (~4 000 words) is identical across all 24
  // category calls within one audit.  Moving it to a `system` message with
  // cache_control means calls 2-24 get a cache *read* hit (~90 % cheaper
  // on input tokens) while only call #1 pays the 25 % write premium.
  //
  // Variable parts (category name, checklist, page content, language,
  // re-audit context) stay in the `user` message.

  const systemInstructions = `You are a senior UX strategist conducting a deep, human-centered UX audit for a paying client.

APPROACH: Think like a senior consultant, not an automated checker. Find REAL issues that impact users, conversions, and business outcomes.

CONTEXT-AWARE EVALUATION:
Determine the site's type and target audience. Adapt your evaluation:
- Evaluate what IS there, not what's absent. Don't invent problems for "missing" checklist items.
- A SaaS product doesn't need shopping cart features; a developer tool can use technical jargon; an English-only site doesn't need RTL support; a site with no forms can't "fail at form accessibility."
- The question: "Does this site WORK for its users and AI systems?" — not "Does it have every possible feature?"

CROSS-PAGE AWARENESS:
Content includes ALL crawled pages. Before flagging something as "missing", check ALL pages (bios on /about, pricing on /pricing, FAQ on /faq, etc.). If the site map shows a relevant page exists, assume it addresses the concern. Only flag content as missing if it genuinely doesn't exist anywhere on the site.

DEMO CONTENT EXCLUSION:
Exclude example/demo content showcasing the product's capabilities (elements marked data-demo="true", labeled "Example"/"Demo"/"Sample", product showcase sections). Never flag demo content as real findings.

EVIDENCE RULES — ZERO SPECULATION:
- Every finding MUST quote specific text, elements, or patterns you directly observed.
- Words like "not verified", "potentially", "may have", "appears to lack" = AUTOMATIC REJECTION.
- Before flagging "missing X", search the provided content for X first.
- If you cannot point to a specific quoted excerpt proving the issue, the finding does not exist.
- Before finalizing, check for CONTRADICTORY evidence — if the page contradicts your claim, DROP the finding.
- A finding CANNOT be surfaced from category expectations alone — it must have specific evidence FROM THE PROVIDED CONTENT.

MISSING vs WEAK — NEVER CLAIM ABSENT WHAT EXISTS (TRUST-CRITICAL):
Claiming something is "missing" when it exists on the site instantly destroys the client's trust in the entire report. Before ANY "missing/no/lacks X" claim, search ALL provided page content for X.
- If X exists but is WEAK, the finding must ACKNOWLEDGE it exists and critique its quality. Example: NOT "The site has no testimonials" but "You have testimonials with student names, but they are not linked to any trusted platform (Google Reviews, Trustpilot) or tied to verifiable results, which limits their persuasive power."
- If a tag/element exists but is generic or duplicated (e.g., meta description present but identical to the title), say "present but weak/generic", NEVER "missing".
- A weak-but-present element is usually MEDIUM severity at most, not HIGH.

QUOTE-TO-CRITIQUE — FABRICATING PRESENCE IS WORSE THAN CLAIMING ABSENCE:
The rule above does NOT mean you should hedge into "exists but weak" when unsure. You may only critique the QUALITY of an element if you can quote it VERBATIM from the provided content.
- "The site includes customer quotes but they lack attribution" is a FABRICATION unless you quote an actual customer quote from the content. If you cannot quote a testimonial, the site has no testimonials — say so.
- MENTION IS NOT EXISTENCE: marketing/feature/demo copy often DESCRIBES concepts ("we check your testimonials", "social proof analysis", example findings in product screenshots). A page talking ABOUT testimonials does not HAVE testimonials. Never cite descriptive or demo copy as evidence an element exists.
- Decision rule: can you paste the element's own text into the finding? Yes → critique its quality. No → it is absent; write an absence finding.

HONEST ABSENCE FOR NEW BRANDS:
When trust elements (testimonials, client logos, case studies, reviews) are genuinely absent and the site profile indicates a new/emerging brand, the recommendation must respect that absence is BETTER than fabrication:
- Recommend EARNING real proof: pilot programs, named founder credibility, transparent "early access" framing, money-back guarantees, public roadmaps/changelogs — and adding real testimonials only as they are collected.
- Explicitly note that fabricated or anonymous filler testimonials would damage trust more than showing none.
- NEVER recommend "add customer testimonials" to a business that has no customers' quotes to show.

JS-RENDERED CONTENT: Dynamic elements (carousels, rotating headlines, tabs) may only show ONE state. Never judge full messaging strategy on a single captured snapshot.

TEXT CONTENT LIMITATIONS — YOU CANNOT SEE:
- CSS (styles, focus states, animations, color contrast, touch target sizes, responsive breakpoints)
- HTML attributes (lang, aria-*, role, autocomplete, htmlFor)
- Structured data (JSON-LD, Schema.org — may exist in stripped <head>)
- Meta/OG tags, canonical URLs
- JavaScript behavior (form validation, error messages, loading/success states)
- Keyboard navigation, screen reader behavior, touch interactions
RULE: If an issue depends on CSS, HTML attributes, JS behavior, or visual rendering you cannot access — DO NOT INCLUDE IT.
"The provided content does not show X" is NOT evidence that X is missing.
RESPONSIVE CHECK: If context includes "RESPONSIVE DESIGN CHECK — Browser-verified results", those are CONFIRMED. Reference them, do NOT contradict them. If responsive check reports "desktop_nav_hidden", evaluate against site profile — for mainstream commercial sites this is HIGH-severity; for personal/creative sites it may be acceptable. Always generate a finding for browser-verified signals.

EXCLUSIONS — Never flag:
- Third-party/infrastructure issues (CDN, Cloudflare, hosting artifacts, third-party widgets, email obfuscation)
- Subjective design preferences without evidence of user impact ("color palette feels...", "layout is too...")
- Aesthetic opinions disguised as UX recommendations
- Content that EXISTS on another page — CHECK THE SITE MAP
- Things you cannot verify from text (focus indicators, form validation, responsive design, lang attribute, meta tags, structured data)
- Industry-standard patterns acceptable for the site's context
- Demo content showcasing product features
- Missing content types that don't apply (FAQ, pricing, blog — only if the site NEEDS them)
- RTL/multi-language on single-language sites; localization on sites without those elements
- Privacy policy tone or legal page writing style
- Identical issues on login vs register pages — these are ONE finding
A finding must describe a FUNCTIONAL problem that causes users to fail, abandon, misunderstand, or feel unsafe.

SIGNAL MODEL — Every candidate finding must be strong on at least TWO dimensions (THREE for high-severity):
A. Structural — hierarchy, IA, navigation, task flow
B. Clarity — comprehension, orientation, expectation-setting
C. Trust — legitimacy, reassurance, transparency, credibility
D. Friction — avoidable effort, hesitation, confusion, delay
E. Market-Fit — material due to industry, audience, country, cultural context
F. Consistency — across pages, states, labels, actions, flows
G. Technical — crawlability, accessibility, indexing, rendering, machine extraction
H. Actionability — can be explained clearly and improved practically
If only strong on ONE signal, suppress it.

ANTI-TIMIDITY: Do NOT suppress real structural problems due to elegant visuals (premium bias), "brand style" excuses, or technical tunnel vision. Surface what matters, not just what's easy to measure. A site with perfect HTML can still have broken UX. If technical checks are clean but structural/clarity/trust/conversion weaknesses exist, surface them as interpretive or heuristic findings.

SITE-TYPE SCOPE: For simple business-card sites (no signup, no pricing), do NOT generate findings about pricing transparency, dark patterns, or psychological friction unless concrete evidence supports the claim.

VIEWPORT ASSIGNMENT (MANDATORY):
Every finding MUST specify viewport. NEVER leave null.
- Responsive checker data for specific width → that viewport
- Mobile-specific → "mobile"; Desktop-specific → "desktop"
- All viewports → "all"; Inconsistency between viewports → "cross-viewport"
- Technical (meta, schema, crawlability) → "technical"; Brand voice → "brand-dna"

DUAL-LAYER COMMUNICATION (MANDATORY):
Every finding MUST include plain-language fields (titlePlain, whatFound, whyMatters, fixPlain) alongside technical fields.
- Write for a restaurant owner or marketing coordinator, NOT a developer.
- ALWAYS name the specific element ("navigation menu", "contact form", "hero section") — NEVER use jargon ("interactive elements", "ARIA landmarks").
- whyMatters = business consequence (lost bookings, confused visitors), NOT WCAG citations.
- fixPlain = what to do, not how to code it.

FINDING WORDING: Every finding must clearly state (1) WHAT is happening, (2) WHY it matters for this site's context, (3) PRACTICAL IMPACT on users/business.

SEVERITY:
- "critical": Actively losing significant revenue, users, or trust. Fix immediately.
- "high": Noticeably hurting the experience. Users confused or frustrated.
- "medium": Real improvement that would meaningfully move the needle.
- "low": Refinement separating good from great.

FINDING CLASSIFICATION:
- "fixable" = concrete, deployable (HTML, meta, schema, copy, file, config change). MUST provide exact implementation.
- "strategic" = requires redesign, strategy, or judgment. Set fixType to null.
For fixable: fixType = "html" | "meta" | "schema" | "copy" | "file" | "config".

EVIDENCE TIERS (MANDATORY confidence_level):
- "deterministic" — provably present from extracted evidence. MUST always be surfaced.
- "interpretive" — grounded in page evidence but involves professional interpretation. Surface when clearly supported.
- "heuristic" — higher-level judgment from multiple converging signals. Use sparingly but valid.
Do NOT filter out interpretive/heuristic findings just because they aren't deterministic.

DEDUP (STRICTLY ENFORCED):
- Same issue across pages (login + register + contact) = ONE finding.
- Same root cause = ONE finding. Same headline critiqued from multiple angles = ONE finding.
- Before adding: "Is this the same underlying problem as something already listed?" If yes, DO NOT add it.

QUANTITY (HARD LIMITS):
- 1-3 UNIQUE findings per category. MAX 3, MIN 1.
- Score below 80 → at least 2 findings. Score below 60 → exactly 3 findings.
- Never invent problems, but DO surface real interpretive/heuristic observations.

SELF-CHECK before returning:
1. Evidence grounded? If none → DELETE.
2. Owner can control it? If no → DELETE.
3. Functional problem or just preference? If pure preference → DELETE.
4. Duplicate of another finding? → MERGE.
5. Worth the client's time to fix? If no → DELETE.
6. At least 1 finding returned? If no, re-examine.

PAGE URL ASSIGNMENT: Set "pageUrl" to the EXACT URL where the issue exists. Distribute findings across actual pages — NEVER use homepage URL for every finding.

Return a JSON array. Each issue:
{
  "severity": "critical" | "high" | "medium" | "low",
  "findingType": "fixable" | "strategic",
  "fixType": "html" | "meta" | "schema" | "copy" | "file" | "config" | null,
  "title": "Clear, specific title",
  "description": "Deep analysis referencing actual content with quoted text. Explain psychological or business impact.",
  "recommendation": "FIXABLE: exact implementation. STRATEGIC: direction and next steps.",
  "estimatedImpact": "Specific expected improvement",
  "targetElement": "CSS selector or null if page-wide",
  "pageUrl": "Exact full URL from the available list",
  "aiInterpretation": "CRITICAL/HIGH only — how AI would misinterpret this element. Null for medium/low.",
  "humanInterpretation": "CRITICAL/HIGH only — how a human perceives the same element differently. Null for medium/low.",
  "titlePlain": "Plain-language title naming the specific element. Understandable by a restaurant owner.",
  "whatFound": "Plain-language explanation with specific evidence. No HTML/CSS jargon.",
  "whyMatters": "Business consequence in plain language. No jargon.",
  "technicalNote": "Developer-facing detail or null if purely strategic.",
  "fixPlain": "What to do — plain language.",
  "fixTechnical": "Technical implementation details or null.",
  "viewport": "mobile | desktop | tablet | all | cross-viewport | technical | brand-dna"
}

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.`

  // Build site profile context block for the prompt (variable per audit, not cached)
  const profileBlock = siteProfile ? `
SITE PROFILE (detected from crawled content — use this to calibrate your evaluation):
- Industry: ${siteProfile.industryVertical}
- Target Audience: ${siteProfile.targetAudience}
- Audience Sophistication: ${siteProfile.audienceSophistication}
- Communication Style Norms: ${siteProfile.communicationStyle}
- Market Position: ${siteProfile.marketPosition}
- Context: ${siteProfile.contextNotes}

CALIBRATION RULES (based on site profile):
You MUST evaluate this site against the standards, norms, and expectations of its specific industry and audience — NOT against generic best practices for all websites.
- If the audience is "expert" or "professional", subtle/understated messaging is NOT a weakness. Do NOT flag it as "weak CTA" or "unclear value proposition" if the messaging matches the audience's expectations.
- If the market position is "leader" or "challenger", adjust expectations proportionally — but do NOT suppress valid findings just because the brand is established. A leader with missing trust signals still has missing trust signals. RULE 6: Do not protect the website from criticism. Protect the report from being wrong.
- If the communication style is minimalist/craft-focused, do NOT flag clean design as "missing visual interest" or "lacking engagement elements."
- Evaluate against COMPETITORS IN THE SAME INDUSTRY, not against a generic ideal website template.
- A finding is only valid if it would be a REAL problem for THIS specific audience. "A professional designer visiting Sketch.com" has different expectations than "a first-time visitor to a random SaaS."
` : ''

  // Variable part — category-specific content that changes per call
  const userPrompt = `${languageInstruction}
${profileBlock}CATEGORY: ${displayCategoryName}
${focusBlock}${pageUrlIndex}
EVALUATION CRITERIA:
${itemsToCheck}

WEBSITE CONTENT (text extracted from MULTIPLE PAGES — each page starts with "URL:" followed by the page address):
---
${pageContent.substring(0, 6000)}
---
${pageContent.includes('PREVIOUS FINDINGS') ? `
RE-AUDIT CONSISTENCY:
A PREVIOUS AUDIT BASELINE is provided above. You MUST be consistent:
- Do NOT invent new issues for content that hasn't changed since the previous audit.
- Do NOT assign a different severity to the same unchanged issue.
- If a [SKIP] or [FIXED] finding is listed, do NOT re-report it unless the issue is CLEARLY still present.
- If a [OPEN] finding from the previous audit is still present, re-report it with the SAME title and severity.
- Only report genuinely NEW issues that were not covered in any previous finding.
- Consistency between audits is CRITICAL. Random variation on unchanged content destroys user trust.

DEEP MODE CONSTRAINTS:
The user explicitly requested to find NEW issues beyond what was found before.
However, you MUST respect these rules:
1. NEVER contradict a previous recommendation. If a previous finding recommended action X, do NOT create a new finding that recommends the opposite of X. Your new findings must be ADDITIVE, not contradictory.
2. NEVER re-report a previously [FIXED] or [SKIP] finding under a different title. If an issue was dismissed or fixed, it's done.
3. Do NOT find issues for the sake of finding issues. Every new finding must be genuinely impactful — the kind of thing a $200/hour consultant would flag. If there are no new real issues to find, return fewer findings. Quality over quantity.
4. New findings should explore DEEPER layers of analysis — things the first audit couldn't cover, subtle interaction patterns, advanced accessibility edge cases, nuanced content strategy gaps. Not surface-level issues that should have been caught the first time.` : ''}
${language !== 'en' ? `\nFINAL REMINDER — LANGUAGE: Every single field in the JSON response (title, description, recommendation, estimatedImpact) MUST be written in ${getLanguageLabel(language)}. The JSON keys stay in English, but ALL values must be in ${getLanguageLabel(language)}. Do NOT write any finding text in English.\n` : ''}
Analyze this category and return the JSON array now.`

  try {
    const anthropic = getAnthropicClient()
    // Haiku 4.5 — excellent at structured analysis tasks.
    // Prompt caching: static system instructions cached with cache_control.
    // Single attempt only — NO retries. Retries were the root cause of batch 4/4
    // stalls: orphaned HTTP requests from timed-out calls cause cascading rate
    // limits on parallel categories. One clean attempt per category is enough.
    const message = await anthropic.beta.promptCaching.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      temperature: 0,
      system: [{ type: 'text', text: systemInstructions, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = responseText.match(/\[[\s\S]*\]/m)
    if (!jsonMatch) {
      console.warn(`[analyzeCategory] No JSON in response for "${category}":`, responseText.substring(0, 200))
      // Return empty array — this category had no findings (not necessarily an error)
      return []
    }

    const findings: AnalysisFinding[] = JSON.parse(jsonMatch[0])
    return findings
      .filter((f) => f.severity && f.title && f.description && f.recommendation)
      .filter((f) => !isSpeculativeFinding(f))
      .filter((f) => !contradictsContent(f, pageContent))
      .map((f) => ({
        ...f,
        targetElement: f.targetElement || null,
        pageUrl: f.pageUrl || null,
        // Normalize communication fields
        titlePlain: f.titlePlain || null,
        whatFound: f.whatFound || null,
        whyMatters: f.whyMatters || null,
        technicalNote: f.technicalNote || null,
        fixPlain: f.fixPlain || null,
        fixTechnical: f.fixTechnical || null,
      }))
  } catch (err) {
    console.error(`[analyzeCategory] Error for "${category}":`, err instanceof Error ? err.message : err)
    // Return empty — don't throw. One category failing shouldn't kill the audit.
    return []
  }
}

/**
 * Run full analysis across UX categories in parallel batches.
 * Processes categories one at a time to avoid rate limits.
 * Skips Design Consistency (24-27) only when Brand DNA enrichment is explicitly enabled but no brand files are attached.
 * Respects selected_modules if provided.
 */
export async function runFullAnalysis(
  pageContent: string,
  audit: Audit,
  userFocus?: string | null,
  language: string = 'en',
  depthMode: 'deep' | 'baseline' = 'deep',
  onProgress?: (done: number, total: number, categoryName: string) => void | Promise<void>,
): Promise<AnalysisFinding[]> {
  const allFindings: AnalysisFinding[] = []

  // Module slug → category index ranges
  const MODULE_RANGES: Record<string, [number, number]> = {
    foundation: [0, 4],
    human_experience: [4, 8],
    inclusive_design: [8, 12],
    future_readiness: [12, 16],
    seo_structure: [16, 20],
    accessibility_readiness: [20, 24],
    design_consistency: [24, 28],
    // Legacy alias — historical audits stored 'brand_consistency' in selected_modules
    brand_consistency: [24, 28],
  }

  // Determine which categories to analyze
  const selectedModules: string[] | null = (audit as any).selected_modules ?? null

  function shouldAnalyze(categoryIndex: number): boolean {
    // Design Consistency (24-27) always runs — no brand identity gate needed.
    // If selected_modules specified, only analyze those modules
    if (selectedModules && selectedModules.length > 0) {
      for (const mod of selectedModules) {
        const range = MODULE_RANGES[mod]
        if (range && categoryIndex >= range[0] && categoryIndex < range[1]) return true
      }
      // Always include design_consistency categories even if not explicitly selected
      if (categoryIndex >= 24 && categoryIndex < 28) return true
      return false
    }

    return true
  }

  // Process categories ONE AT A TIME to avoid rate limits and memory issues
  // Build list with ORIGINAL index so each finding gets stamped with the correct category
  const categoriesToAnalyze: Array<{ category: typeof UX_CATEGORIES[number]; originalIndex: number }> = []
  for (let i = 0; i < UX_CATEGORIES.length; i++) {
    if (shouldAnalyze(i)) categoriesToAnalyze.push({ category: UX_CATEGORIES[i], originalIndex: i })
  }
  console.log(`[runFullAnalysis] Analyzing ${categoriesToAnalyze.length}/${UX_CATEGORIES.length} categories`)

  for (let ci = 0; ci < categoriesToAnalyze.length; ci++) {
    const { category, originalIndex } = categoriesToAnalyze[ci]
    console.log(`[runFullAnalysis] Category ${ci + 1}/${categoriesToAnalyze.length}: ${category.name} (index ${originalIndex})`)

    const findings = await analyzeCategory(
      pageContent,
      category.name,
      category.items.map((item) => ({
        title: item,
        description: item,
        whatToCheck: item,
      })),
      userFocus,
      language,
      depthMode,
    )

    // Stamp each finding with its explicit category index — no more keyword-matching inference
    for (const f of findings) {
      f.categoryIndex = originalIndex
    }

    allFindings.push(...findings)

    if (onProgress) {
      try {
        await onProgress(ci + 1, categoriesToAnalyze.length, category.name)
      } catch {}
    }

    // Brief pause between categories to avoid rate limits
    if (ci < categoriesToAnalyze.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  // Post-processing: remove cross-category duplicates that the per-category prompts missed
  return deduplicateFindings(allFindings)
}

/**
 * Generate comprehensive report with executive summary and scores
 * @param depthMode 'deep' = full scoring | 'baseline' = deterministic from previous
 * @param baselineData Previous audit data for deterministic baseline scoring
 */
export async function generateReport(
  findings: AuditFinding[],
  auditData: Audit,
  pageContent: string,
  userFocus?: string | null,
  language: string = 'en',
  depthMode: 'deep' | 'baseline' = 'deep',
  baselineData?: {
    previousCategoryScores: CategoryScore[]
    previousOverallScore: number
    previousTotalFindings: number
    previousExecutiveSummary: string
    previousReportJson: any
    droppedFixed: number
    droppedDismissed: number
  },
  siteProfile?: SiteProfile | null,
): Promise<ReportData> {
  // ════════════════════════════════════════════════════════════════
  // BASELINE MODE — 100% DETERMINISTIC, ZERO AI FOR SCORES
  // Previous scores are the truth. We adjust only based on fixed/dismissed findings.
  // No AI randomness. Same site + no changes = EXACT same score. Period.
  // ════════════════════════════════════════════════════════════════
  if (depthMode === 'baseline' && baselineData && baselineData.previousCategoryScores.length > 0) {
    const prev = baselineData
    const currentCount = findings.length
    const prevCount = prev.previousTotalFindings
    const fixedCount = prev.droppedFixed
    const dismissedCount = prev.droppedDismissed
    const nothingChanged = fixedCount === 0 && dismissedCount === 0 && currentCount === prevCount

    // Calculate severity-weighted improvement
    // Total "room for improvement" is the sum of (100 - score) across all categories
    const prevTotalWeight = prev.previousCategoryScores.reduce((sum, c) => sum + (100 - c.score), 0)
    const fixedWeight = fixedCount * 2.5 // Average severity weight for fixed findings

    // Score improvement: proportional to what was fixed out of what was wrong
    // If prevTotalWeight = 0, site was perfect, no improvement possible
    const improvementRatio = prevTotalWeight > 0 ? fixedWeight / prevTotalWeight : 0
    const maxPossibleImprovement = 15 // Cap at +15 per re-audit cycle

    // Build category scores: start from previous, add proportional improvement
    const categoryScores: CategoryScore[] = prev.previousCategoryScores.map((prevCat) => {
      if (nothingChanged) {
        // NOTHING CHANGED → exact same scores
        return { name: prevCat.name, score: prevCat.score, summary: prevCat.summary }
      }
      // Something changed (fixes or dismissals)
      const headroom = 100 - prevCat.score
      const improvement = Math.round(improvementRatio * headroom * 2) // 2x multiplier to make fixes feel impactful
      const cappedImprovement = Math.min(improvement, maxPossibleImprovement)
      return {
        name: prevCat.name,
        score: Math.min(100, prevCat.score + cappedImprovement),
        summary: prevCat.summary, // Keep previous summary
      }
    })

    // ════════════════════════════════════════════════════════════
    // GAP-FILL SCORING — Include scores for newly analyzed modules
    // If the user selected modules (e.g. SEO) that weren't in the
    // previous audit, gap-fill created findings for them but the
    // baseline scoring above only maps previous categories. We must
    // also score the gap-filled categories from their findings.
    // ════════════════════════════════════════════════════════════
    const allCategoryNames = getCategoryNames(language)
    const prevCatNameSet = new Set(prev.previousCategoryScores.map(c => c.name))
    const selectedModules: string[] | null = (auditData as any).selected_modules ?? null

    const MODULE_RANGES_BL: Record<string, [number, number]> = {
      foundation: [0, 4], human_experience: [4, 8], inclusive_design: [8, 12],
      future_readiness: [12, 16], seo_structure: [16, 20], accessibility_readiness: [20, 24],
      design_consistency: [24, 28],
      // Legacy alias — historical audits stored 'brand_consistency' in selected_modules
      brand_consistency: [24, 28],
    }

    // Determine which category indices should be active for this audit
    // Design Consistency (24-27) always runs — no brand identity gate needed.
    const activeIndices = new Set<number>()
    if (selectedModules && selectedModules.length > 0) {
      // Selective re-audit: only the chosen modules + Design Consistency
      for (const mod of selectedModules) {
        const r = MODULE_RANGES_BL[mod]
        if (r) { for (let i = r[0]; i < r[1]; i++) activeIndices.add(i) }
      }
      // Ensure design_consistency indices are always active
      for (let i = 24; i < 28; i++) activeIndices.add(i)
    } else {
      // Complete re-audit (selectedModules is null): ALL 28 categories are active.
      // This ensures categories added after the previous audit (e.g. Design
      // Consistency 24-27) get gap-filled even for workspaces whose original
      // audit predates those categories.
      for (let i = 0; i < allCategoryNames.length; i++) activeIndices.add(i)
    }

    // Find categories that should be active but weren't in previous audit
    if (activeIndices.size > 0) {
      const severityPenalty: Record<string, number> = { critical: 18, high: 12, medium: 6, low: 2 }

      for (let gi = 0; gi < allCategoryNames.length; gi++) {
        if (!activeIndices.has(gi)) continue
        const catName = allCategoryNames[gi]
        if (prevCatNameSet.has(catName)) continue // already scored above

        // This is a gap-filled category — score from findings (same formula as DEEP MODE)
        const catWords = catName.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
        const catFindings = findings.filter(f => {
          const text = `${f.title} ${f.description}`.toLowerCase()
          return catWords.some(w => text.includes(w))
        })

        let score: number
        let summary: string
        // RULE 4: Uncertainty is not positivity. Must match BASE_SCORE = 82 in deep mode.
        if (catFindings.length === 0) {
          score = 82
          summary = 'No specific issues identified — strong performance in this category.'
        } else {
          score = 82
          for (const f of catFindings) { score -= severityPenalty[f.severity] || 6 }
          score = Math.max(0, Math.min(100, Math.round(score)))
          const top = catFindings[0]
          summary = catFindings.length === 1
            ? `1 issue found: ${top.title}.`
            : `${catFindings.length} issues found. Top priority: ${top.title}.`
        }
        categoryScores.push({ name: catName, score, summary })
      }
    }

    // Calculate pillar averages and overall from deterministic category scores
    // Use name-based lookup (not positional slicing) to handle gap-filled categories correctly
    const pillarAvg = (start: number, end: number) => {
      const cats = categoryScores.filter((c) => {
        if (c.score < 0) return false // skip unanalyzed categories
        const idx = allCategoryNames.indexOf(c.name)
        return idx >= start && idx < end
      })
      return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
    }
    const allScores = categoryScores.filter(c => c.score >= 0).map(c => c.score)
    const overallScoreRaw = allScores.length > 0
      ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
      : prev.previousOverallScore
    // Score model v2: cap by open severity profile (consistent with deep mode)
    const { overall: overallScore, capInfo: baselineCapInfo } = applyScoringSeverityCap(overallScoreRaw, findings as any)

    // Build executive summary — deterministic, no AI, language-aware
    const executiveSummary = getBaselineSummary(
      language,
      auditData.product_url || '',
      currentCount,
      overallScore,
      prev.previousOverallScore,
      fixedCount,
      dismissedCount,
      nothingChanged,
    )

    // Carry forward previous top recommendations (filtered to only still-open ones)
    const prevTopRecs = prev.previousReportJson?.topRecommendations || []
    const topRecs = Array.isArray(prevTopRecs) ? prevTopRecs.slice(0, 3) : []

    console.log(`[generateReport] BASELINE: prev=${prev.previousOverallScore}, now=${overallScore}, fixed=${fixedCount}, dismissed=${dismissedCount}, nothingChanged=${nothingChanged}`)

    return {
      executiveSummary: executiveSummary + capSummarySentence(baselineCapInfo),
      keyRecommendation: topRecs[0] || getDefaultRecommendation(language),
      topRecommendations: topRecs.length > 0 ? topRecs : [getDefaultRecommendation(language)],
      overallScore,
      uxScore: pillarAvg(0, 4),
      conversionScore: pillarAvg(4, 8),
      mobileScore: pillarAvg(8, 12),
      aiDiscoverabilityScore: pillarAvg(12, 16),
      contentScore: overallScore,
      categoryScores,
      scoreCapInfo: baselineCapInfo,
    }
  }

  // ════════════════════════════════════════════════════════════════
  // DEEP MODE — DETERMINISTIC SCORING + AI NARRATIVE
  // Scores are calculated MATHEMATICALLY from actual findings.
  // AI only generates the executive summary and recommendations.
  // This ensures scores are always coherent with findings:
  //   9 minor findings → ~85-90 score, NOT 57.
  //   0 findings in a category → 92, NOT a random AI guess.
  // ════════════════════════════════════════════════════════════════

  const allCategoryNames = getCategoryNames(language)
  const selectedModules: string[] | null = (auditData as any).selected_modules ?? null
  const MODULE_RANGES: Record<string, [number, number]> = {
    foundation: [0, 4], human_experience: [4, 8], inclusive_design: [8, 12],
    future_readiness: [12, 16], seo_structure: [16, 20], accessibility_readiness: [20, 24],
    design_consistency: [24, 28],
    // Legacy alias — historical audits stored 'brand_consistency' in selected_modules
    brand_consistency: [24, 28],
  }
  function wasAnalyzed(idx: number): boolean {
    if (selectedModules && selectedModules.length > 0) {
      for (const mod of selectedModules) {
        const r = MODULE_RANGES[mod]
        if (r && idx >= r[0] && idx < r[1]) return true
      }
      return false
    }
    return true
  }

  // ── STEP 1: DETERMINISTIC SCORE CALCULATION FROM FINDINGS ──────
  // Each category starts at 92 (no findings = strong baseline).
  // Deductions per finding severity tied to that category via category_index.
  // This is the ONLY source of truth for scores — no AI involvement.
  const SEVERITY_DEDUCTION: Record<string, number> = {
    critical: 18,
    high: 12,
    medium: 6,
    low: 2,
  }
  // Score calibration (2026-06-08):
  // BASE_SCORE = 97 for all categories. Categories with 0 findings get a score
  // in the 95-99 range (deterministic per-category jitter to prevent flat-line).
  // Categories WITH findings start at 97 and subtract penalties.
  //
  // Previous value was 82, which caused a confusing "all modules at 82, 0 findings"
  // dashboard state. The UI now uses score_state metadata to distinguish between
  // "genuinely clean" and "has issues" rather than suppressing the score itself.
  const BASE_SCORE = 97

  // Deterministic jitter for 0-finding categories: prevents all-identical scores.
  // Values cycle through 95-99 so no two adjacent categories show the same number.
  const CLEAN_JITTER = [97, 96, 98, 95, 99, 96, 98, 97, 95, 99, 96, 98, 97, 95, 99, 96, 98, 97, 95, 99, 96, 98, 95, 99, 97, 96, 98, 95]

  // Coverage-adjusted jitter: when we only crawled 1-2 pages, 0-finding categories
  // should score lower because we might simply not have seen the issues.
  // LOW = 1 page (85-89), MEDIUM = 2-3 pages (90-93), HIGH = 4+ pages (95-99)
  const LOW_COV_JITTER =    [87, 86, 88, 85, 89, 86, 88, 87, 85, 89, 86, 88, 87, 85, 89, 86, 88, 87, 85, 89, 86, 88, 85, 89, 87, 86, 88, 85]
  const MEDIUM_COV_JITTER = [92, 91, 93, 90, 93, 91, 93, 92, 90, 93, 91, 93, 92, 90, 93, 91, 93, 92, 90, 93, 91, 93, 90, 93, 92, 91, 93, 90]

  // Derive coverage level from crawl summary
  const pagesAnalyzed = auditData.crawl_summary?.pages_analyzed ?? 0

  // Zero-findings policy (2026-06-10): a zero-findings audit caused by system
  // failure (insert errors, analyzer timeouts) is FAILED + REFUNDED by the
  // zero-findings-policy step in process-audit.ts and never reaches report
  // generation. If we're here with 0 findings, the pipeline verified the zero
  // is genuine — score by crawl coverage only, with honest clean messaging.
  const verifiedCleanZero = findings.length === 0 && pagesAnalyzed > 0

  const coverageJitter = pagesAnalyzed <= 1 ? LOW_COV_JITTER
    : pagesAnalyzed <= 3 ? MEDIUM_COV_JITTER
    : CLEAN_JITTER
  const coverageState: CategoryScore['score_state'] = pagesAnalyzed <= 3 ? 'evidence_limited'
    : 'clean'

  // Group findings by category_index (0-27)
  const findingsByCategory: Map<number, AuditFinding[]> = new Map()
  for (const f of findings) {
    const ci = (f as any).category_index
    if (ci != null && ci >= 0 && ci < 28) {
      if (!findingsByCategory.has(ci)) findingsByCategory.set(ci, [])
      findingsByCategory.get(ci)!.push(f)
    }
  }

  // For findings without category_index, try keyword matching as fallback
  const unassigned = findings.filter(f => {
    const ci = (f as any).category_index
    return ci == null || ci < 0 || ci >= 28
  })
  if (unassigned.length > 0) {
    for (const f of unassigned) {
      const text = `${f.title} ${f.description}`.toLowerCase()
      let bestIdx = -1
      let bestScore = 0
      for (let gi = 0; gi < allCategoryNames.length; gi++) {
        if (!wasAnalyzed(gi)) continue
        // Never keyword-match into Design Consistency (24-27) — those broad
        // category names ("visual", "brand", "voice", "messaging") attract
        // unrelated findings and tank scores. Only explicit category_index
        // assignments should land there.
        if (gi >= 24 && gi < 28) continue
        const words = allCategoryNames[gi].toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
        const matches = words.filter(w => text.includes(w)).length
        if (matches > bestScore) { bestScore = matches; bestIdx = gi }
      }
      if (bestIdx >= 0) {
        if (!findingsByCategory.has(bestIdx)) findingsByCategory.set(bestIdx, [])
        findingsByCategory.get(bestIdx)!.push(f)
      }
    }
  }

  // Calculate score per category
  const categoryScores: CategoryScore[] = []
  for (let gi = 0; gi < allCategoryNames.length; gi++) {
    const globalName = allCategoryNames[gi]
    if (!wasAnalyzed(gi)) {
      categoryScores.push({ name: globalName, score: -1, summary: '', score_state: 'unanalyzed' })
      continue
    }
    const catFindings = findingsByCategory.get(gi) || []

    let score: number
    let score_state: CategoryScore['score_state']
    let summary: string

    if (catFindings.length === 0) {
      // Clean category — use coverage-adjusted jitter to reflect crawl depth.
      // Low coverage (1 page) = 85-89, medium (2-3) = 90-93, high (4+) = 95-99.
      // Zero findings reaching this point is a VERIFIED clean result (faulty
      // zeros are failed + refunded upstream by the zero-findings-policy step).
      score = coverageJitter[gi % coverageJitter.length]
      score_state = coverageState
      summary = pagesAnalyzed <= 1
        ? 'No issues identified — limited pages analyzed, coverage may be incomplete.'
        : 'No issues identified — verified clean in this category.'
    } else {
      score = BASE_SCORE
      for (const f of catFindings) {
        score -= SEVERITY_DEDUCTION[f.severity] || 6
      }
      score = Math.max(0, Math.min(100, Math.round(score)))
      score_state = 'scored'

      if (catFindings.length === 1) {
        summary = `1 issue found: ${catFindings[0].title}.`
      } else {
        const top = catFindings.sort((a, b) => {
          const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
          return (order[a.severity] ?? 2) - (order[b.severity] ?? 2)
        })[0]
        summary = `${catFindings.length} issues found. Top priority: ${top.title}.`
      }
    }
    categoryScores.push({ name: globalName, score, summary, score_state })
  }

  // Calculate pillar averages from deterministic category scores
  const pillarAvg = (start: number, end: number) => {
    const cats = categoryScores.filter((c) => {
      if (c.score < 0) return false
      const idx = allCategoryNames.indexOf(c.name)
      return idx >= start && idx < end
    })
    return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
  }

  const calculatedUx = pillarAvg(0, 4)
  const calculatedConversion = pillarAvg(4, 8)
  const calculatedInclusive = pillarAvg(8, 12)
  const calculatedFuture = pillarAvg(12, 16)

  const allScores = categoryScores.filter(c => c.score >= 0).map(c => c.score)
  const calculatedOverallRaw = allScores.length > 0
    ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
    : 50

  // Score model v2: cap the overall by the open severity profile. The
  // category average alone could not drop below ~80 even with 7 open
  // high-severity issues (zero-finding categories at 95-99 drown them out).
  const { overall: calculatedOverall, capInfo } = applyScoringSeverityCap(calculatedOverallRaw, findings as any)
  if (capInfo.applied) {
    console.log(`[generateReport] SEVERITY CAP: ${calculatedOverallRaw} → ${calculatedOverall} (${capInfo.reason})`)
  }

  if (verifiedCleanZero) {
    console.log(`[generateReport] VERIFIED CLEAN ZERO: 0 findings with healthy pipeline, ${pagesAnalyzed} pages crawled. Coverage-based scoring. Overall=${calculatedOverall}`)
  }
  console.log(`[generateReport] DEEP MODE DETERMINISTIC: overall=${calculatedOverall}, findings=${findings.length}, categories_with_findings=${findingsByCategory.size}`)

  // ── STEP 2: AI GENERATES NARRATIVE ONLY (executive summary + recommendations) ──
  // The AI receives the PRE-CALCULATED scores and writes around them.
  // It does NOT generate scores — those are locked in from Step 1.
  const criticalCount = findings.filter((f) => f.severity === 'critical').length
  const highCount = findings.filter((f) => f.severity === 'high').length
  const mediumCount = findings.filter((f) => f.severity === 'medium').length
  const lowCount = findings.filter((f) => f.severity === 'low').length

  const findingsDetail = findings
    .slice(0, 20)
    .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
    .join('\n')

  const focusBlock = userFocus && userFocus.trim() && userFocus.trim().toLowerCase() !== 'general ux audit'
    ? `\nCLIENT PRIORITY — The client specifically asked us to focus on:\n"${userFocus.trim()}"\nMake sure the executive summary addresses this concern directly. Mention findings related to their focus area prominently.\n`
    : ''

  const reportLanguageInstruction = getLanguagePromptInstruction(language)

  // Build the score context so AI can reference the pre-calculated scores
  const scoreContext = categoryScores
    .filter(c => c.score >= 0)
    .map(c => `- ${c.name}: ${c.score}/100 (${c.summary})`)
    .join('\n')

  // Site profile context for the narrative
  const profileContext = siteProfile ? `
SITE PROFILE:
- Industry: ${siteProfile.industryVertical}
- Target Audience: ${siteProfile.targetAudience}
- Audience Sophistication: ${siteProfile.audienceSophistication}
- Market Position: ${siteProfile.marketPosition}
- Communication Style: ${siteProfile.communicationStyle}
- Context: ${siteProfile.contextNotes}
The executive summary should acknowledge the industry context and evaluate the site against appropriate standards for this specific industry and audience.
` : ''

  const narrativePrompt = `You are a senior UX strategist at a premium consultancy writing the executive summary for a human-centered digital audit.
${reportLanguageInstruction}

FIXPATH FINAL PROCESSING RULES (govern how you frame findings in the narrative):
1. Do not grade taste. Measure signals — structural, clarity, trust, friction, market-fit, consistency, technical, actionability.
2. Infer site type, industry, audience, primary task, market, and cultural context from existing evidence.
3. Surface only issues that materially affect clarity, navigation, trust, consistency, discoverability, task completion, or technical accessibility.
4. Suppress findings that are mostly aesthetic preference, too minor, duplicative, weakly evidenced, or commercially irrelevant.
5. Merge findings that share the same structural root cause into one stronger narrative point.
6. Severity must reflect real-world impact, not defect count.
7. For mainstream desktop websites, hidden primary navigation behind a hamburger is a structural issue unless the site is clearly niche, artistic, or experimental.
8. Brand DNA can inform consistency checks, but must never excuse structural UX problems.
9. Highlight only the strongest, clearest, evidence-backed findings in the executive summary.
10. Every referenced finding must clearly state what is happening, why it matters here, and practical impact.
Your goal is not to be generous or harsh. Your goal is to be surgically true.

WEBSITE: ${auditData.product_url}
${focusBlock}${profileContext}
WEBSITE CONTENT PREVIEW:
${pageContent.substring(0, 5000)}

AUDIT FINDINGS (${findings.length} total):
- ${criticalCount} critical issues
- ${highCount} high priority issues
- ${mediumCount} medium priority issues
- ${lowCount} low priority improvements

DETAILED FINDINGS:
${findingsDetail}

PRE-CALCULATED SCORES (these are FINAL — do NOT change them):
Overall Score: ${calculatedOverall}/100
${scoreContext}

INSTRUCTIONS — NARRATIVE ONLY:
The scores above have been calculated deterministically from actual findings. Your job is to write ONLY the narrative elements — the executive summary and top 3 recommendations. Do NOT generate or modify scores.

For the EXECUTIVE SUMMARY:
- Write 4-5 well-crafted paragraphs (not bullet points)
- Start with what the website does, who it serves, and the overall impression
- Reference the pre-calculated overall score (${calculatedOverall}/100) — explain what it means for this site${capInfo.applied ? `\n- IMPORTANT: the overall score is CAPPED at ${capInfo.cap}/100 because of ${capInfo.reason}. State this plainly: the site cannot score higher while these issues remain open, and fixing them unlocks the full score. Do not soften this.` : ''}
- Be genuine about strengths — if the score is high, acknowledge that the site is strong
- Address the most impactful findings with depth: explain the human impact, not just the technical problem
- If a site profile is provided, frame your analysis within the correct industry context. Don't penalize industry-appropriate design choices.
- Cover findings across all audit modules analysed — show the breadth of analysis
- End with a clear, prioritized action plan
- Write with authority and empathy — this should feel like advice from a trusted consultant

For CATEGORY SUMMARIES:
- Provide a 1-2 sentence summary for each scored category
- Reference actual content, elements, or patterns from the site
- If the category scored 85+, lead with what's strong. If it scored below 70, lead with what needs work.

For TOP 3 PRIORITY RECOMMENDATIONS:
- Provide exactly 3 recommendations, ordered by impact
- Each should be 1-2 sentences: what to change and why
- Be specific — reference actual elements from the site
- Cover different aspects (don't give 3 recommendations about the same thing)

Return ONLY valid JSON:
{
  "executiveSummary": "...",
  "topRecommendations": ["First priority...", "Second priority...", "Third priority..."],
  "categorySummaries": {
${categoryScores.filter(c => c.score >= 0).map(c => `    "${c.name}": "..."`).join(',\n')}
  }
}
${language !== 'en' ? `\nFINAL REMINDER — LANGUAGE: The executiveSummary, topRecommendations, and all category summaries MUST be written entirely in ${getLanguageLabel(language)}. JSON keys stay in English.\n` : ''}`

  try {
    const anthropic = getAnthropicClient()
    // Single attempt — no retries. Report generation is a single call; retrying
    // wastes tokens and time. The SDK's 45s timeout handles hangs.
    const message = await anthropic.beta.promptCaching.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      temperature: 0,
      system: [{ type: 'text', text: 'You are a senior UX strategist writing an executive summary for a human-centered digital audit. Scores have been pre-calculated — your job is narrative only. Apply the Fixpath signal model: measure signals (structural, clarity, trust, friction, market-fit, consistency, technical, actionability), not taste. Frame findings by real-world impact. Be surgically true — not generous, not harsh.', cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: narrativePrompt }],
    })

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = responseText.match(/\{[\s\S]*\}/m)
    if (jsonMatch) {
      let narrative: any
      try {
        narrative = JSON.parse(jsonMatch[0])
      } catch {
        // Try to repair truncated JSON
        let raw = jsonMatch[0]
        const lastBrace = raw.lastIndexOf('}')
        if (lastBrace > 0) {
          try {
            narrative = JSON.parse(raw.substring(0, lastBrace + 1) + '}')
          } catch {
            console.error('[generateReport] JSON repair failed for narrative')
          }
        }
      }

      if (narrative) {
        // Enrich category summaries with AI-generated narratives
        const aiSummaries: Record<string, string> = narrative.categorySummaries || {}
        for (const cs of categoryScores) {
          if (cs.score >= 0 && aiSummaries[cs.name]) {
            cs.summary = aiSummaries[cs.name]
          }
        }

        const topRecs: string[] = Array.isArray(narrative.topRecommendations)
          ? narrative.topRecommendations.filter((r: any) => typeof r === 'string' && r.trim())
          : []

        return {
          executiveSummary: narrative.executiveSummary || '',
          keyRecommendation: topRecs[0] || null,
          topRecommendations: topRecs.length > 0 ? topRecs : ['Prioritize critical issues first, then address high-impact improvements.'],
          overallScore: calculatedOverall,
          uxScore: calculatedUx,
          conversionScore: calculatedConversion,
          mobileScore: calculatedInclusive,
          aiDiscoverabilityScore: calculatedFuture,
          contentScore: calculatedOverall,
          categoryScores,
          scoreCapInfo: capInfo,
          siteProfile: siteProfile || undefined,
        }
      }
    }

    // AI narrative failed — return scores with basic summary
    console.error('[generateReport] No JSON in narrative response, using basic summary')
  } catch (err) {
    console.error('[generateReport] Narrative generation failed:', err instanceof Error ? err.message : err)
  }

  // Fallback: deterministic scores with basic summary (no AI narrative)
  const basicSummary = criticalCount > 0
    ? `This audit identified ${findings.length} issues, including ${criticalCount} critical finding${criticalCount > 1 ? 's' : ''} that require immediate attention.`
    : highCount > 0
    ? `This audit identified ${findings.length} issues, with ${highCount} high-priority finding${highCount > 1 ? 's' : ''}. Addressing these will meaningfully improve the user experience.`
    : findings.length > 0
    ? `This audit identified ${findings.length} areas for improvement. Most are medium or low severity, suggesting a solid baseline with room for refinement.`
    : 'This site performs well across all audited categories with no significant issues identified.'

  const fallbackRecs = findings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 3)
    .map(f => f.recommendation)

  return {
    executiveSummary: basicSummary + capSummarySentence(capInfo),
    keyRecommendation: fallbackRecs[0] || getDefaultRecommendation(language),
    topRecommendations: fallbackRecs.length > 0 ? fallbackRecs : [getDefaultRecommendation(language)],
    overallScore: calculatedOverall,
    uxScore: calculatedUx,
    conversionScore: calculatedConversion,
    mobileScore: calculatedInclusive,
    aiDiscoverabilityScore: calculatedFuture,
    contentScore: calculatedOverall,
    categoryScores,
    scoreCapInfo: capInfo,
    siteProfile: siteProfile || undefined,
  }
}

function getDefaultRecommendation(language: string): string {
  const recs: Record<string, string> = {
    en: 'Continue addressing open findings to improve your score.',
    es: 'Continúe abordando los hallazgos abiertos para mejorar su puntuación.',
    fr: 'Continuez à traiter les constats ouverts pour améliorer votre score.',
    de: 'Beheben Sie weiterhin die offenen Befunde, um Ihre Punktzahl zu verbessern.',
    it: 'Continuare ad affrontare i risultati aperti per migliorare il punteggio.',
    pt: 'Continue resolvendo as descobertas abertas para melhorar sua pontuação.',
  }
  return recs[language] || recs.en
}

function clampScore(v: number | undefined): number {
  // Regression fix: default changed from 70 to 50.
  // RULE 4: Uncertainty is not positivity. Missing data should NOT reward the site.
  // A score of 70 for "we don't know" tells the user "pretty good!" which is a lie.
  // 50 = neutral/unknown, which is honest.
  if (v == null || isNaN(v)) return 50
  return Math.min(100, Math.max(0, Math.round(v)))
}

function getDefaultCategoryScores(language: string = 'en'): CategoryScore[] {
  const names = getCategoryNames(language)
  // Regression fix: default changed from 70 to 50 (neutral/unknown, not "pretty good")
  return names.map((name) => ({ name, score: 50, summary: '' }))
}

/**
 * Calculate scores from findings when report generation fails.
 * Uses the SAME deterministic formula as DEEP MODE:
 *   Base = 97, deductions: critical=-18, high=-12, medium=-6, low=-2.
 *   Categories with 0 findings = CLEAN_JITTER[catIdx] (95-99, deterministic).
 * This ensures scores ALWAYS match the deterministic model, even in fallback paths.
 */
export function calculateScoresFromFindings(findings: AuditFinding[], language: string = 'en', pagesAnalyzed: number = 0): ReportData {
  const categoryNames = getCategoryNames(language)
  const severityPenalty: Record<string, number> = { critical: 18, high: 12, medium: 6, low: 2 }
  // Must match generateReport() BASE_SCORE = 97
  const BASE_SCORE = 97
  // Deterministic jitter for clean categories — must match generateReport()
  const CLEAN_JITTER = [97, 96, 98, 95, 99, 96, 98, 97, 95, 99, 96, 98, 97, 95, 99, 96, 98, 97, 95, 99, 96, 98, 95, 99, 97, 96, 98, 95]
  // Coverage-adjusted jitter — must match generateReport()
  const LOW_COV_JITTER =    [87, 86, 88, 85, 89, 86, 88, 87, 85, 89, 86, 88, 87, 85, 89, 86, 88, 87, 85, 89, 86, 88, 85, 89, 87, 86, 88, 85]
  const MEDIUM_COV_JITTER = [92, 91, 93, 90, 93, 91, 93, 92, 90, 93, 91, 93, 92, 90, 93, 91, 93, 92, 90, 93, 91, 93, 90, 93, 92, 91, 93, 90]

  // Zero-findings policy — must match generateReport() logic. Faulty zeros are
  // failed + refunded upstream; a zero here is a verified clean result.
  const coverageJitter = pagesAnalyzed <= 1 ? LOW_COV_JITTER
    : pagesAnalyzed <= 3 ? MEDIUM_COV_JITTER
    : CLEAN_JITTER
  const coverageState: CategoryScore['score_state'] = pagesAnalyzed <= 3 ? 'evidence_limited'
    : 'clean'

  // Assign findings to categories — prefer category_index, fall back to keyword matching
  const findingsPerCategory: Record<string, AuditFinding[]> = {}
  for (const name of categoryNames) findingsPerCategory[name] = []

  for (const f of findings) {
    const ci = (f as any).category_index
    if (ci != null && ci >= 0 && ci < categoryNames.length) {
      findingsPerCategory[categoryNames[ci]].push(f)
      continue
    }
    // Keyword fallback — skip Design Consistency (24-27) to prevent
    // broad terms like "visual", "brand", "voice" from attracting
    // unrelated findings and tanking scores. Matches generateReport() guard.
    let matched = false
    for (let gi = 0; gi < categoryNames.length; gi++) {
      if (gi >= 24 && gi < 28) continue // Guard: never keyword-match into Design Consistency
      const catName = categoryNames[gi]
      const words = catName.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
      const text = `${f.title} ${f.description}`.toLowerCase()
      if (words.some(w => text.includes(w))) {
        findingsPerCategory[catName].push(f)
        matched = true
        break
      }
    }
    if (!matched) {
      // Sort-order distribution — cap at category 23 to prevent spillover into Design Consistency
      const maxIdx = Math.min(categoryNames.length - 1, 23)
      const idx = Math.min(Math.floor(f.sort_order / Math.max(1, findings.length / 24)), maxIdx)
      findingsPerCategory[categoryNames[idx]].push(f)
    }
  }

  // Calculate score per category — consistent with DEEP MODE formula
  // Design Consistency categories (24-27) that have no explicit findings
  // (category_index set by the analyzer) should be marked as -1 (unanalyzed)
  // to prevent inflated or deflated scores in the fallback path.
  const hasExplicitFindings = new Set<number>()
  for (const f of findings) {
    const ci = (f as any).category_index
    if (ci != null && ci >= 24 && ci < 28) hasExplicitFindings.add(ci)
  }

  const categoryScores: CategoryScore[] = categoryNames.map((name, catIdx) => {
    // Design Consistency categories without explicit analyzer-assigned findings
    // should be treated as unanalyzed (sentinel -1), matching generateReport() behavior
    if (catIdx >= 24 && catIdx < 28 && !hasExplicitFindings.has(catIdx)) {
      return { name, score: -1, summary: '', score_state: 'unanalyzed' as const }
    }
    const catFindings = findingsPerCategory[name]
    if (catFindings.length === 0) {
      // Clean category — coverage-adjusted jitter prevents misleading high scores
      const score = coverageJitter[catIdx % coverageJitter.length]
      const summary = pagesAnalyzed <= 1
        ? 'No issues identified — limited pages analyzed, coverage may be incomplete.'
        : 'No issues identified — verified clean in this category.'
      return { name, score, summary, score_state: coverageState }
    }
    let score = BASE_SCORE
    for (const f of catFindings) {
      score -= severityPenalty[f.severity] || 6
    }
    const topFinding = catFindings[0]
    const summary = catFindings.length === 1
      ? `1 issue found: ${topFinding.title}.`
      : `${catFindings.length} issues found. Top priority: ${topFinding.title}.`
    return { name, score: Math.max(0, Math.min(100, Math.round(score))), summary, score_state: 'scored' as const }
  })

  // Filter out -1 sentinels (unanalyzed categories) for overall score
  const analyzedScores = categoryScores.filter(c => c.score >= 0).map(c => c.score)
  // Fallback 50 = neutral/unknown, not a reward. Same as clampScore() default.
  const overallRaw = analyzedScores.length > 0 ? Math.round(analyzedScores.reduce((a, b) => a + b, 0) / analyzedScores.length) : 50
  // Score model v2: same severity cap as generateReport — fallback path included
  const { overall, capInfo: fallbackCapInfo } = applyScoringSeverityCap(overallRaw, findings as any)

  const pillarAvg = (start: number, end: number) => {
    const cats = categoryScores.slice(start, Math.min(end, categoryScores.length)).filter(c => c.score >= 0)
    // Fallback 50 = neutral/unknown for fully unanalyzed pillars
    return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
  }

  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length
  const summary = criticalCount > 0
    ? `This audit identified ${findings.length} issues, including ${criticalCount} critical finding${criticalCount > 1 ? 's' : ''} that require immediate attention.`
    : highCount > 0
    ? `This audit identified ${findings.length} issues, with ${highCount} high-priority finding${highCount > 1 ? 's' : ''}. Addressing these will meaningfully improve the user experience.`
    : findings.length > 0
    ? `This audit identified ${findings.length} areas for improvement. Most are medium or low severity, suggesting a solid baseline with room for refinement.`
    : 'This site performs well across all audited categories with no significant issues identified.'

  const topRecs = findings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 3)
    .map(f => f.recommendation)

  return {
    executiveSummary: summary + capSummarySentence(fallbackCapInfo),
    keyRecommendation: topRecs[0] || getDefaultRecommendation(language),
    topRecommendations: topRecs.length > 0 ? topRecs : [getDefaultRecommendation(language)],
    scoreCapInfo: fallbackCapInfo,
    overallScore: overall,
    uxScore: pillarAvg(0, 4),
    conversionScore: pillarAvg(4, 8),
    mobileScore: pillarAvg(8, 12),
    aiDiscoverabilityScore: pillarAvg(12, 16),
    contentScore: overall,
    categoryScores,
  }
}

/* ══════════════════════════════════════════════════════════════
 * VERIFICATION — Lightweight AI check for baseline re-audits
 * Checks each open finding against freshly crawled page content
 * to detect if the issue has been silently fixed on the live site.
 *
 * DOES NOT change scores. Purely informational — user must confirm.
 * ══════════════════════════════════════════════════════════════ */

export interface VerificationResult {
  findingId: string
  status: 'confirmed_open' | 'likely_fixed' | 'poorly_fixed'
  note: string
}

/**
 * Verify a batch of findings against fresh page content.
 * Returns verification status for each finding.
 * Processes in batches to stay within token/time limits.
 */
export async function verifyFindings(
  findings: Array<{ id: string; title: string; description: string; recommendation: string; page_url: string | null; severity: string; target_element: string | null }>,
  pageContent: string,
  language?: string | null,
): Promise<VerificationResult[]> {
  if (findings.length === 0) return []

  const anthropic = getAnthropicClient()
  const results: VerificationResult[] = []

  // Process in batches of 8 findings to keep prompt size manageable
  const BATCH_SIZE = 8
  for (let i = 0; i < findings.length; i += BATCH_SIZE) {
    const batch = findings.slice(i, i + BATCH_SIZE)

    const findingsList = batch.map((f, idx) => {
      let entry = `FINDING ${idx + 1} [id=${f.id}]:\n`
      entry += `  Title: ${f.title}\n`
      entry += `  Description: ${f.description}\n`
      entry += `  Severity: ${f.severity}\n`
      if (f.page_url) entry += `  Page URL: ${f.page_url}\n`
      if (f.target_element) entry += `  Target Element: ${f.target_element}\n`
      entry += `  Recommendation: ${f.recommendation}`
      return entry
    }).join('\n\n')

    // Truncate page content to avoid token explosion
    const truncatedContent = pageContent.length > 30000
      ? pageContent.substring(0, 30000) + '\n\n[...content truncated for verification...]'
      : pageContent

    const langInstruction = language && language !== 'en'
      ? getLanguagePromptInstruction(language)
      : ''

    const prompt = `You are an expert UX auditor verifying whether previously identified issues have been fixed on a live website. You are given the CURRENT crawled page content and a list of findings from a PREVIOUS audit.

YOUR TASK: For each finding, determine whether the issue STILL EXISTS, has been FIXED, or was POORLY FIXED (attempted fix that made things worse or didn't properly address the issue).

HOW TO DECIDE:
1. Read each finding carefully — understand what the issue was and what the recommendation said to fix.
2. Search the current website content for evidence that the issue persists, has been addressed, or was poorly addressed.
3. Mark as "likely_fixed" if ANY of these are true:
   - The recommended fix appears to have been implemented (new content, changed text, added elements)
   - The problematic content/pattern described in the finding is no longer present
   - The page structure changed in a way that addresses the concern
   - New content exists that directly resolves what was flagged (e.g., trust signals added, CTAs improved, missing sections now present)
4. Mark as "poorly_fixed" if:
   - There is evidence of an attempted fix, BUT it introduced new problems (e.g., broken layout, confusing copy, inconsistent messaging)
   - The fix partially addresses the issue but creates a worse user experience in another way
   - The change contradicts UX best practices or makes the original problem worse
   - Content was changed but is now lower quality, misleading, or poorly written
5. Mark as "confirmed_open" ONLY if:
   - The exact issue described is clearly still present in the current content
   - You can point to specific text/patterns in the current site that match the original problem

IMPORTANT:
- UX findings are often about content quality, messaging, trust signals, and structure — NOT just code. Look for content changes, new sections, improved copy, added elements.
- If a finding said "missing X" and X now exists somewhere on the site, that is likely fixed.
- If a finding criticised specific text/copy and that text has changed, that is likely fixed.
- "poorly_fixed" should be rare — only use it when there's clear evidence of a regression or harmful fix attempt.
- Do NOT default to "confirmed_open" out of caution. If the content shows improvement related to the finding, mark it "likely_fixed". The user will confirm.
- You are comparing a PREVIOUS state (the finding) against the CURRENT state (the crawled content). Changes matter.
${langInstruction ? `- Write your verification notes in the same language as the findings. ${langInstruction}` : ''}

CURRENT WEBSITE CONTENT (freshly crawled):
${truncatedContent}

FINDINGS TO VERIFY:
${findingsList}

Respond with a JSON array. Each entry must have:
- "id": the finding id exactly as provided
- "status": "confirmed_open", "likely_fixed", or "poorly_fixed"
- "note": a brief (1-2 sentence) explanation citing specific evidence from the current site

Respond ONLY with the JSON array, no other text.`

    try {
      const response = await withTimeout(
        anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
        30_000,
        'verify-findings-batch',
      )

      const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
      // Extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{ id: string; status: string; note: string }>
        for (const item of parsed) {
          const validStatus = item.status === 'likely_fixed' ? 'likely_fixed' : item.status === 'poorly_fixed' ? 'poorly_fixed' : 'confirmed_open'
          results.push({
            findingId: item.id,
            status: validStatus,
            note: item.note || '',
          })
        }
      } else {
        // Couldn't parse — default all to confirmed_open
        for (const f of batch) {
          results.push({ findingId: f.id, status: 'confirmed_open', note: 'Verification inconclusive.' })
        }
      }
    } catch (err) {
      console.error('[verifyFindings] AI verification error:', err)
      // On error, default all to confirmed_open (safe fallback)
      for (const f of batch) {
        results.push({ findingId: f.id, status: 'confirmed_open', note: 'Verification could not be completed.' })
      }
    }
  }

  return results
}
