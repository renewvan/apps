import { CarBattery } from 'lucide-react'
import { PhoneCard } from '@/components/PhoneCard'
import { batteryDial } from '../cockpit/dialView'
import { BatteryDial } from './BatteryDial'
import type { StartWidgetProps } from './types'

/** The Primary battery's cockpit dial (the dial is the battery's alone here). */
export function BatteryCard({ batteries, primaryBatterySelection, isDark }: StartWidgetProps) {
  const battery = batteryDial(batteries, primaryBatterySelection)

  return (
    <PhoneCard title="Battery" icon={<CarBattery className="size-4" />}>
      <BatteryDial battery={battery} isDark={isDark} />
    </PhoneCard>
  )
}
