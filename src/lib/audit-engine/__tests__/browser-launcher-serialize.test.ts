import { serializeLaunch } from '../browser-launcher'

// Regression for the 2026-06-15 `spawn ETXTBSY` incident: parallel browser
// launches (responsive + WCAG) raced on the Chromium binary. serializeLaunch
// must ensure no two launch bodies run concurrently.

describe('serializeLaunch', () => {
  it('never lets two tasks overlap, even when started in parallel', async () => {
    let active = 0
    let maxActive = 0
    const task = () =>
      serializeLaunch(async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise((r) => setTimeout(r, 10))
        active--
        return active
      })

    await Promise.all([task(), task(), task(), task()])
    expect(maxActive).toBe(1) // strictly serialized
  })

  it('preserves call order and returns each result', async () => {
    const order: number[] = []
    const make = (n: number) => serializeLaunch(async () => { order.push(n); return n })
    const results = await Promise.all([make(1), make(2), make(3)])
    expect(results).toEqual([1, 2, 3])
    expect(order).toEqual([1, 2, 3])
  })

  it('a failing task does not deadlock the queue', async () => {
    await expect(serializeLaunch(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    // The lock must release so the next launch still runs.
    await expect(serializeLaunch(async () => 'ok')).resolves.toBe('ok')
  })
})
