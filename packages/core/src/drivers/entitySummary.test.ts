import { describe, expect, it } from 'vite-plus/test'
import {
  batterySummary,
  chargerSummary,
  figureText,
  relaySummary,
  solarSummary,
  tankRowSummary,
} from './entitySummary'

describe('entity row summaries', () => {
  it('summarises a battery as charge, voltage and current, leaving out what it did not publish', () => {
    expect(batterySummary({ soc_pct: 80.4, voltage_v: 13.2, current_a: -2.64 })).toEqual([
      { value: '80', unit: '%' },
      { value: '13.20', unit: 'V' },
      { value: '-2.6', unit: 'A' },
    ])
    expect(batterySummary({ voltage_v: 12.5 })).toEqual([{ value: '12.50', unit: 'V' }])
    expect(batterySummary({})).toEqual([])
  })

  it('summarises a solar controller as its power', () => {
    expect(solarSummary({ power_w: 212.6 })).toEqual([{ value: '213', unit: 'W' }])
    expect(solarSummary({})).toEqual([])
  })

  it('derives a charger output power when it publishes none, and only with a voltage', () => {
    expect(chargerSummary({ voltage_v: 14, current_a: 10 })).toEqual([
      { value: '14.00', unit: 'V' },
      { value: '10.0', unit: 'A' },
      { value: '140', unit: 'W' },
    ])
    expect(chargerSummary({ current_a: 10 })).toEqual([{ value: '10.0', unit: 'A' }])
  })

  it('says On or Off for a relay, nothing while its state is unknown', () => {
    expect(relaySummary({ state: true } as never)).toEqual([{ value: 'On' }])
    expect(relaySummary({ state: false } as never)).toEqual([{ value: 'Off' }])
    expect(relaySummary({} as never)).toEqual([])
  })

  it('summarises a tank as its level and capacity', () => {
    expect(tankRowSummary({ level_pct: 41, capacity_l: 80 })).toEqual([
      { value: '41', unit: '%' },
      { value: '80', unit: 'ℓ' },
    ])
  })

  it('writes a figure as one string for a client that does not style units apart', () => {
    expect(figureText({ value: '13.20', unit: 'V' })).toBe('13.20 V')
    expect(figureText({ value: 'On' })).toBe('On')
  })
})
