// ============================================================
// ClearUX — Brand DNA payload sanitisers
//
// Used by /api/brand-identities (POST + PUT) to normalise the Phase 1
// Brand DNA fields added in migration 031. Kept in a shared lib because
// Next.js route files cannot re-export non-handler helpers.
// ============================================================

/** Trim, dedupe (case-insensitive), drop empties, cap length so malformed payloads cannot bloat the row. */
export function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of input) {
    if (typeof v !== 'string') continue
    const trimmed = v.trim().slice(0, 64)
    if (!trimmed) continue
    if (seen.has(trimmed.toLowerCase())) continue
    seen.add(trimmed.toLowerCase())
    out.push(trimmed)
    if (out.length >= 24) break
  }
  return out
}

/** Like normalizeStringArray but only accepts strings that look like a CSS colour token. */
export function normalizeColorArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of input) {
    if (typeof v !== 'string') continue
    const trimmed = v.trim().slice(0, 32)
    if (!trimmed) continue
    const looksValid =
      /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)
      || /^rgba?\([\d\s.,%/]+\)$/i.test(trimmed)
      || /^[a-zA-Z]{3,32}$/.test(trimmed)
    if (!looksValid) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= 12) break
  }
  return out
}

/** Trim a URL string to <=2048 chars; return null if empty. Does not validate scheme — UI does. */
export function normalizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim().slice(0, 2048)
  return trimmed || null
}
