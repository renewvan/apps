import { BATTERY_STATE_LABEL, IDLE_W, batteryTimeToGoS, formatTimeToGo } from '@renewvan/core/power'
import type { Palette } from '@/theme'
import type { Battery } from '@/types'

// The battery half of the dashboard's `start/cockpit/dialView.ts`. The dashboard paints with CSS
// variables; here the colours come from the palette the caller passes in.

/** What the battery dial shows. */
export interface BatteryDialView {
  /** 0..100, the arc fill. */
  pct: number
  /** The arc's colour: blue is fine, amber an alert, red bad. */
  color: string
  /** Line under the number, e.g. `13.20V / 35W`. */
  sub: string
  /** Remaining runtime while discharging (`9d 0h`), when the source publishes or allows an estimate. */
  timeToGo?: string
  /** What the battery is doing, shown in place of `timeToGo`. */
  state?: string
  /** The source's name, e.g. `SmartShunt 500A`, when it publishes one. */
  source?: string
  /** Taking charge (above `IDLE_W`): the dial then shows the travelling band. */
  charging: boolean
}

/** Tailwind amber-500, not the theme's paler `--warning`: the cockpit's alert colour. */
const RING_ALERT = '#f59e0b'
const BATTERY_ALERT_PCT = 40
const BATTERY_BAD_PCT = 20

/** The Primary battery (the Live van's `primaryBattery`) as a dial; `undefined` while there is none. */
export function batteryDial(
  battery: Battery | undefined,
  colors: Pick<Palette, 'accent' | 'danger'>,
): BatteryDialView | undefined {
  if (!battery) return undefined
  const pct = Math.min(100, Math.max(0, battery.soc_pct))
  const state =
    battery.power_w > IDLE_W ? 'charging' : battery.power_w < -IDLE_W ? 'discharging' : 'idle'
  const ttg = state === 'discharging' ? batteryTimeToGoS(battery) : undefined
  const runtime = ttg === undefined ? undefined : formatTimeToGo(ttg)
  return {
    pct,
    color:
      pct <= BATTERY_BAD_PCT
        ? colors.danger
        : pct <= BATTERY_ALERT_PCT
          ? RING_ALERT
          : colors.accent,
    sub: `${battery.voltage_v.toFixed(2)}V / ${Math.round(Math.abs(battery.power_w))}W`,
    timeToGo: runtime,
    state: runtime === undefined ? BATTERY_STATE_LABEL[state] : undefined,
    source: battery.name?.trim() || undefined,
    charging: state === 'charging',
  }
}
