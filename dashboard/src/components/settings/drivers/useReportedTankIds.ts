import { sortTankIds } from '@renewvan/core/tank'
import { isCompleteTank } from '@/types'
import { useRawBus } from '@/hooks/useRawBus'

/** Ids of the tanks that have fully reported, in display order (fresh, grey, then by id). */
export function useReportedTankIds(): string[] {
  const { tanks } = useRawBus().state
  return sortTankIds(Object.keys(tanks).filter((id) => isCompleteTank(tanks[id])))
}
