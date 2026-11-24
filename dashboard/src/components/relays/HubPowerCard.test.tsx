import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import type { LiveVanInput } from '@renewvan/core/van'
import { LiveVanContext } from '@/hooks/useLiveVan'
import { testLiveVan, type TestBusState } from '@/test/liveVan'
import type { DriverInfo } from '@/types'
import { HubPowerCard } from './HubPowerCard'

const boardInfo: DriverInfo = {
  driver: 'esp32-front',
  product: 'ESP32 16-channel relay board',
  source: 'relays',
  publishes: ['relay'],
  version: 'v1',
  hub_power: 'front-01',
}

const board = { 'esp32-front': { info: boardInfo, health: 'online' as const } }

function setup(
  state: TestBusState = {},
  input: Partial<Omit<LiveVanInput, 'state'>> = {},
  answerMs = 1000,
) {
  const onStartWinterMode = vi.fn()
  const onSetRelay = vi.fn()
  const user = userEvent.setup()
  const draw = (s: TestBusState, i: Partial<Omit<LiveVanInput, 'state'>>) => (
    <LiveVanContext.Provider
      value={testLiveVan(
        {
          drivers: board,
          relays: { 'front-01': { name: 'Pi power', state: true } },
          heaters: { air2d: { phase: 'off' } },
          ...s,
        },
        { winterMode: false, ...i },
      )}
    >
      <HubPowerCard
        onStartWinterMode={onStartWinterMode}
        onSetRelay={onSetRelay}
        answerMs={answerMs}
      />
    </LiveVanContext.Provider>
  )
  const view = render(draw(state, input))
  const rerender = (s: TestBusState, i: Partial<Omit<LiveVanInput, 'state'>>) =>
    view.rerender(draw({ ...state, ...s }, { ...input, ...i }))
  return { user, onStartWinterMode, onSetRelay, rerender }
}

const startButton = () => screen.getByRole('button', { name: /Start winter mode/ })

afterEach(cleanup)

describe('HubPowerCard', () => {
  it('draws nothing on a van without Hub power', () => {
    render(
      <LiveVanContext.Provider value={testLiveVan({ relays: { a: { state: true } } })}>
        <HubPowerCard onStartWinterMode={vi.fn()} onSetRelay={vi.fn()} />
      </LiveVanContext.Provider>,
    )
    expect(screen.queryByRole('region', { name: 'Hub power' })).toBeNull()
  })

  it('shows the relay reserved: a Hub power badge and Start winter mode, never Off or On', () => {
    setup()
    const card = screen.getByRole('region', { name: 'Hub power' })
    expect(within(card).getByText('Pi power')).toBeInTheDocument()
    expect(within(card).getByText('Hub power')).toBeInTheDocument()
    expect(within(card).queryByRole('radio')).toBeNull()
    expect(within(card).queryByRole('button', { name: /^(Off|On)$/ })).toBeNull()
    expect(startButton()).toBeEnabled()
  })

  it('says why and holds the button while the heater is not off', () => {
    setup({ heaters: { air2d: { phase: 'running' } } })
    expect(screen.getByText('Switch the heater off first.')).toBeInTheDocument()
    expect(startButton()).toBeDisabled()
  })

  it('holds the button in Demo mode', () => {
    setup({}, { demoMode: true })
    expect(startButton()).toBeDisabled()
  })

  it('asks first, then sends Start winter mode and waits for the hub', async () => {
    const { user, onStartWinterMode, onSetRelay } = setup()
    await user.click(startButton())
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/cannot be cancelled/)).toBeInTheDocument()
    expect(onStartWinterMode).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Start winter mode' }))
    expect(onStartWinterMode).toHaveBeenCalledOnce()
    expect(onSetRelay).not.toHaveBeenCalled()
    expect(screen.getByText(/Starting Winter mode/)).toBeInTheDocument()
  })

  it('offers to switch off the relays left on, unticked, and does it only when asked', async () => {
    const relays = {
      'front-01': { name: 'Pi power', state: true },
      'front-02': { name: 'Lights', state: true },
      'front-03': { name: 'Pump', state: false },
    }
    const first = setup({ relays })
    await first.user.click(startButton())
    const toggle = within(screen.getByRole('alertdialog')).getByRole('switch', {
      name: 'Also switch off Lights',
    })
    expect(toggle).not.toBeChecked()
    await first.user.click(toggle)
    await first.user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Start winter mode' }),
    )
    expect(first.onSetRelay).toHaveBeenCalledExactlyOnceWith('front-02', false)
    expect(first.onStartWinterMode).toHaveBeenCalledOnce()
  })

  it('says Winter mode is starting once the hub reports it', async () => {
    const { user, rerender } = setup()
    await user.click(startButton())
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Start winter mode' }),
    )
    rerender({}, { winterMode: true })
    expect(screen.getByRole('status')).toHaveTextContent('the hub is shutting down')
    expect(screen.queryByRole('button', { name: /Start winter mode/ })).toBeNull()
  })

  it('says the start failed when the hub does not report Winter mode in time', async () => {
    const { user } = setup({}, {}, 20)
    await user.click(startButton())
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Start winter mode' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('did not start Winter mode')
    expect(startButton()).toBeEnabled()
  })

  it('names every claiming board and offers nothing when two claim Hub power', () => {
    setup({
      drivers: {
        ...board,
        'esp32-rear': { info: { ...boardInfo, driver: 'esp32-rear', hub_power: 'rear-01' } },
      },
    })
    expect(screen.getByText(/esp32-front, esp32-rear/)).toBeInTheDocument()
    expect(startButton()).toBeDisabled()
  })
})
