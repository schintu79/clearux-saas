# Fixpath Audit Processing Bible

## Purpose

This document defines the final processing layer that runs after the audit has already collected signals, raw observations, technical checks, page analysis, AI perception outputs, and supporting evidence.

This is the layer that makes Fixpath different.

Any AI system can generate hundreds of findings. Fixpath must decide:
- what is actually worth surfacing,
- why it matters,
- for whom it matters,
- how severe it is,
- whether it belongs in the final report,
- and whether it should be merged, suppressed, or escalated.

The objective is not volume.  
The objective is surgical truth.

---

## Core Principle

Fixpath does not grade taste.  
Fixpath measures signals.

A site can look expensive and still confuse users.  
A site can look simple and still perform very well.  
A visually elegant site can still fail structurally.  
A minimal site can still be highly effective.

Findings must never be based on personal aesthetic preference.  
Findings must be based on observable structural, technical, behavioural, trust, clarity, and market-relevant signals.

Every surfaced finding must answer five questions:
1. What is happening?
2. Why is it a real issue?
3. Who does it affect?
4. What business or user outcome does it harm?
5. Why is it worth surfacing now?

If a candidate issue cannot answer those five questions clearly, it should not become a surfaced finding.

---

## Where This Layer Sits

This document governs the **final processing stage** only.

The audit pipeline should be understood as:

1. **Collection**
   - Crawl pages
   - Extract layout, hierarchy, content, metadata, UI patterns, navigation, trust signals, performance data, accessibility signals, AI extraction signals, brand data, and cross-page consistency cues

2. **Detection**
   - Generate raw candidate issues from rules, heuristics, AI interpretation, pattern matching, and system checks

3. **Contextual Classification**
   - Infer site type, industry, audience, primary tasks, market, and cultural context

4. **Final Processing and Filtering**
   - Apply Fixpath’s signal model
   - Remove noise
   - Merge duplicates
   - Escalate meaningful issues
   - Suppress low-value stylistic chatter
   - Output only findings that are true, material, and useful

This document governs step 4, using the context built in step 3.

This layer must not create a new research phase.  
It must work from already collected evidence.  
It must add judgment, not latency.

---

## Non-Negotiable Output Standard

The final surfaced findings must be:
- true,
- evidence-backed,
- relevant to the site’s actual role,
- shaped by industry and audience expectations,
- adapted to market and cultural context when relevant,
- free of vanity critique,
- free of filler,
- free of duplicated noise,
- actionable,
- and proportionate in severity.

Do not inflate.  
Do not soften.  
Do not decorate.  
Do not produce audit theatre.

---

## What Must Be Understood Before Filtering

Before finalizing any surfaced issue, the processor must infer or confirm these dimensions.

### 1. Site Type

Examples:
- SaaS marketing site
- B2B product site
- e-commerce store
- fintech / banking / trading platform
- hospitality / venue / booking site
- education / school / course site
- healthcare / clinic site
- real estate site
- content / editorial site
- creative portfolio
- personal brand / artist profile
- non-profit / institution
- documentation site
- product dashboard

### 2. Industry / Vertical Expectations

Each industry carries different expectations for:
- trust,
- discoverability,
- clarity,
- navigation,
- decision support,
- reassurance,
- legal sensitivity,
- conversion support,
- perceived legitimacy,
- and information density.

### 3. Primary Audience

Examples:
- general public
- retail consumers
- enterprise buyers
- investors
- students
- patients
- guests
- donors
- niche collectors
- creative peers
- operators / internal teams

### 4. Primary Task Intent

Examples:
- understand the offer
- compare options
- request a quote
- book a space
- reserve a stay
- buy a product
- contact the business
- create an account
- invest / trade
- verify trust and legitimacy
- read and evaluate information

### 5. Geographic and Cultural Context

Examples:
- Italy / EU
- GCC / Middle East
- USA
- multilingual / cross-border audience

This matters for:
- wording expectations,
- trust cues,
- reassurance style,
- regulatory sensitivity,
- interpretation of claims,
- user expectations around navigation and interaction,
- and how explicit or conservative messaging should be.

### 6. Brand DNA Context

If Brand DNA exists, use it for:
- consistency checks,
- tone alignment,
- promise alignment,
- terminology consistency,
- visual system consistency,
- and asset coherence.

Brand DNA must not be used to excuse structural, usability, trust, or navigation problems.

---

## The Fixpath Signal Model

Every candidate issue must be scored internally on these dimensions before it can become a surfaced finding.

### A. Structural Signal

Does this affect structure, hierarchy, information architecture, navigation, or task flow?

### B. Clarity Signal

Does this reduce comprehension, orientation, expectation-setting, or message clarity?

### C. Trust Signal

Does this weaken legitimacy, reassurance, transparency, credibility, or professional confidence?

### D. Friction Signal

Does this add avoidable effort, hesitation, confusion, or task delay?

### E. Market-Fit Signal

Is the issue material specifically because of the industry, audience type, country, or cultural context?

### F. Consistency Signal

Does this break consistency across pages, states, labels, actions, flows, or brand expression?

