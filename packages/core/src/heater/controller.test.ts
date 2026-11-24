import { describe, expect, it, vi } from 'vite-plus/test'
import {
  decide,
  heaterView,
  INITIAL_CONTROL,
  observeHeater,
  perform,
  resumeAfterStop,
  type HeaterControl,
  type HeaterDecision,
  type HeaterIntent,
  type HeaterStep,
} from './controller'
import { giveUp } from '../pending'
import type { Heater } from '../types'

const RUNNING: Heater = {
  name: 'Cabin heater',
  phase: 'running',
  status_code: '3.0',
  error_code: 0,
  internal_temperature_c: 19.4,
  mode: 'heater_temperature',
  setpoint_c: 21,
  power_level: 4,
  commands_enabled: true,
}
const OFF: Heater = { ...RUNNING, phase: 'off', status_code: '0.1' }

/** What a card gets for `intent`: the steps it would send, or the kind of decision it got instead. */
function steps(
  heater: Heater,
  intent: HeaterIntent,
  control: HeaterControl = INITIAL_CONTROL,
  frozen = false,
): HeaterStep[] | HeaterDecision['kind'] {
  const decision = decide(control, heater, frozen, intent)
  return decision.kind === 'send' ? decision.steps : decision.kind
}

describe('heaterView: what a card may offer', () => {
  it('reads Unknown, with the controls off, when the Driver is down or the live fields are cleared', () => {
    const frozen = heaterView(INITIAL_CONTROL, RUNNING, true)
    expect(frozen.reporting).toBe(false)
    expect(frozen.controls).toBe(false)
    expect(frozen.info).toBeUndefined()
    const cleared = heaterView(INITIAL_CONTROL, { commands_enabled: true }, false)
    expect(cleared.reporting).toBe(false)
    expect(cleared.info).toBe('No recent reading from the heater.')
  })

  it('is read-only while the Driver has commands off, and says so ahead of the mode text', () => {
    const view = heaterView(INITIAL_CONTROL, { ...OFF, commands_enabled: false }, false)
    expect(view.controls).toBe(false)
    expect(view.startDisabled).toBe(true)
    expect(view.settingsOk).toBe(false)
    expect(view.info).toBe('Read-only! - Commands are turned off.')
  })

  it('offers Start from off without a fault, and Stop whenever the heater is doing anything', () => {
    const off = heaterView(INITIAL_CONTROL, OFF, false)
    expect([off.offersStop, off.startDisabled]).toEqual([false, false])
    expect(heaterView(INITIAL_CONTROL, { ...OFF, error_code: 7 }, false)).toMatchObject({
      startDisabled: true,
      faultBlocksStart: true,
    })
    const standby = heaterView(INITIAL_CONTROL, { ...RUNNING, phase: 'standby' }, false)
    expect([standby.offersStop, standby.stopDisabled, standby.settingsOk]).toEqual([
      true,
      false,
      true,
    ])
  })

  it('refuses settings while shutting down or ventilating, and modes while shutting down', () => {
    const down = heaterView(INITIAL_CONTROL, { ...RUNNING, phase: 'shutting_down' }, false)
    expect([down.settingsOk, down.modesOk]).toEqual([false, false])
    const fan = heaterView(INITIAL_CONTROL, { ...RUNNING, ventilating: true }, false)
    // Modes stay askable while ventilating: the card then offers to stop first.
    expect([fan.settingsOk, fan.modesOk, fan.mode]).toEqual([false, true, 'ventilation'])
  })

  it('shows Thermostat for a temperature mode with thermostat on, and Standby keeps settings open', () => {
    expect(heaterView(INITIAL_CONTROL, { ...RUNNING, thermostat: true }, false).mode).toBe(
      'thermostat',
    )
  })

  it('is warm while the flame is on or coming up, never in Ventilation', () => {
    expect(heaterView(INITIAL_CONTROL, RUNNING, false).heating).toBe(true)
    expect(heaterView(INITIAL_CONTROL, { ...RUNNING, phase: 'starting' }, false).heating).toBe(true)
    expect(heaterView(INITIAL_CONTROL, { ...RUNNING, phase: 'standby' }, false).heating).toBe(false)
    expect(heaterView(INITIAL_CONTROL, { ...RUNNING, ventilating: true }, false).heating).toBe(
      false,
    )
  })

  it('dials the power level in Power and Ventilation, the target otherwise', () => {
    expect(heaterView(INITIAL_CONTROL, RUNNING, false)).toMatchObject({
      byPower: false,
      dialValue: 21,
    })
    expect(heaterView(INITIAL_CONTROL, { ...RUNNING, mode: 'power' }, false)).toMatchObject({
      byPower: true,
      dialValue: 4,
    })
  })
})

