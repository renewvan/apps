import {
  AUTO_SLEEP_TIMEOUT_CHOICES,
  emptyRenewvanBusState,
  type BusData,
  type DriverInfo,
  type HubStatus,
  type KioskDisplay,
  type RenewvanBusState,
  type RouterHealth,
  type TailscaleStatus,
} from './types'
import {
  DEMO_ROOT,
  ENTITY_DOMAINS,
  KIOSK_PREFIX,
  REAL_ROOT,
  TOPIC_AUTO_SLEEP_ENABLED,
  TOPIC_AUTO_SLEEP_TIMEOUT,
  TOPIC_BRIGHTNESS,
  TOPIC_DEMO_ENABLED,
  TOPIC_DISPLAY_POWER,
  TOPIC_ENTITY_ICONS,
  TOPIC_HUB_STATUS,
  TOPIC_PRIMARY_BATTERY,
  TOPIC_RELAY_GROUP_LIST,
  TOPIC_RELAY_GROUPS,
  TOPIC_RELAY_ORDER,
  TOPIC_TAILSCALE,
} from './topics'

// What each topic does to everything the bus has said: pure, so it is tested without a broker
// (`reducer.test.ts`). The connection, batching and React live in each app; the wire contract is
// the hub's (`hub/schema/*.schema.json`). A message that changes nothing returns the state it was
// given, so a client can skip a re-render for it (retained topics are re-sent on every reconnect).

export const emptyBusData: BusData = {
  real: emptyRenewvanBusState,
  demo: emptyRenewvanBusState,
  demoMode: false,
  hubStatus: null,
  tailscale: null,
  kiosk: { power: null, brightness: null, autoSleepEnabled: null, autoSleepTimeoutMinutes: null },
  entityIcons: {},
  primaryBattery: null,
  relayGroups: {},
  relayGroupList: null,
  relayOrder: [],
}

// `<id>/<property>` is exactly two segments, so `<id>/name/set` and `<id>/unit/set` Command topics
// (three) never match.
function entityPattern(root: string): RegExp {
  return new RegExp(`^${root}/(${ENTITY_DOMAINS.join('|')})/([^/]+)/([^/]+)$`)
}
const ENTITY_PATTERN = { real: entityPattern(REAL_ROOT), demo: entityPattern(DEMO_ROOT) }

/**
 * `<root>/<driver>/info` and `<root>/<driver>/health`: three segments, so never an entity topic
 * (four). `demo` sits where a Driver key would on the real root and is reserved: it is the
 * simulated van's namespace, never a Driver, so its own `renewvan/demo/health` (retained on real
 * brokers) cannot become one.
 */
function driverPattern(root: string, reserved: string | null): RegExp {
  const key = reserved === null ? '[^/]+' : `(?!${reserved}/)[^/]+`
  return new RegExp(`^${root}/(${key})/(info|health)$`)
}
const DRIVER_PATTERN = {
  real: driverPattern(REAL_ROOT, 'demo'),
  demo: driverPattern(DEMO_ROOT, null),
}

/**
 * Every entity payload is the JSON-encoded value of its schema type: a bare number, a *quoted*
 * string (`"ok"`, not `ok`). Skipping `JSON.parse` once left `status` holding its quotes, so
 * `status === 'ok'` failed for every tank and battery. Anything that does not parse, including the
 * empty payload that clears a retained topic, reads as `undefined`.
 */
function parseValue(payload: string): unknown {
  try {
    return JSON.parse(payload)
  } catch {
    return undefined
  }
}

function accumulate<T>(
  record: Record<string, T>,
  id: string,
  property: string,
  value: unknown,
): Record<string, T> {
  const current = record[id] as Record<string, unknown> | undefined
  // A retained topic re-published with the value it already had changes nothing: the same record
  // comes back, so the state stays the same object and no screen re-renders for it.
  if (current !== undefined && property in current && sameValue(current[property], value)) {
    return record
  }
  return { ...record, [id]: { ...record[id], [property]: value } as T }
}

/** Equal bus values: the same primitive, or objects and arrays with the same JSON. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  return (
    typeof a === 'object' &&
    a !== null &&
    typeof b === 'object' &&
    b !== null &&
    JSON.stringify(a) === JSON.stringify(b)
  )
}

/** `prev` with one entity record replaced, or `prev` itself when the record did not change. */
function withRecord<K extends keyof RenewvanBusState>(
  prev: RenewvanBusState,
  key: K,
  next: RenewvanBusState[K],
): RenewvanBusState {
  return next === prev[key] ? prev : { ...prev, [key]: next }
}

