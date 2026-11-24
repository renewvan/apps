import { act, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onTestFinished, vi } from 'vite-plus/test'
import { buildCommands } from '@renewvan/core'
import type {
  AutoSleepTimeoutMinutes,
  ConnectionStatus,
  DisplayPower,
  HubStatus,
  RenewvanBus,
  RouterHealth,
  TailscaleStatus,
} from '@/hooks/useRenewvanBus'
import { useAlertsEnabled } from '@/hooks/useAlertsEnabled'
import { useHiddenTemperatures } from '@/hooks/useHiddenTemperatures'
import { useMapTheme } from '@/hooks/useMapTheme'
import { useNavbarPosition } from '@/hooks/useNavbarPosition'
import { usePowerLayout } from '@/hooks/usePowerLayout'
import { useStartLayout } from '@/hooks/useStartLayout'
import { useStartPowerSources } from '@/hooks/useStartPowerSources'
import { useStartTiles } from '@/hooks/useStartTiles'
import { useStartView } from '@/hooks/useStartView'
import { useTheme } from '@/hooks/useTheme'
import type { VanDetails } from '@renewvan/core/vanDetails'
import { useVan } from '@/hooks/useVan'
import { emptyRenewvanBusState, type Commands, type RenewvanBusState, type Router } from '@/types'
import { stubMatchMedia } from './matchMedia'
import { SettingsUnderTest } from './SettingsUnderTest'
import type { TestBusState } from './liveVan'
import { storePreference } from './preferences'

export const connectedTailscale: TailscaleStatus = {
  enabled: true,
  connected: true,
  ip: '100.64.0.1',
  hostname: 'renewvan',
  peers: 1,
}

export const liveRouter: Router = {
  signal_rsrp_dbm: -85,
  signal_rsrq_db: -10,
  signal_sinr_db: 6,
  signal_rssi_dbm: -54,
  operator: '26203',
  network_type: 'lte',
  uptime_s: 826_671,
  data_used_month_tx_b: 140.2 * 1024 * 1024,
  data_used_month_rx_b: 385.1 * 1024 * 1024,
}

/**
 * A van with `driver-router` installed: the retained info and health it publishes. Opt in with
 * `renderSettings({}, { bus: { drivers: ROUTER_DRIVERS } })`; without it the bus has no Drivers, so
 * Connectivity names the router plain `Router`.
 */
export const ROUTER_DRIVERS: RenewvanBusState['drivers'] = {
  router: {
    health: 'online',
    info: {
      driver: 'router',
      product: 'Teltonika RUT-360 router',
      source: 'RutOS Data to Server MQTT push feed',
      publishes: ['router'],
      version: 'v0.2.0',
    },
  },
}

/** jsdom has no `ResizeObserver`, which HeroUI's `ScrollShadow` observes. */
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Kiosk width: comfortably above the 800px "mobile" breakpoint. */
const KIOSK_WIDTH = 1024

/** The broker the kiosk is built against (`VITE_MQTT_WS_URL`): the Hub page's link and route. */
const KIOSK_ENV = { VITE_MQTT_WS_URL: 'ws://192.168.1.10:9001' }

/** The bus-level fields a test may set, by the names the Settings views show them under. */
export interface BusFields {
  busStatus: ConnectionStatus
  tailscale: TailscaleStatus | null
  hubStatus: HubStatus | null
  displayPower: DisplayPower
  brightness: number | null
  autoSleepEnabled: boolean | null
  autoSleepTimeoutMinutes: AutoSleepTimeoutMinutes | null
  demoMode: boolean
  /** The shared Primary battery choice: `auto` or a battery instance id. */
  primaryBatterySelection: string
  relayGroups: Record<string, string>
  relayGroupList: string[] | null
  relayOrder: string[]
  /**
   * The van's router as the Live van holds it. It stays out of the bus records, so no fallback
   * Router row joins Devices, and its health reads online whether or not a router Driver is there.
   */
  router: Partial<Router> | undefined
  routerHealth: RouterHealth | null
  routerUpdatedAt: number | undefined
}

/** What `App` hands the Settings page: the header bell and, in a dev kiosk, the navbar's pin. */
export interface ShellFields {
  unseenAlertCount: number
  openAlerts: () => void
  navPinned: boolean
  setNavPinned: (pinned: boolean) => void
}

/** The stored preferences a test may set, each through its own hook (`useVan` apart: per field). */
const PREFERENCES = {
  alertsEnabled: useAlertsEnabled,
  theme: useTheme,
  navbarPosition: useNavbarPosition,
  startPowerSources: useStartPowerSources,
  startLayout: useStartLayout,
  startView: useStartView,
  startTiles: useStartTiles,
  powerLayout: usePowerLayout,
  mapTheme: useMapTheme,
  hiddenTemperatures: useHiddenTemperatures,
}

type StoredPreferences = {
  [K in keyof typeof PREFERENCES]: ReturnType<(typeof PREFERENCES)[K]>[0]
} & { van: VanDetails }

/**
 * What a test sets, flat: the records on the bus (`tanks`, `temperatures`, ...), the bus-level
 * fields, the stored preferences, the Commands (spies by default) and the shell's props.
 */
export type SettingsOverrides = Partial<
  Omit<TestBusState, 'routerUpdatedAt'> & BusFields & StoredPreferences & Commands & ShellFields
>

