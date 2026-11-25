import {
  BOARD_BLE_BOARD,
  BOARD_BLE_CHANNELS,
  BOARD_BLE_COMMAND,
  BOARD_BLE_NONCE,
  BOARD_BLE_RESULT,
  BOARD_BLE_SERVICE,
  BOARD_BLE_STATES,
  signedCommand,
} from '@renewvan/core/boardBle'
import { Buffer } from 'buffer'
import { Platform } from 'react-native'
import type * as BoardLinkModule from './boardLink'
import { hmacSha256Hex } from './hmac'

// A small stand-in for react-native-ble-manager: one board whose characteristics hold text, a
// log of the calls in order, and the events the library would emit.
type Listener = (event: never) => void
function fakeBle() {
  const listeners: Record<string, Set<Listener>> = {}
  const on = (name: string) => (listener: Listener) => {
    ;(listeners[name] ??= new Set()).add(listener)
    return { remove: () => listeners[name].delete(listener) }
  }
  const bytes = (text: string) => Array.from(Buffer.from(text, 'utf8'))
  const ble = {
    values: {} as Record<string, string>,
    calls: [] as string[],
    writes: [] as { data: number[]; maxByteSize: number }[],
    /** What the board notifies on `result` after a write; null for nothing. */
    answer: (() => 'ok') as (command: string) => string | null,
    emit(name: string, event: unknown): void {
      for (const listener of listeners[name] ?? []) (listener as (event: unknown) => void)(event)
    },
    notify(characteristic: string, text: string): void {
      ble.emit('value', {
        peripheral: 'board-1',
        service: BOARD_BLE_SERVICE,
        characteristic,
        value: bytes(text),
      })
    },
    listening: (name: string) => listeners[name]?.size ?? 0,
    start: jest.fn(async () => {}),
    checkState: jest.fn(async () => 'on'),
    scan: jest.fn(async (_options: unknown) => {}),
    stopScan: jest.fn(async () => {}),
    connect: jest.fn(async (id: string) => void ble.calls.push(`connect ${id}`)),
    disconnect: jest.fn(async (id: string) => void ble.calls.push(`disconnect ${id}`)),
    requestMTU: jest.fn(async (_id: string, mtu: number) => mtu),
    retrieveServices: jest.fn(async () => ({})),
    read: jest.fn(
      async (_id: string, _service: string, characteristic: string): Promise<number[]> => {
        ble.calls.push(`read ${characteristic}`)
        return bytes(ble.values[characteristic] ?? '')
      },
    ),
    startNotification: jest.fn(
      async (_id: string, _service: string, characteristic: string) =>
        void ble.calls.push(`notify ${characteristic}`),
    ),
    write: jest.fn(
      async (
        _id: string,
        _service: string,
        characteristic: string,
        data: number[],
        maxByteSize: number,
      ): Promise<void> => {
        ble.calls.push(`write ${characteristic}`)
        ble.writes.push({ data, maxByteSize })
        const result = ble.answer(Buffer.from(data).toString('utf8'))
        if (result !== null) setTimeout(() => ble.notify(BOARD_BLE_RESULT, result), 0)
      },
    ),
    onDiscoverPeripheral: on('discover'),
    onDidUpdateState: on('state'),
    onDisconnectPeripheral: on('disconnect'),
    onDidUpdateValueForCharacteristic: on('value'),
  }
  return ble
}

let mockBle: ReturnType<typeof fakeBle>
jest.mock('react-native-ble-manager', () => ({ __esModule: true, default: mockBle }))

let boardLink: typeof BoardLinkModule.boardLink
beforeEach(() => {
  jest.useRealTimers()
  jest.resetModules()
  mockBle = fakeBle()
  // The board in core's test vectors: Hub power on 01, Direct control on 03 and 04.
  Object.assign(mockBle.values, {
    [BOARD_BLE_BOARD]: 'relay-x8',
    [BOARD_BLE_CHANNELS]: '01|000c',
    [BOARD_BLE_STATES]: '0004',
    [BOARD_BLE_NONCE]: '0011223344556677',
  })
  ;({ boardLink } = jest.requireActual<typeof BoardLinkModule>('./boardLink'))
})

