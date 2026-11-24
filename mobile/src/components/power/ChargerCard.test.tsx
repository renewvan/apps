import { render, screen } from '@testing-library/react-native'
import { emptyRenewvanBusState, type Charger, type RenewvanBusState } from '@/types'
import { LiveVanProvider } from '@/bus/LiveVanProvider'
import { ChargerCard } from './ChargerCard'

// Icons are drawing only; lucide ships ES modules Jest does not transform.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))

// The light theme; uniwind's runtime needs the native styling Jest does not have.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

// The real Live van, drawn from this bus.
let mockBusState: RenewvanBusState
jest.mock('@/bus/RenewvanBusProvider', () => ({
  useRenewvanBus: () => ({
    state: mockBusState,
    status: 'connected',
    settled: true,
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    demoMode: false,
  }),
}))

// A Victron BlueSmart AC charger without shore power: its Driver keeps the identity retained and
// clears the live values, `voltage_v` among them.
const BLUESMART = { driver: 'vedirect', name: 'BlueSmart', source: 'ac' } as Charger

/** A bus holding `chargers`, their Driver's health as given. */
function busWith(
  chargers: Record<string, Charger>,
  health: 'online' | 'offline',
): RenewvanBusState {
  return {
    ...emptyRenewvanBusState,
    chargers,
    drivers: {
      vedirect: {
        info: {
          driver: 'vedirect',
          product: 'VE.Direct',
          source: 'test',
          version: '1',
          publishes: ['charger'],
        },
        health,
      },
    },
  }
}

describe('Energy charger card', () => {
  it('still shows a silent BlueSmart, as Off', async () => {
    mockBusState = busWith({ bluesmart: BLUESMART }, 'online')
    await render(
      <LiveVanProvider>
        <ChargerCard />
      </LiveVanProvider>,
    )
    expect(screen.getByText('BlueSmart')).toBeTruthy()
    expect(screen.getByText('Off')).toBeTruthy()
  })

  it('reads it as Driver offline while its Driver is offline', async () => {
    mockBusState = busWith({ bluesmart: BLUESMART }, 'offline')
    await render(
      <LiveVanProvider>
        <ChargerCard />
      </LiveVanProvider>,
    )
    expect(screen.getByText('BlueSmart')).toBeTruthy()
    expect(screen.getByText('Driver offline')).toBeTruthy()
  })

  it('shows its power once it reports', async () => {
    mockBusState = busWith({ bluesmart: { ...BLUESMART, voltage_v: 13.6, power_w: 120 } }, 'online')
    await render(
      <LiveVanProvider>
        <ChargerCard />
      </LiveVanProvider>,
    )
    expect(screen.getByText('120 W')).toBeTruthy()
  })
})
