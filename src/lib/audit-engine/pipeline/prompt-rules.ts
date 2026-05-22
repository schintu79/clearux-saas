// ============================================================
// ClearUX Proprietary Pipeline — Prompt Quality Rules
// ============================================================
//
// PURPOSE:
// These are the rules injected into every AI analysis prompt.
// They tell the AI what to look for, what to avoid, and how to
// structure findings. This is the "front gate" — it shapes what
// the AI produces before the post-processing pipeline cleans it.
//
// The rules are stored as data (string blocks) so they can be:
// - Versioned and tracked in git
// - Composed dynamically based on audit type
// - A/B tested with different rule sets
// - Improved independently of the analyzer code
//
// WHEN TO IMPROVE THIS FILE:
// - If the AI keeps producing a specific type of bad finding → add a rule
// - If a valid finding type is being suppressed → loosen a rule
// - If a new audit module needs custom rules → add a rule block
// ============================================================

// ── Evidence requirements ────────────────────────────────────
// The AI must cite specific text. No speculation allowed.

export const EVIDENCE_RULES = `
MANDATORY EVIDENCE RULE — ZERO SPECULATION POLICY:
Every finding MUST cite specific, concrete evidence you directly observed in the provided content. This means:
- You MUST quote the exact text, element, attribute, or pattern you observed that proves the issue exists.
- "Not verified", "could not confirm", "potentially", "may have", "appears to lack" = AUTOMATIC REJECTION. If you cannot verify it from the content, DO NOT include it.
- "Color contrast not verified" or "accessibility not tested" are NOT findings — they are admissions that you have no evidence. Never include them.
- Before flagging "missing X" (e.g., missing labels, missing alt text, missing ARIA), you MUST search the provided content for X. If you find <label htmlFor="...">, for="...", aria-label, aria-labelledby, or equivalent — the element IS labeled. Do not flag it.
- If you cannot point to a specific quoted excerpt or HTML pattern that proves the issue, the finding does not exist. Period.
`.trim()

// ── Text-only constraints ────────────────────────────────────
// The AI only sees extracted text, not raw HTML/CSS/JS.
// These rules prevent it from making claims about invisible layers.

export const TEXT_ONLY_CONSTRAINTS = `
CRITICAL — YOU ARE ANALYZING TEXT CONTENT, NOT RAW HTML/CSS:
The content provided is extracted text, NOT raw HTML source code. This means:
- You CANNOT see CSS styles, classes, media queries, focus states, animations, or visual styling. NEVER flag issues about CSS you haven't seen (focus indicators, line-height, font-size, touch target sizes, color contrast, responsive breakpoints).
- You CANNOT see HTML attributes like lang, aria-*, role, autocomplete, htmlFor, type, etc. NEVER flag "missing" HTML attributes — you simply don't have that data.
- You CANNOT see structured data (JSON-LD, microdata, Schema.org). NEVER flag "missing structured data" — it may exist in the <head> which was stripped during text extraction.
- You CANNOT see meta tags, OG tags, Twitter cards, canonical URLs. NEVER flag missing meta tags unless you can see ALL the <head> content (you can't).
- You CANNOT verify JavaScript behavior (form validation, error messages, loading states, success states, interactive components). NEVER flag "form lacks error feedback" or "no success state after submission" — you can't see client-side behavior.
- You CANNOT test mobile responsiveness, keyboard navigation, screen reader behavior, or touch interactions. NEVER flag these as issues.
- "The provided content does not show X" is NOT evidence that X is missing. It means you can't see it. THESE ARE DIFFERENT THINGS. Never conflate them.
- When the H1 field shows "[not captured]" — this does NOT mean the page lacks an H1. Many modern sites (React, Next.js, Vue) render H1 elements via JavaScript, Suspense boundaries, or streaming HTML that simple text extraction cannot capture. NEVER flag "missing H1" when the capture status is uncertain.
- Similarly, robots.txt and sitemap.xml existence CANNOT be verified from page text content. These files live at server-level paths and require separate HTTP requests. NEVER flag them as missing based on text extraction alone.
If an issue depends on seeing CSS, HTML attributes, JavaScript behavior, or visual rendering that you cannot access from text content — DO NOT INCLUDE IT.
`.trim()

// ── JS-rendered content awareness ────────────────────────────
// The crawler captures one snapshot. Dynamic content may rotate.

export const JS_CONTENT_AWARENESS = `
CRITICAL — JAVASCRIPT-RENDERED CONTENT LIMITATION:
The text content was captured from a single page load. Dynamic/JS-rendered elements such as rotating headlines, carousels, animated text swaps, tabbed content, and accordion sections may only show ONE state. If you see a headline or content block, it may be one of several rotating variants. NEVER judge a site's full messaging strategy based on a single captured headline — it may cycle between multiple messages. If the captured H1 seems incomplete or fragmented, consider that it may be mid-rotation. Focus on the overall site messaging across ALL pages rather than anchoring critique on a single headline snapshot.
`.trim()

