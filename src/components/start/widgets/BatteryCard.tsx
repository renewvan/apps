import { CarBattery } from 'lucide-react'
import { PhoneCard } from '@/components/PhoneCard'
import { BatterySource } from '@/components/power/BatterySource'
import { batterySourceLabel } from '@/components/power/batterySource'
import { batteryDial } from '../cockpit/dialView'
import { BatteryDial } from './BatteryDial'
import type { StartWidgetProps } from './types'

/** The Primary battery's cockpit dial (the dial is the battery's alone here). */
export function BatteryCard({
  batteries,
  primaryBatterySelection,
  drivers,
  isDark,
}: StartWidgetProps) {
  const battery = batteryDial(batteries, primaryBatterySelection)
  const source = batterySourceLabel(batteries, primaryBatterySelection, drivers)

  return (
    <PhoneCard
      title="Battery"
      icon={<CarBattery className="size-4" />}
      right={source && <BatterySource name={source} />}
    >
      <BatteryDial battery={battery} isDark={isDark} />
    </PhoneCard>
  )
}
