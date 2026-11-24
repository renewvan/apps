import {
  isCompleteBattery,
  isCompleteCharger,
  isCompleteGps,
  isCompleteSolar,
  isCompleteTank,
  type Battery,
  type BusData,
  type Charger,
  type ConnectionStatus,
  type FluidType,
  type Gps,
  type Heater,
  type Relay,
  type RenewvanBusState,
  type Router,
  type RouterHealth,
  type Solar,
  type Tank,
  type TemperatureSensor,
  type Tilt,
} from '../types'
import { routerHealthOf } from '../reducer'
import {
  capabilitiesOf,
  driverRows,
  heaterDriversOnline,
  relayDriversOnline,
  tiltDriversOffline,
  type Capability,
  type DriverRow,
  type EntityType,
} from '../drivers'
import {
  flowFromBus,
  primaryBattery,
  starterBattery,
  type PowerSnapshot,
  type PrimaryBattery,
  type StarterBattery,
} from '../power'
import { DEFAULT_RELAY_GROUP_LIST, resolvedRelayGroups } from '../relays'
import { sortTankIds } from '../tank'

/**
 * What the Live van is drawn from: the visible van (`visibleState`) and the shared hub settings as
 * the bus holds them, the connection, and whether the retained burst has had time to arrive.
 * The names are `BusData`'s, so a client passes its bus as it is.
 */
export interface LiveVanInput extends Pick<
  BusData,
  'primaryBattery' | 'relayGroups' | 'relayGroupList' | 'relayOrder' | 'demoMode'
> {
  /** The van on screen: the simulated one while Demo mode is on (`visibleState`). */
  state: RenewvanBusState
  status: ConnectionStatus
  /**
   * True once the retained state has had time to arrive after a connect: until then a type with no
   * evidence reads `loading`, not `absent` (`capabilitiesOf`). The phone waits a few seconds after
   * the connect; a client that has no such timer passes `status === 'connected'`.
   */
  settled: boolean
}

/**
 * Whether a type's controls can be used. Its fields are retained, so a dead Driver leaves its last
 * values behind: `driverOnline` is every Driver that publishes it online, and at least one does.
 * In Demo mode the controls show but never send.
 */
export interface Trust {
  driverOnline: boolean
  demo: boolean
  /** Online and not in Demo mode: a control may send. */
  controllable: boolean
}

/**
 * The van as a client shows it (hub CONTEXT.md "Live van"): only complete entities, the Primary
 * battery resolved, the router chosen, the trust rules applied. Every screen reads this, never the
 * raw retained records (Settings' device and diagnostics views excepted). Facts that depend on the
 * clock (router staleness, tank pace, the flow's pulse) are the caller's, from this and `now`.
 */
export interface LiveVan {
  /** Demo mode: the van on screen is the simulated one, and nothing but the switch is sent. */
  demo: boolean
  /** The tanks that have fully arrived, by id. */
  tanks: Record<string, Tank>
  /** Their ids, in the Tanks page order (`sortTankIds`). */
  tankIds: string[]
  /** The first complete tank of each fluid, in arrival order: what a fluid's widget or ring shows. */
  tanksByFluid: Partial<Record<FluidType, { id: string; tank: Tank }>>
  /** The batteries that have fully arrived, by id. */
  batteries: Record<string, Battery>
  /** The headline battery: the shared choice, else Auto (`primaryBattery`); absent with none complete. */
  primaryBattery: PrimaryBattery | undefined
  /** The starter battery, from a monitor's aux input or an alternator charger (`starterBattery`). */
  starterBattery: StarterBattery | undefined
  /** The one power snapshot every flow, dial and half-moon draws (`flowFromBus`). */
  flow: PowerSnapshot
  /** The solar controllers that have fully arrived, by id. */
  solar: Record<string, Solar>
  /** The first of them: the one the Start page, the Power page and the history read. */
  firstSolar: { id: string; solar: Solar } | undefined
  /** The chargers that have fully arrived, by id. */
  chargers: Record<string, Charger>
  /** Every probe as reported: a reading counts only while its `status` is ok (`temperatureReading`). */
  temperatures: Record<string, Partial<TemperatureSensor>>
  /** The first complete GPS record (one GPS per van); it may have no position (`hasGpsFix`). */
  gps: { id: string; record: Gps } | undefined
  /**
   * The van's tilt: the first record, absent while there is none or while a tilt Driver reports
   * offline, because a dead driver's last `ok` and angles stay retained and read as a live level.
   */
  tilt: { record: Partial<Tilt> | undefined; driverOffline: boolean }
  relays: Record<string, Relay>
  relayTrust: Trust
  /** The shared relay groups: the list on offer with Unassigned in it, each relay's group, the order. */
  relayGroups: { list: string[]; assignments: Record<string, string>; order: string[] }
  heaters: Record<string, Heater>
  heaterTrust: Trust
  /** The van's router (one per hub: the first id), its Driver's health and when it last spoke. */
  router: {
    id: string | undefined
    record: Partial<Router> | undefined
    health: RouterHealth | null
    updatedAt: number | undefined
  }
  /** What the van has of each entity type (`capabilitiesOf`); nothing reads offline while disconnected. */
  capabilities: Record<EntityType, Capability>
  /** The Drivers as Settings lists them (`driverRows`). */
  drivers: DriverRow[]
}

