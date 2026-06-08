# Fixpath Audit Bible

Fixpath exists to help users find what is actually hurting trust, clarity, performance, accessibility, and growth, fix what materially matters, and track whether things improved over time. It is not supposed to generate endless findings just to justify its existence. It is not supposed to punish users on every re-audit. It is not supposed to invent new issues when real issues have already been fixed. The product promise is simple: **Find. Fix. Track.** That promise must shape the audit logic, scoring model, reporting layer, and re-audit behavior. [cite:458][cite:463][cite:471]

## Core product truth

The audit engine must optimize for **truth, trust, and usefulness**.

That means:

- report what is real,
- report what materially matters,
- avoid noisy or speculative findings,
- avoid duplicate or renamed findings that create fake churn,
- avoid scoring behavior that makes improvement feel impossible,
- and only recommend changes when the expected impact is meaningful.

If Fixpath repeatedly tells users that things are broken after they have already fixed them, the user will stop trusting the score. Once trust in the score is lost, the product loses its core value.

## The problem this bible solves

The current failure mode is clear: after multiple rounds of fixes, a fresh deep audit can still return a poor score and surface many findings that are effectively the same issues the user already addressed. This makes the audit feel like it is trying to always find faults instead of measuring real improvement. That is the opposite of what Fixpath should stand for. [cite:458]

The audit engine must therefore be redesigned around a strict principle:

> A re-audit should validate progress first, detect regressions second, and only introduce new findings when they are truly new, truly real, and truly meaningful.

## What Fixpath is and is not

### Fixpath is

- a decision engine for real website and brand issues,
- a prioritization system,
- a fix guidance system,
- a progress tracking system,
- and a trust-building product.

### Fixpath is not

- a machine for producing as many findings as possible,
- a generic SEO spam checklist,
- a rewriting engine that always wants different copy,
- a pseudo-intelligent system that changes its opinion every audit,
- or a score machine that keeps users permanently “bad.”

## Foundational audit principles

### 1. Real over possible

Only report issues that are observable, supportable, and grounded in actual evidence from the crawl, structured signals, or content analysis.

Do not report weak possibilities as hard issues.

Bad:
- “This copy may be slightly more engaging if rewritten.”
- “This headline could be stronger.”
- “This page might improve with a friendlier tone.”

Good:
- “The homepage headline does not explain what the company does within the first visible section.”
- “Three key service pages use different names for the same core offer, creating messaging inconsistency.”
- “The contact form is missing visible labels for important fields.”

### 2. Material over trivial

Not every imperfection deserves a finding.

The audit must favor issues that materially affect:
- user understanding,
- trust,
- accessibility,
- conversion clarity,
- technical health,
- discoverability,
- brand coherence,
- or decision-making.

Minor style preferences, micro-optimizations, and purely subjective improvements should not become major findings.

### 3. Stable over volatile

If the same website is audited twice without meaningful changes, the result should be substantially similar.

The system should not:
- rename the same issue in different words,
- change severity randomly,
- generate different findings because the prompt changed slightly,
- or create “fresh” issues that are just reframed versions of old ones.

### 4. Progress over punishment

Re-audits must reward real improvement.

If users fix important issues:
- those issues should disappear or be downgraded,
- the score should improve,
- the audit should acknowledge progress,
- and new audits should not erase prior fix history.

### 5. Guidance over critique

Every meaningful finding should help the user move forward.

A finding without clear explanation or practical fix guidance is not good enough for Fixpath.

## The Fixpath standard for reporting

For an issue to be reported as a real finding, it should pass this mental filter:

1. Is it real?
2. Is it evidenced?
3. Is it meaningful?
4. Is it distinct from other findings?
5. Is it actionable?
6. Is it worth the user’s attention now?

If the answer to multiple questions is “no,” it should not be reported as a prominent finding.

## What counts as a valid finding

A valid finding should generally meet all or most of the following criteria:

- clearly observable on the site or in structured signals,
- tied to a meaningful business, UX, accessibility, trust, or technical outcome,
- specific enough to understand,
- distinct enough not to duplicate another issue,
- actionable enough to fix,
- and stable enough to survive re-audit logic.

### Finding quality test

A finding is high quality when a user can say:

- “Yes, I see that.”
- “Yes, that matters.”
- “Yes, I know what to do next.”
- “Yes, I’ll expect this to go away after I fix it.”

If the user instead says:

- “This feels subjective.”
- “This is nitpicking.”
- “Didn’t I already fix this?”
- “Why is this suddenly a new issue?”

then the system has failed.

## What should be reported

### Report first: broken or materially weak things

These deserve top priority:

