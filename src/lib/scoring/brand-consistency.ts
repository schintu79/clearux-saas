// ============================================================
// Brand Consistency — declared Brand DNA vs the live site
// ============================================================
// Plan §10. Cross-references the customer's uploaded Brand DNA
// (brand_identities: primary_colors, brand_voice, tone_keywords) against
// what the audit actually observed on the live site, and emits ONLY
// evidenced mismatches — never speculation.
//
// Scoring doctrine (Stefano, 2026-06-13): this produces its OWN score in
// its own box. It does NOT feed the site health score (health must mean the
// same thing whether or not brand files were uploaded). Mismatches that
// genuinely harm END-USER trust are flagged `trustHarming` so the pipeline
// can ALSO surface them as normal findings, where they legitimately affect
// health.
//
// Provability (the whole game — anything not evidenced must not appear):
//   • Colours  — deterministic: each declared brand colour is checked for
//                presence in the observed live-site palette (within a small
//                perceptual tolerance). Absence is a real, measurable gap.
//   • Voice/tone — quote-grounded ONLY: a contradiction exists only
//                when the caller supplies a verbatim quote from the site
//                that conflicts with the declared voice/tone. No quote, no
//                finding. (Produced upstream by the quote-to-critique
//                analyzer; this module never invents one.)
//
// Pure + dependency-free (no react, no supabase) so it is unit-testable and
// safe to call from the pipeline. Client-safe.
// ============================================================

/* ── Inputs ─────────────────────────────────────────────── */

export interface DeclaredBrand {
  /** brand_identities.primary_colors — hex strings ("#1a2b3c" or "#abc"). */
  colors: string[]
  /** brand_identities.brand_voice (free text), or null. */
  voice: string | null
  /** brand_identities.tone_keywords. */
  toneKeywords: string[]
}

/** A verbatim, on-site contradiction of the declared voice/tone, identified
 *  upstream by the quote-to-critique analyzer. The module trusts that the
 *  quote is real and was found on the site — it never fabricates these. */
export interface VoiceContradiction {
  quote: string
  pageUrl?: string
  /** Which declared signal it conflicts with, for the evidence line. */
  conflictsWith: string
  severity?: BrandMismatchSeverity
}

export interface ObservedBrand {
  /** Colours detected on the live site (hex or "rgb(r, g, b)"). */
  colors: string[]
  /** Quote-grounded voice/tone contradictions (may be empty). */
  voiceContradictions?: VoiceContradiction[]
}

/* ── Output ─────────────────────────────────────────────── */

export type BrandMismatchSeverity = 'high' | 'medium' | 'low'
export type BrandAttribute = 'color' | 'voice' | 'tone'

export interface BrandMismatch {
  attribute: BrandAttribute
  severity: BrandMismatchSeverity
  title: string
  detail: string
  /** Concrete proof: the declared value and what was (or wasn't) observed. */
  evidence: string
  /** True when this mismatch also harms end-user trust → the pipeline should
   *  double-surface it as a normal finding (Design Consistency / Trust). */
  trustHarming: boolean
}

export interface BrandConsistencyResult {
  /** 0–100, own metric. NEVER folded into the site health score. */
  score: number
  /** Which attributes had enough declared data to be checked. */
  attributesChecked: BrandAttribute[]
  mismatches: BrandMismatch[]
}

/* ── Colour helpers ─────────────────────────────────────── */

/** Parse a colour string ("#abc", "#aabbcc", "rgb(r,g,b)", "rgba(...)") to
 *  [r,g,b], or null if unparseable. */
export function parseColor(raw: string): [number, number, number] | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  const hexMatch = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  }
  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

/** Euclidean RGB distance — cheap perceptual proxy. Two colours within
 *  DEFAULT_COLOR_TOLERANCE are treated as "the same brand colour". */
export function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

/** ~10% of the full RGB diagonal (441). Catches "same colour, minor
 *  rounding/anti-alias drift" while flagging genuinely different hues. */
export const DEFAULT_COLOR_TOLERANCE = 44

function normalizeHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
}

/* ── Comparison ─────────────────────────────────────────── */

