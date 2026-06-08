# Fixpath Brief — Accessibility Category + Brand Consistency Logic

We want to add website accessibility into Fixpath in a way that feels useful, credible, and native to the product. At the same time, we need to fix a logic issue in the current audit: the product is showing brand consistency results even when no brand identity has been provided. This brief defines the product decision, architecture direction, UI behavior, and implementation expectations. [cite:458][cite:463]

## Product decision

The recommendation is to create a **7th category** for accessibility rather than forcing it into existing categories. The category should be named **Accessibility Readiness** or **Accessibility / WCAG Readiness**, not “guaranteed compliance” and not “certification.” This keeps the product clearer for users, makes the score easier to understand, and avoids muddying existing category logic with a fundamentally different type of audit signal. [cite:458][cite:463]

### Final call

Use a dedicated seventh category:

- **Accessibility Readiness**
- optional subtitle: **WCAG / EAA risk signals**

Do **not** merge accessibility deeply into unrelated categories like brand consistency or content quality. Accessibility is broad enough, important enough, and actionable enough to stand as its own audit pillar.

## Why a separate category is the right move

Fixpath is moving toward a cleaner, more actionable audit experience rather than a confusing data dump. A dedicated accessibility category supports that goal because users can immediately understand what it represents, why it matters, and what to fix next. It also gives the product a stronger “Find, Fix, Track” path: detect accessibility risks, explain them clearly, and track improvement after re-audit. [cite:463]

If accessibility is hidden inside existing categories, several problems happen:

- users do not know where accessibility issues live,
- the score becomes harder to explain,
- findings become mixed with unrelated logic,
- and the product becomes harder to maintain over time.

A separate category gives us cleaner UX, cleaner data modeling, and cleaner scoring.

## Positioning and language

We should not present this as legal certification or guaranteed compliance. The right positioning is:

- identifies accessibility risks,
- highlights issues that may affect WCAG / EAA readiness,
- explains impact,
- recommends fixes,
- tracks improvement over time.

Good naming options:

- Accessibility Readiness
- Accessibility Checker
- Accessibility & UX
- WCAG / EAA Readiness

Recommended product name:

**Accessibility Readiness**

Recommended detail label inside the audit:

**Checks for common accessibility risks aligned with WCAG and EAA expectations.**

## What the new category should include

For v1, focus on automated checks that are high-signal and clearly actionable.

### Suggested issue types

- missing alt text
- poor heading hierarchy
- missing form labels
- low color contrast
- inaccessible button or link names
- empty links or vague CTA labels
- missing page titles
- duplicate page titles where relevant
- missing language attribute
- semantic landmark issues
- basic ARIA misuse patterns
- image-only controls without accessible names
- keyboard accessibility risks where detectable

The goal is not to produce a massive compliance spreadsheet. The goal is to identify the most meaningful accessibility barriers and turn them into practical fixes.

## Scoring model

Accessibility should get its own score and issue groups.

### Recommended scoring behavior

- give the category a standalone score,
- weight critical blockers more heavily,
- group findings by severity and affected template/page type,
- show confidence level where detection is partial,
- and allow re-audit to update the score after fixes are applied. [cite:458]

### Suggested severity buckets

- Critical — likely blocks access or creates major usability barriers
- High — significant accessibility problem affecting important flows
- Medium — meaningful issue with lower impact or narrower scope
- Low — improvement opportunity or lower-risk standards issue

## UI behavior

Accessibility should appear as a first-class audit category in the same audit system as the other categories, but with its own identity.

### In Overview / Find

Show:

- Accessibility Readiness score
- top critical issues
- number of affected pages
- top affected templates (homepage, product, pricing, contact, etc.)
- trend on re-audit

### In Fix

Each finding should follow the same Fixpath logic:

- Finding
- Why it matters
- Fix
- Impact
- Deployment / implementation support where relevant

This aligns with the user’s current direction for actionable findings and implementation guidance. [cite:458]

### In Track

Track:

- resolved accessibility issues
- unresolved issues
- score delta after re-audit
- newly introduced issues
- confidence or coverage notes

## Brand consistency logic fix

We also need to correct the current behavior where the audit shows brand consistency results even when no brand identity has been provided. The current system should not pretend it has a true brand-consistency baseline when no brand identity inputs exist. That logic needs to be redesigned. [cite:458]

### Final call on brand consistency

Keep **Brand Consistency** as an audit category or signal, but split its logic into two modes:

1. **Brand Identity Mode** — used when brand identity inputs exist
2. **Brand Presence Mode** — fallback mode when no brand identity inputs exist

This avoids showing misleading “brand consistency” results when the system has nothing real to compare against.

## Recommended brand logic

### Mode 1 — Brand Identity Mode

If the user has uploaded or defined brand identity inputs, then brand consistency can be scored against:

- brand voice guidance
- tone guidance
- visual identity references
- messaging pillars
- naming conventions
- slogan / value proposition
- audience positioning
- approved language examples

In this mode, the audit can legitimately assess whether the website aligns with the provided brand identity.

### Mode 2 — Brand Presence Mode

If no brand identity exists, do **not** label the result as “brand consistency” in a fully authoritative way.

Instead, use fallback language such as:

- Brand Presence
- Brand Clarity
- Messaging Consistency Signals
- Baseline Brand Signals

Recommended fallback label inside the system:

**Brand Clarity Signals**

This fallback mode can analyze:

