import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { stubMatchMedia, type MatchMediaStub } from '@/test/matchMedia'
import { WeatherWidget } from './WeatherWidget'

const FIXTURE = {
  current: { temperature_2m: 18.5, weather_code: 1 },
  daily: {
    time: ['2026-11-16', '2026-11-17'],
    weather_code: [1, 2],
    temperature_2m_max: [20, 21],
    temperature_2m_min: [10, 11],
  },
}

let viewport: MatchMediaStub
const fetchMock = vi.fn()

beforeEach(() => {
  viewport = stubMatchMedia(800)
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(FIXTURE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  viewport.restore()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('WeatherWidget', () => {
  it('fetches once for fixes that stay inside one ~110 m cell, and again in a new cell', async () => {
    const view = render(<WeatherWidget lat={52.52} lon={13.405} temperatures={{}} />)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Parked GPS jitter of a few metres: same rounded cell, no new request.
    view.rerender(<WeatherWidget lat={52.5204} lon={13.4054} temperatures={{}} />)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // A real move into the next cell re-fetches, at the rounded coordinates.
    view.rerender(<WeatherWidget lat={52.521} lon={13.405} temperatures={{}} />)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(String(fetchMock.mock.calls[1][0])).toContain('latitude=52.521')
  })
})
