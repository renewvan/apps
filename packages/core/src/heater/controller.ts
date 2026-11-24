import { observe, settle, track, type Pending, type Pendings } from '../pending'
import {
  canChangeSettings,
  canStart,
  canStop,
  hasError,
  heaterSensor,
  isReporting,
  modeSwitchBlock,
  operatingMode,
  startSummary,
  statusLine,
  type HeaterSensor,
  type OperatingMode,
} from '../sensors'
import type { Commands } from '../commands'
import type { Heater, HeaterMode } from '../types'

/**
 * What a heater card does with a tap, decided once. A card asks `decide` what an intent means for
 * the heater as the bus reports it, and gets back the Commands to send (in order), the field whose
 * change will confirm them, and the new control state; `heaterView` says what the card may offer.
 * The safety rules are hub ADR 0021's: a heater whose Driver is down or whose live fields are
 * cleared is unknown and gets nothing, a Command is never assumed to have worked, `stop` is always
 * allowed, a start only from off without a fault, and settings never while shutting down or
 * ventilating. The cards (React DOM, React Native) own the state, the give-up timer and the toast.
 */

/** The four things a card can command; each is confirmed by its own retained field changing. */
export type HeaterField = 'run' | 'mode' | 'setpoint' | 'power'

/** The toast title for a command the heater never confirmed. */
export const HEATER_FAILURE_TITLES: Record<HeaterField, string> = {
  setpoint: "Target didn't change",
  power: "Power didn't change",
  mode: "Mode didn't change",
  run: "Heater didn't respond",
}

/** The retained value that confirms each command. A start or stop is confirmed by the phase moving. */
export function observedField(heater: Heater, field: HeaterField): unknown {
  switch (field) {
    case 'run':
      return heater.phase
    case 'mode':
      // Temperature and Thermostat share a `mode`: the pair is what a mode change moves.
      return `${heater.mode}/${heater.thermostat}`
    case 'setpoint':
      return heater.setpoint_c
    case 'power':
      return heater.power_level
  }
}

/** What a card remembers about one heater between taps. */
export interface HeaterControl {
  pendings: Pendings<HeaterField>
  /**
   * Ventilation is chosen first and started by Start: the hub has no `mode` for it, so the choice is
   * held here, and only stands while the heater is off.
   */
  ventilationChosen: boolean
  /** The sensor a switch back to Temperature resumes: the one in use, else the last one seen. */
  lastSensor: HeaterSensor
  /** A mode switch that asked the heater to stop first: reached once it is off. */
  afterStop: OperatingMode | null
}

export const INITIAL_CONTROL: HeaterControl = {
  pendings: {},
  ventilationChosen: false,
  lastSensor: 'heater_temperature',
  afterStop: null,
}

/**
 * The control state brought in line with the heater as it is now: commands the heater has answered
 * are dropped, the sensor in use is remembered, and the ventilation choice is spent once the heater
 * leaves off (started from here, the panel or anywhere else, so a later Start never runs the fan on
 * a choice made before that run). `inert` (the Driver is down, Demo mode, or the heater not
 * reporting) ends every command in flight. The same object when nothing changed.
 */
export function observeHeater(
  control: HeaterControl,
  heater: Heater,
  inert: boolean,
): HeaterControl {
  let next = control
  if (inert) {
    if (Object.keys(next.pendings).length > 0) next = { ...next, pendings: {} }
  } else {
    const settled = settle(next.pendings, (field) => observedField(heater, field))
    if (settled) next = { ...next, pendings: settled }
  }
  const inUse = heaterSensor(heater)
  if (inUse !== undefined && inUse !== next.lastSensor) next = { ...next, lastSensor: inUse }
  if (next.ventilationChosen && heater.phase !== 'off') next = { ...next, ventilationChosen: false }
  return next
}

/** What the card may show and offer. */
export interface HeaterView {
  /** The heater is reporting: not frozen and not cleared by the Driver. Otherwise it reads Unknown. */
  reporting: boolean
  commandsOn: boolean
  /** The controls are live: reporting, and the Driver's own `commands_enabled` is on. */
  controls: boolean
  settingsOk: boolean
  /** Modes can be asked for even while ventilating (the card then offers to stop first), so only a shutdown holds them back. */
  modesOk: boolean
  /** Ventilation has been chosen and Start will run it. */
  armed: boolean
  /** The mode the card shows selected. */
  mode: OperatingMode | undefined
  /** The sensor a Temperature or Thermostat switch uses. */
  sensor: HeaterSensor
  /** Ventilation, like Power, is set by a power level; the others by the target temperature. */
  byPower: boolean
  /** The dial's value: the target just sent while the heater catches up, else what it reports. */
  dialValue: number | undefined
  dialBusy: boolean
  runBusy: boolean
  /** The run command failed: Start or Stop is offered again. */
  runFailed: boolean
  modesDisabled: boolean
  startDisabled: boolean
  stopDisabled: boolean
  /** The Stop button instead of Start. */
  offersStop: boolean
  /** Controls are on but the heater is off with a fault: Start says it cannot. */
  faultBlocksStart: boolean
  /** The flame is on or coming up (never in Ventilation, where nothing burns). */
  heating: boolean
  /** The one line above Start/Stop; the reason the controls are off outranks the rest. */
  info: string | undefined
  /** What Start will run, for its confirm dialog. */
  startSummary: string | undefined
}

