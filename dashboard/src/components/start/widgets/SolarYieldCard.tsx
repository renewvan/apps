import { Sun } from 'lucide-react'
import { PhoneCard } from '@/components/PhoneCard'
import { useFirstSolarWithHistory } from '@/hooks/useSolarYieldHistory'
import { useLiveVan } from '@/hooks/useLiveVan'
import { SolarCard } from '../SolarCard'

/** Days of harvest asked of the hub's history: the card charts the last 14. */
const SOLAR_HISTORY_DAYS = 14

/** The first solar controller's readings and harvest; draws nothing on a van without one. */
export function SolarYieldCard() {
  const record = useFirstSolarWithHistory(useLiveVan().firstSolar, SOLAR_HISTORY_DAYS)
  if (!record) return null
  return (
    <PhoneCard title="Solar production" icon={<Sun className="size-4" />}>
      <SolarCard solar={record} />
    </PhoneCard>
  )
}
