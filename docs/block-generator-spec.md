# Block Generator — Product & Architecture Spec

**Module:** AI-powered section/page generator for non-surgical recommendations  
**Status:** V1 design — ready for implementation  
**Last updated:** 2026-05-21  

---

## 1. Problem Statement

ClearUX audits surface two types of recommendations:

1. **Surgical fixes** — edits to existing code (meta tags, alt text, heading copy, schema markup). The Fix Console handles these today: generate patch → preview diff → deploy via FTP.

2. **Design-work recommendations** — "add an FAQ section," "create a 404 page," "add a trust/testimonial strip," "add a CTA block." These are currently gated behind a `requires_design_work` classification and shown as handoff briefs with no deploy path. The user sees the recommendation but has to build it themselves.

Category 2 is where most of the audit's high-impact recommendations live. A score of 45/100 in "Trust & Social Proof" means the site needs new sections — not just text edits. Today we tell the user what to build but give them no way to build it. That's the gap.

### Why Not Extend the Surgical Fix Console?

The surgical lane is purpose-built for **minimal, reversible edits to existing code**. It works because the scope is tiny: one JSON patch, one diff hunk, one file write. Extending it to generate entire HTML sections would break its reliability model:

- Surgical fixes are deterministic or near-deterministic (Tier 1 patterns, small AI patches). Block generation is fundamentally generative — you can't regex your way to an FAQ section.
- Surgical fixes touch existing lines. Blocks insert new DOM trees. The failure modes are completely different.
- Surgical fixes are reviewed via line-level diffs. Blocks need visual preview — you can't review a 50-line HTML section as red/green lines.
- Mixing both in one console creates UX confusion: "Is this going to change one line or add a whole section?"

The Block Generator is a **second lane** — same FTP deployment infrastructure, same backup/rollback model, but a fundamentally different generation and preview pipeline.


## 2. V1 Scope

### 2.1 Supported Block Types

V1 ships with 6 high-value templates that cover the most common `requires_design_work` findings:

| Block | Type | Trigger Finding Keywords | Priority |
|-------|------|--------------------------|----------|
| **FAQ Section** | In-page section | "faq", "frequently asked", "common questions" | P0 |
| **Trust Strip** | In-page section | "trust", "social proof", "credibility", "testimonial" | P0 |
| **CTA Block** | In-page section | "call to action", "cta section", "conversion block" | P0 |
| **404 Page** | Full page | "404", "error page", "not found" | P0 |
| **Testimonial Section** | In-page section | "testimonial", "customer stories", "reviews" | P1 |
| **Feature/Benefit Grid** | In-page section | "feature section", "benefit grid", "value proposition" | P1 |

Each template has 2–3 layout variants (e.g., FAQ: accordion vs flat list vs two-column). The user picks the variant after seeing previews.

### 2.2 What V1 Does NOT Do

- **No visual editor / drag-and-drop.** The user picks a template, edits content in a structured form, previews the rendered output, and deploys. No WYSIWYG.
- **No arbitrary HTML generation.** Every output comes from an approved template with parameterized slots (heading, body, items, CTA text, colors). The AI fills slots — it doesn't write raw HTML.
- **No CSS file modification.** Generated blocks use inline styles derived from extracted design tokens, or a self-contained `<style>` block scoped to the generated section. We never touch the site's existing stylesheets.
- **No JavaScript generation.** V1 blocks are pure HTML+CSS. Interactive behavior (accordion toggles) uses minimal inline JS with `<details>`/`<summary>` or CSS-only patterns.
- **No image generation or asset upload.** Blocks use text, icons (inline SVG from a curated set), and the site's existing images (referenced by URL). No new image assets.


## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AUDIT PIPELINE                              │
│                                                                     │
│  Crawler ──► Design Token Extractor ──► tokens stored on report     │
│                                                                     │
│  Analyzer ──► Findings ──► Classifier ──► requires_design_work      │
│                                          │                          │
│                                          ▼                          │
│                                   Block Matcher                     │
│                                   (finding → template)              │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BLOCK GENERATOR MODULE                         │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌───────────┐ │
│  │ Template  │──►│ Content Slot │──►│  Style     │──►│  Rendered │ │
│  │ Registry  │   │ Filler (AI)  │   │  Injector  │   │  Preview  │ │
│  └──────────┘   └──────────────┘   └────────────┘   └─────┬─────┘ │
│                                                            │       │
│  ┌──────────────┐   ┌────────────────┐   ┌────────────┐   │       │
│  │ Content      │──►│ Insertion      │──►│  Deploy    │◄──┘       │
│  │ Editor       │   │ Point Picker   │   │  Engine    │           │
│  └──────────────┘   └────────────────┘   └────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Key Subsystems

