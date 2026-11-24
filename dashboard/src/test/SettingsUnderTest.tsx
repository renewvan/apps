import { useMemo } from 'react'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { CommandsContext } from '@/hooks/useCommands'
import { EntityIconsContext } from '@/hooks/useEntityIcon'
import { LiveVanContext, useLiveVanOf } from '@/hooks/useLiveVan'
import { RawBusContext, useRawBusValue } from '@/hooks/useRawBus'
import type { RenewvanBus } from '@/hooks/useRenewvanBus'
import type { BusFields, ShellFields } from './renderSettings'

interface SettingsUnderTestProps {
  bus: RenewvanBus
  router: Pick<BusFields, 'router' | 'routerHealth' | 'routerUpdatedAt'>
  shell: Partial<ShellFields>
}

/** The Settings page under the providers `App` gives it, built from a fake bus as `App` does. */
export function SettingsUnderTest({ bus, router, shell }: SettingsUnderTestProps) {
  const rawBus = useRawBusValue(bus)
  const builtVan = useLiveVanOf(bus)
  const van = useMemo(
    () => ({
      ...builtVan,
      router: {
        id: 'rut',
        record: router.router,
        health: router.routerHealth,
        updatedAt: router.routerUpdatedAt,
      },
    }),
    [builtVan, router.router, router.routerHealth, router.routerUpdatedAt],
  )
  return (
    <RawBusContext.Provider value={rawBus}>
      <CommandsContext.Provider value={bus.commands}>
        <LiveVanContext.Provider value={van}>
          <EntityIconsContext.Provider value={bus.entityIcons}>
            <SettingsPage
              unseenAlertCount={shell.unseenAlertCount ?? 0}
              onOpenAlerts={shell.openAlerts ?? (() => {})}
              navPinned={shell.navPinned}
              onNavPinnedChange={shell.setNavPinned}
            />
          </EntityIconsContext.Provider>
        </LiveVanContext.Provider>
      </CommandsContext.Provider>
    </RawBusContext.Provider>
  )
}
