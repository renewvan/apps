import { CarBattery, Sun, Zap } from 'lucide-react-native'
import { Stack } from 'expo-router'
import { useMemo, type ReactNode } from 'react'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { ChargerCard } from '@/components/power/ChargerCard'
import { flowFromBus } from '@/components/power/flowModel'
import { EditableCards, useEditMode } from '@/components/editing/EditableCards'
import { usePageCards } from '@/components/editing/usePageCards'
import { ENERGY_CARD_LABELS, energyCards, type EnergyCard } from '@/components/power/sections'
import { PowerFlow } from '@/components/power/PowerFlow'
import { SOLAR_HISTORY_DAYS, SolarCard } from '@/components/power/SolarCard'
import { SourceLabel } from '@/components/power/SourceLabel'
import { batterySourceName } from '@/components/power/sourceName'
import { Screen } from '@/components/Screen'
import { batteryDial } from '@/components/start/batteryDial'
import { BatteryDial } from '@/components/start/CockpitDial'
import { EmptyState, NoData, TitledCard } from '@/components/ui'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useFirstSolarWithHistory } from '@/hooks/useSolarYieldHistory'
import { usePreferences } from '@/preferences/PreferencesProvider'
import { useTheme } from '@/theme'

/**
 * The Energy tab: the power flow and the battery's dial (Home's Energy widget, unfolded) when a
 * battery exists, the solar controller's harvest and every charger, as cards this phone can
 * reorder and hide (held, or in Settings › Energy). Which battery both read is the shared Primary battery choice on the bus, so it
 * agrees with the dashboard.
 */
export default function PowerTab() {
  const { colors } = useTheme()
  const { state, primaryBattery: selection } = useRenewvanBus()
  const { powerLayout } = usePreferences()
  const capabilities = useCapabilities()
  const { batteries, solar, chargers } = state
  const available = energyCards(capabilities)
  const loading = [capabilities.battery, capabilities.solar, capabilities.charger].some(
    (capability) => capability.state === 'loading',
  )
  const choice = selection ?? undefined
  const flow = useMemo(
    () => flowFromBus(batteries, solar, chargers, choice),
    [batteries, solar, chargers, choice],
  )
  const solarRecord = useFirstSolarWithHistory(solar, SOLAR_HISTORY_DAYS)
  const battery = batteryDial(batteries, colors, choice)
  const edit = useEditMode()
  const { shown, edit: editCards } = usePageCards('energy', available)

  if (available.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon={<Zap size={20} color={colors.muted} />}
          title={loading ? 'Loading energy…' : 'No energy devices on this van.'}
          detail={
            loading
              ? 'Looking for batteries, solar controllers and chargers.'
              : 'Battery, solar and charger readings appear here when their drivers are installed.'
          }
        />
      </Screen>
    )
  }

  const cards: Record<EnergyCard, () => ReactNode> = {
    power: () => (
      <TitledCard
        icon={<Zap size={16} color={colors.muted} />}
        title="Power"
        right={<SourceLabel name={batterySourceName(batteries, choice)} />}
      >
        {flow.nodes.battery.present ? (
          <PowerFlow flow={flow} layout={powerLayout} />
        ) : (
          <NoData icon={<Zap size={16} color={colors.muted} />} label="Power" />
        )}
      </TitledCard>
    ),
    battery: () => (
      <TitledCard
        icon={<CarBattery size={16} color={colors.muted} />}
        title="Battery"
        right={<SourceLabel name={batterySourceName(batteries, choice)} />}
      >
        {battery ? (
          <BatteryDial view={battery} />
        ) : (
          <NoData icon={<CarBattery size={16} color={colors.muted} />} label="Battery" />
        )}
      </TitledCard>
    ),
    solar: () => (
      <TitledCard icon={<Sun size={16} color={colors.muted} />} title="Solar production">
        {solarRecord ? (
          <SolarCard solar={solarRecord} />
        ) : (
          <NoData icon={<Sun size={16} color={colors.muted} />} label="Solar production" />
        )}
      </TitledCard>
    ),
    chargers: () => <ChargerCard chargers={chargers} />,
  }

  return (
    <Screen>
      <Stack.Screen options={edit.header} />
      <EditableCards
        ids={shown}
        edit={edit}
        labelOf={(id) => ENERGY_CARD_LABELS[id]}
        onChange={(next) => editCards(shown, next)}
        settings="power-page"
        renderCard={(id) => cards[id]()}
      />
    </Screen>
  )
}
