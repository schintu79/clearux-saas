// Phase 3 — "Verified fixed" badge. Renders only when an automated re-check
// proved a fix actually landed (audit_findings.verified_fixed_at). The proof,
// surfaced on the finding.
import { CheckCircle2 } from 'lucide-react'

export function VerifiedFixedBadge({ verifiedAt }: { verifiedAt?: string | null }) {
  if (!verifiedAt) return null
  let when = ''
  try {
    when = new Date(verifiedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch { /* leave blank on bad date */ }
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap"
      style={{
        background: 'color-mix(in srgb, var(--ok) 12%, transparent)',
        color: 'var(--ok)',
        border: '1px solid color-mix(in srgb, var(--ok) 30%, transparent)',
      }}
      title={`An automated re-check confirmed this fix on ${when || 'a recent date'}.`}
    >
      <CheckCircle2 size={12} />
      Verified fixed{when ? ` · re-checked ${when}` : ''}
    </span>
  )
}