export interface RenderSettingsOptions {
  /** Simulated viewport width for `matchMedia` (default: kiosk). */
  width?: number
  /** Starting URL, to open on a deep link (default: the Settings top list). */
  url?: string
  /**
   * What is on the bus. The Live van, and so the Drivers list, is built from it through the real
   * `liveVan`, so a test describes topics and not rows.
   */
  bus?: TestBusState
  /** The shared entity icons on the bus (`renewvan/hub/icons`): `<entity>/<id>` to a lucide name. */
  entityIcons?: Record<string, string>
  /** The runtime env (`window.__ENV__`): the broker URL and login the Hub page reads. */
  env?: Record<string, string | undefined>
}

const BUS_DEFAULTS: BusFields = {
  busStatus: 'connected',
  tailscale: connectedTailscale,
  hubStatus: { ip: '192.168.1.10', hostname: 'renewvan', version: 'v0.4.0' },
  displayPower: 'on',
  brightness: 70,
  autoSleepEnabled: false,
  autoSleepTimeoutMinutes: 5,
  demoMode: false,
  primaryBatterySelection: 'auto',
  relayGroups: {},
  relayGroupList: null,
  relayOrder: [],
  router: liveRouter,
  routerHealth: 'online',
  routerUpdatedAt: Date.now(),
}

const RECORD_KEYS = Object.keys(emptyRenewvanBusState)

/** A spy for every Command, as `buildCommands` names them. */
function spyCommands(): Commands {
  const names = Object.keys(buildCommands(() => {}))
  return Object.fromEntries(names.map((name) => [name, vi.fn()])) as unknown as Commands
}

function storePreferences(overrides: SettingsOverrides) {
  for (const [key, useHook] of Object.entries(PREFERENCES)) {
    const value = overrides[key as keyof typeof PREFERENCES]
    if (value !== undefined) storePreference(useHook as never, value as never)
  }
  const { van } = overrides
  if (van === undefined) return
  const { result, unmount } = renderHook(useVan)
  act(() => {
    for (const [field, value] of Object.entries(van))
      result.current[1](field as keyof VanDetails, value)
  })
  unmount()
}

/**
 * Renders the Settings page under the real providers, built from a fake bus: `options.bus` for the
 * records, `overrides` for everything else (see `SettingsOverrides`). Preferences are stored
 * through their own hooks, so a test reads what a view changed with `storedPreference`. Stubs
 * `matchMedia`, `ResizeObserver` and the runtime env, and restores them, the URL and the stored
 * preferences when the test finishes.
 */
export function renderSettings(
  overrides: SettingsOverrides = {},
  {
    width = KIOSK_WIDTH,
    url = '/?page=settings',
    bus,
    entityIcons = {},
    env = KIOSK_ENV,
  }: RenderSettingsOptions = {},
) {
  // The open view lives in `?view=`: every render starts at the top list unless a `url` is given.
  window.history.replaceState(null, '', url)
  const viewport = stubMatchMedia(width)
  vi.stubGlobal('ResizeObserver', StubResizeObserver)
  window.__ENV__ = env
  onTestFinished(() => {
    window.history.replaceState(null, '', '/')
    viewport.restore()
    vi.unstubAllGlobals()
    delete window.__ENV__
    window.localStorage.clear()
  })

  const commands = spyCommands()
  const value = {
    ...commands,
    openAlerts: vi.fn(),
    ...overrides,
  }

  const tree = (shown: SettingsOverrides) => {
    const fields = { ...BUS_DEFAULTS, ...shown }
    const records = Object.fromEntries(
      Object.entries(shown).filter(([key]) => RECORD_KEYS.includes(key)),
    )
    const fakeBus: RenewvanBus = {
      state: { ...emptyRenewvanBusState, ...bus, ...records } as RenewvanBusState,
      status: fields.busStatus,
      tailscale: fields.tailscale,
      hubStatus: fields.hubStatus,
      kiosk: {
        power: fields.displayPower,
        brightness: fields.brightness,
        autoSleepEnabled: fields.autoSleepEnabled,
        autoSleepTimeoutMinutes: fields.autoSleepTimeoutMinutes,
      },
      demoMode: fields.demoMode,
      primaryBattery: fields.primaryBatterySelection,
      relayGroups: fields.relayGroups,
      relayGroupList: fields.relayGroupList,
      relayOrder: fields.relayOrder,
      winterMode: null,
      entityIcons,
      publish: vi.fn(),
      commands: Object.fromEntries(
        Object.keys(commands).map((name) => [name, shown[name as keyof Commands]]),
      ) as unknown as Commands,
    }
    return <SettingsUnderTest bus={fakeBus} router={fields} shell={shown} />
  }

  storePreferences(overrides)
  const user = userEvent.setup()
  const result = render(tree(value))
  /** Draws the page again with `changes` on top, as a bus message (or a stored change) would. */
  const rerenderSettings = (changes: SettingsOverrides) => {
    storePreferences(changes)
    result.rerender(tree({ ...value, ...changes }))
  }
  return { user, viewport, value, rerenderSettings, ...result }
}

/**
 * The rows of the open Settings view: the pane's buttons except the navigation bar's Back
 * button, which is not a row.
 */
export function settingsRows(): HTMLElement[] {
  const pane = screen.getByTestId('pane-settings')
  const nav = within(pane).queryByRole('navigation', { name: 'Settings navigation' })
  return within(pane)
    .getAllByRole('button')
    .filter((button) => !nav?.contains(button))
}
