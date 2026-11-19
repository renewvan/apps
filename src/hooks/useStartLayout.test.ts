import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import {
  DEFAULT_START_LAYOUT,
  START_WIDGET_IDS,
  layoutAfterDrop,
  widgetSlots,
  useStartLayout,
} from './useStartLayout'

const STORAGE_KEY = 'renewvan-dashboard-start-layout'

beforeEach(() => {
  window.localStorage.clear()
})

describe('useStartLayout', () => {
  it('shows every widget, in the shipped order, on a fresh kiosk', () => {
    const { result } = renderHook(() => useStartLayout())
    expect(result.current[0]).toEqual(DEFAULT_START_LAYOUT)
    expect(result.current[0]).toEqual(START_WIDGET_IDS)
  })

  it('persists a removed and rearranged layout across remounts', () => {
    const first = renderHook(() => useStartLayout())
    act(() => first.result.current[1](['tilt', 'weather']))
    first.unmount()

    const second = renderHook(() => useStartLayout())
    expect(second.result.current[0]).toEqual(['tilt', 'weather'])
  })

  it('keeps an empty layout: removing every widget is a choice, not a reset', () => {
    window.localStorage.setItem(STORAGE_KEY, '[]')
    const { result } = renderHook(() => useStartLayout())
    expect(result.current[0]).toEqual([])
  })

  it('drops ids it does not know and repeats, since localStorage outlives deploys', () => {
    window.localStorage.setItem(STORAGE_KEY, '["map","gauge","map",7,"power-flow"]')
    const { result } = renderHook(() => useStartLayout())
    expect(result.current[0]).toEqual(['map', 'power-flow'])
  })

  it('reads the old energy widget as the power flow and the battery, once each', () => {
    window.localStorage.setItem(STORAGE_KEY, '["map","energy","power-flow","tilt"]')
    const { result } = renderHook(() => useStartLayout())
    expect(result.current[0]).toEqual(['map', 'power-flow', 'battery', 'tilt'])
  })

  it('lists the slots: the shown widgets, the divider, then the hidden ones as shipped', () => {
    expect(widgetSlots(['tilt', 'weather'])).toEqual([
      'tilt',
      'weather',
      'divider',
      'map',
      'power-flow',
      'battery',
      'heater',
      'solar',
      'fresh-water',
      'grey-water',
    ])
    expect(widgetSlots([])).toEqual(['divider', ...START_WIDGET_IDS])
  })

  it('reorders the shown widgets by dropping one on another slot', () => {
    const layout = ['weather', 'map', 'tilt'] as const
    expect(layoutAfterDrop(layout, 0, 2)).toEqual(['map', 'tilt', 'weather'])
    expect(layoutAfterDrop(layout, 2, 0)).toEqual(['tilt', 'weather', 'map'])
  })

  it('shows a widget dropped above the divider, and hides one dropped below it', () => {
    const layout = ['weather', 'map', 'tilt'] as const
    // Slot 3 is the divider; slot 4 is the first hidden widget, Power flow.
    expect(layoutAfterDrop(layout, 4, 1)).toEqual(['weather', 'power-flow', 'map', 'tilt'])
    expect(layoutAfterDrop(layout, 1, 3)).toEqual(['weather', 'tilt'])
    expect(layoutAfterDrop(layout, 2, 3)).toEqual(['weather', 'map'])
  })

  it('changes nothing for the divider, a drop in place, a drop among the hidden or off the list', () => {
    const layout = ['weather', 'map', 'tilt'] as const
    expect(layoutAfterDrop(layout, 3, 0)).toBe(layout)
    expect(layoutAfterDrop(layout, 1, 1)).toBe(layout)
    expect(layoutAfterDrop(layout, 4, 6)).toBe(layout)
    expect(layoutAfterDrop(layout, 1, 99)).toBe(layout)
    expect(layoutAfterDrop(layout, -1, 0)).toBe(layout)
  })

  it.each(['not json', '{"map":true}', '"map"'])('reads %s as the default layout', (stored) => {
    window.localStorage.setItem(STORAGE_KEY, stored)
    const { result } = renderHook(() => useStartLayout())
    expect(result.current[0]).toEqual(DEFAULT_START_LAYOUT)
  })
})
