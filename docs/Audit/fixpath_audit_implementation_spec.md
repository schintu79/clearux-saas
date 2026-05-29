# Fixpath Audit Implementation Spec

This document turns the Fixpath Audit Bible into an implementation standard for Claude. The Audit Bible defines the product truth: report real issues, reward real fixes, avoid noisy re-audits, and make the score feel fair. This implementation spec defines how to operationalize those principles in the Fixpath codebase, audit pipeline, scoring logic, and Supabase-backed data model. Fixpath runs on a React/TypeScript + Supabase stack, already has an audit engine, findings/status concepts, and needs re-audits to reconcile current results against previous findings instead of treating every audit like a blank slate. [cite:328][cite:458]

## Goal

Claude should implement an audit system where:

- issues persist across audits under stable identities,
- re-audits reconcile rather than restart from zero,
- fixed issues stop dragging the score down,
- duplicate findings collapse correctly,
- recommendations do not behave like hard failures,
- and deep audits improve truth and coverage rather than simply increasing issue count. [cite:458]

## Core implementation rules

### Rule 1 — Every real issue needs a canonical identity

Do not store findings as isolated freeform text blobs only. Every issue that can survive across audits must have a stable **canonical issue identity**.

### Rule 2 — Findings and issues are not the same thing

- An **issue** is the canonical problem family.
- A **finding** is one audit’s current observation of that issue.

This distinction is essential.

Example:
- Issue family: `homepage_value_prop_unclear`
- Audit A finding: homepage unclear
- Audit B finding: still present, improved
- Audit C finding: fixed

The issue identity remains stable even as the finding status changes.

### Rule 3 — Re-audit reconciles before it discovers

On re-audit:
1. Match against historical issues first.
2. Update existing issue states.
3. Only create net-new issues when no valid match exists.

### Rule 4 — Recommendations must not be first-class score killers

Recommendations can be stored and shown, but should either:
- not create canonical issue families, or
- create low-impact suggestion records separate from verified issues.

## Proposed data model

The exact table names can be adjusted to fit the existing schema, but the logical model should be this.

### 1. audits

Represents an audit run.

Suggested fields:
- `id`
- `workspace_id`
- `site_id` or `brand_id`
- `audit_type` (`first_audit`, `reaudit`, `deep_audit`, etc.)
- `trigger_source` (`manual`, `scheduled`, `post_fix`, etc.)
- `status`
- `started_at`
- `completed_at`
- `crawl_provider`
- `crawl_summary_json`
- `coverage_summary_json`
- `overall_score`
- `score_version`
- `previous_audit_id`

### 2. issue_families

Canonical issue definitions across the workspace/site.

Suggested fields:
- `id`
- `workspace_id`
- `site_id` or `brand_id`
- `category_key`
- `issue_key` (stable machine-friendly key)
- `issue_type` (`verified_issue`, `meaningful_weakness`, `recommendation`, `nice_to_have`)
- `title_canonical`
- `description_canonical`
- `default_severity`
- `score_weight`
- `matching_strategy`
- `created_at`
- `first_seen_audit_id`
- `last_seen_audit_id`
- `current_lifecycle_state`

### 3. audit_findings

Specific observations of issue families in a given audit.

Suggested fields:
- `id`
- `audit_id`
- `issue_family_id`
- `workspace_id`
- `site_id` or `brand_id`
- `category_key`
- `status_in_audit` (`new`, `still_present`, `improved`, `fixed`, `regressed`, `duplicate`, `superseded`, `invalidated`)
- `severity_current`
- `confidence`
- `score_impact`
- `title_rendered`
- `finding_text`
- `why_it_matters`
- `evidence_json`
- `fix_recommendation`
- `impact_summary`
- `scope_json`
- `page_count_affected`
- `template_types_json`
- `is_user_confirmed_fixed`
- `is_hidden_from_primary_feed`
- `created_at`

### 4. finding_evidence

Optional normalized evidence table if needed.

