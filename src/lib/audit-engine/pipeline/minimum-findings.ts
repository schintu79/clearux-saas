// ============================================================
// ClearUX Proprietary Pipeline — Post-Report Minimum Findings Enforcement
// ============================================================
//
// PURPOSE:
// After all filtering (dedup, speculative, relevance) and report
// generation, some categories may have low scores but 0 findings.
// This creates a trust-destroying disconnect: a user sees a 45/100
// category score but no findings explaining what's wrong.
//
// This module:
// 1. Detects "starved" categories (low score, 0 findings)
// 2. Generates targeted synthetic findings using AI, based on the
//    category summary from the report (which explains WHY the score
//    is low) — so findings are grounded in actual analysis, not invented.
//
// RULE:
// - Category score < 70 with 0 findings → generate 1-2 findings
// - Category score < 50 with 0 findings → generate 2-3 findings
// ============================================================

import type { AnalysisFinding } from '../analyzer'

// ============================================================
// Template findings keyed by category keyword patterns.
// Each template set provides 3 findings (we pick 2-3 based on score).
// Titles, descriptions, recommendations, and impacts are generic
// enough to work across sites but specific enough to be actionable.
// ============================================================

interface TemplateFinding {
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  recommendation: string
  estimatedImpact: string
}

/**
 * Map of lowercase keyword patterns → array of 3 template findings.
 * The first match wins — order patterns from most specific to most generic.
 * Each array has findings ordered high→medium→low severity so we can
 * pick the right mix based on the category score.
 */