const x8 = {
  board: 'relay-x8',
  driver: 'esp32-relay-x8',
  hubPower: 'relay-x8-01',
  direct: ['relay-x8-03', 'relay-x8-04'],
}
const secret = 'correct horse battery'

describe('boardLink', () => {
  it('does not load the BLE library until used', () => {
    boardLink()
    expect(mockBle.start).not.toHaveBeenCalled()
  })

  it('is one link for the app', () => {
    expect(boardLink()).toBe(boardLink())
  })

  it('reads the Bluetooth state', async () => {
    expect(await boardLink().state()).toBe('on')
    mockBle.checkState.mockResolvedValueOnce('turning_on')
    expect(await boardLink().state()).toBe('off')
    mockBle.checkState.mockResolvedValueOnce('unauthorized')
    expect(await boardLink().state()).toBe('unauthorized')
  })

  it('follows state changes until unsubscribed', async () => {
    const states: string[] = []
    const off = boardLink().onState((state) => states.push(state))
    await boardLink().state()
    mockBle.emit('state', { state: 'off' })
    off()
    mockBle.emit('state', { state: 'on' })
    expect(states).toEqual(['off'])
  })
})

describe('scan', () => {
  const advert = (
    id: string,
    rssi: number,
    serviceUUIDs = [BOARD_BLE_SERVICE],
    localName = 'esp32-relay-x8',
  ) => ({
    id,
    rssi,
    name: localName,
    advertising: { localName, serviceUUIDs },
  })

  it('asks for the board service and reports each board once, again when its signal changes', async () => {
    const seen: unknown[] = []
    const stop = boardLink().scan((board) => seen.push(board))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockBle.scan).toHaveBeenCalledWith(
      expect.objectContaining({ serviceUUIDs: [BOARD_BLE_SERVICE] }),
    )

    mockBle.emit('discover', advert('a', -60))
    mockBle.emit('discover', advert('a', -60))
    mockBle.emit('discover', advert('b', -70, [BOARD_BLE_SERVICE.toUpperCase()]))
    mockBle.emit('discover', advert('c', -50, ['180d']))
    mockBle.emit('discover', advert('d', -50, []))
    mockBle.emit('discover', advert('a', -55))
    expect(seen).toEqual([
      { deviceId: 'a', advertisedName: 'esp32-relay-x8', rssi: -60 },
      { deviceId: 'b', advertisedName: 'esp32-relay-x8', rssi: -70 },
      { deviceId: 'a', advertisedName: 'esp32-relay-x8', rssi: -55 },
    ])

    stop()
    expect(mockBle.stopScan).toHaveBeenCalled()
    mockBle.emit('discover', advert('e', -50))
    expect(seen).toHaveLength(3)
  })
})

describe('connect', () => {
  it('reads the board, its channels and states', async () => {
    const session = await boardLink().connect('board-1')
    expect(session.info).toEqual(x8)
    expect(session.states).toEqual({
      'relay-x8-01': false,
      'relay-x8-03': true,
      'relay-x8-04': false,
    })
    expect(mockBle.calls).toEqual([
      'connect board-1',
      `read ${BOARD_BLE_BOARD}`,
      `read ${BOARD_BLE_CHANNELS}`,
      `notify ${BOARD_BLE_STATES}`,
      `notify ${BOARD_BLE_RESULT}`,
      `read ${BOARD_BLE_STATES}`,
    ])
  })

  it('asks Android for an MTU that fits the 88-byte command', async () => {
    const os = Platform.OS
    Platform.OS = 'android'
    try {
      await boardLink().connect('board-1')
      expect(mockBle.requestMTU).toHaveBeenCalledWith('board-1', 185)
    } finally {
      Platform.OS = os
    }
  })

  it('fails and disconnects from a device that is not a relay board', async () => {
    mockBle.values[BOARD_BLE_CHANNELS] = 'nonsense'
    await expect(boardLink().connect('board-1')).rejects.toThrow()
    expect(mockBle.disconnect).toHaveBeenCalledWith('board-1')
  })

  it('re-reads states after a notification, which may be cut', async () => {
    const session = await boardLink().connect('board-1')
    const heard: unknown[] = []
    session.onStates((states) => heard.push(states))
    mockBle.values[BOARD_BLE_STATES] = '0009'
    mockBle.notify(BOARD_BLE_STATES, '00')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const states = { 'relay-x8-01': true, 'relay-x8-03': false, 'relay-x8-04': true }
    expect(heard).toEqual([states])
    expect(session.states).toEqual(states)
  })
})