- broken functionality,
- missing or conflicting core messaging,
- serious trust gaps,
- meaningful accessibility barriers,
- serious discoverability issues,
- important technical failures,
- major consistency problems across critical pages,
- and missing information that blocks understanding or action.

### Report second: meaningful weaknesses

These are valid when clearly evidenced and impactful:

- weak value proposition clarity,
- important CTA ambiguity,
- inconsistent offer naming,
- missing proof on key commercial pages,
- important metadata gaps,
- low-confidence trust presentation,
- content structure problems that hurt readability,
- and performance issues that materially degrade experience.

### Report carefully: improvement opportunities

These should be lower priority and must be clearly separated from real problems.

Examples:
- stronger headline suggestion,
- tighter CTA wording,
- more confident proof framing,
- cleaner section order,
- tone refinement,
- copy recommendation.

These are **recommendations**, not hard failures, unless there is strong evidence that the current version creates confusion or friction.

## What should not be reported as major findings

Do not elevate these into meaningful findings unless they clearly create real impact:

- generic “could be better” copy suggestions,
- subjective style preferences,
- small wording changes with no clear outcome impact,
- speculative UX theories,
- duplicate issues across many pages reported as separate major findings,
- tiny technical imperfections with no meaningful consequence,
- and recommendations that are only there because the model feels it must say something.

## Severity rules

Severity must reflect actual impact, not the model’s enthusiasm.

### Critical

Use only when the issue likely causes severe damage or blocks access, trust, function, or understanding.

Examples:
- broken forms or broken key interactions,
- severe accessibility blockers,
- no clear statement of what the company does on the homepage,
- major trust failure on critical money pages,
- sitewide technical issue affecting key pages.

### High

Use for important issues that materially weaken outcomes but do not completely block them.

Examples:
- major messaging inconsistency across key pages,
- missing proof or trust elements on core conversion pages,
- important technical or metadata failures,
- high-impact accessibility problems,
- serious content hierarchy problems.

### Medium

Use for meaningful issues with moderate impact.

Examples:
- unclear CTA labels,
- moderate trust gaps,
- secondary content structure problems,
- partial consistency issues,
- page-level technical weakness not affecting the whole site.

### Low

Use for smaller issues, polish opportunities, or lower-risk improvements.

Examples:
- copy refinement suggestions,
- non-critical metadata improvement,
- lower-impact structural cleanup,
- softer UX polish notes.

### Never inflate severity

Do not use Critical or High to force urgency. If everything is severe, nothing is severe.

## Distinguishing issues from recommendations

This is one of the most important rules in the whole system.

### An issue

An issue is a real weakness, failure, contradiction, or risk that should materially affect the score.

### A recommendation

A recommendation is a possible improvement that may improve clarity, tone, persuasion, or polish, but is not necessarily a real defect.

### Reporting rule

Do not score recommendations as if they were hard failures.

Recommendations may exist in the audit, but they must:
- sit below true issues,
- have lower or zero score impact,
- and be clearly labeled as suggestions, not failures.

## The audit hierarchy

Every audit should distinguish between four layers:

1. **Verified issues** — clearly real, evidenced, material
2. **Meaningful weaknesses** — important but not catastrophic
3. **Recommendations** — useful improvements, lower confidence or lower impact
4. **Nice-to-haves** — optional, usually no score impact

A deep audit must not collapse all four layers into one giant list of “problems.”

## De-duplication rules

One of the main reasons audits feel unfair is duplicate reporting.

### Deduplication must happen across:

- pages,
- issue wording,
- categories,
- and re-audits.

### Example

If 12 pages have the same missing pattern, that may be:
- one issue with 12 affected pages,
- not 12 separate findings.

If the homepage, about page, and services page all use inconsistent names for the same service, that may be:
- one grouped consistency issue,
- not three unrelated wording findings.

### Canonical issue model

Each issue should have a canonical internal identity, such as:

- issue family,
- location scope,
- evidence scope,
- severity,
- first detected date,
- current status,
- fix verification state,
- last revalidated date.

This allows the same underlying issue to persist cleanly across audits instead of being reborn under new names.

## Re-audit truth model

This is mission-critical.

Re-audit behavior should not behave like every audit starts from zero memory.

### Re-audit must do three things in this order

1. Validate previously reported issues
2. Detect regressions
3. Discover truly new issues

That order matters.

### Re-audit question set

For every previously reported issue:

- does the same issue still exist?
- is it fully fixed?
- is it partially fixed?
- has it regressed?
- was it misdetected originally?

Only after this should the system search aggressively for new issues.

### Required states for prior findings

Each prior finding should be able to become:

