// ============================================================
// ClearUX Audit Engine — Claude AI Analyzer
// Produces comprehensive, professional UX audit analysis
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { Audit, FindingSeverity, AuditFinding } from '@/types/database'
import { getLanguagePromptInstruction, getLanguageLabel, getCategoryNames } from '@/lib/languages'

let _anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set. Cannot run AI analysis.')
    _anthropic = new Anthropic({ apiKey, timeout: 90_000 }) // 90s per request
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

export interface AnalysisFinding {
  severity: FindingSeverity
  title: string
  description: string
  recommendation: string
  estimatedImpact?: string
  targetElement?: string | null
  pageUrl?: string | null
}

export interface CategoryScore {
  name: string
  score: number
  summary: string
}

export interface ReportData {
  executiveSummary: string
  keyRecommendation: string | null
  overallScore: number
  uxScore: number
  conversionScore: number
  mobileScore: number
  aiDiscoverabilityScore: number
  contentScore: number
  categoryScores: CategoryScore[]
}

// ── The 19 UX categories we evaluate ─────────────────────────
// Grouped into 4 pillars for report structure:
//   FOUNDATION (1-6): Core UX quality
//   HUMAN EXPERIENCE (7-12): How the site treats people
//   TECHNICAL EXCELLENCE (13-16): Performance & compliance
//   FUTURE READINESS (17-19): AI age preparedness
const UX_CATEGORIES = [
  // ═══ PILLAR 1: FOUNDATION ═══════════════════════════════════
  {
    name: 'First Impression & Visual Design',
    pillar: 'Foundation',
    items: [
      'Above-the-fold content clarity and impact',
      'Visual hierarchy — are the most important elements prominent?',
      'Consistent color palette and typography',
      'Professional look and feel — does it inspire trust?',
    ],
  },
  {
    name: 'Value Proposition & Messaging',
    pillar: 'Foundation',
    items: [
      'Is the value proposition immediately clear?',
      'Does the headline communicate what the product does and for whom?',
      'Is there a clear differentiation from competitors?',
      'Does the copy speak to user pain points?',
    ],
  },
  {
    name: 'Navigation & Information Architecture',
    pillar: 'Foundation',
    items: [
      'Primary navigation — is it intuitive and well-organized?',
      'Can users find key pages within 2 clicks?',
      'Is the footer useful with proper links?',
      'Breadcrumbs or clear page hierarchy on inner pages',
    ],
  },
  {
    name: 'Visual Hierarchy & Layout',
    pillar: 'Foundation',
    items: [
      'Is there a clear visual flow guiding the eye from top to bottom?',
      'Are spacing and whitespace used effectively to group related content?',
      'Do font sizes and weights create a clear content hierarchy?',
      'Are key elements (CTAs, headlines, images) given appropriate visual weight?',
    ],
  },
  {
    name: 'Content Quality & Readability',
    pillar: 'Foundation',
    items: [
      'Is text scannable with proper headings and short paragraphs?',
      'Is the language clear, jargon-free, and user-focused?',
      'Are there grammar or spelling issues?',
      'Do images have alt text?',
    ],
  },
  {
    name: 'Calls-to-Action & Conversion',
    pillar: 'Foundation',
    items: [
      'Primary CTA — is it visible, compelling, and above the fold?',
      'CTA button copy — action-oriented vs generic ("Get Started" vs "Submit")',
      'Is there urgency or social proof near CTAs?',
      'Is the conversion path clear with minimal friction?',
    ],
  },

  // ═══ PILLAR 2: HUMAN EXPERIENCE ═════════════════════════════
  {
    name: 'Trust & Credibility',
    pillar: 'Human Experience',
    items: [
      'Are there testimonials, reviews, or case studies?',
      'Social proof — user count, logos, ratings?',
      'Privacy policy, terms, and security indicators',
      'Contact information or support options visible',
    ],
  },
  {
    name: 'Ethical UX & Dark Pattern Detection',
    pillar: 'Human Experience',
    items: [
      'Are there confirmshaming patterns — manipulative language to guilt users into a choice (e.g., "No thanks, I don\'t want to save money")?',
      'Are there fake urgency or scarcity tactics — countdown timers, "only X left" badges, or "limited time" messaging without genuine limits?',
      'Is the cancellation or unsubscribe flow easy to find and complete — or is it deliberately buried or multi-step to prevent users from leaving?',
      'Are there hidden costs that only appear at checkout — drip pricing, unexpected fees, or mandatory add-ons not disclosed upfront?',
      'Is cookie consent implemented fairly — with equal visual weight for "Accept" and "Reject", no pre-checked boxes, and no dark patterns in consent flows?',
      'Are privacy-hostile defaults present — opt-in vs opt-out for marketing, data sharing, or tracking set to benefit the company rather than the user?',
    ],
  },
  {
    name: 'Emotional Intelligence & Psychological Safety',
    pillar: 'Human Experience',
    items: [
      'Does the site create unnecessary anxiety — through countdown timers, loss aversion messaging, alarming language, or pressure tactics?',
      'When users make errors (wrong input, failed payment, 404), does the site respond with compassion and guidance — or with blame, punishment, or vague messages?',
      'Is the overall tone respectful, empowering, and human — rather than robotic, condescending, or manipulative?',
      'Does the checkout or signup process feel safe and transparent — with clear expectations, no surprises, and easy ability to go back or cancel?',
      'Are empty states and loading states designed to reduce frustration — with helpful messaging, suggestions, or reassurance rather than blank screens?',
    ],
  },
  {
    name: 'Cognitive Accessibility & Neurodiversity',
    pillar: 'Human Experience',
    items: [
      'Is the page layout clean and uncluttered, with clear visual grouping — reducing cognitive load for users with ADHD or attention differences?',
      'Are fonts readable for users with dyslexia (sans-serif, adequate size ≥16px, line-height ≥1.5, line length 50-75 characters, no justified text)?',
      'Is the language plain, literal, and unambiguous — avoiding idioms, sarcasm, or vague instructions that may be harder for autistic users to interpret?',
      'Are there distracting elements (auto-playing media, flashing animations, carousels, popups) that cannot be paused or dismissed — which can overwhelm users with sensory sensitivities?',
      'Is navigation predictable and consistent across pages — with clear labels, logical structure, and no unexpected layout shifts that disrupt cognitive flow?',
      'Are error messages specific, non-alarming, and constructive — clearly explaining what went wrong and how to fix it, rather than using vague or anxiety-inducing language?',
      'Are multi-step processes (forms, checkouts) broken into manageable chunks with visible progress indicators — rather than presenting one long overwhelming page?',
      'Is important information communicated through multiple channels (text + icons + colour) rather than relying on a single modality — supporting diverse processing styles?',
    ],
  },
  {
    name: 'Digital Wellbeing & Responsible Design',
    pillar: 'Human Experience',
    items: [
      'Does the site use addictive design patterns — infinite scroll without endpoints, notification manipulation, or engagement loops designed to keep users longer than they intend?',
      'Does the site respect users\' time — with honest time estimates, clear exit paths, and no unnecessary steps or friction added to increase time-on-site metrics?',
      'Is cognitive load managed responsibly — or does the site overwhelm users with excessive choices, information overload, or attention-competing elements?',
      'Are there manipulative engagement tactics — forced account creation to view content, artificial paywalls, or features deliberately withheld to drive upgrades?',
      'Does the site support healthy usage patterns — clear session boundaries, no guilt-based re-engagement, respectful notification practices?',
    ],
  },
  {
    name: 'Age Inclusivity & Digital Literacy',
    pillar: 'Human Experience',
    items: [
      'Is the font size large enough for older users (minimum 16px body text), with sufficient line-height and comfortable reading widths?',
      'Are interactive elements (buttons, links, form fields) large enough and spaced well for users with reduced motor precision — meeting or exceeding 44x44px touch targets?',
      'Does the site avoid assuming technical literacy — are instructions explicit, jargon-free, and do UI patterns follow common conventions that all age groups understand?',
      'Is the interface forgiving of mistakes — with clear undo options, confirmation steps for destructive actions, and helpful guidance instead of dead ends?',
      'Are essential functions accessible without requiring advanced digital skills — no drag-and-drop as the only option, no gesture-only interactions, no hidden navigation?',
    ],
  },

  // ═══ PILLAR 3: TECHNICAL EXCELLENCE ═════════════════════════
  {
    name: 'Performance & Page Speed',
    pillar: 'Technical Excellence',
    items: [
      'Does the page feel fast? (inferred from content weight)',
      'Are images optimized or do they appear heavy?',
      'Are there large scripts or heavy third-party embeds?',
      'Lazy loading for below-the-fold content',
    ],
  },
  {
    name: 'Mobile Experience',
    pillar: 'Technical Excellence',
    items: [
      'Is there a viewport meta tag?',
      'Does content appear mobile-friendly from markup?',
      'Touch targets — are buttons large enough for mobile?',
      'Does navigation work for mobile (hamburger, bottom nav)?',
    ],
  },
  {
    name: 'Accessibility & Inclusive Design',
    pillar: 'Technical Excellence',
    items: [
      'Sufficient colour contrast between text and background (WCAG AA)?',
      'Can all interactive elements be reached via keyboard navigation?',
      'Are form inputs properly labelled with associated labels?',
      'Are ARIA roles and landmarks used to aid screen readers?',
    ],
  },
  {
    name: 'Technical SEO & Accessibility',
    pillar: 'Technical Excellence',
    items: [
      'Title tag present and descriptive (50-60 chars)?',
      'Meta description present (150-160 chars)?',
      'Heading structure (H1 present, logical H2-H6)?',
      'Structured data / schema markup?',
    ],
  },

  // ═══ PILLAR 4: FUTURE READINESS ═════════════════════════════
  {
    name: 'AI Discoverability & LLM Readiness',
    pillar: 'Future Readiness',
    items: [
      'OUTCOME TEST: If someone asked an LLM "What is [this website/product]?" — could the LLM give an accurate, comprehensive answer based purely on the HTML content? Evaluate whether the site\'s purpose, audience, value proposition, and key differentiators are clearly stated in text (not trapped in images, videos, or JS-only widgets). A site with clean semantic HTML and clear textual content that tells its story well should score HIGH — it does not need an FAQ page or knowledge base to be AI-discoverable.',
      'Is the site\'s content structured with semantic HTML that LLMs can parse into coherent understanding? Check heading hierarchy (H1-H6), semantic elements (<article>, <section>, <nav>, <main>, <aside>), and logical information architecture. SCORING: If the HTML structure is clean and content follows a logical hierarchy, score high. Minor imperfections in semantic markup are LOW severity, not critical.',
      'Does the site surface its key factual information as accessible text? CONTEXT-AWARE: Evaluate based on what\'s relevant for THIS type of website — a SaaS product should have features and pricing in text; a portfolio should have work samples described; a blog should have articles accessible. Do NOT penalize a site for missing content types that don\'t apply to its business model (e.g., don\'t dock a developer tool for not having "product availability" info).',
      'Does the site have structured data (JSON-LD, schema.org, Open Graph) that helps AI systems categorize and describe it? Check for OG tags (og:title, og:description, og:image, og:type), meta description, and JSON-LD markup. SCORING: Good OG tags + meta description alone = decent score (60-70). Add JSON-LD with correct entity type (Organization, SoftwareApplication, Product, etc.) = high score (75-90). Having all three well-implemented = excellent (90+). Missing everything = low (30-40). Having only a basic meta description = medium (45-55).',
    ],
  },
  {
    name: 'AI Agent Readiness',
    pillar: 'Future Readiness',
    items: [
      'Can an AI agent navigate this site\'s information architecture by following HTML alone — reading navigation links, understanding page hierarchy, and finding key pages? Check that navigation uses semantic HTML (<nav>, descriptive <a> tags), pages have clear titles and headings, and the site structure is logically crawlable. IMPORTANT: A site does not need to be an e-commerce store to be agent-ready. A clearly navigable, content-rich site with good link structure IS agent-ready. Score based on navigability, not on whether it has a shopping cart.',
      'For whatever interactive elements exist on the site (forms, buttons, inputs, modals) — are they built with standard, accessible HTML? Check for proper <label> associations, descriptive button text, appropriate input types, and autocomplete attributes. CRITICAL SCORING RULE: If a site has few or no forms (e.g., it\'s a content site or SaaS with OAuth login), that is NOT a failure — score it on the interactive elements it DOES have. A site with 1 well-built form scores higher than a site with 10 poorly-labeled forms.',
      'Does the site have proper crawl infrastructure? Check for: (a) robots.txt that doesn\'t block AI crawlers, (b) sitemap.xml presence, (c) clean URL structure with descriptive slugs, (d) content that\'s server-rendered or pre-rendered (not hidden behind JS-only rendering). SCORING: Having robots.txt + sitemap.xml + clean URLs = high score. Missing sitemap but having everything else = medium. Actively blocking AI crawlers = critical issue.',
      'Does the site expose sufficient metadata for AI assistants to accurately represent this business when users ask about it? Check Open Graph tags, schema.org markup, and whether the site\'s identity/offerings are machine-readable. BONUS: Check for llms.txt or .well-known/ai-plugin.json — these are forward-looking signals. Having them is a bonus (boost score), not having them is NOT a penalty (most sites don\'t have them yet, so absence is neutral).',
      'REAL-WORLD AGENT TEST: Could an AI assistant (like ChatGPT, Claude, Perplexity) give a user accurate, helpful information about this site\'s product/service, pricing model, and how to get started — based on what\'s in the HTML? This is the ultimate test. If yes, the site is fundamentally agent-ready regardless of technical details. If the AI would struggle to answer basic questions about the business, that\'s a real gap.',
    ],
  },
  {
    name: 'Cultural Sensitivity & Global Readiness',
    pillar: 'Future Readiness',
    items: [
      'Is the content written in clear, plain language that non-native speakers can understand and translation tools can process accurately? Check for idioms, slang, culture-specific humor, or references that wouldn\'t translate well. IMPORTANT: Technical jargon is acceptable on products aimed at technical audiences — evaluate based on the target audience, not a universal plain-language standard. A developer docs site using "API endpoints" is fine; a consumer product using "synergize your workflow" is not.',
      'Does the site declare its language properly (html lang="...") and is the text direction handled correctly? For sites clearly targeting a single-language market (e.g., English-only SaaS), not having RTL support is a LOW severity observation at most — only flag RTL as high severity if the site explicitly targets multilingual or global audiences (e.g., has a language switcher, mentions global users, or operates in regions with RTL languages).',
      'Are visual design choices and imagery reasonably neutral across major cultural contexts? PRACTICAL STANDARD: Standard web design conventions (blue for links, red for errors/warnings, green for success) are universally understood and should NEVER be flagged. Only flag genuinely problematic choices — culturally offensive imagery, inappropriate symbols, or stereotypical representations. If the design is clean and uses standard web conventions, score HIGH.',
      'If the site displays prices, dates, or numbers — are they formatted appropriately for the target audience? SCORING: This only applies if the site shows these elements. A blog with no pricing doesn\'t need currency localization — score it neutrally (70+). A site selling internationally with USD-only pricing and US date format has a real gap. A site selling to one market with correct local formatting scores high.',
      'Does the site have appropriate legal/privacy infrastructure for its target markets? Check for privacy policy, cookie consent (if applicable), and data handling disclosures. SCORING: A US-focused site with a solid privacy policy = good score. A site clearly targeting EU users without GDPR compliance = real gap. Don\'t penalize a small US startup for not having a CCPA-specific page unless it targets California users explicitly.',
    ],
  },
]

