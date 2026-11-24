import { describe, expect, it } from 'vite-plus/test'
import { batteryTimeToGoS, formatTimeToGo } from './time-to-go'

const base = { soc_pct: 50, current_a: -10 }

describe('batteryTimeToGoS', () => {
  it('prefers the source estimate', () => {
    expect(batteryTimeToGoS({ ...base, time_to_go_s: 123 })).toBe(123)
  })
  it('falls back to remaining_ah over the discharge current', () => {
    expect(batteryTimeToGoS({ ...base, remaining_ah: 100 })).toBe(36_000)
  })
  it('falls back to capacity × SoC when there is no fuel gauge', () => {
    expect(batteryTimeToGoS({ ...base, capacity_ah: 200 })).toBe(36_000)
  })
  it('has no estimate while charging, idle or without capacity', () => {
    expect(batteryTimeToGoS({ ...base, current_a: 5, remaining_ah: 100 })).toBeUndefined()
    expect(batteryTimeToGoS({ ...base, current_a: -0.05, remaining_ah: 100 })).toBeUndefined()
    expect(batteryTimeToGoS(base)).toBeUndefined()
    // Capacity without SoC computes NaN — not a runtime. MQTT builds partial records, so soc_pct
    // can be missing at runtime even though the type says number.
    expect(
      batteryTimeToGoS({
        current_a: -10,
        capacity_ah: 100,
        soc_pct: undefined as unknown as number,
      }),
    ).toBeUndefined()
  })
})

describe('formatTimeToGo', () => {
  it('shows the two largest units, truncating rather than rounding up', () => {
    expect(formatTimeToGo(9 * 86_400 + 23 * 3_600 + 59 * 60 + 59)).toBe('9d 23h')
    expect(formatTimeToGo(5 * 3_600 + 12 * 60 + 59)).toBe('5h 12m')
    expect(formatTimeToGo(42 * 60)).toBe('42m')
  })

  it('drops the smaller unit only at a boundary, not when it is zero', () => {
    expect(formatTimeToGo(86_400)).toBe('1d 0h')
    expect(formatTimeToGo(3_600)).toBe('1h 0m')
  })

  it('reads under a minute as <1m', () => {
    expect(formatTimeToGo(0)).toBe('<1m')
    expect(formatTimeToGo(59)).toBe('<1m')
  })

  it("shows Venus's ten-day cap as 9d 23h, like the Venus screen", () => {
    expect(formatTimeToGo(863_999.9375)).toBe('9d 23h')
  })
})
