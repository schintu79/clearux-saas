# Plan: Eliminate LLM Noise (the accuracy moat)

**Goal:** drive the false-positive rate of findings to near-zero and make it *measurable*, so
"the most accurate audit on the market" is a published number, not a claim. The competitive
moat is not "we use AI" — everyone does — it's "we never tell you something is broken when it
isn't, and we can prove our false-positive rate."

**The uncomfortable truth this plan is built on:** you cannot prompt your way out of this. The
"don't claim absence without evidence" rule is *already* on /methodology, and the model still
shipped 3 false absence-claims as HIGH findings. Instructions are not guarantees. The only
durable fix is architectural: stop asking the LLM structural questions, and verify every claim
it does make against the real DOM before it's allowed to exist.

---

## Root cause

Run-1 ledger (`DETECTION_SOURCE_ACCURACY.md`): **every confirmed AI error is a false claim of
ABSENCE** ("no `<main>`", "labels not connected", "no Contact link") — in categories axe already
measures perfectly. Three compounding causes:

1. **Input starvation.** The LLM reasons over a truncated/cleaned text extraction, not the
   rendered DOM. Structural elements (landmarks, `label[for]`, footer links) are simply not in
   its view, so it infers they're missing.
2. **No enforcement gate.** The "no absence without proof" rule is a prompt line, not a
   validation step. Nothing drops a finding that violates it.
3. **Overlap + confidence laundering.** The LLM is allowed to emit findings in axe's territory,
   and a finding self-tagged *"Not enough evidence"* still surfaced as a HIGH and capped the
   score.

---

## The fix: defense in depth (the LLM proposes, the DOM disposes)

### P0 — kill the false positives by construction (this sprint, low effort, huge impact)

**1. Category ownership / LLM allow-list.** Classify every finding category as *structural*
(deterministic-only) or *interpretive* (LLM-allowed). Structural = landmarks, form-label
association, contrast, target size, heading order, alt/SVG names, link/meta presence. The LLM is
**prohibited** from emitting findings in structural categories — those are axe/parser territory.
This removes all 3 false positives by construction, with zero loss of real signal.

**2. Severity ≤ evidence invariant.** Hard rule, unit-tested: a finding tagged "Not enough
evidence" can never be HIGH/critical and never contributes to the score cap. Kills the
confidence-laundering bug (the contact-form finding) immediately.

*Files: finding category map (new) + the analysis-model post-processing in the audit pipeline;
`severity-cap.ts` / `trust-summary.ts` for the invariant. Both small, both regression-tested.*

### P1 — the durable moat: verify claims against ground truth

**3. Claim → DOM verification gate.** Before any AI finding persists, run a deterministic
post-check against the rendered DOM/artifact:
- "no `<main>`" → query for the `main` landmark; present ⇒ **drop**.
- "labels not connected" → compute `label[for]` / `aria-labelledby` coverage; covered ⇒ **drop**.
- "no Contact link" → scan anchors; present ⇒ **drop**.
A small library of falsifiers for the common absence-claims. The model can claim what it wants;
the DOM overrules it. This is the single highest-leverage *durable* fix — it generalizes beyond
the categories we hard-block in P0.

**4. Mandatory evidence binding.** Every AI finding must carry a verbatim quote *or* a DOM
selector it's grounded in, as a required schema field validated at insert (checked-insert
pattern). No anchor ⇒ auto-demote to "Not enough evidence" and suppress from the cap. The model
can't assert into the void.

### P2 — make accuracy measurable and regression-proof

**5. Labeled truth-set + precision metric.** Turn the hand-verified ledger into a fixture: a set
of sites with known ground-truth findings. Every engine/model change runs against it and reports
**precision (false-positive rate) per detection source and category**. Gate deploys on FP rate.
This is what converts "most accurate" from a vibe into a defensible, published number — and what
stops the next model upgrade from silently regressing accuracy. Run 1 (fixpath.ai) is the seed.

### P3 — close the loop

**6. Feed the DOM structure to the model as facts, not prose.** Where the LLM legitimately needs
context, hand it a structured outline (landmark map, heading tree, label-coverage stats) as
ground truth so it never infers structure from a lossy extract.

**7. Dismissal telemetry.** Capture why users dismiss findings; track dismissal rate per
source/category as a live precision proxy that feeds back into what we trust.

---

## Sequencing

| Phase | Items | Effect |
|-------|-------|--------|
| **P0** (now) | 1 + 2 | All 3 false positives gone; confidence-laundering fixed |
| **P1** | 3 + 4 | Generalized absence-claim defense; no ungrounded findings |
| **P2** | 5 | FP rate measured + deploy-gated → the defensible market claim |
| **P3** | 6 + 7 | Richer input + production calibration loop |

## The honest framing for go-to-market

Don't promise "zero noise" — unfalsifiable, and one counterexample burns trust. Promise a
**measured, published false-positive rate** with a method anyone can audit (the truth-set + the
/methodology page). "We verify every structural claim against your live DOM; here's our
false-positive rate and how we measure it" is a moat competitors can't cheaply copy, because it's
infrastructure (verification gate + truth-set + metric), not a prompt.

> Engine work (heart code). To be folded into `docs/SERIES_A_ENGINEERING_PLAN.md` as a
> prioritized phase with debt items once sequencing is confirmed.
