import { routerHealthOf } from '@renewvan/core'
import type { RenewvanBus } from '@/hooks/useRenewvanBus'
import type { usePreferences } from '@/hooks/usePreferences'
import type { DriverRow } from '@/lib/drivers'
import type { SettingsActions, SettingsData, SettingsPreferences } from './SettingsContext'

interface BuildSettingsInput {
  bus: RenewvanBus
  /** What `App` derives from the bus (see where each is built). */
  derived: Pick<
    SettingsData,
    | 'drivers'
    | 'gps'
    | 'router'
    | 'routerUpdatedAt'
    | 'hub'
    | 'broker'
    | 'primaryBatterySelection'
    | 'unseenAlertCount'
  > & { drivers: DriverRow[] }
  /** `resolvedRelayGroups(bus.relayGroupList ?? DEFAULT_RELAY_GROUP_LIST)`, content-stable in `App`. */
  resolvedRelayGroupList: string[]
  preferences: ReturnType<typeof usePreferences>
  handlers: Pick<SettingsActions, 'openAlerts'>
  /** Dev only: set on the kiosk, where the navbar can be pinned. */
  navPin?: { pinned: boolean; onChange: (pinned: boolean) => void }
}

/**
 * The Settings context's three slices from where each field comes: the bus and what `App` derives
 * from it (data), the stored preferences and the bus's own preference topics (preferences), and
 * every setter and command (actions). The slices are plain objects built each render;
 * `SettingsProvider` keeps each one's reference until a field in it changes.
 */
export function buildSettings({
  bus,
  resolvedRelayGroupList,
  derived,
  preferences,
  handlers,
  navPin,
}: BuildSettingsInput) {
  const { state } = bus
  const data: SettingsData = {
    ...derived,
    tanks: state.tanks,
    temperatures: state.temperatures,
    relays: state.relays,
    relayGroups: bus.relayGroups,
    relayGroupList: resolvedRelayGroupList,
    relayOrder: bus.relayOrder,
    heaters: state.heaters,
    tilt: state.tilt,
    batteries: state.batteries,
    solar: state.solar,
    chargers: state.chargers,
    routerHealth: routerHealthOf(state),
    busStatus: bus.status,
    tailscale: bus.tailscale,
    hubStatus: bus.hubStatus,
    displayPower: bus.kiosk.power,
  }
  const prefs: SettingsPreferences = {
    ...preferences.preferences,
    brightness: bus.kiosk.brightness,
    autoSleepEnabled: bus.kiosk.autoSleepEnabled,
    autoSleepTimeoutMinutes: bus.kiosk.autoSleepTimeoutMinutes,
    demoMode: bus.demoMode,
    ...(navPin && { navPinned: navPin.pinned }),
  }
  const actions: SettingsActions = {
    ...preferences.actions,
    ...bus.commands,
    ...handlers,
    ...(navPin && { setNavPinned: navPin.onChange }),
  }
  return { data, preferences: prefs, actions }
}
