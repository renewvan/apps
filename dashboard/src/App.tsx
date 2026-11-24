import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Droplet, Gauge, Heater, Map, Settings, Thermometer, ToggleLeft, Zap } from 'lucide-react'
import { Tabs } from '@heroui/react'
import lockupLight from '@renewvan/brand/svg/renewvan-lockup-light.svg'
import lockupDark from '@renewvan/brand/svg/renewvan-lockup-dark.svg'
import { cn } from '@/lib/utils'
import { Clock } from '@/components/Clock'
import { HeaderMenu } from '@/components/HeaderMenu'
import { LogoLink } from '@/components/LogoLink'
import { DrawerMenuControls, DrawerMenuFooter } from '@/components/DrawerMenuContent'
import { DisplaySleepButton } from '@/components/DisplaySleepButton'
import { AlertsButton } from '@/components/AlertsButton'
import { devFlagOn } from '@/lib/devFlags'
import { useLocalHeater } from '@/hooks/useLocalHeater'
import { DemoBadge } from '@/components/DemoBadge'
import { UplinkStatusButton } from '@/components/UplinkStatusButton'
import { HubUnreachableBanner } from '@/components/HubUnreachableBanner'
import { isKioskHost, useHubUnreachable } from '@/hooks/useHubUnreachable'
import { Sidebar, type NavItem } from '@/components/Sidebar'
import { PageErrorBoundary } from '@/components/PageErrorBoundary'
import { StubPane } from '@/components/StubPane'
import { AlertsPage } from '@/components/alerts/AlertsPage'
import { SettingsProvider } from '@/components/settings/SettingsProvider'
import { SettingsPage } from '@/components/settings/SettingsPage'
import type { SettingsSubView } from '@/components/settings/views'
import { TanksPage } from '@/components/tanks/TanksPage'
import { TemperaturePage } from '@/components/temperature/TemperaturePage'
import { RelaysPage } from '@/components/relays/RelaysPage'
import { HeaterPage, type HeaterPageProps } from '@/components/heater/HeaterPage'
import { StartPage } from '@/components/start/StartPage'
import { PowerPage } from '@/components/power/PowerPage'
import { useAlertToasts } from '@/hooks/useAlertToasts'
import { useAlertHistory } from '@/hooks/useAlertHistory'
import { EntityIconsContext } from '@/hooks/useEntityIcon'
import { instanceKey } from '@renewvan/core/drivers'
import { useIsMobile } from '@/hooks/use-media-query'
import { useUnseenAlertCount } from '@/hooks/useUnseenAlertCount'
import { useRenewvanBus } from '@/hooks/useRenewvanBus'
import { LiveVanContext, useLiveVanOf } from '@/hooks/useLiveVan'
import { AUTO_PRIMARY_BATTERY } from '@renewvan/core/power'
import type { Trust } from '@renewvan/core/van'
import { useContentStable, useStableCallback } from '@/hooks/useStable'
import { useHeaderHeightVar, useShellLayout } from '@/hooks/useShellLayout'
import { BottomNavBar } from '@/components/BottomNavBar'
import { resolveMapIsDark } from '@/hooks/useMapTheme'
import { usePreferences } from '@/hooks/usePreferences'
import { useResolvedTheme } from '@/hooks/useTheme'
import { buildSettings } from '@/components/settings/buildSettings'
import { useUrlPage } from '@/hooks/useUrlPage'
import { useHubAddress } from '@/hooks/useHubAddress'
import { useBrokerLink } from '@/hooks/useBrokerLink'
import { ShellHeaderContext } from '@/components/settings/ShellHeaderContext'

// MapLibre is most of the bundle and only the Map page uses it, so that page loads on first visit
// instead of with every other page. `MapPage` is a named export, which `lazy` needs as a default.
const MapPage = lazy(() => import('@/components/map/MapPage').then((m) => ({ default: m.MapPage })))

