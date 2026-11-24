// `@renewvan/core/boardBle`: the relay board's BLE message format (hub ADR 0034). The UUIDs, the
// readers of `info`, `states` and `result`, the signed `command`, and what the board would accept.
// Transport-free: the app owns the Bluetooth stack and the HMAC primitive.

export {
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
  type BoardResult,
  type HmacSha256Hex,
} from './boardBle'
