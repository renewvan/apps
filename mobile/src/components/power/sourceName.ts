import type { LiveVan } from '@renewvan/core/van'

/**
 * Which battery a card reads, for the card header's right side: its published name (`SmartShunt
 * 500A`), or its id when there are several and it has none. Nothing when it cannot say.
 */
export function batterySourceName({
  primaryBattery: primary,
  batteries,
}: Pick<LiveVan, 'primaryBattery' | 'batteries'>): string | undefined {
  if (!primary) return undefined
  const several = Object.keys(batteries).length > 1
  return primary.battery.name?.trim() || (several ? primary.id : undefined)
}