1. **Design Token Extractor** — runs during crawl, extracts CSS variables, computed colors, fonts, spacing from the site's `<style>` blocks and inline styles.

2. **Template Registry** — curated HTML templates with named slots (`{{heading}}`, `{{items}}`, `{{cta_text}}`). Each template has layout variants and a style injection layer.

3. **Content Slot Filler** — AI (Haiku) generates content for each slot based on the finding recommendation, site context, and extracted brand voice. Constrained to slot schema — not freeform HTML.

4. **Style Injector** — takes extracted design tokens and applies them to the template's CSS variables, producing output that matches the site's visual language.

5. **Insertion Point Picker** — analyzes the target page's DOM structure and suggests safe anchor points for block insertion (before `</main>`, after last `<section>`, before `<footer>`). User confirms or selects a custom anchor.

6. **Deploy Engine** — reuses existing FTP infrastructure. Reads file → inserts block at anchor → creates backup → writes file → logs deploy.


## 4. Design Token Extraction

### 4.1 What to Extract

The extractor runs during the crawl phase (inside Puppeteer) and captures:

```typescript
interface SiteDesignTokens {
  // Colors
  colors: {
    primary: string | null       // Most prominent brand color
    secondary: string | null     // Secondary accent
    background: string | null    // Page background
    surface: string | null       // Card/section background
    text: string | null          // Primary text color
    textMuted: string | null     // Secondary text color
    border: string | null        // Border color
    accent: string | null        // CTA/link color
  }
  
  // Typography
  typography: {
    headingFamily: string | null   // font-family for h1-h3
    bodyFamily: string | null      // font-family for p/li
    baseSize: string | null        // body font-size (e.g., "16px")
    headingSizes: {                // computed px values
      h1: string | null
      h2: string | null
      h3: string | null
    }
    headingWeight: string | null   // e.g., "700"
    bodyWeight: string | null      // e.g., "400"
    lineHeight: string | null      // body line-height
  }
  
  // Spacing
  spacing: {
    sectionPadding: string | null  // vertical padding of <section> elements
    containerWidth: string | null  // max-width of main content container
    gap: string | null             // common gap between elements
  }
  
  // Shape
  shape: {
    borderRadius: string | null    // most common border-radius
    buttonRadius: string | null    // button border-radius specifically
  }
  
  // CSS Custom Properties (raw)
  cssVariables: Record<string, string>  // all --* variables found
  
  // Confidence
  confidence: 'high' | 'medium' | 'low'
  extractedFrom: string  // URL of page used for extraction
}
```

### 4.2 Extraction Strategy

Run inside the Puppeteer crawl (same browser context as responsive checker):

```typescript
// In crawler, after page load:

async function extractDesignTokens(page: Page): Promise<SiteDesignTokens> {
  return page.evaluate(() => {
    const tokens: Partial<SiteDesignTokens> = {}
    
    // 1. Extract CSS custom properties from all stylesheets
    const cssVars: Record<string, string> = {}
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i]
              if (prop.startsWith('--')) {
                cssVars[prop] = rule.style.getPropertyValue(prop).trim()
              }
            }
          }
        }
      } catch { /* cross-origin stylesheet, skip */ }
    }
    
    // 2. Extract computed styles from key elements
    const body = document.body
    const h1 = document.querySelector('h1')
    const h2 = document.querySelector('h2')
    const h3 = document.querySelector('h3')
    const p = document.querySelector('p')
    const main = document.querySelector('main') || document.querySelector('[role="main"]')
    const section = document.querySelector('section')
    const button = document.querySelector('button, a.btn, [class*="button"], [class*="btn"]')
    
    const cs = (el: Element | null) => el ? getComputedStyle(el) : null
    
    // 3. Build token set from computed values
    // ... (color extraction, typography, spacing)
    
    return tokens as SiteDesignTokens
  })
}
```

### 4.3 Storage

Tokens are stored on the `reports` table in `raw_json.designTokens`. One extraction per audit — taken from the homepage (most representative page). Also stored on `crawled_pages` for per-page token comparison (V2).

### 4.4 Fallback Tokens

When extraction fails or returns low confidence, the system falls back to a neutral design token set:

```typescript
const FALLBACK_TOKENS: SiteDesignTokens = {
  colors: {
    primary: '#1a1a1a',
    secondary: '#6b7280',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    accent: '#2563eb',
  },
  typography: {
    headingFamily: 'system-ui, -apple-system, sans-serif',
    bodyFamily: 'system-ui, -apple-system, sans-serif',
    baseSize: '16px',
    headingSizes: { h1: '36px', h2: '28px', h3: '22px' },
    headingWeight: '700',
    bodyWeight: '400',
    lineHeight: '1.6',
  },
  spacing: {
    sectionPadding: '64px',
    containerWidth: '1200px',
    gap: '24px',
  },
  shape: {
    borderRadius: '8px',
    buttonRadius: '6px',
  },
  cssVariables: {},
  confidence: 'low',
  extractedFrom: 'fallback',
}
```


