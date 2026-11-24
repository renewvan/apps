import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { emptyRenewvanBusState, type RenewvanBusState } from '@/types'
import type { RenewvanBus } from './RenewvanBusProvider'
import { LiveVanProvider, useLiveVan } from './LiveVanProvider'

// What the provider adds to `liveVan` (tested in `packages/core`): it reads the bus, and keeps the
// same Live van while nothing it shows has changed.

let mockBus: Partial<RenewvanBus>
jest.mock('./RenewvanBusProvider', () => ({ useRenewvanBus: () => mockBus }))

const bus = (state: Partial<RenewvanBusState> = {}): Partial<RenewvanBus> => ({
  state: { ...emptyRenewvanBusState, ...state },
  status: 'connected',
  settled: true,
  primaryBattery: null,
  relayGroups: {},
  relayGroupList: null,
  relayOrder: [],
  demoMode: false,
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <LiveVanProvider>{children}</LiveVanProvider>
)

afterEach(() => jest.restoreAllMocks())

describe('LiveVanProvider', () => {
  it('draws the Live van from the bus', async () => {
    mockBus = bus({ tanks: { fresh: { fluid_type: 'fresh_water' } as never } })
    const { result } = await renderHook(() => useLiveVan(), { wrapper })
    // A tank still arriving is not in it.
    expect(result.current.tankIds).toEqual([])
    expect(result.current.capabilities.tank.state).toBe('present')
  })

  it('keeps the same Live van across a bus message that changes nothing it shows', async () => {
    mockBus = bus()
    const { result, rerender } = await renderHook(() => useLiveVan(), { wrapper })
    const first = result.current
    // Every message replaces the bus state object.
    mockBus = bus()
    await act(() => rerender({}))
    expect(result.current).toBe(first)
  })

  it('throws outside the provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(renderHook(() => useLiveVan())).rejects.toThrow('LiveVanProvider')
  })
})
