import { rememberedWinterMode, type HubPower } from '@renewvan/core/winterMode'
import type { ConnectionStatus } from '@renewvan/core'

// What this phone remembers about Winter mode while the hub is gone (hub ADR 0033, 0034): whether
// the van is in Winter mode, and which board powers the hub, so Hub wake can find that board with no
// bus to ask. Kept on the phone across restarts: the hub is powered down for days.

/** The board that powers the hub, as last announced on the bus. */
export interface RememberedHubPower {
  /** Its Driver key, `esp32-<board>`: what the board advertises over Bluetooth. */
  driver: string
  relayId: string
}

export interface WinterMemory {
  winterMode: boolean
  hubPower: RememberedHubPower | null
}

export const EMPTY_WINTER_MEMORY: WinterMemory = { winterMode: false, hubPower: null }

/**
 * The memory after a bus change. Winter mode follows core's `rememberedWinterMode`; the Hub power
 * board is replaced only by a single, unambiguous claim, so an unreachable bus (no claims at all)
 * never forgets it. Returns `memory` itself when nothing changed.
 */
export function nextWinterMemory(
  memory: WinterMemory,
  van: { status: ConnectionStatus; winterMode: boolean | null; hubPower: HubPower },
): WinterMemory {
  const winterMode = rememberedWinterMode(memory.winterMode, van.status, van.winterMode)
  const claim = van.hubPower.kind === 'one' ? van.hubPower.claim : null
  const hubPower =
    claim && (memory.hubPower?.driver !== claim.driver || memory.hubPower.relayId !== claim.relayId)
      ? { driver: claim.driver, relayId: claim.relayId }
      : memory.hubPower
  if (winterMode === memory.winterMode && hubPower === memory.hubPower) return memory
  return { winterMode, hubPower }
}

/** A stored memory, or the empty one when absent or unreadable. */
export function parseWinterMemory(raw: string | null): WinterMemory {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return EMPTY_WINTER_MEMORY
    const { winterMode, hubPower } = value as Record<string, unknown>
    const power = hubPower as Record<string, unknown> | null | undefined
    return {
      winterMode: winterMode === true,
      hubPower:
        typeof power?.driver === 'string' && typeof power.relayId === 'string'
          ? { driver: power.driver, relayId: power.relayId }
          : null,
    }
  } catch {
    return EMPTY_WINTER_MEMORY
  }
}
