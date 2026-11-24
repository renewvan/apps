import { hmacSha256Hex } from './hmac'

// The firmware's vectors (renewvan/driver-esp32 tests/test_ble_command.py), as in core's boardBle tests.
const secret = 'correct horse battery'

describe('hmacSha256Hex', () => {
  it.each([
    ['0011223344556677|01|on', 'cd08404b0e1cd9ba47dffbfd9b1fc780fbf5e195a53d1d74e1996fba583a5dfe'],
    ['0011223344556677|03|off', '418594107f646b73516495d9d6169677af69429baf3ef0aba5a86639043f9a0a'],
  ])('signs %s as the firmware does', async (message, mac) => {
    expect(await hmacSha256Hex(secret, message)).toBe(mac)
  })
})
