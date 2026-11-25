import { EMPTY_WINTER_MEMORY, type WinterMemory } from '@renewvan/core/winterMode'

// How this phone stores core's Winter mode memory (`@renewvan/core/winterMode`, hub ADR 0033, 0034).
// What it holds and when it changes is core's; this only reads it back.

/** A stored memory, or the empty one when absent or unreadable. */
export function parseWinterMemory(raw: string | null): WinterMemory {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return EMPTY_WINTER_MEMORY
    const { winterMode, hubPower, wakeSent } = value as Record<string, unknown>
    const power = hubPower as Record<string, unknown> | null | undefined
    return {
      winterMode: winterMode === true,
      hubPower:
        typeof power?.driver === 'string' && typeof power.relayId === 'string'
          ? { driver: power.driver, relayId: power.relayId }
          : null,
      wakeSent: wakeSent === true,
    }
  } catch {
    return EMPTY_WINTER_MEMORY
  }
}