// ── Context-aware evaluation ─────────────────────────────────
// Adapt analysis to the site's type and audience.

export const CONTEXT_AWARENESS = `
CRITICAL — CONTEXT-AWARE EVALUATION:
Before analyzing, determine the site's type (SaaS, e-commerce, content/blog, portfolio, marketplace, tool/API, etc.) and its target audience. Your evaluation MUST adapt to context:
- A SaaS product doesn't need shopping cart agent-readiness or multi-currency support
- A developer tool can use technical jargon without being "culturally insensitive"
- An English-only startup shouldn't be heavily penalized for lacking RTL support
- A site with no forms isn't "failing at form accessibility" — it simply has no forms
- Missing a specific content format (FAQ, knowledge base, blog) is NOT a failure if the site communicates clearly through other means
Evaluate what IS there, not what's absent. A clean, well-structured site that clearly communicates its purpose should score well — don't invent problems because a theoretical checklist item is "missing." The question is always: "Does this site WORK for its users and for AI systems?" — not "Does it have every possible feature?"
`.trim()

// ── Cross-page awareness ─────────────────────────────────────
// Don't flag content as missing if it exists on another page.

export const CROSS_PAGE_AWARENESS = `
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
`.trim()

// ── Demo content exclusion ───────────────────────────────────

export const DEMO_EXCLUSION = `
CRITICAL — DEMO & ILLUSTRATIVE CONTENT EXCLUSION:
Many websites display example/demo content to showcase their product's capabilities (e.g., a UX audit tool showing sample findings, a design tool showing example designs, a security scanner showing sample vulnerabilities). You MUST recognize and EXCLUDE this type of content from your analysis:
- Content inside elements marked with data-demo="true", role="presentation", or aria-label containing "example", "demo", or "illustrative"
- Content explicitly labeled as "Example", "Demo", "Sample", "Preview", or "Illustration"
- Product showcase sections that display what the tool DETECTS on other sites (not issues on THIS site)
- Mock-ups, wireframes, or UI previews shown as product demonstrations
If you find text like "Confirmshaming detected" or "Dark pattern found" inside a demo/example panel on a UX audit tool's own website, that is the tool demonstrating its capabilities — NOT an actual dark pattern on the site. Never flag demo content as real findings.
`.trim()

// ── Third-party exclusion ────────────────────────────────────

export const THIRD_PARTY_EXCLUSION = `
THIRD-PARTY & INFRASTRUCTURE EXCLUSION:
Never flag issues caused by services the site owner does not control:
- CDN behaviors (Cloudflare email obfuscation, Cloudflare challenge pages, Cloudflare-injected scripts, edge caching headers)
- Hosting platform artifacts (Vercel, Netlify, AWS deployment markers, server headers)
- Third-party widget behavior (chat widgets, analytics scripts, cookie consent banners from third-party providers)
- Email protection/obfuscation by security services (e.g., [email protected] links rewritten by Cloudflare)
- DNS-level redirects, SSL certificate details, CDN-specific response headers
These are infrastructure decisions, not UX issues. The site owner often cannot change them. NEVER include them.
`.trim()

// ── Subjective opinion filter ────────────────────────────────

export const SUBJECTIVE_FILTER = `
SUBJECTIVE OPINION FILTER:
Design preferences are NOT UX failures. Do not flag:
- "Visual hierarchy could be stronger" without evidence of user confusion or missed content
- "Color palette feels [adjective]" — subjective color opinions are not findings
- "Font size could be larger" when the font meets readability standards (≥16px body)
- "Layout is too [simple/complex/minimal/busy]" without evidence of user impact
- "Content tone is too [formal/casual/corporate/friendly]" when tone is consistent and appropriate for the audience
- Aesthetic preferences disguised as UX recommendations (e.g., "hero section would benefit from more visual interest")
A finding must describe a FUNCTIONAL problem — something that causes users to fail, abandon, misunderstand, or feel unsafe. "I would design it differently" is not a finding.
`.trim()

// ── False positive whitelist ─────────────────────────────────

export const FALSE_POSITIVE_WHITELIST = `
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
- "Missing lang attribute" or "wrong/incorrect lang attribute value" — you cannot see HTML attributes from text content, so you cannot know what lang value is set
- "Missing meta tags" or "missing OG tags" — you cannot see <head> content from text extraction
`.trim()

// ── Duplicate prevention ─────────────────────────────────────

export const DUPLICATE_PREVENTION = `
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
`.trim()

// ── Quality self-check ───────────────────────────────────────

export const QUALITY_SELF_CHECK = `
FINAL SELF-CHECK — Before returning your findings, review each one against these gates:
1. Does this finding quote specific evidence from the provided content? If no → DELETE.
2. Is this about something the site owner can actually control? If no → DELETE.
3. Could I verify this claim is true from the content provided? If no → DELETE.
4. Is this a real functional problem, or just my design preference? If preference → DELETE.
5. Is this essentially the same issue as another finding? If yes → MERGE.
6. Would a paying client consider this finding worth their time and money to fix? If no → DELETE.
`.trim()