describe('decide: what a tap sends', () => {
  it('starts a heater with `set` true, and a chosen Ventilation with its own command', () => {
    expect(steps(OFF, { kind: 'start' })).toEqual([{ command: 'run', on: true }])
    const chosen = { ...INITIAL_CONTROL, ventilationChosen: true }
    expect(steps(OFF, { kind: 'start' }, chosen)).toEqual([{ command: 'ventilate', on: true }])
  })

  it('refuses a start when the heater is not off, has a fault, or its controls are off', () => {
    expect(steps(RUNNING, { kind: 'start' })).toBe('ignore')
    expect(steps({ ...OFF, error_code: 3 }, { kind: 'start' })).toBe('ignore')
    expect(steps({ ...OFF, commands_enabled: false }, { kind: 'start' })).toBe('ignore')
    expect(steps(OFF, { kind: 'start' }, INITIAL_CONTROL, true)).toBe('ignore')
  })

  it('stops with one command, whatever the phase', () => {
    for (const phase of [
      'starting',
      'warming_up',
      'running',
      'standby',
      'shutting_down',
    ] as const) {
      expect(steps({ ...RUNNING, phase }, { kind: 'stop' })).toEqual([
        { command: 'run', on: false },
      ])
    }
  })

  it('sends nothing at all while Demo mode or a down Driver freezes the card', () => {
    for (const intent of [
      { kind: 'stop' },
      { kind: 'setpoint', celsius: 20 },
      { kind: 'power', level: 3 },
      { kind: 'mode', mode: 'power' },
    ] as const) {
      expect(steps(RUNNING, intent, INITIAL_CONTROL, true)).toBe('ignore')
    }
  })

  it('sends the target, and tracks it until the heater reads it back', () => {
    const decision = decide(INITIAL_CONTROL, RUNNING, false, { kind: 'setpoint', celsius: 22 })
    expect(decision).toMatchObject({ kind: 'send', field: 'setpoint', to: 22 })
    if (decision.kind !== 'send') throw new Error('expected a send')
    const view = (heater: Heater) => heaterView(decision.control, heater, false)
    // The dial shows the target it was sent while the heater catches up...
    expect(view(RUNNING)).toMatchObject({ dialBusy: true, dialValue: 22 })
    // ...and the real value once it answers.
    expect(view({ ...RUNNING, setpoint_c: 22 })).toMatchObject({ dialBusy: false, dialValue: 22 })
  })

  it('refuses settings while shutting down, and a second command on a pending run', () => {
    expect(steps({ ...RUNNING, phase: 'shutting_down' }, { kind: 'setpoint', celsius: 20 })).toBe(
      'ignore',
    )
    const sent = decide(INITIAL_CONTROL, OFF, false, { kind: 'start' })
    if (sent.kind !== 'send') throw new Error('expected a send')
    expect(steps(OFF, { kind: 'start' }, sent.control)).toBe('ignore')
    expect(steps(OFF, { kind: 'stop' }, sent.control)).toBe('ignore')
  })

  it('offers Start or Stop again once a run command has failed', () => {
    const sent = decide(INITIAL_CONTROL, OFF, false, { kind: 'start' })
    if (sent.kind !== 'send') throw new Error('expected a send')
    const failed = {
      ...sent.control,
      pendings: giveUp(sent.control.pendings, 'run', 'off').pendings,
    }
    expect(heaterView(failed, OFF, false)).toMatchObject({ runFailed: true, startDisabled: false })
  })
})

