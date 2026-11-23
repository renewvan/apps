import { RELAY_ICON_NAMES, TANK_ICON_NAMES, TEMPERATURE_ICON_NAMES } from '@renewvan/core/icons'
import { entityIcon } from './entityIcons'

// Jest does not transform lucide's ESM build: each icon stands in as its own name.
jest.mock('lucide-react-native', () => new Proxy({}, { get: (_target, name) => name }))

describe('entityIcon', () => {
  it('has a component for every name a Settings picker offers', () => {
    const names = [...TEMPERATURE_ICON_NAMES, ...TANK_ICON_NAMES, ...RELAY_ICON_NAMES]
    expect(names.filter((name) => entityIcon(name) === undefined)).toEqual([])
  })

  it('reads a name it does not know as no choice', () => {
    expect(entityIcon('NotAnIcon')).toBeUndefined()
    expect(entityIcon(undefined)).toBeUndefined()
  })
})
