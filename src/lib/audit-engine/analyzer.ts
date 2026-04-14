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
  keyRecommendation: string | null          // kept for backwards compat
  topRecommendations: string[]              // top 3 priority recommendations
  overallScore: number
  uxScore: number
  conversionScore: number
  mobileScore: number
  aiDiscoverabilityScore: number
  contentScore: number
  categoryScores: CategoryScore[]
}

// ── The 16 UX categories we evaluate ─────────────────────────
// Grouped into 4 pillars (4 categories each = 25% weight per pillar):
//   FOUNDATION (1-4): Does the site look right?
//   HUMAN EXPERIENCE (5-8): Does the site feel right?
//   INCLUSIVE DESIGN (9-12): Does the site work for everyone?
//   FUTURE READINESS (13-16): Is the site ready for what's next?
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
      'VIEWPORT & RESPONSIVENESS: Does the site have a proper viewport meta tag and responsive layout? Check if content reflows for smaller screens or requires horizontal scrolling. Look for fixed-width elements, overflowing text, or images that break the layout on mobile viewport sizes.',
      'TOUCH INTERACTION: Are all interactive elements (buttons, links, form fields) at least 44×44px with adequate spacing between them? On mobile, fat-finger errors from tiny or cramped targets are the #1 usability killer. Flag any button or link that would be hard to tap accurately.',
      'MOBILE NAVIGATION: Does the site have a mobile-appropriate navigation pattern (hamburger menu, bottom nav, or simplified nav)? Is the full desktop nav crammed into mobile, or is it adapted? Check that the mobile menu is easy to open, navigate, and close.',
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

  // Extract available page URLs from the aggregated content for the prompt
  const availableUrls = pageContent
    .split('\n')
    .filter((line) => line.startsWith('URL: '))
    .map((line) => line.replace('URL: ', '').trim())
  const pageUrlIndex = availableUrls.length > 0
    ? `\nAVAILABLE PAGE URLs (use ONLY these exact URLs for the "pageUrl" field):\n${availableUrls.map((u, i) => `  [${i + 1}] ${u}`).join('\n')}\n`
    : ''

  const prompt = `You are a senior UX strategist at a world-class design consultancy (think IDEO, Pentagram, or Nielsen Norman Group). You are conducting a deep, human-centered UX audit for a paying client. This is NOT a basic checklist scan — it is the kind of audit that agencies charge $5,000–$15,000 for.
${languageInstruction}
CATEGORY: ${category}
${focusBlock}${pageUrlIndex}
EVALUATION CRITERIA:
${itemsToCheck}

WEBSITE CONTENT (text extracted from MULTIPLE PAGES — each page starts with "URL:" followed by the page address):
---
${pageContent.substring(0, 10000)}
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

CRITICAL — CROSS-PAGE AWARENESS:
The content provided includes ALL crawled pages from this website. Before flagging something as "missing" or "absent", you MUST check if it exists on ANY page — not just the homepage.
Common examples of cross-page content that should NOT be flagged as missing:
- Founder bios, team info, credentials → often on /about
- Pricing details, plan comparisons → often on /pricing
- FAQ, help content → often on /faq or /help
- Privacy, terms, cookie policy → often on /privacy, /terms
- Contact info, support → often on /contact
- Testimonials, case studies → may be on dedicated pages
If the SITE MAP section above shows a relevant page exists (e.g., an About page), assume that page addresses the concern. Only flag content as missing if it GENUINELY does not exist anywhere on the site. Flagging "no founder credentials" when there is an About page with a founder story is a FALSE POSITIVE — and a sign of poor audit quality.

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
- Content that EXISTS on another page of the same site (e.g., "no team credentials" when there's an About page, "no pricing" when there's a Pricing page) — CHECK THE SITE MAP
- Suggesting content that already exists elsewhere on the site should be "added to the homepage" — that's a layout preference, not a UX issue
- Generic recommendations like "add social proof" when testimonials exist on the site

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
5. VERIFIED — Before including ANY finding about "missing" content, confirm it's not on another page. If the site has an About page, don't flag missing team info. If it has a Pricing page, don't flag missing pricing. If it has an FAQ page, don't flag missing FAQ. A senior consultant would check the WHOLE site, not just one page.

CRITICAL — PAGE URL ASSIGNMENT:
The content above includes MULTIPLE pages, each starting with "URL:". For each finding, you MUST set "pageUrl" to the EXACT page URL (from the list above) where the issue exists.
- Look at which page's content contains the problem you're describing
- Use the FULL URL exactly as shown (e.g., "https://example.com/pricing" not just "example.com")
- NEVER use the homepage URL for every finding — distribute findings across the actual pages where issues occur
- If a finding is about the pricing page, use the pricing page URL. If about the FAQ, use the FAQ URL. Etc.

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
  "targetElement": "A valid CSS selector to locate the element on the page. Use simple, reliable selectors: tag names ('nav', 'header', 'footer', 'main'), class selectors ('.hero', '.cta-button', '.pricing'), ID selectors ('#checkout', '#signup'), or combined ('section.features', 'form.contact', 'nav > ul'). Must be a real CSS selector, NOT a description. Set to null if the issue is page-wide.",
  "pageUrl": "REQUIRED — Copy-paste the exact full URL from the AVAILABLE PAGE URLs list where this issue was found. Must be one of the URLs listed. NEVER use just the domain."
}

QUANTITY GUIDELINES:
- Include 2-5 findings per category. Fewer, better findings beat many shallow ones.
- It's OK to report only 1-2 findings if the site genuinely excels in this category.
- Every finding must be genuinely worth the client's attention and effort to fix.
- If you can't find real issues, report fewer findings rather than inventing problems.

RE-AUDIT CONSISTENCY:
If a PREVIOUS AUDIT BASELINE is provided above, you MUST be consistent:
- Do NOT invent new issues for content that hasn't changed since the previous audit.
- Do NOT assign a different severity to the same unchanged issue.
- If a [SKIP] or [FIXED] finding is listed, do NOT re-report it unless the issue is CLEARLY still present.
- If a [OPEN] finding from the previous audit is still present, re-report it with the SAME title and severity.
- Only report genuinely NEW issues that were not covered in any previous finding.
- Consistency between audits is CRITICAL. Random variation on unchanged content destroys user trust.

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.`

  try {
    const anthropic = getAnthropicClient()
    // Haiku 4.5 — excellent at structured analysis tasks (issue identification,
    // severity classification, actionable recommendations). Sonnet is reserved
    // for the final report generation where writing quality matters more.
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
      45_000,
      `analyzeCategory(${category})`,
    )

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
      .map((f) => ({ ...f, targetElement: f.targetElement || null, pageUrl: f.pageUrl || null }))
  } catch (err) {
    console.error(`[analyzeCategory] Error for "${category}":`, err instanceof Error ? err.message : err)
    // Return empty — don't throw. One category failing shouldn't kill the audit.
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

  // Process categories ONE AT A TIME to avoid rate limits and memory issues
  for (let i = 0; i < UX_CATEGORIES.length; i++) {
    const category = UX_CATEGORIES[i]
    console.log(`[runFullAnalysis] Category ${i + 1}/${UX_CATEGORIES.length}: ${category.name}`)

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
    )

    allFindings.push(...findings)

    // Brief pause between categories to avoid rate limits
    if (i < UX_CATEGORIES.length - 1) {
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
    const scores = [75, 68, 72, 65, 80, 74, 60, 70, 55, 62, 48, 65, 58, 72, 66, 45]
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
- Cover findings across all 4 audit pillars (Foundation, Human Experience, Inclusive Design, Future Readiness) — show the breadth of the analysis
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
Provide a score (0-100) and a one-sentence summary for each of these 16 categories.
IMPORTANT: Use EXACTLY these category names (they are already in the correct language):
${categoryList}

For TOP 3 PRIORITY RECOMMENDATIONS:
- Provide exactly 3 recommendations, ordered by impact (highest first)
- Each recommendation should be 1-2 sentences: what to change and why it matters
- Be specific — reference actual elements, copy, or patterns from the site
- Cover different aspects of the site (don't give 3 recommendations about the same thing)
- These should be the 3 changes that would move the needle the most

SCORE CALIBRATION (CRITICAL FOR RE-AUDITS):
If a PREVIOUS AUDIT BASELINE with category scores is provided in the content above:
- Your category scores MUST be calibrated against the previous baseline.
- For unchanged content, scores should be within 5-10 points of the previous score.
- Score a category HIGHER only if you can identify a specific improvement in the content.
- Score a category LOWER only if you can identify a specific regression or new issue.
- Random variation of 15+ points on unchanged content is UNACCEPTABLE.
- In the executive summary, note what changed vs what stayed the same.

Return ONLY valid JSON:
{
  "executiveSummary": "...",
  "topRecommendations": ["First priority...", "Second priority...", "Third priority..."],
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
      60_000,
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
      return calculateScoresFromFindings(findings, language)
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
        return calculateScoresFromFindings(findings, language)
      }
    }

    // Validate
    // Parse top recommendations — handle both new and old format
    const topRecs: string[] = Array.isArray(report.topRecommendations)
      ? report.topRecommendations.filter((r: any) => typeof r === 'string' && r.trim())
      : report.keyRecommendation
        ? [report.keyRecommendation]
        : []

    // Parse category scores
    const categoryScores = Array.isArray(report.categoryScores)
      ? report.categoryScores.map((c: any) => ({
          name: c.name || 'Unknown',
          score: clampScore(c.score),
          summary: c.summary || '',
        }))
      : getDefaultCategoryScores()

    // CALCULATE scores from category data — don't trust AI's arbitrary numbers
    // Pillars: Foundation (0-3), Human Experience (4-7), Inclusive Design (8-11), Future Readiness (12-15)
    const pillarAvg = (start: number, end: number) => {
      const cats = categoryScores.slice(start, Math.min(end, categoryScores.length))
      return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
    }

    const calculatedUx = pillarAvg(0, 4)           // Foundation
    const calculatedConversion = pillarAvg(4, 8)    // Human Experience
    const calculatedInclusive = pillarAvg(8, 12)    // Inclusive Design
    const calculatedFuture = pillarAvg(12, 16)      // Future Readiness

    // Overall = average of ALL category scores (not just pillar averages)
    const allScores = categoryScores.map(c => c.score)
    const calculatedOverall = allScores.length > 0
      ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
      : 50

    return {
      executiveSummary: report.executiveSummary || '',
      keyRecommendation: topRecs[0] || report.keyRecommendation || null,
      topRecommendations: topRecs.length > 0 ? topRecs : ['Prioritize critical issues first, then address high-impact improvements.'],
      overallScore: calculatedOverall,
      uxScore: calculatedUx,
      conversionScore: calculatedConversion,
      mobileScore: calculatedInclusive,
      aiDiscoverabilityScore: calculatedFuture,
      contentScore: clampScore(report.contentScore), // keep AI's content score as supplementary
      categoryScores,
    }
  } catch (err) {
    console.error('[generateReport] Error:', err instanceof Error ? err.message : err)
    // Calculate scores from findings instead of returning fake 50s
    return calculateScoresFromFindings(findings, language)
  }
}

