# ClearUX Website Improvement List

**Current Score: 58/100 — Target: 80+**
**Based on self-audit report (85 findings) — April 2026**

Many findings are already resolved in the current codebase (navbar exists with proper links, JSON-LD structured data is in place, OG/Twitter meta tags present, FAQ uses accordions, about page exists, lang attribute set, viewport handled by Next.js, privacy/terms/contact pages exist). The H1 `&amp;` finding is a false positive — JSX renders it correctly as `&`.

Below are the **genuine remaining improvements**, grouped by priority.

---

## TIER 1 — Quick Wins (High Impact, Low Effort)

These can be done in 1–2 hours and directly boost the score in multiple categories.

### 1. Add social proof near the hero CTA
**Findings:** #14, #20, #21 | **Categories:** Trust & Credibility, Calls-to-Action
- Add 3–5 testimonials (not just Sarah Chen) with name, title, company, and photo/avatar
- Add a "Trusted by X teams" counter or logo wall below the hero input
- Show audit count: "2,000+ audits completed" (pull from DB if possible)
- Move social proof directly below the URL input, before the fold ends

### 2. Add a "See Sample Report" button / product demo
**Findings:** #40, #48, #63 | **Categories:** Trust, Conversion, Value Proposition
- Add a "See Sample Report" link next to the primary CTA
- Link to a real PDF/DOCX or an interactive preview of an audit report
- Add a short description of what scores and severity levels mean
- This is the #1 conversion friction reducer — users want to see what they're buying

### 3. Fix hero CTA copy to be outcome-focused
**Findings:** #13, #46, #76 | **Categories:** Calls-to-Action, Conversion
- Current: "Audit My Site" (generic action)
- Better: "Get My UX Report" or "See My UX Issues" (outcome-focused)
- Standardise across all CTAs (hero, pricing section, footer) — use ONE label
- The pricing tier buttons can differ ("Buy 5 Credits") but primary CTA should be consistent

### 4. Strengthen the hero messaging with pain-point framing
**Findings:** #9, #10, #41, #43 | **Categories:** Value Proposition & Messaging
- Current: leads with feature counts ("56 checkpoints, 13 categories")
- Add WHO benefits: "For product teams who need UX insights fast"
- Add WHY NOW: "AI models now drive as much traffic as Google — is your site ready?"
- Add competitive differentiator: "Professional-grade audits at 1/10th the cost of agencies"
- Frame the subheading around pain, not features: "Stop losing conversions to UX issues you can't see"

### 5. Expand the "What We Audit" category descriptions
**Findings:** #31, #59, #65 | **Categories:** Content Quality, AI Discoverability
- Currently each category has a 1-line description
- Add 2–3 bullet points per category showing example checkpoints
- Group categories into clusters: "Visual & Design", "Content & Communication", "Technical", "Business Impact"
- This also boosts AI discoverability since LLMs can parse detailed text

### 6. Add visual trust badges near pricing
**Findings:** #57, #69 | **Categories:** Trust & Credibility
- Add Stripe badge, SSL indicator, and "Credits never expire" guarantee near checkout buttons
- Add "Money-back guarantee" if applicable

---

## TIER 2 — Medium Effort (High Impact)

These take 2–4 hours each but significantly improve the weakest scoring categories.

### 7. Improve the "How It Works" section visual design
**Findings:** #33, #58 | **Categories:** Visual Hierarchy & Layout
- Each step should be in a distinct card/container with subtle background
- Use large step numbers (36–48px) in accent colour
- Add connecting arrows or lines between steps
- Break dense paragraphs into bullet points for scannability

### 8. Make pricing cards visually distinct
**Findings:** #38, #67, #68 | **Categories:** Visual Hierarchy, Conversion
- The "Most Popular" Growth card needs stronger visual treatment: coloured border, shadow lift, light background tint
- Currently all 4 cards look nearly identical
- The recommended plan should visually "pop" — bigger, elevated, border accent
- Already partially done (border-2 border-accent on popular) but can be stronger

### 9. Add proper heading hierarchy across the homepage
**Findings:** #23, #27 | **Categories:** Technical SEO, Accessibility
- Ensure all section titles (How It Works, What We Audit, Pricing, FAQ, Testimonials) use proper H2 tags
- Pricing tier names should be H3 under the Pricing H2
- Category names in "What We Audit" should be H3 under that section's H2
- Run an accessibility checker (axe) to verify

### 10. Improve form label associations for the URL input
**Findings:** #34, #52 | **Categories:** Accessibility, Mobile Experience
- Add proper `<label htmlFor="url-input">` association
- Add `inputMode="url"` for mobile URL keyboard
- Add `autoComplete="url"` for browser suggestions
- Ensure input is at least 44px tall for touch targets

