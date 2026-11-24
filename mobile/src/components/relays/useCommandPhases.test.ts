import { act, renderHook } from '@testing-library/react-native'
import { GIVE_UP_MS } from '@renewvan/core/pending'
import type { Relay } from '@/types'
import { useCommandPhases } from './useCommandPhases'

const relay = (state: boolean | undefined): Record<string, Relay> => ({ pump: { state } as Relay })

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('useCommandPhases', () => {
  it('shows the target as pending until the relay state moves, and sends the command once', async () => {
    const send = jest.fn()
    const { result, rerender } = await renderHook(
      ({ relays }: { relays: Record<string, Relay> }) => useCommandPhases(relays, false, send),
      {
        initialProps: { relays: relay(false) },
      },
    )
    await act(async () => result.current.request('pump', true))
    expect(send).toHaveBeenCalledWith('pump', true)
    expect(result.current.phaseOf('pump')).toEqual({ to: true, failed: false })
    await rerender({ relays: relay(true) })
    expect(result.current.phaseOf('pump')).toBeUndefined()
  })

  it('fails after the relay give-up with no change, then ends when the state reaches the target', async () => {
    const { result, rerender } = await renderHook(
      ({ relays }: { relays: Record<string, Relay> }) => useCommandPhases(relays, false, jest.fn()),
      { initialProps: { relays: relay(false) } },
    )
    await act(async () => result.current.request('pump', true))
    await act(async () => {
      jest.advanceTimersByTime(GIVE_UP_MS.relay - 1)
    })
    expect(result.current.phaseOf('pump')?.failed).toBe(false)
    await act(async () => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.phaseOf('pump')).toEqual({ to: true, failed: true })
    await rerender({ relays: relay(true) })
    expect(result.current.phaseOf('pump')).toBeUndefined()
  })

  it('reports no failure for a relay that answered, even if it later returns to the old state', async () => {
    const { result, rerender } = await renderHook(
      ({ relays }: { relays: Record<string, Relay> }) => useCommandPhases(relays, false, jest.fn()),
      { initialProps: { relays: relay(false) } },
    )
    await act(async () => result.current.request('pump', true))
    await rerender({ relays: relay(true) })
    await rerender({ relays: relay(false) })
    await act(async () => {
      jest.advanceTimersByTime(GIVE_UP_MS.relay)
    })
    expect(result.current.phaseOf('pump')).toBeUndefined()
  })

  it('ends every command in flight when frozen, and sends nothing while frozen', async () => {
    const send = jest.fn()
    const { result, rerender } = await renderHook(
      ({ frozen }: { frozen: boolean }) => useCommandPhases(relay(false), frozen, send),
      { initialProps: { frozen: false } },
    )
    await act(async () => result.current.request('pump', true))
    await rerender({ frozen: true })
    expect(result.current.phaseOf('pump')).toBeUndefined()
    send.mockClear()
    await act(async () => result.current.request('pump', true))
    expect(send).not.toHaveBeenCalled()
  })
})