Suggested fields:
- `id`
- `audit_finding_id`
- `evidence_type` (`page`, `dom_signal`, `crawl_signal`, `content_pattern`, `screenshot`, etc.)
- `page_url`
- `selector_or_location`
- `raw_value`
- `normalized_value`
- `snapshot_json`

### 5. issue_lifecycle_events

Audit history / state change log.

Suggested fields:
- `id`
- `issue_family_id`
- `audit_id`
- `event_type` (`detected`, `matched`, `improved`, `fixed`, `regressed`, `merged`, `invalidated`, `reopened`)
- `old_state`
- `new_state`
- `reason`
- `metadata_json`
- `created_at`

### 6. score_snapshots

Optional but recommended for explainability.

Suggested fields:
- `id`
- `audit_id`
- `workspace_id`
- `site_id` or `brand_id`
- `category_key`
- `raw_score`
- `adjusted_score`
- `active_issue_count`
- `weighted_issue_total`
- `resolved_issue_credit`
- `recommendation_penalty`
- `calculation_json`
- `created_at`

## Canonical issue identity design

Each issue family needs a deterministic or semi-deterministic identity strategy.

### Canonical key pattern

Use a normalized issue key pattern like:

`{category}.{issue_family}.{scope_signature}`

Examples:
- `brand.value_prop_unclear.homepage`
- `trust.missing_social_proof.pricing-template`
- `accessibility.missing_form_labels.contact-form`
- `technical.missing_meta_description.page:/services/seo`

### Scope signature guidance

Scope should not be too narrow or too broad.

Good scope signatures:
- homepage
- pricing-template
- contact-template
- sitewide
- page:/specific-url when truly page-specific

Avoid unstable keys based on wording, timestamps, or model phrasing.

## Matching logic on re-audit

This is the heart of the system.

### Matching order

For each newly generated potential finding from the current audit:

1. attempt exact canonical key match
2. if not found, attempt same category + same issue family + overlapping scope
3. if still not found, attempt semantic/evidence similarity match
4. if still not found, create a new issue family

### Matching inputs

Match using a combination of:
- category key
- issue family key
- normalized URL/template scope
- evidence shape
- affected page cluster
- selector / metadata / structural signature where applicable
- textual similarity only as a secondary fallback

### Important rule

Do not use freeform LLM wording as the primary identity layer.
Text changes. The issue identity should survive wording changes.

## Suggested reconciliation algorithm

### Phase 1 — Load prior context

Given `current_audit_id`:
- fetch the previous successful audit for the same workspace/site
- fetch open issue families
- fetch most recent findings for each issue family
- fetch user-marked fixes / fix-console states

### Phase 2 — Generate raw current detections

Run crawl + analyzers to produce raw detection candidates.
These should still be intermediate objects, not final user-visible findings.

### Phase 3 — Normalize detections

Normalize each detection into:
- category
- issue family candidate
- scope signature
- severity
- confidence
- evidence bundle
- fix type
- score class

### Phase 4 — Match against existing issues

For each normalized detection:
- try to match an existing issue family
- if matched, update status appropriately
- if unmatched, create new issue family + new finding

### Phase 5 — Reconcile missing old issues

For every previously open issue family not matched in the current audit:
- verify whether the issue is truly absent
- if absent, mark as `fixed` or `invalidated`
- if evidence is incomplete, mark as `not_revalidated` internally instead of immediately resurfacing it

### Phase 6 — Produce user-facing findings

Only after reconciliation should the final findings feed be built.
This feed should be grouped into:
- fixed / improved since last audit
- still active important issues
- regressions
- net-new issues
- optional recommendations

## Lifecycle states

Every canonical issue family should support these states:

- `open`
- `improved`
- `resolved`
- `regressed`
- `merged`
- `invalidated`
- `archived`

Every audit finding instance should support these states:

- `new`
- `still_present`
- `improved`
- `fixed`
- `regressed`
- `duplicate`
- `superseded`
- `invalidated`

These states should not be inferred only in the UI. They should exist in the stored model.

## Score model specification

The score must feel explainable and fair.

