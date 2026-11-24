import type { LiveVan } from '@renewvan/core/van'
import type { RenewvanBus } from '@/hooks/useRenewvanBus'
import type { usePreferences } from '@/hooks/usePreferences'
import type { SettingsActions, SettingsData, SettingsPreferences } from './SettingsContext'

interface BuildSettingsInput {
  bus: RenewvanBus
  /** The Live van: the Driver rows, the router and the resolved relay groups come from it. */
  van: LiveVan
  /** What `App` holds besides the bus (see where each is built). */
  derived: Pick<
    SettingsData,
    'gps' | 'hub' | 'broker' | 'primaryBatterySelection' | 'unseenAlertCount'
  >
  preferences: ReturnType<typeof usePreferences>
  handlers: Pick<SettingsActions, 'openAlerts'>
  /** Dev only: set on the kiosk, where the navbar can be pinned. */
  navPin?: { pinned: boolean; onChange: (pinned: boolean) => void }
}

/**
 * The Settings context's three slices from where each field comes: the bus, the Live van and what
 * `App` holds (data), the stored preferences and the bus's own preference topics (preferences), and
 * every setter and command (actions). The slices are plain objects built each render;
 * `SettingsProvider` keeps each one's reference until a field in it changes.
 */
export function buildSettings({
  bus,
  van,
  derived,
  preferences,
  handlers,
  navPin,
}: BuildSettingsInput) {
  const { state } = bus
  // The raw records stay for the device and diagnostics views; what the Live van already resolved
  // (the Driver rows, the router, the relay groups) is taken from it rather than derived again.
  const data: SettingsData = {
    ...derived,
    drivers: van.drivers,
    router: van.router.record,
    routerHealth: van.router.health,
    routerUpdatedAt: van.router.updatedAt,
    tanks: state.tanks,
    temperatures: state.temperatures,
    relays: state.relays,
    relayGroups: van.relayGroups.assignments,
    relayGroupList: van.relayGroups.list,
    relayOrder: van.relayGroups.order,
    heaters: state.heaters,
    tilt: state.tilt,
    batteries: state.batteries,
    solar: state.solar,
    chargers: state.chargers,
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
