# Detection-Source Accuracy Ledger

**Purpose:** track which detection source (deterministic / "Verified" vs LLM / "AI-assessed")
reports accurately and which hallucinates, so we can make a strategic decision about how much
to trust each tier — and where to stop letting the LLM speak.

This is a living document. Append each dogfood/customer audit we hand-verify.

---

## Run 1 — fixpath.ai marketing site (audit 2026-06-13)

30 sub-findings, hand-checked against the actual marketing source.

### Verified tier (axe-core + responsive browser + PageSpeed) — 11 findings

| # | Finding | Claim type | Verdict |
|---|---------|-----------|---------|
| 1.5 | 10 touch targets <44px @375px | measured | **Accurate** (nav links were 45×17) |
| 1.6 | WCAG 1.4.3 contrast | measured (axe) | **Accurate** (element not surfaced in export — see gap below) |
| 1.8 | SVG no accessible name | measured (axe) | **Accurate** |
| 1.9 | Heading skip h2→h4 | measured (axe) | **Accurate** |
| 2 | 3 fixed widths >375px | measured | **Accurate** (`div.lg:hidden` 377px on `/`) |
| 8 | 8 text elements <12px | measured | **Accurate** |
| 9 | 28/33 blocks <8px spacing | measured | **Accurate** |
| 10 | 5 lines >75 chars @768px | measured | **Accurate** (minor) |
| 11 | Multiple redirects | measured (PSI) | **Accurate** (apex→www) |
| 12 | Unused JS | measured (PSI) | **Accurate but low-actionability** (Next.js framework chunks) |
| 19 | 8 body elements 12–14px | measured | **Accurate** |

**Verified accuracy: 11/11 truthful on the claim. 0 false positives.**
Only weakness is *specificity*, not truthfulness: #6 contrast didn't carry the offending
element/selector into the export, so it's accurate but hard to action.

### AI-assessed tier (LLM reading crawled content) — 19 findings

| # | Finding | Claim type | Verdict |
|---|---------|-----------|---------|
| 1.1 | Contact form fields "not connected to labels" | **absence** | ❌ **FALSE** — form has `<label htmlFor>`, `aria-required`, `required` (was even tagged *Not enough evidence* yet shipped as HIGH) |
| 1.3 | "Every page lacks `<main>`" | **absence** | ❌ **FALSE** — all 7 pages render `<main>` |
| 1.7 (#17) | "Footer has no Contact link" | **absence** | ❌ **FALSE** — footer's first link is Contact |
| 1.2 | No skip-to-content link | absence | ✅ **True** — fixed |
| 1.4 | Navs lack aria-label | absence | ⚠️ **Partial** — primary nav was unlabeled (true); "footer nav" doesn't exist (`<footer>`, not `<nav>`) |
| 1.7a | Accordions may not be keyboard-operable | hedged ("might") | ⚠️ **Speculative / unverified** |
| 3.1 | Idioms don't translate | opinion | ➖ **Opinion, not a defect** |
| 3.2 | hreflang missing | premature | ➖ **Premature** (no translated versions exist) |
| 4 | Pricing lacks security/compliance section | content gap | ✅ **Legit content gap** (your call) |
| 5 | Register doesn't explain free tier | content gap | ✅ **Legit content gap** |
| 6 | Long text blocks on /why-fixpath | opinion | ➖ **Opinion** |
| 7 | Inconsistent feature naming | opinion | ➖ **Partly fair, opinion** |
| 13 | Form errors don't explain fix | hedged ("likely") | ⚠️ **Speculative** |
| 14 | Required fields not pre-marked | partly checkable | ⚠️ **Verify on register** |
| 15 | CTA labels vague | opinion | ➖ **Opinion** (proposed copy is worse) |
| 16 | Nav labels vague | opinion | ➖ **Opinion** |
| 18 | FAQ lacks data-privacy entries | content gap | ✅ **Legit content gap** |
| 20 | Blog hard to read on mobile | hedged | ⚠️ **Plausible, unverified** |
| 21 | Forms use inconsistent styles | hedged ("likely") | ⚠️ **Speculative** |

**AI-assessed: 3 confirmed false positives, 4 hedged/speculative, 6 opinion-not-defect,
~5 genuinely actionable (4 of them content gaps, not structural).**

---

## The pattern (the strategic finding)

**100% of the AI's confirmed errors are false claims of *absence*** — "not connected",
"lacks `<main>`", "no Contact link". The LLM cannot reliably verify that something is *missing*
from crawled content, so it guesses, and it guesses confidently enough to mint HIGH findings
that cap the score. One was even self-tagged *Not enough evidence* and still surfaced as a HIGH.

The deterministic layer made **zero** such errors. And critically: every one of the AI's false
positives is in a domain axe **already measures accurately** (landmarks, labels, links).

Where the AI *is* valuable: interpretive content judgments it can ground in quoted copy —
the pricing-security gap, the free-tier explanation, the FAQ privacy gap. That's real signal a
deterministic checker can't produce.

## Recommended strategic decision

1. **Let axe own structural a11y.** Bar the LLM from emitting accessibility findings in
   categories axe covers (landmarks, form labels, contrast, target size, headings, alt/SVG names).
   Removes all 3 false positives + the speculative a11y ones with zero loss of real signal.
2. **Enforce the "no absence without proof" rule as a hard gate** (it's already promised on
   /methodology). Drop or demote any AI finding asserting something is missing unless it carries
   a structural artifact. This is the single highest-leverage accuracy fix.
3. **Keep the LLM for interpretive/content findings** (messaging, positioning, trust-content
   gaps) where it's grounded in quoted page evidence — that's its real edge.
4. **Carry the offending selector into Verified findings** (e.g. #6 contrast) so "accurate"
   also becomes "actionable."

> These are **engine** changes (heart code), deliberately out of scope for the marketing-site
> fix pass. Logged here for the strategic call. Cross-ref: debt register in
> `docs/SERIES_A_ENGINEERING_PLAN.md`.
