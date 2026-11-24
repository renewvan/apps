import { tankView } from '../tank/tankView'
import type { TankSeverity } from '../tank/tank-alarm'
import type { Battery, Tank } from '../types'
import { BATTERY_STATE_LABEL, IDLE_W } from '../power/flowModel'
import { batteryTimeToGoS, formatTimeToGo } from '../power/time-to-go'

/**
 * How a Start-page dial reads, before colours. `tone` is the colour **role** (`ok` is fine,
 * `alert` is the ring's amber, `bad` is wrong or empty/full on the wrong side); each app maps the
 * roles to its own palette (the dashboard's CSS variables, mobile's `Palette`), so the model
 * never carries a colour itself.
 */
export type DialTone = 'ok' | 'alert' | 'bad'

/** What one Start-page dial shows. `undefined` from the builders below means "no data yet". */
export interface DialView {
  label: string
  /** 0..100, the arc fill. Always 0 while faulted. */
  pct: number
  /** Litres in the tank (0 while faulted, like `pct`); `undefined` for the battery, which has no volume. */
  litres?: number
  /** The arc's colour role; see {@link DialTone}. */
  tone: DialTone
  /** Line under the number, e.g. `13.20V / 35W` or `46 / 100 ℓ`; the fault reason when faulted. */
  sub: string
  /** Colour the unit letters (`V`, `W`, `ℓ`) of `sub` stronger than the muted numbers. */
  unitsStrong?: boolean
  /**
   * The battery's remaining runtime as `formatTimeToGo` writes it (`9d 0h`), shown under the subline.
   * Only the battery has one, and only while its source publishes the estimate.
   */
  timeToGo?: string
  /** What the battery is doing, in the Power page's words (`Idle`, `Charging`, `Discharging`), shown under the subline in place of `timeToGo`, which replaces it while discharging. */
  state?: string
  /** The source's name, e.g. `SmartShunt 500A`, when it publishes one. */
  source?: string
  /** The battery is taking charge (above `IDLE_W`, as on the Power page): its dial then shows the travelling band. */
  charging?: boolean
  faulted: boolean
}

/** A battery at or below this state of charge is amber, and at or below `BATTERY_BAD_PCT` red. The Power
 *  page already paints the battery red from 20%. */
const BATTERY_ALERT_PCT = 40
const BATTERY_BAD_PCT = 20

function batteryTone(pct: number): DialTone {
  if (pct <= BATTERY_BAD_PCT) return 'bad'
  return pct <= BATTERY_ALERT_PCT ? 'alert' : 'ok'
}

export type BatteryLevel = 'full' | 'medium' | 'low' | 'empty'

/**
 * Which battery icon the level takes, on its own steps (not the ring's colour zones): empty at 0,
 * low under 20, medium from 20 to 80, full above. Judged on the whole percentage that is shown.
 */
export function batteryLevel(pct: number): BatteryLevel {
  const shown = Math.round(pct)
  if (shown <= 0) return 'empty'
  if (shown < 20) return 'low'
  return shown <= 80 ? 'medium' : 'full'
}

/**
 * A tank ring's tone from the Tanks page's severity (the alarm zones), with the wrong extreme bad
 * even for a tank with no alarm configured: empty for fresh water, fuel and LPG, full for the waste
 * tanks. A zone the Tanks page paints success (a good extreme) is ok here.
 */
function tankTone(
  severity: TankSeverity,
  fluid: Tank['fluid_type'],
  pct: number,
  faulted: boolean,
): DialTone {
  if (faulted || severity === 'danger') return 'bad'
  const wasteFluid = fluid === 'grey_water' || fluid === 'black_water'
  const wrongExtreme = wasteFluid ? Math.round(pct) >= 100 : Math.round(pct) <= 0
  if (wrongExtreme) return 'bad'
  return severity === 'warning' ? 'alert' : 'ok'
}

/** The Primary battery (the Live van's `primaryBattery`) as a dial; `undefined` while there is none. */
export function batteryDial(battery: Battery | undefined): DialView | undefined {
  if (!battery) return undefined
  const pct = Math.min(100, Math.max(0, battery.soc_pct))
  const batteryState =
    battery.power_w > IDLE_W ? 'charging' : battery.power_w < -IDLE_W ? 'discharging' : 'idle'
  const ttg = batteryState === 'discharging' ? batteryTimeToGoS(battery) : undefined
  const runtime = ttg === undefined ? undefined : formatTimeToGo(ttg)
  return {
    label: 'Battery',
    pct,
    tone: batteryTone(pct),
    sub: `${battery.voltage_v.toFixed(2)}V / ${Math.round(Math.abs(battery.power_w))}W`,
    unitsStrong: true,
    // One line under the subline: the runtime while it discharges, else what the battery is doing.
    timeToGo: runtime,
    state: runtime === undefined ? BATTERY_STATE_LABEL[batteryState] : undefined,
    source: battery.name?.trim() || undefined,
    charging: battery.power_w > IDLE_W,
    faulted: false,
  }
}

/**
 * A tank as a dial. Level, litres, fault handling and the severity tone all come from
 * `tankView`, so a dial and its Tanks-page card cannot disagree.
 */
export function tankDial(tank: Tank, now: Date): DialView {
  const view = tankView(tank, now)
  return {
    label: view.fluidLabel,
    pct: view.pct,
    litres: view.faulted ? 0 : view.litres,
    tone: tankTone(view.severity, tank.fluid_type, view.pct, view.faulted),
    sub: view.faulted ? (view.status?.label ?? 'Fault') : `${view.litres} / ${view.capacityL} ℓ`,
    unitsStrong: !view.faulted,
    faulted: view.faulted,
  }
}