describe('send', () => {
  it('signs the nonce, listens for the result before writing, and returns it', async () => {
    const session = await boardLink().connect('board-1')
    mockBle.calls.length = 0
    expect(await session.send(secret, 'relay-x8-03', false)).toBe('ok')

    expect(mockBle.calls).toEqual([`read ${BOARD_BLE_NONCE}`, `write ${BOARD_BLE_COMMAND}`])
    expect(mockBle.startNotification).toHaveBeenCalledWith(
      'board-1',
      BOARD_BLE_SERVICE,
      BOARD_BLE_RESULT,
    )
    const command = await signedCommand(
      hmacSha256Hex,
      secret,
      '0011223344556677',
      x8,
      'relay-x8-03',
      false,
    )
    expect(mockBle.writes).toEqual([
      { data: Array.from(Buffer.from(command, 'utf8')), maxByteSize: 88 },
    ])
    expect(command).toHaveLength(88)
  })

  it('takes a fresh nonce and tries once more when the first is stale', async () => {
    const session = await boardLink().connect('board-1')
    const nonces = ['0011223344556677', 'aabbccddeeff0011']
    mockBle.read.mockImplementation(async (_id, _service, characteristic) =>
      Array.from(Buffer.from(characteristic === BOARD_BLE_NONCE ? nonces.shift()! : '', 'utf8')),
    )
    const answers = ['stale', 'ok']
    mockBle.answer = () => answers.shift()!

    expect(await session.send(secret, 'relay-x8-01', true)).toBe('ok')
    const written = mockBle.writes.map(({ data }) =>
      Buffer.from(data).toString('utf8').slice(0, 16),
    )
    expect(written).toEqual(['0011223344556677', 'aabbccddeeff0011'])
  })

  it('returns stale when the retry is stale too', async () => {
    const session = await boardLink().connect('board-1')
    mockBle.answer = () => 'stale'
    expect(await session.send(secret, 'relay-x8-01', true)).toBe('stale')
    expect(mockBle.writes).toHaveLength(2)
  })

  it('returns what the board refused', async () => {
    const session = await boardLink().connect('board-1')
    mockBle.answer = () => 'denied'
    expect(await session.send(secret, 'relay-x8-01', true)).toBe('denied')
    expect(mockBle.writes).toHaveLength(1)
  })

  it('throws when the board does not answer within 5 s', async () => {
    const session = await boardLink().connect('board-1')
    jest.useFakeTimers()
    mockBle.answer = () => null
    const sent = session.send(secret, 'relay-x8-03', true)
    const failed = expect(sent).rejects.toThrow(/5 s/)
    await jest.advanceTimersByTimeAsync(5000)
    await failed
  })

  it('rejects a send in flight when the link drops, and every send after', async () => {
    const session = await boardLink().connect('board-1')
    mockBle.answer = () => null
    const closed = jest.fn()
    session.onClosed(closed)
    const sent = session.send(secret, 'relay-x8-03', true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    mockBle.emit('disconnect', { peripheral: 'board-1' })
    await expect(sent).rejects.toThrow(/disconnected/)
    await expect(session.send(secret, 'relay-x8-03', true)).rejects.toThrow(/disconnected/)
    expect(closed).toHaveBeenCalledTimes(1)
  })

  it('ignores another device dropping', async () => {
    const session = await boardLink().connect('board-1')
    mockBle.emit('disconnect', { peripheral: 'board-2' })
    expect(await session.send(secret, 'relay-x8-03', true)).toBe('ok')
  })
})

describe('close', () => {
  it('disconnects and stops listening', async () => {
    const session = await boardLink().connect('board-1')
    await session.close()
    expect(mockBle.disconnect).toHaveBeenCalledWith('board-1')
    expect(mockBle.listening('value')).toBe(0)
    expect(mockBle.listening('disconnect')).toBe(0)
    await expect(session.send(secret, 'relay-x8-03', true)).rejects.toThrow()
  })
})