/** `prev` with one field replaced, or `prev` itself when the new value is the same. */
function withField<T extends object, K extends keyof T>(prev: T, key: K, next: T[K]): T {
  return sameValue(prev[key], next) ? prev : { ...prev, [key]: next }
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

/** `value` when it is an IPv4 dotted quad other than the unspecified `0.0.0.0` (the schema's rule), else nothing. */
function optionalIpv4(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '0.0.0.0' && IPV4.test(value) ? value : undefined
}

/**
 * A light structural check of a Driver info payload (no schema library): a JSON object with string
 * `driver`, `product`, `source` and `version`, and `publishes` a list of strings if present.
 * Anything else reads as no info. The optional `manufacturer`, `homepage`, `board_serial` and `ip`
 * are kept only when they are valid (a string; an IPv4 dotted quad for `ip`), and no other key is
 * carried into state.
 */
function parseDriverInfo(payload: string): DriverInfo | undefined {
  const o = parseValue(payload)
  if (!isRecord(o)) return undefined
  if (
    typeof o.driver !== 'string' ||
    typeof o.product !== 'string' ||
    typeof o.source !== 'string' ||
    typeof o.version !== 'string'
  ) {
    return undefined
  }
  if (o.publishes !== undefined && !isStringList(o.publishes)) return undefined
  const info: DriverInfo = {
    driver: o.driver,
    product: o.product,
    source: o.source,
    version: o.version,
  }
  if (o.publishes !== undefined) info.publishes = o.publishes
  if (typeof o.manufacturer === 'string') info.manufacturer = o.manufacturer
  if (typeof o.homepage === 'string') info.homepage = o.homepage
  if (typeof o.board_serial === 'string') info.board_serial = o.board_serial
  const ip = optionalIpv4(o.ip)
  if (ip !== undefined) info.ip = ip
  return info
}

/**
 * The hub plugin's retained status (hub `hub-status.schema.json`): `ip` and `hostname`, each a
 * string or null, both required, and a non-empty string `version`. An empty payload clears the
 * topic and anything malformed reads as no status, so a stale address is never shown as the hub's.
 * A payload with no `version` is a hub plugin older than the field, so it is kept without one; a
 * present but invalid `version` is malformed.
 */
function parseHubStatus(payload: string): HubStatus | null {
  const o = parseValue(payload)
  if (!isRecord(o)) return null
  // `undefined` fails `isStringOrNull`, so a payload missing either required key is rejected here.
  if (!isStringOrNull(o.ip) || !isStringOrNull(o.hostname)) return null
  if (o.version === undefined) return { ip: o.ip, hostname: o.hostname }
  if (typeof o.version !== 'string' || o.version === '') return null
  return { ip: o.ip, hostname: o.hostname, version: o.version }
}

/**
 * The Tailscale plugin's retained status (hub `tailscale-status.schema.json`): boolean `enabled`
 * and `connected`, `ip` and `hostname` a string or null, and `peers` a whole number >= 0, all
 * required. An empty payload clears the topic, and anything malformed reads as no status too: a
 * stale or malformed status must not stay on screen.
 */
function parseTailscaleStatus(payload: string): TailscaleStatus | null {
  const o = parseValue(payload)
  if (!isRecord(o)) return null
  if (
    typeof o.enabled !== 'boolean' ||
    typeof o.connected !== 'boolean' ||
    !isStringOrNull(o.ip) ||
    !isStringOrNull(o.hostname) ||
    typeof o.peers !== 'number' ||
    !Number.isInteger(o.peers) ||
    o.peers < 0
  ) {
    return null
  }
  return {
    enabled: o.enabled,
    connected: o.connected,
    ip: o.ip,
    hostname: o.hostname,
    peers: o.peers,
  }
}

/** A JSON object whose entries pass `keep`; an empty payload or anything else reads as empty. */
function parseStringMap(
  payload: string,
  keep: (value: unknown) => boolean,
): Record<string, string> {
  const value = parseValue(payload)
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => keep(entry[1])),
  )
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isNonEmptyString = (value: unknown): value is string => isString(value) && value !== ''

/** The hub's entity icons (hub `hub-icons.schema.json`): `<entity>/<id>` to a lucide name. */
const parseEntityIcons = (payload: string) => parseStringMap(payload, isString)
/** The hub's relay groups (hub `hub-relay-groups.schema.json`): relay id to a group name. */
const parseRelayGroups = (payload: string) => parseStringMap(payload, isNonEmptyString)

/**
 * The hub's Primary battery choice (hub `hub-primary-battery.schema.json`): a non-empty JSON
 * string, `auto` or a battery instance id. Anything else reads as no choice (`auto`).
 */
function parsePrimaryBattery(payload: string): string | null {
  const value = parseValue(payload)
  return isNonEmptyString(value) ? value : null
}

