import { EMPTY_WINTER_MEMORY } from '@renewvan/core/winterMode'
import { parseWinterMemory } from './winterMemory'

describe('parseWinterMemory', () => {
  it('reads what was stored', () => {
    const memory = {
      winterMode: true,
      hubPower: { driver: 'esp32-van', relayId: 'van-01' },
      wakeSent: true,
    }
    expect(parseWinterMemory(JSON.stringify(memory))).toEqual(memory)
  })

  it('reads a memory stored before a sent wake was kept', () => {
    const memory = { winterMode: true, hubPower: { driver: 'esp32-van', relayId: 'van-01' } }
    expect(parseWinterMemory(JSON.stringify(memory))).toEqual({ ...memory, wakeSent: false })
  })

  it.each([null, '', 'nope', '[]', '{"winterMode":"yes","hubPower":{"driver":1}}'])(
    'is empty for %p',
    (raw) => {
      expect(parseWinterMemory(raw)).toEqual(EMPTY_WINTER_MEMORY)
    },
  )
})
