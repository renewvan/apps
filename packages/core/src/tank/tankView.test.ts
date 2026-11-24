import { describe, expect, it } from 'vite-plus/test'
import type { Tank } from '../types'
import { tankView } from './tankView'

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

const NOW = new Date('2026-07-14T12:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

const LOW_ALARM = {
  alarm_direction: 'low' as const,
  alarm_threshold_pct: 27,
  alarm_restore_pct: 48,
}

describe('tankView', () => {
  it('clamps the level into 0..100 and derives the litres from the clamped level', () => {
    expect(tankView(tank({ level_pct: 140 }), NOW).pct).toBe(100)
    expect(tankView(tank({ level_pct: -5 }), NOW).pct).toBe(0)
    expect(tankView(tank({ level_pct: 62, capacity_l: 80 }), NOW).litres).toBe(50)
    // An out-of-range sensor reading can never show more litres than the tank holds.
    expect(tankView(tank({ level_pct: 140 }), NOW).litres).toBe(100)
    expect(tankView(tank({ level_pct: -5 }), NOW).litres).toBe(0)
  })

  it('shows a plain Normal badge and no Status row for a tank with no alarm configured', () => {
    const view = tankView(tank(), NOW)
    expect(view.badge).toEqual({ label: 'Normal', severity: 'accent' })
    expect(view.status).toBeUndefined()
  })

  it('shows the same word and severity in the badge and the Status row', () => {
    const view = tankView(tank({ ...LOW_ALARM, level_pct: 100 }), NOW)
    expect(view.badge).toEqual({ label: 'Full', severity: 'success' })
    expect(view.status).toEqual(view.badge)
  })

  it('words the Status by alarm direction and zone', () => {
    expect(tankView(tank({ ...LOW_ALARM, level_pct: 15 }), NOW).status).toEqual({
      label: 'Low',
      severity: 'danger',
    })
    expect(tankView(tank({ ...LOW_ALARM, level_pct: 35 }), NOW).status).toEqual({
      label: 'Low',
      severity: 'warning',
    })
  })

  it('shows a danger-severity Fault badge and the fault reason in the Status row, with an empty gauge', () => {
    const view = tankView(tank({ status: 'open_circuit', level_pct: 95 }), NOW)
    expect(view.badge).toEqual({ label: 'Fault', severity: 'danger' })
    expect(view.status).toEqual({ label: 'Open circuit', severity: 'danger' })
    expect(view.pct).toBe(0)
    expect(view.faulted).toBe(true)
    expect(tankView(tank({ status: 'short_circuit' }), NOW).status?.label).toBe('Short circuit')
  })

  it('keeps a committed alarm danger past the restore level, with no zone to contradict it', () => {
    const view = tankView(tank({ alarm_state: 'alarm', level_pct: 62 }), NOW)
    expect(view.severity).toBe('danger')
  })

  it('uses one fill severity for the gauge: accent normally, danger/warning in the zones', () => {
    expect(tankView(tank(), NOW).severity).toBe('accent')
    expect(tankView(tank({ ...LOW_ALARM, level_pct: 35 }), NOW).severity).toBe('warning')
    expect(tankView(tank({ ...LOW_ALARM, level_pct: 20 }), NOW).severity).toBe('danger')
  })

  it('shows Temperature with a dash when the tank has no sensor, not 0', () => {
    expect(tankView(tank(), NOW).temperature).toBe('--')
    expect(tankView(tank({ temperature_c: 18.4 }), NOW).temperature).toBe('18°C')
  })

  it('reads fresh water as Drain Rate since the last refill', () => {
    const view = tankView(
      tank({ volume_since_full_l: 20, volume_since_empty_l: 999, last_full_at: hoursAgo(10) }),
      NOW,
    )
    expect(view.rateLabel).toBe('Drain Rate')
    expect(view.rate).toBe('2.0 L/h')
  })

  it('reads every other tank as Fill Rate since the last empty-out', () => {
    const view = tankView(
      tank({
        fluid_type: 'grey_water',
        volume_since_full_l: 999,
        volume_since_empty_l: 15,
        last_empty_at: hoursAgo(5),
      }),
      NOW,
    )
    expect(view.rateLabel).toBe('Fill Rate')
    expect(view.rate).toBe('3.0 L/h')
  })

  it('shows a dash for the rate before any latch, and for the first minute after one', () => {
    expect(tankView(tank(), NOW).rate).toBe('--')
    const fresh = new Date(NOW.getTime() - 30_000).toISOString()
    expect(tankView(tank({ volume_since_full_l: 3, last_full_at: fresh }), NOW).rate).toBe('--')
  })

  describe('a Stepped level (tank read by Level probes, hub ADR 0033)', () => {
    const probes = (level_pct: number, marks = [33, 66, 100]) =>
      tank({ capacity_l: 70, level_pct, level_marks_pct: marks })

    it('reads a continuous level as plain numbers with quartile gridlines', () => {
      const view = tankView(tank({ level_pct: 62 }), NOW)
      expect(view.stepped).toBe(false)
      expect(view.levelLabel).toBe('62%')
      expect(view.litresLabel).toBe('62/100 \u2113')
      expect(view.gridlines).toEqual([25, 50, 75])
    })

    it('reads a wet mark as a lower bound', () => {
      const view = tankView(probes(66), NOW)
      expect(view.stepped).toBe(true)
      expect(view.levelLabel).toBe('\u2265 66%')
      expect(view.litresLabel).toBe('\u2265 46/70 \u2113')
    })

    it('reads all probes dry as below the lowest mark, not as empty', () => {
      const view = tankView(probes(0), NOW)
      expect(view.levelLabel).toBe('< 33%')
      expect(view.litresLabel).toBe('< 23/70 \u2113')
      expect(tankView(probes(0, [100]), NOW).levelLabel).toBe('< 100%')
    })

    it('reads the top mark at 100 as exactly full', () => {
      expect(tankView(probes(100), NOW).levelLabel).toBe('100%')
    })

    it('draws gridlines at the marks below the top', () => {
      expect(tankView(probes(66), NOW).gridlines).toEqual([33, 66])
      expect(tankView(probes(0, [100]), NOW).gridlines).toEqual([])
    })

    it('shows no rate: steps between marks are not a measured volume', () => {
      const view = tankView(
        tank({ level_pct: 66, level_marks_pct: [33, 66, 100], last_full_at: hoursAgo(10) }),
        NOW,
      )
      expect(view.rate).toBe('--')
    })
  })
})