describe('decide: switching modes', () => {
  it('goes to Power with the mode command, and turns Thermostat off on the way', () => {
    expect(steps(RUNNING, { kind: 'mode', mode: 'power' })).toEqual([
      { command: 'mode', mode: 'power' },
    ])
    expect(steps({ ...RUNNING, thermostat: true }, { kind: 'mode', mode: 'power' })).toEqual([
      { command: 'mode', mode: 'power' },
      { command: 'thermostat', on: false },
    ])
  })

  it('turns Thermostat on from Temperature without touching the sensor, and off again', () => {
    const temperature = { ...RUNNING, thermostat: false }
    expect(steps(temperature, { kind: 'mode', mode: 'thermostat' })).toEqual([
      { command: 'thermostat', on: true },
    ])
    expect(steps({ ...RUNNING, thermostat: true }, { kind: 'mode', mode: 'temperature' })).toEqual([
      { command: 'thermostat', on: false },
    ])
  })

  it('goes from Power to a temperature mode on the sensor it was last using', () => {
    const control = observeHeater(
      INITIAL_CONTROL,
      { ...RUNNING, mode: 'external_temperature' },
      false,
    )
    const power = { ...RUNNING, mode: 'power' as const }
    expect(steps(power, { kind: 'mode', mode: 'temperature' }, control)).toEqual([
      { command: 'mode', mode: 'external_temperature' },
    ])
    expect(steps(power, { kind: 'mode', mode: 'thermostat' })).toEqual([
      { command: 'mode', mode: 'heater_temperature' },
      { command: 'thermostat', on: true },
    ])
  })

  it('treats a heater with no mode yet as coming from Power', () => {
    expect(steps({ ...OFF, mode: undefined }, { kind: 'mode', mode: 'temperature' })).toEqual([
      { command: 'mode', mode: 'heater_temperature' },
    ])
  })

  it('tracks a mode switch by the mode/thermostat pair, so a Thermostat switch is answered by `thermostat`', () => {
    const heater = { ...RUNNING, thermostat: false }
    const decision = decide(INITIAL_CONTROL, heater, false, { kind: 'mode', mode: 'thermostat' })
    if (decision.kind !== 'send') throw new Error('expected a send')
    expect(heaterView(decision.control, heater, false).modesDisabled).toBe(true)
    const answered = { ...heater, thermostat: true }
    expect(observeHeater(decision.control, answered, false).pendings).toEqual({})
  })

  it('does nothing for the mode already shown, and lets a failed switch be retried', () => {
    expect(steps(RUNNING, { kind: 'mode', mode: 'temperature' })).toBe('ignore')
    const decision = decide(INITIAL_CONTROL, RUNNING, false, { kind: 'mode', mode: 'power' })
    if (decision.kind !== 'send') throw new Error('expected a send')
    const failed = {
      ...decision.control,
      pendings: giveUp(decision.control.pendings, 'mode', 'heater_temperature/undefined').pendings,
    }
    expect(heaterView(failed, RUNNING, false).modesDisabled).toBe(false)
  })

  it('chooses Ventilation from off without sending anything; Start then runs it', () => {
    const chosen = decide(INITIAL_CONTROL, OFF, false, { kind: 'mode', mode: 'ventilation' })
    expect(chosen).toMatchObject({ kind: 'update', control: { ventilationChosen: true } })
    if (chosen.kind !== 'update') throw new Error('expected an update')
    expect(heaterView(chosen.control, OFF, false)).toMatchObject({
      armed: true,
      mode: 'ventilation',
    })
    const started = decide(chosen.control, OFF, false, { kind: 'start' })
    expect(started).toMatchObject({ kind: 'send', steps: [{ command: 'ventilate', on: true }] })
    // Nothing but the ventilate command: no run, no mode.
    if (started.kind === 'send') expect(started.control.ventilationChosen).toBe(false)
  })

  it('forgets the Ventilation choice once the heater has left off', () => {
    const chosen = { ...INITIAL_CONTROL, ventilationChosen: true }
    expect(observeHeater(chosen, OFF, false).ventilationChosen).toBe(true)
    const after = observeHeater(chosen, RUNNING, false)
    expect(after.ventilationChosen).toBe(false)
    // So a later Start heats.
    expect(steps(OFF, { kind: 'start' }, after)).toEqual([{ command: 'run', on: true }])
  })

  it('switching away from a chosen Ventilation spends the choice', () => {
    const chosen = { ...INITIAL_CONTROL, ventilationChosen: true }
    const decision = decide(chosen, OFF, false, { kind: 'mode', mode: 'power' })
    expect(decision).toMatchObject({ kind: 'send', control: { ventilationChosen: false } })
  })

  it('asks to stop first when the mode cannot be reached while the heater runs, naming why', () => {
    const fan = { ...RUNNING, ventilating: true }
    expect(
      decide(INITIAL_CONTROL, fan, false, { kind: 'mode', mode: 'temperature' }),
    ).toMatchObject({
      kind: 'askStop',
      to: 'temperature',
      reason: expect.stringMatching(/ventilation mode/),
    })
    expect(
      decide(INITIAL_CONTROL, RUNNING, false, { kind: 'mode', mode: 'ventilation' }),
    ).toMatchObject({
      kind: 'askStop',
      to: 'ventilation',
      reason: expect.stringMatching(/heating mode/),
    })
  })

  it('switches between heating modes while running without asking, and into Ventilation once off', () => {
    expect(steps(RUNNING, { kind: 'mode', mode: 'power' })).not.toBe('askStop')
    expect(steps({ ...OFF, ventilating: false }, { kind: 'mode', mode: 'ventilation' })).toBe(
      'update',
    )
  })
})

