import { describe, expect, it } from 'vite-plus/test'
import type { Battery } from '@/types'
import { batterySourceLabel } from './batterySourceLabel'

const battery = (o: Partial<Battery> = {}): Battery => ({
  soc_pct: 80,
  voltage_v: 13.2,
  current_a: 1,
  power_w: 10,
  ...o,
})

describe('batterySourceLabel', () => {
  it('is the battery name when it has one', () => {
    expect(batterySourceLabel({ a: battery({ name: 'SmartShunt 500A' }) }, 'auto')).toBe(
      'SmartShunt 500A',
    )
  })

  it('is nothing for a single unnamed battery', () => {
    expect(batterySourceLabel({ a: battery() }, 'auto')).toBeUndefined()
  })

  it('names the read battery by its owner and id when there are several', () => {
    const drivers = [{ key: 'w', name: 'WattCycle' }]
    expect(batterySourceLabel({ a: battery({ driver: 'w' }), b: battery() }, 'auto', drivers)).toBe(
      'WattCycle · a',
    )
  })

  it('is nothing without a complete battery', () => {
    expect(batterySourceLabel({}, 'auto')).toBeUndefined()
  })
})