### G. Technical Signal

Does this affect crawlability, accessibility, indexing, rendering, loading, responsiveness, or machine extraction?

### H. Actionability Signal

Can the issue be explained clearly and improved in a practical way?

A surfaced finding should usually be strong on at least **two** of these signals.  
A high-severity finding should usually be strong on **three or more**.

---

## Filtering Rules

### Surface a Finding When

Surface a finding when the issue:
- materially harms a user’s ability to understand, trust, navigate, compare, decide, convert, or complete a core task;
- is clearly mismatched with the expectations of the site’s category, industry, or market;
- is repeated across important pages or templates;
- creates a structural weakness visible to users or AI systems;
- materially affects discoverability, credibility, usability, accessibility, or business outcomes;
- deserves prioritization over weaker observations.

### Suppress a Finding When

Suppress a finding when the issue:
- is mostly aesthetic preference;
- is too minor to matter in the context of the site’s actual goals;
- duplicates a stronger finding that already covers the same root cause;
- cannot be evidenced clearly;
- is technically true but commercially irrelevant;
- adds noise without changing what the user should do next.

### Merge Findings When

Merge findings when:
- multiple observations point to the same structural root cause;
- several pages show the same navigation, trust, or messaging breakdown;
- multiple low-level symptoms are clearly part of one broader problem.

Example:  
Do not create three separate findings for:
- hidden navigation,
- unclear path to booking,
- weak discoverability of key sections,

if they all stem from the same desktop navigation failure.

Create one stronger, broader finding with clearer impact.

---

## Severity Rules

Severity must not be assigned by raw defect count.  
Severity must reflect real-world impact.

### High Severity

Use high severity when the issue:
- materially blocks or delays a core task,
- undermines trust in a sensitive industry,
- hides essential actions or information,
- creates serious confusion for the expected audience,
- weakens conversion or discoverability in a commercially meaningful way,
- or breaks a core expectation of the site category.

### Medium Severity

Use medium severity when the issue:
- weakens clarity,
- increases friction,
- reduces trust,
- reduces conversion support,
- or creates a meaningful but not total breakdown in understanding or task flow.

### Low Severity

Use low severity when the issue:
- is real but secondary,
- has limited user impact,
- or is worth improving but is not urgent.

Never downgrade a structurally important issue because the site looks premium.  
Never upgrade a trivial issue because it is easy to detect.

---

## Navigation Rulebook

Navigation must always be judged by:
- site type,
- audience expectation,
- task criticality,
- and market context.

### Desktop Navigation Rule

For mainstream commercial, institutional, and public-facing sites, hiding the full primary navigation behind a hamburger menu on desktop is usually a structural issue.

This applies especially to:
- hospitality / venue websites,
- fintech / banking / trading sites,
- SaaS and B2B product sites,
- education sites,
- healthcare sites,
- real estate sites,
- booking or service websites,
- and any site where users need to understand options and move to action quickly.

Why it matters:
- it lowers discoverability,
- hides key pathways,
- delays orientation,
- makes the offer harder to scan,
- and weakens first-impression clarity and confidence.

### Exception Rule

Do not automatically flag hidden desktop navigation as high severity for:
- personal artist sites,
- experimental portfolios,
- niche creative experiences,
- or intentionally small, exploratory sites,

if the audience expectation is clearly different and the main task remains reasonably accessible.

### Casa Nave Alle Mura Example

For a hospitality / cultural venue website intended for the general public, the desktop header should help users quickly discover:
- spaces,
- uses,
- contact,
- booking or inquiry paths,
- and key information.

If the desktop site shows only a hamburger icon and no visible primary links, this must be surfaced as a real finding.

Recommended classification:
- category: UX / Navigation / Discoverability
- severity: high or medium-high depending on the rest of the site
- rationale: this is not a taste issue; it delays orientation and hides key actions for a public-facing venue site.

---

## Cultural and Market Rules

Fixpath must adapt the interpretation of findings to market context.

### Language and Reassurance

The same wording can perform differently depending on region and category.

Examples:
- financial copy in GCC or KSA markets may require stronger reassurance, trust language, and more careful claims;
- hospitality messaging in Italy may need clearer practical information and easier scanning for mixed local/international audiences;
- direct, aggressive, hype-heavy language may reduce trust in sectors where caution, authority, or compliance matter.

### What to Evaluate

Fixpath should assess:
- whether wording matches the expectations of that market and industry,
- whether language creates clarity or uncertainty,
- whether reassurance signals are sufficient for that audience,
- whether the tone supports trust,
- and whether important claims may be interpreted differently in that region.

### Important Constraint

Do not turn this into generic cultural stereotyping.  
Only surface a cultural or market finding when there is a real impact on trust, clarity, interpretation, or conversion confidence.

---

## Category-Specific Processing Guidance

### UX / Navigation / Information Architecture

Prioritize findings about:
- hidden key pathways,
- unclear hierarchy,
- weak desktop navigation,
- misleading labels,
- fragmented wayfinding,
- unclear next steps,
- and inconsistent page structure when it slows understanding.