describe('stop first, then switch', () => {
  const fan = { ...RUNNING, ventilating: true }

  function stopped() {
    const decision = decide(INITIAL_CONTROL, fan, false, {
      kind: 'stopThenMode',
      then: 'temperature',
    })
    if (decision.kind !== 'send') throw new Error('expected a send')
    return decision
  }

  it('sends the stop and remembers the mode it was for', () => {
    expect(stopped().steps).toEqual([{ command: 'run', on: false }])
    expect(stopped().control.afterStop).toBe('temperature')
  })

  it('waits while the heater is still stopping, then reaches the mode once it is off', () => {
    const { control } = stopped()
    expect(resumeAfterStop(control, { ...fan, phase: 'shutting_down' }, false)).toBeUndefined()
    const off = { ...OFF, ventilating: false, mode: 'power' as const }
    const resumed = resumeAfterStop(observeHeater(control, off, false), off, false)
    expect(resumed?.control.afterStop).toBeNull()
    expect(resumed?.decision).toMatchObject({
      kind: 'send',
      field: 'mode',
      steps: [{ command: 'mode', mode: 'heater_temperature' }],
    })
  })

  it('reaches Ventilation by choosing it, sending nothing', () => {
    const decision = decide(INITIAL_CONTROL, RUNNING, false, {
      kind: 'stopThenMode',
      then: 'ventilation',
    })
    if (decision.kind !== 'send') throw new Error('expected a send')
    const resumed = resumeAfterStop(decision.control, OFF, false)
    expect(resumed?.decision).toMatchObject({
      kind: 'update',
      control: { ventilationChosen: true },
    })
  })

  it('drops the switch when the stop failed: the heater still runs, and must not change mode on its own', () => {
    const { control } = stopped()
    const failed = { ...control, pendings: giveUp(control.pendings, 'run', 'running').pendings }
    expect(resumeAfterStop(failed, fan, false)).toEqual({
      control: { ...failed, afterStop: null },
      decision: { kind: 'ignore' },
    })
  })

  it('has nothing to resume without a pending switch', () => {
    expect(resumeAfterStop(INITIAL_CONTROL, OFF, false)).toBeUndefined()
  })
})

describe('observeHeater', () => {
  it('ends every command in flight when the card goes inert, and is the same object when nothing changed', () => {
    const sent = decide(INITIAL_CONTROL, RUNNING, false, { kind: 'setpoint', celsius: 22 })
    if (sent.kind !== 'send') throw new Error('expected a send')
    expect(observeHeater(sent.control, RUNNING, true).pendings).toEqual({})
    expect(observeHeater(sent.control, RUNNING, false)).toBe(sent.control)
  })

  it('stays settled when the read-back leaves the pre-command value and later returns to it', () => {
    const sent = decide(INITIAL_CONTROL, RUNNING, false, { kind: 'setpoint', celsius: 22 })
    if (sent.kind !== 'send') throw new Error('expected a send')
    const answered = observeHeater(sent.control, { ...RUNNING, setpoint_c: 22 }, false)
    const back = observeHeater(answered, RUNNING, false)
    expect(heaterView(back, RUNNING, false)).toMatchObject({ dialBusy: false, dialValue: 21 })
    expect(giveUp(back.pendings, 'setpoint', 21).failed).toBe(false)
  })
})

describe('perform', () => {
  it('sends a plan to the heater in order', () => {
    const calls: string[] = []
    const commands = {
      setHeaterRunning: vi.fn((id: string, on: boolean) => calls.push(`run ${id} ${on}`)),
      setHeaterMode: vi.fn((id: string, mode: string) => calls.push(`mode ${id} ${mode}`)),
      setHeaterVentilating: vi.fn(),
      setHeaterThermostat: vi.fn((id: string, on: boolean) => calls.push(`thermostat ${id} ${on}`)),
      setHeaterSetpoint: vi.fn((id: string, c: number) => calls.push(`setpoint ${id} ${c}`)),
      setHeaterPowerLevel: vi.fn(),
      setHeaterCommandsEnabled: vi.fn(),
    }
    perform(commands, 'cabin', [
      { command: 'mode', mode: 'heater_temperature' },
      { command: 'thermostat', on: true },
      { command: 'setpoint', celsius: 20 },
      { command: 'run', on: false },
    ])
    expect(calls).toEqual([
      'mode cabin heater_temperature',
      'thermostat cabin true',
      'setpoint cabin 20',
      'run cabin false',
    ])
  })
})
