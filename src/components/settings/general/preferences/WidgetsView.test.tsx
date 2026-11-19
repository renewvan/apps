import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vite-plus/test'
import { renderSettings } from '@/test/renderSettings'

async function openWidgets(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: /^General/ }))
  await user.click(screen.getByRole('button', { name: /^Display/ }))
  await user.click(screen.getByRole('button', { name: /^Widgets/ }))
}

const rowOrder = () =>
  Array.from(document.querySelectorAll('li[data-widget-row]'), (li) =>
    li.getAttribute('data-widget-row'),
  )

const rowOf = (id: string) => document.querySelector<HTMLElement>(`li[data-widget-row="${id}"]`)!

describe('Settings › General › Display & Appearance › Widgets', () => {
  it('is reached from Display & Appearance and sits under it in the breadcrumb', async () => {
    const { user } = renderSettings()
    await openWidgets(user)

    expect(screen.getByRole('button', { name: 'Display & Appearance' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Widgets' })).toBeInTheDocument()
  })

  it('lists the shown widgets in order with their position, a divider, then the hidden ones', async () => {
    const { user } = renderSettings({ startLayout: ['tilt', 'weather'] })
    await openWidgets(user)

    expect(rowOrder().slice(0, 4)).toEqual(['tilt', 'weather', 'divider', 'map'])
    expect(rowOf('tilt')).toHaveTextContent('Position 1 of 2')
    expect(rowOf('weather')).toHaveTextContent('Position 2 of 2')
    expect(rowOf('map')).toHaveTextContent('Hidden')
    expect(rowOf('divider')).toHaveTextContent('Hidden. Drag a widget below to hide it')
  })

  it('lists Power flow and Battery as two widgets', async () => {
    const { user } = renderSettings({ startLayout: ['tilt'] })
    await openWidgets(user)

    expect(rowOrder()).toEqual(expect.arrayContaining(['power-flow', 'battery']))
    expect(rowOf('power-flow')).toHaveTextContent('Power flow')
    expect(rowOf('battery')).toHaveTextContent('Battery')
  })

  it('has every widget above the divider on the shipped page', async () => {
    const { user } = renderSettings()
    await openWidgets(user)

    expect(rowOrder().at(-1)).toBe('divider')
  })

  it('disables Reset on the shipped page, and restores it from a customised one', async () => {
    const first = renderSettings()
    await openWidgets(first.user)
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeDisabled()
    first.unmount()

    const { user, value } = renderSettings({ startLayout: ['tilt'] })
    await openWidgets(user)
    await user.click(screen.getByRole('button', { name: 'Reset to default' }))

    expect(value.setStartLayout).toHaveBeenCalledWith([
      'weather',
      'map',
      'power-flow',
      'battery',
      'heater',
      'solar',
      'tilt',
      'fresh-water',
      'grey-water',
    ])
  })
})

describe('Settings › General › Display & Appearance › Widgets › switches', () => {
  it('has a switch per widget, on for the shown ones', async () => {
    const { user } = renderSettings({ startLayout: ['weather', 'tilt'] })
    await openWidgets(user)

    expect(screen.getByRole('switch', { name: 'Show Tilt' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Show Map' })).not.toBeChecked()
    expect(screen.getAllByRole('switch')).toHaveLength(9)
  })

  it('hides the widget when switched off', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'tilt', 'map'] })
    await openWidgets(user)
    await user.click(screen.getByRole('switch', { name: 'Show Tilt' }))

    expect(value.setStartLayout).toHaveBeenCalledWith(['weather', 'map'])
  })

  it('adds a hidden widget at the end when switched on', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather'] })
    await openWidgets(user)
    await user.click(screen.getByRole('switch', { name: 'Show Tilt' }))

    expect(value.setStartLayout).toHaveBeenCalledWith(['weather', 'tilt'])
  })

  it('counts one tap that reaches the switch twice as one change', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'tilt'] })
    await openWidgets(user)
    const tilt = screen.getByRole('switch', { name: 'Show Tilt' })
    await user.click(tilt)
    await user.click(tilt)

    expect(value.setStartLayout).toHaveBeenCalledTimes(1)
    expect(value.setStartLayout).toHaveBeenCalledWith(['weather'])
  })

  it('opens no page of its own from a row', async () => {
    const { user } = renderSettings({ startLayout: ['weather', 'tilt'] })
    await openWidgets(user)

    expect(within(rowOf('tilt')).queryByRole('button', { name: /^Tilt/ })).not.toBeInTheDocument()
  })
})

