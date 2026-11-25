import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import { emptyRenewvanBusState, type DriverInfo, type RenewvanBusState } from '@/types'
import { LiveVanProvider } from '@/bus/LiveVanProvider'
import { confirm, type ConfirmOptions } from '@/components/native'
import { HubPowerCard } from './HubPowerCard'

jest.mock('@/components/native')

// Icons are drawing only; lucide ships ES modules Jest does not transform.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))

// The light theme; uniwind's runtime needs the native styling Jest does not have.
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))

// The real Live van, drawn from this bus. One object per bus change, as the provider's.
let mockBus: Record<string, unknown>
jest.mock('@/bus/RenewvanBusProvider', () => ({ useRenewvanBus: () => mockBus }))

const boardInfo: DriverInfo = {
  driver: 'esp32-front',
  product: 'ESP32 16-channel relay board',
  source: 'relays',
  publishes: ['relay'],
  version: 'v1',
  hub_power: 'front-01',
}

const board = { 'esp32-front': { info: boardInfo, health: 'online' as const } }

const confirmed = jest.mocked(confirm)
/** The options of the last confirm the card asked for. */
const lastConfirm = (): ConfirmOptions => confirmed.mock.lastCall![0]
/** Taps the confirming button, the option ticked or not. */
const answer = (optionOn: boolean) => act(() => lastConfirm().onConfirm(optionOn))

async function setup(
  state: Partial<RenewvanBusState> = {},
  { demoMode = false, answerMs = 1000 }: { demoMode?: boolean; answerMs?: number } = {},
) {
  mockBus = {
    state: {
      ...emptyRenewvanBusState,
      drivers: board,
      relays: { 'front-01': { name: 'Pi power', state: true } },
      heaters: { air2d: { phase: 'off' } },
      ...state,
    },
    status: 'connected',
    settled: true,
    primaryBattery: null,
    relayGroups: {},
    relayGroupList: null,
    relayOrder: [],
    demoMode,
    winterMode: false,
  }
  const onStartWinterMode = jest.fn()
  const onSetRelay = jest.fn()
  const draw = () => (
    <LiveVanProvider>
      <HubPowerCard
        onStartWinterMode={onStartWinterMode}
        onSetRelay={onSetRelay}
        answerMs={answerMs}
      />
    </LiveVanProvider>
  )
  const view = await render(draw())
  /** Draws the card again from the bus as changed. */
  const change = async (next: Record<string, unknown>) => {
    mockBus = { ...mockBus, ...next }
    await view.rerender(draw())
  }
  /** Draws the card again once the hub reports Winter mode as given. */
  const report = (winterMode: boolean) => change({ winterMode })
  /** Draws the card again with the heater as given. */
  const heater = (phase: string) =>
    change({
      state: { ...(mockBus.state as RenewvanBusState), heaters: { air2d: { phase } } },
    })
  return { onStartWinterMode, onSetRelay, report, change, heater }
}

const startButton = () => screen.getByRole('button', { name: 'Start winter mode' })
const isDisabled = (element: ReturnType<typeof startButton>) =>
  element.props.accessibilityState?.disabled === true

beforeEach(() => confirmed.mockClear())

