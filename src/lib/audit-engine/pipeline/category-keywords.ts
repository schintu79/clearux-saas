// ============================================================
// ClearUX Proprietary — Category Keyword Map
// Shared mapping of category indices to keyword sets.
// Used for assigning findings to the correct category/module
// in both the report renderer and the dashboard UI.
//
// Must match the 24-category structure in analyzer.ts:
//   0-3:   Foundation
//   4-7:   Human Experience
//   8-11:  Inclusive Design
//   12-15: Future Readiness
//   16-19: SEO Structure & Rules
//   20-23: Brand Consistency
// ============================================================

/**
 * Keywords for each category index.
 * When a finding's text (title + description + recommendation)
 * matches these keywords, it gets assigned to that category.
 */
export const CATEGORY_KEYWORDS: Record<number, string[]> = {
  // ── Foundation (0-3) ──────────────────────────────────────
  0: ['visual', 'design', 'first impression', 'hero', 'above the fold', 'layout', 'aesthetic', 'color', 'palette', 'whitespace', 'spacing', 'typography'],
  1: ['value proposition', 'messaging', 'headline', 'subheadline', 'differentiation', 'clarity', 'benefit', 'audience', 'copy'],
  2: ['navigation', 'information architecture', 'menu', 'navbar', 'footer', 'breadcrumb', 'sitemap', 'internal link', 'page structure'],
  3: ['content quality', 'readability', 'scannability', 'writing', 'grammar', 'tone', 'voice', 'paragraph', 'media quality', 'alt text'],

  // ── Human Experience (4-7) ────────────────────────────────
  4: ['call-to-action', 'cta', 'conversion', 'button', 'sign up', 'free trial', 'conversion path', 'conversion flow', 'checkout', 'form'],
  5: ['trust', 'credibility', 'testimonial', 'social proof', 'security', 'privacy', 'badge', 'certificate', 'review', 'guarantee'],
  6: ['ethical', 'transparent', 'dark pattern', 'cookie', 'consent', 'gdpr', 'manipulat', 'deceptive', 'honest', 'confirmshaming', 'opt-out'],
  7: ['emotional', 'delight', 'micro-interaction', 'animation', 'personality', 'engagement', 'reward', 'feedback', 'psychological'],

  // ── Inclusive Design (8-11) ───────────────────────────────
  8: ['accessibility', 'a11y', 'wcag', 'screen reader', 'keyboard', 'aria', 'tab order', 'focus', 'disability', 'contrast'],
  9: ['cognitive', 'neurodiversity', 'plain language', 'simple', 'cognitive load', 'learning', 'attention', 'memory', 'dyslexia'],
  10: ['wellbeing', 'well-being', 'responsible', 'addictive', 'notification overload', 'screen time', 'digital health', 'consent fatigue'],
  11: ['responsive', 'mobile', 'tablet', 'breakpoint', 'viewport', 'touch target', 'adaptive', 'device', 'smartphone', 'portrait'],

  // ── Future Readiness (12-15) ──────────────────────────────
  12: ['performance', 'speed', 'page load', 'core web vital', 'lcp', 'cls', 'fid', 'optimize', 'compress', 'lazy', 'loading'],
  13: ['ai', 'llm', 'discoverability', 'machine-readable', 'chatbot', 'generative', 'ai-ready', 'llm-friendly', 'schema', 'structured data', 'json-ld'],
  14: ['ai agent', 'agent-ready', 'automation', 'tool use', 'api', 'programmatic', 'structured action'],
  15: ['cultural', 'global', 'localization', 'i18n', 'internationalization', 'rtl', 'translation', 'regional', 'diverse'],

  // ── SEO Structure & Rules (16-19) ─────────────────────────
  16: ['seo', 'search engine', 'meta', 'title tag', 'meta description', 'heading structure', 'h1', 'h2', 'canonical', 'robots'],
  17: ['technical seo', 'crawl', 'index', 'sitemap', 'redirect', '404', 'broken link', 'crawlability'],
  18: ['rich snippet', 'open graph', 'social media', 'twitter card', 'og:', 'rich result'],
  19: ['keyword', 'search intent', 'content gap', 'long-tail', 'topic cluster', 'semantic', 'link strategy', 'anchor text', 'backlink'],

  // ── Brand Consistency (20-23) ─────────────────────────────
  20: ['brand consistency', 'brand identity', 'logo', 'brand color', 'brand voice', 'brand guideline', 'visual identity'],
  21: ['brand experience', 'brand story', 'mission', 'about page', 'company value', 'voice', 'tone alignment'],
  22: ['brand visual', 'icon style', 'illustration', 'imagery', 'photo style', 'brand asset'],
  23: ['brand communication', 'brand tone', 'brand language', 'brand message', 'tagline'],
}

/**
 * Given a finding text (title + description + recommendation), return the
 * best-matching category index using keyword scoring.
 * Optionally provide category names from the audit for extra matching weight.
 */
export function matchFindingToCategory(
  findingText: string,
  categoryNames?: string[],
): number {
  const text = findingText.toLowerCase()
  let bestCatIdx = 0
  let bestScore = -1

  for (let catIdx = 0; catIdx < 24; catIdx++) {
    let score = 0

    // Match against category keywords
    const keywords = CATEGORY_KEYWORDS[catIdx] || []
    for (const kw of keywords) {
      if (text.includes(kw)) score += 1
    }

    // Match against category name words (bonus for direct name match)
    if (categoryNames && catIdx < categoryNames.length) {
      const nameWords = categoryNames[catIdx].toLowerCase().split(/[&,\s]+/).filter(w => w.length > 3)
      for (const w of nameWords) {
        if (text.includes(w)) score += 2
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestCatIdx = catIdx
    }
  }

  return bestCatIdx
}