describe('Settings › General › Display & Appearance › Widgets › reordering', () => {
  /** jsdom has no layout: give each slot a 64px box on a 72px pitch. */
  function layOutRows() {
    document.querySelectorAll<HTMLElement>('li[data-widget-row]').forEach((li, i) => {
      li.getBoundingClientRect = () =>
        ({
          top: i * 72,
          height: 64,
          bottom: i * 72 + 64,
          left: 0,
          right: 300,
          width: 300,
        }) as DOMRect
    })
  }

  it('drags a widget down by its grip and commits the new order on release', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'map', 'tilt'] })
    await openWidgets(user)
    layOutRows()

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('button', { name: 'Reorder Weather' }),
        coords: { clientY: 32 },
      },
      { coords: { clientY: 100 } },
      { coords: { clientY: 176 } },
    ])
    // Nothing is committed while the pointer is down.
    expect(value.setStartLayout).not.toHaveBeenCalled()
    await user.pointer({ keys: '[/MouseLeft]' })

    expect(value.setStartLayout).toHaveBeenCalledWith(['map', 'tilt', 'weather'])
  })

  it('drags a widget up', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'map', 'tilt'] })
    await openWidgets(user)
    layOutRows()

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('button', { name: 'Reorder Tilt' }),
        coords: { clientY: 176 },
      },
      { coords: { clientY: 100 } },
      { keys: '[/MouseLeft]' },
    ])

    expect(value.setStartLayout).toHaveBeenCalledWith(['weather', 'tilt', 'map'])
  })

  it('hides a widget dragged below the divider', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'map', 'tilt'] })
    await openWidgets(user)
    layOutRows()

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('button', { name: 'Reorder Map' }),
        coords: { clientY: 104 },
      },
      { coords: { clientY: 200 } },
      { coords: { clientY: 248 } },
      { keys: '[/MouseLeft]' },
    ])

    expect(value.setStartLayout).toHaveBeenCalledWith(['weather', 'tilt'])
  })

  it('shows a hidden widget dragged above the divider', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'map'] })
    await openWidgets(user)
    layOutRows()

    // Slots: weather, map, divider, then the hidden widgets; Power flow is slot 3.
    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('button', { name: 'Reorder Power flow' }),
        coords: { clientY: 248 },
      },
      { coords: { clientY: 100 } },
      { coords: { clientY: 40 } },
      { keys: '[/MouseLeft]' },
    ])

    expect(value.setStartLayout).toHaveBeenCalledWith(['power-flow', 'weather', 'map'])
  })

  it('changes nothing when the widget is dropped back where it was', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'map', 'tilt'] })
    await openWidgets(user)
    layOutRows()

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByRole('button', { name: 'Reorder Map' }),
        coords: { clientY: 104 },
      },
      { coords: { clientY: 150 } },
      { coords: { clientY: 106 } },
      { keys: '[/MouseLeft]' },
    ])

    expect(value.setStartLayout).not.toHaveBeenCalled()
    expect(rowOrder().slice(0, 3)).toEqual(['weather', 'map', 'tilt'])
  })

  it('moves a widget with the arrow keys on its grip', async () => {
    const { user, value } = renderSettings({ startLayout: ['weather', 'map', 'tilt'] })
    await openWidgets(user)

    screen.getByRole('button', { name: 'Reorder Map' }).focus()
    await user.keyboard('{ArrowDown}')
    expect(value.setStartLayout).toHaveBeenLastCalledWith(['weather', 'tilt', 'map'])

    await user.keyboard('{ArrowUp}')
    expect(value.setStartLayout).toHaveBeenLastCalledWith(['map', 'weather', 'tilt'])
  })

  it('gives a hidden widget a grip too, and no grip to the divider', async () => {
    const { user } = renderSettings({ startLayout: ['weather'] })
    await openWidgets(user)

    expect(screen.getByRole('button', { name: 'Reorder Tilt' })).toBeInTheDocument()
    expect(within(rowOf('divider')).queryByRole('button')).not.toBeInTheDocument()
  })
})