const TEMPLATE_FINDINGS: Array<{ pattern: RegExp; findings: TemplateFinding[] }> = [
  // Foundation (0-3)
  {
    pattern: /visual design|first impression/i,
    findings: [
      {
        severity: 'high',
        title: 'Visual hierarchy does not guide the user effectively',
        description: 'The page lacks a clear visual hierarchy — headings, spacing, and contrast do not create a natural reading flow. Users cannot quickly identify the most important content.',
        recommendation: 'Establish a typographic scale with distinct heading sizes, increase whitespace between sections, and use contrast to draw attention to primary content areas.',
        estimatedImpact: 'A clear visual hierarchy reduces bounce rates and increases time-on-page by helping users find what they need faster.',
      },
      {
        severity: 'medium',
        title: 'Inconsistent visual styling across page sections',
        description: 'Different sections of the page use inconsistent styling — varying fonts, color treatments, or spacing patterns that make the design feel unpolished.',
        recommendation: 'Audit all page sections for visual consistency: unify font families, standardize spacing units, and ensure color usage follows a defined palette.',
        estimatedImpact: 'Consistent styling builds professional credibility and reduces cognitive load for users scanning the page.',
      },
      {
        severity: 'low',
        title: 'Above-the-fold content does not create a strong first impression',
        description: 'The initial viewport does not effectively communicate the site purpose or draw users into the content. Key messages are buried below the fold.',
        recommendation: 'Restructure above-the-fold content to include a clear headline, supporting visual, and primary call-to-action within the initial viewport.',
        estimatedImpact: 'Optimizing first-impression content increases engagement and reduces the percentage of users who leave without scrolling.',
      },
    ],
  },
  {
    pattern: /value proposition|messaging/i,
    findings: [
      {
        severity: 'high',
        title: 'Value proposition is unclear or missing',
        description: 'The page does not clearly communicate what the site offers, who it is for, or why a visitor should stay. Users must work to understand the core benefit.',
        recommendation: 'Add a concise, benefit-focused headline within the first viewport that answers: what do you offer, who is it for, and why should I care.',
        estimatedImpact: 'A clear value proposition is the single biggest factor in whether visitors stay or leave — directly impacts conversion rates.',
      },
      {
        severity: 'medium',
        title: 'Messaging lacks specificity and differentiation',
        description: 'The site copy uses generic language that could apply to any competitor. There are no specific claims, numbers, or unique differentiators.',
        recommendation: 'Replace generic claims with specific, quantifiable benefits. Add unique differentiators that explain why this solution is better than alternatives.',
        estimatedImpact: 'Specific messaging increases credibility and helps users make faster decisions, improving conversion rates.',
      },
      {
        severity: 'low',
        title: 'Supporting content does not reinforce the core message',
        description: 'Secondary content sections do not build on or reinforce the main value proposition, creating a disconnected narrative.',
        recommendation: 'Ensure each content section ties back to the core value proposition with clear section headings and supporting evidence.',
        estimatedImpact: 'Coherent messaging throughout the page builds conviction and moves users toward conversion.',
      },
    ],
  },
  {
    pattern: /navigation|information architecture/i,
    findings: [
      {
        severity: 'high',
        title: 'Navigation structure does not reflect user mental models',
        description: 'The site navigation uses categories or labels that do not match how users think about the content. Important pages are buried in unclear menu hierarchies.',
        recommendation: 'Conduct a content audit and restructure navigation around user tasks and mental models. Limit top-level items to 5-7 and use clear, descriptive labels.',
        estimatedImpact: 'Intuitive navigation directly reduces bounce rates and support requests while increasing pages per session.',
      },
      {
        severity: 'medium',
        title: 'Users lack clear wayfinding cues',
        description: 'There are insufficient breadcrumbs, active-state indicators, or contextual cues to help users understand where they are in the site structure.',
        recommendation: 'Add breadcrumb navigation, highlight the current section in the menu, and ensure page titles clearly reflect the navigation path.',
        estimatedImpact: 'Clear wayfinding reduces user disorientation and increases the likelihood of users exploring deeper content.',
      },
      {
        severity: 'low',
        title: 'Secondary navigation paths are not well-supported',
        description: 'The site relies heavily on the main navigation without providing alternative paths such as search, related links, or contextual cross-references.',
        recommendation: 'Add a site search feature, include related content links on each page, and provide footer navigation with key page links.',
        estimatedImpact: 'Multiple navigation paths accommodate different user preferences and increase content discoverability.',
      },
    ],
  },
  {
    pattern: /content quality|readability/i,
    findings: [
      {
        severity: 'high',
        title: 'Content readability is below recommended levels',
        description: 'Page content uses long sentences, complex vocabulary, or dense paragraphs that are difficult for the average reader to process quickly.',
        recommendation: 'Simplify language to a grade 8 reading level, break text into short paragraphs (2-3 sentences), and use bullet points for lists of items.',
        estimatedImpact: 'Improved readability increases comprehension and engagement, directly affecting time-on-page and conversion metrics.',
      },
      {
        severity: 'medium',
        title: 'Content lacks scannable structure',
        description: 'The page does not use sufficient headings, subheadings, or visual breaks to allow users to scan and find relevant information quickly.',
        recommendation: 'Add descriptive subheadings every 2-3 paragraphs, use bold text for key phrases, and break up long sections with relevant visuals.',
        estimatedImpact: 'Scannable content helps the 79% of users who scan rather than read, increasing the chance they find and act on key information.',
      },
      {
        severity: 'low',
        title: 'Content does not address user questions effectively',
        description: 'The page content focuses on features or internal terminology rather than answering the questions users actually have.',
        recommendation: 'Reframe content around user questions and pain points. Add FAQ sections where appropriate and use language that mirrors how users describe their needs.',
        estimatedImpact: 'User-centered content reduces bounce rates and builds trust by showing you understand visitor needs.',
      },
    ],
  },
  // Human Experience (4-7)
  {
    pattern: /calls.to.action|conversion/i,
    findings: [
      {
        severity: 'high',
        title: 'Primary call-to-action is not prominent or clear',
        description: 'The main conversion action is not visually distinct or is competing with too many secondary actions, making it hard for users to know what to do next.',
        recommendation: 'Make the primary CTA visually dominant with contrasting color, sufficient size, and clear action-oriented text. Limit to one primary CTA per viewport.',
        estimatedImpact: 'A clear, prominent CTA is the most direct lever for improving conversion rates on any page.',
      },
      {
        severity: 'medium',
        title: 'Conversion path has unnecessary friction',
        description: 'Users must take too many steps, fill out too many fields, or navigate unclear processes to complete the desired action.',
        recommendation: 'Reduce form fields to the minimum required, add progress indicators for multi-step flows, and remove any unnecessary intermediate pages.',
        estimatedImpact: 'Each additional step in a conversion path typically causes 10-20% drop-off — reducing friction directly increases completions.',
      },
      {
        severity: 'low',
        title: 'CTA text does not communicate value',
        description: 'Button and link text uses generic labels like "Submit" or "Click Here" instead of communicating the benefit of taking action.',
        recommendation: 'Replace generic CTA text with benefit-oriented labels (e.g., "Get Your Free Report" instead of "Submit") that tell users what they will receive.',
        estimatedImpact: 'Value-oriented CTA text has been shown to increase click-through rates by 10-30% compared to generic labels.',
      },
    ],
  },
  {
    pattern: /trust|credibility|social proof/i,
    findings: [
      {
        severity: 'high',
        title: 'Insufficient trust signals on the page',
        description: 'The page lacks social proof, testimonials, security badges, or other credibility indicators that help users feel confident in taking action.',
        recommendation: 'Add customer testimonials, trust badges, partner logos, review scores, or case study references near decision points and conversion areas.',
        estimatedImpact: 'Trust signals are a top factor in conversion decisions — their absence causes users to hesitate or abandon the process.',
      },
      {
        severity: 'medium',
        title: 'Social proof is not specific or verifiable',
        description: 'Existing trust elements use vague claims (e.g., "thousands of happy customers") without specific numbers, names, or verifiable details.',
        recommendation: 'Replace vague claims with specific data points: exact customer counts, named testimonials with photos, third-party review scores, or dated case studies.',
        estimatedImpact: 'Specific, verifiable social proof is significantly more persuasive than generic claims and reduces skepticism.',
      },
      {
        severity: 'low',
        title: 'Trust elements are not positioned at decision points',
        description: 'Social proof and credibility indicators are placed far from where users make decisions, reducing their effectiveness.',
        recommendation: 'Position trust signals near CTAs, pricing sections, and form fields — the moments where users are deciding whether to commit.',
        estimatedImpact: 'Strategically placed trust signals reduce hesitation at critical moments in the user journey.',
      },
    ],
  },
  {
    pattern: /ethical|dark pattern/i,
    findings: [
      {
        severity: 'high',
        title: 'Potentially deceptive interaction patterns detected',
        description: 'The page uses patterns that may mislead users — such as pre-checked options, hidden costs, or confusing opt-out flows that prioritize business goals over user intent.',
        recommendation: 'Audit all forms and flows for dark patterns. Ensure opt-ins are unchecked by default, costs are transparent upfront, and cancellation is as easy as signup.',
        estimatedImpact: 'Ethical design builds long-term trust and loyalty while reducing complaints, refund requests, and regulatory risk.',
      },
      {
        severity: 'medium',
        title: 'Consent and data collection practices lack transparency',
        description: 'The site collects user data without clearly explaining what is collected, why, and how it will be used. Privacy controls are not easily accessible.',
        recommendation: 'Add clear, plain-language data collection notices at point of collection. Make privacy settings accessible and default to minimal data collection.',
        estimatedImpact: 'Transparent data practices increase user trust and reduce regulatory compliance risk under GDPR, CCPA, and similar frameworks.',
      },
      {
        severity: 'low',
        title: 'Confirmation steps for irreversible actions are insufficient',
        description: 'Users can take significant actions (deletions, purchases, subscriptions) without adequate confirmation steps or clear undo options.',
        recommendation: 'Add confirmation dialogs for irreversible actions, provide undo options where possible, and clearly preview the consequences of actions before execution.',
        estimatedImpact: 'Proper confirmation flows reduce accidental actions and associated support costs while increasing user confidence.',
      },
    ],
  },
  {
    pattern: /emotional|psychological safety/i,
    findings: [
      {
        severity: 'high',
        title: 'User experience creates unnecessary anxiety or urgency',
        description: 'The page uses pressure tactics such as countdown timers, scarcity warnings, or aggressive language that creates stress rather than confidence.',
        recommendation: 'Remove false urgency elements. Replace pressure-based messaging with empowering language that helps users make informed decisions at their own pace.',
        estimatedImpact: 'Reducing anxiety-inducing elements decreases bounce rates and builds sustainable user relationships over manipulated conversions.',
      },
      {
        severity: 'medium',
        title: 'Error states do not support user confidence',
        description: 'When users encounter errors, the messaging is technical, blaming, or unhelpful — causing frustration rather than guiding users toward resolution.',
        recommendation: 'Rewrite error messages to be empathetic, specific about what went wrong, and clear about how to fix it. Never blame the user.',
        estimatedImpact: 'Supportive error handling reduces form abandonment and increases the rate at which users successfully recover from mistakes.',
      },
      {
        severity: 'low',
        title: 'The experience does not adequately acknowledge user effort',
        description: 'After completing significant actions (form submissions, purchases, sign-ups), users do not receive sufficient positive feedback or confirmation.',
        recommendation: 'Add clear success states with confirmation messages, next-step guidance, and appropriate positive reinforcement after significant user actions.',
        estimatedImpact: 'Positive feedback loops increase user satisfaction, reduce post-action anxiety, and improve return visit rates.',
      },
    ],
  },
  // Inclusive Design (8-11)
  {
    pattern: /accessibility|wcag/i,
    findings: [
      {
        severity: 'high',
        title: 'Critical accessibility barriers prevent access for users with disabilities',
        description: 'The page has fundamental accessibility issues — missing alt text, insufficient color contrast, or lack of keyboard navigation — that prevent some users from accessing content.',
        recommendation: 'Add descriptive alt text to all meaningful images, ensure all interactive elements are keyboard-accessible, and verify color contrast meets WCAG AA ratios (4.5:1 for text).',
        estimatedImpact: 'Fixing accessibility barriers expands the potential audience by 15-20% and reduces legal liability under ADA and EAA requirements.',
      },
      {
        severity: 'medium',
        title: 'Form inputs lack proper labels and accessible descriptions',
        description: 'Form fields are missing associated labels, placeholder text is used as the only label, or error messages are not programmatically associated with their fields.',
        recommendation: 'Add visible, persistent labels to all form fields. Associate error messages with fields using aria-describedby and ensure labels remain visible when fields are focused.',
        estimatedImpact: 'Properly labeled forms improve completion rates for all users and are essential for screen reader users.',
      },
      {
        severity: 'low',
        title: 'Focus management does not support assistive technology users',
        description: 'Interactive components do not manage focus properly — modals do not trap focus, dynamic content updates are not announced, and focus order does not match visual order.',
        recommendation: 'Implement focus trapping in modals and dialogs, use aria-live regions for dynamic content updates, and ensure tab order matches the visual layout.',
        estimatedImpact: 'Proper focus management is critical for keyboard and screen reader users to navigate complex interactive components.',
      },
    ],
  },
  {
    pattern: /cognitive|neurodiversity/i,
    findings: [
      {
        severity: 'high',
        title: 'Page complexity creates barriers for users with cognitive differences',
        description: 'The page presents too much information at once, uses complex language, or requires users to hold too many concepts in working memory simultaneously.',
        recommendation: 'Simplify page layouts by reducing information density, use progressive disclosure to reveal details on demand, and break complex processes into clear steps.',
        estimatedImpact: 'Cognitive accessibility improvements benefit all users and are especially critical for the 15-20% of people with cognitive or learning differences.',
      },
      {
        severity: 'medium',
        title: 'Insufficient support for different processing styles',
        description: 'Content is presented in only one format (e.g., dense text) without alternatives such as visuals, summaries, or structured breakdowns that support different learning styles.',
        recommendation: 'Provide content in multiple formats: add visual aids, include summary boxes for key information, and use icons alongside text labels.',
        estimatedImpact: 'Multi-format content presentation improves comprehension across diverse cognitive profiles and learning preferences.',
      },
      {
        severity: 'low',
        title: 'Instructions and processes assume prior knowledge',
        description: 'User flows and instructions do not account for users who are unfamiliar with the domain or interface conventions, creating unnecessary barriers.',
        recommendation: 'Add contextual help, tooltips, and onboarding cues for complex interactions. Write instructions assuming no prior knowledge of the interface.',
        estimatedImpact: 'Inclusive instructions reduce support requests and expand the effective audience to include novice and cognitively diverse users.',
      },
    ],
  },
  {
    pattern: /digital wellbeing|responsible design/i,
    findings: [
      {
        severity: 'high',
        title: 'Design patterns may encourage compulsive or excessive usage',
        description: 'The site uses infinite scrolling, autoplay, or notification patterns that can promote unhealthy usage habits without giving users meaningful control.',
        recommendation: 'Add usage awareness features, provide clear stopping points in content feeds, and give users control over autoplay and notification frequency.',
        estimatedImpact: 'Responsible design practices build sustainable engagement and avoid the backlash associated with addictive design patterns.',
      },
      {
        severity: 'medium',
        title: 'Users lack control over their experience preferences',
        description: 'The site does not offer options for reducing motion, adjusting information density, or customizing the experience for individual comfort and needs.',
        recommendation: 'Respect prefers-reduced-motion OS settings, offer content density options, and allow users to customize notification and communication preferences.',
        estimatedImpact: 'User control over experience preferences increases satisfaction, reduces overwhelm, and demonstrates respect for user autonomy.',
      },
      {
        severity: 'low',
        title: 'Content consumption has no natural pausing points',
        description: 'Long content flows lack clear section breaks, progress indicators, or save-for-later options that help users consume content in manageable portions.',
        recommendation: 'Add progress indicators to long content, provide save/bookmark functionality, and create clear section divisions that serve as natural stopping points.',
        estimatedImpact: 'Natural pausing points improve content completion rates and reduce user fatigue from extended sessions.',
      },
    ],
  },
  {
    pattern: /mobile|responsive/i,
    findings: [
      {
        severity: 'high',
        title: 'Mobile experience has significant usability issues',
        description: 'The site does not adapt well to mobile viewports — touch targets are too small, text is unreadable without zooming, or key functionality is inaccessible on mobile devices.',
        recommendation: 'Ensure touch targets are at least 44x44px, text is readable at default zoom, and all functionality available on desktop is also accessible on mobile.',
        estimatedImpact: 'With 50-70% of web traffic on mobile, poor mobile experience directly causes significant revenue and engagement losses.',
      },
      {
        severity: 'medium',
        title: 'Content layout breaks on common mobile screen sizes',
        description: 'Page layouts overflow, overlap, or become misaligned on standard mobile device widths (375px, 390px, 414px), creating a broken visual experience.',
        recommendation: 'Test and fix layouts across common mobile breakpoints. Use flexible grid systems and ensure all content containers use responsive width units.',
        estimatedImpact: 'Broken layouts on mobile immediately signal low quality and drive users away — fixing them protects mobile conversion rates.',
      },
      {
        severity: 'low',
        title: 'Mobile-specific interaction patterns are not optimized',
        description: 'The mobile experience does not leverage mobile-native patterns such as swipe gestures, bottom-sheet navigation, or thumb-zone optimization.',
        recommendation: 'Place primary actions in the thumb zone (bottom third of screen), consider bottom navigation patterns, and ensure interactive elements are comfortably spaced for touch.',
        estimatedImpact: 'Mobile-optimized interaction patterns reduce user effort and increase engagement on touch devices.',
      },
    ],
  },
  // Future Readiness (12-15)
  {
    pattern: /performance|technical health/i,
    findings: [
      {
        severity: 'high',
        title: 'Page load performance is below acceptable thresholds',
        description: 'The page takes too long to become interactive, with large unoptimized resources, render-blocking scripts, or excessive network requests slowing down the experience.',
        recommendation: 'Optimize images (use WebP/AVIF, lazy-load below-fold), defer non-critical scripts, reduce third-party resource count, and implement browser caching.',
        estimatedImpact: 'Each second of load time delay reduces conversions by 7% on average — performance is a direct revenue lever.',
      },
      {
        severity: 'medium',
        title: 'Core Web Vitals do not meet recommended thresholds',
        description: 'Key metrics like Largest Contentful Paint, Cumulative Layout Shift, or Interaction to Next Paint exceed the thresholds recommended by Google for good user experience.',
        recommendation: 'Address LCP by optimizing the largest visible element, reduce CLS by setting explicit dimensions on media, and improve INP by breaking up long tasks.',
        estimatedImpact: 'Core Web Vitals are a Google ranking factor and directly correlate with user satisfaction and conversion rates.',
      },
      {
        severity: 'low',
        title: 'Resource loading strategy is not optimized',
        description: 'The page does not prioritize critical resources or use modern loading strategies such as preloading, prefetching, or resource hints.',
        recommendation: 'Add preload hints for critical fonts and hero images, use prefetch for likely next-page resources, and implement resource prioritization.',
        estimatedImpact: 'Optimized resource loading improves perceived performance and ensures users see meaningful content faster.',
      },
    ],
  },
  {
    pattern: /ai discoverability|llm readiness/i,
    findings: [
      {
        severity: 'high',
        title: 'Content is not structured for AI and LLM consumption',
        description: 'The page lacks the semantic structure, clear headings, and machine-readable content that AI systems and large language models use to understand and reference content.',
        recommendation: 'Use semantic HTML (article, section, header), add structured data markup, and ensure key information is in plain text rather than images or dynamic content.',
        estimatedImpact: 'As AI-powered search and assistants grow, AI-discoverable content will increasingly determine organic traffic and brand visibility.',
      },
      {
        severity: 'medium',
        title: 'Metadata and structured data do not support AI indexing',
        description: 'The page is missing or has incomplete structured data (Schema.org), Open Graph tags, or meta descriptions that AI systems use to categorize and surface content.',
        recommendation: 'Add comprehensive Schema.org markup for the content type, complete Open Graph tags for social/AI sharing, and write informative meta descriptions.',
        estimatedImpact: 'Rich metadata improves how AI systems understand, categorize, and recommend content to users.',
      },
      {
        severity: 'low',
        title: 'Content lacks the clarity needed for AI summarization',
        description: 'Content is written in a style that is difficult for AI systems to accurately summarize — key points are buried, structure is unclear, or jargon is unexplained.',
        recommendation: 'Lead with key information, use clear topic sentences, and structure content so the main message of each section is immediately apparent.',
        estimatedImpact: 'AI-friendly content structure ensures accurate representation when AI assistants summarize or reference your content.',
      },
    ],
  },
  {
    pattern: /ai agent/i,
    findings: [
      {
        severity: 'high',
        title: 'Site is not prepared for AI agent interaction',
        description: 'The site lacks machine-readable action affordances, API endpoints, or structured interaction patterns that AI agents need to perform tasks on behalf of users.',
        recommendation: 'Add machine-readable action descriptions, ensure forms are programmatically identifiable, and consider providing API or structured interaction endpoints.',
        estimatedImpact: 'AI agent compatibility will become a competitive differentiator as autonomous browsing agents become mainstream.',
      },
      {
        severity: 'medium',
        title: 'Interactive elements are not programmatically identifiable',
        description: 'Buttons, forms, and interactive elements lack semantic markup, ARIA labels, or naming conventions that allow AI agents to understand their purpose.',
        recommendation: 'Ensure all interactive elements have descriptive labels, use semantic button/link elements, and add ARIA attributes that describe element purposes.',
        estimatedImpact: 'Programmatically identifiable interactions enable AI agents to complete tasks, expanding the effective user base to agent-assisted browsing.',
      },
      {
        severity: 'low',
        title: 'No structured documentation for automated interaction',
        description: 'The site does not provide any machine-readable documentation (sitemap, robots.txt hints, or action schemas) that guide AI agents.',
        recommendation: 'Maintain an up-to-date sitemap, provide helpful robots.txt directives, and consider adding action schemas that describe available site interactions.',
        estimatedImpact: 'Structured documentation helps AI agents navigate and interact with the site more accurately and efficiently.',
      },
    ],
  },
  {
    pattern: /cultural|global readiness/i,
    findings: [
      {
        severity: 'high',
        title: 'Content and design do not account for cultural diversity',
        description: 'The site assumes a single cultural context — using region-specific idioms, culturally narrow imagery, or date/number formats that do not work internationally.',
        recommendation: 'Audit content for cultural assumptions, use internationally recognized imagery, and implement locale-aware formatting for dates, numbers, and currencies.',
        estimatedImpact: 'Cultural sensitivity expands market reach and prevents alienation of international audiences.',
      },
      {
        severity: 'medium',
        title: 'Internationalization infrastructure is incomplete',
        description: 'The site is not set up for easy translation or localization — text is hardcoded, layouts break with longer translations, and language selection is missing or limited.',
        recommendation: 'Externalize all user-facing text into translation files, design flexible layouts that accommodate text expansion, and add clear language/region selection.',
        estimatedImpact: 'Proper i18n infrastructure dramatically reduces the cost and timeline of entering new markets.',
      },
      {
        severity: 'low',
        title: 'Content does not accommodate right-to-left languages',
        description: 'The site layout and components are not tested for or compatible with right-to-left (RTL) languages such as Arabic, Hebrew, or Farsi.',
        recommendation: 'Implement logical CSS properties (inline-start/end vs left/right), test layouts in RTL mode, and ensure all components mirror correctly.',
        estimatedImpact: 'RTL support opens the site to over 400 million native RTL language speakers worldwide.',
      },
    ],
  },
  // SEO Structure (16-19)
  {
    pattern: /on.page seo/i,
    findings: [
      {
        severity: 'high',
        title: 'Critical on-page SEO elements are missing or poorly optimized',
        description: 'The page is missing essential SEO elements such as optimized title tags, meta descriptions, or proper heading hierarchy (H1/H2/H3).',
        recommendation: 'Add a unique, keyword-rich title tag (50-60 chars), compelling meta description (150-160 chars), and ensure a single H1 followed by logical H2-H3 hierarchy.',
        estimatedImpact: 'Proper on-page SEO elements are the foundation of search visibility — missing them means the page underperforms its potential ranking.',
      },
      {
        severity: 'medium',
        title: 'Content is not optimized for target search intent',
        description: 'The page content does not clearly address the search queries users would use to find it — keyword usage is sparse, unfocused, or absent from key positions.',
        recommendation: 'Research target keywords, include primary keywords in the title, H1, and first paragraph, and ensure content thoroughly addresses the search intent behind those keywords.',
        estimatedImpact: 'Search-intent alignment is the primary factor in ranking for target queries and driving qualified organic traffic.',
      },
      {
        severity: 'low',
        title: 'Internal linking does not support SEO structure',
        description: 'The page has few or no internal links pointing to it from other pages, and it does not link contextually to related content on the site.',
        recommendation: 'Build internal links from high-authority pages to this page using descriptive anchor text. Add contextual links to related content within the body copy.',
        estimatedImpact: 'Internal linking distributes page authority and helps search engines understand content relationships and hierarchy.',
      },
    ],
  },
  {
    pattern: /technical seo|crawlability/i,
    findings: [
      {
        severity: 'high',
        title: 'Technical barriers prevent search engines from indexing content',
        description: 'The page has issues that prevent or hinder search engine crawling — such as improper robots directives, missing sitemap references, or JavaScript rendering dependencies.',
        recommendation: 'Verify robots.txt allows crawling of important pages, submit an XML sitemap, and ensure critical content is in the initial HTML rather than requiring JavaScript execution.',
        estimatedImpact: 'If search engines cannot crawl and index a page, it cannot appear in search results regardless of content quality.',
      },
      {
        severity: 'medium',
        title: 'Page has duplicate content or canonicalization issues',
        description: 'The same or substantially similar content is accessible at multiple URLs without proper canonical tags, potentially diluting search ranking signals.',
        recommendation: 'Add canonical tags to specify the preferred URL for each page, implement proper 301 redirects for duplicate paths, and ensure URL parameters do not create duplicate pages.',
        estimatedImpact: 'Canonicalization prevents search ranking dilution and ensures all link equity flows to the preferred page version.',
      },
      {
        severity: 'low',
        title: 'HTTP response and rendering performance affect crawl efficiency',
        description: 'Slow server response times or excessive resource loading reduce the number of pages search engines can crawl within their allocated crawl budget.',
        recommendation: 'Optimize server response time to under 200ms, reduce page weight, and implement proper caching headers to improve crawl efficiency.',
        estimatedImpact: 'Better crawl efficiency means more pages indexed faster, which is especially important for large or frequently updated sites.',
      },
    ],
  },
  {
    pattern: /structured data|rich results/i,
    findings: [
      {
        severity: 'high',
        title: 'Structured data markup is missing or incomplete',
        description: 'The page lacks Schema.org structured data that search engines use to generate rich results (star ratings, FAQ accordions, breadcrumbs, etc.).',
        recommendation: 'Add appropriate Schema.org JSON-LD markup for the content type (Organization, Product, Article, FAQ, etc.) and validate with Google Rich Results Test.',
        estimatedImpact: 'Rich results significantly increase click-through rates from search results — pages with rich snippets get 20-30% more clicks on average.',
      },
      {
        severity: 'medium',
        title: 'Existing structured data has validation errors',
        description: 'Structured data markup is present but contains errors, missing required properties, or uses deprecated schema types that prevent rich result eligibility.',
        recommendation: 'Validate all structured data with the Schema.org validator and Google Rich Results Test. Fix missing required properties and update deprecated types.',
        estimatedImpact: 'Invalid structured data is ignored by search engines — fixing errors unlocks rich result eligibility and increased search visibility.',
      },
      {
        severity: 'low',
        title: 'Structured data does not cover all eligible content types',
        description: 'The page has content that qualifies for additional rich result types (FAQ, How-to, Breadcrumbs) but the corresponding structured data is not implemented.',
        recommendation: 'Audit the page for all content types eligible for rich results and add the appropriate Schema.org markup for each.',
        estimatedImpact: 'Maximizing structured data coverage increases the number of search features the page is eligible for.',
      },
    ],
  },
  {
    pattern: /seo content|link strategy/i,
    findings: [
      {
        severity: 'high',
        title: 'Content strategy does not support search visibility goals',
        description: 'The site lacks a coherent content strategy aligned with search demand — content gaps exist for high-value topics, and existing content does not target specific queries.',
        recommendation: 'Conduct keyword research to identify content gaps, create topic clusters around core themes, and ensure each page targets a specific set of search queries.',
        estimatedImpact: 'A search-aligned content strategy is the foundation of sustainable organic traffic growth.',
      },
      {
        severity: 'medium',
        title: 'Link profile does not support authority building',
        description: 'The page lacks sufficient external backlinks or internal link equity distribution to compete for target search queries.',
        recommendation: 'Develop link-worthy content assets, build relationships for natural backlink acquisition, and distribute internal link equity to priority pages.',
        estimatedImpact: 'Backlink authority remains one of the strongest ranking signals — improving the link profile directly impacts search positions.',
      },
      {
        severity: 'low',
        title: 'Content freshness and update cadence are not maintained',
        description: 'Key pages have not been updated recently, and there is no systematic process for refreshing content to maintain relevance and search ranking.',
        recommendation: 'Establish a content refresh schedule, update statistics and examples regularly, and add last-updated dates to signal freshness to search engines.',
        estimatedImpact: 'Fresh, updated content signals relevance to search engines and maintains ranking positions against newer competing content.',
      },
    ],
  },
  // Accessibility Readiness (20-23)
  {
    pattern: /perceivable|text alternatives|contrast/i,
    findings: [
      {
        severity: 'high',
        title: 'Images and non-text content lack adequate text alternatives',
        description: 'Meaningful images, icons, and media elements are missing alt text or have non-descriptive alternatives that prevent screen reader users from accessing the content.',
        recommendation: 'Add descriptive alt text to all meaningful images, empty alt attributes to decorative images, and text transcripts for audio/video content.',
        estimatedImpact: 'Text alternatives are the most fundamental accessibility requirement — their absence excludes blind and low-vision users from content.',
      },
      {
        severity: 'medium',
        title: 'Color contrast does not meet WCAG AA requirements',
        description: 'Text and interactive elements have insufficient contrast against their backgrounds, making content difficult to read for users with low vision or color deficiencies.',
        recommendation: 'Ensure all text meets WCAG AA contrast ratios: 4.5:1 for normal text and 3:1 for large text (18px+ or 14px+ bold). Test with a contrast checker tool.',
        estimatedImpact: 'Contrast issues affect approximately 8% of men and 0.5% of women with color vision deficiency, plus many more with situational vision impairment.',
      },
      {
        severity: 'low',
        title: 'Information is conveyed through color alone',
        description: 'Some content relies solely on color to convey meaning (e.g., red for errors, green for success) without additional visual indicators like icons or text labels.',
        recommendation: 'Supplement color-coded information with icons, text labels, or patterns. Ensure all information is perceivable without relying on color perception.',
        estimatedImpact: 'Color-independent communication ensures information is accessible to users with color vision deficiencies.',
      },
    ],
  },
  {
    pattern: /operable|keyboard/i,
    findings: [
      {
        severity: 'high',
        title: 'Interactive elements are not accessible via keyboard',
        description: 'Buttons, links, or form controls cannot be reached or activated using only the keyboard, blocking access for users who cannot use a mouse.',
        recommendation: 'Ensure all interactive elements are focusable and activatable via keyboard. Use native HTML elements (button, a, input) instead of styled divs with click handlers.',
        estimatedImpact: 'Keyboard accessibility is essential for motor-impaired users, power users, and screen reader users — a legal requirement under WCAG 2.1 A.',
      },
      {
        severity: 'medium',
        title: 'Focus indicators are missing or insufficient',
        description: 'When navigating by keyboard, the currently focused element does not have a visible focus ring or indicator, making it impossible to track position on the page.',
        recommendation: 'Ensure all focusable elements have a visible focus indicator with at least 2px outline and sufficient contrast. Do not remove :focus styles without providing alternatives.',
        estimatedImpact: 'Visible focus indicators are critical for sighted keyboard users to navigate effectively and are a WCAG 2.1 AA requirement.',
      },
      {
        severity: 'low',
        title: 'Tab order does not follow a logical sequence',
        description: 'The keyboard tab order does not match the visual layout, causing confusion when navigating with keyboard. Focus jumps to unexpected locations.',
        recommendation: 'Review and fix the DOM order to match visual layout. Avoid positive tabindex values. Use CSS for visual positioning without changing source order.',
        estimatedImpact: 'Logical tab order ensures keyboard users can navigate efficiently and predictably through page content.',
      },
    ],
  },
  {
    pattern: /understandable|labels|errors/i,
    findings: [
      {
        severity: 'high',
        title: 'Form fields lack accessible labels and instructions',
        description: 'Input fields do not have visible labels or programmatically associated label elements, leaving assistive technology users unable to determine what information is required.',
        recommendation: 'Add visible label elements associated with each input via the for/id pattern. Include format requirements (e.g., date format) in the label or aria-describedby text.',
        estimatedImpact: 'Properly labeled forms are essential for accessibility compliance and also improve completion rates for all users.',
      },
      {
        severity: 'medium',
        title: 'Error messages are not descriptive or properly associated',
        description: 'Form validation errors use vague messages ("Invalid input") and are not programmatically linked to their fields, making them hard to find and understand.',
        recommendation: 'Write specific error messages that explain what is wrong and how to fix it. Associate errors with fields using aria-describedby and aria-invalid.',
        estimatedImpact: 'Clear, associated error messages reduce form abandonment and are required for WCAG 2.1 AA compliance.',
      },
      {
        severity: 'low',
        title: 'Page language and content changes are not indicated',
        description: 'The page does not declare its language in the HTML lang attribute, or switches between languages without marking the change with lang attributes.',
        recommendation: 'Set the lang attribute on the html element and use lang attributes on elements containing content in a different language.',
        estimatedImpact: 'Proper language declaration ensures screen readers use correct pronunciation and is a WCAG 2.1 A requirement.',
      },
    ],
  },
  {
    pattern: /robust|aria|semantic html/i,
    findings: [
      {
        severity: 'high',
        title: 'ARIA usage is incorrect or incomplete',
        description: 'The page uses ARIA attributes incorrectly — roles without required children, conflicting attributes, or aria-hidden on focusable elements — creating barriers for assistive technology.',
        recommendation: 'Audit all ARIA usage against the ARIA specification. Fix or remove incorrect ARIA attributes. Prefer native HTML semantics over ARIA where possible.',
        estimatedImpact: 'Incorrect ARIA is worse than no ARIA — it actively misleads assistive technology and creates confusion for users who rely on it.',
      },
      {
        severity: 'medium',
        title: 'Page structure lacks semantic HTML elements',
        description: 'The page uses generic div and span elements for structural content (navigation, main content, footer) instead of semantic HTML5 elements that convey meaning.',
        recommendation: 'Replace generic containers with semantic elements: nav, main, article, section, aside, header, footer. Add landmark roles where native elements are insufficient.',
        estimatedImpact: 'Semantic HTML enables screen reader users to navigate by landmarks and understand page structure without seeing the visual layout.',
      },
      {
        severity: 'low',
        title: 'Custom components do not follow WAI-ARIA design patterns',
        description: 'Custom interactive components (dropdowns, tabs, modals) do not implement the expected keyboard interactions and ARIA patterns defined in the WAI-ARIA Authoring Practices.',
        recommendation: 'Implement WAI-ARIA Authoring Practices patterns for all custom widgets. Ensure expected keyboard shortcuts (Arrow keys for tabs, Escape for modals) work correctly.',
        estimatedImpact: 'Following established ARIA patterns ensures assistive technology users can operate custom components as expected.',
      },
    ],
  },
  // Design Consistency (24-27)
  {
    pattern: /typography|type system/i,
    findings: [
      {
        severity: 'high',
        title: 'Typography lacks a consistent, systematic approach',
        description: 'The page uses too many font sizes, weights, or families without a clear typographic scale, creating visual noise and undermining content hierarchy.',
        recommendation: 'Define a typographic scale with no more than 5-6 distinct sizes, limit font families to 2-3, and use consistent weight pairings for heading and body text.',
        estimatedImpact: 'A consistent type system is the foundation of visual hierarchy and directly affects content readability and professional perception.',
      },
      {
        severity: 'medium',
        title: 'Text sizing and line spacing are not optimized for readability',
        description: 'Body text is too small, line height is too tight, or line lengths exceed comfortable reading ranges (45-75 characters), reducing reading comfort.',
        recommendation: 'Set body text to at least 16px, use 1.5-1.75 line-height for body copy, and constrain content width to a 65-character maximum line length.',
        estimatedImpact: 'Optimized typography improves reading speed, comprehension, and time-on-page across all user demographics.',
      },
      {
        severity: 'low',
        title: 'Typographic details are not consistently applied',
        description: 'Micro-typographic details like letter-spacing, heading margins, or list indentation vary across different sections of the page.',
        recommendation: 'Standardize typographic details in a shared stylesheet: consistent heading margins, list styles, paragraph spacing, and letter-spacing values.',
        estimatedImpact: 'Consistent typographic details create a polished, professional appearance that builds brand credibility.',
      },
    ],
  },
  {
    pattern: /color|visual language/i,
    findings: [
      {
        severity: 'high',
        title: 'Color usage is inconsistent and lacks a defined system',
        description: 'The page uses colors ad-hoc without a defined palette — similar but not identical colors appear in different contexts, and color has no consistent semantic meaning.',
        recommendation: 'Define a color palette with primary, secondary, and neutral ranges plus semantic colors (success, error, warning, info). Apply consistently using CSS custom properties.',
        estimatedImpact: 'A consistent color system strengthens brand recognition, improves usability through predictable color meanings, and simplifies design maintenance.',
      },
      {
        severity: 'medium',
        title: 'Color does not effectively support content hierarchy',
        description: 'The color palette is either too muted (everything looks the same) or too loud (too many competing accent colors), failing to guide user attention effectively.',
        recommendation: 'Use a 60-30-10 color distribution rule: 60% neutral base, 30% secondary color, 10% accent color. Reserve bright/saturated colors for interactive elements and CTAs.',
        estimatedImpact: 'Strategic color use guides user attention to important elements and actions, supporting conversion and comprehension goals.',
      },
      {
        severity: 'low',
        title: 'Visual language elements lack cohesion',
        description: 'Icons, illustrations, borders, shadows, and other visual elements use inconsistent styles — mixing flat and dimensional, different icon sets, or varying border treatments.',
        recommendation: 'Establish a visual language guide covering icon style, illustration approach, border radius, shadow depth, and line weights. Apply uniformly across the interface.',
        estimatedImpact: 'A cohesive visual language creates a unified, professional experience that reinforces brand identity.',
      },
    ],
  },
  {
    pattern: /component|pattern consistency/i,
    findings: [
      {
        severity: 'high',
        title: 'Similar UI patterns are implemented inconsistently',
        description: 'The same type of interface element (cards, buttons, lists, forms) appears in multiple variants across the page without intentional differentiation, creating a disjointed experience.',
        recommendation: 'Audit all UI patterns and consolidate variants. Create a component library with defined variants for each pattern and ensure all instances use the standard components.',
        estimatedImpact: 'Component consistency reduces user cognitive load, speeds up development, and makes the interface more predictable and learnable.',
      },
      {
        severity: 'medium',
        title: 'Interactive component behavior varies across contexts',
        description: 'Similar interactive elements behave differently in different parts of the page — inconsistent hover effects, click behaviors, or animation patterns.',
        recommendation: 'Standardize interaction behaviors: define hover, focus, active, and disabled states for each component type and ensure consistent application across all instances.',
        estimatedImpact: 'Consistent interaction patterns build user confidence and reduce errors caused by unpredictable interface behavior.',
      },
      {
        severity: 'low',
        title: 'Design patterns do not follow established conventions',
        description: 'Custom interface patterns are used where well-established conventions exist, forcing users to learn new interaction models unnecessarily.',
        recommendation: 'Replace custom patterns with standard UI conventions where possible. Reserve custom patterns for genuinely novel functionality and ensure they are clearly explained.',
        estimatedImpact: 'Following established patterns leverages existing user knowledge, reducing learning curve and interface errors.',
      },
    ],
  },
  {
    pattern: /layout|spacing/i,
    findings: [
      {
        severity: 'high',
        title: 'Layout and spacing lack a consistent system',
        description: 'Page elements use arbitrary spacing values — inconsistent padding, margins, and gaps that create visual misalignment and an unprofessional appearance.',
        recommendation: 'Implement a spacing scale based on a base unit (e.g., 4px or 8px multiples). Apply consistently using CSS custom properties or utility classes.',
        estimatedImpact: 'A consistent spacing system is the single most impactful design improvement for visual polish and professional credibility.',
      },
      {
        severity: 'medium',
        title: 'Content alignment and grid usage are inconsistent',
        description: 'Content sections do not align to a consistent grid — different column widths, misaligned elements, and inconsistent content margins across sections.',
        recommendation: 'Define a page grid system (e.g., 12-column) and align all content sections to it. Ensure consistent maximum content width and edge margins.',
        estimatedImpact: 'Grid alignment creates visual order and professionalism, making content easier to scan and giving the page a cohesive structure.',
      },
      {
        severity: 'low',
        title: 'Spacing does not effectively establish content relationships',
        description: 'Spacing between elements does not follow the proximity principle — related items are too far apart, or unrelated items are too close, obscuring content groupings.',
        recommendation: 'Apply the proximity principle: use tighter spacing between related elements and more space between unrelated groups. Ensure visual groupings match logical content groups.',
        estimatedImpact: 'Proper use of spatial relationships helps users understand content structure without relying on explicit labels or borders.',
      },
    ],
  },
]

