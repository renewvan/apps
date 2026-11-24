import { Card } from '@heroui/react'
import { PlugZap } from 'lucide-react'
import { instanceLabel } from '@renewvan/core/drivers'
import { chargeStateLabel, chargerWatts, CHARGING_LABELS, formatPower } from '@renewvan/core/power'
import { instanceStateText, type LiveInstance } from '@renewvan/core/van'
import { PhoneCard } from '@/components/PhoneCard'
import { useLiveVan } from '@/hooks/useLiveVan'
import type { Charger, ChargerSource } from '@/types'

const SOURCE_LABELS: Partial<Record<ChargerSource, string>> = {
  ac: CHARGING_LABELS.shore,
  alternator: CHARGING_LABELS.alternator,
  dc: 'DC',
}

/** A charger's second line: where its power comes from, and its charge stage while it reports. */
function detail({ state, record }: LiveInstance<Charger>): string | undefined {
  const source = record.source && SOURCE_LABELS[record.source]
  const stage =
    state === 'reporting' && record.charge_state ? chargeStateLabel(record.charge_state) : undefined
  return [source, stage].filter(Boolean).join(' · ') || undefined
}

/** What a charger reads: its power while it reports, else Off (Silent) or Driver offline. */
function reading({ state, record }: LiveInstance<Charger>): string {
  if (state !== 'reporting') return instanceStateText('charger', state)
  const watts = chargerWatts(record)
  const power = formatPower(watts === undefined ? undefined : Math.round(watts))
  return `${power.value} ${power.unit}`.trim()
}

function ChargerRows({ inline }: { inline: boolean }) {
  const { instances, drivers } = useLiveVan()
  return (
    <ul
      aria-label="Chargers"
      className={
        inline ? 'flex min-w-0 flex-1 flex-wrap gap-x-8 gap-y-1' : 'flex w-full flex-col gap-3'
      }
    >
      {instances.charger.map((charger) => {
        const sub = detail(charger)
        const reporting = charger.state === 'reporting'
        return (
          <li
            key={charger.id}
            data-state={charger.state}
            className="flex min-w-0 items-center justify-between gap-4"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {instanceLabel(charger.id, charger.record, drivers)}
              </span>
              {sub && <span className="text-muted truncate text-xs">{sub}</span>}
            </div>
            <span
              className={`shrink-0 text-sm tabular-nums ${reporting ? 'text-foreground' : 'text-muted'}`}
            >
              {reading(charger)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Every charger the bus knows, as the phone's Energy tab lists them: its power, source and charge
 * stage while it reports, and a Silent one (an AC charger without shore power) as `Off` rather than
 * dropped, `Driver offline` while its Driver is (core's `instanceStateText`). Nothing while the van
 * has no charger. On a phone it is a card under the flow; on the kiosk a one-row card under the
 * layout, so the flow keeps the room.
 */
export function ChargersCard({ phone }: { phone: boolean }) {
  const { instances } = useLiveVan()
  if (instances.charger.length === 0) return null
  const icon = <PlugZap className="size-4" />
  if (phone) {
    return (
      <PhoneCard title="Chargers" icon={icon}>
        <ChargerRows inline={false} />
      </PhoneCard>
    )
  }
  return (
    <Card className="mx-auto mt-2 w-full max-w-3xl shrink-0 flex-row! items-center gap-4! px-4! py-2!">
      <span className="text-muted flex shrink-0 items-center gap-2 text-sm font-semibold">
        <span aria-hidden="true">{icon}</span>
        Chargers
      </span>
      <ChargerRows inline />
    </Card>
  )
}
