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
