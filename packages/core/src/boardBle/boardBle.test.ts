import { describe, expect, it } from 'vite-plus/test'
import {
  BOARD_BLE_COMMAND,
  BOARD_BLE_INFO,
  BOARD_BLE_NONCE,
  BOARD_BLE_RESULT,
  BOARD_BLE_SERVICE,
  BOARD_BLE_STATES,
  allowedAction,
  isNonce,
  parseInfo,
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
const nonce = '00112233445566778899aabbccddeeff'

describe('the UUIDs', () => {
  it('are the service and its characteristics, 7e1a00XX', () => {
    expect(BOARD_BLE_SERVICE).toBe('7e1a0001-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_COMMAND).toBe('7e1a0002-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_STATES).toBe('7e1a0003-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_RESULT).toBe('7e1a0004-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_NONCE).toBe('7e1a0005-6f6e-4f3a-9c10-52656e657776')
    expect(BOARD_BLE_INFO).toBe('7e1a0006-6f6e-4f3a-9c10-52656e657776')
  })
})

describe('parseInfo', () => {
  it('reads the Driver key, Hub power and the Direct control channels', () => {
    expect(parseInfo('esp32-van|van-01|van-03,van-04')).toEqual({
      driver: 'esp32-van',
      hubPower: 'van-01',
      direct: ['van-03', 'van-04'],
    })
  })

  it('reads a board with no Hub power and no Direct control', () => {
    expect(parseInfo('esp32-van||')).toEqual({ driver: 'esp32-van', hubPower: null, direct: [] })
  })

  it.each([
    ['empty', ''],
    ['two fields', 'esp32-van|van-01'],
    ['four fields', 'esp32-van|van-01|van-03|x'],
    ['no Driver key', '|van-01|van-03'],
    ['an empty channel', 'esp32-van|van-01|van-03,,van-04'],
    ['a trailing comma', 'esp32-van|van-01|van-03,'],
    ['an = in a relay id', 'esp32-van|van=01|'],
    ['Hub power listed as a Direct control channel', 'esp32-van|van-01|van-01'],
  ])('is null with %s', (_, text) => {
    expect(parseInfo(text)).toBeNull()
  })
})

describe('parseStates', () => {
  it('reads each relay id and whether it is on', () => {
    expect(parseStates('van-01=on,van-03=off,van-04=on')).toEqual({
      'van-01': true,
      'van-03': false,
      'van-04': true,
    })
  })

  it('is empty when the board has no channels', () => {
    expect(parseStates('')).toEqual({})
  })

  it('skips malformed entries, as a notification cut to the link MTU ends', () => {
    expect(parseStates('van-01=on,bad,=on,van-02=maybe,van-03=of')).toEqual({ 'van-01': true })
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
  it('takes 32 lowercase hex characters', () => {
    expect(isNonce(nonce)).toBe(true)
  })

  it.each([
    ['short', nonce.slice(1)],
    ['long', `${nonce}0`],
    ['uppercase', nonce.toUpperCase()],
    ['not hex', `${nonce.slice(1)}g`],
    ['empty', ''],
  ])('refuses one %s', (_, text) => {
    expect(isNonce(text)).toBe(false)
  })
})

describe('signedCommand', () => {
  it('matches the contract vector for on', async () => {
    expect(await signedCommand(hmac, secret, nonce, 'relay-x8-01', true)).toBe(
      '00112233445566778899aabbccddeeff|relay-x8-01|on|3905f16dc4bedab084df5e7e5430e43511a3b6750e15032c8c26a4c4e470d143',
    )
  })

  it('matches the contract vector for off', async () => {
    expect(await signedCommand(hmac, secret, nonce, 'relay-x8-03', false)).toBe(
      '00112233445566778899aabbccddeeff|relay-x8-03|off|e8cbfa365a8e7baebd125b039e6cd07df5225be5523d4bd17bf7ae41b2172a58',
    )
  })

  it('signs the first three fields exactly as written, with the secret as the key', async () => {
    const calls: [string, string][] = []
    const spy: HmacSha256Hex = async (key, message) => {
      calls.push([key, message])
      return 'ab'.repeat(32)
    }
    await signedCommand(spy, secret, nonce, 'van-03', false)
    expect(calls).toEqual([[secret, `${nonce}|van-03|off`]])
  })

  it.each([
    ['a bad nonce', secret, 'nope', 'van-03'],
    ['an empty secret', '', nonce, 'van-03'],
    ['an empty relay id', secret, nonce, ''],
    ['a | in the relay id', secret, nonce, 'van|03'],
    ['a , in the relay id', secret, nonce, 'van,03'],
    ['a = in the relay id', secret, nonce, 'van=03'],
  ])('rejects %s', async (_, key, n, relayId) => {
    await expect(signedCommand(hmac, key, n, relayId, true)).rejects.toThrow()
  })

  it('rejects a MAC that is not 64 lowercase hex characters', async () => {
    const bad: HmacSha256Hex = async () => 'AB'.repeat(32)
    await expect(signedCommand(bad, secret, nonce, 'van-03', true)).rejects.toThrow(/MAC/)
  })
})

describe('allowedAction', () => {
  const info: BoardInfo = { driver: 'esp32-van', hubPower: 'van-01', direct: ['van-03', 'van-04'] }

  it('allows Hub wake: Hub power on', () => {
    expect(allowedAction(info, 'van-01', true)).toBe(true)
  })

  it('refuses Hub power off', () => {
    expect(allowedAction(info, 'van-01', false)).toBe(false)
  })

  it('allows a Direct control channel on and off', () => {
    expect(allowedAction(info, 'van-03', true)).toBe(true)
    expect(allowedAction(info, 'van-04', false)).toBe(true)
  })

  it('refuses a relay id the board does not list', () => {
    expect(allowedAction(info, 'van-02', true)).toBe(false)
    expect(allowedAction(info, 'van-02', false)).toBe(false)
  })

  it('refuses everything on a board with no Hub power and no Direct control', () => {
    expect(allowedAction({ driver: 'esp32-van', hubPower: null, direct: [] }, 'van-01', true)).toBe(
      false,
    )
  })
})