- Fixed
- Improved
- Still present
- Regressed
- Duplicate / merged
- Superseded
- Invalidated

Without these states, re-audits will keep producing noise.

## The score philosophy

The score must behave like a trustworthy progress measure, not a moving target.

### Score requirements

- users must be able to improve it,
- important fixes must move it,
- repeated fixes must remain recognized,
- re-audits must not wipe out prior improvement,
- lower-value recommendations must not drag it down unfairly,
- and deeper audits must add confidence, not arbitrary penalty.

### Important rule

A deeper audit can reveal new real issues, but it must not disproportionately punish the user just because the system looked harder.

A deeper audit should be able to say:
- “We confirmed 18 fixes.”
- “We found 3 remaining important issues.”
- “We found 2 new lower-priority opportunities.”

That is healthy.

Not:
- “You fixed 18 things, but we found 24 more and your score is still terrible.”

### Recommended scoring approach

Score should be based mainly on:

- active verified issues,
- weighted by severity,
- weighted by scope,
- weighted by business relevance,
- minus validated improvements and resolved issues.

Recommendations and nice-to-haves should have very low or zero score impact.

## What matters by category

### Brand / clarity

Report only when there is real confusion, contradiction, inconsistency, or missing core narrative.

What matters:
- can a user understand what the company does quickly?
- do key pages tell the same story?
- are offer names consistent?
- is the value proposition clear?
- do CTA messages align with the actual offer?

Do not over-report subjective copy rewrites.

### Content quality

Report when structure, clarity, completeness, or relevance materially hurts comprehension or trust.

What matters:
- scannability,
- missing key information,
- unclear section logic,
- repetitive or contradictory content,
- weak page intent fulfillment.

Do not nitpick writing style.

### Trust signals

Report when important proof is absent, weak, inconsistent, or hidden on critical pages.

What matters:
- testimonials, reviews, proof,
- business legitimacy signals,
- contact clarity,
- policy visibility,
- pricing trust,
- claims without support.

### UX / readability

Report where layout, hierarchy, readability, or interaction patterns materially hinder use.

What matters:
- confusing navigation,
- unreadable content blocks,
- poor hierarchy,
- buried CTA,
- broken or frustrating flows.

Do not report micro-opinions on aesthetics as major issues.

### Technical / performance

Report real failures and meaningful weaknesses.

What matters:
- broken pages,
- broken assets,
- major speed problems,
- crawl/index issues,
- critical metadata failures,
- structural markup problems that affect function or discovery.

Do not flood the user with low-value technical trivia.

### Discoverability / SEO / AI readiness

Report when the site is materially hard to understand, index, or retrieve correctly.

What matters:
- missing or duplicated essential metadata,
- weak page targeting,
- poor internal linking on important pages,
- missing structured content clarity,
- indexability blockers,
- weak entity clarity for AI systems.

Do not turn every SEO best practice into a major issue.

### Accessibility readiness

Report real barriers and meaningful risks.

What matters:
- missing alt text where meaningful,
- form labeling problems,
- low contrast,
- missing accessible names,
- heading hierarchy errors,
- semantic problems,
- keyboard accessibility issues where supported.

Do not pretend automated detection equals legal certification.

## How findings must be written

Every finding should be written in a stable, clear format.

### Required structure

- **Finding** — what is wrong
- **Why it matters** — why the user should care
- **Evidence** — where/how it was observed
- **Impact** — what outcome it likely affects
- **Fix** — what to do
- **Scope** — how many pages/templates are affected
- **Confidence** — high / medium / low
- **Status on re-audit** — new / still present / improved / fixed / regressed

### Writing rules

- use plain language,
- avoid jargon when not needed,
- avoid vague statements,
- avoid model-ish hedging unless confidence is genuinely limited,
- avoid drama,
- avoid sounding like a generic SEO tool.

### Good example

**Finding:** The homepage hero does not clearly explain what the company offers.

**Why it matters:** New visitors may not understand the business within the first screen, which weakens trust and conversion clarity.

**Evidence:** The main heading is emotional but non-descriptive, and the first visible section does not name the service clearly.

**Impact:** Brand clarity, trust, conversion.

**Fix:** Rewrite the hero heading and supporting line to state the service, audience, and outcome more explicitly.

### Bad example

**Finding:** The homepage messaging could possibly be optimized for enhanced engagement.

That is vague, ungrounded, and unhelpful.

## Confidence model

Not all findings are equal.

Each finding should have confidence based on evidence quality.

### High confidence

- directly observable,
- repeated across important pages,
- strongly supported by structured or visual evidence,
- low ambiguity.

### Medium confidence

- supported, but partially interpretive,
- page scope may be narrower,
- effect is likely but not guaranteed.