function completeOnly<T>(
  records: Record<string, Partial<T>>,
  complete: (record: Partial<T>) => record is T,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(records).filter((entry): entry is [string, T] => complete(entry[1])),
  )
}

function trust(driverOnline: boolean, demo: boolean): Trust {
  return { driverOnline, demo, controllable: driverOnline && !demo }
}

/**
 * The Live van from what the bus holds. Pure, and cheap enough for every bus change. Pass the last
 * Live van as `previous` to keep the reference of every part whose content did not change, and the
 * whole object when nothing did, so a screen that reads one part redraws only when it changes.
 */
export function liveVan(input: LiveVanInput, previous?: LiveVan): LiveVan {
  const { state, demoMode: demo } = input
  const tanks = completeOnly(state.tanks, isCompleteTank)
  const tanksByFluid: LiveVan['tanksByFluid'] = {}
  for (const [id, tank] of Object.entries(tanks)) tanksByFluid[tank.fluid_type] ??= { id, tank }
  const solar = completeOnly(state.solar, isCompleteSolar)
  const solarId = Object.keys(solar)[0]
  const gps = completeOnly(state.gps, isCompleteGps)
  const gpsId = Object.keys(gps)[0]
  const tiltOffline = tiltDriversOffline(state)
  const routerId = Object.keys(state.routers)[0]
  const selection = input.primaryBattery ?? undefined
  const capabilities = capabilitiesOf(state, input.settled)

  const next: LiveVan = {
    demo,
    tanks,
    tankIds: sortTankIds(Object.keys(tanks)),
    tanksByFluid,
    batteries: completeOnly(state.batteries, isCompleteBattery),
    primaryBattery: primaryBattery(state.batteries, selection),
    // Read off every record, complete or not: a monitor's aux input is the starter, whatever else.
    starterBattery: starterBattery(state.batteries, state.chargers),
    flow: flowFromBus(state.batteries, state.solar, state.chargers, selection),
    solar,
    firstSolar: solarId === undefined ? undefined : { id: solarId, solar: solar[solarId] },
    chargers: completeOnly(state.chargers, isCompleteCharger),
    temperatures: state.temperatures,
    gps: gpsId === undefined ? undefined : { id: gpsId, record: gps[gpsId] },
    tilt: {
      record: tiltOffline ? undefined : Object.values(state.tilt)[0],
      driverOffline: tiltOffline,
    },
    relays: state.relays,
    relayTrust: trust(relayDriversOnline(state), demo),
    relayGroups: {
      list: resolvedRelayGroups(input.relayGroupList ?? DEFAULT_RELAY_GROUP_LIST),
      assignments: input.relayGroups,
      order: input.relayOrder,
    },
    heaters: state.heaters,
    heaterTrust: trust(heaterDriversOnline(state), demo),
    router: {
      id: routerId,
      record: routerId === undefined ? undefined : state.routers[routerId],
      health: routerHealthOf(state),
      updatedAt: routerId === undefined ? undefined : state.routerUpdatedAt[routerId],
    },
    // While the hub link is down nothing reads offline: the client's banner says so already.
    capabilities:
      input.status === 'connected'
        ? capabilities
        : (Object.fromEntries(
            Object.entries(capabilities).map(([type, c]) => [type, { ...c, offline: false }]),
          ) as Record<EntityType, Capability>),
    drivers: driverRows(state),
  }
  return previous === undefined ? next : shared(previous, next)
}

/** `next` with every part equal in content to `previous`'s taken from `previous`; `previous` if all are. */
function shared(previous: LiveVan, next: LiveVan): LiveVan {
  let changed = false
  const out = { ...next } as Record<keyof LiveVan, unknown>
  for (const key of Object.keys(next) as (keyof LiveVan)[]) {
    if (sameContent(previous[key], next[key])) out[key] = previous[key]
    else changed = true
  }
  return changed ? (out as unknown as LiveVan) : previous
}

/** Deep equality of the plain data the bus carries: objects, arrays and primitives. */
function sameContent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(
    (key) =>
      Object.hasOwn(b, key) &&
      sameContent((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}
