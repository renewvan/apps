import { Move3d } from 'lucide-react'
import { PhoneCard } from '@/components/PhoneCard'
import { TiltWidget } from '@/components/widgets/tilt/TiltWidget'
import { useLiveVan } from '@/hooks/useLiveVan'

/** The van's tilt (one tilt device per van); dashes while there is none or its Driver is offline. */
export function TiltCard() {
  return (
    <PhoneCard title="Tilt" icon={<Move3d className="size-4" />}>
      <div className="h-28 w-full">
        <TiltWidget tilt={useLiveVan().tilt.record} />
      </div>
    </PhoneCard>
  )
}
