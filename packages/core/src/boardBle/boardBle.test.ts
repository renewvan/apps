import { describe, expect, it } from 'vite-plus/test'
import {
  BOARD_BLE_BOARD,
  BOARD_BLE_CHANNELS,
  BOARD_BLE_COMMAND,
  BOARD_BLE_NONCE,
  BOARD_BLE_RESULT,
  BOARD_BLE_SERVICE,
  BOARD_BLE_STATES,
  allowedAction,
  isNonce,
  parseBoardInfo,
  parseResult,
  parseStates,
  signedCommand,
  type BoardInfo,
  type HmacSha256Hex,
} from './boardBle'

// The app's HMAC primitive, here Node's. Core has no Node types, so the module is loaded by a
// non-literal specifier and typed by hand: core itself never imports a crypto library.
interface NodeCrypto {
  createHmac: (
    algorithm: string,
    key: string,
  ) => { update: (data: string) => { digest: (encoding: 'hex') => string } }
}
const nodeCrypto = 'node:crypto'
const hmac: HmacSha256Hex = async (key, message) => {
  const { createHmac } = (await import(nodeCrypto)) as NodeCrypto
  return createHmac('sha256', key).update(message).digest('hex')
}

const secret = 'correct horse battery'
const nonce = '0011223344556677'
// The board in the firmware's test vectors (renewvan/driver-esp32 tests/test_ble_command.py).
const x8: BoardInfo = {
  board: 'relay-x8',
  driver: 'esp32-relay-x8',
  hubPower: 'relay-x8-01',
  direct: ['relay-x8-03', 'relay-x8-04'],
}

describe('the UUIDs', () => {
  it('are the service and its characteristics, 7e1a00XX', () => {
    expect(BOARD_BLE_SERVICE).toBe('7e1a0001-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_COMMAND).toBe('7e1a0002-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_STATES).toBe('7e1a0003-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_RESULT).toBe('7e1a0004-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_NONCE).toBe('7e1a0005-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_CHANNELS).toBe('7e1a0006-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_BOARD).toBe('7e1a0007-6f6e-4f3a-9c10-52656e657776')
  })
})

describe('parseBoardInfo', () => {
  it('turns Hub power and the Direct control mask into relay ids', () => {
    expect(parseBoardInfo('relay-x8', '01|000c')).toEqual(x8)
  })

  it('reads channels 10 to 16 and lists them by number', () => {
    expect(parseBoardInfo('van', '|8201')?.direct).toEqual(['van-01', 'van-10', 'van-16'])
    expect(parseBoardInfo('van', '16|0201')?.hubPower).toBe('van-16')
  })

  it('reads a board with no Hub power and no Direct control', () => {
    expect(parseBoardInfo('van', '|0000')).toEqual({
      board: 'van',
      driver: 'esp32-van',
      hubPower: null,
      direct: [],
    })
  })

  it.each([
    ['an empty board name', '', '01|000c'],
    ['a board name with a separator', 'van|x', '01|000c'],
    ['empty channels', 'van', ''],
    ['no separator', 'van', '01000c'],
    ['three fields', 'van', '01|000c|x'],
    ['channel 00', 'van', '00|000c'],
    ['channel 17', 'van', '17|000c'],
    ['a one-digit channel', 'van', '1|000c'],
    ['a short mask', 'van', '01|00c'],
    ['an uppercase mask', 'van', '01|000C'],
    ['Hub power also in the mask', 'van', '01|0001'],
  ])('is null with %s', (_, board, channels) => {
    expect(parseBoardInfo(board, channels)).toBeNull()
  })
})

describe('parseStates', () => {
  it('reads Hub power and each Direct control channel from the mask', () => {
    expect(parseStates(x8, '0005')).toEqual({
      'relay-x8-01': true,
      'relay-x8-03': true,
      'relay-x8-04': false,
    })
  })

  it('ignores bits of channels the board does not open', () => {
    expect(parseStates(x8, 'fff2')).toEqual({
      'relay-x8-01': false,
      'relay-x8-03': false,
      'relay-x8-04': false,
    })
  })

  it.each([
    ['empty', ''],
    ['cut short', '00'],
    ['not hex', '00zz'],
  ])('is empty when %s', (_, text) => {
    expect(parseStates(x8, text)).toEqual({})
  })
})

