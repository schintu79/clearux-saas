'use client'

import { useEffect, useState } from 'react'
import {
  type BrandSelection,
  readSelection,
  subscribeSelection,
} from '@/lib/dashboard/brand-selection'

/**
 * Hook returning the current brand/site selection from localStorage.
 *
 * `ready` flips to true after the initial mount so callers can avoid
 * firing an unscoped fetch with `selection: null` before the persisted
 * selection has been read on the client.
 */
export function useBrandSelection(): { selection: BrandSelection; ready: boolean } {
  const [selection, setSelection] = useState<BrandSelection>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSelection(readSelection())
    setReady(true)
    const unsub = subscribeSelection((sel) => setSelection(sel))
    return unsub
  }, [])

  return { selection, ready }
}