describe('HubPowerCard', () => {
  it('draws nothing on a van without Hub power', async () => {
    await setup({ drivers: {} })
    expect(screen.queryByLabelText('Hub power')).toBeNull()
  })

  it('shows the relay reserved: a Hub power chip and Start winter mode, never Off or On', async () => {
    await setup()
    const card = screen.getByLabelText('Hub power')
    expect(within(card).getByText('Pi power')).toBeTruthy()
    expect(within(card).getByText('Hub power')).toBeTruthy()
    expect(
      within(card).getByText('Powers the hub and router. Its only way off is Winter mode.'),
    ).toBeTruthy()
    expect(within(card).queryByRole('radiogroup')).toBeNull()
    expect(isDisabled(startButton())).toBe(false)
  })

  it('says why and holds the button while the heater is not off', async () => {
    await setup({ heaters: { air2d: { phase: 'running' } } } as Partial<RenewvanBusState>)
    expect(screen.getByText('Switch the heater off first.')).toBeTruthy()
    expect(isDisabled(startButton())).toBe(true)
  })

  it('holds the button in Demo mode', async () => {
    await setup({}, { demoMode: true })
    expect(isDisabled(startButton())).toBe(true)
  })

  it('asks first, then sends Start winter mode and waits for the hub', async () => {
    const { onStartWinterMode, onSetRelay } = await setup()
    await fireEvent.press(startButton())
    const asked = lastConfirm()
    expect(asked.title).toBe('Start winter mode?')
    expect(asked.message).toMatch(/cannot be cancelled/)
    expect(asked.message).toMatch(/use Wake hub in this app, near the van\.$/)
    expect(asked.option).toBeUndefined()
    expect(onStartWinterMode).not.toHaveBeenCalled()
    await answer(false)
    expect(await screen.findByText('Starting Winter mode…')).toBeTruthy()
    expect(onStartWinterMode).toHaveBeenCalledTimes(1)
    expect(onSetRelay).not.toHaveBeenCalled()
    expect(isDisabled(startButton())).toBe(true)
  })

  it('offers to switch off the relays left on, and does it only when asked', async () => {
    const relays = {
      'front-01': { name: 'Pi power', state: true },
      'front-02': { name: 'Lights', state: true },
      'front-03': { name: 'Pump', state: false },
      'front-04': { state: true },
    }
    const { onStartWinterMode, onSetRelay } = await setup({ relays })
    await fireEvent.press(startButton())
    expect(lastConfirm().option).toEqual({ label: 'Also switch off Lights, front-04' })
    await answer(true)
    expect(onSetRelay.mock.calls).toEqual([
      ['front-02', false],
      ['front-04', false],
    ])
    expect(onStartWinterMode).toHaveBeenCalledTimes(1)
  })

  it('leaves the relays on when the option is not ticked', async () => {
    const relays = {
      'front-01': { name: 'Pi power', state: true },
      'front-02': { name: 'Lights', state: true },
    }
    const { onStartWinterMode, onSetRelay } = await setup({ relays })
    await fireEvent.press(startButton())
    await answer(false)
    expect(onSetRelay).not.toHaveBeenCalled()
    expect(onStartWinterMode).toHaveBeenCalledTimes(1)
  })

  it('says Winter mode is starting once the hub reports it', async () => {
    const { report } = await setup()
    await fireEvent.press(startButton())
    await answer(false)
    await report(true)
    expect(
      screen.getByText(
        'Winter mode: the hub is shutting down, then the relay board cuts its power. Wake it from this app, near the van.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start winter mode' })).toBeNull()
  })

  it('says the start failed when the hub does not report Winter mode in time', async () => {
    await setup({}, { answerMs: 20 })
    await fireEvent.press(startButton())
    await answer(false)
    expect(await screen.findByText(/did not start Winter mode/)).toBeTruthy()
    expect(isDisabled(startButton())).toBe(false)
  })

  it('offers no switch, and says which relays stay on, while a relay board is offline', async () => {
    const relays = {
      'front-01': { name: 'Pi power', state: true },
      'front-02': { name: 'Lights', state: true },
    }
    const rear = { info: { ...boardInfo, driver: 'esp32-rear', hub_power: undefined } }
    const { onStartWinterMode, onSetRelay } = await setup({
      relays,
      drivers: { ...board, 'esp32-rear': { ...rear, health: 'offline' } },
    } as Partial<RenewvanBusState>)
    await fireEvent.press(startButton())
    expect(lastConfirm().option).toBeUndefined()
    expect(lastConfirm().message).toMatch(/so Lights stays on\.$/)
    await answer(false)
    expect(onSetRelay).not.toHaveBeenCalled()
    expect(onStartWinterMode).toHaveBeenCalledTimes(1)
  })

  it('sends nothing when a problem arose while the confirm was open', async () => {
    const { onStartWinterMode, heater } = await setup()
    await fireEvent.press(startButton())
    await heater('running')
    await answer(false)
    expect(onStartWinterMode).not.toHaveBeenCalled()
    expect(screen.queryByText('Starting Winter mode…')).toBeNull()
    expect(screen.getByText('Switch the heater off first.')).toBeTruthy()
  })

  it('says why the button is held when a problem arose after a failed start', async () => {
    const { heater } = await setup({}, { answerMs: 20 })
    await fireEvent.press(startButton())
    await answer(false)
    await screen.findByText(/did not start Winter mode/)
    await heater('running')
    expect(screen.getByText('Switch the heater off first.')).toBeTruthy()
    expect(screen.queryByText(/did not start Winter mode/)).toBeNull()
    expect(isDisabled(startButton())).toBe(true)
  })

  it('says the hub was lost, not that the start failed, when the link drops unanswered', async () => {
    const { change } = await setup({}, { answerMs: 20 })
    await fireEvent.press(startButton())
    await answer(false)
    await change({ status: 'disconnected' })
    expect(await screen.findByText(/Lost the connection to the hub/)).toBeTruthy()
    expect(screen.queryByText(/did not start Winter mode/)).toBeNull()
    expect(isDisabled(startButton())).toBe(true)
  })

  it('names every claiming board and offers nothing when two claim Hub power', async () => {
    await setup({
      drivers: {
        ...board,
        'esp32-rear': { info: { ...boardInfo, driver: 'esp32-rear', hub_power: 'rear-01' } },
      },
    } as Partial<RenewvanBusState>)
    expect(screen.getByText(/esp32-front, esp32-rear/)).toBeTruthy()
    expect(isDisabled(startButton())).toBe(true)
  })
})
