import {
  DEFAULT_PREFERENCES,
  DEFAULT_HOME_LAYOUT,
  homeLayoutOf,
  homeLayoutWithAvailable,
  shownWidgets,
  isDefaultLayout,
  layoutAfterDrop,
  moved,
  parsePreferences,
} from './preferences'

describe('parsePreferences', () => {
  it('gives the defaults when nothing, or nothing readable, was stored', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('not json')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('[1,2]')).toEqual(DEFAULT_PREFERENCES)
  })

  it('reads back what was stored', () => {
    const stored = {
      theme: 'dark',
      homeLayout: { order: ['heater', 'energy'], hidden: ['map'] },
      pageLayouts: {
        energy: { order: ['battery', 'power'], hidden: ['chargers'] },
        temperature: { order: [], hidden: ['pi_cpu'] },
      },
      devicesSort: 'entity',
      powerLayout: 'van-orbs',
      alertsEnabled: false,
      van: {
        name: 'Olga',
        brand: 'Fiat',
        model: 'Ducato',
        kms: '120000',
        plate: 'FR-RV 1',
        color: '#ef4444',
      },
    }
    expect(parsePreferences(JSON.stringify(stored))).toEqual(stored)
  })

  it('carries the hidden temperature sensors of an older version into the Temperature layout', () => {
    const parsed = parsePreferences(JSON.stringify({ hiddenTemperatures: ['pi_cpu', 3] }))
    expect(parsed.pageLayouts).toEqual({ temperature: { order: [], hidden: ['pi_cpu'] } })
  })

  it('checks each field on its own, so one bad value does not lose the rest', () => {
    const parsed = parsePreferences(
      JSON.stringify({
        theme: 'sepia',
        devicesSort: 'entity',
        van: { name: 'Olga', kms: 12, color: 'red' },
      }),
    )
    expect(parsed.theme).toBe('system')
    expect(parsed.devicesSort).toBe('entity')
    expect(parsed.powerLayout).toBe('van-tiles')
    expect(parsed.homeLayout).toEqual(DEFAULT_HOME_LAYOUT)
    expect(parsed.van).toEqual({
      name: 'Olga',
      brand: '',
      model: '',
      kms: '',
      plate: '',
      color: '',
    })
  })

  it('discards the old startLayout and keeps only known widgets', () => {
    expect(parsePreferences('{"startLayout":["heater"]}').homeLayout).toEqual(DEFAULT_HOME_LAYOUT)
    const read = (homeLayout: unknown) => parsePreferences(JSON.stringify({ homeLayout }))
    expect(
      read({ order: ['tilt', 'group-van', 'status', 'tilt', 'map'], hidden: 3 }).homeLayout,
    ).toEqual({
      order: ['tilt', 'map'],
      hidden: [],
    })
  })
})

describe('shownWidgets', () => {
  const ALL = ['weather', 'map', 'energy', 'heater', 'solar', 'tilt', 'fresh-water', 'grey-water']

  it('shows every widget in the default order', () => {
    expect(shownWidgets(DEFAULT_HOME_LAYOUT)).toEqual(ALL)
  })

  it('places a default widget new in a release at its default position', () => {
    const stored = { order: ['map', 'energy', 'tilt'], hidden: [] } as const
    expect(shownWidgets(stored)).toEqual(ALL)
  })

  it('does not bring back a hidden widget', () => {
    expect(shownWidgets({ order: ['map', 'solar'], hidden: ['solar'] })).not.toContain('solar')
  })

  it('round-trips through homeLayoutOf', () => {
    expect(shownWidgets(homeLayoutOf(['tilt', 'map']))).toEqual(['tilt', 'map'])
  })
})

describe('homeLayoutWithAvailable', () => {
  it('edits available widgets without changing unavailable ones in the saved layout', () => {
    const saved = homeLayoutOf(['fresh-water', 'solar', 'map', 'heater'])
    const next = homeLayoutWithAvailable(
      saved,
      ['solar', 'map', 'energy'],
      ['map', 'energy', 'solar'],
    )
    expect(shownWidgets(next)).toEqual(['map', 'heater', 'energy', 'fresh-water', 'solar'])

    const hiddenUnavailable = homeLayoutWithAvailable(
      homeLayoutOf(['solar']),
      ['solar', 'map'],
      ['solar'],
    )
    expect(shownWidgets(hiddenUnavailable)).toEqual(['solar'])
  })
})

