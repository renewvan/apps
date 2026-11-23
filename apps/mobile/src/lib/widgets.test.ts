import { emptyRenewvanBusState, type RenewvanBusState } from '@/types'
import { capabilitiesOf } from './capabilities'
import { DEFAULT_WIDGET_IDS, WIDGETS, widgetAvailability, type WidgetId } from './widgets'

const withState = (partial: Partial<RenewvanBusState>, settled = true) =>
  capabilitiesOf({ ...emptyRenewvanBusState, ...partial }, settled)
const rec = { a: {} as never }

describe('catalogue', () => {
  it("turns on the dashboard's phone Start page, in its order", () => {
    expect(DEFAULT_WIDGET_IDS).toEqual([
      'weather',
      'map',
      'energy',
      'heater',
      'solar',
      'tilt',
      'fresh-water',
      'grey-water',
    ])
  })

  it('adds Temperature after Weather, off by default', () => {
    expect(WIDGETS.map((w) => w.id).slice(0, 3)).toEqual(['weather', 'temperature', 'map'])
    expect(WIDGETS.find((w) => w.id === 'temperature')?.defaultOn).toBe(false)
  })

  it('has unique ids and a label for each', () => {
    const ids = WIDGETS.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const w of WIDGETS) expect(w.label).not.toBe('')
  })
})

describe('widgetAvailability', () => {
  const availability = (id: WidgetId, caps: ReturnType<typeof withState>) =>
    widgetAvailability(id, caps)

  it('keeps the map and the weather always available, even on an empty van', () => {
    expect(availability('map', withState({}))).toBe('available')
    expect(availability('map', withState({}, false))).toBe('available')
    expect(availability('weather', withState({}))).toBe('available')
  })

  it('an empty van makes every other widget unavailable; before settling they are loading', () => {
    expect(availability('energy', withState({}))).toBe('unavailable')
    expect(availability('energy', withState({}, false))).toBe('loading')
  })

  it('energy needs any power device; solar needs solar', () => {
    expect(availability('energy', withState({ solar: rec }))).toBe('available')
    expect(availability('energy', withState({ batteries: rec }))).toBe('available')
    expect(availability('solar', withState({ batteries: rec }))).toBe('unavailable')
    expect(availability('solar', withState({ solar: rec }))).toBe('available')
  })

  it('temperature needs a temperature sensor', () => {
    expect(availability('temperature', withState({}))).toBe('unavailable')
    expect(availability('temperature', withState({ temperatures: rec }))).toBe('available')
  })

  it('fresh and grey water both need a tank', () => {
    const caps = withState({ tanks: rec })
    expect(availability('fresh-water', caps)).toBe('available')
    expect(availability('grey-water', caps)).toBe('available')
  })

  it('an offline Driver is not absent: its widget stays available', () => {
    const caps = withState({
      drivers: {
        tilt: {
          health: 'offline',
          info: { driver: 'tilt', product: 't', source: 's', version: 'v1', publishes: ['tilt'] },
        },
      },
    })
    expect(availability('tilt', caps)).toBe('available')
  })
})
