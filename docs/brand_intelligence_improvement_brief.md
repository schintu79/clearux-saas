# Brand Intelligence Improvement Brief

The Brand Intelligence tab needs to evolve from a static score dump into a genuinely useful decision tool. The current screen already shows the intended foundations — multi-model querying, overview scores, model-level performance, competitor benchmark, and sentiment/signals — but the current experience reads as sparse, flat, and low-actionability. The attached screenshot shows that the page currently emphasizes a few scores and a simple list/table, while leaving too much empty space, too little explanation, no strong information hierarchy, and almost no practical “what to do next” guidance. [file:404]

Now that the product uses OpenRouter, the feature can become much richer because the app can query multiple major AI models through one integration and compare how the brand is understood, described, ranked, and differentiated across models. OpenRouter exposes broad multi-model access from a single API and a models listing endpoint, which makes it suitable for powering a model-driven brand intelligence workflow rather than just one-off responses. [web:393][web:387][web:395]

## Product goal

Brand Intelligence should answer four practical questions for the user:

1. **How do major AI models understand my brand right now?**
2. **What are AI models getting wrong, missing, or inventing?**
3. **How do I compare to competitors in AI understanding and visibility?**
4. **What should I improve on my website/content/brand signals to change that outcome?**

This needs to be a functional dashboard, not just an analytical curiosity. The user should leave the page knowing:
- whether their AI brand visibility is strong or weak,
- where the biggest model gaps are,
- what competitors are doing better,
- and what specific actions to take next.

## What is wrong with the current screen

From the current UI, these are the main issues:

- The page feels **static and underpowered**. It looks like a report snapshot, not a living intelligence dashboard. [file:404]
- The top overview cards are too shallow. They show numbers without enough meaning, trends, or explanation. [file:404]
- The model table shows percentages, but does not help the user understand **why** a model scored badly or what that means operationally. [file:404]
- The competitor table is useful in principle, but too raw. It needs interpretation and clearer comparison framing. [file:404]
- Sentiment & Signals is too empty and feels unfinished. It should become one of the most useful sections, since it explains *how AI describes the brand*. [file:404]
- There is almost no clear “How to improve” flow, which means the user sees data but not action.
- The layout has too much dead space and not enough visual structure.
- There is no strong narrative from top-level score → diagnosis → competitor comparison → action plan.

## New positioning of the feature

Brand Intelligence should be positioned as:

**“How AI sees, describes, and recommends your brand — and what to improve to influence that.”**

It should not feel like a small analytics tab. It should feel like a strategic dashboard that combines:

- AI visibility
- AI understanding accuracy
- brand narrative clarity
- competitor comparison
- actionable recommendations

## Proposed dashboard structure

The page should be rebuilt into 6 clear sections.

---

## 1. Executive overview

This is the first screen and should quickly answer: “Is my brand understood well by AI or not?”

### Replace the current top area with:

- **Brand Intelligence Score** (main hero circle)
- **AI Visibility Score**
- **Narrative Accuracy Score**
- **Competitive Position**
- **Sentiment / Reputation Score**
- **Coverage Score** (how many models recognized the brand with useful confidence)

### Each card must include:

- score circle, consistent with your main dashboard design system
- short 1-line explanation
- delta/trend if historical data exists
- “why this matters” tooltip or expandable help

### Add a short executive summary block:

Example style:

- “AI models recognize your brand inconsistently. They understand your category, but your differentiation and trust signals are weak.”
- “You rank below the category average for visibility and are rarely surfaced as a primary recommendation.”
- “Main opportunity: clarify positioning and strengthen model-readable trust and offer signals.”

This summary should be generated from the results and written in plain language.

---

## 2. AI model understanding

This section should evolve the current “AI Model Performance” card into a richer diagnostic component.

### For each enabled model, show:

- model name + provider badge
- recognition status: recognized / partially recognized / not recognized
- accuracy score
- confidence level
- sentiment label
- short answer summary: how the model describes the brand
- issue tag(s): missing positioning / wrong category / weak recall / hallucinated details / low confidence

### Interaction pattern:

Each row expands into a detailed panel showing:

- **What the model said** (short summarized answer, not huge raw dump)
- **What it got right**
- **What it got wrong or missed**
- **What this implies**
- **What to improve**

### Important:

Do not just show raw prompts and raw answers. That becomes messy and low-value. Instead, structure the model result into:

- summary
- accuracy
- issues
- opportunity

This section should make it obvious which models are strongest, weakest, and why.

---

## 3. Brand narrative and perception

This should replace the weak current “Sentiment & Signals” area with something much more useful.

### New sub-blocks:

#### A. Narrative themes

Show the top themes AI associates with the brand, grouped into:

