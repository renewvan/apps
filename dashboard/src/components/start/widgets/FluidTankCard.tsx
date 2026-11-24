import { PhoneCard } from '@/components/PhoneCard'
import { FLUID_ICONS } from '@/components/tanks/fluidIcon'
import { TankRow } from '@/components/tanks/TankRow'
import type { Tank } from '@/types'
import { useLiveVan } from '@/hooks/useLiveVan'
import { NoData } from '../NoData'
import type { StartWidgetProps } from './types'

/** One fluid's tank as the Tanks page's own phone card, or its empty state until the tank reports. */
export function FluidTankCard({
  fluid,
  label,
  now,
  onConfigureTank,
}: StartWidgetProps & { fluid: Tank['fluid_type']; label: string }) {
  // The first complete tank of the fluid: ids are arbitrary, the fluid is the ask.
  const found = useLiveVan().tanksByFluid[fluid]
  if (found) {
    return <TankRow id={found.id} tank={found.tank} now={now} onConfigure={onConfigureTank} />
  }
  const Icon = FLUID_ICONS[fluid]
  return (
    <PhoneCard title={label} icon={<Icon className="size-4" />}>
      <NoData label={label} icon={<Icon className="size-4" />} />
    </PhoneCard>
  )
}

export function FreshWaterCard(props: StartWidgetProps) {
  return <FluidTankCard {...props} fluid="fresh_water" label="Fresh water" />
}

export function GreyWaterCard(props: StartWidgetProps) {
  return <FluidTankCard {...props} fluid="grey_water" label="Grey water" />
}
