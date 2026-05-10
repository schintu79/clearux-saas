// ============================================================
// ClearUX Audit Engine — Claude AI Analyzer
// Produces comprehensive, professional UX audit analysis
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import type { Audit, FindingSeverity, AuditFinding } from '@/types/database'
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

// ── The UX categories we evaluate ────────────────────────────
// Grouped into 6 modules (4 categories each):
//   FOUNDATION (0-3): Does the site look right?
//   HUMAN EXPERIENCE (4-7): Does the site feel right?
//   INCLUSIVE DESIGN (8-11): Does the site work for everyone?
//   FUTURE READINESS (12-15): Is the site ready for what's next?
//   SEO STRUCTURE & RULES (16-19): Is the site search-engine friendly?
//   BRAND CONSISTENCY (20-23): Does the site match the brand? (requires brand files)
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

  // ═══ MODULE 6: BRAND CONSISTENCY ═══════════════════════════
  // Website alignment with brand identity (requires brand files)
  {
    name: 'Visual Identity Alignment',
    pillar: 'Brand Consistency',
    items: [
      'COLOR PALETTE MATCH: Compare the website\'s color usage against the brand guidelines. Are the primary, secondary, and accent colors used correctly and consistently? Check: hero sections, buttons, links, backgrounds, and text colors. Flag any colors used prominently on the website that don\'t appear in the brand palette, or brand colors that are absent from the website.',
      'TYPOGRAPHY CONSISTENCY: Does the website use the fonts specified in the brand guidelines? Check: heading fonts, body text fonts, font weights, and font sizes. If the brand specifies a particular typeface, is it actually loaded and used on the site? Flag: wrong fonts, missing web font loading, inconsistent font usage across pages, or font sizes that don\'t match brand specifications.',
      'LOGO USAGE: Is the logo used correctly according to brand guidelines? Check: proper logo version (full color, monochrome, icon-only), minimum clear space around the logo, logo sizing, and placement. Flag: distorted logos, logos on incorrect backgrounds, logos too small/large, or logo placement that violates brand rules.',
      'IMAGERY & VISUAL STYLE: Does the website\'s visual style (photography, illustrations, icons, graphics) match the brand\'s visual language? Check: image style consistency, icon style matching brand guidelines, use of brand-specific visual elements, and overall aesthetic alignment. Flag: stock photos that clash with brand personality, inconsistent illustration styles, or visual elements that feel off-brand.',
    ],
  },
  {
    name: 'Voice & Tone Alignment',
    pillar: 'Brand Consistency',
    items: [
      'BRAND VOICE MATCH: Does the website copy reflect the brand\'s defined voice and personality? If the brand is described as "professional yet approachable," does the website copy feel that way? Compare actual website copy against brand voice guidelines. Quote specific examples of copy that aligns well and copy that misaligns with the stated brand voice.',
      'TONE CONSISTENCY ACROSS PAGES: Is the tone of voice consistent across all pages, or does it shift unexpectedly? The homepage might be energetic while the pricing page is dry and corporate. Check all crawled pages for tonal consistency. Flag jarring shifts in tone that could confuse users about the brand\'s personality.',
      'AUDIENCE LANGUAGE FIT: Does the website use language appropriate for the brand\'s target audience as defined in the brand materials? If the brand targets enterprise clients but the website uses casual slang, that\'s a mismatch. Compare the website\'s reading level and vocabulary against the audience defined in brand documents.',
      'BRAND TERMINOLOGY: Does the website consistently use the brand\'s preferred terminology for its products, features, and services? Check: product names, feature names, industry terms, and brand-specific vocabulary. Flag: inconsistent naming (calling the same thing different names on different pages), or using generic terms instead of branded terminology defined in brand materials.',
    ],
  },
  {
    name: 'Messaging & Value Prop Alignment',
    pillar: 'Brand Consistency',
    items: [
      'CORE MESSAGE ALIGNMENT: Does the website\'s primary messaging (hero headline, tagline, key selling points) align with the brand\'s documented value proposition and positioning? Compare the website\'s stated benefits against the brand\'s defined value proposition. Flag: messaging that contradicts brand positioning, missing key selling points, or value props that don\'t appear anywhere on the site.',
      'KEY MESSAGES PRESENCE: Are the brand\'s key messages and talking points represented on the website? Check if the most important brand messages (as defined in brand documents) appear prominently on the site. Flag: key messages that are buried or absent, messaging that introduces claims not supported by brand documents, or critical differentiators that are missing from the website.',
      'COMPETITIVE POSITIONING: Does the website\'s competitive positioning match what\'s defined in the brand materials? If the brand positions itself as premium, does the website communicate premium value? If the brand emphasizes innovation, is that reflected in the site\'s messaging and design? Flag disconnects between stated positioning and how the website actually presents the brand.',
      'PROMISE CONSISTENCY: Are the promises and claims made on the website consistent with what the brand documents state? Check: pricing claims, feature descriptions, guarantees, and customer promises. Flag: website promises that exceed brand documentation (overpromising), or brand commitments that aren\'t reflected on the website (missed opportunities).',
    ],
  },
  {
    name: 'Brand Standards Compliance',
    pillar: 'Brand Consistency',
    items: [
      'BRAND GUIDELINE ADHERENCE: Does the website follow the specific rules laid out in the brand guidelines? This includes: spacing rules, grid systems, component styles, and any do\'s and don\'ts specified in brand documents. Flag specific violations of documented brand standards with references to which guideline is being violated.',
      'CONTENT FORMAT STANDARDS: Does the website follow the brand\'s content formatting standards? Check: date formats, number formatting, capitalization rules (Title Case vs sentence case), abbreviation usage, and any editorial style guide rules. Consistency in these details signals professionalism and brand discipline.',
      'CROSS-PAGE CONSISTENCY: Is the brand applied consistently across ALL pages of the website, or do some pages feel "off-brand"? Inner pages, blog posts, and utility pages (404, login, terms) often deviate from brand standards. Check every crawled page against brand guidelines. Flag pages that feel like they belong to a different brand.',
      'BRAND EVOLUTION GAPS: Are there signs that the brand has evolved but the website hasn\'t caught up? Check for: old logos still appearing somewhere, outdated color schemes on legacy pages, messaging that uses old positioning language, or visual elements from a previous brand iteration. These gaps erode brand credibility and confuse users about the current brand identity.',
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
    'may not have',
    'may not be',
    'may lack',
    'might not',
    'might lack',
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

  const prompt = `You are a senior UX strategist at a world-class design consultancy (think IDEO, Pentagram, or Nielsen Norman Group). You are conducting a deep, human-centered UX audit for a paying client. This is NOT a basic checklist scan — it is the kind of audit that agencies charge $5,000–$15,000 for.
${languageInstruction}
CATEGORY: ${displayCategoryName}
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

MANDATORY EVIDENCE RULE — ZERO SPECULATION POLICY:
Every finding MUST cite specific, concrete evidence you directly observed in the provided content. This means:
- You MUST quote the exact text, element, attribute, or pattern you observed that proves the issue exists.
- "Not verified", "could not confirm", "potentially", "may have", "appears to lack" = AUTOMATIC REJECTION. If you cannot verify it from the content, DO NOT include it.
- "Color contrast not verified" or "accessibility not tested" are NOT findings — they are admissions that you have no evidence. Never include them.
- Before flagging "missing X" (e.g., missing labels, missing alt text, missing ARIA), you MUST search the provided content for X. If you find <label htmlFor="...">, for="...", aria-label, aria-labelledby, or equivalent — the element IS labeled. Do not flag it.
- If you cannot point to a specific quoted excerpt or HTML pattern that proves the issue, the finding does not exist. Period.

CRITICAL — JAVASCRIPT-RENDERED CONTENT LIMITATION:
The text content was captured from a single page load. Dynamic/JS-rendered elements such as rotating headlines, carousels, animated text swaps, tabbed content, and accordion sections may only show ONE state. If you see a headline or content block, it may be one of several rotating variants. NEVER judge a site's full messaging strategy based on a single captured headline — it may cycle between multiple messages. If the captured H1 seems incomplete or fragmented, consider that it may be mid-rotation. Focus on the overall site messaging across ALL pages rather than anchoring critique on a single headline snapshot.

CRITICAL — YOU ARE ANALYZING TEXT CONTENT, NOT RAW HTML/CSS:
The content provided is extracted text, NOT raw HTML source code. This means:
- You CANNOT see CSS styles, classes, media queries, focus states, animations, or visual styling. NEVER flag issues about CSS you haven't seen (focus indicators, line-height, font-size, touch target sizes, color contrast, responsive breakpoints).
- You CANNOT see HTML attributes like lang, aria-*, role, autocomplete, htmlFor, type, etc. NEVER flag "missing" HTML attributes — you simply don't have that data.
- You CANNOT see structured data (JSON-LD, microdata, Schema.org). NEVER flag "missing structured data" — it may exist in the <head> which was stripped during text extraction.
- You CANNOT see meta tags, OG tags, Twitter cards, canonical URLs. NEVER flag missing meta tags unless you can see ALL the <head> content (you can't).
- You CANNOT verify JavaScript behavior (form validation, error messages, loading states, success states, interactive components). NEVER flag "form lacks error feedback" or "no success state after submission" — you can't see client-side behavior.
- You CANNOT test mobile responsiveness, keyboard navigation, screen reader behavior, or touch interactions. NEVER flag these as issues.
- "The provided content does not show X" is NOT evidence that X is missing. It means you can't see it. THESE ARE DIFFERENT THINGS. Never conflate them.
If an issue depends on seeing CSS, HTML attributes, JavaScript behavior, or visual rendering that you cannot access from text content — DO NOT INCLUDE IT.

THIRD-PARTY & INFRASTRUCTURE EXCLUSION:
Never flag issues caused by services the site owner does not control:
- CDN behaviors (Cloudflare email obfuscation, Cloudflare challenge pages, Cloudflare-injected scripts, edge caching headers)
- Hosting platform artifacts (Vercel, Netlify, AWS deployment markers, server headers)
- Third-party widget behavior (chat widgets, analytics scripts, cookie consent banners from third-party providers)
- Email protection/obfuscation by security services (e.g., [email protected] links rewritten by Cloudflare)
- DNS-level redirects, SSL certificate details, CDN-specific response headers
These are infrastructure decisions, not UX issues. The site owner often cannot change them. NEVER include them.

SUBJECTIVE OPINION FILTER:
Design preferences are NOT UX failures. Do not flag:
- "Visual hierarchy could be stronger" without evidence of user confusion or missed content
- "Color palette feels [adjective]" — subjective color opinions are not findings
- "Font size could be larger" when the font meets readability standards (≥16px body)
- "Layout is too [simple/complex/minimal/busy]" without evidence of user impact
- "Content tone is too [formal/casual/corporate/friendly]" when tone is consistent and appropriate for the audience
- Aesthetic preferences disguised as UX recommendations (e.g., "hero section would benefit from more visual interest")
A finding must describe a FUNCTIONAL problem — something that causes users to fail, abandon, misunderstand, or feel unsafe. "I would design it differently" is not a finding.

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
- Privacy policy "tone" or legal page writing style — these serve legal purposes, not UX purposes. A friendly privacy policy intro is a GOOD thing, not a finding.
- Identical or near-identical issues on login vs register pages — these are ONE finding, not two
- "Missing structured data" when you cannot see the HTML <head> — JSON-LD is invisible in text extractions
- "Missing focus indicators" or "missing focus states" — you cannot see CSS from text content
- "Missing form validation" or "missing error messages" — you cannot see JavaScript behavior from text
- "Missing responsive design" or "touch target too small" — you cannot verify this from text
- "Missing lang attribute" — you cannot see HTML attributes from text content
- "Missing meta tags" or "missing OG tags" — you cannot see <head> content from text extraction

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
1. EVIDENCE-BACKED — You MUST quote the specific text, element, or HTML pattern that proves this issue exists. A finding without a direct quote or concrete reference is not a finding. "The hero section..." must include WHAT about the hero section, with quoted text.
2. IMPACTFUL — Explain WHY this matters in business terms (lost conversions, user drop-off, trust erosion). If you cannot articulate a concrete user impact beyond "best practice says so," reconsider whether this is worth including.
3. FIXABLE — Give a concrete, implementable recommendation. Not "improve your CTA" but "Change the CTA from 'Submit' to 'Get My Free Report' — action-oriented language increases click-through by 20-30%."
4. DEEP — Go beyond what a basic tool would catch. Show the insight of a $200/hour consultant.
5. VERIFIED — Before including ANY finding about "missing" content, confirm it's not on another page. If the site has an About page, don't flag missing team info. If it has a Pricing page, don't flag missing pricing. If it has an FAQ page, don't flag missing FAQ. A senior consultant would check the WHOLE site, not just one page.
6. NOT SPECULATIVE — If your finding title or description contains words like "not verified," "unclear whether," "may not," "potentially," "could lack," or "appears to be missing" — DELETE IT. Either you have evidence or you don't. There is no middle ground.

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

CRITICAL — NO DUPLICATE FINDINGS (STRICTLY ENFORCED):
Each finding must be UNIQUE. Do NOT report an issue if it is essentially the same problem phrased differently. This is the #1 quality issue in audits — duplicates destroy client trust.
SPECIFIC RULES:
- "Login page lacks X" and "Register page lacks X" are the SAME finding — report it ONCE covering both pages.
- "FAQ lacks visual hierarchy" should be one finding, not repeated for each sub-aspect.
- If a problem spans multiple pages, combine it into ONE finding and list all affected pages.
- Issues caused by the same root cause are ONE finding.
- "Form lacks X" on login + register + contact = ONE finding about forms, not three.
- An issue about "headline/H1 messaging" is ONE finding — not three separate findings about "headline clarity", "value proposition", and "non-technical audience messaging" if they all refer to the same headline.
- "Free offer is ambiguous" and "free offer creates false urgency" are the SAME finding.
- "Consent checkbox framing" and "consent checkbox opt-out language" are the SAME finding.
- "Contact form lacks success state", "contact form lacks confirmation", and "contact form feedback" are the SAME finding.
- "Missing structured data" should be ONE finding that covers all missing schemas (Organization, FAQ, Product, Breadcrumb) — not separate findings for each schema type.
Before adding a finding, ask yourself: "Is this the same underlying problem as something I already listed, just from a different angle?" If yes, DO NOT add it.

FINAL SELF-CHECK — Before returning your findings, review each one against these gates:
1. Does this finding quote specific evidence from the provided content? If no → DELETE.
2. Is this about something the site owner can actually control? If no → DELETE.
3. Could I verify this claim is true from the content provided? If no → DELETE.
4. Is this a real functional problem, or just my design preference? If preference → DELETE.
5. Is this essentially the same issue as another finding? If yes → MERGE.
6. Would a paying client consider this finding worth their time and money to fix? If no → DELETE.

QUANTITY GUIDELINES (HARD LIMITS):
- Include 1-3 UNIQUE findings per category. MAXIMUM 3. NEVER more than 3.
- It's OK to report only 1 finding or even 0 findings if the site excels in this category.
- Every finding must be genuinely worth the client's attention and effort to fix.
- If you can't find real issues, return an EMPTY array []. This is far better than inventing problems.
- NEVER repeat the same finding with slight rewording. Each finding must address a DISTINCT issue.
- A 25-page site with strong design should produce 15-25 total findings across all categories, not 50+.

${pageContent.includes('PREVIOUS FINDINGS') ? `RE-AUDIT CONSISTENCY:
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
        temperature: 0,
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
      .filter((f) => !isSpeculativeFinding(f))
      .map((f) => ({ ...f, targetElement: f.targetElement || null, pageUrl: f.pageUrl || null }))
  } catch (err) {
    console.error(`[analyzeCategory] Error for "${category}":`, err instanceof Error ? err.message : err)
    // Return empty — don't throw. One category failing shouldn't kill the audit.
    return []
  }
}

