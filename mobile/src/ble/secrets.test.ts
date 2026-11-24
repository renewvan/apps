import * as SecureStore from 'expo-secure-store'
import { forgetBoardSecret, readBoardSecret, saveBoardSecret } from './secrets'

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  }
})

const secureStore = jest.mocked(SecureStore)

describe('board secrets', () => {
  beforeEach(async () => {
    await forgetBoardSecret('relay-x8')
    await forgetBoardSecret('relay-x16')
  })

  it('is null for a board with no saved secret', async () => {
    expect(await readBoardSecret('relay-x8')).toBeNull()
  })

  it('reads back a saved secret, under renewvan.board-secret.<board>', async () => {
    await saveBoardSecret('relay-x8', 'correct horse battery')
    expect(await readBoardSecret('relay-x8')).toBe('correct horse battery')
    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'renewvan.board-secret.relay-x8',
      'correct horse battery',
    )
  })

  it('keeps each board apart', async () => {
    await saveBoardSecret('relay-x8', 'one')
    await saveBoardSecret('relay-x16', 'two')
    expect(await readBoardSecret('relay-x8')).toBe('one')
    expect(await readBoardSecret('relay-x16')).toBe('two')
  })

  it('forgets a secret', async () => {
    await saveBoardSecret('relay-x8', 'one')
    await forgetBoardSecret('relay-x8')
    expect(await readBoardSecret('relay-x8')).toBeNull()
  })

  it('refuses to save an empty secret', async () => {
    await expect(saveBoardSecret('relay-x8', '')).rejects.toThrow()
  })

  it('refuses a board name SecureStore cannot key', async () => {
    await expect(readBoardSecret('relay x8')).rejects.toThrow()
    await expect(saveBoardSecret('relay/x8', 'one')).rejects.toThrow()
  })
})
