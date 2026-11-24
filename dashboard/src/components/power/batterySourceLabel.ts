import { instanceLabel } from '@renewvan/core/drivers'
import type { LiveVan } from '@renewvan/core/van'

/**
 * Which battery a phone card reads, for the right of its header: the battery's own name
 * (`SmartShunt 500A`), or with several batteries its `instanceLabel`. `undefined` when it cannot
 * say (no complete battery, or one unnamed battery).
 */
export function batterySourceLabel({
  primaryBattery: primary,
  batteries,
  drivers,
}: Pick<LiveVan, 'primaryBattery' | 'batteries' | 'drivers'>): string | undefined {
  if (!primary) return undefined
  const named = (primary.battery.name ?? '').trim() !== ''
  if (!named && Object.keys(batteries).length < 2) return undefined
  return instanceLabel(primary.id, primary.battery, drivers)
}
