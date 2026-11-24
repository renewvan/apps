import { CarBattery } from 'lucide-react'
import { CockpitDial } from '../cockpit/CockpitDial'
import type { DialView } from '@renewvan/core/dial'
import { NoData } from '../NoData'

/** The Primary battery's cockpit dial (the dial is the battery's alone here), or nothing to dial. */
export function BatteryDial({
  battery,
  isDark,
}: {
  battery: DialView | undefined
  isDark: boolean
}) {
  return battery ? (
    <CockpitDial
      view={battery}
      icon={<CarBattery className="size-4" />}
      size="focus"
      glow={isDark}
      pulse={battery.charging}
      aligned={false}
      className="mt-3 mb-3 max-w-[300px]"
    />
  ) : (
    <NoData icon={<CarBattery className="size-4" />} label="Battery" />
  )
}
