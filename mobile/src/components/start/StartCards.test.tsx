import { render, screen } from '@testing-library/react-native'
import { emptyRenewvanBusState, type RenewvanBusState, type Tilt } from '@/types'
import { VanTiltCard } from './StartCards'

// Icons are drawing only; lucide ships ES modules Jest does not transform.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))

// The light theme; uniwind's runtime needs the native styling Jest does not have.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

let mockBusState: RenewvanBusState
jest.mock('@/bus/RenewvanBusProvider', () => ({
  useRenewvanBus: () => ({ state: mockBusState }),
}))

const LEVEL: Tilt = { roll_deg: 1, pitch_deg: 4, status: 'ok' }

/** A bus holding a live tilt, its Driver's health as given. */
function busWith(health: 'online' | 'offline'): RenewvanBusState {
  return {
    ...emptyRenewvanBusState,
    tilt: { tilt: LEVEL },
    drivers: {
      tilt: {
        info: {
          driver: 'tilt',
          product: 'GY-521',
          source: 'test',
          version: '1',
          publishes: ['tilt'],
        },
        health,
      },
    },
  }
}

// The one tilt card Home's Tilt widget and the Levels tab's Tilt page draw.
describe.each([
  ['Home', () => <VanTiltCard />],
  ['Levels', () => <VanTiltCard stacked />],
])('%s tilt', (_screen, card) => {
  it('shows the angles while the tilt Driver is online', async () => {
    mockBusState = busWith('online')
    await render(card())
    expect(screen.getByLabelText('Pitch: +4.0°')).toBeTruthy()
  })

  it('reads no reading, not the last retained angles, while its Driver is offline', async () => {
    mockBusState = busWith('offline')
    await render(card())
    expect(screen.getByLabelText('Pitch: no reading')).toBeTruthy()
    expect(screen.getByLabelText('Roll: no reading')).toBeTruthy()
  })
})
