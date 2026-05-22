/**
 * Affected-pages enrichment engine.
 *
 * Many module-level findings list only the root domain (e.g. "https://fixpath.ai")
 * as their affected page, even when the description explicitly mentions specific
 * URLs like /pricing, /about, /faq. This engine extracts those URLs from the
 * finding's description and recommendation text to provide a complete picture.
 *
 * React-free, reusable across all export renderers.
 */

import type { ExportFinding } from './findings-formatter';

/* ── URL extraction ────────────────────────────────────── */

/**
 * Extract URLs and path references from text.
 *
 * Catches:
 *  - Full URLs: https://www.fixpath.ai/pricing
 *  - Path references: /pricing, /about, /resources/wcag-accessibility-basics
 *  - Quoted path references: '/pricing', "/about"
 */
function extractUrlsFromText(text: string, siteHostname: string): string[] {
  const urls = new Set<string>();

  // Match full URLs
  const fullUrlPattern = /https?:\/\/[^\s,;)"'<>]+/gi;
  const fullMatches = text.match(fullUrlPattern);
  if (fullMatches) {
    for (const match of fullMatches) {
      // Clean trailing punctuation
      const clean = match.replace(/[.,;:!?)]+$/, '');
      try {
        const u = new URL(clean);
        // Only include URLs for the same site
        if (u.hostname.replace(/^www\./, '') === siteHostname.replace(/^www\./, '')) {
          urls.add(clean);
        }
      } catch {
        // skip invalid URLs
      }
    }
  }

  // Match /path references (e.g. "/pricing", /about, /resources/something)
  // Must be preceded by a word boundary, space, or quote to avoid matching
  // random slashes in the middle of words
  const pathPattern = /(?:^|[\s'"(,])(\/([\w-]+(?:\/[\w-]+)*))\b/g;
  let pathMatch;
  while ((pathMatch = pathPattern.exec(text)) !== null) {
    const path = pathMatch[1];
    // Skip common false positives
    if (/^\/(or|and|but|the|a|an|in|on|at|to|for|etc|e\.g)$/i.test(path)) continue;
    if (path.length < 3) continue; // skip bare "/"

    // Construct full URL
    const protocol = siteHostname.includes('localhost') ? 'http' : 'https';
    const host = siteHostname.startsWith('www.') ? siteHostname : `www.${siteHostname}`;
    urls.add(`${protocol}://${host}${path}`);
  }

  return Array.from(urls);
}

/**
 * Check if an affected pages list is "sparse" — only contains the root
 * domain or is empty.
 */
function isSparsePages(pages: string[], siteHostname: string): boolean {
  if (pages.length === 0) return true;
  // All pages are just the root domain
  return pages.every((p) => {
    try {
      const u = new URL(p);
      return u.pathname === '/' || u.pathname === '';
    } catch {
      // Plain hostname
      return p.replace(/^www\./, '') === siteHostname.replace(/^www\./, '');
    }
  });
}

/* ── Public API ─────────────────────────────────────────── */

/**
 * Enrich findings that have sparse affected_pages by extracting URLs
 * mentioned in their description and recommendation text.
 *
 * Returns a new array — does not mutate the input.
 */
export function enrichAffectedPages(
  findings: ExportFinding[],
  siteHostname: string,
): ExportFinding[] {
  return findings.map((f) => {
    if (!isSparsePages(f.affectedPages, siteHostname)) {
      return f; // already has specific pages
    }

    // Extract from description + recommendation
    const textSources = [
      f.description,
      f.recommendation,
      f.whyItMatters || '',
      f.evidence || '',
    ].join(' ');

    const extracted = extractUrlsFromText(textSources, siteHostname);

    if (extracted.length === 0) {
      return f; // nothing found
    }

    // Merge with existing pages, deduplicate
    const merged = new Set<string>([...f.affectedPages, ...extracted]);

    return {
      ...f,
      affectedPages: Array.from(merged),
    };
  });
}
