import { CloudSun } from 'lucide-react-native'
import { WeatherWidget } from '@/components/widgets/weather/WeatherWidget'
import { MutedIcon, TitledCard } from '@/components/ui'
import type { LiveVan } from '@renewvan/core/van'
import { hasGpsFix, type TemperatureSensor } from '@/types'

/** The weather where the van is: looked up at the Live van's GPS record while it has a position. */
export function WeatherCard({
  gps,
  temperatures,
}: {
  gps: LiveVan['gps']
  temperatures: Record<string, Partial<TemperatureSensor>>
}) {
  const fix = gps && hasGpsFix(gps.record) ? gps.record : undefined
  return (
    <TitledCard icon={<MutedIcon icon={CloudSun} />} title="Weather">
      <WeatherWidget lat={fix?.latitude} lon={fix?.longitude} temperatures={temperatures} />
    </TitledCard>
  )
}
