import { Waypoints } from 'lucide-react'
import { PhoneCard } from '@/components/PhoneCard'
import { BatterySource } from '@/components/power/BatterySource'
import { batterySourceLabel } from '@/components/power/batterySourceLabel'
import { useLiveVan } from '@/hooks/useLiveVan'
import { PowerCard } from '../PowerCard'
import type { StartWidgetProps } from './types'

/** The power flow, drawn as the Power page's layout choice calls for. */
export function PowerFlowCard({ powerLayout, onOpenInstance }: StartWidgetProps) {
  const van = useLiveVan()
  const source = batterySourceLabel(van)

  return (
    <PhoneCard
      title="Power flow"
      icon={<Waypoints className="size-4" />}
      right={source && <BatterySource name={source} />}
    >
      <PowerCard flow={van.flow} layout={powerLayout} onOpenInstance={onOpenInstance} />
    </PhoneCard>
  )
}
