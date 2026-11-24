import { CloudSun } from 'lucide-react'
import { PhoneCard } from '@/components/PhoneCard'
import { WeatherWidget } from '@/components/widgets/weather/WeatherWidget'
import { useLiveVan } from '@/hooks/useLiveVan'
import { hasGpsFix } from '@/types'

/** The weather where the van is: looked up at the GPS record while it has a plottable position. */
export function WeatherCard() {
  const { gps, temperatures } = useLiveVan()
  const fix = gps && hasGpsFix(gps.record) ? gps.record : undefined
  return (
    <PhoneCard title="Weather" icon={<CloudSun className="size-4" />}>
      <div className="h-30 w-full">
        <WeatherWidget lat={fix?.latitude} lon={fix?.longitude} temperatures={temperatures} />
      </div>
    </PhoneCard>
  )
}
