import { describe, expect, it } from 'vite-plus/test'
import type { Battery } from '@/types'
import { testLiveVan } from '@/test/liveVan'
import { batterySourceLabel } from './batterySourceLabel'

const battery = (o: Partial<Battery> = {}): Battery => ({
  soc_pct: 80,
  voltage_v: 13.2,
  current_a: 1,
  power_w: 10,
  ...o,
})

/** The label of a bus holding `batteries`, with the Drivers keyed in `drivers`. */
const labelOf = (batteries: Record<string, Partial<Battery>>, drivers: string[] = []) =>
  batterySourceLabel(
    testLiveVan({
      batteries,
      drivers: Object.fromEntries(
        drivers.map((key) => [
          key,
          {
            info: {
              driver: key,
              product: key,
              source: 'test',
              version: 'v1',
              publishes: ['battery'],
            },
          },
        ]),
      ),
    }),
  )

describe('batterySourceLabel', () => {
  it('is the battery name when it has one', () => {
    expect(labelOf({ a: battery({ name: 'SmartShunt 500A' }) })).toBe('SmartShunt 500A')
  })

  it('is nothing for a single unnamed battery', () => {
    expect(labelOf({ a: battery() })).toBeUndefined()
  })

  it('names the read battery by its owner and id when there are several', () => {
    expect(labelOf({ a: battery({ driver: 'wattcycle' }), b: battery() }, ['wattcycle'])).toBe(
      'Wattcycle · a',
    )
  })

  it('is nothing without a complete battery', () => {
    expect(labelOf({})).toBeUndefined()
  })
})
