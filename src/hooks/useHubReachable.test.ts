import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useHubReachable } from './useHubReachable'

describe('useHubReachable', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // The poll's tick is async (fetch, then maybe setTimeout): advance, then let its microtasks land.
  const step = async (ms: number) => {
    await act(async () => {
      vi.advanceTimersByTime(ms)
    })
  }

  it('counts any HTTP answer below 500 as reachable, the login service’s 401 included', async () => {
    const fetcher = vi.fn(async () => ({ status: 401 }) as Response)
    const { result } = renderHook(() =>
      useHubReachable(true, { fetcher, intervalMs: 100, maxMs: 1000 }),
    )
    expect(result.current).toEqual({ reachable: false, gaveUp: false })
    await step(100)
    expect(fetcher).toHaveBeenCalledWith('/api/session', { cache: 'no-store' })
    expect(result.current).toEqual({ reachable: true, gaveUp: false })
  })

  it('keeps waiting through network errors and gives up after maxMs', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('offline')))
    const { result } = renderHook(() =>
      useHubReachable(true, { fetcher, intervalMs: 100, maxMs: 1000 }),
    )
    await step(100)
    expect(result.current).toEqual({ reachable: false, gaveUp: false })
    await step(500)
    expect(result.current).toEqual({ reachable: false, gaveUp: false })
    await step(1000)
    expect(result.current).toEqual({ reachable: false, gaveUp: true })
    // Giving up is a final state, not a slow poll: no further fetches.
    const calls = fetcher.mock.calls.length
    await step(1000)
    expect(fetcher.mock.calls.length).toBe(calls)
  })

  it('never fetches while inactive', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('offline')))
    renderHook(() => useHubReachable(false, { fetcher, intervalMs: 100, maxMs: 1000 }))
    await step(2000)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