// ── High-value finding guidance ──────────────────────────────

export const HIGH_VALUE_GUIDANCE = `
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
`.trim()

// ── Site-type scope filter ───────────────────────────────────
// Prevents abstract or out-of-scope findings on simple sites.

export const SITE_TYPE_SCOPE_FILTER = `
CRITICAL — SITE-TYPE SCOPE FILTER:
Before generating ANY finding, determine the website type from the crawled content:
- Does the site have signup/login flows? Pricing pages? Subscription plans? E-commerce? Forms with sensitive data?
- A "business-card" site (portfolio, brochure, agency landing, simple service page) with NO signup, NO pricing, NO subscription, NO checkout flow should NEVER receive findings about:
  * Pricing transparency, hidden costs, or pricing friction
  * Forced selections, dark patterns, or confirmshaming (there is nothing to force-select)
  * Psychological friction in checkout or signup flows (there is no checkout or signup)
  * Responsible design patterns for subscription management (there are no subscriptions)
  * Cookie consent dark patterns (unless you can actually see manipulative cookie UI in the content)
  * Cart abandonment, checkout optimization, or payment UX
- Only flag these types of issues when there is a CONCRETE, VISIBLE, SPECIFIC element on the page that supports the claim. "The site could hypothetically have dark patterns" is not a finding.
- Generic moral or ethical observations about web design do NOT belong on a site that has no interactive flows to evaluate.
`.trim()

// ── Finding type classification ─────────────────────────────
// Separates fixable issues from strategic observations.

export const FINDING_TYPE_CLASSIFICATION = `
CRITICAL — FINDING TYPE CLASSIFICATION:
Every finding MUST be classified as either "fixable" or "strategic":

FIXABLE FINDINGS (findingType: "fixable"):
These appear in the Fix Console and MUST be directly deployable. The user must be able to:
1. See exactly what is wrong (with quoted evidence)
2. See exactly where it is wrong (specific page, element, or file)
3. Understand why it matters (concrete impact)
4. Get an exact implementation (copy-paste code, text, or config change)

Fixable findings MUST have a fixType:
- "html" — Edit existing HTML (fix heading structure, add alt text, fix semantic tags, add landmarks)
- "meta" — Add or change meta tags, OG tags, canonical URLs, title tags, meta descriptions
- "schema" — Add or fix JSON-LD structured data (Organization, FAQ, Product, Breadcrumb, etc.)
- "copy" — Rewrite text content (headlines, CTAs, descriptions, button labels, error messages)
- "file" — Add a new file to the site root (robots.txt, sitemap.xml, llms.txt, .well-known/ai-plugin.json)
- "config" — Server configuration change (redirects, headers, viewport meta)

Examples of fixable findings:
- Missing meta description → fixType: "meta", recommendation includes the exact meta tag
- Weak hero headline → fixType: "copy", recommendation includes the rewritten headline
- Missing JSON-LD Organization schema → fixType: "schema", recommendation includes the exact JSON-LD block
- Missing alt text on hero image → fixType: "html", recommendation includes the exact alt attribute
- No robots.txt → fixType: "file", recommendation includes the exact file content
- Heading hierarchy broken (H1 → H3) → fixType: "html", recommendation shows correct structure

STRATEGIC FINDINGS (findingType: "strategic"):
These are broader observations that require redesign, strategic thinking, or human judgment.
They appear under "Strategic observations" on the Find tab, NOT in the Fix Console.
They are still valuable but cannot be deployed as a code/content change.

Examples of strategic findings:
- "Brand positioning feels inconsistent across pages" — requires brand strategy work
- "Trust story is weak — no social proof or credentials visible" — requires content strategy
- "Overall design feels dated compared to competitors" — requires design overhaul
- "Navigation structure doesn't match user mental models" — requires IA restructuring
- "Emotional tone shifts between pages" — requires content audit and rewrite strategy
- "No clear conversion funnel from homepage to signup" — requires UX redesign

IF YOU CANNOT SPECIFY AN EXACT CODE/CONTENT CHANGE → IT IS STRATEGIC.
`.trim()

// ── Compose all rules into a single prompt block ─────────────

export function composePromptRules(): string {
  return [
    JS_CONTENT_AWARENESS,
    EVIDENCE_RULES,
    TEXT_ONLY_CONSTRAINTS,
    CONTEXT_AWARENESS,
    CROSS_PAGE_AWARENESS,
    DEMO_EXCLUSION,
    THIRD_PARTY_EXCLUSION,
    SUBJECTIVE_FILTER,
    FALSE_POSITIVE_WHITELIST,
    HIGH_VALUE_GUIDANCE,
    SITE_TYPE_SCOPE_FILTER,
    FINDING_TYPE_CLASSIFICATION,
    DUPLICATE_PREVENTION,
    QUALITY_SELF_CHECK,
  ].join('\n\n')
}
