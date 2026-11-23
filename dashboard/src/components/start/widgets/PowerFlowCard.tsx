import { Waypoints } from 'lucide-react'
import { PhoneCard } from '@/components/PhoneCard'
import { BatterySource } from '@/components/power/BatterySource'
import { batterySourceLabel } from '@/components/power/batterySource'
import { flowFromBus } from '@/components/power/flowModel'
import { PowerCard } from '../PowerCard'
import type { StartWidgetProps } from './types'

/** The power flow, drawn as the Power page's layout choice calls for. */
export function PowerFlowCard({
  batteries,
  solar,
  chargers,
  primaryBatterySelection,
  drivers,
  powerLayout,
  onOpenInstance,
}: StartWidgetProps) {
  const flow = flowFromBus(batteries, solar, chargers, primaryBatterySelection)
  const source = batterySourceLabel(batteries, primaryBatterySelection, drivers)

  return (
    <PhoneCard
      title="Power flow"
      icon={<Waypoints className="size-4" />}
      right={source && <BatterySource name={source} />}
    >
      <PowerCard flow={flow} layout={powerLayout} onOpenInstance={onOpenInstance} />
    </PhoneCard>
  )
}
