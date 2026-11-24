import type { ConnectionStatus, DriverRecord, Heater, Relay } from '../types'

// Winter mode and Hub power (hub CONTEXT.md, hub ADR 0033): which relay powers the hub, whether
// Start winter mode may be sent, what the confirm lists, and what a client remembers while the hub
// is gone. Pure: each app draws it and sends the Command.

/** How long a client waits for the hub to report Winter mode before it says the start failed. */
export const WINTER_MODE_ANSWER_MS = 15_000

/** One Driver's claim, from its Driver info: its Hub power relay, and whether it is online. */
export interface HubPowerClaim {
  driver: string
  relayId: string
  online: boolean
}

/**
 * The van's Hub power: none (no Winter mode), one board's, or a setup error where more than one
 * board claims it. Every claimed relay is reserved even then, so none is ever shown as a switch.
 */
export type HubPower =
  | { kind: 'none' }
  | { kind: 'one'; claim: HubPowerClaim }
  | { kind: 'conflict'; claims: HubPowerClaim[] }

/** Hub power as the Drivers' info announce it (`hub_power`), in Driver key order. */
export function hubPowerOf(drivers: Readonly<Record<string, DriverRecord>>): HubPower {
  const claims = Object.entries(drivers)
    .filter(([, record]) => record.info?.hub_power !== undefined)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([driver, record]) => ({
      driver,
      relayId: record.info?.hub_power as string,
      online: record.health === 'online',
    }))
  if (claims.length === 0) return { kind: 'none' }
  if (claims.length === 1) return { kind: 'one', claim: claims[0] }
  return { kind: 'conflict', claims }
}

/** The relays Hub power reserves: never a switch, never grouped, ordered or renamed. */
export function reservedRelayIds(hubPower: HubPower): string[] {
  if (hubPower.kind === 'none') return []
  if (hubPower.kind === 'one') return [hubPower.claim.relayId]
  return hubPower.claims.map((claim) => claim.relayId)
}

/** What decides whether Start winter mode may be sent, all from the Live van and the connection. */
export interface WinterModeGateInput {
  demo: boolean
  status: ConnectionStatus
  hubPower: HubPower
  heaters: Readonly<Record<string, Partial<Heater>>>
  /** `renewvan/hub/winter-mode` as the bus holds it. */
  winterMode: boolean | null
}

/**
 * Why Start winter mode cannot be sent now, or null when it can. The hub plugin checks the same
 * things again (a client may be stale); this is what the confirm says before anyone taps.
 */
export function winterModeProblem(input: WinterModeGateInput): string | null {
  const { hubPower } = input
  if (input.demo) return 'Not available in Demo mode.'
  if (hubPower.kind === 'none') return 'No relay board powers the hub.'
  if (hubPower.kind === 'conflict') {
    const drivers = hubPower.claims.map((claim) => claim.driver).join(', ')
    return `More than one relay board claims Hub power (${drivers}). Fix the boards' setup first.`
  }
  if (input.status !== 'connected') return 'The hub is not connected.'
  if (!hubPower.claim.online) return 'The relay board that powers the hub is offline.'
  const running = Object.values(input.heaters).some(
    (heater) => heater.phase !== undefined && heater.phase !== 'off',
  )
  if (running) return 'Switch the heater off first.'
  if (input.winterMode === true) return 'Winter mode is already starting.'
  return null
}

/** The relays still on, apart from Hub power: what the confirm offers to switch off too. */
export function relaysLeftOn(
  relays: Readonly<Record<string, Partial<Relay>>>,
  hubPower: HubPower,
): string[] {
  const reserved = new Set(reservedRelayIds(hubPower))
  return Object.keys(relays)
    .filter((id) => relays[id].state === true && !reserved.has(id))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

/**
 * Whether a client remembers Winter mode: from the hub's `true` until it reaches the bus again and
 * the hub reports `false`. While the hub is gone, or before its retained state arrives, the memory
 * stands: an unreachable hub is not a hub out of Winter mode.
 */
export function rememberedWinterMode(
  remembered: boolean,
  status: ConnectionStatus,
  winterMode: boolean | null,
): boolean {
  if (winterMode === true) return true
  if (status === 'connected' && winterMode === false) return false
  return remembered
}
