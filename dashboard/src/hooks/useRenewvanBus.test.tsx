import { act, renderHook, waitFor } from '@testing-library/react'
import type { MqttClient } from 'mqtt'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vite-plus/test'
import { useRenewvanBus } from './useRenewvanBus'

// Only what `@renewvan/core` cannot see: the connection, the subscription and the send path. What
// each message does to the state is the core reducer's, tested in `packages/core`.

type Handler = (...args: unknown[]) => void

interface FakeClient {
  handlers: Map<string, Handler>
  connected: boolean
  subscribe: Mock
  publish: Mock
  end: Mock
}

const clients: FakeClient[] = []
const connectMock = vi.fn()

vi.mock('mqtt', () => ({
  default: {
    connect: (url: string): MqttClient => {
      connectMock(url)
      const client: FakeClient = {
        handlers: new Map(),
        connected: false,
        subscribe: vi.fn(),
        publish: vi.fn(),
        end: vi.fn(),
      }
      clients.push(client)
      const api = {
        on: (event: string, handler: Handler) => client.handlers.set(event, handler),
        get connected() {
          return client.connected
        },
        subscribe: client.subscribe,
        publish: client.publish,
        end: client.end,
      }
      queueMicrotask(() => {
        client.connected = true
        client.handlers.get('connect')?.()
      })
      return api as unknown as MqttClient
    },
  },
}))

const latest = () => clients[clients.length - 1]

function receive(topic: string, payload: string) {
  act(() => latest().handlers.get('message')?.(topic, { toString: () => payload }))
}

async function renderConnected() {
  const hook = renderHook(() => useRenewvanBus())
  await waitFor(() => expect(hook.result.current.status).toBe('connected'))
  return hook
}

beforeEach(() => {
  clients.length = 0
  connectMock.mockClear()
  vi.stubEnv('VITE_MQTT_WS_URL', 'ws://test-broker')
})

describe('useRenewvanBus connection', () => {
  it('starts disconnected and never connects when no broker URL is configured', () => {
    vi.stubEnv('VITE_MQTT_WS_URL', '')
    const { result } = renderHook(() => useRenewvanBus())
    expect(result.current.status).toBe('disconnected')
    expect(connectMock).not.toHaveBeenCalled()
  })

  it('subscribes once to renewvan/#, which already covers the demo namespace', async () => {
    await renderConnected()
    expect(latest().subscribe).toHaveBeenCalledExactlyOnceWith('renewvan/#')
  })

  it('feeds every message through the core reducer into the visible state', async () => {
    const { result } = await renderConnected()
    receive('renewvan/tank/fresh/level_pct', '42')
    expect(result.current.state.tanks.fresh).toEqual({ level_pct: 42 })
  })

  it('ends a torn-down client, and nothing it says afterwards lands', async () => {
    // Strict Mode mounts, cleans up and mounts again: two clients, the first one ended.
    const { result } = renderHook(() => useRenewvanBus(), { reactStrictMode: true })
    await waitFor(() => expect(result.current.status).toBe('connected'))
    expect(clients).toHaveLength(2)
    const [torn] = clients
    expect(torn.end).toHaveBeenCalledOnce()
    act(() => torn.handlers.get('message')?.('renewvan/demo/enabled', { toString: () => 'true' }))
    expect(result.current.demoMode).toBe(false)
    receive('renewvan/demo/enabled', 'true')
    expect(result.current.demoMode).toBe(true)
  })
})

describe('useRenewvanBus publish', () => {
  it('sends with QoS 1, never retained', async () => {
    const { result } = await renderConnected()
    result.current.commands.setRelay('relay_01', true)
    expect(latest().publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/relay/relay_01/set',
      'true',
      {
        qos: 1,
        retain: false,
      },
    )
  })

  it('sends nothing while the client is not connected: no offline queue', async () => {
    const { result } = await renderConnected()
    latest().connected = false
    result.current.commands.setRelay('relay_01', true)
    expect(latest().publish).not.toHaveBeenCalled()
  })

  it('drops a relay Command in Demo mode and still sends a kiosk Command', async () => {
    const { result } = await renderConnected()
    receive('renewvan/demo/enabled', 'true')
    result.current.commands.setRelay('relay_01', true)
    result.current.commands.setKioskDisplayPower(false)
    expect(latest().publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/kiosk/display/power/set',
      'off',
      { qos: 1, retain: false },
    )
  })

  it('keeps publish and the Commands the same across renders and Demo mode changes', async () => {
    const { result, rerender } = await renderConnected()
    const { publish, commands } = result.current
    receive('renewvan/demo/enabled', 'true')
    rerender()
    expect(result.current.publish).toBe(publish)
    expect(result.current.commands).toBe(commands)
  })
})