describe('homeLayoutWithAvailable, unavailable neighbours', () => {
  it('keeps an unavailable widget before the available one it preceded when the first is hidden', () => {
    const next = homeLayoutWithAvailable(
      homeLayoutOf(['solar', 'fresh-water', 'map']),
      ['solar', 'map'],
      ['map'],
    )
    expect(shownWidgets(next)).toEqual(['fresh-water', 'map'])
  })

  it('keeps it after the available one it trailed when that one moves', () => {
    const next = homeLayoutWithAvailable(
      homeLayoutOf(['solar', 'map', 'fresh-water']),
      ['solar', 'map'],
      ['map', 'solar'],
    )
    expect(shownWidgets(next)).toEqual(['map', 'fresh-water', 'solar'])
  })
})

describe('powerLayout', () => {
  it('keeps a layout the app draws and falls back to Van tiles for any other', () => {
    const layout = (powerLayout: unknown) =>
      parsePreferences(JSON.stringify({ powerLayout })).powerLayout
    expect(layout('van-orbs')).toBe('van-orbs')
    // The dashboard's layouts without the van are not drawn here.
    expect(layout('orbs')).toBe('van-tiles')
    expect(layout(3)).toBe('van-tiles')
  })
})

describe('alertsEnabled', () => {
  it('is on unless it was switched off', () => {
    const enabled = (alertsEnabled: unknown) =>
      parsePreferences(JSON.stringify({ alertsEnabled })).alertsEnabled
    expect(enabled(false)).toBe(false)
    expect(enabled(true)).toBe(true)
    expect(enabled('no')).toBe(true)
    expect(parsePreferences(null).alertsEnabled).toBe(true)
  })
})

describe('layoutAfterDrop', () => {
  const layout = ['solar', 'map', 'tilt'] as const
  // slots: solar, map, tilt, divider, then the other widgets as shipped
  it('reorders within the shown widgets', () => {
    expect(layoutAfterDrop(layout, 0, 2)).toEqual(['map', 'tilt', 'solar'])
  })

  it('shows a hidden widget dropped above the divider, at that place', () => {
    expect(layoutAfterDrop(layout, 7, 1)).toEqual(['solar', 'heater', 'map', 'tilt'])
  })

  it('hides a shown widget dropped below the divider', () => {
    expect(layoutAfterDrop(layout, 0, 3)).toEqual(['map', 'tilt'])
  })

  it('drags within a catalogue filtered to the available widgets', () => {
    expect(layoutAfterDrop(['solar', 'map'], 3, 0, ['solar', 'map', 'heater'])).toEqual([
      'heater',
      'solar',
      'map',
    ])
  })

  it('changes nothing for the divider, a hidden widget moved among the hidden, or a drop in place', () => {
    expect(layoutAfterDrop(layout, 3, 0)).toBe(layout)
    expect(layoutAfterDrop(layout, 4, 6)).toBe(layout)
    expect(layoutAfterDrop(layout, 1, 1)).toBe(layout)
  })
})

describe('moved', () => {
  it('moves one item and leaves the rest in order', () => {
    expect(moved(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd'])
    expect(moved(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('returns the same list for a move that goes nowhere or out of range', () => {
    const list = ['a', 'b']
    expect(moved(list, 0, 0)).toBe(list)
    expect(moved(list, 0, 2)).toBe(list)
    expect(moved(list, -1, 1)).toBe(list)
  })
})

describe('isDefaultLayout', () => {
  it('is true only for the shipped widgets in the shipped order', () => {
    const shown = shownWidgets(DEFAULT_HOME_LAYOUT)
    expect(isDefaultLayout(DEFAULT_HOME_LAYOUT)).toBe(true)
    expect(isDefaultLayout(homeLayoutOf(moved(shown, 0, 1)))).toBe(false)
    expect(isDefaultLayout(homeLayoutOf(shown.slice(1)))).toBe(false)
  })
})
