import { chargerWatts } from '../power'
import { gpsSummary, formatTemperature } from '../sensors'
import type { Battery, Charger, Gps, Relay, Solar, Tank, TemperatureSensor } from '../types'

/** One short figure on an entity's row: the number and its unit, kept apart so a client can set the unit quieter. */
export interface Figure {
  value: string
  unit?: string
}

/** A figure as one plain string (`13.20 V`), for a client that does not style units apart. */
export const figureText = ({ value, unit }: Figure): string =>
  unit === undefined ? value : `${value} ${unit}`

/** A figure to `digits` decimals, or none while the entity has not published it. */
const figure = (value: number | undefined, digits: number, unit: string): Figure[] =>
  value === undefined ? [] : [{ value: value.toFixed(digits), unit }]

/** The short summary on a battery's row: charge, voltage, current. */
export const batterySummary = (battery: Partial<Battery>): Figure[] => [
  ...figure(battery.soc_pct, 0, '%'),
  ...figure(battery.voltage_v, 2, 'V'),
  ...figure(battery.current_a, 1, 'A'),
]

/** A solar controller's row: the power it is producing. */
export const solarSummary = (solar: Partial<Solar>): Figure[] => figure(solar.power_w, 0, 'W')

/** A charger's row: voltage, current, and output power (published, else derived). */
export const chargerSummary = (charger: Partial<Charger>): Figure[] => [
  ...figure(charger.voltage_v, 2, 'V'),
  ...figure(charger.current_a, 1, 'A'),
  ...(charger.voltage_v === undefined ? [] : figure(chargerWatts(charger as Charger), 0, 'W')),
]

/** A receiver's row: its fix in words. */
export const gpsRowSummary = (gps: Partial<Gps>): Figure[] => [{ value: gpsSummary(gps) }]

/** A sensor's row: its reading, `--°C` while it has none to trust. */
export const temperatureRowSummary = (sensor: Partial<TemperatureSensor>): Figure[] => [
  { value: formatTemperature(sensor, { suffix: true }) },
]

/** A channel's row: On or Off, nothing while its state is unknown. */
export const relaySummary = (relay: Relay): Figure[] =>
  relay.state === undefined ? [] : [{ value: relay.state ? 'On' : 'Off' }]

/** A tank's row: how full it is, and its capacity. */
export const tankRowSummary = (tank: Partial<Tank>): Figure[] => [
  ...figure(tank.level_pct, 0, '%'),
  ...figure(tank.capacity_l, 0, 'ℓ'),
]