/** What the Map pane shows for the moment its chunk loads: a quiet pane until the map itself can draw. */
function MapLoading() {
  return (
    <section
      data-testid="pane-map-loading"
      aria-busy="true"
      className="flex min-h-0 flex-1 items-center justify-center"
    >
      <span className="text-muted text-sm">Loading map…</span>
    </section>
  )
}

/** The dev-only local heater: always reachable, never in Demo mode (hub ADR 0021 is the real one's). */
const LOCAL_HEATER_TRUST: Trust = { driverOnline: true, demo: false, controllable: true }

const NAV_ITEMS: NavItem[] = [
  { id: 'start', label: 'Start', icon: <Gauge className="size-5" /> },
  { id: 'power', label: 'Power', icon: <Zap className="size-5" /> },
  { id: 'tanks', label: 'Tanks', icon: <Droplet className="size-5" /> },
  {
    id: 'temperature',
    label: 'Temperature',
    short: 'Temp',
    icon: <Thermometer className="size-5" />,
  },
  { id: 'map', label: 'Map', icon: <Map className="size-5" /> },
  { id: 'switches', label: 'Relays', icon: <ToggleLeft className="size-5" /> },
  { id: 'heater', label: 'Heater', icon: <Heater className="size-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="size-5" /> },
]

// Reachable via the header's `AlertsButton` + `?page=alerts` deep link
// only — deliberately excluded from `NAV_ITEMS`/`Sidebar` per explicit
// request, so `useUrlPage` needs its own superset of valid ids.
const PAGE_IDS = [...NAV_ITEMS.map((item) => item.id), 'alerts']

function App() {
  const bus = useRenewvanBus()
  const {
    state,
    status,
    kiosk,
    tailscale,
    hubStatus,
    primaryBattery,
    entityIcons,
    demoMode,
    commands,
  } = bus
  const { setDemoMode, setKioskDisplayPower } = commands
  // The van every page draws, built once per bus change.
  const busVan = useLiveVanOf(bus)
  // No retained choice yet (or one that is not a string) reads as Auto. Only Settings › Primary
  // battery shows the choice itself; every page reads the battery it resolves to (`primaryBattery`).
  const primaryBatterySelection = primaryBattery ?? AUTO_PRIMARY_BATTERY
  const prefs = usePreferences()
  const {
    theme,
    navbarPosition,
    mapTheme,
    hiddenTemperatures,
    alertsEnabled,
    startPowerSources,
    startLayout,
    startView,
    startTiles,
    powerLayout,
    van,
  } = prefs.preferences
  const { setTheme } = prefs.actions
  // `theme` is the choice, which may be System; the logo, the map and the drawer need the look drawn.
  const resolvedTheme = useResolvedTheme(theme)
  const alertHistory = useAlertHistory()
  const hub = useHubAddress(hubStatus)
  const broker = useBrokerLink()
  // Phone or laptop, hub unreachable for a while: offer the wake page (never on the kiosk or in Demo mode).
  const hubUnreachable = useHubUnreachable(status, !demoMode && !isKioskHost())
  // `?flag.demo=1` (dev builds) turns Demo mode on once, as soon as the bus is connected.
  const demoFlagApplied = useRef(false)
  useEffect(() => {
    if (status !== 'connected' || demoFlagApplied.current) return
    demoFlagApplied.current = true
    if (devFlagOn('demo')) setDemoMode(true)
  }, [status, setDemoMode])
  // Dev builds only: `?flag.heater-dev=1` swaps the Heater page's heater for a local one that needs
  // neither the hub nor Demo mode (Demo's heater is read-only, hub ADR 0021).
  const localHeaterOn = devFlagOn('heater-dev')
  const localHeater = useLocalHeater(localHeaterOn)
  // With the local heater on, the Live van's heater slice is that heater's: the Heater page and the
  // Start page's Heater widget read it like any other.
  const liveVan = useMemo(
    () =>
      localHeaterOn
        ? { ...busVan, heaters: localHeater.heaters, heaterTrust: LOCAL_HEATER_TRUST }
        : busVan,
    [busVan, localHeaterOn, localHeater.heaters],
  )
  useAlertToasts({
    tanks: state.tanks,
    status,
    tailscale,
    enabled: alertsEnabled,
    demo: demoMode,
    starterLow: liveVan.starterBattery?.low ?? false,
  })
  const [activePage, setActivePage] = useUrlPage(PAGE_IDS, 'start')
  // A view (and the tank it shows) belongs to the Settings page: any other page change leaves
  // both behind (one entry).
  const goToPage = (id: string) =>
    setActivePage(id, { view: null, tank: null, widget: null, instance: null, driver: null })
  // One history entry for page and view together, so Back returns to the previous page.
  const openSettings = (view: SettingsSubView) =>
    setActivePage('settings', { view, tank: null, widget: null, instance: null, driver: null })
  // The tank's Configure button: Settings › Drivers › Tanks › <tank>, page, view and tank in one entry.
  const openTankSettings = (tankId: string) =>
    setActivePage('settings', { view: 'tank', tank: tankId, instance: null, driver: null })
  // A power-flow source's tap: Settings › Devices › <type> › <device>, page, view and instance in one entry.
  const openInstanceSettings = (key: string) =>
    setActivePage('settings', {
      view: 'instance',
      instance: key,
      tank: null,
      widget: null,
      driver: null,
    })
  const unseenAlertCount = useUnseenAlertCount(activePage)
  const isMobile = useIsMobile()
  // Derived at render and never written: the stored kiosk choice survives a phone visit.
  const {
    isBottomBar,
    navPinned,
    setNavPinned,
    navHidden,
    insetMotion,
    panelClass,
    navbarInsetStyle,
  } = useShellLayout(isMobile, navbarPosition)
  // A page (the Settings subpage) can ask the shell to hide its header, because it shows its own
  // navigation bar in that place.
  const [headerHidden, setHeaderHidden] = useState(false)
  const headerRef = useHeaderHeightVar()
  // The GPS record (every satellite's signal, a fresh object every poll, ~3s) is kept by its content
  // for Settings › Devices › GPS: the Settings context, and the whole memoised Settings tree,
  // re-render only when a value changes.
  const gps = useContentStable(state.gps)

  // The Heater page and the Start page's Heater widget share one heater and one set of commands.
  const heaterProps: HeaterPageProps = {
    localModes: localHeaterOn
      ? {
          mode: localHeater.operating,
          onChange: localHeater.setOperatingMode,
          timer: {
            kind: localHeater.timerKind,
            minutes: localHeater.timerMinutes,
            endsAt: localHeater.endsAt,
            onChange: localHeater.setTimerMinutes,
            onKindChange: localHeater.setTimerKind,
          },
        }
      : undefined,
    onSetRunning: localHeaterOn ? localHeater.setRunning : commands.setHeaterRunning,
    onSetMode: localHeaterOn ? localHeater.setMode : commands.setHeaterMode,
    // The local heater owns every mode through `localModes`, so it never reaches this.
    onSetVentilating: localHeaterOn ? () => {} : commands.setHeaterVentilating,
    onSetThermostat: localHeaterOn ? () => {} : commands.setHeaterThermostat,
    onSetSetpoint: localHeaterOn ? localHeater.setSetpoint : commands.setHeaterSetpoint,
    onSetPowerLevel: localHeaterOn ? localHeater.setPowerLevel : commands.setHeaterPowerLevel,
    onSetCommandsEnabled: localHeaterOn
      ? localHeater.setCommandsEnabled
      : commands.setHeaterCommandsEnabled,
  }

  // The Settings nav bar's bell: stable like the Commands, so the settings value only changes
  // when a field does. `goToPage` closes over `setActivePage`, recreated each render.
  const openAlerts = useStableCallback(() => goToPage('alerts'))
  const settings = buildSettings({
    bus,
    van: liveVan,
    derived: {
      gps,
      hub,
      broker,
      primaryBatterySelection,
      unseenAlertCount,
    },
    preferences: prefs,
    handlers: { openAlerts },
    navPin:
      import.meta.env.DEV && !isMobile ? { pinned: navPinned, onChange: setNavPinned } : undefined,
  })

  const demoBadge = demoMode && <DemoBadge onPress={() => setDemoMode(false)} />

  const uplinkProps = {
    tailscale,
    busStatus: status,
    hub,
    onOpenSettings: () => openSettings('connectivity'),
  }

  // The kiosk header: a row of icon buttons.
  const headerControls = (
    <>
      {demoBadge}
      <UplinkStatusButton {...uplinkProps} />
      <AlertsButton
        onClick={() => goToPage('alerts')}
        count={unseenAlertCount}
        active={activePage === 'alerts'}
      />
    </>
  )

  const logo = resolvedTheme === 'dark' ? lockupDark : lockupLight

  // The drawer's header row: the logo, linked to Start, beside the close control.
  const menuLogo = (close: () => void) => (
    <LogoLink
      src={logo}
      onNavigate={() => {
        close()
        goToPage('start')
      }}
    />
  )

  const menuControls = (close: () => void) => (
    <DrawerMenuControls
      close={close}
      activePage={activePage}
      onGoToPage={goToPage}
      onOpenVan={() => openSettings('van')}
      onOpenWidgets={() => openSettings('widgets')}
    />
  )

  const menuFooter = (close: () => void) => (
    <DrawerMenuFooter
      close={close}
      uplink={uplinkProps}
      theme={resolvedTheme}
      onThemeChange={setTheme}
      displayPower={kiosk.power}
      onSetPower={setKioskDisplayPower}
    />
  )

  // The Map runs under its header, so there the header floats over it: out of the layout, with no
  // surface or border, only a soft scrim fading out below it so the logo and icons stay readable on
  // any tile. Everywhere else it is a bar above the page.
  const floatingHeader = activePage === 'map' && !headerHidden
  // The rail spans the full height of the app (header included), so while it is up the kiosk header
  // pads itself clear of it, which pushes the logo to the right; the pages do the same for their edge.
  const header = (
    <header
      ref={headerRef}
      className={cn(
        isMobile
          ? 'flex items-center justify-between px-4 py-2'
          : 'grid grid-cols-[1fr_auto_1fr] items-center py-2 pr-4 pl-[calc(1rem+var(--navbar-inset-left))]',
        floatingHeader
          ? 'pointer-events-none absolute inset-x-0 top-0 z-20 bg-linear-to-b from-black/50 to-transparent [&>*]:pointer-events-auto'
          : 'shrink-0',
        insetMotion,
        isMobile && !floatingHeader && 'bg-surface border-border border-b',
        headerHidden && 'hidden',
      )}
    >
      {isMobile && (
        <HeaderMenu logo={menuLogo} footer={menuFooter}>
          {menuControls}
        </HeaderMenu>
      )}
      <LogoLink
        src={logo}
        className={!isMobile ? 'justify-self-start' : undefined}
        onNavigate={() => goToPage('start')}
      />
      {!isMobile && <Clock />}
      {isMobile ? (
        <div className="flex items-center gap-1.5">
          {demoBadge}
          <AlertsButton
            onClick={() => goToPage('alerts')}
            count={unseenAlertCount}
            active={activePage === 'alerts'}
          />
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1.5">
          {headerControls}
          <DisplaySleepButton displayPower={kiosk.power} onSetPower={setKioskDisplayPower} />
        </div>
      )}
    </header>
  )

  // One page per nav item; one that is not built yet shows a stub.
  const renderPage = (item: NavItem) => {
    switch (item.id) {
      case 'start':
        return (
          <StartPage
            powerSources={startPowerSources}
            powerLayout={powerLayout}
            layout={startLayout}
            view={startView}
            tiles={startTiles}
            isDark={resolvedTheme === 'dark'}
            mapIsDark={resolveMapIsDark(mapTheme, resolvedTheme === 'dark')}
            vanColor={van.color}
            onConfigureTank={openTankSettings}
            onOpenInstance={openInstanceSettings}
            heater={heaterProps}
          />
        )
      case 'power':
        return <PowerPage layout={powerLayout} onOpenInstance={openInstanceSettings} />
      case 'tanks':
        return <TanksPage onConfigure={openTankSettings} />
      case 'temperature':
        return (
          <TemperaturePage
            hidden={hiddenTemperatures}
            onOpenTemperature={(id) => openInstanceSettings(instanceKey('temperature', id))}
          />
        )
      case 'map':
        // MapLibre is most of the bundle and only this page needs it, so it loads on first visit.
        return (
          <Suspense fallback={<MapLoading />}>
            <MapPage
              isDark={resolveMapIsDark(mapTheme, resolvedTheme === 'dark')}
              vanColor={van.color}
            />
          </Suspense>
        )
      case 'switches':
        return <RelaysPage onSetRelay={commands.setRelay} />
      case 'heater':
        return <HeaterPage {...heaterProps} />
      case 'settings':
        return (
          <SettingsProvider {...settings}>
            <SettingsPage />
          </SettingsProvider>
        )
      default:
        return <StubPane id={item.id} title={item.label} icon={item.icon} />
    }
  }

  const panels = (
    <>
      {NAV_ITEMS.map((item) => (
        <Tabs.Panel key={item.id} id={item.id} className={panelClass}>
          <PageErrorBoundary name={item.id}>{renderPage(item)}</PageErrorBoundary>
        </Tabs.Panel>
      ))}
      <Tabs.Panel id="alerts" className={panelClass}>
        <PageErrorBoundary name="alerts">
          <AlertsPage
            entries={alertHistory.entries}
            onRemove={alertHistory.remove}
            onRemoveMany={alertHistory.removeMany}
          />
        </PageErrorBoundary>
      </Tabs.Panel>
    </>
  )

  return (
    <LiveVanContext.Provider value={liveVan}>
      <EntityIconsContext.Provider value={entityIcons}>
        <ShellHeaderContext.Provider value={setHeaderHidden}>
          <div className="bg-background text-foreground flex h-svh flex-col overflow-hidden">
            {/* One `Tabs` root holds the header, the nav and the panes, so the left rail can span the
          full height of the app. The nav precedes the panes in the DOM (React Aria warns when a
          tab panel renders before its tab list). On the kiosk the nav, rail or bar, is an
          absolutely positioned, translucent, auto-hiding overlay that never pushes the panes;
          the root publishes how much of their edge it covers (`navbarInsetStyle`) and the header
          and any page that must not run under it pad themselves by that. Phone: `Sidebar`'s own
          bottom bar, moved below the panes by its `order-last`. Keyed by layout: HeroUI's sliding
          indicator measures its tab once and does not re-measure when the list swaps between the
          rail and a bar under the same root. */}
            <Tabs
              key={isMobile ? 'phone' : navbarPosition}
              selectedKey={activePage}
              onSelectionChange={(key) => goToPage(String(key))}
              orientation={isMobile || isBottomBar ? 'horizontal' : 'vertical'}
              style={navbarInsetStyle}
              className={cn('min-h-0 flex-1 gap-0!', !isMobile && 'relative overflow-hidden')}
            >
              {isBottomBar ? (
                <BottomNavBar items={NAV_ITEMS} hidden={navHidden} />
              ) : (
                <Sidebar
                  items={isMobile ? NAV_ITEMS.filter((item) => item.id !== 'settings') : NAV_ITEMS}
                  isMobile={isMobile}
                  hidden={navHidden}
                />
              )}
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                {header}
                {hubUnreachable && <HubUnreachableBanner />}
                {panels}
              </div>
            </Tabs>
          </div>
        </ShellHeaderContext.Provider>
      </EntityIconsContext.Provider>
    </LiveVanContext.Provider>
  )
}

export default App
