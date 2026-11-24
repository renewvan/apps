import { render, screen, within } from '@testing-library/react-native'
import { Fragment as MockFragment, type ReactNode } from 'react'
import { emptyRenewvanBusState, type DriverInfo, type RenewvanBusState } from '@/types'
import { LiveVanProvider } from '@/bus/LiveVanProvider'
import type { EditMode } from '@/components/editing/EditableCards'
import { ControlsContent } from './ControlsContent'

jest.mock('@/components/native')

// Icons are drawing only; lucide ships ES modules Jest does not transform.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))

// The light theme; uniwind's runtime needs the native styling Jest does not have.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

// The cards as the page lists them, without the drag-to-reorder machinery; an empty list says
// every card is hidden, as the real one does.
jest.mock('@/components/editing/EditableCards', () => {
  const { Text } = jest.requireActual('react-native')
  return {
    EditableCards: ({
      ids,
      renderCard,
    }: {
      ids: string[]
      renderCard: (id: string) => ReactNode
    }) =>
      ids.length === 0 ? (
        <Text>Every card is hidden.</Text>
      ) : (
        ids.map((id) => <MockFragment key={id}>{renderCard(id)}</MockFragment>)
      ),
  }
})

// This phone has not rearranged any page.
jest.mock('@/preferences/PreferencesProvider', () => ({
  usePreferences: () => ({ pageLayouts: {}, update: () => {} }),
}))

jest.mock('@/bus/commands', () => ({
  useCommands: () => ({ setRelay: jest.fn(), startWinterMode: jest.fn() }),
}))

// The real Live van, drawn from this bus. One object per bus change, as the provider's.
let mockBus: Record<string, unknown>
jest.mock('@/bus/RenewvanBusProvider', () => ({ useRenewvanBus: () => mockBus }))

const boardInfo: DriverInfo = {
  driver: 'esp32-front',
  product: 'ESP32 16-channel relay board',
  source: 'relays',
  publishes: ['relay'],
  version: 'v1',
}

const EDIT = { editing: false } as unknown as EditMode

async function setup(relays: RenewvanBusState['relays'], hubPower?: string) {
  mockBus = {
    state: {
      ...emptyRenewvanBusState,
      drivers: {
        'esp32-front': { info: { ...boardInfo, hub_power: hubPower }, health: 'online' },
      },
      relays,
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
  await render(
    <LiveVanProvider>
      <ControlsContent edit={EDIT} />
    </LiveVanProvider>,
  )
}

describe('Controls', () => {
  it('draws every relay as an Off | On switch on a van without Hub power', async () => {
    await setup({ relay_01: { name: 'Lights', state: true }, relay_02: { name: 'Pump' } })
    expect(screen.getByRole('radiogroup', { name: 'Lights' })).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Pump' })).toBeTruthy()
    expect(screen.queryByLabelText('Hub power')).toBeNull()
  })

  it('draws Hub power on its own card, last, never as a switch in a group', async () => {
    await setup(
      { relay_01: { name: 'Lights', state: true }, relay_02: { name: 'Pi power', state: true } },
      'relay_02',
    )
    expect(screen.getByRole('radiogroup', { name: 'Lights' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup', { name: 'Pi power' })).toBeNull()
    const card = screen.getByLabelText('Hub power')
    expect(within(card).getByText('Pi power')).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Start winter mode' })).toBeTruthy()
  })

  it('shows the card, not "No data yet", when Hub power is the only relay', async () => {
    await setup({ relay_02: { name: 'Pi power', state: true } }, 'relay_02')
    expect(screen.queryByText('No data yet')).toBeNull()
    expect(screen.queryByText('Every card is hidden.')).toBeNull()
    expect(screen.getByLabelText('Hub power')).toBeTruthy()
  })
})
