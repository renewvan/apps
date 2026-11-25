// Each relay board's shared secret (hub ADR 0034), kept in the phone's secure store: the Keychain
// on iOS, Keystore-encrypted preferences on Android. One entry per board, keyed by its name.
import * as SecureStore from 'expo-secure-store'

// SecureStore keys may hold only alphanumerics, `.`, `-` and `_`; board names are `[a-z0-9-]`.
const KEY_SAFE = /^[A-Za-z0-9._-]+$/

function keyFor(board: string): string {
  if (!KEY_SAFE.test(board)) throw new Error(`"${board}" is not a board name`)
  return `renewvan.board-secret.${board}`
}

/** The board's saved secret, or null when this phone has none. */
export async function readBoardSecret(board: string): Promise<string | null> {
  return SecureStore.getItemAsync(keyFor(board))
}

/** Saves the board's secret on this phone, replacing any before it. */
export async function saveBoardSecret(board: string, secret: string): Promise<void> {
  const key = keyFor(board)
  if (secret === '') throw new Error('The board secret is empty')
  await SecureStore.setItemAsync(key, secret)
}

/** Forgets the board's secret on this phone. */
export async function forgetBoardSecret(board: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(board))
}
