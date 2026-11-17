import { describe, expect, it } from 'vite-plus/test'
import { hasGpsFix, type Gps } from './types'

const fix = (overrides: Partial<Gps> = {}): Gps => ({
  fix_quality: 'gps',
  satellites_in_use: 8,
  ...overrides,
})

describe('hasGpsFix', () => {
  it('accepts a record with finite, in-range coordinates', () => {
    expect(hasGpsFix(fix({ latitude: 52.52, longitude: 13.405 }))).toBe(true)
    expect(hasGpsFix(fix({ latitude: -33.86, longitude: 151.2 }))).toBe(true)
  })

  it('rejects no_fix, missing coordinates, and anything malformed a retained message could carry', () => {
    expect(hasGpsFix(fix({ fix_quality: 'no_fix', latitude: 52.52, longitude: 13.405 }))).toBe(
      false,
    )
    expect(hasGpsFix(fix())).toBe(false)
    expect(hasGpsFix(fix({ latitude: 999, longitude: 13.405 }))).toBe(false)
    expect(hasGpsFix(fix({ latitude: 52.52, longitude: -181 }))).toBe(false)
    expect(hasGpsFix(fix({ latitude: Number.NaN, longitude: 13.405 }))).toBe(false)
    // A malformed payload can land a string where a number belongs.
    expect(hasGpsFix(fix({ latitude: '52.52' as unknown as number, longitude: 13.405 }))).toBe(
      false,
    )
  })
})
