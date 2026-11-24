import { Droplet, Thermometer } from 'lucide-react-native'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { NotReportingTankCard, TankCard } from '@/components/tanks/TankCard'
import { TemperatureCard } from '@/components/temperature/TemperatureCard'
import { VanTiltCard } from '@/components/start/StartCards'
import { EditableCards, type EditMode } from '@/components/editing/EditableCards'
import { usePageCards } from '@/components/editing/usePageCards'
import { EmptyState } from '@/components/ui'
import { useNow } from '@/hooks/useNow'
import { iconKey } from '@renewvan/core/icons'
import { sensorLabel } from '@renewvan/core/sensors'
import { useTheme } from '@/theme'

/** Drain/fill pace only needs minute resolution. */
const PACE_REFRESH_MS = 30_000

/**
 * One card per tank the bus knows, fresh first, then grey, then the rest by id, unless this phone
 * rearranged them. A tank that is not reporting keeps its card, which says so.
 */
export function TanksContent({ edit }: { edit: EditMode }) {
  const { colors } = useTheme()
  const { entityIcons } = useRenewvanBus()
  const tanks = Object.fromEntries(useLiveVan().instances.tank.map((tank) => [tank.id, tank]))
  const ids = Object.keys(tanks)
  const now = useNow(PACE_REFRESH_MS)
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
      labelOf={(id) => tanks[id]?.record.name ?? id}
      onChange={(next) => editCards(shown, next)}
      settings="levels-page"
      renderCard={(id) => {
        const tank = tanks[id]
        const icon = entityIcons[iconKey('tank', id)]
        return tank.state === 'reporting' ? (
          <TankCard tank={tank.record} now={now} icon={icon} />
        ) : (
          <NotReportingTankCard id={id} tank={tank.record} state={tank.state} icon={icon} />
        )
      }}
    />
  )
}

/** One card per temperature sensor; a sensor hidden on this phone is still on the bus but gets no card. */
export function TemperatureContent({ edit }: { edit: EditMode }) {
  const { colors } = useTheme()
  const { entityIcons } = useRenewvanBus()
  const sensors = useLiveVan().instances.temperature
  const temperatures = Object.fromEntries(sensors.map(({ id, record }) => [id, record]))
  const states = Object.fromEntries(sensors.map(({ id, state }) => [id, state]))
  const sensorIds = sensors.map(({ id }) => id)
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
      labelOf={(id) => sensorLabel(id, temperatures[id] ?? {})}
      onChange={(next) => editCards(shown, next)}
      settings="levels-page"
      renderCard={(id) => (
        <TemperatureCard
          id={id}
          sensor={temperatures[id]}
          state={states[id]}
          icon={entityIcons[iconKey('temperature', id)]}
        />
      )}
    />
  )
}

/** The tilt sensor's card, which draws its own empty state. */
export function TiltContent() {
  return <VanTiltCard stacked />
}
