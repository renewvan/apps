// Every topic the clients read or write, declared once: the reducer matches the state topics and
// the Commands publish on their `/set`, so the two can never drift apart. The wire contract is the
// hub's (`hub/schema/*.schema.json`).

/** The real van's topic root; every host plugin (kiosk, tailscale, hub) lives here, always. */
export const REAL_ROOT = 'renewvan'
/**
 * The simulated van's namespace (hub `docs/demo-mode.md`), under the real root: same shapes as the
 * real topics, one level down. `demo` is not an entity domain, so the real entity pattern can never
 * match it, and the logger (exactly four segments, entity domains only) drops all of it.
 */
export const DEMO_ROOT = `${REAL_ROOT}/demo`

/** A Command topic: the state topic it asks to change, plus `/set`. */
const set = (topic: string) => `${topic}/set`

/** The shared Demo switch: retained state, plus its `/set` Command. */
export const TOPIC_DEMO_ENABLED = `${DEMO_ROOT}/enabled`
export const TOPIC_DEMO_ENABLED_SET = set(TOPIC_DEMO_ENABLED)

// The hub plugin's retained status and shared settings. Host plugins: always on the real root,
// because the demo simulator does not simulate them.
export const TOPIC_HUB_STATUS = `${REAL_ROOT}/hub/status`
export const TOPIC_TAILSCALE = `${REAL_ROOT}/tailscale/status`
export const TOPIC_ENTITY_ICONS = `${REAL_ROOT}/hub/icons`
export const TOPIC_ENTITY_ICONS_SET = set(TOPIC_ENTITY_ICONS)
export const TOPIC_PRIMARY_BATTERY = `${REAL_ROOT}/hub/primary-battery`
export const TOPIC_PRIMARY_BATTERY_SET = set(TOPIC_PRIMARY_BATTERY)
export const TOPIC_RELAY_GROUPS = `${REAL_ROOT}/hub/relay-groups`
export const TOPIC_RELAY_GROUPS_SET = set(TOPIC_RELAY_GROUPS)
export const TOPIC_RELAY_GROUP_LIST = `${REAL_ROOT}/hub/relay-group-list`
export const TOPIC_RELAY_GROUP_LIST_SET = set(TOPIC_RELAY_GROUP_LIST)
export const TOPIC_RELAY_ORDER = `${REAL_ROOT}/hub/relay-order`
export const TOPIC_RELAY_ORDER_SET = set(TOPIC_RELAY_ORDER)

/** The kiosk host plugin's namespace: a demo van still dims and sleeps the real screen. */
export const KIOSK_PREFIX = `${REAL_ROOT}/kiosk/`
export const TOPIC_DISPLAY_POWER = `${KIOSK_PREFIX}display/power`
export const TOPIC_DISPLAY_POWER_SET = set(TOPIC_DISPLAY_POWER)
export const TOPIC_BRIGHTNESS = `${KIOSK_PREFIX}display/brightness`
export const TOPIC_BRIGHTNESS_SET = set(TOPIC_BRIGHTNESS)
export const TOPIC_AUTO_SLEEP_ENABLED = `${KIOSK_PREFIX}display/auto-sleep-enabled`
export const TOPIC_AUTO_SLEEP_ENABLED_SET = set(TOPIC_AUTO_SLEEP_ENABLED)
export const TOPIC_AUTO_SLEEP_TIMEOUT = `${KIOSK_PREFIX}display/auto-sleep-timeout-minutes`
export const TOPIC_AUTO_SLEEP_TIMEOUT_SET = set(TOPIC_AUTO_SLEEP_TIMEOUT)

/** The entity domains under a root: `<root>/<domain>/<id>/<property>`. */
export const ENTITY_DOMAINS = [
  'tank',
  'relay',
  'battery',
  'solar',
  'charger',
  'router',
  'gps',
  'temperature',
  'tilt',
  'heater',
] as const
export type EntityDomain = (typeof ENTITY_DOMAINS)[number]

/** `<root>/<domain>/<id>/<property>` on the real van: where entity Commands are published. */
export const entityTopic = (domain: EntityDomain, id: string, property: string) =>
  `${REAL_ROOT}/${domain}/${id}/${property}`

/**
 * Whether a Command may be sent. Demo state is read-only: while the switch is on, only kiosk
 * Commands, the Primary battery choice (a setting of this kiosk's reading, not a Command to a
 * Driver, so it works on the simulated van too) and the Demo switch itself go out, so a tap never
 * switches the real van behind a simulated screen.
 */
export function commandAllowed(demoMode: boolean, topic: string): boolean {
  return (
    !demoMode ||
    topic.startsWith(KIOSK_PREFIX) ||
    topic === TOPIC_PRIMARY_BATTERY_SET ||
    // The switch itself: how anyone leaves Demo mode.
    topic === TOPIC_DEMO_ENABLED_SET
  )
}
