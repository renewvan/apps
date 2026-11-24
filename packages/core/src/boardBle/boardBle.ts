// The relay board's BLE message format (hub ADR 0034): Hub wake and Direct control from the phone
// when the Renewvan bus is unreachable. Transport-free: the app owns the Bluetooth stack and the
// HMAC primitive (injected as `HmacSha256Hex`); this reads and writes the characteristics' text.

const uuid = (xx: string) => `7e1a00${xx}-6f6e-4f3a-9c10-52656e657776`

/** The relay board's BLE service. */
export const BOARD_BLE_SERVICE = uuid('01')
/** Write: `<nonce>|<relay id>|<on|off>|<mac>`, built by `signedCommand`. */
export const BOARD_BLE_COMMAND = uuid('02')
/** Read, notify: each channel's state, read by `parseStates`. */
export const BOARD_BLE_STATES = uuid('03')
/** Read, notify: the verdict on the last command write, read by `parseResult`. */
export const BOARD_BLE_RESULT = uuid('04')
/** Read: the single-use nonce the next command must name (`isNonce`). */
export const BOARD_BLE_NONCE = uuid('05')
/** Read: the Driver key, Hub power and the Direct control channels, read by `parseInfo`. */
export const BOARD_BLE_INFO = uuid('06')

/**
 * HMAC-SHA256 of `message` keyed with `key` (both UTF-8), as 64 lowercase hex characters. The app
 * supplies it from its own crypto library; core imports none.
 */
export type HmacSha256Hex = (key: string, message: string) => Promise<string>

/** What a board accepts over BLE, from its `info` characteristic. */
export interface BoardInfo {
  /** The board's full Driver key (its BLE name may be cut to 20 characters). */
  driver: string
  /** The Hub power relay id, which only takes `on` (Hub wake); null when the board has none. */
  hubPower: string | null
  /** The Direct control channels' relay ids, which take `on` and `off`. */
  direct: string[]
}

/** The board's verdict on the last command write. */
export type BoardResult = 'ok' | 'stale' | 'denied' | 'refused' | 'locked'

const RESULTS: readonly string[] = ['ok', 'stale', 'denied', 'refused', 'locked']

const NONCE = /^[0-9a-f]{32}$/
const MAC = /^[0-9a-f]{64}$/

/** A relay id the wire can carry: not empty, and none of the separators `|`, `,` or `=`. */
function isRelayId(text: string): boolean {
  return text !== '' && !/[|,=]/.test(text)
}

/** Whether `text` is a nonce as the board serves it: 32 lowercase hex characters. */
export function isNonce(text: string): boolean {
  return NONCE.test(text)
}

/** The board's `info` (`<driver>|<hub power or empty>|<direct, comma-separated>`), or null if malformed. */
export function parseInfo(text: string): BoardInfo | null {
  const fields = text.split('|')
  if (fields.length !== 3) return null
  const [driver, hubPower, directText] = fields
  if (driver === '') return null
  if (hubPower !== '' && !isRelayId(hubPower)) return null
  const direct = directText === '' ? [] : directText.split(',')
  if (!direct.every(isRelayId) || direct.includes(hubPower)) return null
  return { driver, hubPower: hubPower === '' ? null : hubPower, direct }
}

/**
 * The board's `states` (`<relay id>=<on|off>`, comma-separated) as relay id to on. Malformed
 * entries are skipped: a notification may be cut to the link MTU, so read the value after it.
 */
export function parseStates(text: string): Record<string, boolean> {
  const states: Record<string, boolean> = {}
  for (const entry of text.split(',')) {
    const [relayId, state, ...rest] = entry.split('=')
    if (rest.length > 0 || state === undefined || !isRelayId(relayId)) continue
    if (state === 'on') states[relayId] = true
    else if (state === 'off') states[relayId] = false
  }
  return states
}

/** The board's `result`, or null when empty (no write since boot) or unknown. */
export function parseResult(text: string): BoardResult | null {
  return RESULTS.includes(text) ? (text as BoardResult) : null
}

/**
 * The full `command` text switching `relayId` on or off, signed with the board's secret over the
 * first three fields exactly as written. Rejects a bad nonce, an empty secret, a relay id the wire
 * cannot carry, or a MAC from `hmac` that is not 64 lowercase hex characters.
 */
export async function signedCommand(
  hmac: HmacSha256Hex,
  secret: string,
  nonce: string,
  relayId: string,
  on: boolean,
): Promise<string> {
  if (!isNonce(nonce)) throw new Error('The nonce is not 32 lowercase hex characters')
  if (secret === '') throw new Error('The board secret is empty')
  if (!isRelayId(relayId)) throw new Error(`The relay id "${relayId}" cannot be sent`)
  const message = `${nonce}|${relayId}|${on ? 'on' : 'off'}`
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
