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
  instanceDriverHealth,
  relayDriversOnline,
  tiltDriversOffline,
  type Capability,
  type DriverRow,
  type EntityType,
} from '../drivers'
import {
  compareInstanceIds,
  flowFromBus,
  primaryBattery,
  starterBattery,
  type PowerSnapshot,
  type PrimaryBattery,
  type StarterBattery,
} from '../power'
import { DEFAULT_RELAY_GROUP_LIST, resolvedRelayGroups } from '../relays'
import { sortedSensorIds } from '../sensors'
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
 * How one entity instance the bus knows reads (hub CONTEXT.md "Silent"):
 * - `reporting`: its live values are there (the record is complete) and nothing says its Driver is
 *   offline, so it is drawn with them;
 * - `silent`: its identity is retained but its live values are absent (its Driver cleared them when
 *   the device stopped answering), and nothing says its Driver is offline: shown as off or not
 *   reporting, never dropped and never read as zero;
 * - `unknown`: its Driver is offline (`instanceDriverHealth`), complete record or not: the Driver,
 *   not the device, went away, and what the bus holds are its last values, never live ones.
 * A relay follows its own contract (hub ADR 0013): unknown whenever its Driver is not online, even
 * with a `state` retained, so it agrees with `relayTrust`.
 */
export type InstanceState = 'reporting' | 'silent' | 'unknown'

/** One instance with its state: the complete record while reporting, what the bus holds otherwise. */
export type LiveInstance<T> =
  | { id: string; state: 'reporting'; record: T }
  | { id: string; state: 'silent' | 'unknown'; record: Partial<T> }

/**
 * Every instance the bus knows of the types a screen lists one by one, each with its state, in the
 * order its page lists them: tanks in the Tanks page order, temperature probes in the sensors'
 * order, the rest by id. A screen draws its cards and rows from these; a calculation reads only the
 * reporting maps (`chargers`, `batteries`, ...), so a Silent instance never reads as 0 W.
 */
export interface LiveInstances {
  tank: LiveInstance<Tank>[]
  battery: LiveInstance<Battery>[]
  solar: LiveInstance<Solar>[]
  charger: LiveInstance<Charger>[]
  /** Reporting while the probe publishes a `status`; a reading still counts only while it is ok. */
  temperature: LiveInstance<Partial<TemperatureSensor>>[]
  /** Reporting while its Driver is online and a `state` is retained (see `InstanceState`). */
  relay: LiveInstance<Relay>[]
}

/**
 * The van as a client shows it (hub CONTEXT.md "Live van"): every instance the bus knows, reporting or
 * Silent or unknown (`instances`), with the calculations and the per-type maps drawn only from
 * reporting ones (complete, their Driver not offline), the Primary battery resolved, the router chosen, the trust rules applied. Every screen reads this, never the
 * raw retained records (Settings' device and diagnostics views excepted). Facts that depend on the
 * clock (router staleness, tank pace, the flow's pulse) are the caller's, from this and `now`.
 */
export interface LiveVan {
  /** Demo mode: the van on screen is the simulated one, and nothing but the switch is sent. */
  demo: boolean
  /** The reporting tanks, by id. */
  tanks: Record<string, Tank>
  /** Their ids, in the Tanks page order (`sortTankIds`). */
  tankIds: string[]
  /** The first reporting tank of each fluid, in arrival order: what a fluid's widget or ring shows. */
  tanksByFluid: Partial<Record<FluidType, { id: string; tank: Tank }>>
  /** The reporting batteries, by id. */
  batteries: Record<string, Battery>
  /** The headline battery: the shared choice, else Auto (`primaryBattery`); absent with none reporting. */
  primaryBattery: PrimaryBattery | undefined
  /** The starter battery, from a monitor's aux input or an alternator charger (`starterBattery`). */
  starterBattery: StarterBattery | undefined
  /** The one power snapshot every flow, dial and half-moon draws (`flowFromBus`). */
  flow: PowerSnapshot
  /** The reporting solar controllers, by id. */
  solar: Record<string, Solar>
  /** The first of them: the one the Start page, the Power page and the history read. */
  firstSolar: { id: string; solar: Solar } | undefined
  /** The reporting chargers, by id. */
  chargers: Record<string, Charger>
  /**
   * The reporting probes, by id: a reading counts only while its `status` is ok
   * (`temperatureReading`). A list of every probe reads `instances.temperature`.
   */
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
  /** Every instance the bus knows of the listed types, reporting, Silent or unknown. */
  instances: LiveInstances
}