### Low confidence

- suggestion-level,
- subjective,
- weak evidence,
- should not significantly affect score.

### Important rule

Low-confidence findings should never meaningfully tank the audit score.

## Fresh audit vs deep audit

A deep audit should increase coverage and confidence, not just issue volume.

### A fresh deep audit should do more of this

- validate previously known issues,
- check more templates and sections,
- confirm fixes across page variants,
- detect sitewide patterns with better evidence,
- refine scope and confidence.

### It should do less of this

- manufacture extra findings,
- split one issue into ten,
- downgrade prior fixes because wording changed,
- surface endless copy opinions.

## Do's and don'ts

### Do

- prioritize real, material issues,
- merge duplicates,
- validate past fixes before introducing new problems,
- reward improvement in the score,
- separate verified issues from recommendations,
- keep language stable across audits,
- explain impact clearly,
- track issue lifecycle over time,
- use deep audits to improve confidence and coverage,
- make the product feel fair.

### Don't

- always try to find something new,
- relabel the same issue as a new one,
- punish deeper auditing with harsh score drops,
- report weak copy suggestions as major failures,
- inflate severity,
- make recommendations sound like defects,
- ignore prior fix history,
- bury the user in low-value noise,
- let the system behave like a generic scanner,
- let the score feel impossible to improve.

## Non-negotiable re-audit rules

These rules should be hard requirements in the audit logic:

1. Previously fixed issues must not reappear unless strong new evidence shows they are still present.
2. Existing issue families must be matched before creating new findings.
3. New findings must pass a higher bar on re-audit than on a first audit.
4. Recommendations must not outweigh verified fixes.
5. Score movement must reflect meaningful progress.
6. The audit must explicitly acknowledge what improved.
7. Deep audits must improve truth, not just density.

## What success looks like

A good re-audit experience should feel like this:

- “The product recognized what we fixed.”
- “The score improved in a believable way.”
- “The remaining issues feel real.”
- “The new findings are genuinely new and worth attention.”
- “The recommendations are helpful but not noisy.”
- “The audit feels fair.”

That is how trust is built.

## Implementation expectations for Claude

Claude needs to use this document as a product and logic standard, not as soft inspiration.

### Claude must implement

- canonical issue matching across audits,
- re-audit reconciliation logic,
- duplicate collapse rules,
- issue vs recommendation separation,
- severity discipline,
- lower score weight for low-confidence findings,
- explicit progress recognition,
- and stable wording / issue identity behavior.

### Claude must avoid

- volatile audit outputs,
- endless copy critique,
- score nihilism,
- duplicated issue families,
- and “always find something” behavior.

## Direct instruction to Claude

Build the audit engine so users feel that Fixpath is on their side.

The system should say:
- here is what is truly wrong,
- here is what you fixed,
- here is what still matters,
- here is what is newly discovered,
- and here is what is merely optional.

That is the Fixpath standard.

## Copy-paste instruction block for Claude

```text
Use this as the audit logic standard for Fixpath.

Fixpath is not an issue factory. It is a Find / Fix / Track system.
The audit engine must optimize for truth, trust, usefulness, and progress.

Core rules:
1. Report only real, evidenced, material issues.
2. Do not inflate low-value suggestions into major findings.
3. Separate verified issues from recommendations and nice-to-haves.
4. Deduplicate findings across pages, categories, and audits.
5. On re-audit, validate previous issues first, detect regressions second, and only then add truly new issues.
6. Do not relabel the same issue as a new one.
7. Do not let deep audits punish users unfairly just because more pages were checked.
8. The score must reward real fixes and reflect meaningful progress.
9. Low-confidence or subjective findings should have low or zero score impact.
10. Every finding must be specific, evidenced, clearly written, and actionable.

Every finding should include:
- Finding
- Why it matters
- Evidence
- Impact
- Fix
- Scope
- Confidence
- Re-audit status

Severity rules:
- Critical only for severe blockers or major failures
- High for important material weaknesses
- Medium for meaningful but moderate issues
- Low for lower-risk issues or refinements
- Recommendations should not behave like hard failures

Re-audit rules:
- Match canonical issue families before creating new findings
- Preserve issue lifecycle states: fixed, improved, still present, regressed, duplicate/merged, superseded, invalidated
- Explicitly show what improved
- New findings on re-audit must pass a higher quality bar

The product should feel fair.
Users must feel that:
- Fixpath recognized what was fixed
- the score can improve
- remaining issues are real
- new findings are genuinely new
- recommendations are useful, not noisy

Do not build an engine that always tries to find something.
Build an engine that tells the truth.
```

