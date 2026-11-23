import { Droplet, Thermometer } from 'lucide-react-native'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { TankCard } from '@/components/tanks/TankCard'
import { TemperatureCard } from '@/components/temperature/TemperatureCard'
import { TiltCard } from '@/components/start/StartCards'
import { EditableCards, type EditMode } from '@/components/editing/EditableCards'
import { usePageCards } from '@/components/editing/usePageCards'
import { EmptyState } from '@/components/ui'
import { useNow } from '@/hooks/useNow'
import { iconKey } from '@/lib/entityIcons'
import { sortTankIds } from '@renewvan/core/tank'
import { sensorLabel, sortedSensorIds } from '@/lib/temperature'
import { useTheme } from '@/theme'
import { isCompleteTank } from '@/types'

/** Drain/fill pace only needs minute resolution. */
const PACE_REFRESH_MS = 30_000

/** One card per tank, fresh first, then grey, then the rest by id, unless this phone rearranged them. */
export function TanksContent({ edit }: { edit: EditMode }) {
  const { colors } = useTheme()
  const { state, entityIcons } = useRenewvanBus()
  const { tanks } = state
  const now = useNow(PACE_REFRESH_MS)
  // MQTT builds a tank up one property per retained message; skip any id whose record hasn't
  // fully arrived yet (see `isCompleteTank`).
  const ids = sortTankIds(Object.keys(tanks).filter((id) => isCompleteTank(tanks[id])))
  const { shown, edit: editCards } = usePageCards('tanks', ids)
  if (ids.length === 0) {
    return (
      <EmptyState
        icon={<Droplet size={20} color={colors.muted} />}
        title="No tank data yet."
        detail="Waiting for readings from the Renewvan hub."
      />
    )
  }
  return (
    <EditableCards
      ids={shown}
      edit={edit}
      labelOf={(id) => tanks[id]?.name ?? id}
      onChange={(next) => editCards(shown, next)}
      settings="levels-page"
      renderCard={(id) => (
        <TankCard tank={tanks[id]} now={now} icon={entityIcons[iconKey('tank', id)]} />
      )}
    />
  )
}

/** One card per temperature sensor; a sensor hidden on this phone is still on the bus but gets no card. */
export function TemperatureContent({ edit }: { edit: EditMode }) {
  const { colors } = useTheme()
  const { state, entityIcons } = useRenewvanBus()
  const sensorIds = sortedSensorIds(state.temperatures)
  const { shown, edit: editCards } = usePageCards('temperature', sensorIds)
  if (sensorIds.length === 0) {
    return (
      <EmptyState
        icon={<Thermometer size={20} color={colors.muted} />}
        title="No temperature sensors yet."
        detail="Waiting for their driver to publish."
      />
    )
  }
  return (
    <EditableCards
      ids={shown}
      edit={edit}
      labelOf={(id) => sensorLabel(id, state.temperatures[id] ?? {})}
      onChange={(next) => editCards(shown, next)}
      settings="levels-page"
      renderCard={(id) => (
        <TemperatureCard
          id={id}
          sensor={state.temperatures[id]}
          icon={entityIcons[iconKey('temperature', id)]}
        />
      )}
    />
  )
}

/** The tilt sensor's card, which draws its own empty state. */
export function TiltContent() {
  const { state } = useRenewvanBus()
  return <TiltCard tilt={Object.values(state.tilt)[0]} stacked />
}
