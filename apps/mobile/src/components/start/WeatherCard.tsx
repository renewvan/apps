import { CloudSun } from 'lucide-react-native'
import { WeatherWidget } from '@/components/widgets/weather/WeatherWidget'
import { MutedIcon, TitledCard } from '@/components/ui'
import { hasGpsFix, isCompleteGps, type Gps, type TemperatureSensor } from '@/types'

/** The weather where the van is: looked up at the first GPS record with a plottable position. */
export function WeatherCard({
  gps,
  temperatures,
}: {
  gps: Record<string, Partial<Gps>>
  temperatures: Record<string, Partial<TemperatureSensor>>
}) {
  const fix = Object.values(gps).find((g): g is Gps => isCompleteGps(g) && hasGpsFix(g))
  return (
    <TitledCard icon={<MutedIcon icon={CloudSun} />} title="Weather">
      <WeatherWidget lat={fix?.latitude} lon={fix?.longitude} temperatures={temperatures} />
    </TitledCard>
  )
}
