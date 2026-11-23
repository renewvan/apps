import { Stack } from 'expo-router'
import { ToggleLeft } from 'lucide-react-native'
import { useCommands } from '@/bus/commands'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { EditableCards, useEditMode } from '@/components/editing/EditableCards'
import { usePageCards } from '@/components/editing/usePageCards'
import {
  RELAY_PANEL_RADIUS,
  RelayBanner,
  RelayPanelCard,
  relayPanels,
  useRelayControls,
} from '@/components/relays/RelayPanels'
import { Screen } from '@/components/Screen'
import { EmptyState, NoData, TitledCard } from '@/components/ui'
import { useCapabilities } from '@/hooks/useCapabilities'
import { relayDriversOnline } from '@/lib/drivers'
import { useTheme } from '@/theme'

/**
 * The Controls tab: every relay channel on the bus, in the shared groups set in Settings. Which
 * groups there are and what is in them is shared with the dashboard; the order of the panels, and
 * which of them this phone shows, is the phone's own (held, or in Settings › Controls).
 */
export default function ControlsTab() {
  const { colors } = useTheme()
  const { state, demoMode, relayGroups, relayGroupList, relayOrder, entityIcons } = useRenewvanBus()
  const { setRelay } = useCommands()
  const capability = useCapabilities().relay
  const driverOnline = relayDriversOnline(state)
  const controls = useRelayControls({
    relays: state.relays,
    driverOnline,
    demo: demoMode,
    onSetRelay: setRelay,
  })
  const panels = relayPanels({
    relays: state.relays,
    groups: relayGroups,
    groupList: relayGroupList ?? undefined,
    order: relayOrder,
  })
  const edit = useEditMode()
  const { shown, edit: editCards } = usePageCards(
    'controls',
    panels.map((panel) => panel.title),
  )

  if (capability.state !== 'present') {
    const loading = capability.state === 'loading'
    return (
      <Screen>
        <EmptyState
          icon={<ToggleLeft size={20} color={colors.muted} />}
          title={loading ? 'Loading controls…' : 'No controls on this van.'}
          detail={
            loading
              ? 'Looking for relays.'
              : 'Relay controls appear here when their drivers are installed.'
          }
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={edit.header} />
      {panels.length === 0 ? (
        <TitledCard icon={<ToggleLeft size={16} color={colors.muted} />} title="Relays">
          <NoData icon={<ToggleLeft size={16} color={colors.muted} />} label="Relays" />
        </TitledCard>
      ) : (
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
                <RelayPanelCard
                  panel={panel}
                  relays={state.relays}
                  icons={entityIcons}
                  controls={controls}
                />
              ) : null
            }}
          />
        </>
      )}
    </Screen>
  )
}
