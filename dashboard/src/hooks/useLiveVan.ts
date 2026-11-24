import { createContext, useContext, useState } from 'react'
import { liveVan, type LiveVan } from '@renewvan/core/van'
import type { RenewvanBus } from './useRenewvanBus'

/**
 * The Live van (`@renewvan/core/van`) for every page under `App`: the van as the dashboard shows it,
 * drawn from the bus in one place. A page reads it with `useLiveVan`, never the raw retained records
 * (Settings › Devices and its diagnostics excepted).
 */
export const LiveVanContext = createContext<LiveVan | undefined>(undefined)

/** The Live van `App` provides. Throws outside its provider: a page never draws a van of its own. */
export function useLiveVan(): LiveVan {
  const van = useContext(LiveVanContext)
  if (van === undefined) throw new Error('useLiveVan needs a LiveVanContext provider (App)')
  return van
}

/**
 * The Live van of `bus`, built again only when one of its inputs changes, and keeping the reference
 * of every part (and of the whole) whose content did not, so a page redraws only for what it shows.
 *
 * The dashboard has no settle timer of its own: the retained burst counts as arrived once the bus is
 * connected (`settled`), which only the capabilities read, and no dashboard page draws them yet.
 */
export function useLiveVanOf(
  bus: Pick<
    RenewvanBus,
    | 'state'
    | 'status'
    | 'primaryBattery'
    | 'relayGroups'
    | 'relayGroupList'
    | 'relayOrder'
    | 'demoMode'
    | 'winterMode'
  >,
): LiveVan {
  const { state, status, primaryBattery, relayGroups, relayGroupList, relayOrder, demoMode } = bus
  const { winterMode } = bus
  const inputs = [
    state,
    status,
    primaryBattery,
    relayGroups,
    relayGroupList,
    relayOrder,
    demoMode,
    winterMode,
  ]
  const build = (previous?: LiveVan) =>
    liveVan(
      {
        state,
        status,
        settled: status === 'connected',
        primaryBattery,
        relayGroups,
        relayGroupList,
        relayOrder,
        demoMode,
        winterMode,
      },
      previous,
    )
  // The last build and what it was built from: a render with the same inputs reuses it, and a new
  // build starts from it so it keeps its unchanged parts (storing information from previous renders).
  const [held, setHeld] = useState(() => ({ inputs, van: build() }))
  if (inputs.every((input, i) => Object.is(input, held.inputs[i]))) return held.van
  const van = build(held.van)
  setHeld({ inputs, van })
  return van
}
