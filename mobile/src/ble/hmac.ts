// The HMAC primitive core's board message format asks the app for (`@renewvan/core/boardBle`).
// Pure JavaScript (@noble/hashes), so it runs on Hermes without a native crypto module.
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import type { HmacSha256Hex } from '@renewvan/core/boardBle'

/** HMAC-SHA256 of `message` keyed with `key` (both UTF-8), as 64 lowercase hex characters. */
export const hmacSha256Hex: HmacSha256Hex = async (key, message) =>
  bytesToHex(hmac(sha256, utf8ToBytes(key), utf8ToBytes(message)))
