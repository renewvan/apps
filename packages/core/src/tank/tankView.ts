import { tankLevelStatus, tankSeverity, type TankSeverity } from './tank-alarm'
import { consumptionRateLph } from './tank-display'
import { FLUID_LABELS, STATUS_LABELS } from './tank-labels'
import type { Tank } from '../types'

export interface TankLabel {
  label: string
  severity: TankSeverity
}

/** Everything a tank layout shows, derived once so the card and the row cannot disagree. */
export interface TankView {
  fluidLabel: string
  /** Level clamped to 0..100; 0 while faulted (the reading is not trustworthy). */
  pct: number
  /** Read by Level probes: `pct` is a Stepped level, a lower bound (hub ADR 0033). */
  stepped: boolean
  /** The level as words: `62%`, or for a Stepped level `≥ 66%` / `< 33%` (all probes dry). */
  levelLabel: string
  /** Litres against capacity, bounded the same way: `62/100 ℓ`, `≥ 46/70 ℓ`, `< 23/70 ℓ`. */
  litresLabel: string
  /** Where the gauge draws its lines: the quartiles, or the Level marks below the top. */
  gridlines: number[]
  /** Litres remaining, from the clamped level: an out-of-range reading can never exceed capacity. */
  litres: number
  capacityL: number
  faulted: boolean
  /** Fill severity: the same key paints the gauge and the badge. */
  severity: TankSeverity
  badge: TankLabel
  /** Hidden (undefined) with no alarm configured and no fault. */
  status: TankLabel | undefined
  temperature: string
  /** Fresh water: drains from a refill. Every other tank fills from an empty-out. */
  isRefill: boolean
  rateLabel: 'Drain Rate' | 'Fill Rate'
  rate: string
}

const NO_VALUE = '--'
const LITRE = '\u2113'
const QUARTILES = [25, 50, 75]

/** `≥`/`<` prefix for a Stepped level, '' for a continuous one or an exact full. */
function boundPrefix(marks: number[] | undefined, pct: number): string {
  if (!marks) return ''
  if (pct === 0) return '< '
  return pct >= 100 ? '' : '\u2265 '
}

export function tankView(tank: Tank, now: Date): TankView {
  const faulted = tank.status !== 'ok'
  const clamped = Math.min(100, Math.max(0, tank.level_pct))
  const pct = faulted ? 0 : clamped
  const levelStatus = faulted ? undefined : tankLevelStatus(tank, clamped)
  const marks = tank.level_marks_pct?.length
    ? [...tank.level_marks_pct].sort((a, b) => a - b)
    : undefined
  // All probes dry: the level is somewhere below the lowest mark.
  const shownPct = marks && clamped === 0 ? marks[0] : clamped
  const prefix = boundPrefix(marks, clamped)
  const litres = Math.round((tank.capacity_l * clamped) / 100)
  const shownLitres = Math.round((tank.capacity_l * shownPct) / 100)

  // Fresh water reads as "refilled" (last_full_at) and drains; every other
  // fluid reads as "emptied" (last_empty_at) and fills.
  const isRefill = tank.fluid_type === 'fresh_water'
  const latchIso = isRefill ? tank.last_full_at : tank.last_empty_at
  const rateLph = consumptionRateLph(
    isRefill ? tank.volume_since_full_l : tank.volume_since_empty_l,
    latchIso,
    now,
  )

  const badge: TankLabel = faulted
    ? { label: 'Fault', severity: 'danger' }
    : levelStatus
      ? { label: levelStatus.label, severity: levelStatus.color }
      : { label: 'Normal', severity: 'accent' }

  return {
    fluidLabel: FLUID_LABELS[tank.fluid_type],
    pct,
    stepped: marks !== undefined,
    levelLabel: `${prefix}${shownPct.toFixed(0)}%`,
    litresLabel: `${prefix}${shownLitres}/${tank.capacity_l} ${LITRE}`,
    gridlines: marks ? marks.filter((mark) => mark < 100) : QUARTILES,
    litres,
    capacityL: tank.capacity_l,
    faulted,
    severity: tankSeverity(tank, clamped),
    badge,
    status: faulted
      ? { label: STATUS_LABELS[tank.status], severity: 'danger' }
      : levelStatus
        ? badge
        : undefined,
    temperature: tank.temperature_c != null ? `${tank.temperature_c.toFixed(0)}°C` : NO_VALUE,
    isRefill,
    rateLabel: isRefill ? 'Drain Rate' : 'Fill Rate',
    // Steps between Level marks are not a measured volume: no pace for a Stepped level.
    rate: rateLph !== undefined && !marks ? `${rateLph.toFixed(1)} L/h` : NO_VALUE,
  }
}