- Core brand themes
- Product/service themes
- Trust/credibility themes
- Emotional / sentiment themes

Display as chips or clustered labels with frequency / model agreement.

#### B. Positive signals

What AI repeatedly sees as strengths:

- e.g. clear service scope
- useful content
- strong brand coherence
- premium feel
- trust markers

#### C. Negative / weak signals

What AI repeatedly sees as weak or missing:

- unclear differentiation
- inconsistent messaging
- weak authority signals
- missing evidence / reviews / case studies
- weak entity clarity

#### D. Hallucinations & confusion

One of the most valuable additions.

Show where models are inventing, guessing, or confusing the brand with competitors / category assumptions.

Examples:
- wrong category assignment
- incorrect market positioning
- false claims inferred by models
- confusion with another company/entity

This is critical because it directly explains where the brand is not machine-legible enough.

---

## 4. Competitive intelligence

The current competitor benchmark is too basic. It needs to become a real comparison tool.

### Keep the table, but improve it significantly:

For each competitor show:

- overall brand intelligence score
- AI visibility score
- narrative clarity score
- trust / authority score
- positioning clarity score
- sentiment score
- “why they beat you” or “where you beat them” summary

### Add views:

- **Leaderboard view** (simple ranking)
- **Gap analysis view** (why competitors outperform)
- **Attribute comparison view** (content clarity, trust, brand consistency, recommendation likelihood)

### Add a benchmark summary card:

Examples:
- “You are below the category average in AI visibility, but above average in sentiment.”
- “Competitors outperform mainly through clearer positioning and stronger trust signals.”
- “Your largest gap is recommendation likelihood.”

### Important UX rule:

The competitor section must interpret the comparison. A plain table is not enough.

---

## 5. How to improve

This is the most important section and is currently missing.

Every Brand Intelligence analysis should end with a **clear improvement plan**.

### Create a prioritized recommendation module:

Group recommendations into:

- **High impact / quick wins**
- **Content improvements**
- **Brand clarity improvements**
- **Trust / authority improvements**
- **Technical / AI-readability improvements**

### Each recommendation should show:

- title
- why it matters
- which score(s) it affects
- expected impact
- difficulty / effort
- example fix or guidance
- optionally: link to related Fixpath findings / pages to update

### Good example recommendation cards:

- “Clarify your category and ideal customer on the homepage hero”
- “Add proof signals that AI can cite: reviews, client logos, case studies, stats”
- “Create a clearer About / company identity block so models stop guessing who you are”
- “Unify service terminology across homepage, metadata, and schema”

### Critical rule:

Recommendations must be written as **product actions**, not vague advice.

Bad:
- “Improve content.”

Good:
- “Add a 1-sentence positioning statement above the fold that clearly says what the brand does, for whom, and why it is different.”

---

## 6. Prompting / model methodology transparency

Because this feature depends on querying AI models, the user needs confidence in the methodology.

Add a small “How this is evaluated” area showing:

- which models were queried
- whether prior context was used or not
- what question families were asked (brand understanding, recommendation, comparison, trust, sentiment)
- when it was last updated
- whether the selected models come from the user’s enabled AI settings

Do not make this dominate the interface, but keep it accessible via expandable section or info panel.

## Use OpenRouter properly

Because OpenRouter is now integrated, Claude should use it as the foundation of this feature.

### Required architecture

Build Brand Intelligence on top of:

- one internal OpenRouter service layer
- model selection based on user-enabled models from AI Settings
- structured prompting per use case
- normalized result schema per model

### Core prompt families

The system should ask multiple AI models a structured set of question types, for example:

1. **Brand recognition**
   - What is this company/brand?
   - What does it do?
   - Who is it for?

2. **Positioning clarity**
   - How clearly differentiated is this brand?
   - What is its unique value proposition?

3. **Recommendation likelihood**
   - Would you mention or recommend this brand for [relevant use case]?
   - Where would it rank in likely suggestions?

4. **Trust / authority**
   - Does this brand appear credible and trustworthy?
   - What signals support or weaken that?

5. **Sentiment and tone**
   - How is the brand described emotionally or reputationally?

6. **Competitor comparison**
   - How does this brand compare to named competitors?

### Normalization

Claude should normalize model outputs into a consistent schema like:

- `recognized`
- `accuracy_score`
- `visibility_score`
- `sentiment_score`
- `recommendation_likelihood`
- `key_themes[]`
- `positive_signals[]`
- `negative_signals[]`
- `hallucinations[]`
- `improvement_suggestions[]`

That normalized layer is what powers the dashboard.

## Visual design direction

The new screen should feel premium, clear, and alive — not like a raw admin report.

### Design principles

