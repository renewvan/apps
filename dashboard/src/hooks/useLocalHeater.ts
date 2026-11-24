import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HeaterCommands } from '@renewvan/core/heater'
import type { HeaterTimerKind } from '@renewvan/core/sensors'
import type { Heater, HeaterPhase } from '@/types'

/** Delay before the local heater "answers" a command, so the page's pending state is visible. */
const ANSWER_MS = 500
/** Time spent in each transitional phase. */
const PHASE_MS = 2000

/** A cabin heater that is off and ready, with commands on, so every control can be worked on. */
const INITIAL: Heater = {
  name: 'Cabin heater (local)',
  phase: 'off',
  status_code: '0.1',
  error_code: 0,
  internal_temperature_c: 19.4,
  heater_temperature_c: 24,
  voltage_v: 12.4,
  fan_rpm: 0,
  fuel_pump_hz: 0,
  runtime_s: 0,
  mode: 'heater_temperature',
  setpoint_c: 21,
  power_level: 4,
  commands_enabled: true,
}

/**
 * Dev-only local heater for the Heater page (`?flag.heater-dev=1`): it does not need the hub, the
 * driver or Demo mode. It stands in for the Driver at the Commands seam: `commands` is what the
 * page sends to instead of the bus, and the heater it publishes carries the same fields the real
 * one does (`mode`, `thermostat`, `ventilating`), so the page reads every operating mode from it
 * like from a real heater. Commands change an in-memory heater and publish nothing; a start walks
 * through the phases and a stop through shutting down.
 */
export function useLocalHeater(enabled: boolean) {
  const [heater, setHeater] = useState<Heater>(INITIAL)
  // Venus-style timer: a countdown from the start that stops the heater. Minutes, 0 for Off; the
  // armed value stays for the next start. `endsAt` is set while a countdown runs.
  const [timerMinutes, setTimerMinutesState] = useState(0)
  const [endsAt, setEndsAt] = useState<number | undefined>(undefined)
  // Autoterm's two timers: `off` stops the heater after the armed time (above), `on` starts it
  // after the armed time. `startsAt` is set while an On-in countdown runs.
  const [timerKind, setTimerKindState] = useState<HeaterTimerKind>('off')
  const [startsAt, setStartsAt] = useState<number | undefined>(undefined)
  const armedKind = useRef<HeaterTimerKind>('off')
  const armedMinutes = useRef(0)
  const timers = useRef<Set<number>>(new Set())
  // Bumped by every start and stop sequence: a delayed phase from a stale sequence (the off at the
  // end of a Stop answered just before a Start) must not land on the fresh one.
  const generation = useRef(0)

  useEffect(() => {
    const live = timers.current
    return () => {
      for (const handle of live) window.clearTimeout(handle)
      live.clear()
    }
  }, [])

  const later = useCallback((ms: number, fn: () => void) => {
    const handle = window.setTimeout(() => {
      timers.current.delete(handle)
      fn()
    }, ms)
    timers.current.add(handle)
  }, [])

  const patch = useCallback(
    (fields: Partial<Heater>) => setHeater((prev) => ({ ...prev, ...fields })),
    [],
  )
  const phase = useCallback(
    (next: HeaterPhase, runtime_s?: number) =>
      patch({ phase: next, ...(runtime_s === undefined ? {} : { runtime_s }) }),
    [patch],
  )

  const stopSequence = useCallback(() => {
    generation.current += 1
    const generationAtStop = generation.current
    setEndsAt(undefined)
    patch({ phase: 'shutting_down', ventilating: false })
    later(PHASE_MS, () => {
      // A Start inside the window is a newer generation and must survive this.
      if (generation.current === generationAtStop) phase('off', 0)
    })
  }, [later, patch, phase])

  const beginStart = useCallback(() => {
    generation.current += 1
    patch({ phase: 'starting', runtime_s: 0, ventilating: false })
    // A start, by hand or by the On-in timer, ends any pending On-in countdown.
    setStartsAt(undefined)
    if (armedKind.current === 'off' && armedMinutes.current > 0) {
      setEndsAt(Date.now() + armedMinutes.current * 60_000)
    }
    later(PHASE_MS, () => {
      phase('warming_up')
      later(PHASE_MS, () => phase('running'))
    })
  }, [later, patch, phase])

  // Ventilation is a fan-only start: nothing burns, so no warm-up (the real heater's 3.35).
  const beginVentilation = useCallback(() => {
    generation.current += 1
    patch({ phase: 'running', ventilating: true, runtime_s: 0 })
  }, [patch])

  // The On-in countdown ends in the same start a Start press makes.
  useEffect(() => {
    if (startsAt === undefined) return
    const handle = window.setTimeout(beginStart, Math.max(0, startsAt - Date.now()))
    return () => window.clearTimeout(handle)
  }, [startsAt, beginStart])

  // The countdown ends in the same stop a Stop press makes.
  useEffect(() => {
    if (endsAt === undefined) return
    const handle = window.setTimeout(stopSequence, Math.max(0, endsAt - Date.now()))
    return () => window.clearTimeout(handle)
  }, [endsAt, stopSequence])

  const on =
    heater.phase !== undefined && heater.phase !== 'off' && heater.phase !== 'shutting_down'
  // Arms `minutes` as the given kind. Off-in while the heater is on counts from now; On-in only
  // counts while the heater is off; 0 cancels whichever countdown was running.
  const arm = useCallback(
    (kind: HeaterTimerKind, minutes: number) => {
      armedKind.current = kind
      armedMinutes.current = minutes
      setTimerKindState(kind)
      setTimerMinutesState(minutes)
      const until = Date.now() + minutes * 60_000
      setEndsAt(kind === 'off' && on && minutes > 0 ? until : undefined)
      setStartsAt(kind === 'on' && !on && minutes > 0 ? until : undefined)
    },
    [on],
  )
  const setTimerMinutes = useCallback((minutes: number) => arm(armedKind.current, minutes), [arm])
  const setTimerKind = useCallback(
    (kind: HeaterTimerKind) => arm(kind, armedMinutes.current),
    [arm],
  )
  // Each Command is answered after ANSWER_MS, as the retained field changing.
  const commands = useMemo<HeaterCommands>(
    () => ({
      setHeaterRunning: (_id, run) => later(ANSWER_MS, () => (run ? beginStart() : stopSequence())),
      setHeaterVentilating: (_id, on) =>
        later(ANSWER_MS, () => (on ? beginVentilation() : stopSequence())),
      setHeaterMode: (_id, mode) => later(ANSWER_MS, () => patch({ mode })),
      setHeaterThermostat: (_id, on) => later(ANSWER_MS, () => patch({ thermostat: on })),
      setHeaterSetpoint: (_id, celsius) => later(ANSWER_MS, () => patch({ setpoint_c: celsius })),
      setHeaterPowerLevel: (_id, level) => later(ANSWER_MS, () => patch({ power_level: level })),
      setHeaterCommandsEnabled: (_id, enabled) =>
        later(ANSWER_MS, () => patch({ commands_enabled: enabled })),
    }),
    [later, patch, beginStart, beginVentilation, stopSequence],
  )

  const heaters = useMemo(() => {
    const out: Record<string, Heater> = {}
    if (enabled) out.cabin = heater
    return out
  }, [enabled, heater])
  return {
    heaters,
    commands,
    timerMinutes,
    timerKind,
    // The moment the running countdown fires: the stop for Off-in, the start for On-in.
    endsAt: timerKind === 'on' ? startsAt : endsAt,
    setTimerMinutes,
    setTimerKind,
  }
}
