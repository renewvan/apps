import { describe, expect, it } from 'vite-plus/test'
import type { Battery, Tank } from '../types'
import { IDLE_W } from '../power'
import { formatTimeToGo } from '../power/time-to-go'
import { batteryDial, batteryLevel, tankDial } from './dial'

const NOW = new Date('2026-07-14T12:00:00Z')

function tank(overrides: Partial<Tank> = {}): Tank {
  return {
    fluid_type: 'fresh_water',
    capacity_l: 100,
    level_pct: 62,
    status: 'ok',
    volume_since_full_l: 0,
    volume_since_empty_l: 0,
    ...overrides,
  }
}

function battery(overrides: Partial<Battery> = {}): Battery {
  return {
    soc_pct: 78,
    voltage_v: 13.24,
    current_a: -2.6,
    power_w: -34.6,
    temperature_c: 21,
    charge_state: 'float',
    ...overrides,
  }
}

const GREY_ALARM = {
  fluid_type: 'grey_water' as const,
  alarm_direction: 'high' as const,
  alarm_threshold_pct: 90,
  alarm_restore_pct: 80,
}

describe('batteryDial', () => {
  it('has no dial without a Primary battery', () => {
    expect(batteryDial(undefined)).toBeUndefined()
  })

  it('reads the level, voltage and absolute power, whichever way the power flows', () => {
    const charging = batteryDial(battery({ power_w: 120.4 }))
    const discharging = batteryDial(battery({ power_w: -120.4 }))
    expect(charging?.sub).toBe('13.24V / 120W')
    expect(discharging?.sub).toBe('13.24V / 120W')
    expect(charging?.unitsStrong).toBe(true)
  })

  it('is charging only above the idle band, as on the Power page', () => {
    const at = (power_w: number) => batteryDial(battery({ power_w }))?.charging
    expect(at(IDLE_W + 1)).toBe(true)
    expect(at(IDLE_W)).toBe(false)
    expect(at(0)).toBe(false)
    expect(at(-120)).toBe(false)
  })

  it('clamps an out-of-range state of charge into the arc', () => {
    expect(batteryDial(battery({ soc_pct: 104 }))?.pct).toBe(100)
    expect(batteryDial(battery({ soc_pct: -3 }))?.pct).toBe(0)
  })

  it('shows a battery whose source publishes only the core fields', () => {
    // A shunt has no temperature probe and no charge stage, so neither optional property is
    // ever published. Captured from a real SmartShunt via Venus OS.
    const view = batteryDial({ soc_pct: 99.3, voltage_v: 13.44, current_a: 0.6, power_w: 8.06 })
    expect(view?.pct).toBe(99.3)
    expect(view?.sub).toBe('13.44V / 8W')
  })

  it('carries the remaining runtime as the Power page writes it, when the source publishes one', () => {
    const view = batteryDial(battery({ time_to_go_s: 9 * 86_400 + 23 * 3_600 }))
    expect(view?.timeToGo).toBe('9d 23h')
    expect(view?.timeToGo).toBe(formatTimeToGo(9 * 86_400 + 23 * 3_600))
  })

  it('names the battery state with the Power page labels', () => {
    expect(batteryDial(battery({ power_w: 0 }))?.state).toBe('Idle')
    expect(batteryDial(battery({ power_w: 120 }))?.state).toBe('Charging')
    expect(batteryDial(battery({ power_w: -120 }))?.state).toBe('Discharging')
  })

  it('shows the runtime only while discharging, and the state otherwise, never both', () => {
    const published = { time_to_go_s: 3_600 }
    const discharging = batteryDial(battery({ power_w: -120, ...published }))
    expect(discharging?.timeToGo).toBe('1h 0m')
    expect(discharging?.state).toBeUndefined()
    for (const power_w of [0, 120]) {
      const view = batteryDial(battery({ power_w, ...published }))
      expect(view?.timeToGo).toBeUndefined()
      expect(view?.state).toBe(power_w === 0 ? 'Idle' : 'Charging')
    }
  })

  it('has no runtime for a source that does not publish one, rather than a made-up zero', () => {
    expect(batteryDial(battery())?.timeToGo).toBeUndefined()
    // 0 s is a real estimate (empty), distinct from none.
    expect(batteryDial(battery({ time_to_go_s: 0 }))?.timeToGo).toBe('<1m')
  })

  it('reads the battery ok, alert at 40% and below, bad at 20% and below', () => {
    const colorAt = (soc_pct: number) => batteryDial(battery({ soc_pct }))?.tone
    expect(colorAt(100)).toBe('ok')
    expect(colorAt(41)).toBe('ok')
    expect(colorAt(40)).toBe('alert')
    expect(colorAt(21)).toBe('alert')
    expect(colorAt(20)).toBe('bad')
    expect(colorAt(0)).toBe('bad')
  })
})

