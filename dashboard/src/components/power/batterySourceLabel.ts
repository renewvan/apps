import { type DriverRow, instanceLabel } from '@renewvan/core/drivers'
import { completeBatteryIds, primaryBattery } from '@/lib/primaryBattery'
import type { Battery } from '@/types'

/**
 * Which battery a phone card reads, for the right of its header: the battery's own name
 * (`SmartShunt 500A`), or with several batteries its `instanceLabel`. `undefined` when it cannot
 * say (no complete battery, or one unnamed battery).
 */
export function batterySourceLabel(
  batteries: Record<string, Partial<Battery>>,
  selection: string | undefined,
  drivers: Pick<DriverRow, 'key' | 'name'>[] = [],
): string | undefined {
  const primary = primaryBattery(batteries, selection)
  if (!primary) return undefined
  const named = (primary.battery.name ?? '').trim() !== ''
  if (!named && completeBatteryIds(batteries).length < 2) return undefined
  return instanceLabel(primary.id, primary.battery, drivers)
}
