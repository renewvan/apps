import { liveVan, type LiveVan, type LiveVanInput, type Trust } from '@renewvan/core/van'
import { emptyRenewvanBusState, type RenewvanBusState } from '@/types'

/**
 * What the bus holds, as it really arrives: every record may still be partial, since MQTT builds it
 * up one property per retained message.
 */
export type TestBusState = {
  [K in keyof RenewvanBusState]?: RenewvanBusState[K] extends Record<string, infer V>
    ? Record<string, Partial<V>>
    : never
}

/**
 * The Live van of a bus holding `state` (over an empty one), connected and settled, with Auto as the
 * Primary battery and no relay groups unless `input` says otherwise: what a page under `App` reads.
 * A field of `state` left `undefined` stays empty.
 */
export function testLiveVan(
  state: TestBusState = {},
  input: Partial<Omit<LiveVanInput, 'state'>> = {},
): LiveVan {
  return liveVan({
    state: {
      ...emptyRenewvanBusState,
      ...Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined)),
    } as RenewvanBusState,
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    winterMode: null,
    demoMode: false,
    status: 'connected',
    settled: true,
    ...input,
  })
}

/** A type's trust as `liveVan` builds it, for a test that sets it directly. */
export function testTrust(driverOnline: boolean, demo = false): Trust {
  return { driverOnline, demo, controllable: driverOnline && !demo }
}
