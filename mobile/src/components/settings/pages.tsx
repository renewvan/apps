import { usePageCards } from '@/components/editing/usePageCards'
import { relayPanels } from '@/components/relays/RelayPanels'
import { ENERGY_CARD_LABELS, energyCards } from '@/components/power/sections'
import { useCapabilities } from '@/hooks/useCapabilities'
import { sortTankIds } from '@renewvan/core/tank'
import { sensorLabel, sortedSensorIds } from '@/lib/temperature'
import { usePreferences } from '@/preferences/PreferencesProvider'
import type { CardPage } from '@/preferences/cardLayout'
import { isCompleteTank } from '@/types'
import { CardList } from './CardList'
import { Empty, Group, Note } from './kit'
import { useSettingsData } from './useSettingsData'

// Each page's cards as this phone arranges them: the same edit as holding a card on the page, with
// the hidden ones listed too so they can come back. All of it stays on this phone.

const HOW =
  'Hold a grip and drag to reorder; drop a card above the line to show it, below to hide it. You can also hold a card on the page itself.'

/** One page's cards, in order, shown above the line and hidden below. */
export function PageCards<T extends string>({
  page,
  title,
  available,
  labelOf,
  none,
}: {
  page: CardPage
  title: string
  /** Every card the van has now, in the page's default order. */
  available: readonly T[]
  labelOf: (id: T) => string
  /** Said when the van has no such card. */
  none: string
}) {
  const { shown, edit } = usePageCards(page, available)
  return (
    <Group title={title}>
      {available.length === 0 ? (
        <Empty>{none}</Empty>
      ) : (
        <CardList
          layout={shown}
          widgets={available}
          labelOf={labelOf}
          onChange={(next) => edit(available, next)}
        />
      )}
    </Group>
  )
}

/** The Energy tab's cards. */
export function EnergyCardsGroup() {
  const capabilities = useCapabilities()
  return (
    <PageCards
      page="energy"
      title="Cards"
      available={energyCards(capabilities)}
      labelOf={(id) => ENERGY_CARD_LABELS[id]}
      none="No energy devices on this van."
    />
  )
}

/** Levels: the tanks and the temperature sensors, each in their own order. */
export function LevelsPageView() {
  const { state } = useSettingsData()
  const { tanks, temperatures } = state
  const tankIds = sortTankIds(Object.keys(tanks).filter((id) => isCompleteTank(tanks[id])))
  return (
    <>
      <Note>{HOW}</Note>
      <PageCards
        page="tanks"
        title="Tanks"
        available={tankIds}
        labelOf={(id) => tanks[id]?.name ?? id}
        none="No tanks found."
      />
      <PageCards
        page="temperature"
        title="Temperature"
        available={sortedSensorIds(temperatures)}
        labelOf={(id) => sensorLabel(id, temperatures[id] ?? {})}
        none="No temperature sensors found."
      />
      <Note>A hidden sensor is still read and logged; it just gets no card on this phone.</Note>
    </>
  )
}

/** The Controls tab's panels on this phone; the groups themselves are shared, below. */
export function ControlsOrderGroup() {
  const { state, relayGroups, groupList, relayOrder } = useSettingsData()
  const panels = relayPanels({
    relays: state.relays,
    groups: relayGroups,
    groupList,
    order: relayOrder,
  })
  return (
    <PageCards
      page="controls"
      title="On this phone"
      available={panels.map((panel) => panel.title)}
      labelOf={(title) => title}
      none="No relays found."
    />
  )
}

/** The Climate tab's heaters. */
export function ClimatePageView() {
  const { state } = useSettingsData()
  const { pageLayouts } = usePreferences()
  const heaterIds = Object.keys(state.heaters).sort()
  return (
    <>
      <Note>{HOW}</Note>
      <PageCards
        page="climate"
        title="Heaters"
        available={heaterIds}
        labelOf={(id) => state.heaters[id]?.name ?? id}
        none="No heaters found."
      />
      {pageLayouts.climate === undefined ? null : (
        <Note>
          A hidden heater keeps running as it was set; only its card is gone from this phone.
        </Note>
      )}
    </>
  )
}