## 5. Template System

### 5.1 Template Definition

Each template is a TypeScript object with HTML skeleton, named slots, variant options, and style injection points:

```typescript
interface BlockTemplate {
  id: string                          // e.g., 'faq-section'
  name: string                        // e.g., 'FAQ Section'
  description: string                 // human-readable purpose
  type: 'section' | 'page'           // in-page block or full page
  category: string                    // e.g., 'trust', 'conversion', 'utility'
  
  // Layout variants
  variants: BlockVariant[]
  
  // Content slots that AI or user fills
  slots: SlotDefinition[]
  
  // Which finding keywords trigger this template
  triggerPatterns: RegExp[]
  
  // Insertion constraints
  insertion: {
    defaultAnchor: string             // e.g., 'before:footer', 'after:last-section'
    allowedAnchors: string[]          // safe insertion points
    requiresFullPage: boolean         // true for 404, landing pages
  }
}

interface BlockVariant {
  id: string                          // e.g., 'accordion', 'flat-list', 'two-column'
  name: string
  previewDescription: string
  skeleton: string                    // HTML with {{slot}} placeholders
  styles: string                      // CSS template with {{token}} placeholders
}

interface SlotDefinition {
  name: string                        // e.g., 'heading', 'items', 'cta_text'
  type: 'text' | 'rich_text' | 'items' | 'image_url' | 'link'
  label: string                       // UI label for the editor
  required: boolean
  maxLength?: number
  itemSchema?: Record<string, SlotDefinition>  // for 'items' type
  aiPrompt: string                    // instructions for AI to fill this slot
}
```

### 5.2 Template Example: FAQ Section (Accordion Variant)

```typescript
const FAQ_ACCORDION: BlockVariant = {
  id: 'accordion',
  name: 'Accordion',
  previewDescription: 'Collapsible FAQ with expand/collapse animation',
  skeleton: `