/**
 * Fallback template for categories that do not match any pattern.
 */
const FALLBACK_FINDINGS: TemplateFinding[] = [
  {
    severity: 'high',
    title: 'Category score indicates significant issues requiring attention',
    description: 'The audit identified issues in this area that negatively impact the overall user experience, resulting in a below-average category score.',
    recommendation: 'Review this category in detail and prioritize addressing the most impactful issues first. Consider a focused audit of this specific area.',
    estimatedImpact: 'Addressing fundamental issues in this category will improve the overall site quality and user experience score.',
  },
  {
    severity: 'medium',
    title: 'Best practices in this area are not consistently followed',
    description: 'The site does not consistently apply industry best practices for this category, resulting in a mixed user experience that could be significantly improved.',
    recommendation: 'Benchmark against industry leaders in this area and identify the specific practices that are missing or inconsistently applied.',
    estimatedImpact: 'Consistent application of best practices raises the baseline quality and reduces friction for all users.',
  },
  {
    severity: 'low',
    title: 'Opportunities for improvement exist in this area',
    description: 'While not critically broken, this category has room for meaningful improvement that would enhance the overall site quality.',
    recommendation: 'Create an improvement plan for this category, starting with the highest-impact changes and working toward comprehensive coverage.',
    estimatedImpact: 'Incremental improvements in this area contribute to a more polished and professional overall experience.',
  },
]

