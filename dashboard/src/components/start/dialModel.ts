import { tiltReading } from '@renewvan/core/sensors'
import { FLUID_LABELS } from '@renewvan/core/tank'
import {
  CHARGING_LABELS,
  type Charging,
  type ChargingKind,
  type PowerSnapshot,
} from '@renewvan/core/power'
import {
  POWER_SOURCE_LABELS,
  type LiveWatts,
  powerOf,
  type ChargerSlot,
  type PowerSlot,
  type PowerSource,
  type RingSource,
  type StartCentre,
} from '@/hooks/useStartPowerSources'
import type { Tilt } from '@/types'

/** One half-moon reading as drawn: a dash and an empty band until its source has published. */
export interface PowerReading {
  /** What the reading is, and so its icon: a configured power source or the charger present. */
  source: PowerSource | ChargingKind
  label: string
  /** Whole watts; `undefined` while the source has not published (never a made-up 0). */
  watts: number | undefined
  /** 0..100: the band's fill, 0 while there is no reading. */
  pct: number
  /**
   * In place of the watts, for a source the van has that is not reporting (the flow's
   * `notReporting`: `Off`, `Not reporting`, `Driver offline`); its band stays empty.
   */
  state?: string
}

function reading(
  source: PowerReading['source'],
  label: string,
  watts: number | undefined,
  fullScaleW: number,
): PowerReading {
  return {
    source,
    label,
    watts: watts === undefined ? undefined : Math.round(watts),
    pct: watts === undefined ? 0 : Math.min(100, (watts / fullScaleW) * 100),
  }
}

/**
 * `slot`'s reading from the live solar, battery and load watts. A solar slot whose controller is
 * not reporting (`flow`'s Silent or unknown solar source) reads its state, not a dash.
 */
export function powerReading(
  slot: PowerSlot,
  live: LiveWatts,
  flow?: Pick<PowerSnapshot, 'nodes'>,
): PowerReading {
  const watts = powerOf(slot.source, live)
  const off =
    slot.source === 'solar' && watts === undefined ? flow?.nodes.solar.notReporting : undefined
  return {
    ...reading(slot.source, POWER_SOURCE_LABELS[slot.source], watts, slot.fullScaleW),
    ...(off && { state: off.text }),
  }
}

/** The charging reading (alternator or shore charger), named for the charger that is present. */
export function chargingReading(slot: ChargerSlot, present: Charging): PowerReading {
  return reading(present.kind, CHARGING_LABELS[present.kind], present.watts, slot.fullScaleW)
}

/**
 * The charging reading while no charger reports but the van has one that is not reporting (a
 * Silent shore charger without shore power): named for it, the alternator first as `charging`
 * names it in a quiet van, with its state in place of the watts and an empty band. `undefined`
 * while there is none.
 */
export function notReportingChargingReading(
  flow: Pick<PowerSnapshot, 'nodes'>,
): PowerReading | undefined {
  const kind = (['alternator', 'shore'] as const).find((id) => flow.nodes[id].notReporting)
  if (kind === undefined) return undefined
  return {
    source: kind,
    label: CHARGING_LABELS[kind],
    watts: undefined,
    pct: 0,
    state: flow.nodes[kind].notReporting!.text,
  }
}

/** The label a ring wears: the battery, or the tank's full name (`Fresh water`). */
export function ringLabel(source: RingSource): string {
  return source === 'battery' ? 'Battery' : FLUID_LABELS[source]
}

/** A tilt record with both angles usable now (`status ok`, finite); stale retained angles do not count. */
export function hasTiltReading(tilt: Partial<Tilt> | undefined): boolean {
  const { roll, pitch } = tiltReading(tilt)
  return roll !== null && pitch !== null
}

/**
 * What fills the middle of the rings: whatever is chosen, except that the tilt, with no usable
 * reading, gives way to the battery's readout rather than leaving the middle empty.
 */
export type CentreKind = 'van' | 'tilt' | 'battery'

export function centreKind(choice: StartCentre, tilt: Partial<Tilt> | undefined): CentreKind {
  if (choice === 'tilt') return hasTiltReading(tilt) ? 'tilt' : 'battery'
  return choice
}

/**
 * The ring indices listed under the arc, the battery first. Only the battery's own readout in the
 * middle takes the battery out of the list; with the tilt or the van there, it is listed so its %
 * stays visible somewhere.
 */
export function legendIndices(rings: readonly RingSource[], centre: CentreKind): number[] {
  const listed = rings.flatMap((source, index) =>
    centre === 'battery' && source === 'battery' ? [] : [index],
  )
  const isBattery = (index: number) => rings[index] === 'battery'
  return [...listed.filter(isBattery), ...listed.filter((i) => !isBattery(i))]
}

/** The widget a tap on the middle brings next: van, then tilt (while it has a reading), then battery. */
export function nextCentre(current: CentreKind, tiltUsable: boolean): CentreKind {
  if (current === 'van') return tiltUsable ? 'tilt' : 'battery'
  return current === 'tilt' ? 'battery' : 'van'
}
