import { createContext, useContext } from 'react'
import { useContentStable, useShallowStable } from './useStable'
import type { RenewvanBus } from './useRenewvanBus'
import type { RenewvanBusState } from '@/types'

/**
 * The records as the bus accumulates them, one property per retained message: any may still be
 * partial (the Live van is what keeps only complete ones).
 */
export type RawRecords = {
  [K in keyof RenewvanBusState]: RenewvanBusState[K] extends Record<string, infer V>
    ? Record<string, Partial<V>>
    : never
}

/** What the bus holds, as retained: every record and bus-level field, without the send side. */
export interface RawBus extends Omit<RenewvanBus, 'publish' | 'commands' | 'state'> {
  state: RawRecords
}

/**
 * The raw bus records `App` holds, for the few views that show them as they are: Settings › Devices
 * (its Drivers, instances and diagnostics) and the connection details. Every other screen reads the
 * Live van (`useLiveVan`), and sends through `useCommands`.
 */
export const RawBusContext = createContext<RawBus | undefined>(undefined)

/** The raw bus `App` provides. Throws outside its provider. */
export function useRawBus(): RawBus {
  const bus = useContext(RawBusContext)
  if (bus === undefined) throw new Error('useRawBus needs a RawBusContext provider (App)')
  return bus
}

/**
 * `bus` as the context value: the same reference until a field changes, its records kept by their
 * own references, and the GPS record (a fresh object every poll, every satellite's signal) kept by
 * its content, so a reader re-renders only when something it may show has changed.
 */
export function useRawBusValue({
  publish: _publish,
  commands: _commands,
  ...bus
}: RenewvanBus): RawBus {
  const gps = useContentStable(bus.state.gps)
  const state = useShallowStable({ ...bus.state, gps })
  return useShallowStable({ ...bus, state })
}
