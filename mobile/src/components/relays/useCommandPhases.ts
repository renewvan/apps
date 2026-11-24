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

type Timer = ReturnType<typeof setTimeout>

/**
 * Pending and failed commands per relay id, and the give-up (the dashboard's `useCommandPhases`).
 * The app never claims a relay switched because it was asked to; only the bus says so (hub ADR 0013).
 * Settled commands are dropped against the relay's real `state` while rendering, so a state that
 * later returns to the pre-tap value can never re-show the old target or a false failure.
 */
export function useCommandPhases(
  relays: Record<string, Relay>,
  frozen: boolean,
  send: (id: string, on: boolean) => void,
) {
  const [phases, setPhases] = useState<Pendings<string, boolean>>({})
  const [wasFrozen, setWasFrozen] = useState(frozen)
  const timers = useRef<Map<string, Timer>>(new Map())
  // The relays as of the latest render, so a timer can tell whether the relay has answered since.
  const latest = useRef(relays)
  useEffect(() => {
    latest.current = relays
  })

  const clearTimers = () => {
    for (const handle of timers.current.values()) clearTimeout(handle)
    timers.current.clear()
  }

  // A Driver that drops, or Demo mode, ends every command in flight, so no stale target or failure
  // surfaces when it returns. Adjusting state while rendering is React's way to reset on a change.
  if (frozen !== wasFrozen) {
    setWasFrozen(frozen)
    if (frozen) setPhases({})
  }

  const settled = settle(phases, (id) => relays[id]?.state)
  if (settled) setPhases(settled)

  useEffect(() => {
    if (frozen) clearTimers()
  }, [frozen])

  useEffect(() => clearTimers, [])

  const request = (id: string, to: boolean) => {
    // The page is disabled while frozen; this guards a confirmation that was already open.
    if (frozen) return
    const running = timers.current.get(id)
    if (running !== undefined) clearTimeout(running)
    setPhases((prev) => track(prev, id, relays[id]?.state, to))
    timers.current.set(
      id,
      setTimeout(() => {
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