export function heaterView(control: HeaterControl, heater: Heater, frozen: boolean): HeaterView {
  const reporting = !frozen && isReporting(heater)
  const commandsOn = heater.commands_enabled === true
  const controls = reporting && commandsOn
  const armed = control.ventilationChosen && heater.phase === 'off'
  const mode: OperatingMode | undefined = armed ? 'ventilation' : operatingMode(heater)
  const byPower = mode === 'power' || mode === 'ventilation'
  const watched = (field: HeaterField): Pending | undefined =>
    observe(control.pendings, field, observedField(heater, field))
  const run = watched('run')
  const change = watched('mode')
  const dial = watched(byPower ? 'power' : 'setpoint')
  const dialBusy = dial !== undefined && !dial.failed
  const runBusy = run !== undefined && !run.failed
  const reportedDial = byPower ? heater.power_level : heater.setpoint_c
  // A frozen heater reads Unknown, so its stale values get no status line either.
  const info = frozen
    ? undefined
    : !reporting
      ? 'No recent reading from the heater.'
      : !commandsOn
        ? 'Read-only! - Commands are turned off.'
        : statusLine(heater, mode)
  return {
    reporting,
    commandsOn,
    controls,
    settingsOk: controls && canChangeSettings(heater),
    modesOk: controls && heater.phase !== 'shutting_down',
    armed,
    mode,
    sensor: heaterSensor(heater) ?? control.lastSensor,
    byPower,
    dialValue: dialBusy && typeof dial.to === 'number' ? dial.to : reportedDial,
    dialBusy,
    runBusy,
    runFailed: run?.failed === true,
    // A failed mode change leaves the buttons usable again (a retry), like a failed run or dial.
    modesDisabled:
      !(controls && heater.phase !== 'shutting_down') || (change !== undefined && !change.failed),
    startDisabled: !controls || !canStart(heater) || runBusy,
    stopDisabled: !controls || runBusy,
    offersStop: canStop(heater),
    faultBlocksStart: controls && heater.phase === 'off' && hasError(heater),
    heating:
      reporting &&
      mode !== 'ventilation' &&
      (heater.phase === 'starting' || heater.phase === 'warming_up' || heater.phase === 'running'),
    info,
    startSummary: startSummary(heater, mode),
  }
}

/** One Command to send, in the order of a plan. */
export type HeaterStep =
  | { command: 'run'; on: boolean }
  | { command: 'ventilate'; on: boolean }
  | { command: 'mode'; mode: HeaterMode }
  | { command: 'thermostat'; on: boolean }
  | { command: 'setpoint'; celsius: number }
  | { command: 'power'; level: number }

/** What the card is asking for. `start` is what the confirm dialog's button sends. */
export type HeaterIntent =
  | { kind: 'start' }
  | { kind: 'stop' }
  | { kind: 'mode'; mode: OperatingMode }
  /** The prompt's "Stop the heater first": stop, then reach `then` once the heater is off. */
  | { kind: 'stopThenMode'; then: OperatingMode }
  | { kind: 'setpoint'; celsius: number }
  | { kind: 'power'; level: number }

export type HeaterDecision =
  /** Nothing to do: the controls are off, the heater cannot take it, or it changes nothing. */
  | { kind: 'ignore' }
  /** Only the card's own state changes (choosing Ventilation sends nothing: Start does). */
  | { kind: 'update'; control: HeaterControl }
  /** The heater cannot switch to `to` while it runs: ask to stop first, with the reason. */
  | { kind: 'askStop'; reason: string; to: OperatingMode }
  /** Send `steps` in order; `field` is what confirms them, already tracked in `control`. */
  | { kind: 'send'; field: HeaterField; steps: HeaterStep[]; to?: number; control: HeaterControl }

function sending(
  control: HeaterControl,
  heater: Heater,
  field: HeaterField,
  steps: HeaterStep[],
  to?: number,
): HeaterDecision {
  return {
    kind: 'send',
    field,
    steps,
    to,
    control: {
      ...control,
      pendings: track(control.pendings, field, observedField(heater, field), to),
    },
  }
}