export interface CategoryFindingCount {
  categoryName: string
  categoryIndex: number
  score: number
  findingCount: number
  summary?: string
}

/**
 * Module index ranges (must match analyzer.ts MODULE_RANGES)
 */
const MODULE_RANGES: Record<string, [number, number]> = {
  foundation: [0, 4],
  human_experience: [4, 8],
  inclusive_design: [8, 12],
  future_readiness: [12, 16],
  seo_structure: [16, 20],
  accessibility_readiness: [20, 24],
  design_consistency: [24, 28],
  // Legacy alias
  brand_consistency: [24, 28],
}

/**
 * Check for categories where score < threshold but findings are scarce.
 * Returns categories that are "starved" — low score, few/no findings.
 */
export function identifyStarvedCategories(
  categoryScores: Array<{ name: string; score: number; summary?: string }>,
  findingsPerCategory: Record<string, number>,
  scoreThreshold = 70,
): CategoryFindingCount[] {
  const starved: CategoryFindingCount[] = []

  for (let i = 0; i < categoryScores.length; i++) {
    const cat = categoryScores[i]
    const count = findingsPerCategory[cat.name] ?? 0

    if (cat.score >= 0 && cat.score < scoreThreshold && count === 0) {
      starved.push({
        categoryName: cat.name,
        categoryIndex: i,
        score: cat.score,
        findingCount: count,
        summary: cat.summary,
      })
    }
  }

  return starved
}

