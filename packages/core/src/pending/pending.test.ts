import { describe, expect, it } from 'vite-plus/test'
import { GIVE_UP_MS, giveUp, observe, settle, track as trackKey, type Pendings } from './pending'

type Key = 'a' | 'b'
const none: Pendings<Key> = {}
const track = (pendings: Pendings<Key>, key: Key, from: unknown, to?: unknown) =>
  trackKey<Key>(pendings, key, from, to)

describe('track', () => {
  it('records the value the field had at the tap and the target sent', () => {
    expect(track(none, 'a', 'off', 5)).toEqual({ a: { from: 'off', to: 5, failed: false } })
  })

  it('replaces an earlier command on the same key and leaves the others', () => {
    const before = track(track(none, 'a', 1, 2), 'b', 'x')
    expect(track(before, 'a', 2, 3)).toEqual({
      a: { from: 2, to: 3, failed: false },
      b: { from: 'x', to: undefined, failed: false },
    })
  })
})

describe('observe', () => {
  const sent = track(none, 'a', 'off')

  it('stays pending while the field is still the value it was sent from', () => {
    expect(observe(sent, 'a', 'off')).toEqual({ from: 'off', to: undefined, failed: false })
  })

  it('is over the moment the field leaves that value, even for a value nobody asked for', () => {
    expect(observe(sent, 'a', 'starting')).toBeUndefined()
    expect(observe(sent, 'a', undefined)).toBeUndefined()
  })

  it('keeps a failure until the field reaches the target on its own', () => {
    const failed = giveUp(track(none, 'a', false, true), 'a', false).pendings
    expect(observe(failed, 'a', false)?.failed).toBe(true)
    // Some other value is not the target: the failure stands.
    expect(observe(failed, 'a', undefined)?.failed).toBe(true)
    expect(observe(failed, 'a', true)).toBeUndefined()
  })

  it('keeps a failure with no target (a start or stop) shown until it is retried', () => {
    const failed = giveUp(sent, 'a', 'off').pendings
    expect(observe(failed, 'a', 'off')?.failed).toBe(true)
    expect(observe(failed, 'a', 'running')?.failed).toBe(true)
  })

  it('knows nothing of a key that was never sent', () => {
    expect(observe(none, 'b', 1)).toBeUndefined()
  })
})

describe('settle', () => {
  it('returns nothing when every entry still applies', () => {
    expect(settle(track(none, 'a', 1), () => 1)).toBeNull()
  })

  it('deletes settled entries, so a value that returns to the pre-command one cannot re-show them', () => {
    const sent = track(none, 'a', 'off')
    const settled = settle(sent, () => 'starting')
    expect(settled).toEqual({})
    expect(observe(settled!, 'a', 'off')).toBeUndefined()
  })

  it('keeps the entries that are still waiting', () => {
    const both = track(track(none, 'a', 1), 'b', 2)
    expect(settle(both, (key) => (key === 'a' ? 9 : 2))).toEqual({
      b: { from: 2, to: undefined, failed: false },
    })
  })
})

describe('giveUp', () => {
  const sent = track(none, 'a', 'off', 7)

  it('fails a command whose field never moved', () => {
    const result = giveUp(sent, 'a', 'off')
    expect(result.failed).toBe(true)
    expect(result.pendings.a).toEqual({ from: 'off', to: 7, failed: true })
  })

  it('reports nothing once the field answered, even if the entry is still stored', () => {
    expect(giveUp(sent, 'a', 'starting')).toEqual({ pendings: sent, failed: false })
  })

  it('reports nothing for an entry settled meanwhile or already failed', () => {
    expect(giveUp(none, 'a', 'off')).toEqual({ pendings: none, failed: false })
    const once = giveUp(sent, 'a', 'off').pendings
    expect(giveUp(once, 'a', 'off')).toEqual({ pendings: once, failed: false })
  })
})

describe('GIVE_UP_MS', () => {
  it('gives a heater longer than a relay: a setting is only confirmed by the next settings read (hub ADR 0021)', () => {
    expect(GIVE_UP_MS.heater).toBe(6000)
    expect(GIVE_UP_MS.relay).toBe(4000)
  })
})