/**
 * Run full analysis across UX categories in parallel batches.
 * Processes categories one at a time to avoid rate limits.
 * Skips Brand Consistency (20-23) unless brand identity files are attached.
 * Respects selected_modules if provided.
 */
export async function runFullAnalysis(
  pageContent: string,
  audit: Audit,
  userFocus?: string | null,
  language: string = 'en',
  depthMode: 'deep' | 'baseline' = 'deep',
): Promise<AnalysisFinding[]> {
  const allFindings: AnalysisFinding[] = []

  // Module slug → category index ranges
  const MODULE_RANGES: Record<string, [number, number]> = {
    foundation: [0, 4],
    human_experience: [4, 8],
    inclusive_design: [8, 12],
    future_readiness: [12, 16],
    seo_structure: [16, 20],
    brand_consistency: [20, 24],
  }

  // Determine which categories to analyze
  const selectedModules: string[] | null = (audit as any).selected_modules ?? null
  const hasBrandIdentity = !!(audit as any).brand_identity_id

  function shouldAnalyze(categoryIndex: number): boolean {
    // Brand Consistency (20-23) requires brand identity files
    if (categoryIndex >= 20 && categoryIndex < 24 && !hasBrandIdentity) return false

    // If selected_modules specified, only analyze those modules
    if (selectedModules && selectedModules.length > 0) {
      for (const mod of selectedModules) {
        const range = MODULE_RANGES[mod]
        if (range && categoryIndex >= range[0] && categoryIndex < range[1]) return true
      }
      return false
    }

    return true
  }

  // Process categories ONE AT A TIME to avoid rate limits and memory issues
  const categoriesToAnalyze = UX_CATEGORIES.filter((_, i) => shouldAnalyze(i))
  console.log(`[runFullAnalysis] Analyzing ${categoriesToAnalyze.length}/${UX_CATEGORIES.length} categories`)

  for (let ci = 0; ci < categoriesToAnalyze.length; ci++) {
    const category = categoriesToAnalyze[ci]
    console.log(`[runFullAnalysis] Category ${ci + 1}/${categoriesToAnalyze.length}: ${category.name}`)

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

    allFindings.push(...findings)

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

    // Calculate pillar averages and overall from deterministic category scores
    const pillarAvg = (start: number, end: number) => {
      const cats = categoryScores.slice(start, Math.min(end, categoryScores.length))
      return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
    }
    const allScores = categoryScores.map(c => c.score)
    const overallScore = allScores.length > 0
      ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length)
      : prev.previousOverallScore

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
      executiveSummary,
      keyRecommendation: topRecs[0] || getDefaultRecommendation(language),
      topRecommendations: topRecs.length > 0 ? topRecs : [getDefaultRecommendation(language)],
      overallScore,
      uxScore: pillarAvg(0, 4),
      conversionScore: pillarAvg(4, 8),
      mobileScore: pillarAvg(8, 12),
      aiDiscoverabilityScore: pillarAvg(12, 16),
      contentScore: overallScore,
      categoryScores,
    }
  }

  // ════════════════════════════════════════════════════════════════
  // DEEP MODE — Full AI analysis for scoring and executive summary
  // ════════════════════════════════════════════════════════════════
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
  const allTranslatedNames = getCategoryNames(language)

  // Only ask the AI to score categories that were actually analyzed
  // Brand Consistency (20-23) is excluded when no brand identity is attached
  const hasBrandIdentity = !!(auditData as any).brand_identity_id
  const selectedModules: string[] | null = (auditData as any).selected_modules ?? null
  const MODULE_RANGES: Record<string, [number, number]> = {
    foundation: [0, 4], human_experience: [4, 8], inclusive_design: [8, 12],
    future_readiness: [12, 16], seo_structure: [16, 20], brand_consistency: [20, 24],
  }
  function wasAnalyzed(idx: number): boolean {
    if (idx >= 20 && idx < 24 && !hasBrandIdentity) return false
    if (selectedModules && selectedModules.length > 0) {
      for (const mod of selectedModules) {
        const r = MODULE_RANGES[mod]
        if (r && idx >= r[0] && idx < r[1]) return true
      }
      return false
    }
    return true
  }
  const translatedNames = allTranslatedNames.filter((_, i) => wasAnalyzed(i))

  const categoryList = translatedNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
  const summaryExamples = [
    'Strong visual hierarchy but hero CTA lacks contrast on mobile viewports.',
    'Clear value proposition with specific proof points. Differentiation could be stronger.',
    'Well-structured navigation with descriptive labels. Footer could include more utility links.',
    'Content is scannable with good subheadings. Some paragraphs exceed recommended length.',
  ]
  const categoryExamples = translatedNames.map((name, i) => {
    const scores = [75, 68, 72, 65, 80, 74, 60, 70, 55, 62, 48, 65, 58, 72, 66, 45, 70, 63, 77, 52, 74, 67, 71, 59]
    return `    { "name": "${name}", "score": ${scores[i % scores.length]}, "summary": "${summaryExamples[i % summaryExamples.length]}" }`
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
- Cover findings across all audit modules analysed (Foundation, Human Experience, Inclusive Design, Future Readiness, plus SEO Structure and Brand Consistency if included) — show the breadth of the analysis
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

For CATEGORY SUMMARIES (REQUIRED — do NOT leave empty):
- Each categoryScores entry MUST have a "summary" field with 1-2 sentences
- The summary should describe what was good AND what needs improvement in that category
- Be specific: reference actual content, elements, or patterns from the site
- Example: "Strong visual hierarchy with clear CTA placement. Hero section lacks contrast on mobile viewports."
- 0-19: Severely broken

For CATEGORY SCORES:
Provide a score (0-100) and a one-sentence summary for each of the following ${translatedNames.length} categories.
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
- For unchanged content, scores should be IDENTICAL or within 3-5 points of the previous score.
- Score a category HIGHER only if you can identify a specific improvement in the content.
- Score a category LOWER only if you can identify a specific, concrete regression.
- Random variation of more than 5 points on unchanged content is UNACCEPTABLE — it destroys user trust.
- In the executive summary, note what changed vs what stayed the same.
- When in doubt, use the SAME score as the previous audit for that category.

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
}
${language !== 'en' ? `\nFINAL REMINDER — LANGUAGE: The executiveSummary, topRecommendations, and all category summary fields MUST be written entirely in ${getLanguageLabel(language)}. The JSON keys and category names stay as provided above, but all descriptive text must be in ${getLanguageLabel(language)}.\n` : ''}`

  try {
    const anthropic = getAnthropicClient()
    const message = await withTimeout(
      anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        temperature: 0,
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

    // Parse category scores from AI and map back to global 24-category positions
    // The AI only scored the categories we asked about (which may be < 24)
    // We need to rebuild the full array with correct global positions
    const aiCategoryScores = Array.isArray(report.categoryScores)
      ? report.categoryScores.map((c: any) => ({
          name: c.name || 'Unknown',
          score: clampScore(c.score),
          summary: c.summary || '',
        }))
      : []

    // Map AI scores back to the full category array by matching names
    const allCategoryNames = getCategoryNames(language)
    const categoryScores: CategoryScore[] = []
    for (let gi = 0; gi < allCategoryNames.length; gi++) {
      if (!wasAnalyzed(gi)) continue // skip unanalyzed categories
      const globalName = allCategoryNames[gi]
      // Find the matching AI score by name (fuzzy match by position if names differ)
      const aiIdx = categoryScores.length // position in the analyzed subset
      const matched = aiCategoryScores.find((c: any) =>
        c.name.toLowerCase() === globalName.toLowerCase()
      ) || aiCategoryScores[aiIdx] // fallback to positional match
      categoryScores.push({
        name: globalName,
        score: matched ? clampScore(matched.score) : 70,
        summary: matched?.summary || '',
      })
    }

    // If AI returned nothing useful, use defaults for analyzed categories
    if (categoryScores.length === 0) {
      for (let gi = 0; gi < allCategoryNames.length; gi++) {
        if (wasAnalyzed(gi)) categoryScores.push({ name: allCategoryNames[gi], score: 70, summary: '' })
      }
    }

    // CALCULATE scores from category data — don't trust AI's arbitrary top-level numbers
    // Modules: Foundation (0-3), Human Experience (4-7), Inclusive Design (8-11),
    //          Future Readiness (12-15), SEO Structure (16-19), Brand Consistency (20-23)
    // Pillar averages use the categoryScores which only contain analyzed categories
    const pillarAvg = (start: number, end: number) => {
      const cats = categoryScores.filter((c) => {
        const idx = allCategoryNames.indexOf(c.name)
        return idx >= start && idx < end
      })
      return cats.length > 0 ? Math.round(cats.reduce((s, c) => s + c.score, 0) / cats.length) : 50
    }

    const calculatedUx = pillarAvg(0, 4)           // Foundation
    const calculatedConversion = pillarAvg(4, 8)    // Human Experience
    const calculatedInclusive = pillarAvg(8, 12)    // Inclusive Design
    const calculatedFuture = pillarAvg(12, 16)      // Future Readiness
    // SEO (16-19) and Brand (20-23) feed into overall but don't have dedicated legacy score columns

    // Overall = average of ALL analyzed category scores
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
      return { name, score: 75, summary: 'No specific issues identified in this category.' }
    }
    let score = 85
    for (const f of catFindings) {
      score -= severityPenalty[f.severity] || 5
    }
    // Generate a basic summary from findings
    const topFinding = catFindings[0]
    const summary = catFindings.length === 1
      ? `1 issue found: ${topFinding.title}.`
      : `${catFindings.length} issues found. Top priority: ${topFinding.title}.`
    return { name, score: Math.max(0, Math.min(100, Math.round(score))), summary }
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
    keyRecommendation: topRecs[0] || getDefaultRecommendation(language),
    topRecommendations: topRecs.length > 0 ? topRecs : [getDefaultRecommendation(language)],
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