/** The plan that reaches `next` from the heater as it is, or the choice of Ventilation (which sends nothing). */
function modeDecision(control: HeaterControl, heater: Heater, next: OperatingMode): HeaterDecision {
  const chosen = { ...control, ventilationChosen: next === 'ventilation' }
  // Ventilation changes no `mode` field: Start sends it.
  if (next === 'ventilation') return { kind: 'update', control: chosen }
  // The hub's `mode` is Power or a sensor, so Temperature and Thermostat resume the last sensor.
  // Thermostat is that sensor mode with `thermostat` on; leaving it for any mode turns it off.
  const steps: HeaterStep[] = []
  if (next === 'power') {
    steps.push({ command: 'mode', mode: 'power' })
    if (heater.thermostat === true) steps.push({ command: 'thermostat', on: false })
  } else {
    const on = next === 'thermostat'
    const fromPower = heater.mode === 'power' || heater.mode === undefined
    if (fromPower) steps.push({ command: 'mode', mode: heaterSensor(heater) ?? control.lastSensor })
    if ((heater.thermostat === true) !== on) steps.push({ command: 'thermostat', on })
  }
  return sending(chosen, heater, 'mode', steps)
}

/** What an intent means for this heater now (see the module notes for the rules). */
export function decide(
  control: HeaterControl,
  heater: Heater,
  frozen: boolean,
  intent: HeaterIntent,
): HeaterDecision {
  const view = heaterView(control, heater, frozen)
  switch (intent.kind) {
    case 'start': {
      if (view.startDisabled) return { kind: 'ignore' }
      const steps: HeaterStep[] = [
        view.armed ? { command: 'ventilate', on: true } : { command: 'run', on: true },
      ]
      return sending({ ...control, ventilationChosen: false }, heater, 'run', steps)
    }
    case 'stop':
      if (view.stopDisabled) return { kind: 'ignore' }
      return sending(control, heater, 'run', [{ command: 'run', on: false }])
    case 'stopThenMode':
      if (view.stopDisabled) return { kind: 'ignore' }
      return sending({ ...control, afterStop: intent.then }, heater, 'run', [
        { command: 'run', on: false },
      ])
    case 'mode': {
      if (!view.modesOk || view.modesDisabled || intent.mode === view.mode)
        return { kind: 'ignore' }
      const reason = modeSwitchBlock(heater, view.mode, intent.mode)
      if (reason !== undefined) return { kind: 'askStop', reason, to: intent.mode }
      return modeDecision(control, heater, intent.mode)
    }
    case 'setpoint':
      if (!view.settingsOk) return { kind: 'ignore' }
      return sending(
        control,
        heater,
        'setpoint',
        [{ command: 'setpoint', celsius: intent.celsius }],
        intent.celsius,
      )
    case 'power':
      if (!view.settingsOk) return { kind: 'ignore' }
      return sending(
        control,
        heater,
        'power',
        [{ command: 'power', level: intent.level }],
        intent.level,
      )
  }
}

/**
 * The mode a stop-first switch was for, once the stop went through (the heater is off), as the
 * decision to send it; nothing while the stop is still on its way. A stop that failed drops the
 * wish instead: the heater is still running and the card must not switch it later on its own.
 */
export function resumeAfterStop(
  control: HeaterControl,
  heater: Heater,
  frozen: boolean,
): { control: HeaterControl; decision: HeaterDecision } | undefined {
  const target = control.afterStop
  if (target === null) return undefined
  const cleared = { ...control, afterStop: null }
  if (heaterView(control, heater, frozen).runFailed) {
    return { control: cleared, decision: { kind: 'ignore' } }
  }
  if (heater.phase !== 'off') return undefined
  const next = modeDecision(cleared, heater, target)
  return { control: cleared, decision: next }
}

/** Sends a plan's Commands to one heater, in order. `commands` is the bus's, or a stand-in for it. */
export type HeaterCommands = Pick<
  Commands,
  | 'setHeaterRunning'
  | 'setHeaterMode'
  | 'setHeaterVentilating'
  | 'setHeaterThermostat'
  | 'setHeaterSetpoint'
  | 'setHeaterPowerLevel'
  | 'setHeaterCommandsEnabled'
>

export function perform(commands: HeaterCommands, id: string, steps: readonly HeaterStep[]): void {
  for (const step of steps) {
    switch (step.command) {
      case 'run':
        commands.setHeaterRunning(id, step.on)
        break
      case 'ventilate':
        commands.setHeaterVentilating(id, step.on)
        break
      case 'mode':
        commands.setHeaterMode(id, step.mode)
        break
      case 'thermostat':
        commands.setHeaterThermostat(id, step.on)
        break
      case 'setpoint':
        commands.setHeaterSetpoint(id, step.celsius)
        break
      case 'power':
        commands.setHeaterPowerLevel(id, step.level)
        break
    }
  }
}