/** A JSON array's non-empty strings, each once, in order; anything else reads as null. */
function parseStringList(payload: string): string[] | null {
  const value = parseValue(payload)
  return Array.isArray(value) ? [...new Set(value.filter(isNonEmptyString))] : null
}

/**
 * The kiosk display topics (hub `kiosk-display-*.schema.json`). Their payloads are bare (`on`,
 * `42`, `true`), not JSON, and anything but what the plugin publishes is ignored: an empty payload
 * is not a brightness of 0, and a timeout is only the exact text of a preset.
 */
function applyKioskMessage(prev: KioskDisplay, topic: string, payload: string): KioskDisplay {
  if (topic === TOPIC_DISPLAY_POWER) {
    return payload === 'on' || payload === 'off' ? withField(prev, 'power', payload) : prev
  }
  if (topic === TOPIC_BRIGHTNESS) {
    const value = Number(payload)
    const valid = payload !== '' && Number.isInteger(value) && value >= 0 && value <= 100
    return valid ? withField(prev, 'brightness', value) : prev
  }
  if (topic === TOPIC_AUTO_SLEEP_ENABLED) {
    return payload === 'true' || payload === 'false'
      ? withField(prev, 'autoSleepEnabled', payload === 'true')
      : prev
  }
  if (topic === TOPIC_AUTO_SLEEP_TIMEOUT) {
    const choice = AUTO_SLEEP_TIMEOUT_CHOICES.find((minutes) => String(minutes) === payload)
    return choice === undefined ? prev : withField(prev, 'autoSleepTimeoutMinutes', choice)
  }
  return prev
}

/**
 * A Driver's retained `info` or `health`. An empty payload clears a retained topic; so does
 * anything that is not a valid value. A Driver with neither left is gone, not an empty record.
 */
function applyDriverMessage(
  prev: RenewvanBusState,
  key: string,
  topic: 'info' | 'health',
  payload: string,
): RenewvanBusState {
  const { [key]: current, ...others } = prev.drivers
  const next = { ...current }
  if (topic === 'info') {
    const info = parseDriverInfo(payload)
    if (info) next.info = info
    else delete next.info
  } else if (payload === 'online' || payload === 'offline') {
    next.health = payload
  } else {
    delete next.health
  }
  const empty = next.info === undefined && next.health === undefined
  if (empty ? current === undefined : sameValue(current, next)) return prev
  return { ...prev, drivers: empty ? others : { ...others, [key]: next } }
}

/** Every property the heater schema publishes; anything else on a heater topic is a Command echo. */
const HEATER_PROPERTIES: ReadonlySet<string> = new Set([
  'driver',
  'name',
  'phase',
  'status_code',
  'error_code',
  'internal_temperature_c',
  'heater_temperature_c',
  'external_temperature_c',
  'voltage_v',
  'setpoint_c',
  'power_level',
  'mode',
  'runtime_s',
  'fan_rpm',
  'fuel_pump_hz',
  'ventilating',
  'thermostat',
  'commands_enabled',
])

/**
 * relay: `state` (a JSON boolean) and the optional `name` and `driver` (non-empty JSON strings),
 * nothing else. `set` is a four-segment topic, so the broker's echo of our own Command reaches this
 * reducer: it must never land as state. An empty payload is a retained-topic clear (hub ADR 0008):
 * clearing `state` means the relay is gone (not the same as switched off); clearing `name` or
 * `driver` drops only that label.
 */
function applyRelayMessage(
  prev: RenewvanBusState,
  id: string,
  property: string,
  value: unknown,
): RenewvanBusState {
  if (property !== 'state' && property !== 'name' && property !== 'driver') return prev
  const current = prev.relays[id]
  if (value === undefined) {
    // Nothing to clear: a relay that never said anything does not appear for a cleared topic.
    if (current === undefined) return prev
    if (property === 'state') {
      const { [id]: _removed, ...rest } = prev.relays
      return { ...prev, relays: rest }
    }
    if (!(property in current)) return prev
    const { [property]: _dropped, ...kept } = current
    return { ...prev, relays: { ...prev.relays, [id]: kept } }
  }
  // Only a JSON boolean is a state: coercing would read `"off"` or `"false"` as switched on.
  if (property === 'state' ? typeof value !== 'boolean' : !isNonEmptyString(value)) return prev
  return withRecord(prev, 'relays', accumulate(prev.relays, id, property, value))
}