/**
 * What a card shows in place of the readings of an instance that is not reporting: a Silent
 * charger is `Off` (an AC charger without shore power), any other Silent instance `Not reporting`,
 * an unknown one `Driver offline`. The one wording both apps share.
 */
export function instanceStateText(
  type: keyof LiveInstances,
  state: Exclude<InstanceState, 'reporting'>,
): string {
  if (state === 'unknown') return 'Driver offline'
  return type === 'charger' ? 'Off' : 'Not reporting'
}

function completeOnly<T>(
  records: Record<string, Partial<T>>,
  complete: (record: Partial<T>) => record is T,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(records).filter((entry): entry is [string, T] => complete(entry[1])),
  )
}

/** The reporting instances of one type, by id, in the bus's (arrival) order. */
function reportingOnly<T>(
  records: Record<string, Partial<T>>,
  instances: LiveInstance<T>[],
): Record<string, T> {
  const reporting = new Set(instances.filter((i) => i.state === 'reporting').map((i) => i.id))
  return Object.fromEntries(
    Object.entries(records).filter((entry): entry is [string, T] => reporting.has(entry[0])),
  )
}

/**
 * The bus state with only the reporting instances of the listed types: what every per-type map and
 * calculation reads, so a Silent instance never reads as zero and an offline Driver's last values
 * never feed a total or the flow.
 */
function reportingState(state: RenewvanBusState, instances: LiveInstances) {
  return {
    tanks: reportingOnly(state.tanks, instances.tank),
    batteries: reportingOnly(state.batteries, instances.battery),
    solar: reportingOnly(state.solar, instances.solar),
    chargers: reportingOnly(state.chargers, instances.charger),
    temperatures: reportingOnly(state.temperatures, instances.temperature),
  }
}

/**
 * The instances of one type in `ids` order, each with its state (`InstanceState`). A complete record
 * whose Driver is offline is unknown, not reporting: those are its last values, not live ones.
 */
function instancesOf<T>(
  state: RenewvanBusState,
  type: keyof LiveInstances,
  records: Record<string, Partial<T>>,
  ids: string[],
  reporting: (record: Partial<T>) => record is T,
): LiveInstance<T>[] {
  return ids.map((id): LiveInstance<T> => {
    const record = records[id]
    const health = instanceDriverHealth(state, type, record as { driver?: string })
    // A relay's state means nothing unless its Driver is online (hub ADR 0013).
    const dead = type === 'relay' ? health !== 'online' : health === 'offline'
    if (reporting(record) && !dead) return { id, state: 'reporting', record }
    return { id, state: dead ? 'unknown' : 'silent', record }
  })
}

const byId = (records: Record<string, unknown>) => Object.keys(records).sort(compareInstanceIds)

function instancesFrom(state: RenewvanBusState): LiveInstances {
  return {
    tank: instancesOf(
      state,
      'tank',
      state.tanks,
      sortTankIds(Object.keys(state.tanks)),
      isCompleteTank,
    ),
    battery: instancesOf(
      state,
      'battery',
      state.batteries,
      byId(state.batteries),
      isCompleteBattery,
    ),
    solar: instancesOf(state, 'solar', state.solar, byId(state.solar), isCompleteSolar),
    charger: instancesOf(state, 'charger', state.chargers, byId(state.chargers), isCompleteCharger),
    temperature: instancesOf<Partial<TemperatureSensor>>(
      state,
      'temperature',
      state.temperatures,
      sortedSensorIds(state.temperatures),
      (t): t is Partial<TemperatureSensor> => t.status !== undefined,
    ),
    relay: instancesOf<Relay>(
      state,
      'relay',
      state.relays,
      byId(state.relays),
      (r): r is Relay => r.state !== undefined,
    ),
  }
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
  const instances = instancesFrom(state)
  const reporting = reportingState(state, instances)
  const { tanks, solar, batteries, chargers } = reporting
  const tanksByFluid: LiveVan['tanksByFluid'] = {}
  for (const [id, tank] of Object.entries(tanks)) tanksByFluid[tank.fluid_type] ??= { id, tank }
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
    batteries,
    primaryBattery: primaryBattery(batteries, selection),
    starterBattery: starterBattery(batteries, chargers),
    flow: flowFromBus(batteries, solar, chargers, selection),
    solar,
    firstSolar: solarId === undefined ? undefined : { id: solarId, solar: solar[solarId] },
    chargers,
    temperatures: reporting.temperatures,
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
    instances,
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