function clampScore(v: number | undefined): number {
  if (v == null || isNaN(v)) return 70 // Default to 70 (decent) not 50 — absence of findings is positive
  return Math.min(100, Math.max(0, Math.round(v)))
}

function getDefaultCategoryScores(language: string = 'en'): CategoryScore[] {
  const names = getCategoryNames(language)
  return names.map((name) => ({ name, score: 70, summary: '' }))
}

/**
 * Calculate scores from findings when report generation fails.
 * Uses severity-based deduction: each finding reduces the score from 100.
 * This ensures scores always reflect real analysis, never static defaults.
 */
function calculateScoresFromFindings(findings: AuditFinding[], language: string = 'en'): ReportData {
  const categoryNames = getCategoryNames(language)
  const severityPenalty: Record<string, number> = { critical: 15, high: 10, medium: 5, low: 2 }

  // Assign findings to categories by keyword matching
  const findingsPerCategory: Record<string, AuditFinding[]> = {}
  for (const name of categoryNames) findingsPerCategory[name] = []

  for (const f of findings) {
    let matched = false
    for (const catName of categoryNames) {
      const words = catName.toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
      const text = `${f.title} ${f.description}`.toLowerCase()
      if (words.some(w => text.includes(w))) {
        findingsPerCategory[catName].push(f)
        matched = true
        break
      }
    }
    if (!matched) {
      // Distribute by sort order
      const idx = Math.min(Math.floor(f.sort_order / Math.max(1, findings.length / categoryNames.length)), categoryNames.length - 1)
      findingsPerCategory[categoryNames[idx]].push(f)
    }
  }

  // Calculate score per category
  // Categories WITH findings: start at 85, deduct per severity (findings = something was wrong)
  // Categories WITHOUT findings: score 75 (we can't verify they're perfect, so be conservative)
  const categoryScores: CategoryScore[] = categoryNames.map(name => {
    const catFindings = findingsPerCategory[name]
    if (catFindings.length === 0) {
      // No findings doesn't mean perfect — it means the AI might not have analyzed this category deeply
      return { name, score: 75, summary: '' }
    }
    let score = 85
    for (const f of catFindings) {
      score -= severityPenalty[f.severity] || 5
    }
    return { name, score: Math.max(0, Math.min(100, Math.round(score))), summary: '' }
  })

  const allScores = categoryScores.map(c => c.score)
  const overall = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 70

  const pillarAvg = (start: number, end: number) => {
    const cats = categoryScores.slice(start, Math.min(end, categoryScores.length))
    return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 70
  }

  // Build a basic executive summary from findings
  const criticalCount = findings.filter(f => f.severity === 'critical').length
  const highCount = findings.filter(f => f.severity === 'high').length
  const summary = criticalCount > 0
    ? `This audit identified ${findings.length} issues, including ${criticalCount} critical finding${criticalCount > 1 ? 's' : ''} that require immediate attention. Focus on the critical and high-severity issues first for maximum impact.`
    : highCount > 0
    ? `This audit identified ${findings.length} issues, with ${highCount} high-priority finding${highCount > 1 ? 's' : ''}. Addressing these will meaningfully improve the user experience.`
    : `This audit identified ${findings.length} areas for improvement. Most are medium or low severity, suggesting a solid baseline with room for refinement.`

  const topRecs = findings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 3)
    .map(f => f.recommendation)

  return {
    executiveSummary: summary,
    keyRecommendation: topRecs[0] || 'Review the detailed findings and prioritise by severity.',
    topRecommendations: topRecs.length > 0 ? topRecs : ['Review the detailed findings and prioritise by severity.'],
    overallScore: overall,
    uxScore: pillarAvg(0, 4),
    conversionScore: pillarAvg(4, 8),
    mobileScore: pillarAvg(8, 12),
    aiDiscoverabilityScore: pillarAvg(12, 16),
    contentScore: overall,
    categoryScores,
  }
}