function applyMessage(
  prev: RenewvanBusState,
  topic: string,
  payload: string,
  pattern: RegExp,
  driverTopicPattern: RegExp,
  now: number,
): RenewvanBusState {
  const driverMatch = driverTopicPattern.exec(topic)
  if (driverMatch) {
    return applyDriverMessage(prev, driverMatch[1], driverMatch[2] as 'info' | 'health', payload)
  }
  const match = pattern.exec(topic)
  if (!match) return prev
  const [, domain, id, property] = match
  const value = parseValue(payload)
  // `driver` and `name` are JSON strings on every entity; an empty payload clears them like any
  // other property, and anything that is not a string never lands.
  if (
    (property === 'driver' || property === 'name') &&
    value !== undefined &&
    typeof value !== 'string'
  ) {
    return prev
  }
  switch (domain) {
    case 'router':
      // Always stamped, even for a repeated value: the receipt time is what says the router is alive.
      return {
        ...prev,
        routers: accumulate(prev.routers, id, property, value),
        routerUpdatedAt: { ...prev.routerUpdatedAt, [id]: now },
      }
    case 'tank':
      return withRecord(prev, 'tanks', accumulate(prev.tanks, id, property, value))
    case 'gps':
      return withRecord(prev, 'gps', accumulate(prev.gps, id, property, value))
    case 'heater':
      // Only the schema's published fields may land, never the echo of a Command (hub ADR 0021).
      if (!HEATER_PROPERTIES.has(property)) return prev
      return withRecord(prev, 'heaters', accumulate(prev.heaters, id, property, value))
    case 'tilt':
      return withRecord(prev, 'tilt', accumulate(prev.tilt, id, property, value))
    case 'temperature':
      return withRecord(prev, 'temperatures', accumulate(prev.temperatures, id, property, value))
    case 'battery':
      return withRecord(prev, 'batteries', accumulate(prev.batteries, id, property, value))
    case 'solar':
      return withRecord(prev, 'solar', accumulate(prev.solar, id, property, value))
    case 'charger':
      return withRecord(prev, 'chargers', accumulate(prev.chargers, id, property, value))
    default:
      return applyRelayMessage(prev, id, property, value)
  }
}

/**
 * One message from `renewvan/#` (which includes the `renewvan/demo/` namespace) applied to
 * everything the bus has said so far. `now` is the receipt time in epoch ms, stamped on router
 * properties (`routerUpdatedAt`). Each root's entities and Drivers are accumulated separately, so
 * switching Demo mode is instant and real and simulated values never mix. The kiosk, Tailscale and
 * hub host plugins stay on the real root: the demo simulator does not simulate them.
 */
export function reduceBusMessage(
  prev: BusData,
  topic: string,
  payload: string,
  now: number,
): BusData {
  if (topic === TOPIC_DEMO_ENABLED) {
    // A JSON boolean, like every bus payload; anything else is not a state.
    if (payload !== 'true' && payload !== 'false') return prev
    return withField(prev, 'demoMode', payload === 'true')
  }
  if (topic.startsWith(KIOSK_PREFIX)) {
    // Every other kiosk topic (its `/set` Commands, anything a newer plugin adds) is swallowed
    // here: the kiosk host plugin is never a Driver.
    return withField(prev, 'kiosk', applyKioskMessage(prev.kiosk, topic, payload))
  }
  switch (topic) {
    case TOPIC_HUB_STATUS:
      return withField(prev, 'hubStatus', parseHubStatus(payload))
    case TOPIC_TAILSCALE:
      return withField(prev, 'tailscale', parseTailscaleStatus(payload))
    case TOPIC_ENTITY_ICONS:
      return withField(prev, 'entityIcons', parseEntityIcons(payload))
    case TOPIC_PRIMARY_BATTERY:
      return withField(prev, 'primaryBattery', parsePrimaryBattery(payload))
    case TOPIC_RELAY_GROUPS:
      return withField(prev, 'relayGroups', parseRelayGroups(payload))
    case TOPIC_RELAY_GROUP_LIST:
      // Not an array reads as no list (null), not as an empty one.
      return withField(prev, 'relayGroupList', parseStringList(payload))
    case TOPIC_RELAY_ORDER:
      return withField(prev, 'relayOrder', parseStringList(payload) ?? [])
  }
  const real = applyMessage(
    prev.real,
    topic,
    payload,
    ENTITY_PATTERN.real,
    DRIVER_PATTERN.real,
    now,
  )
  const demo = applyMessage(
    prev.demo,
    topic,
    payload,
    ENTITY_PATTERN.demo,
    DRIVER_PATTERN.demo,
    now,
  )
  return real === prev.real && demo === prev.demo ? prev : { ...prev, real, demo }
}

/** The van the screens show: the simulated one while Demo mode is on, never a mix. */
export function visibleState(data: BusData): RenewvanBusState {
  return data.demoMode ? data.demo : data.real
}

/**
 * The router Driver's health in `state` (pass `visibleState(data)`): null while it has none, which
 * reads as Unknown, never as offline.
 */
export function routerHealthOf(state: RenewvanBusState): RouterHealth | null {
  return state.drivers.router?.health ?? null
}
