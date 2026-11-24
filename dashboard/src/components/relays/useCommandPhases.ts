import { useEffect, useRef, useState } from 'react'
import { GIVE_UP_MS, giveUp, observe, settle, track, type Pendings } from '@renewvan/core/pending'
import type { Relay } from '@/types'

/**
 * What a command in flight shows (`@renewvan/core/pending`): pending shows the tapped target with a
 * spinner until the retained `state` changes, and failed means `GIVE_UP_MS.relay` passed with no
 * change, with the control back on the real state.
 */
export interface Phase {
  /** The state the tap asked for. */
  to: boolean
  failed: boolean
}

/**
 * Pending and failed commands per relay id, and the give-up (mobile's `useCommandPhases`).
 *
 * Whether a stored phase still applies is settled against the relay's real `state` while
 * rendering (React's adjust-state-on-prop-change pattern, same as `frozen` below): settled
 * entries are deleted, not just hidden, so a state that later returns to the pre-tap value can
 * never re-show the old target or a false failure.
 */
export function useCommandPhases(
  relays: Record<string, Relay>,
  frozen: boolean,
  send: (id: string, on: boolean) => void,
  onFreeze: () => void,
) {
  const [phases, setPhases] = useState<Pendings<string, boolean>>({})
  const [wasFrozen, setWasFrozen] = useState(frozen)
  const timers = useRef<Map<string, number>>(new Map())
  // The relays as of the latest render, so a timer can tell whether the relay has answered since.
  const latest = useRef(relays)
  useEffect(() => {
    latest.current = relays
  })

  const clearTimers = () => {
    for (const handle of timers.current.values()) window.clearTimeout(handle)
    timers.current.clear()
  }

  // A Driver that drops, or Demo mode, ends every command in flight and any open confirmation, so
  // no stale target, failure or pump prompt surfaces when it returns. Adjusting state while
  // rendering is React's way to reset on a change.
  if (frozen !== wasFrozen) {
    setWasFrozen(frozen)
    if (frozen) {
      setPhases({})
      onFreeze()
    }
  }

  // The real state settled a command: drop the entry for good. Runs before commit, so a settled
  // entry never paints; the give-up timer it leaves behind finds no entry and does nothing.
  const settled = settle(phases, (id) => relays[id]?.state)
  if (settled) setPhases(settled)

  useEffect(() => {
    if (frozen) clearTimers()
  }, [frozen])

  useEffect(() => clearTimers, [])

  const request = (id: string, to: boolean) => {
    // The page is disabled while frozen; this guards a confirmation that was already open.
    if (frozen) return
    window.clearTimeout(timers.current.get(id))
    setPhases((prev) => track(prev, id, relays[id]?.state, to))
    timers.current.set(
      id,
      window.setTimeout(() => {
        timers.current.delete(id)
        setPhases((prev) => giveUp(prev, id, latest.current[id]?.state).pendings)
      }, GIVE_UP_MS.relay),
    )
    send(id, to)
  }

  /** The phase that still applies to a relay, or nothing once its state has settled it. */
  const phaseOf = (id: string): Phase | undefined => {
    const entry = observe(phases, id, relays[id]?.state)
    // A relay command always has its target.
    return entry && { to: entry.to as boolean, failed: entry.failed }
  }

  return { phaseOf, request }
}