const DEDUCTION = {
  colorMissing: 12,   // a declared brand colour absent from the live site
  voiceHigh: 20,
  voiceMedium: 12,
  voiceLow: 6,
} as const

/**
 * Compare declared Brand DNA against observed live-site signals.
 * Returns a self-contained Brand Consistency result. Emits a mismatch only
 * when there is concrete evidence; attributes without declared data are
 * skipped (not scored), so an empty brand profile yields score 100 with
 * nothing checked rather than a fabricated verdict.
 */
export function compareBrandConsistency(
  declared: DeclaredBrand,
  observed: ObservedBrand,
  opts: { colorTolerance?: number } = {},
): BrandConsistencyResult {
  const tolerance = opts.colorTolerance ?? DEFAULT_COLOR_TOLERANCE
  const mismatches: BrandMismatch[] = []
  const attributesChecked: BrandAttribute[] = []

  // ── Colours ──
  const declaredColors = (declared.colors || [])
    .map((c) => ({ raw: c, rgb: parseColor(c) }))
    .filter((c): c is { raw: string; rgb: [number, number, number] } => c.rgb != null)
  const observedColors = (observed.colors || [])
    .map((c) => parseColor(c))
    .filter((c): c is [number, number, number] => c != null)

  // Colours are ONE grouped issue — "colour" is a single consistency concern
  // even when several declared colours are missing (Stefano, 2026-06-13). The
  // score still reflects magnitude (per-missing-colour deduction); only the
  // surfaced finding is grouped, listing every missing colour as evidence.
  const missingColors: string[] = []
  if (declaredColors.length > 0 && observedColors.length > 0) {
    attributesChecked.push('color')
    for (const dc of declaredColors) {
      const present = observedColors.some((oc) => colorDistance(dc.rgb, oc) <= tolerance)
      if (!present) missingColors.push(normalizeHex(dc.rgb))
    }
    if (missingColors.length > 0) {
      const many = missingColors.length > 1
      mismatches.push({
        attribute: 'color',
        severity: 'medium',
        title: many ? 'Declared brand colours not found on the live site' : 'Declared brand colour not found on the live site',
        detail: `Your Brand DNA lists ${missingColors.length} brand colour${many ? 's that do' : ' that does'} not appear in the live site's styling.`,
        evidence: `Declared but not observed (beyond consistency tolerance): ${missingColors.join(', ')}.`,
        // Off-palette is brand fidelity, not directly end-user trust.
        trustHarming: false,
      })
    }
  }

  // ── Voice / tone (quote-grounded only) — ONE grouped issue ──
  const hasVoiceSignal = !!(declared.voice && declared.voice.trim()) || (declared.toneKeywords || []).length > 0
  const voiceQuotes = (observed.voiceContradictions || []).filter((vc) => vc.quote && vc.quote.trim())
  if (hasVoiceSignal) {
    attributesChecked.push('voice')
    if (voiceQuotes.length > 0) {
      const many = voiceQuotes.length > 1
      const severity: BrandMismatchSeverity = voiceQuotes.some((q) => q.severity === 'high') ? 'high' : 'medium'
      mismatches.push({
        attribute: 'voice',
        severity,
        title: 'Site copy conflicts with declared brand voice',
        detail: `${voiceQuotes.length} passage${many ? 's' : ''} on the live site read in a way that conflicts with your declared ${voiceQuotes[0].conflictsWith}.`,
        evidence: voiceQuotes.map((q) => `"${q.quote.trim()}"${q.pageUrl ? ` — ${q.pageUrl}` : ''}`).join('  |  '),
        // Voice that contradicts positioning erodes end-user trust.
        trustHarming: true,
      })
    }
  }

  // ── Score (own metric, floored at 0) — driven by underlying magnitude,
  //    not by the grouped-mismatch count. ──
  let score = 100
  score -= DEDUCTION.colorMissing * missingColors.length
  for (const q of voiceQuotes) {
    if (q.severity === 'high') score -= DEDUCTION.voiceHigh
    else if (q.severity === 'low') score -= DEDUCTION.voiceLow
    else score -= DEDUCTION.voiceMedium
  }
  score = Math.max(0, Math.min(100, score))

  return { score, attributesChecked, mismatches }
}