### Score inputs

The category and overall scores should be driven mainly by active verified issues.

Use inputs such as:
- severity weight
- business relevance weight
- scope multiplier
- confidence modifier
- recency / validation modifier
- fixed-issue credit

### Suggested severity weights

Example starting model:
- Critical = 20
- High = 10
- Medium = 4
- Low = 1

These are relative weights, not direct score deductions.

### Suggested modifiers

- `business_relevance_multiplier`: 0.75 to 1.5
- `scope_multiplier`: 1.0 for single page, 1.25 for key template, 1.5 for sitewide
- `confidence_multiplier`: 1.0 high, 0.7 medium, 0.3 low
- `recommendation_multiplier`: 0 to 0.15 max

### Important scoring rule

Low-confidence recommendations should not substantially lower the score.

### Sample issue penalty formula

```ts
issuePenalty = severityWeight * businessRelevanceMultiplier * scopeMultiplier * confidenceMultiplier
```

### Category score model

A simple starting model:

```ts
categoryScore = clamp(100 - activePenaltyTotal + resolvedCredit, 0, 100)
```

Where:
- `activePenaltyTotal` is the weighted sum of current active verified issues
- `resolvedCredit` softly rewards validated improvements since the previous audit without inflating the score unrealistically

### Overall score model

Use a weighted blend of category scores.
Recommendations should not directly dominate the overall score.

## Re-audit score behavior rules

These are non-negotiable:

1. If a High or Critical issue is fixed and validated, the score must improve meaningfully.
2. If only low-confidence recommendations remain, the score should not be terrible.
3. A deep audit may reduce the score when it reveals serious real issues, but not because it found many low-value suggestions.
4. Re-audit should preserve improvement memory.
5. Previously resolved issues should stop penalizing active score unless regression is detected. [cite:458]

## Category handling rules

### Verified issue categories

Categories should support issue classification like:
- `brand`
- `content`
- `trust`
- `ux`
- `technical`
- `discoverability`
- `accessibility`

### Recommendation handling

Store recommendation-only items separately or with `issue_type = recommendation` and near-zero score weight.

Do not mix recommendations into the same top-priority feed as verified issues.

## Brand logic implementation

Brand analysis needs identity-aware fallback behavior.
The user explicitly wants the system to avoid showing misleading brand consistency results when no brand identity has been provided. [cite:458]

### Required logic

```ts
if (hasBrandIdentityBaseline) {
  mode = 'brand_consistency';
  label = 'Brand Consistency';
} else {
  mode = 'brand_clarity_signals';
  label = 'Brand Clarity Signals';
}
```

### Scoring rule

Do not score “Brand Consistency” against a missing baseline.
If no identity exists, run a lower-claim fallback analysis focused on messaging coherence.

## Deep audit behavior

A deep audit should not simply mean “more findings.”
It should mean:
- broader coverage
- higher confidence
- more template validation
- better issue grouping
- better regression detection

### Deep audit implementation rules

- increase page coverage
- increase template coverage
- verify prior issue scope more thoroughly
- increase evidence confidence where possible
- use a stricter bar for creating net-new findings than on first audit

### Net-new finding gate on deep audit

A new finding should be promoted only if:
- it is clearly distinct,
- clearly evidenced,
- materially important,
- and not a reframing of an already tracked issue.

## Finding generation contract

Claude should not generate arbitrary final finding text from scratch every time.
Instead, use a structured generation contract.

### Required finding output fields

For each user-visible finding, generate:
- `canonical_issue_key`
- `category_key`
- `issue_type`
- `title`
- `finding`
- `why_it_matters`
- `evidence_summary`
- `impact_summary`
- `fix_recommendation`
- `severity`
- `confidence`
- `scope`
- `status_in_audit`
- `score_impact`

### Important writing rule

Rendered wording can improve for readability, but it must map back to a stable canonical issue identity.

## UI output rules

The UI should reflect reconciliation, not just raw detections.

### Required audit summary blocks