### Brand / Design Consistency

Evaluate:
- consistency of headings,
- CTAs,
- language,
- component systems,
- visual cues,
- and page patterns,

without criticizing aesthetic taste itself.

Good finding:
- “The page system shifts between editorial, brochure, and product patterns without a stable hierarchy, which makes the offer harder to understand.”

Bad finding:
- “The design feels old-fashioned.”

### Trust

Evaluate:
- transparency,
- credibility,
- policy visibility,
- reassurance,
- contact and legitimacy signals,
- mismatch between claims and evidence,
- and whether the trust layer matches the sensitivity of the industry.

### Content / Messaging Clarity

Evaluate:
- whether a first-time visitor can understand the offer quickly,
- whether the messaging is concrete,
- whether important distinctions are hidden,
- whether claims are too vague or too promotional,
- and whether users and AI systems can extract the right meaning.

### Technical / SEO / Accessibility

Technical findings should still be prioritized by impact.  
Do not overload the report with low-value technical trivia.

Surface technical issues that materially affect:
- extraction,
- indexing,
- accessibility,
- rendering,
- performance,
- responsiveness,
- or machine understanding.

---

## Required Internal Questions Before Surfacing Any Finding

Before a finding is surfaced, the processor must ask:
1. Is this issue observable and evidence-backed?
2. Is it relevant for this site’s actual category and audience?
3. Is it structurally meaningful, not aesthetic commentary?
4. Does it have real user, business, trust, or discoverability impact?
5. Is it stronger than the noise around it?
6. Does it duplicate a broader root cause already captured?
7. Is the severity proportional to the actual harm?

If the answer is not clearly yes, suppress or merge it.

---

## Required Finding Format

Every surfaced finding should follow this logic.

### 1. What is happening

State the issue plainly and concretely.

### 2. Why it matters here

Tie it to the site’s category, audience, task, market, or trust expectations.

### 3. Practical impact

State the consequence for users, business outcomes, discoverability, trust, or conversion.

### 4. Why it deserves space

Make clear why this is one of the issues worth surfacing.

### Example

**Hidden primary navigation on desktop reduces discoverability**  
On desktop, the main navigation is hidden behind a hamburger icon with no visible section links. For a hospitality venue site aimed at the general public, users expect immediate access to spaces, uses, contact, and booking or inquiry paths. This slows orientation, hides important content pathways, and weakens the site’s ability to convert early interest into action.

---

## Anti-Patterns to Avoid

The processing layer must avoid these failures.

### 1. Fear-Based Under-Reporting

Do not become so afraid of noise that obvious structural problems are ignored.

### 2. Taste Disguised as Analysis

Do not turn subjective design preference into a finding.

### 3. Premium Bias

Do not assume elegant visuals mean good UX.

### 4. Volume Bias

Do not surface many weak findings instead of a few strong ones.

### 5. Rule-Only Blindness

Do not apply heuristics without checking site type, audience, market, and context.

### 6. Technical Tunnel Vision

Do not prioritize easy-to-detect technical issues over more important structural or trust problems.

### 7. Brand Excuse Bias

Do not use “brand style” or “creative direction” as an excuse for broken navigation, weak discoverability, confusing hierarchy, or poor task flow.

---

## Operating Principle for Claude

When in doubt:
- prefer truth over politeness,
- prefer structure over style commentary,
- prefer one strong merged finding over five weak ones,
- prefer context-aware judgment over generic heuristics,
- prefer business-relevant clarity over audit theatre,
- and prefer the site’s actual audience over internal assumptions.

Fixpath’s value is not in generating more findings.  
Fixpath’s value is in surfacing the right findings, for the right reason, in the right context.

That principle must govern every final audit output.

---

## Minimal Wrapper for Every Audit

This wrapper should be attached to the final processing stage without adding new collection time.

```text
FINAL PROCESSING LAYER — FIXPATH

You are now in the final audit processing stage.
Do not collect new evidence.
Do not generate more raw findings.
Work only with the findings, context, and evidence already collected.

Your job is to filter and refine candidate findings using the Fixpath Audit Processing Bible.

Rules:
1. Do not grade taste. Measure signals.
2. Infer site type, industry, audience, primary task, market, and cultural context from existing evidence.
3. Surface only issues that materially affect clarity, navigation, trust, consistency, discoverability, task completion, or technical accessibility.
4. Suppress findings that are mostly aesthetic preference, too minor, duplicative, weakly evidenced, or commercially irrelevant.
5. Merge findings that share the same structural root cause.
6. Severity must reflect real-world impact, not defect count.
7. For mainstream desktop websites, hidden primary navigation behind a hamburger is usually a structural issue unless the site is clearly niche, artistic, or experimental.
8. Brand DNA can inform consistency checks, but must never excuse structural UX problems.
9. Output only the strongest, clearest, evidence-backed findings.
10. Every final finding must clearly state:
   - what is happening,
   - why it matters here,
   - practical impact,
   - and why it deserves space in the report.

Your goal is not to be generous or harsh.
Your goal is to be surgically true.