### 11. Add ARIA landmarks and semantic HTML structure
**Findings:** #35, #71, #70 | **Categories:** Accessibility & Inclusive Design
- Wrap sections in semantic `<section>` with `aria-labelledby`
- Ensure FAQ accordions have `aria-expanded` and `aria-controls`
- Add visible keyboard focus indicators (`:focus-visible` outline) on all interactive elements
- The skip-to-content link should be functional and visible on focus

### 12. Add alt text to all images
**Findings:** #22, #36 | **Categories:** Accessibility, Technical SEO
- Hero images, category icons, testimonial avatars, report previews all need descriptive alt text
- Audit example screenshots: alt="ClearUX audit report showing category scores and findings"
- Avatar images: alt="Sarah Chen, Product Manager at TechFlow"

---

## TIER 3 — Larger Efforts (Medium Impact)

### 13. Create unique page titles and meta descriptions per route
**Findings:** #4, #26, #79 | **Categories:** Technical SEO
- Homepage: "ClearUX — AI-Powered UX Audits in Minutes"
- /about: "About ClearUX — Our Mission & Team"
- /login, /register, /dashboard: unique titles already exist
- Trim meta descriptions to ~140 chars for mobile safety
- The homepage sections (#features, #pricing) share the same metadata — this is expected for SPA sections and not really fixable without separate routes

### 14. Lazy load below-the-fold sections
**Findings:** #16 | **Categories:** Performance
- Use `loading="lazy"` on all images below the hero
- Consider using Intersection Observer for heavy sections (category grid, pricing cards)
- Defer testimonial and FAQ rendering
- Next.js Image component already supports this — ensure it's used consistently

### 15. Image optimisation strategy
**Findings:** #49, #51 | **Categories:** Performance
- Use Next.js `<Image>` component everywhere (automatic WebP/AVIF, srcset)
- Preload critical hero font with `<link rel="preload">`
- Ensure `font-display: swap` on web fonts
- Subset fonts to Latin if not already done

### 16. Reduce content repetition
**Findings:** #80 | **Categories:** Content Quality
- The "56 checkpoints, 13 categories" line appears in hero, features, pricing, buy-credits
- State it once in the hero, then use varied language elsewhere
- E.g., in pricing: "Complete deep analysis" instead of repeating the numbers

### 17. Add a "Why ClearUX" competitive comparison section
**Findings:** #10 | **Categories:** Value Proposition
- Brief comparison: ClearUX vs manual agency audit vs DIY vs other tools
- Highlight: speed (minutes vs weeks), cost ($99 vs $10K+), depth (56 checkpoints), AI discoverability (unique)

### 18. Add contact/support pathways
**Findings:** #56 | **Categories:** Trust & Credibility
- State response time SLA: "We respond within 24 hours"
- Consider live chat widget for higher-tier customers
- Make support@clearux.ai more prominent (currently only in FAQ)

---

## SCORE IMPACT ESTIMATE

| Category | Current | After Tier 1 | After Tier 2 | After All |
|---|---|---|---|---|
| First Impression & Visual Design | 45 | 55 | 65 | 70 |
| Value Proposition & Messaging | 62 | 75 | 78 | 82 |
| Navigation & Information Architecture | 38 | 45 | 55 | 60 |
| Calls-to-Action & Conversion | 58 | 72 | 78 | 82 |
| Performance & Page Speed | 75 | 75 | 78 | 82 |
| Mobile Experience | 52 | 55 | 65 | 70 |
| Trust & Credibility | 55 | 72 | 78 | 82 |
| Content Quality & Readability | 68 | 72 | 78 | 82 |
| Technical SEO & Accessibility | 50 | 55 | 68 | 75 |
| AI Discoverability & LLM Readiness | 42 | 50 | 60 | 68 |
| Visual Hierarchy & Layout | 58 | 65 | 75 | 80 |
| Accessibility & Inclusive Design | 46 | 50 | 65 | 72 |
| **Overall (estimated)** | **58** | **68** | **74** | **80** |

---

## WHAT TO DO FIRST

If you want the biggest score jump with the least work:

**Do items 1–6 (Tier 1).** They address the weakest categories (Navigation 38, AI Discoverability 42, First Impression 45, Accessibility 46) and should push the overall score from 58 → ~68 in about half a day of work.

Then tackle Tier 2 items 7–12 to push past 74.

Tier 3 gets you to 80+ but is more time-intensive and has diminishing returns.