- consistency of messaging across pages
- repetition of core value proposition
- clarity of what the company does
- coherence of CTA language
- tone stability across key pages
- whether homepage / about / services describe the same offer clearly

That gives users value without overclaiming a true brand-identity comparison.

## Required product behavior

### If brand identity exists

Show:
- Brand Consistency score
- comparison against provided brand inputs
- findings based on identity alignment

### If brand identity does not exist

Show:
- Brand Clarity Signals or Brand Presence score
- note that no formal brand identity baseline was provided
- findings based on messaging coherence and on-site consistency only
- CTA encouraging the user to upload or define brand identity for deeper analysis

### Important rule

Do not show a definitive “Brand Consistency” result unless the system actually has brand identity inputs to compare against.

## Recommended UX copy

### When identity exists

“Assesses how consistently your website reflects the brand identity you provided.”

### When identity does not exist

“No formal brand identity was provided, so this score is based on messaging clarity and consistency signals across your website.”

### Upgrade prompt

“Add your brand identity to unlock deeper brand consistency analysis.”

This keeps the audit honest while still making the feature useful.

## Implementation requirements for Claude

### 1. Add a seventh audit category

Add **Accessibility Readiness** as a distinct audit category with:

- its own score
- its own issue taxonomy
- its own UI card/module
- its own findings flow
- its own tracking over time

### 2. Build clean scoring separation

Do not bury accessibility issues inside unrelated category scores. Keep them queryable, explainable, and independently trackable.

### 3. Fix brand consistency logic

Refactor the current brand consistency module so it checks first whether a valid brand identity baseline exists.

Pseudo-logic:

```ts
if (hasBrandIdentityBaseline) {
  runBrandConsistencyAudit();
  label = 'Brand Consistency';
} else {
  runBrandClaritySignalsAudit();
  label = 'Brand Clarity Signals';
}
```

### 4. Update UI labels and descriptions dynamically

The UI should never mislead users about what is being evaluated.

If brand identity exists:
- show identity-alignment language

If brand identity does not exist:
- show baseline messaging/clarity language

### 5. Update the audit explanation layer

For every score card and finding block, ensure the explanatory copy reflects the actual analysis mode being used.

### 6. Update re-audit logic

Re-audits should:
- reconcile accessibility findings over time,
- update the accessibility score,
- distinguish fixed vs recurring issues,
- and preserve whether brand analysis was done in identity mode or fallback mode. [cite:458]

## Suggested category model

Recommended top-level audit category structure:

1. Brand Clarity / Brand Consistency
2. Content Quality
3. Trust Signals
4. UX / Readability
5. Technical / Performance
6. Discoverability / SEO / AI Readiness
7. Accessibility Readiness

If your current six categories are named differently, keep the existing structure where possible — the key point is that Accessibility becomes its own explicit pillar.

## Deliverables required from Claude

I want the following implemented or planned clearly:

1. category decision reflected in the audit model
2. Accessibility Readiness category definition
3. scoring model for accessibility
4. issue taxonomy for accessibility findings
5. UI placement across Overview, Find, Fix, and Track
6. brand consistency logic fix with identity-aware fallback
7. copy updates so users understand what is being scored
8. re-audit handling for both accessibility and brand analysis modes
9. migration / data model notes if category count or score storage changes are needed

## Copy-paste prompt for Claude

```text
We are making two important audit changes in Fixpath.

1) Add website accessibility as its own audit category.
2) Fix the current brand consistency logic so we do not show misleading brand consistency results when no brand identity has been provided.

Final product call:
- Create a dedicated 7th category called Accessibility Readiness.
- Do not force accessibility into unrelated existing categories.
- Position it as accessibility risk detection and WCAG / EAA readiness support, not legal certification or guaranteed compliance.

What Accessibility Readiness should do:
- detect common high-signal accessibility issues
- score them in a dedicated category
- group findings by severity and affected pages/templates
- explain why each issue matters
- provide recommended fixes
- track improvement after re-audit

Focus v1 on checks like:
- missing alt text
- poor heading hierarchy
- missing form labels
- low color contrast
- inaccessible button/link names
- vague CTA text
- missing page titles
- missing lang attribute
- semantic landmark issues
- basic ARIA misuse
- keyboard-accessibility risks where detectable

Important:
- do not present this as certification or guaranteed compliance
- use language like Accessibility Readiness or WCAG / EAA readiness signals

Second issue: brand consistency logic.
Right now the audit shows brand consistency results even when no brand identity has been provided. That is misleading and needs to be fixed.

Implement two modes:

Mode 1: Brand Identity Mode
- if brand identity inputs exist, run true brand consistency analysis against those inputs
- label results as Brand Consistency

Mode 2: Fallback Mode
- if no brand identity inputs exist, do not present the result as true brand consistency
- instead run a fallback analysis based on messaging coherence and on-site consistency signals
- label this fallback as Brand Clarity Signals or Brand Presence

Required behavior:
- UI labels and explanatory copy must change depending on which mode is active
- users should be told when no formal brand identity baseline exists
- users should be encouraged to upload/add brand identity to unlock deeper analysis

Please deliver:
1. architecture and data-model changes
2. audit category updates for a 7th category
3. accessibility scoring model and issue taxonomy
4. UI changes across Overview / Find / Fix / Track
5. brand consistency fallback logic
6. dynamic copy and labeling rules
7. re-audit behavior for both accessibility and brand-analysis modes
8. migration notes if score storage or category schema changes are needed
```

