import { createContext, useContext } from 'react'
import type { Commands } from '@/types'

/** Every Command (`@renewvan/core`'s `buildCommands`), bound to `App`'s bus. Stable. */
export const CommandsContext = createContext<Commands | undefined>(undefined)

/** The Commands `App` provides. Throws outside its provider. */
export function useCommands(): Commands {
  const commands = useContext(CommandsContext)
  if (commands === undefined) throw new Error('useCommands needs a CommandsContext provider (App)')
  return commands
}
