import { buildCommands, type Commands } from '@renewvan/core'
import { useMemo } from 'react'
import { useRenewvanBus } from './RenewvanBusProvider'

// Every Command the app sends is built by `@renewvan/core` (`buildCommands`), the same list the
// dashboard sends. They go through the provider's `publish`: now or never, and only what Demo mode
// allows. `Commands` is imported, never re-exported by name: React Native's Babel codegen plugin
// rejects an `export { Commands }`.

/** The Commands bound to this app's connection: one stable object while the connection lasts. */
export function useCommands(): Commands {
  const { publish } = useRenewvanBus()
  return useMemo(() => buildCommands(publish), [publish])
}