describe('batteryDial source', () => {
  it('names the source when it publishes a name', () => {
    expect(batteryDial(battery({ name: ' SmartShunt 500A ' }))?.source).toBe('SmartShunt 500A')
    expect(batteryDial(battery())?.source).toBeUndefined()
  })
})

describe('batteryLevel', () => {
  it('is empty at 0, low under 20, medium from 20 to 80 and full above', () => {
    expect(batteryLevel(0)).toBe('empty')
    expect(batteryLevel(0.4)).toBe('empty')
    expect(batteryLevel(1)).toBe('low')
    expect(batteryLevel(19)).toBe('low')
    expect(batteryLevel(20)).toBe('medium')
    expect(batteryLevel(80)).toBe('medium')
    expect(batteryLevel(81)).toBe('full')
    expect(batteryLevel(100)).toBe('full')
  })
})

describe('tankDial', () => {
  it('shows litres from the raw level against the capacity', () => {
    const view = tankDial(tank({ capacity_l: 80, level_pct: 41 }), NOW)
    expect(view.pct).toBe(41)
    expect(view.sub).toBe('33 / 80 \u2113')
    expect(view.unitsStrong).toBe(true)
  })

  it('reads a grey tank ok, alert in the caution band and bad in the danger zone', () => {
    const colorAt = (level_pct: number) => tankDial(tank({ ...GREY_ALARM, level_pct }), NOW).tone
    expect(colorAt(60)).toBe('ok')
    expect(colorAt(80)).toBe('ok')
    expect(colorAt(85)).toBe('alert')
    expect(colorAt(90)).toBe('bad')
    expect(colorAt(95)).toBe('bad')
  })

  it('reads the wrong extreme bad even with no alarm configured, and the good one ok', () => {
    const colorOf = (fluid_type: Tank['fluid_type'], level_pct: number) =>
      tankDial(tank({ fluid_type, level_pct }), NOW).tone
    // Running out of fresh water, fuel or LPG is the wrong side; being full is fine.
    expect(colorOf('fresh_water', 0)).toBe('bad')
    expect(colorOf('fuel', 0)).toBe('bad')
    expect(colorOf('lpg', 0)).toBe('bad')
    expect(colorOf('fresh_water', 100)).toBe('ok')
    // A full waste tank is the wrong side; an empty one is fine.
    expect(colorOf('grey_water', 100)).toBe('bad')
    expect(colorOf('black_water', 100)).toBe('bad')
    expect(colorOf('grey_water', 0)).toBe('ok')
    expect(colorOf('fresh_water', 50)).toBe('ok')
  })

  it('shows an empty, bad-toned dial with the fault reason instead of a level', () => {
    const view = tankDial(tank({ status: 'open_circuit', level_pct: 62 }), NOW)
    expect(view.faulted).toBe(true)
    expect(view.pct).toBe(0)
    expect(view.tone).toBe('bad')
    expect(view.sub).toBe('Open circuit')
    expect(view.unitsStrong).toBe(false)
  })
})