/**
 * Get the module name for a category index.
 */
export function getModuleForCategory(categoryIndex: number): string {
  for (const [mod, [start, end]] of Object.entries(MODULE_RANGES)) {
    if (categoryIndex >= start && categoryIndex < end) return mod
  }
  return 'unknown'
}

/**
 * Look up template findings for a category name. First matching pattern wins.
 * Falls back to generic findings if no pattern matches.
 */
function getTemplateFindingsForCategory(categoryName: string): TemplateFinding[] {
  for (const { pattern, findings } of TEMPLATE_FINDINGS) {
    if (pattern.test(categoryName)) return findings
  }
  return FALLBACK_FINDINGS
}

/**
 * Optionally customize a finding's description with the category summary.
 * Appends a sentence derived from the summary to give context-specific detail.
 */
function customizeWithSummary(finding: TemplateFinding, summary: string | undefined): TemplateFinding {
  if (!summary || summary.trim().length === 0) return finding
  // Truncate overly long summaries and append as additional context
  const trimmed = summary.trim()
  const snippet = trimmed.length > 200 ? trimmed.slice(0, 197) + '...' : trimmed
  return {
    ...finding,
    description: `${finding.description} The audit analysis notes: "${snippet}"`,
  }
}

/**
 * Adjust severity levels in a findings array to satisfy score-based rules:
 * - score < 50 → at least one "high"
 * - score < 70 → at least one "medium"
 * Returns a new array (does not mutate input).
 */
