import { Stack } from 'expo-router'
import { Heater as HeaterIcon } from 'lucide-react-native'
import { useCommands } from '@/bus/commands'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { EditableCards, useEditMode } from '@/components/editing/EditableCards'
import { usePageCards } from '@/components/editing/usePageCards'
import { HeaterCard } from '@/components/heater/HeaterCard'
import { Screen } from '@/components/Screen'
import { Banner, EmptyState, NoData, TitledCard } from '@/components/ui'
import { useCapabilities } from '@/hooks/useCapabilities'
import { heaterDriversOnline } from '@renewvan/core/drivers'
import { useTheme } from '@/theme'

/**
 * The Climate tab: every heater on the bus, frozen in Demo mode or while its driver is offline, in
 * the order this phone keeps (held, or in Settings › Climate).
 */
export default function ClimateTab() {
  const { colors } = useTheme()
  const { state, demoMode } = useRenewvanBus()
  const commands = useCommands()
  const capability = useCapabilities().heater
  const heaterIds = Object.keys(state.heaters).sort()
  const driverOnline = heaterDriversOnline(state)
  const edit = useEditMode()
  const { shown, edit: editCards } = usePageCards('climate', heaterIds)

  if (capability.state !== 'present') {
    const loading = capability.state === 'loading'
    return (
      <Screen>
        <EmptyState
          icon={<HeaterIcon size={20} color={colors.muted} />}
          title={loading ? 'Loading the heater…' : 'No heater on this van.'}
          detail={
            loading
              ? 'Looking for a heater.'
              : 'Heater controls appear here when its driver is installed.'
          }
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <Stack.Screen options={edit.header} />
      {demoMode ? (
        <Banner>Demo mode: controls are disabled.</Banner>
      ) : !driverOnline ? (
        <Banner>
          The heater driver is not online. The heater is unknown and its controls are disabled.
        </Banner>
      ) : null}
      {heaterIds.length === 0 ? (
        <TitledCard icon={<HeaterIcon size={16} color={colors.muted} />} title="Heater">
          <NoData icon={<HeaterIcon size={16} color={colors.muted} />} label="Heater" />
        </TitledCard>
      ) : (
        <EditableCards
          ids={shown}
          edit={edit}
          labelOf={(id) => state.heaters[id]?.name ?? id}
          onChange={(next) => editCards(shown, next)}
          settings="climate-page"
          renderCard={(id) => (
            <HeaterCard
              id={id}
              heater={state.heaters[id]}
              frozen={demoMode || !driverOnline}
              commands={commands}
            />
          )}
        />
      )}
    </Screen>
  )
}
