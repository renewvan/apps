import { ToggleLeft } from 'lucide-react-native'
import { reservedRelayIds } from '@renewvan/core/winterMode'
import { useCommands } from '@/bus/commands'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { EditableCards, type EditMode } from '@/components/editing/EditableCards'
import { usePageCards } from '@/components/editing/usePageCards'
import { NoData, TitledCard } from '@/components/ui'
import { useTheme } from '@/theme'
import { HubPowerCard } from './HubPowerCard'
import {
  RELAY_PANEL_RADIUS,
  RelayBanner,
  RelayPanelCard,
  relayPanels,
  useRelayControls,
} from './RelayPanels'

/**
 * The Controls tab's cards: one panel per shared relay group, then the Hub power card. Hub power
 * is never a switch in a group (hub ADR 0033): it has its own card, last and fixed, outside the
 * panels this phone arranges.
 */
export function ControlsContent({ edit }: { edit: EditMode }) {
  const { colors } = useTheme()
  const { entityIcons } = useRenewvanBus()
  const { relays, relayTrust, relayGroups, hubPower } = useLiveVan()
  const { setRelay, startWinterMode } = useCommands()
  const { driverOnline, demo: demoMode } = relayTrust
  const controls = useRelayControls({
    relays,
    driverOnline,
    demo: demoMode,
    onSetRelay: setRelay,
  })
  const panels = relayPanels({
    relays,
    groups: relayGroups.assignments,
    groupList: relayGroups.list,
    order: relayGroups.order,
    reserved: reservedRelayIds(hubPower),
  })
  const { shown, edit: editCards } = usePageCards(
    'controls',
    panels.map((panel) => panel.title),
  )

  if (panels.length === 0 && hubPower.kind === 'none') {
    return (
      <TitledCard icon={<ToggleLeft size={16} color={colors.muted} />} title="Relays">
        <NoData icon={<ToggleLeft size={16} color={colors.muted} />} label="Relays" />
      </TitledCard>
    )
  }

  return (
    <>
      <RelayBanner demo={demoMode} driverOnline={driverOnline} />
      <EditableCards
        ids={shown}
        edit={edit}
        labelOf={(title) => title}
        onChange={(next) => editCards(shown, next)}
        corners={RELAY_PANEL_RADIUS}
        settings="relays-page"
        renderCard={(title) => {
          const panel = panels.find((p) => p.title === title)
          return panel ? (
            <RelayPanelCard panel={panel} relays={relays} icons={entityIcons} controls={controls} />
          ) : null
        }}
      />
      <HubPowerCard onStartWinterMode={startWinterMode} onSetRelay={controls.request} />
    </>
  )
}
