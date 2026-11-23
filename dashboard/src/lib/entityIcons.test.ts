import { RELAY_ICON_NAMES, TANK_ICON_NAMES, TEMPERATURE_ICON_NAMES } from '@renewvan/core/icons'
import { describe, expect, it } from 'vite-plus/test'
import { entityIcon } from './entityIcons'

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
