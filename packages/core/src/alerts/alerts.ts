import type { ConnectionStatus, TailscaleStatus } from '../types'
import { FLUID_LABELS } from '../tank'
import type { LiveVan } from '../van'

/** What an alert says. */
export interface AlertContent {
  type: 'error' | 'warning'
  title: string
  description: string
}

/** One alert, opened by `reconcile`. Each app keeps its open alerts and adds its own fields. */
export interface Alert extends AlertContent {
  /** `<key>-<createdAt>`: unique per opening, so an alert that comes back is a new one. */
  id: string
  /** Stable per source (`ALERT_KEYS`); a demo van alert's key is its real one behind `demo:`. */
  key: string
  createdAt: number
}

/** The alerts' stable keys. A demo van alert is `demo:` before its real key (`savedToHistory`). */
export const ALERT_KEYS = {
  tank: (id: string) => `tank:${id}`,
  starterBattery: 'starter-battery',
  hubLink: 'mqtt-connection',
  tailscale: 'tailscale-connection',
} as const

const DEMO_PREFIX = 'demo:'

/** What the alerts read besides the Live van: the hub link, Tailscale, and the settle flag. */
export interface AlertLink {
  status: ConnectionStatus
  /** The Tailscale plugin's retained status; `null` until it arrives (raises nothing). */
  tailscale: TailscaleStatus | null
  /** The retained state has had time to arrive since the last (re)connect (`LiveVanInput`). */
  settled: boolean
}

/** The alerts whose condition holds now, and the ones whose condition cannot be read now. */
export interface DesiredAlerts {
  /** By key: what should be open. */
  holding: Record<string, AlertContent>
  /** Whether an open alert's condition is unknown now: it stays open, neither resolved nor raised. */
  unknown: (key: string) => boolean
}

const isDemoKey = (key: string) => key.startsWith(DEMO_PREFIX)
const isVanKey = (key: string) => {
  const real = isDemoKey(key) ? key.slice(DEMO_PREFIX.length) : key
  return real.startsWith('tank:') || real === ALERT_KEYS.starterBattery
}

/**
 * The alerts that should be open now (hub CONTEXT.md "Live van"). Thresholds are the Drivers',
 * never applied here: a tank's `alarm_state`, the starter battery's `low`. The kinds:
 * - `tank:<id>` (error): a reporting tank in alarm;
 * - `starter-battery` (warning): the starter battery reported low;
 * - `mqtt-connection` (warning): the hub link is down;
 * - `tailscale-connection` (warning): Tailscale reports disconnected.
 *
 * Only reporting instances raise one: a Silent instance or one whose Driver is offline holds old
 * values, or none. Its open alert is kept open, not resolved (`unknown`): a tank whose Driver died
 * may still be in alarm, and only a reporting value can say it is not. The same holds for every van
 * alert until the retained state has settled, and for the hub link alert during a reconnect, so a
 * flapping link is one alert.
 *
 * Demo mode: the van alerts follow the van on screen, the demo one, under `demo:` keys; the real
 * van's open alerts are kept as they are (`unknown`) until it is shown again. A demo alert is shown
 * live (`alertOnScreen`) but never saved to history (`savedToHistory`), so a simulated alarm never
 * outlives the demo. The link alerts are about the real hub and Tailscale in either mode.
 */
export function desiredAlerts(van: LiveVan, link: AlertLink): DesiredAlerts {
  const holding: Record<string, AlertContent> = {}
  const prefix = van.demo ? DEMO_PREFIX : ''
  const notReporting = new Set<string>()

  for (const tank of van.instances.tank) {
    const key = prefix + ALERT_KEYS.tank(tank.id)
    if (tank.state !== 'reporting') notReporting.add(key)
    else if (tank.record.alarm_state === 'alarm') {
      holding[key] = {
        type: 'error',
        title: `${FLUID_LABELS[tank.record.fluid_type]} tank alarm`,
        description: 'Level requires attention.',
      }
    }
  }

  const starterKey = prefix + ALERT_KEYS.starterBattery
  if (van.starterBattery?.low) {
    holding[starterKey] = {
      type: 'warning',
      title: 'Starter battery low',
      description: 'Drive the van, or run an emergency charge from VictronConnect.',
    }
  } else if (van.starterBattery === undefined && starterSourceNotReporting(van)) {
    // A monitor or an alternator charger that is not reporting may be the one that reads it.
    notReporting.add(starterKey)
  }

  if (link.status === 'disconnected') {
    holding[ALERT_KEYS.hubLink] = {
      type: 'warning',
      title: 'Hub connection lost',
      description: 'Live data may be out of date.',
    }
  }
  if (link.tailscale !== null && !link.tailscale.connected) {
    holding[ALERT_KEYS.tailscale] = {
      type: 'warning',
      title: 'Tailscale disconnected',
      description: 'Remote access is unavailable.',
    }
  }

  const unknown = (key: string): boolean => {
    if (key === ALERT_KEYS.hubLink) return link.status === 'connecting'
    if (!isVanKey(key)) return false
    // The van not on screen: its alerts wait for it. A demo alert outlives Demo mode in no case.
    if (isDemoKey(key) !== van.demo) return !isDemoKey(key)
    return !link.settled || notReporting.has(key)
  }
  return { holding, unknown }
}

function starterSourceNotReporting(van: LiveVan): boolean {
  return (
    van.instances.battery.some((b) => b.state !== 'reporting') ||
    van.instances.charger.some((c) => c.state !== 'reporting' && c.record.source === 'alternator')
  )
}

/**
 * The transitions from the open alerts (`open`, each app's own, extra fields and all; one with a
 * `resolvedAt` is not open and is ignored) to `desired` at `now`: the alerts to open, in `desired`'s
 * order, and the open ones to resolve, stamped. An alert whose condition is unknown stays as it is.
 * Both lists are empty when nothing changed, so it can run on every bus change.
 */
export function reconcile<T extends Pick<Alert, 'key'> & { resolvedAt?: number }>(
  open: readonly T[],
  desired: DesiredAlerts,
  now: number,
): { opened: Alert[]; resolved: (T & { resolvedAt: number })[] } {
  const openKeys = new Set<string>()
  const resolved: (T & { resolvedAt: number })[] = []
  for (const alert of open) {
    if (alert.resolvedAt !== undefined) continue
    openKeys.add(alert.key)
    if (alert.key in desired.holding || desired.unknown(alert.key)) continue
    resolved.push({ ...alert, resolvedAt: now })
  }
  const opened = Object.entries(desired.holding)
    .filter(([key]) => !openKeys.has(key))
    .map(([key, content]) => ({ ...content, key, id: `${key}-${now}`, createdAt: now }))
  return { opened, resolved }
}

/** The Demo mode rule: a demo van alert is shown live but never written to an alert history. */
export const savedToHistory = (alert: Pick<Alert, 'key'>): boolean => !isDemoKey(alert.key)

/**
 * Whether an open alert is shown live (a toast, a banner) with the van on screen (`demo`): a van
 * alert only with its own van, so the real van's wait out a demo; a link alert always.
 */
export const alertOnScreen = (alert: Pick<Alert, 'key'>, demo: boolean): boolean =>
  !isVanKey(alert.key) || isDemoKey(alert.key) === demo
