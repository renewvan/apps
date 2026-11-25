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

/** The board that powers the hub, as last announced on the bus. */
export interface RememberedHubPower {
  /** Its Driver key, `esp32-<board>`: what the board advertises over Bluetooth. */
  driver: string
  relayId: string
}

/**
 * What a client remembers while the hub is gone (hub ADR 0033, 0034), kept across restarts: the hub
 * is powered down for days. Whether the van is in Winter mode, which board powers the hub (so Hub
 * wake finds it with no bus to ask), and whether a Hub wake was sent and the hub is starting.
 */
export interface WinterMemory {
  winterMode: boolean
  hubPower: RememberedHubPower | null
  /** The board accepted a Hub wake since the bus was last reachable: the hub is starting. */
  wakeSent: boolean
}

export const EMPTY_WINTER_MEMORY: WinterMemory = {
  winterMode: false,
  hubPower: null,
  wakeSent: false,
}

/**
 * The memory after a bus change. Winter mode follows `rememberedWinterMode`; the Hub power board is
 * replaced only by a single, unambiguous claim, so an unreachable bus (no claims at all) never
 * forgets it; a sent wake is over once the bus is reachable. Returns `memory` itself when nothing
 * changed.
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
  const wakeSent = memory.wakeSent && van.status !== 'connected'
  if (
    winterMode === memory.winterMode &&
    hubPower === memory.hubPower &&
    wakeSent === memory.wakeSent
  ) {
    return memory
  }
  return { winterMode, hubPower, wakeSent }
}

/** What the app offers over Bluetooth now (hub ADR 0034). */
export interface BluetoothOffer {
  /**
   * Hub wake: `starting` once the board accepted a wake, until the bus is back; `prominent` (offered
   * on every page) while the phone remembers Winter mode and the bus is unreachable; otherwise
   * `quiet`, reachable from Settings for a phone that missed Winter mode.
   */
  hubWake: 'starting' | 'prominent' | 'quiet'
  /** Direct control: only while the bus is unreachable. Whenever it is reachable it is the only path. */
  directControl: boolean
}

/**
 * What the app offers over Bluetooth, from the bus connection and the phone's Winter mode memory.
 * The bus is unreachable whenever it is not `connected`: with the hub off, a client's status
 * alternates between `connecting` (each retry) and `disconnected`, and a command over Bluetooth
 * cannot also reach the bus before the bus is connected.
 */
export function bluetoothOffer(status: ConnectionStatus, memory: WinterMemory): BluetoothOffer {
  if (status === 'connected') return { hubWake: 'quiet', directControl: false }
  if (memory.wakeSent) return { hubWake: 'starting', directControl: true }
  return { hubWake: memory.winterMode ? 'prominent' : 'quiet', directControl: true }
}
