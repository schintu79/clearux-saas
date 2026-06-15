/** Shared dashboard score color helper. */
export function scoreColor(s: number | null): string {
  if (s == null) return 'var(--m-muted)'
  if (s >= 70) return 'var(--ok)'
  if (s >= 40) return 'var(--warn)'
  return 'var(--severe)'
}

/** Format a date string to "Jan 1, 2025" style. */
export function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(d))
}

/** Extract hostname from URL, stripping www. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Human-readable page label: host + pathname (no protocol, no trailing slash,
 * no leading www). Used on finding cards so the user always knows WHICH page a
 * finding refers to — not just the bare domain. Returns null for empty/invalid
 * URLs (caller renders a "site-wide" fallback).
 *
 * Examples:
 *   https://raseedinvest.com/en/signup  -> raseedinvest.com/en/signup
 *   https://www.example.com/            -> example.com
 */
export function pagePathOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    let path = u.pathname || ''
    if (path === '/') path = ''
    else path = path.replace(/\/$/, '') // strip a single trailing slash
    return `${host}${path}`
  } catch {
    return null
  }
}