Show clearly:
- fixed since last audit
- improved since last audit
- still active important issues
- regressions
- net-new important issues
- optional recommendations

### Feed ordering

Recommended order:
1. regressions
2. still-active critical/high issues
3. net-new important issues
4. improved/fixed confirmations
5. lower-priority recommendations

### Why this matters

This ordering makes the audit feel fair and useful. Users immediately see progress and current priorities instead of being buried in noise. [cite:458][cite:463]

## Fix Console integration

The user wants fix actions saved through the console to update finding status and improve the score when issues are no longer present. [cite:458]

### Required behavior

When a user saves or approves a fix in the Fix Console:
- attach the action to the relevant issue family or finding
- mark it as `pending_verification` or similar
- on next audit, prioritize revalidation of those issues
- if validated fixed, update lifecycle state and score

### Suggested fields

On issue or finding records, support:
- `fix_status` (`none`, `suggested`, `approved`, `implemented`, `pending_verification`, `validated_fixed`)
- `fix_source` (`user`, `ai_console`, `manual`, `cms_push`, etc.)
- `fix_updated_at`

## Data migration guidance

Because the user wants workspaces to become the primary model, audit and issue entities should be keyed to `workspace_id` first, then site/brand scope second. [cite:460]

### Migration principles

- preserve historical audit records
- backfill canonical issue families from recent findings where possible
- do not break existing dashboards while migrating
- support a transitional compatibility layer if current findings tables already exist

### Safe migration path

1. add canonical issue family support without removing old findings
2. backfill issue families from recent active findings
3. update audit creation flow to write both old and new structures temporarily
4. switch reconciliation and score logic to canonical issue model
5. retire old direct-only finding logic later

## Pipeline orchestration requirements

The user also wants the crawling pipeline simplified and made more reliable, ideally using a single main tool rather than many fragmented ones. [cite:458]

### Audit pipeline stages

1. create audit run
2. crawl/map/scrape site
3. normalize raw data
4. run category analyzers
5. generate normalized detections
6. reconcile with prior issues
7. compute category + overall scores
8. generate user-facing findings and summaries
9. persist score snapshots and lifecycle events
10. update UI progressively

### Important rule

Do not let LLM text generation happen before normalization and reconciliation.
The model should not define issue identity at the final prose stage.

## QA checklist for Claude

Claude should verify all of the following:

### Re-audit behavior

- fixed issues disappear or become resolved
- improved issues show reduced severity or status change
- same issue family is not recreated under new names
- regressions are correctly identified
- unmatched old issues are not blindly resurfaced

### Score behavior

- meaningful fixes produce meaningful score gains
- recommendation-heavy audits do not create terrible scores
- deep audit does not produce unfair penalty inflation
- category score explanations map to stored calculation data

### Data integrity

- issue_family_id is stable across audits
- lifecycle events are recorded correctly
- audit findings always map to one canonical issue family unless explicitly recommendation-only
- duplicate merges do not create double penalties

### UX behavior

- users can see what improved since last audit
- users can distinguish new issues from old unresolved issues
- users can distinguish verified issues from recommendations
- audit feels fair, stable, and comprehensible

## Direct instruction block for Claude

```text
Implement the Fixpath audit engine using canonical issue families and re-audit reconciliation.

The audit system must not treat every audit as a blank slate.
Use stable issue identities, reconcile before discovering, and reward validated fixes.

Implementation requirements:
1. Add canonical issue family support across audits.
2. Separate issue families from audit-specific findings.
3. Reconcile prior issues before creating new ones.
4. Track lifecycle states for issues and findings.
5. Keep recommendations separate from verified issues and give them low or zero score impact.
6. Make score movement reflect real fixes and real active issues.
7. Support workspace-first scoping in the data model.
8. Make deep audits improve coverage/confidence, not just issue count.
9. Preserve stable issue identity even if rendered wording changes.
10. Update the UI to show fixed, improved, still active, regressed, and new issues clearly.

Use the Audit Bible as the product truth and this implementation spec as the operational blueprint.
```

