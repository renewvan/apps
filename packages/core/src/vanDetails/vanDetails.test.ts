import { describe, expect, it } from 'vite-plus/test'
import { EMPTY_VAN_DETAILS, readVanDetails } from './vanDetails'

describe('readVanDetails', () => {
  it('reads nothing usable as every field empty', () => {
    for (const stored of [undefined, null, 'x', 4]) {
      expect(readVanDetails(stored)).toEqual(EMPTY_VAN_DETAILS)
    }
  })

  it('keeps each text field and the valid ones when another has the wrong type', () => {
    expect(readVanDetails({ name: 'Bluey', plate: 7, kms: '12 000 km' })).toEqual({
      ...EMPTY_VAN_DETAILS,
      name: 'Bluey',
      kms: '12 000 km',
    })
  })

  it('keeps a #rrggbb colour (any case) and drops anything else', () => {
    expect(readVanDetails({ color: '#ef4444' }).color).toBe('#ef4444')
    expect(readVanDetails({ color: '#EF4444' }).color).toBe('#EF4444')
    for (const color of ['red; x', '#fff', 'ef4444', 3]) {
      expect(readVanDetails({ color }).color).toBe('')
    }
  })
})