- Use a stronger visual hierarchy.
- Reduce empty space by turning large blank areas into useful modules.
- Keep cards consistent with the main Fixpath dashboard style.
- Use score circles and mini charts consistently.
- Use color intentionally: green/amber/red for status, but keep the palette restrained.
- Use chips, grouped blocks, small trend visuals, and expandable panels instead of long dense tables.
- Highlight the most important insight first.

### Suggested UI patterns

- hero score cards
- stacked insight cards
- expandable model rows
- competitor comparison bars
- sentiment/theme chips
- recommendation cards with effort/impact labels

### Avoid

- giant raw text dumps
- giant raw JSON sections
- empty placeholder blocks
- too many tables with no interpretation
- making the user read prompts to understand the result

## Information hierarchy

The page should flow like this:

1. Executive summary and core scores
2. Main issues / opportunities
3. AI model understanding breakdown
4. Brand perception and narrative themes
5. Competitor comparison
6. Prioritized improvement plan
7. Methodology / models used

That sequence is important. The user should get the answer first, then the diagnosis, then the actions.

## Interaction improvements

### Add filtering

Allow filtering by:

- model
- question family
- competitor
- issue type
- severity / impact

### Add save/export actions

Useful actions:

- export summary
- copy recommendations
- create Fixpath tasks/findings from recommendation
- rerun Brand Intelligence with selected models

### Add freshness controls

Show:
- last run timestamp
- model set used
- rerun button
- warning if the analysis is outdated after major audit/site changes

## Relationship with the rest of Fixpath

Brand Intelligence should not be an isolated curiosity. It should connect to:

- website audit findings
- Brand DNA
- competitor analysis
- action / fix suggestions

Examples:

- if AI says positioning is unclear, link to homepage/content findings
- if trust is weak, link to missing reviews / case studies / authority signals
- if brand inconsistency is high, link to Brand DNA mismatches

This is how the feature becomes truly useful.

## Required deliverables from Claude

Please do not just restyle the page. This needs a feature rethink.

Deliver:

1. **Product redesign proposal**
   - better information architecture
   - clearer user value
   - how the feature should work end to end

2. **Data/model design**
   - normalized result schema for multi-model brand intelligence
   - prompt families and scoring logic
   - how OpenRouter-powered model responses are aggregated

3. **UI redesign implementation**
   - component structure
   - layout changes
   - richer competitor and perception views
   - actionable recommendation module

4. **Integration plan**
   - use enabled models from AI Settings
   - query through OpenRouter only
   - support reruns and historical refresh

5. **Actionability**
   - map insights to concrete improvement actions inside Fixpath

## Copy-paste prompt for Claude

```text
I want to significantly improve the Brand Intelligence tab so it becomes a functional, usable, and clearly valuable feature — not just a static data dump.

Context:
- We now integrate with OpenRouter, so we have access to all major AI models through one integration.
- That means we can query multiple models properly and build a much richer Brand Intelligence workflow.
- The feature should help users understand how AI sees their brand, how they compare to competitors, what AI gets wrong or misses, and what to improve.

Current issues:
- The current Brand Intelligence screen feels static, sparse, and underpowered.
- It shows scores, a model list, a competitor table, and weak sentiment/signals blocks, but it does not feel insightful or actionable.
- It needs to become much more useful, visual, clear, and action-oriented.

What I want:
1. Redesign the Brand Intelligence tab as a strategic dashboard.
2. Use OpenRouter as the model layer for querying enabled AI models.
3. Normalize model outputs into a structured schema so the UI is consistent and useful.
4. Make the page much richer visually but still clean and usable.
5. Add clear “how to improve” recommendations — practical, prioritized, not vague.
6. Ensure it helps the user understand not just the data, but what to do next.

The page should answer:
- How do major AI models understand my brand right now?
- What are they getting right or wrong?
- How visible/recommendable is my brand?
- How do I compare to competitors?
- What should I improve?

Please redesign the feature into these core sections:
1. Executive overview with meaningful scores and summary
2. AI model understanding breakdown
3. Brand narrative / perception themes, positive signals, negative signals, hallucinations
4. Competitive intelligence / gap analysis
5. Prioritized improvement recommendations
6. Methodology / models used

Important implementation requirements:
- Do not dump raw prompts/responses everywhere.
- Build structured result objects per model.
- Use the user-enabled models from AI Settings.
- Support model comparison and reruns.
- Connect recommendations to Fixpath findings/pages/Brand DNA where relevant.
- Keep the design premium, clear, and actionable.

I want from you:
1. product/UX rethink
2. data schema proposal for normalized model outputs
3. prompt family proposal
4. UI component architecture
5. implementation plan
6. detailed improvements for turning this into a valuable dashboard instead of a score dump
```
EOF && echo 'created output/brand_intelligence_improvement_brief.md'