/**
 * Analyze a single UX category — called once per category
 */
export async function analyzeCategory(
  pageContent: string,
  category: string,
  checklistItems: Array<{ title: string; description: string; whatToCheck: string }>,
  userFocus?: string | null,
  language: string = 'en',
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

  const prompt = `You are a senior UX strategist at a world-class design consultancy (think IDEO, Pentagram, or Nielsen Norman Group). You are conducting a deep, human-centered UX audit for a paying client. This is NOT a basic checklist scan — it is the kind of audit that agencies charge $5,000–$15,000 for.
${languageInstruction}
CATEGORY: ${category}
${focusBlock}
EVALUATION CRITERIA:
${itemsToCheck}

WEBSITE CONTENT (text extracted from MULTIPLE PAGES — each page starts with "URL:" followed by the page address):
---
${pageContent.substring(0, 15000)}
---

YOUR APPROACH — DEEP ANALYSIS, NOT SURFACE SCANNING:
You must think like a senior consultant, not an automated checker. Your job is to find REAL issues that actually impact users, conversions, and business outcomes. The kind of insights that make a client say "I never thought of that."

CRITICAL — CONTEXT-AWARE EVALUATION:
Before analyzing, determine the site's type (SaaS, e-commerce, content/blog, portfolio, marketplace, tool/API, etc.) and its target audience. Your evaluation MUST adapt to context:
- A SaaS product doesn't need shopping cart agent-readiness or multi-currency support
- A developer tool can use technical jargon without being "culturally insensitive"
- An English-only startup shouldn't be heavily penalized for lacking RTL support
- A site with no forms isn't "failing at form accessibility" — it simply has no forms
- Missing a specific content format (FAQ, knowledge base, blog) is NOT a failure if the site communicates clearly through other means
Evaluate what IS there, not what's absent. A clean, well-structured site that clearly communicates its purpose should score well — don't invent problems because a theoretical checklist item is "missing." The question is always: "Does this site WORK for its users and for AI systems?" — not "Does it have every possible feature?"

CRITICAL — DEMO & ILLUSTRATIVE CONTENT EXCLUSION:
Many websites display example/demo content to showcase their product's capabilities (e.g., a UX audit tool showing sample findings, a design tool showing example designs, a security scanner showing sample vulnerabilities). You MUST recognize and EXCLUDE this type of content from your analysis:
- Content inside elements marked with data-demo="true", role="presentation", or aria-label containing "example", "demo", or "illustrative"
- Content explicitly labeled as "Example", "Demo", "Sample", "Preview", or "Illustration"
- Product showcase sections that display what the tool DETECTS on other sites (not issues on THIS site)
- Mock-ups, wireframes, or UI previews shown as product demonstrations
If you find text like "Confirmshaming detected" or "Dark pattern found" inside a demo/example panel on a UX audit tool's own website, that is the tool demonstrating its capabilities — NOT an actual dark pattern on the site. Never flag demo content as real findings.

DO NOT flag these common false positives:
- Generic "missing meta description" or "missing alt text" unless it's truly egregious
- Minor HTML structure issues that don't affect the user experience
- Things that are industry-standard or acceptable for the site's context (e.g., a SaaS startup doesn't need the same trust signals as a bank)
- Theoretical issues you can't actually verify from the content provided
- Things that "could be better" but work perfectly fine as-is
- Issues that every website in the world has — focus on what THIS specific site is doing wrong
- Demo or illustrative content used to showcase the product's features (see DEMO EXCLUSION rule above)
- Missing content types that don't apply to the site's business model (e.g., no FAQ, no pricing table, no blog — these are only issues if the site NEEDS them)
- RTL or multi-language support on sites that clearly target a single language market
- "No shopping cart is agent-accessible" on sites that aren't e-commerce
- Formatting localization (dates, currencies) on sites that don't display these elements
- Standard web design color conventions (blue links, red errors, green success) as "culturally insensitive"

DO flag these high-value findings:
- Real friction points in the user journey that lose conversions
- Messaging problems — unclear value proposition, confusing copy, mixed signals
- Dark patterns or manipulative design that erodes trust
- Emotional disconnects — where the tone doesn't match the audience
- Critical accessibility barriers that exclude real user groups
- Mobile-specific problems that break the experience
- AI/LLM readiness gaps that ACTUALLY prevent AI systems from understanding the site (not theoretical checklist items)
- Cultural insensitivity or assumptions that ACTUALLY alienate real user groups (not theoretical concerns about standard web conventions)
- Psychological safety issues — content that creates anxiety, pressure, or confusion
- Performance bottlenecks that directly harm user retention

QUALITY STANDARDS FOR EACH FINDING:
1. SPECIFIC — Reference actual text, elements, or patterns you observe. Quote the website.
2. IMPACTFUL — Explain WHY this matters in business terms (lost conversions, user drop-off, trust erosion).
3. FIXABLE — Give a concrete, implementable recommendation. Not "improve your CTA" but "Change the CTA from 'Submit' to 'Get My Free Report' — action-oriented language increases click-through by 20-30%."
4. DEEP — Go beyond what a basic tool would catch. Show the insight of a $200/hour consultant.

IMPORTANT: The content above includes MULTIPLE pages, each starting with "URL:". Set "pageUrl" to the SPECIFIC page URL where each issue exists — NOT the homepage for every finding.

For each issue, assign severity honestly:
- "critical": Actively losing significant revenue, users, or trust. Must fix immediately.
- "high": Noticeably hurting the experience. Users are confused or frustrated by this.
- "medium": Real improvement opportunity that would meaningfully move the needle.
- "low": Refinement that separates good from great. Still worth doing.

Return a JSON array. Each issue:
{
  "severity": "critical" | "high" | "medium" | "low",
  "title": "Clear, specific title (not generic)",
  "description": "Deep analysis referencing actual content. Quote specific text. Explain the psychological or business impact on real users. This should read like a senior consultant's insight, not an automated scan result.",
  "recommendation": "Concrete, implementable fix with specific details. Include the 'why' — what improvement the client should expect. Reference best practices or data where relevant.",
  "estimatedImpact": "Specific expected improvement (e.g., '15-25% increase in CTA clicks', 'Reduces bounce rate for mobile users', 'Eliminates trust barrier for first-time visitors')",
  "targetElement": "CSS selector or descriptive text to locate the element (e.g., 'nav', '.hero-section', 'button.cta'). Set to null if page-wide.",
  "pageUrl": "REQUIRED — The exact URL from the 'URL:' lines above where this issue exists. Never null."
}

QUANTITY GUIDELINES:
- Include 2-5 findings per category. Fewer, better findings beat many shallow ones.
- It's OK to report only 1-2 findings if the site genuinely excels in this category.
- Every finding must be genuinely worth the client's attention and effort to fix.
- If you can't find real issues, report fewer findings rather than inventing problems.

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.`

  try {
    const anthropic = getAnthropicClient()
    // Haiku 4.5 — excellent at structured analysis tasks (issue identification,
    // severity classification, actionable recommendations). Sonnet is reserved
    // for the final report generation where writing quality matters more.
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
      90_000,
      `analyzeCategory(${category})`,
    )

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    const jsonMatch = responseText.match(/\[[\s\S]*\]/m)
    if (!jsonMatch) {
      console.error(`[analyzeCategory] No JSON in response for "${category}":`, responseText.substring(0, 200))
      return []
    }

    const findings: AnalysisFinding[] = JSON.parse(jsonMatch[0])
    return findings
      .filter((f) => f.severity && f.title && f.description && f.recommendation)
      .map((f) => ({ ...f, targetElement: f.targetElement || null, pageUrl: f.pageUrl || null }))
  } catch (err) {
    console.error(`[analyzeCategory] Error for "${category}":`, err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Run full analysis across all 19 UX categories in parallel batches.
 * This is used when the checklist_categories table is empty (not seeded).
 * Runs 3 categories concurrently to balance speed vs rate limits.
 */
export async function runFullAnalysis(
  pageContent: string,
  audit: Audit,
  userFocus?: string | null,
  language: string = 'en',
): Promise<AnalysisFinding[]> {
  const allFindings: AnalysisFinding[] = []
  const CONCURRENCY = 3

  // Process categories in batches of CONCURRENCY
  for (let i = 0; i < UX_CATEGORIES.length; i += CONCURRENCY) {
    const batch = UX_CATEGORIES.slice(i, i + CONCURRENCY)
    console.log(`[runFullAnalysis] Batch ${Math.floor(i / CONCURRENCY) + 1}: ${batch.map((c) => c.name).join(', ')}`)

    const batchResults = await Promise.all(
      batch.map((category) =>
        analyzeCategory(
          pageContent,
          category.name,
          category.items.map((item) => ({
            title: item,
            description: item,
            whatToCheck: item,
          })),
          userFocus,
          language,
        ),
      ),
    )

    for (const findings of batchResults) {
      allFindings.push(...findings)
    }

    // Brief pause between batches to avoid rate limits
    if (i + CONCURRENCY < UX_CATEGORIES.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return allFindings
}

/**
 * Generate comprehensive report with executive summary and scores
 */
export async function generateReport(
  findings: AuditFinding[],
  auditData: Audit,
  pageContent: string,
  userFocus?: string | null,
  language: string = 'en',
): Promise<ReportData> {
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
  const translatedNames = getCategoryNames(language)

  const categoryList = translatedNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
  const categoryExamples = translatedNames.map((name, i) => {
    const scores = [75, 68, 72, 65, 80, 74, 60, 70, 55, 52, 62, 48, 65, 58, 72, 66, 45, 40, 55]
    return `    { "name": "${name}", "score": ${scores[i % scores.length]}, "summary": "..." }`
  }).join(',\n')

  const prompt = `You are a senior UX strategist at a premium consultancy writing the executive summary for a human-centered digital audit. This report costs real money — the client expects the quality of a $10,000 consulting engagement.
${reportLanguageInstruction}
WEBSITE: ${auditData.product_url}
${focusBlock}
WEBSITE CONTENT PREVIEW:
${pageContent.substring(0, 8000)}

AUDIT FINDINGS (${findings.length} total):
- ${criticalCount} critical issues
- ${highCount} high priority issues
- ${mediumCount} medium priority issues
- ${lowCount} low priority improvements

DETAILED FINDINGS:
${findingsDetail}

INSTRUCTIONS:
Write a comprehensive, insightful executive summary and score the website. This is a Human-Centered Digital Audit — go beyond basic UX and address how the site treats its users as human beings.

For the EXECUTIVE SUMMARY:
- Write 4-5 well-crafted paragraphs (not bullet points)
- Start with what the website does, who it serves, and the overall impression it creates
- Discuss what works well — be genuine about strengths (this builds credibility for the critique)
- Address the most impactful issues with depth: explain the human impact, not just the technical problem. How does this issue make real users FEEL? What does it cost the business?
- Cover findings across all 4 audit pillars (Foundation, Human Experience, Technical Excellence, Future Readiness) — show the breadth of the analysis
- End with a clear, prioritized action plan: what to fix first for maximum ROI
- Write with authority and empathy. This should feel like advice from a trusted consultant, not a scan report
- Reference specific content from the site — quote actual copy, describe actual design decisions

For SCORES (0-100, be precise — NOT all 50s):
- overallScore: Weighted average reflecting overall quality
- uxScore: Overall user experience (layout, interactions, flow)
- conversionScore: Ability to drive actions/signups/purchases
- mobileScore: Mobile experience quality
- aiDiscoverabilityScore: SEO, structured data, LLM readability
- contentScore: Writing quality, clarity, scannability

Score guidelines:
- 90-100: Exceptional, industry-leading
- 75-89: Good, minor improvements needed
- 60-74: Decent but with significant gaps
- 40-59: Below average, needs substantial work
- 20-39: Poor, major issues throughout
- 0-19: Severely broken

For CATEGORY SCORES:
Provide a score (0-100) and a one-sentence summary for each of these 19 categories.
IMPORTANT: Use EXACTLY these category names (they are already in the correct language):
${categoryList}

For KEY RECOMMENDATION:
- ONE sentence describing the single highest-impact change they should make

Return ONLY valid JSON:
{
  "executiveSummary": "...",
  "keyRecommendation": "...",
  "overallScore": 72,
  "uxScore": 68,
  "conversionScore": 65,
  "mobileScore": 74,
  "aiDiscoverabilityScore": 55,
  "contentScore": 70,
  "categoryScores": [
${categoryExamples}
  ]
}`

  try {
    const anthropic = getAnthropicClient()
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
      120_000,
      'generateReport',
    )

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    // Try to extract JSON — the response should be a single JSON object
    // First try the full match, then try progressively shorter matches if parse fails
    const jsonMatch = responseText.match(/\{[\s\S]*\}/m)
    if (!jsonMatch) {
      console.error('[generateReport] No JSON in response:', responseText.substring(0, 500))
      console.error('[generateReport] Response length:', responseText.length, '| stop_reason:', message.stop_reason)
      return getDefaultReport()
    }

    let report: ReportData
    try {
      report = JSON.parse(jsonMatch[0])
    } catch (parseErr) {
      // JSON was likely truncated — try to repair by finding the last complete categoryScores entry
      console.error('[generateReport] JSON parse failed, attempting repair. stop_reason:', message.stop_reason)
      let raw = jsonMatch[0]

      // If truncated inside categoryScores array, close it off
      const catStart = raw.indexOf('"categoryScores"')
      if (catStart !== -1) {
        // Find the last complete object (ends with })
        const lastBrace = raw.lastIndexOf('}')
        const lastBracket = raw.lastIndexOf(']')

        if (lastBracket > catStart && lastBracket > lastBrace) {
          // Array was closed but outer object wasn't
          raw = raw.substring(0, lastBracket + 1) + '}'
        } else if (lastBrace > catStart) {
          // Find the last complete }, then close array and object
          raw = raw.substring(0, lastBrace + 1) + ']}'
        }
      }

      try {
        report = JSON.parse(raw)
        console.log('[generateReport] JSON repair succeeded')
      } catch {
        console.error('[generateReport] JSON repair also failed. Raw start:', raw.substring(0, 300))
        return getDefaultReport()
      }
    }

    // Validate
    return {
      executiveSummary: report.executiveSummary || '',
      keyRecommendation: report.keyRecommendation || null,
      overallScore: clampScore(report.overallScore),
      uxScore: clampScore(report.uxScore),
      conversionScore: clampScore(report.conversionScore),
      mobileScore: clampScore(report.mobileScore),
      aiDiscoverabilityScore: clampScore(report.aiDiscoverabilityScore),
      contentScore: clampScore(report.contentScore),
      categoryScores: Array.isArray(report.categoryScores)
        ? report.categoryScores.map((c: any) => ({
            name: c.name || 'Unknown',
            score: clampScore(c.score),
            summary: c.summary || '',
          }))
        : getDefaultCategoryScores(),
    }
  } catch (err) {
    console.error('[generateReport] Error:', err instanceof Error ? err.message : err)
    return getDefaultReport()
  }
}

function clampScore(v: number | undefined): number {
  if (v == null || isNaN(v)) return 50
  return Math.min(100, Math.max(0, Math.round(v)))
}

function getDefaultCategoryScores(language: string = 'en'): CategoryScore[] {
  const names = getCategoryNames(language)
  return names.map((name) => ({ name, score: 50, summary: 'Needs evaluation' }))
}

function getDefaultReport(): ReportData {
  return {
    executiveSummary:
      'The audit identified areas for improvement in user experience, performance, and conversion optimization. Review the detailed findings for specific recommendations.',
    keyRecommendation: 'Prioritize critical issues first, then address high-impact improvements.',
    overallScore: 50,
    uxScore: 50,
    conversionScore: 50,
    mobileScore: 50,
    aiDiscoverabilityScore: 50,
    contentScore: 50,
    categoryScores: getDefaultCategoryScores(),
  }
}
