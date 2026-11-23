import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import type { BrokerConfig } from '@/session/hubClient'
import { useCommands } from './commands'
import { RenewvanBusProvider, useRenewvanBus } from './RenewvanBusProvider'

// What `@renewvan/core` cannot see: the connection, the batching, `settled` and the now-or-never
// `publish`. The reducer itself is tested in `packages/core`.

type Handler = (...args: unknown[]) => void

/** A stand-in for mqtt.js's client: the provider only listens, subscribes, publishes and ends. */
class FakeClient {
  connected = false
  handlers = new Map<string, Handler[]>()
  publish = jest.fn()
  subscribe = jest.fn()
  end = jest.fn()
  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    return this
  }
  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args)
  }
  connect() {
    this.connected = true
    this.emit('connect')
  }
  message(topic: string, payload: string) {
    this.emit('message', topic, Buffer.from(payload))
  }
}

let mockClient: FakeClient
jest.mock('mqtt', () => ({
  __esModule: true,
  default: { connect: () => mockClient },
}))

const config: BrokerConfig = { url: 'ws://van.local/mqtt' }

let renders = 0

function renderBus(brokerConfig: BrokerConfig | null = config) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RenewvanBusProvider config={brokerConfig}>{children}</RenewvanBusProvider>
  )
  return renderHook(
    () => {
      renders += 1
      return { bus: useRenewvanBus(), commands: useCommands() }
    },
    { wrapper },
  )
}

beforeEach(() => {
  jest.useFakeTimers()
  mockClient = new FakeClient()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('RenewvanBusProvider', () => {
  it('reads disconnected with no van to connect to', async () => {
    const { result } = await renderBus(null)
    expect(result.current.bus.status).toBe('disconnected')
  })

  it('folds the messages that arrive within a flush into one update', async () => {
    const { result } = await renderBus()
    await act(() => mockClient.connect())
    expect(mockClient.subscribe).toHaveBeenCalledWith('renewvan/#')

    const before = renders
    await act(() => {
      mockClient.message('renewvan/relay/pump/driver', '"relays"')
      mockClient.message('renewvan/relay/pump/state', 'true')
      mockClient.message('renewvan/relay/pump/name', '"Water pump"')
    })
    expect(renders).toBe(before)

    await act(() => jest.advanceTimersByTime(250))
    expect(renders).toBe(before + 1)
    expect(result.current.bus.state.relays.pump).toMatchObject({ state: true, name: 'Water pump' })
  })

  it('sends nothing while not connected', async () => {
    const { result } = await renderBus()
    await act(() => result.current.commands.setRelay('pump', true))
    expect(mockClient.publish).not.toHaveBeenCalled()
  })

  it('drops a van Command in Demo mode but still sends a kiosk one', async () => {
    const { result } = await renderBus()
    await act(() => mockClient.connect())
    await act(() => {
      mockClient.message('renewvan/demo/enabled', 'true')
      jest.advanceTimersByTime(250)
    })
    expect(result.current.bus.demoMode).toBe(true)

    await act(() => {
      result.current.commands.setRelay('pump', true)
      result.current.commands.setKioskDisplayPower(false)
    })
    expect(mockClient.publish).toHaveBeenCalledTimes(1)
    expect(mockClient.publish).toHaveBeenCalledWith('renewvan/kiosk/display/power/set', 'off', {
      qos: 1,
      retain: false,
    })
  })

  it('settles three seconds after connecting', async () => {
    const { result } = await renderBus()
    await act(() => mockClient.connect())
    expect(result.current.bus.settled).toBe(false)
    await act(() => jest.advanceTimersByTime(2999))
    expect(result.current.bus.settled).toBe(false)
    await act(() => jest.advanceTimersByTime(1))
    expect(result.current.bus.settled).toBe(true)
  })
})
