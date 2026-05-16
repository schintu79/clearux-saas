// ============================================================
// Fixpath — Selected brand/site state for the dashboard.
//
// Centralises the "what am I looking at right now?" selection so
// every dashboard page (Overview / Find / Fix / Track) scopes its
// queries to the same brand or site as the sidebar selector.
//
// Before this module existed, the sidebar tracked the selected
// site in component-local state and the dashboard pages each
// loaded the user's most-recent audit user-wide — meaning a
// brand switch still showed the previous brand's audit data.
// ============================================================

export type BrandSelection =
  | { kind: 'site'; host: string }
  | { kind: 'brand'; brandId: string }
  | null

const STORAGE_KEY = 'fixpath:selected'
const EVENT = 'fixpath:selection-change'

export function readSelection(): BrandSelection {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.kind === 'site' && typeof parsed.host === 'string') {
      return { kind: 'site', host: parsed.host }
    }
    if (parsed?.kind === 'brand' && typeof parsed.brandId === 'string') {
      return { kind: 'brand', brandId: parsed.brandId }
    }
  } catch {}
  return null
}

export function writeSelection(sel: BrandSelection): void {
  if (typeof window === 'undefined') return
  try {
    if (sel == null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sel))
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: sel }))
  } catch {}
}

/** Subscribe to selection changes (same-tab + cross-tab). Returns an unsubscribe. */
export function subscribeSelection(fn: (sel: BrandSelection) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onCustom = (e: Event) => fn((e as CustomEvent).detail ?? readSelection())
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) fn(readSelection()) }
  window.addEventListener(EVENT, onCustom as EventListener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onCustom as EventListener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Encode the sidebar-style id ("site:domain" / "brand:uuid") into a selection. */
export function selectionFromSidebarId(id: string | null | undefined): BrandSelection {
  if (!id) return null
  if (id.startsWith('site:')) return { kind: 'site', host: id.slice(5) }
  if (id.startsWith('brand:')) return { kind: 'brand', brandId: id.slice(6) }
  return null
}
