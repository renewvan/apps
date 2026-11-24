import { Heater as HeaterIcon } from 'lucide-react'
import { HeaterCard } from '@/components/heater/HeaterPage'
import { PhoneCard } from '@/components/PhoneCard'
import { useLiveVan } from '@/hooks/useLiveVan'
import { NoData } from '../NoData'
import type { StartWidgetProps } from './types'

/**
 * The Heater page's controls as a Start widget: a card headed by the heater's name and status, then
 * a carousel of the dial (modes and Start/Stop under it) and the readings. The first heater only;
 * the Heater page handles several.
 */
export function HeaterWidget({ heater }: StartWidgetProps) {
  const { heaters, heaterTrust } = useLiveVan()
  const id = Object.keys(heaters).sort()[0]
  if (heater === undefined || id === undefined) {
    return (
      <PhoneCard title="Heater" icon={<HeaterIcon className="size-4" />}>
        <NoData icon={<HeaterIcon className="size-4" />} label="Heater" />
      </PhoneCard>
    )
  }
  return (
    <HeaterCard
      id={id}
      heater={heaters[id]}
      frozen={!heaterTrust.controllable}
      variant="widget"
      {...heater}
    />
  )
}
