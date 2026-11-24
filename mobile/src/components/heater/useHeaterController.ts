import { useToast } from 'heroui-native'
import { useEffect, useRef, useState } from 'react'
import {
  decide,
  HEATER_FAILURE_TITLES,
  heaterView,
  INITIAL_CONTROL,
  observedField,
  observeHeater,
  perform,
  resumeAfterStop,
  type HeaterCommands,
  type HeaterDecision,
  type HeaterField,
  type HeaterIntent,
} from '@renewvan/core/heater'
import { GIVE_UP_MS, giveUp } from '@renewvan/core/pending'
import { isReporting } from '@renewvan/core/sensors'
import type { Heater } from '@/types'

type Timer = ReturnType<typeof setTimeout>

/**
 * One heater card's controller (`@renewvan/core/heater`, the dashboard's `useHeaterController`): its
 * state, the give-up timer and the toast for a command the heater never confirmed. Everything it
 * decides is core's; this only holds it.
 *
 * Settled commands are dropped against the heater's real fields while rendering (React's
 * adjust-state-on-prop-change pattern), so a settled entry never paints and a value that later
 * returns to the pre-command one can never re-show a stale target or a false failure.
 */
export function useHeaterController(
  id: string,
  heater: Heater,
  frozen: boolean,
  commands: HeaterCommands,
) {
  const { toast } = useToast()
  const [stored, setStored] = useState(INITIAL_CONTROL)
  // Frozen or not reporting: nothing would answer, so every command in flight ends.
  const inert = frozen || !isReporting(heater)
  const control = observeHeater(stored, heater, inert)
  if (control !== stored) setStored(control)
  const view = heaterView(control, heater, frozen)

  // The heater and control as of the latest render, so a timer can tell whether the heater has
  // answered since, and a settled entry is not reported as a failure.
  const latest = useRef({ heater, control })
  useEffect(() => {
    latest.current = { heater, control }
  })
  const timers = useRef<Map<HeaterField, Timer>>(new Map())
  const clearTimers = () => {
    for (const handle of timers.current.values()) clearTimeout(handle)
    timers.current.clear()
  }
  useEffect(() => {
    if (inert) clearTimers()
  }, [inert])
  useEffect(() => clearTimers, [])

  const apply = (decision: HeaterDecision) => {
    if (decision.kind === 'update') setStored(decision.control)
    if (decision.kind !== 'send') return
    const { field } = decision
    setStored(decision.control)
    const running = timers.current.get(field)
    if (running !== undefined) clearTimeout(running)
    timers.current.set(
      field,
      setTimeout(() => {
        timers.current.delete(field)
        const { heater: now, control: current } = latest.current
        const gaveUp = giveUp(current.pendings, field, observedField(now, field))
        if (!gaveUp.failed) return
        setStored((prev) => ({
          ...prev,
          pendings: giveUp(prev.pendings, field, observedField(now, field)).pendings,
        }))
        toast.show({
          variant: 'danger',
          label: HEATER_FAILURE_TITLES[field],
          description: heater.name,
        })
      }, GIVE_UP_MS.heater),
    )
    perform(commands, id, decision.steps)
  }

  /** What a tap means for this heater now: sent, chosen, or (for a mode it cannot reach) asked about. */
  const dispatch = (intent: HeaterIntent): HeaterDecision => {
    const decision = decide(control, heater, frozen, intent)
    apply(decision)
    return decision
  }

  // The stop a mode switch asked for went through: now reach the mode it was for.
  useEffect(() => {
    const resumed = resumeAfterStop(control, heater, frozen)
    if (!resumed) return
    setStored(resumed.control)
    apply(resumed.decision)
    // `apply` and the inputs are rebuilt every render; only a phase change or a failed run matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heater.phase, view.runFailed])

  return { view, dispatch }
}