<!-- ClearUX Generated Block: FAQ Section -->
<section class="clearux-block clearux-faq" style="{{section_styles}}">
  <div style="{{container_styles}}">
    <h2 style="{{heading_styles}}">{{heading}}</h2>
    {{#if subheading}}<p style="{{subheading_styles}}">{{subheading}}</p>{{/if}}
    <div style="{{list_styles}}">
      {{#each items}}
      <details style="{{item_styles}}">
        <summary style="{{summary_styles}}">{{this.question}}</summary>
        <div style="{{answer_styles}}">
          <p>{{this.answer}}</p>
        </div>
      </details>
      {{/each}}
    </div>
  </div>
</section>
<!-- /ClearUX Generated Block -->`,
  
  styles: `
    {{section_styles}}: padding: {{tokens.spacing.sectionPadding}} 0; background: {{tokens.colors.surface}};
    {{container_styles}}: max-width: {{tokens.spacing.containerWidth}}; margin: 0 auto; padding: 0 24px;
    {{heading_styles}}: font-family: {{tokens.typography.headingFamily}}; font-size: {{tokens.typography.headingSizes.h2}}; font-weight: {{tokens.typography.headingWeight}}; color: {{tokens.colors.text}}; margin-bottom: 12px;
    {{subheading_styles}}: font-family: {{tokens.typography.bodyFamily}}; font-size: {{tokens.typography.baseSize}}; color: {{tokens.colors.textMuted}}; margin-bottom: {{tokens.spacing.gap}};
    {{list_styles}}: display: flex; flex-direction: column; gap: 0;
    {{item_styles}}: border-bottom: 1px solid {{tokens.colors.border}}; padding: 0;
    {{summary_styles}}: font-family: {{tokens.typography.headingFamily}}; font-weight: 600; font-size: calc({{tokens.typography.baseSize}} * 1.05); color: {{tokens.colors.text}}; padding: 20px 0; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center;
    {{answer_styles}}: padding: 0 0 20px; font-family: {{tokens.typography.bodyFamily}}; font-size: {{tokens.typography.baseSize}}; line-height: {{tokens.typography.lineHeight}}; color: {{tokens.colors.textMuted}};
  `,
}
```

### 5.3 Template Registry (V1)

File: `src/lib/block-generator/templates/index.ts`

```
src/lib/block-generator/
├── templates/
│   ├── index.ts              # Registry + matcher
│   ├── faq-section.ts        # FAQ (accordion, flat, two-column)
│   ├── trust-strip.ts        # Trust badges/logos strip
│   ├── cta-block.ts          # CTA (centered, split, banner)
│   ├── testimonial-section.ts # Testimonials (cards, carousel, quotes)
│   ├── feature-grid.ts       # Feature/benefit grid (2-col, 3-col, icon-list)
│   └── error-404.ts          # Full 404 page
├── token-extractor.ts        # Design token extraction (Puppeteer)
├── style-injector.ts         # Token → CSS variable resolution
├── content-filler.ts         # AI slot filling (Haiku)
├── insertion-analyzer.ts     # DOM analysis for safe anchor points
├── renderer.ts               # Template + slots + styles → final HTML
└── types.ts                  # Shared types
```


## 6. Content Slot Filling

### 6.1 AI-Assisted Content Generation

When the user selects a template, the system pre-fills content slots using AI:

```typescript
async function fillContentSlots(
  template: BlockTemplate,
  variant: BlockVariant,
  finding: AuditFinding,
  siteContext: {
    siteName: string
    siteDescription: string
    industry: string | null
    language: string
    existingContent: string  // first 2KB of page text for voice matching
  },
): Promise<Record<string, unknown>> {
  const prompt = buildSlotFillerPrompt(template, variant, finding, siteContext)
  
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    temperature: 0.3,  // slight creativity for content, not code
    messages: [{ role: 'user', content: prompt }],
  })
  
  // Parse structured JSON response into slot values
  return parseSlotResponse(response, template.slots)
}
```

### 6.2 Slot Filler Prompt

```
You are a UX content writer. Generate content for a {{template.name}} block 
on a website.

SITE CONTEXT:
- Site: {{siteName}} ({{siteDescription}})
- Industry: {{industry}}
- Language: {{language}}
- Existing page voice sample: "{{existingContent}}"

FINDING THIS ADDRESSES:
- Title: {{finding.title}}
- Description: {{finding.description}}
- Recommendation: {{finding.recommendation}}

GENERATE content for these slots:
{{#each slots}}
- {{this.name}} ({{this.type}}): {{this.aiPrompt}}
  {{#if this.maxLength}}Max length: {{this.maxLength}} chars{{/if}}
  {{#if this.itemSchema}}Items: generate 4-6 items, each with: {{itemFields}}{{/if}}
{{/each}}

RULES:
- Match the site's existing voice and tone (see voice sample above)
- Write in {{language}} — all user-visible text must be in this language
- Be specific to this business — do not use generic placeholder text
- Keep headings concise (under 8 words)
- FAQ answers should be 2-3 sentences max
- Do NOT include HTML — just the plain text content for each slot

Return ONLY valid JSON:
{
  "heading": "...",
  "subheading": "...",
  "items": [{"question": "...", "answer": "..."}, ...],
  "cta_text": "..."
}
```

### 6.3 User Editing

After AI fills slots, the user sees a structured form — not raw HTML:

- Text slots: single-line input
- Rich text slots: textarea with basic formatting
- Items: repeatable card list with add/remove/reorder
- All fields are editable before preview
- "Regenerate" button per slot to get new AI suggestions


## 7. Style Injection

### 7.1 How It Works

The style injector takes the template's CSS skeleton and resolves `{{tokens.*}}` placeholders against the extracted design tokens:

```typescript
function injectStyles(
  variant: BlockVariant,
  tokens: SiteDesignTokens,
): Record<string, string> {
  const styleMap: Record<string, string> = {}
  
  // Parse the variant's style definitions
  const styleEntries = variant.styles.split('\n').filter(l => l.includes(':'))
  
  for (const entry of styleEntries) {
    const [key, ...valueParts] = entry.split(':')
    let value = valueParts.join(':').trim().replace(/;$/, '')
    
    // Resolve token references
    value = value.replace(/\{\{tokens\.([^}]+)\}\}/g, (_, path) => {
      return resolveTokenPath(tokens, path) || resolveTokenPath(FALLBACK_TOKENS, path) || ''
    })
    
    styleMap[key.trim()] = value
  }
  
  return styleMap
}
```

### 7.2 CSS Scoping

All generated blocks use a `.clearux-block` class prefix and inline styles. This avoids:

- Conflicting with the site's existing CSS classes
- Requiring modification of the site's stylesheets
- Specificity wars with existing rules

The generated `<style>` block (if needed for hover/media query states) uses a unique ID: `clearux-block-{blockId}`.

### 7.3 Responsive Behavior

V1 uses a simple responsive strategy:

- Container uses `max-width` + `margin: 0 auto` (adapts to site's container width)
- Grid layouts use CSS Grid with `repeat(auto-fit, minmax(280px, 1fr))`
- Font sizes use `clamp()` for fluid scaling
- Padding uses the site's extracted `sectionPadding` or falls back to `48px 24px`
- No media queries in V1 — CSS-native responsive patterns only


## 8. Insertion Point System

### 8.1 Safe Anchor Detection

The insertion analyzer reads the target page's HTML and identifies safe injection points:

```typescript
interface InsertionPoint {
  anchor: string           // CSS-like selector: 'before:footer', 'after:section:last'
  label: string            // Human-readable: "Before the footer"
  confidence: 'high' | 'medium' | 'low'
  lineNumber: number       // Position in the file for patch generation
  context: string          // 2-3 lines of surrounding HTML for visual confirmation
}

function analyzeInsertionPoints(html: string): InsertionPoint[] {
  const points: InsertionPoint[] = []
  const lines = html.split('\n')
  
  // Priority order of safe anchors:
  // 1. Before </main> (if exists)
  // 2. Before <footer> (most reliable)
  // 3. After the last <section> in <main> or <body>
  // 4. Before </body> (last resort)
  
  // For each candidate, verify it's not inside a conditional,
  // template tag, or script block
  
  return points.sort((a, b) => confidenceOrder(b) - confidenceOrder(a))
}
```

### 8.2 Anchor Types

| Anchor | Description | Confidence | When to Use |
|--------|-------------|------------|-------------|
| `before:footer` | Before the `<footer>` element | High | Default for most sections |
| `after:last-section` | After the last `<section>` in main content | High | When footer has a complex wrapper |
| `before:closing-main` | Before `</main>` | High | When main element exists |
| `after:element:{selector}` | After a specific element | Medium | User-selected custom anchor |
| `before:closing-body` | Before `</body>` | Low | Last resort fallback |

### 8.3 User Override

The UI shows the recommended anchor point with a preview of surrounding HTML. The user can:

1. Accept the recommendation
2. Pick from the list of detected anchors
3. Manually specify a line number or search string

The system validates the user's choice and warns if the insertion point is inside a `<script>`, `<style>`, conditional comment, or template syntax.


## 9. Preview System

### 9.1 Rendered Preview

Unlike the surgical fix's line-diff preview, blocks need a visual preview. V1 uses an iframe sandbox:

```typescript
// Preview component renders the generated block in an isolated iframe
function BlockPreview({ 
  html, 
  siteUrl,       // for reference — shown as "how it will look on {domain}"
  designTokens,  // for accurate rendering
}: BlockPreviewProps) {
  const iframeContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: ${designTokens.typography.bodyFamily};
          font-size: ${designTokens.typography.baseSize};
          color: ${designTokens.colors.text};
          background: ${designTokens.colors.background};
          line-height: ${designTokens.typography.lineHeight};
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `
  
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-off border-b border-border flex items-center gap-2">
        <Eye size={14} className="text-muted" />
        <span className="text-xs text-muted">Preview — {siteUrl}</span>
      </div>
      <iframe
        srcDoc={iframeContent}
        sandbox="allow-same-origin"
        className="w-full"
        style={{ height: 'auto', minHeight: 200 }}
      />
    </div>
  )
}
```

### 9.2 Code View

Alongside the visual preview, a code panel shows the generated HTML — read-only by default, with a "View code" toggle. This is for power users who want to verify what will be deployed.

### 9.3 In-Context Preview (V2)

V2 would fetch the live page, inject the block at the selected anchor point, and render the full page in the iframe. This shows the block in its actual context. V1 shows the block in isolation with matched styling.


## 10. Deploy & Rollback

### 10.1 Deploy Flow

Reuses existing FTP infrastructure with one addition — the block insertion step:

```
1. User approves preview → clicks "Deploy"
2. System reads current file from FTP (via pooled connection)
3. Finds the insertion anchor in the file
4. Inserts the generated HTML at the anchor point
5. Creates backup of original file → stored in ftp_deploy_log.backup_content
6. Writes modified file to FTP
7. Logs deploy in ftp_deploy_log with:
   - action: 'block_insert'
   - block_id: reference to the generated block definition
   - insertion_point: the anchor used
   - block_html: the generated HTML (for future reference)
8. Updates finding status to 'fixed'
9. Records in block_deploys table for rollback tracking
```

### 10.2 Rollback

Block rollback is exact — restore the backup file from the deploy log:

```
1. User clicks "Rollback" on a deployed block
2. System reads the backup_content from ftp_deploy_log
3. Writes backup content to FTP (overwriting current)
4. Creates new log entry with action: 'rollback'
5. Reverts finding status to previous state
```

### 10.3 Block Identification in Deployed Files

Every generated block is wrapped in HTML comments for identification:

```html
<!-- ClearUX Generated Block: faq-section | ID: blk_abc123 | Deployed: 2026-05-21T14:30:00Z -->
<section class="clearux-block clearux-faq" id="clearux-blk-abc123">
  ...
</section>
<!-- /ClearUX Generated Block: blk_abc123 -->
```

This enables:

- **Re-detection on re-audit:** The crawler can identify ClearUX-generated blocks and exclude them from "missing section" findings.
- **Targeted rollback:** Find the block by its comment markers and surgically remove it.
- **Update-in-place:** Replace an existing generated block with a new version without touching the rest of the file.


## 11. Database Schema

### 11.1 New Tables

```sql
-- Block template registry (static seed data, versioned)
CREATE TABLE block_templates (
  id TEXT PRIMARY KEY,                    -- e.g., 'faq-section'
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('section', 'page')),
  category TEXT NOT NULL,                 -- 'trust', 'conversion', 'utility'
  trigger_patterns TEXT[],                -- regex patterns for auto-matching
  variants JSONB NOT NULL DEFAULT '[]',   -- BlockVariant[]
  slots JSONB NOT NULL DEFAULT '[]',      -- SlotDefinition[]
  insertion_defaults JSONB,               -- default anchor, allowed anchors
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Generated block instances (user-created from templates)
CREATE TABLE block_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  audit_id UUID REFERENCES audits(id),
  finding_id UUID REFERENCES audit_findings(id),
  template_id TEXT NOT NULL REFERENCES block_templates(id),
  variant_id TEXT NOT NULL,               -- which layout variant
  
  -- Content
  slot_values JSONB NOT NULL DEFAULT '{}',  -- filled slot content
  rendered_html TEXT,                        -- final rendered output
  
  -- Styling
  design_tokens_used JSONB,               -- snapshot of tokens at generation time
  custom_overrides JSONB DEFAULT '{}',    -- user-applied style tweaks
  
  -- Deployment state
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',        -- generated but not deployed
    'previewed',    -- user has seen the preview
    'deployed',     -- live on the site
    'rolled_back',  -- was deployed, then reverted
    'archived'      -- user dismissed it
  )),
  
  -- Deploy metadata
  deployed_at TIMESTAMPTZ,
  deploy_log_id UUID REFERENCES ftp_deploy_log(id),
  insertion_point TEXT,                    -- anchor used for insertion
  target_file_path TEXT,                   -- remote file where block was inserted
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for finding-to-block lookups
CREATE INDEX idx_block_instances_finding ON block_instances(finding_id);
CREATE INDEX idx_block_instances_audit ON block_instances(audit_id);
CREATE INDEX idx_block_instances_user ON block_instances(user_id);
```

### 11.2 Extended ftp_deploy_log

Add a nullable `block_instance_id` column to link block deploys:

```sql
ALTER TABLE ftp_deploy_log ADD COLUMN block_instance_id UUID REFERENCES block_instances(id);
ALTER TABLE ftp_deploy_log ADD COLUMN deploy_type TEXT DEFAULT 'surgical' 
  CHECK (deploy_type IN ('surgical', 'block_insert', 'block_update', 'block_rollback'));
```

### 11.3 Design Tokens on Reports

```sql
-- Already exists as JSONB, just add the key path:
-- reports.raw_json.designTokens → SiteDesignTokens
-- No schema change needed — it's stored inside the existing raw_json column
```

### 11.4 Types (database.ts additions)

```typescript
export interface BlockTemplate {
  id: string
  name: string
  description: string | null
  type: 'section' | 'page'
  category: string
  trigger_patterns: string[]
  variants: BlockVariant[]
  slots: SlotDefinition[]
  insertion_defaults: { defaultAnchor: string; allowedAnchors: string[]; requiresFullPage: boolean } | null
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface BlockInstance {
  id: string
  user_id: string
  audit_id: string | null
  finding_id: string | null
  template_id: string
  variant_id: string
  slot_values: Record<string, unknown>
  rendered_html: string | null
  design_tokens_used: SiteDesignTokens | null
  custom_overrides: Record<string, string>
  status: 'draft' | 'previewed' | 'deployed' | 'rolled_back' | 'archived'
  deployed_at: string | null
  deploy_log_id: string | null
  insertion_point: string | null
  target_file_path: string | null
  created_at: string
  updated_at: string
}

export type BlockDeployType = 'surgical' | 'block_insert' | 'block_update' | 'block_rollback'
```


## 12. API Routes

### 12.1 Route Structure

```
src/app/api/blocks/
├── route.ts                    # GET: list blocks for audit, POST: create block instance
├── [id]/
│   ├── route.ts                # GET: fetch block, PATCH: update slots/status, DELETE: archive
│   ├── preview/route.ts        # POST: render preview HTML from current slots
│   └── deploy/route.ts         # POST: deploy to FTP, DELETE: rollback
├── templates/route.ts          # GET: list available templates
├── templates/[id]/route.ts     # GET: template detail with variants
├── match/route.ts              # POST: given a finding, return matching templates
└── tokens/route.ts             # GET: design tokens for an audit
```

### 12.2 Key Endpoints

**POST /api/blocks** — Create a new block instance

```typescript
// Request
{
  audit_id: string
  finding_id: string
  template_id: string
  variant_id: string
}

// Response
{
  block: BlockInstance  // status: 'draft', slots pre-filled by AI
}
```

**POST /api/blocks/[id]/preview** — Render the block with current slots

```typescript
// Request
{
  slot_values: Record<string, unknown>  // current edited values
  design_token_overrides?: Partial<SiteDesignTokens>
}

// Response
{
  html: string           // rendered HTML ready for preview
  css: string            // scoped CSS block
  insertionPoints: InsertionPoint[]  // suggested anchors (if target file known)
}
```

**POST /api/blocks/[id]/deploy** — Deploy block to site via FTP

```typescript
// Request
{
  connection_id: string
  file_path: string
  insertion_point: string  // anchor identifier
}

// Response
{
  success: boolean
  deploy_log_id: string
  warning?: string
}
```

**DELETE /api/blocks/[id]/deploy** — Rollback a deployed block

```typescript
// Response
{
  success: boolean
  rolled_back_from: string  // deploy_log_id that was reverted
}
```


## 13. UI Components

### 13.1 Component Tree

```
src/components/dashboard/v2/
├── BlockGenerator/
│   ├── BlockGenerator.tsx        # Main orchestrator (template → fill → preview → deploy)
│   ├── TemplateSelector.tsx      # Grid of available templates with variant thumbnails
│   ├── VariantPicker.tsx         # Side-by-side variant comparison
│   ├── SlotEditor.tsx            # Structured content editing form
│   ├── BlockPreview.tsx          # Iframe-based rendered preview
│   ├── InsertionPicker.tsx       # Anchor point selection UI
│   ├── BlockCodeView.tsx         # Raw HTML code view (read-only + copy)
│   └── BlockDeployBar.tsx        # Action bar: deploy, rollback, edit, archive
```

### 13.2 User Flow

```
Finding Card (requires_design_work)
  └── "Generate block" button
       │
       ▼
  ┌─ TemplateSelector ──────────────────────────┐
  │  Shows 1-3 matching templates for this       │
  │  finding. Each shows name, description,      │
  │  and variant thumbnails.                     │
  │  User picks a template + variant.            │
  └──────────────────────────┬───────────────────┘
                             │
                             ▼
  ┌─ SlotEditor ─────────────────────────────────┐
  │  Structured form with AI-prefilled content.  │
  │  Heading, subheading, items (add/remove),    │
  │  CTA text, etc.                              │
  │  "Regenerate" per slot. "Preview" button.    │
  └──────────────────────────┬───────────────────┘
                             │
                             ▼
  ┌─ BlockPreview ───────────────────────────────┐
  │  Left: Rendered preview (iframe)             │
  │  Right: Code view (toggle)                   │
  │  Bottom: InsertionPicker (if in-page block)  │
  │                                              │
  │  Actions: "Edit content" | "Deploy"          │
  └──────────────────────────┬───────────────────┘
                             │
                             ▼
  ┌─ Deploy ─────────────────────────────────────┐
  │  Select FTP connection (reuses existing)     │
  │  Confirm target file + insertion point       │
  │  "Deploy block" button with spinner          │
  │                                              │
  │  Success: status → deployed, finding → fixed │
  │  "Rollback" button appears post-deploy       │
  └──────────────────────────────────────────────┘
```

### 13.3 Integration with Fix Console

The Block Generator lives alongside the Fix Console — not inside it. The entry point is from finding cards classified as `requires_design_work`:

```tsx
// In the finding card (FixConsole.tsx or similar)
{classification === 'requires_design_work' && (
  <div className="mt-3 pt-3 border-t border-border">
    <p className="text-xs text-muted mb-2">
      This recommendation requires a new content block.
    </p>
    <button
      onClick={() => openBlockGenerator(finding)}
      className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
    >
      <Sparkles size={12} />
      Generate block
    </button>
  </div>
)}
```

The Block Generator opens as a slide-over panel or a dedicated sub-page within the audit detail view.


## 14. Block-Finding Connection

### 14.1 Auto-Matching

When an audit completes, the block matcher runs over all `requires_design_work` findings:

```typescript
function matchFindingToTemplates(
  finding: AuditFinding,
  templates: BlockTemplate[],
): BlockTemplate[] {
  const blob = `${finding.title} ${finding.description} ${finding.recommendation}`.toLowerCase()
  
  return templates.filter(t => 
    t.triggerPatterns.some(pattern => pattern.test(blob))
  )
}
```

The results are stored on the finding as `matched_block_templates: string[]` — an array of template IDs. This drives the "Generate block" button visibility and pre-selects the right template.

### 14.2 Finding Status Integration

When a block is deployed, the linked finding's status updates to `fixed`. When a block is rolled back, the finding reverts to `open`. This reuses the existing finding status lifecycle.


## 15. Implementation Plan

### Phase 1: Foundation (3-4 days)

1. **Design token extractor** — `src/lib/block-generator/token-extractor.ts`
   - Puppeteer-based CSS variable + computed style extraction
   - Wire into crawler pipeline (store on report.raw_json.designTokens)
   - Fallback token set

2. **Template system** — `src/lib/block-generator/templates/`
   - Template types and registry
   - First 2 templates: FAQ section (accordion + flat variants), 404 page
   - Style injection from tokens
   - Handlebars-style renderer (simple string replacement, no library dependency)

3. **Database migration**
   - `block_templates` table + seed data
   - `block_instances` table
   - `block_instance_id` and `deploy_type` columns on `ftp_deploy_log`

### Phase 2: Content + API (2-3 days)

4. **Content slot filler** — `src/lib/block-generator/content-filler.ts`
   - Haiku-based slot filling with site context and voice matching
   - Language-aware generation (reuse surgical fix language detection)

5. **Insertion analyzer** — `src/lib/block-generator/insertion-analyzer.ts`
   - HTML parsing for safe anchor detection
   - Anchor validation and line number resolution

6. **API routes** — `src/app/api/blocks/`
   - CRUD for block instances
   - Preview rendering endpoint
   - Deploy + rollback endpoints (reuse FTP infrastructure)

### Phase 3: UI (3-4 days)

7. **Template selector + variant picker**
   - Grid layout with template cards
   - Variant comparison view

8. **Slot editor**
   - Structured form component
   - Item list editor (add/remove/reorder)
   - Per-slot regeneration

9. **Preview + deploy**
   - Iframe preview with token-based styling
   - Insertion point picker
   - Code view toggle
   - Deploy bar with rollback support

10. **Fix Console integration**
    - "Generate block" button on design-work findings
    - Block status badge on finding cards
    - Block detail panel or slide-over

### Phase 4: Remaining Templates (2 days)

11. **Add remaining V1 templates**
    - Trust strip, CTA block, testimonial section, feature grid
    - 2-3 variants each

### Phase 5: Polish + Safety (1-2 days)

12. **Block-finding matching** — auto-detect which templates apply to which findings
13. **Re-audit awareness** — crawler detects ClearUX-generated blocks, skips them for "missing section" findings
14. **Rollback improvements** — surgical block removal (comment-marker based) instead of full file restore
15. **Edge cases** — multi-block deploys to same file, encoding handling, large file safety


## 16. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Style mismatch — generated block looks foreign on the site | High | Token extraction + fallback tokens + visual preview before deploy. User can override styles. |
| Insertion breaks page layout | High | Safe anchor detection, comment-marker wrapping, mandatory preview, one-click rollback. |
| AI generates inappropriate/off-brand content | Medium | Constrained slots (not freeform HTML), site voice matching, mandatory user review of all content before deploy. |
| Token extraction fails on complex sites (SPAs, CSS-in-JS) | Medium | Fallback to neutral tokens. V2 adds manual token override UI. |
| Duplicate blocks on re-audit → re-generate cycle | Medium | Comment markers let crawler detect existing ClearUX blocks. Block instance status prevents re-generation for deployed blocks. |
| FTP backup exceeds 50KB field limit | Low | Same issue as surgical fixes. Block HTML is typically 2-5KB. Full-file backup uses the existing `backup_content` column. |


## 17. Success Metrics

- **Conversion rate:** % of `requires_design_work` findings that lead to block generation → deploy (vs. 0% today)
- **Deploy success rate:** % of block deploys that succeed without rollback within 24h
- **Style confidence:** Average token extraction confidence score across audits
- **Time-to-deploy:** Minutes from "Generate block" click to successful deploy (target: under 5 minutes)
- **Template coverage:** % of `requires_design_work` findings that match at least one template


## 18. Future (V2+)

- **In-context preview:** Fetch live page, inject block, show full page in iframe
- **Style override panel:** Manual color/font/spacing tweaks with live preview
- **Multi-block pages:** Generate multiple blocks and arrange them on a single page
- **Custom templates:** Users can save their own block templates from deployed blocks
- **WordPress/CMS integration:** Generate blocks as WordPress shortcodes or Gutenberg blocks instead of raw HTML
- **Image generation:** AI-generated placeholder images or icon selection from a curated library
- **A/B variant deployment:** Deploy two variants of a block and track which performs better
