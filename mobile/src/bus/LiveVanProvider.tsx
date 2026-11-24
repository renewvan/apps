import { createContext, useContext, useState, type ReactNode } from 'react'
import { liveVan, type LiveVan } from '@renewvan/core/van'
import { useRenewvanBus } from './RenewvanBusProvider'

// The Live van (`@renewvan/core/van`): the van as the phone shows it, drawn from the bus in one place.
// Every tab reads it with `useLiveVan`, never the raw retained records (Settings › Devices and its
// diagnostics excepted). The dashboard builds the same van in its `useLiveVan`.

const LiveVanContext = createContext<LiveVan | undefined>(undefined)

/**
 * Builds the Live van once per bus change, keeping the reference of every part (and of the whole)
 * whose content did not change, so a screen that reads one part redraws only when it does.
 */
export function LiveVanProvider({ children }: { children: ReactNode }) {
  const {
    state,
    status,
    settled,
    primaryBattery,
    relayGroups,
    relayGroupList,
    relayOrder,
    demoMode,
  } = useRenewvanBus()
  const inputs = [
    state,
    status,
    settled,
    primaryBattery,
    relayGroups,
    relayGroupList,
    relayOrder,
    demoMode,
  ]
  const build = (previous?: LiveVan) =>
    liveVan(
      { state, status, settled, primaryBattery, relayGroups, relayGroupList, relayOrder, demoMode },
      previous,
    )
  // The last build and what it was built from: a render with the same inputs reuses it, and a new
  // build starts from it so it keeps its unchanged parts (storing information from previous renders).
  const [held, setHeld] = useState(() => ({ inputs, van: build() }))
  let van = held.van
  if (!inputs.every((input, i) => Object.is(input, held.inputs[i]))) {
    van = build(held.van)
    setHeld({ inputs, van })
  }
  return <LiveVanContext.Provider value={van}>{children}</LiveVanContext.Provider>
}

/** The Live van. Throws outside `LiveVanProvider`: a screen never draws a van of its own. */
export function useLiveVan(): LiveVan {
  const van = useContext(LiveVanContext)
  if (van === undefined) throw new Error('useLiveVan needs a LiveVanProvider above it')
  return van
}
