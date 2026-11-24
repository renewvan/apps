import { render, screen } from '@testing-library/react-native'
import { instanceKey } from '@renewvan/core/drivers'
import { emptyRenewvanBusState, type DriverInfo, type RenewvanBusState } from '@/types'
import { LiveVanProvider } from '@/bus/LiveVanProvider'
import { InstanceView, RelaysListView } from './devices'
import { RelaysPageView } from './general'

jest.mock('@/components/native')

// Navigation is the router's; these views only call it on a tap.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn() },
}))
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 0 }))

// Icons are drawing only; lucide ships ES modules Jest does not transform.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))

// The light theme; uniwind's runtime needs the native styling Jest does not have.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

// General's other views read the alert log and the phone's notifications; these do not.
jest.mock('@/alerts/AlertsProvider', () => ({ useAlerts: () => ({}) }))
jest.mock('@/alerts/notifications', () => ({}))
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({}) }))

// This phone has not rearranged any page.
jest.mock('@/preferences/PreferencesProvider', () => ({
  usePreferences: () => ({ pageLayouts: {}, update: () => {} }),
}))

// The page-cards editor is drag machinery; the test reads the shared groups below it.
jest.mock('./CardList', () => ({ CardList: () => null }))

jest.mock('@/bus/commands', () => ({ useCommands: () => ({}) }))

// The real Live van, drawn from this bus. One object per bus change, as the provider's.
let mockBus: Record<string, unknown>
jest.mock('@/bus/RenewvanBusProvider', () => ({ useRenewvanBus: () => mockBus }))

const relayInfo: DriverInfo = {
  driver: 'esp32-front',
  product: 'ESP32 16-channel relay board',
  source: 'relays',
  publishes: ['relay'],
  version: 'v1',
}

/** A van whose relay boards claim Hub power as given: Driver key to relay id. */
function van(relays: RenewvanBusState['relays'], claims: Record<string, string>) {
  mockBus = {
    state: {
      ...emptyRenewvanBusState,
      relays,
      drivers: Object.fromEntries(
        Object.entries(claims).map(([driver, relay]) => [
          driver,
          { info: { ...relayInfo, driver, hub_power: relay }, health: 'online' },
        ]),
      ),
    },
    status: 'connected',
    settled: true,
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    demoMode: false,
    winterMode: false,
    entityIcons: {},
  }
}

const draw = (node: React.ReactNode) => render(<LiveVanProvider>{node}</LiveVanProvider>)

describe('Settings › Devices › Relays: Hub power', () => {
  it('marks the Hub power relay in the list', async () => {
    van({ relay_01: { name: 'Pi power', state: true } }, { 'esp32-front': 'relay_01' })
    await draw(<RelaysListView />)
    expect(screen.getByText('Hub power · relay_01 · On')).toBeTruthy()
  })

  it('shows the Hub power relay reserved: no name field and no group', async () => {
    van({ relay_01: { name: 'Pi power', state: true } }, { 'esp32-front': 'relay_01' })
    await draw(<InstanceView id={instanceKey('relay', 'relay_01')} />)
    expect(screen.getByText(/not renamed or grouped/)).toBeTruthy()
    expect(screen.queryByLabelText('Name')).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Group' })).toBeNull()
  })

  it('warns when more than one board claims Hub power', async () => {
    van(
      { relay_01: { state: true }, relay_09: { state: true } },
      { 'esp32-front': 'relay_01', 'esp32-rear': 'relay_09' },
    )
    await draw(<RelaysListView />)
    expect(screen.getByRole('alert')).toHaveTextContent(/esp32-front, esp32-rear/)
  })
})

describe('Settings › Controls: Hub power', () => {
  it('keeps Hub power out of the shared groups', async () => {
    van(
      { relay_01: { name: 'Pi power', state: true }, relay_02: { name: 'Lights' } },
      { 'esp32-front': 'relay_01' },
    )
    await draw(<RelaysPageView />)
    expect(screen.getByText(/· 1 relay$/)).toBeTruthy()
  })
})
