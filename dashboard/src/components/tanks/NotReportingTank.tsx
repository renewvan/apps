import { Card, Chip } from '@heroui/react'
import { Droplet } from 'lucide-react'
import { FLUID_LABELS } from '@renewvan/core/tank'
import { instanceStateText, type InstanceState } from '@renewvan/core/van'
import type { Tank } from '@/types'
import { TankIcon } from './TankIcon'

/**
 * A tank the bus knows that is not reporting (hub CONTEXT.md "Silent"): titled as its card titles
 * it, Not reporting (Silent) or Driver offline (unknown) in a muted chip, and no gauge, so a last
 * level never reads as live. Its settings still open with a tap. Same HeroUI `!` caveats as
 * `TankCard`; `fill` takes the kiosk card's whole grid cell.
 */
export function NotReportingTank({
  id,
  tank,
  state,
  fill = false,
  onConfigure,
}: {
  id: string
  tank: Partial<Tank>
  state: Exclude<InstanceState, 'reporting'>
  fill?: boolean
  onConfigure: (id: string) => void
}) {
  const fluid = tank.fluid_type
  const label = fluid === undefined ? (tank.name ?? id) : FLUID_LABELS[fluid]
  return (
    <Card className={`relative gap-0! p-0! ${fill ? 'h-full min-h-0' : 'shrink-0'}`}>
      <button
        type="button"
        aria-label={`${label} settings`}
        onClick={() => onConfigure(id)}
        className="absolute inset-0 z-20 rounded-[inherit]"
      />
      <Card.Header className="flex-row! items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {fluid === undefined ? (
            <Droplet aria-hidden="true" className="text-muted size-4 shrink-0" />
          ) : (
            <TankIcon id={id} tank={{ fluid_type: fluid }} className="text-muted size-4 shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </div>
        <Chip size="sm" variant="soft" color="default">
          {instanceStateText('tank', state)}
        </Chip>
      </Card.Header>
    </Card>
  )
}
