import type { Battery } from '@/types'
import { liveVan } from '@renewvan/core/van'
import { emptyRenewvanBusState } from '@/types'
import { batterySourceName } from './sourceName'

/** The source name of a bus holding `batteries`, the Primary battery on Auto. */
const nameOf = (batteries: Record<string, Partial<Battery>>) =>
  batterySourceName(
    liveVan({
      state: { ...emptyRenewvanBusState, batteries: batteries as Record<string, Battery> },
      status: 'connected',
      settled: true,
      primaryBattery: null,
      relayGroups: {},
      relayGroupList: null,
      relayOrder: [],
      winterMode: null,
      demoMode: false,
    }),
  )

const battery = (o: Partial<Battery> = {}) => ({
  soc_pct: 80,
  voltage_v: 13.2,
  current_a: 1,
  power_w: 10,
  ...o,
})

describe('batterySourceName', () => {
  it('is the published name, trimmed', () => {
    expect(nameOf({ a: battery({ name: ' SmartShunt 500A ' }) })).toBe('SmartShunt 500A')
  })

  it('falls back to the id only when there are several batteries', () => {
    expect(nameOf({ a: battery() })).toBeUndefined()
    expect(nameOf({ a: battery(), b: battery() })).toBe('a')
  })

  it('has nothing without a complete battery', () => {
    expect(nameOf({})).toBeUndefined()
    expect(nameOf({ a: { soc_pct: 50 } })).toBeUndefined()
  })
})
