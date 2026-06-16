'use client'

// ============================================================
// Coverage Limitations — inspect / re-check / decide
// ============================================================
// Surfaces the audit's coverage gaps (pages we couldn't fully see) WITH their
// evidence, so the user can validate and decide — not an empty "limited" label.
// Per limitation: inspect the evidence, Re-check it live, then Dismiss (remembered
// per workspace) or Promote to a tracked finding.
//
// Wire into the audit view: render <CoverageLimitationsModal auditId open onClose/>
// from a "Coverage limitations (N)" button.
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { ExternalLink, X, RefreshCw, Check, Flag } from 'lucide-react'

interface LimitationEvidence {
  http_status: number | null
  fetch_strategy: string | null
  captured_at: string | null
  text_length: number
  text_excerpt: string
}
interface Limitation {
  page_url: string
  reason: string
  label: string
  detail: string
  evidence: LimitationEvidence
  status: 'open' | 'dismissed' | 'promoted'
  finding_id: string | null
}

interface Props {
  auditId: string
  open: boolean
  onClose: () => void
}

export default function CoverageLimitationsModal({ auditId, open, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limitations, setLimitations] = useState<Limitation[]>([])
  const [dismissedCount, setDismissedCount] = useState(0)
  const [busy, setBusy] = useState<string | null>(null) // `${page_url}::${action}`
  const [recheck, setRecheck] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/audits/${auditId}/limitations`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed to load')
      setLimitations(d.limitations || [])
      setDismissedCount(d.dismissed_count || 0)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [auditId])

  useEffect(() => { if (open) load() }, [open, load])

  const act = async (lim: Limitation, action: 'recheck' | 'dismiss' | 'promote') => {
    setBusy(`${lim.page_url}::${action}`)
    try {
      const r = await fetch(`/api/audits/${auditId}/limitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_url: lim.page_url, reason: lim.reason, action }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Action failed')
      if (action === 'recheck') setRecheck((m) => ({ ...m, [lim.page_url]: d.verdict }))
      else await load() // dismiss/promote → refresh (memory applied)
    } catch (e) { setRecheck((m) => ({ ...m, [lim.page_url]: `Error: ${(e as Error).message}` })) }
    finally { setBusy(null) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl shadow-xl" style={{ background: 'var(--card, #fff)' }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--rule, #eee)' }}>
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--ink, #111)' }}>Coverage limitations</h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--m-muted, #777)' }}>
              Pages we couldn&apos;t fully analyze. Inspect the evidence, re-check live, then dismiss or promote to a finding.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-black/[0.04]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {loading && <p className="text-[13px]" style={{ color: 'var(--m-muted)' }}>Loading…</p>}
          {error && <p className="text-[13px]" style={{ color: 'var(--severe, #c00)' }}>{error}</p>}

          {!loading && !error && limitations.length === 0 && (
            <p className="text-[13px]" style={{ color: 'var(--m-muted)' }}>
              No open coverage limitations — every page was analyzed.
              {dismissedCount > 0 && ` (${dismissedCount} previously dismissed.)`}
            </p>
          )}

          {/* Grouped by reason so the same error isn't repeated as separate cards. */}
          {Array.from(
            limitations.reduce((m, lim) => {
              const arr = m.get(lim.reason) || []
              arr.push(lim); m.set(lim.reason, arr); return m
            }, new Map<string, Limitation[]>())
          ).map(([reason, items]) => (
            <div key={reason} className="rounded-lg mb-3"
              style={{ border: '1px solid var(--rule, #eee)', background: 'var(--paper-2, #fafafa)' }}>
              <div className="px-3 pt-3">
                <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {items[0].label}
                  <span className="font-normal" style={{ color: 'var(--m-muted)' }}> · {items.length} page{items.length > 1 ? 's' : ''}</span>
                </h3>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--ink-2, #444)' }}>{items[0].detail}</p>
              </div>
              <ul className="px-3 pb-3 mt-2 space-y-2">
                {items.map((lim) => (
                  <li key={lim.page_url} className="rounded-md p-2.5"
                    style={{ border: '1px solid var(--rule, #eee)', background: 'var(--card, #fff)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={lim.page_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] hover:underline truncate max-w-[420px]" style={{ color: 'var(--ink)' }}>
                        <ExternalLink size={11} /> {lim.page_url}
                      </a>
                      {lim.status === 'promoted' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'color-mix(in srgb, var(--signal,#36c) 12%, transparent)', color: 'var(--signal,#36c)' }}>Promoted</span>
                      )}
                    </div>

                    <div className="mt-1.5 text-[11px] flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--m-muted)' }}>
                      {lim.evidence.http_status != null && <span>HTTP {lim.evidence.http_status}</span>}
                      {lim.evidence.fetch_strategy && <span>Method: {lim.evidence.fetch_strategy}</span>}
                      <span>{lim.evidence.text_length} chars captured</span>
                      {lim.evidence.captured_at && <span>Captured {new Date(lim.evidence.captured_at).toLocaleString()}</span>}
                    </div>
                    {lim.evidence.text_excerpt && (
                      <pre className="mt-1.5 text-[11px] whitespace-pre-wrap rounded p-2 overflow-x-auto"
                        style={{ background: 'var(--paper-2,#fafafa)', border: '1px solid var(--rule,#eee)', color: 'var(--ink-2,#444)' }}>
                        {lim.evidence.text_excerpt}
                      </pre>
                    )}
                    {recheck[lim.page_url] && (
                      <p className="text-[12px] mt-1.5 font-medium" style={{ color: 'var(--ink)' }}>↳ {recheck[lim.page_url]}</p>
                    )}

                    <div className="flex items-center gap-2 mt-2.5">
                      <button onClick={() => act(lim, 'recheck')} disabled={!!busy}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
                        style={{ border: '1px solid var(--rule)', color: 'var(--ink)' }}>
                        <RefreshCw size={12} className={busy === `${lim.page_url}::recheck` ? 'animate-spin' : ''} /> Re-check live
                      </button>
                      {lim.status === 'promoted' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium opacity-60 cursor-default"
                          style={{ border: '1px solid var(--rule)', color: 'var(--m-muted)' }}>
                          <Flag size={12} /> Promoted
                        </span>
                      ) : (
                        <button onClick={() => act(lim, 'promote')} disabled={!!busy}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
                          style={{ background: 'var(--ink)', color: 'var(--paper,#fff)' }}>
                          <Flag size={12} /> Promote to finding
                        </button>
                      )}
                      {lim.status !== 'promoted' && (
                        <button onClick={() => act(lim, 'dismiss')} disabled={!!busy}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium disabled:opacity-50"
                          style={{ border: '1px solid var(--rule)', color: 'var(--m-muted)' }}>
                          <Check size={12} /> Dismiss
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
