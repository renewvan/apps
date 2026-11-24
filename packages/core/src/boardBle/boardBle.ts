// The relay board's BLE message format (hub ADR 0034): Hub wake and Direct control from the phone
// when the Renewvan bus is unreachable. Transport-free: the app owns the Bluetooth stack and the
// HMAC primitive (injected as `HmacSha256Hex`); this reads and writes the characteristics' text.
// The firmware side is renewvan/driver-esp32 `packages/ble-wake.yaml`. Every readable value is at
// most 22 bytes (the board's read limit), so channels travel as numbers and bitmasks, and this
// module turns them into relay ids (`<board>-<nn>`).

const uuid = (xx: string) => `7e1a00${xx}-6f6e-4f3a-9c10-52656e657776`

/** The relay board's BLE service. */
export const BOARD_BLE_SERVICE = uuid('01')
/** Write: `<nonce>|<nn>|<on|off>|<mac>`, built by `signedCommand`. */
export const BOARD_BLE_COMMAND = uuid('02')
/** Read, notify: which of the board's open channels are on, read by `parseStates`. */
export const BOARD_BLE_STATES = uuid('03')
/** Read, notify: the verdict on the last command write, read by `parseResult`. */
export const BOARD_BLE_RESULT = uuid('04')
/** Read: the single-use nonce the next command must name (`isNonce`). */
export const BOARD_BLE_NONCE = uuid('05')
/** Read: Hub power and the Direct control channels, read by `parseBoardInfo`. */
export const BOARD_BLE_CHANNELS = uuid('06')
/** Read: the board's name, read by `parseBoardInfo`. */
export const BOARD_BLE_BOARD = uuid('07')

/**
 * HMAC-SHA256 of `message` keyed with `key` (both UTF-8), as 64 lowercase hex characters. The app
 * supplies it from its own crypto library; core imports none.
 */
export type HmacSha256Hex = (key: string, message: string) => Promise<string>

/** What a board accepts over BLE, from its `board` and `channels` characteristics. */
export interface BoardInfo {
  /** The board's name: its relay ids are `<board>-<nn>`. */
  board: string
  /** The board's Driver key, `esp32-<board>` (its BLE name may be cut to 20 characters). */
  driver: string
  /** The Hub power relay id, which only takes `on` (Hub wake); null when the board has none. */
  hubPower: string | null
  /** The Direct control channels' relay ids, which take `on` and `off`, by channel number. */
  direct: string[]
}

/** The board's verdict on the last command write. */
export type BoardResult = 'ok' | 'stale' | 'denied' | 'refused' | 'locked'

const RESULTS: readonly string[] = ['ok', 'stale', 'denied', 'refused', 'locked']

const NONCE = /^[0-9a-f]{16}$/
const MAC = /^[0-9a-f]{64}$/
const MASK = /^[0-9a-f]{4}$/
const CHANNEL = /^(0[1-9]|1[0-6])$/
const BOARD = /^[a-z0-9]+(-[a-z0-9]+)*$/

const nn = (channel: number) => String(channel).padStart(2, '0')
const bit = (channel: string) => 1 << (Number(channel) - 1)

/** Whether `text` is a nonce as the board serves it: 16 lowercase hex characters. */
export function isNonce(text: string): boolean {
  return NONCE.test(text)
}

/**
 * The board's name and its `channels` (`<Hub power nn or empty>|<Direct control mask>`, e.g.
 * `01|000c`) as relay ids, or null if either is malformed or Hub power is also a Direct control
 * channel.
 */
export function parseBoardInfo(board: string, channels: string): BoardInfo | null {
  if (!BOARD.test(board)) return null
  const fields = channels.split('|')
  if (fields.length !== 2) return null
  const [hub, mask] = fields
  if ((hub !== '' && !CHANNEL.test(hub)) || !MASK.test(mask)) return null
  const listed = parseInt(mask, 16)
  if (hub !== '' && listed & bit(hub)) return null
  const direct: string[] = []
  for (let channel = 1; channel <= 16; channel++) {
    if (listed & (1 << (channel - 1))) direct.push(`${board}-${nn(channel)}`)
  }
  return {
    board,
    driver: `esp32-${board}`,
    hubPower: hub === '' ? null : `${board}-${hub}`,
    direct,
  }
}

/** The channel number of one of this board's relay ids, or null when it is not one. */
function channelOf(info: BoardInfo, relayId: string): string | null {
  const prefix = `${info.board}-`
  if (!relayId.startsWith(prefix)) return null
  const channel = relayId.slice(prefix.length)
  return CHANNEL.test(channel) ? channel : null
}

/**
 * The board's `states` (4 hex characters, bit nn-1 set while channel nn is on) as relay id to on,
 * for Hub power and the Direct control channels; empty when malformed. A notification may be cut
 * to the link's MTU, so read the value after it.
 */
export function parseStates(info: BoardInfo, text: string): Record<string, boolean> {
  if (!MASK.test(text)) return {}
  const on = parseInt(text, 16)
  const states: Record<string, boolean> = {}
  for (const relayId of [...(info.hubPower ? [info.hubPower] : []), ...info.direct]) {
    const channel = channelOf(info, relayId)
    if (channel !== null) states[relayId] = (on & bit(channel)) !== 0
  }
  return states
}

/** The board's `result`, or null when empty (no write since boot) or unknown. */
export function parseResult(text: string): BoardResult | null {
  return RESULTS.includes(text) ? (text as BoardResult) : null
}

/**
 * The full `command` text switching `relayId` on or off, signed with the board's secret over the
 * first three fields exactly as written (`<nonce>|<nn>|<on|off>`). Rejects a bad nonce, an empty
 * secret, a relay id that is not one of this board's channels, or a MAC from `hmac` that is not
 * 64 lowercase hex characters.
 */
export async function signedCommand(
  hmac: HmacSha256Hex,
  secret: string,
  nonce: string,
  info: BoardInfo,
  relayId: string,
  on: boolean,
): Promise<string> {
  if (!isNonce(nonce)) throw new Error('The nonce is not 16 lowercase hex characters')
  if (secret === '') throw new Error('The board secret is empty')
  const channel = channelOf(info, relayId)
  if (channel === null) throw new Error(`"${relayId}" is not a channel of board ${info.board}`)
  const message = `${nonce}|${channel}|${on ? 'on' : 'off'}`
  const mac = await hmac(secret, message)
  if (!MAC.test(mac)) throw new Error('The MAC is not 64 lowercase hex characters')
  return `${message}|${mac}`
}

/**
 * Whether the board would accept switching `relayId` on or off: Hub power only `on` (Hub wake), a
 * Direct control channel both, anything else neither. The app hides what the board would refuse.
 */
export function allowedAction(info: BoardInfo, relayId: string, on: boolean): boolean {
  if (relayId === info.hubPower) return on
  return info.direct.includes(relayId)
}
