import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import {
  emptyRenewvanBusState,
  type DriverHealth,
  type RenewvanBusState,
  type Tank,
  type TemperatureSensor,
} from '@/types'
import { LiveVanProvider } from '@/bus/LiveVanProvider'
import type { EditMode } from '@/components/editing/EditableCards'
import { TanksContent, TemperatureContent } from './LevelsContent'

// Icons are drawing only; lucide ships ES modules Jest does not transform.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))

// The light theme; uniwind's runtime needs the native styling Jest does not have.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

// The cards as the page lists them, without the drag-to-reorder machinery.
jest.mock('@/components/editing/EditableCards', () => ({
  EditableCards: ({ ids, renderCard }: { ids: string[]; renderCard: (id: string) => ReactNode }) =>
    ids.map((id) => renderCard(id)),
}))

// This phone has not rearranged any page.
jest.mock('@/preferences/PreferencesProvider', () => ({
  usePreferences: () => ({ pageLayouts: {}, update: () => {} }),
}))

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
    entityIcons: {},
  }),
}))

const EDIT = { editing: false } as unknown as EditMode

/** A bus holding `state`, with a Driver publishing `type` whose health is as given. */
function busWith(
  state: Partial<RenewvanBusState>,
  type: string,
  health: DriverHealth,
): RenewvanBusState {
  return {
    ...emptyRenewvanBusState,
    ...state,
    drivers: {
      [type]: {
        info: { driver: type, product: type, source: 'test', version: '1', publishes: [type] },
        health,
      },
    },
  }
}

const FRESH: Tank = {
  fluid_type: 'fresh_water',
  capacity_l: 100,
  level_pct: 50,
  status: 'ok',
  volume_since_full_l: 0,
  volume_since_empty_l: 0,
}
// A tank whose Driver kept its identity and cleared its readings.
const GREY = { fluid_type: 'grey_water', capacity_l: 80 } as Tank

describe('Levels › Tanks', () => {
  it('keeps a Silent tank listed, as Not reporting', async () => {
    mockBusState = busWith({ tanks: { fresh: FRESH, grey: GREY } }, 'tank', 'online')
    await render(
      <LiveVanProvider>
        <TanksContent edit={EDIT} />
      </LiveVanProvider>,
    )
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.getByText('Grey water')).toBeTruthy()
    expect(screen.getByText('Not reporting')).toBeTruthy()
  })

  it('reads it as Driver offline while its Driver is offline', async () => {
    mockBusState = busWith({ tanks: { grey: GREY } }, 'tank', 'offline')
    await render(
      <LiveVanProvider>
        <TanksContent edit={EDIT} />
      </LiveVanProvider>,
    )
    expect(screen.getByText('Grey water')).toBeTruthy()
    expect(screen.getByText('Driver offline')).toBeTruthy()
  })
})

describe('Levels › Temperature', () => {
  // A probe whose Driver kept its identity but publishes no status.
  const OUTDOOR = { name: 'Outdoor', unit: 'C', source: 'w1' } as TemperatureSensor

  it('shows a Silent probe as Not reporting', async () => {
    mockBusState = busWith({ temperatures: { outdoor: OUTDOOR } }, 'temperature', 'online')
    await render(
      <LiveVanProvider>
        <TemperatureContent edit={EDIT} />
      </LiveVanProvider>,
    )
    expect(screen.getByText('Outdoor')).toBeTruthy()
    expect(screen.getByText('Not reporting')).toBeTruthy()
  })

  it('reads it as Driver offline while its Driver is offline', async () => {
    mockBusState = busWith({ temperatures: { outdoor: OUTDOOR } }, 'temperature', 'offline')
    await render(
      <LiveVanProvider>
        <TemperatureContent edit={EDIT} />
      </LiveVanProvider>,
    )
    expect(screen.getByText('Driver offline')).toBeTruthy()
  })
})