describe('parseResult', () => {
  it.each(['ok', 'stale', 'denied', 'refused', 'locked'] as const)('reads %s', (result) => {
    expect(parseResult(result)).toBe(result)
  })

  it.each([
    ['empty (no write since boot)', ''],
    ['unknown', 'maybe'],
    ['padded', ' ok'],
  ])('is null when %s', (_, text) => {
    expect(parseResult(text)).toBeNull()
  })
})

describe('isNonce', () => {
  it('takes 16 lowercase hex characters', () => {
    expect(isNonce(nonce)).toBe(true)
    expect(isNonce('aabbccddeeff0011')).toBe(true)
  })

  it.each([
    ['short', nonce.slice(1)],
    ['long', `${nonce}0`],
    ['uppercase', 'AABBCCDDEEFF0011'],
    ['not hex', `${nonce.slice(1)}g`],
    ['empty', ''],
  ])('refuses one %s', (_, text) => {
    expect(isNonce(text)).toBe(false)
  })
})

describe('signedCommand', () => {
  it('matches the firmware vector for Hub wake', async () => {
    expect(await signedCommand(hmac, secret, nonce, x8, 'relay-x8-01', true)).toBe(
      '0011223344556677|01|on|cd08404b0e1cd9ba47dffbfd9b1fc780fbf5e195a53d1d74e1996fba583a5dfe',
    )
  })

  it('matches the firmware vector for Direct control off', async () => {
    expect(await signedCommand(hmac, secret, nonce, x8, 'relay-x8-03', false)).toBe(
      '0011223344556677|03|off|418594107f646b73516495d9d6169677af69429baf3ef0aba5a86639043f9a0a',
    )
  })

  it('signs the first three fields exactly as written, with the secret as the key', async () => {
    const calls: [string, string][] = []
    const spy: HmacSha256Hex = async (key, message) => {
      calls.push([key, message])
      return 'ab'.repeat(32)
    }
    await signedCommand(spy, secret, nonce, x8, 'relay-x8-03', false)
    expect(calls).toEqual([[secret, `${nonce}|03|off`]])
  })

  it.each([
    ['a bad nonce', secret, 'nope', 'relay-x8-03'],
    ['an empty secret', '', nonce, 'relay-x8-03'],
    ['an empty relay id', secret, nonce, ''],
    ["another board's relay id", secret, nonce, 'relay-x16-03'],
    ['channel 17', secret, nonce, 'relay-x8-17'],
    ['a one-digit channel', secret, nonce, 'relay-x8-3'],
  ])('rejects %s', async (_, key, n, relayId) => {
    await expect(signedCommand(hmac, key, n, x8, relayId, true)).rejects.toThrow()
  })

  it('rejects a MAC that is not 64 lowercase hex characters', async () => {
    const bad: HmacSha256Hex = async () => 'AB'.repeat(32)
    await expect(signedCommand(bad, secret, nonce, x8, 'relay-x8-03', true)).rejects.toThrow(/MAC/)
  })
})

describe('allowedAction', () => {
  it('allows Hub wake: Hub power on', () => {
    expect(allowedAction(x8, 'relay-x8-01', true)).toBe(true)
  })

  it('refuses Hub power off', () => {
    expect(allowedAction(x8, 'relay-x8-01', false)).toBe(false)
  })

  it('allows a Direct control channel on and off', () => {
    expect(allowedAction(x8, 'relay-x8-03', true)).toBe(true)
    expect(allowedAction(x8, 'relay-x8-04', false)).toBe(true)
  })

  it('refuses a relay id the board does not list', () => {
    expect(allowedAction(x8, 'relay-x8-02', true)).toBe(false)
    expect(allowedAction(x8, 'relay-x8-02', false)).toBe(false)
  })

  it('refuses everything on a board with no Hub power and no Direct control', () => {
    const none = { ...x8, hubPower: null, direct: [] }
    expect(allowedAction(none, 'relay-x8-01', true)).toBe(false)
  })
})
