import { useCommands } from '@/bus/commands'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { AUTO_PRIMARY_BATTERY } from '@renewvan/core/power'

/**
 * What every Settings view reads: the van on the bus (its raw records, for the device and
 * diagnostics views), what the Live van already resolved from it (the Driver rows, the router, the
 * relay groups), the shared hub settings in the shape the dashboard's Settings uses, and the
 * commands that change them.
 */
export function useSettingsData() {
  const bus = useRenewvanBus()
  const commands = useCommands()
  const { drivers, relayGroups, router } = useLiveVan()
  return {
    ...bus,
    commands,
    /** One row per Driver, then one fallback row per entity type no Driver claims. */
    drivers,
    /** The list of relay groups on offer, in display order, with Unassigned in it. */
    groupList: relayGroups.list,
    /** `auto` or a battery instance id. */
    primaryBatterySelection: bus.primaryBattery ?? AUTO_PRIMARY_BATTERY,
    router: router.record,
    routerUpdatedAt: router.updatedAt,
    routerHealth: router.health,
  }
}

export type SettingsData = ReturnType<typeof useSettingsData>