function adjustSeverities(findings: TemplateFinding[], score: number): TemplateFinding[] {
  const adjusted = findings.map((f) => ({ ...f }))

  if (score < 50) {
    // Ensure at least one high-severity finding
    const hasHigh = adjusted.some((f) => f.severity === 'high' || f.severity === 'critical')
    if (!hasHigh && adjusted.length > 0) {
      adjusted[0].severity = 'high'
    }
  }

  if (score < 70) {
    // Ensure at least one medium-or-higher severity finding
    const hasMediumOrHigher = adjusted.some(
      (f) => f.severity === 'medium' || f.severity === 'high' || f.severity === 'critical'
    )
    if (!hasMediumOrHigher && adjusted.length > 0) {
      adjusted[0].severity = 'medium'
    }
  }

  return adjusted
}

/**
 * Generate deterministic template-based findings for starved categories.
 * Replaces the previous AI-based generation with zero API calls.
 *
 * Uses pre-written template findings matched by category name patterns,
 * optionally customized with the category summary from the report.
 */
export async function generateFindingsForStarvedCategories(
  starvedCategories: CategoryFindingCount[],
  siteUrl: string,
  _language: string = 'en',
): Promise<Map<number, AnalysisFinding[]>> {
  // ── DISABLED (2026-06-11, product decision) ─────────────────────────
  // These template findings are hardcoded, site-blind boilerplate. One of
  // them ("add customer testimonials...") shipped in a fixpath.ai report
  // describing testimonials the site doesn't have — exactly the fabricated
  // generic advice the product exists to eliminate. Under the deterministic
  // scoring model (score model v2) a low category score REQUIRES real
  // findings, so the "low score with 0 findings" starvation this module
  // patched can no longer occur in normal operation. If a gap appears, we
  // log it and show nothing — honest absence beats canned filler.
  if (starvedCategories.length > 0) {
    console.warn(
      `[minimum-findings] DISABLED — ${starvedCategories.length} starved categor${starvedCategories.length === 1 ? 'y' : 'ies'} detected (${starvedCategories.map(c => `${c.categoryName}:${c.score}`).join(', ')}). ` +
      'Template injection is off: deterministic scoring should make this impossible — investigate if this log appears.'
    )
  }
  return new Map()

  /* Legacy template path retained below for reference — unreachable. */
  // eslint-disable-next-line no-unreachable
  const results = new Map<number, AnalysisFinding[]>()

  for (const cat of starvedCategories) {
    const targetCount = cat.score < 50 ? 3 : 2
    const templates = getTemplateFindingsForCategory(cat.categoryName)

    // Pick the first N templates (they are ordered by decreasing severity)
    const selected = templates.slice(0, targetCount)

    // Customize the first finding with the category summary for specificity
    const customized = selected.map((f, i) =>
      i === 0 ? customizeWithSummary(f, cat.summary) : f
    )

    // Adjust severities to satisfy score-based rules
    const withSeverities = adjustSeverities(customized, cat.score)

    // Convert to AnalysisFinding format
    const findings: AnalysisFinding[] = withSeverities.map((f) => ({
      severity: f.severity,
      title: f.title,
      description: f.description,
      recommendation: f.recommendation,
      estimatedImpact: f.estimatedImpact,
      targetElement: null,
      pageUrl: siteUrl,
      categoryIndex: cat.categoryIndex,
    }))

    results.set(cat.categoryIndex, findings)
    console.log(
      `[minimum-findings] Generated ${findings.length} template findings for "${cat.categoryName}" (score: ${cat.score})`
    )
  }

  return results
}
