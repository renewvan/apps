// The phone's Bluetooth link to a relay board (hub ADR 0034): Hub wake and Direct control when the
// van's network is off. What the characteristics' text means is core's (`@renewvan/core/boardBle`);
// this owns the radio: scanning, connecting, reading, notifications and the signed write. Screens
// and tests see only `BoardLink` and `BoardSession`, never the BLE library
// (react-native-ble-manager, loaded on first use so that importing this never needs the native
// module: Jest and Expo Go import it safely).
import {
  BOARD_BLE_BOARD,
  BOARD_BLE_CHANNELS,
  BOARD_BLE_COMMAND,
  BOARD_BLE_NONCE,
  BOARD_BLE_RESULT,
  BOARD_BLE_SERVICE,
  BOARD_BLE_STATES,
  parseBoardInfo,
  parseResult,
  parseStates,
  signedCommand,
  type BoardInfo,
  type BoardResult,
} from '@renewvan/core/boardBle'
import { Buffer } from 'buffer'
import { PermissionsAndroid, Platform, type EventSubscription } from 'react-native'
import type bleManager from 'react-native-ble-manager'
import type { BleScanMode, Peripheral } from 'react-native-ble-manager'
import { hmacSha256Hex } from './hmac'

type Ble = typeof bleManager

/** A relay board heard advertising the board service. */
export interface BoardInRange {
  deviceId: string
  advertisedName: string | null
  rssi: number | null
}

export type BluetoothState = 'on' | 'off' | 'unauthorized' | 'unsupported' | 'unknown'

/** One connection to a board, from `BoardLink.connect`. */
export interface BoardSession {
  /** The board's name and channels as relay ids. */
  info: BoardInfo
  /** The relays' states, as last read. */
  readonly states: Record<string, boolean>
  /** Calls `listener` with every new read of the states; returns the unsubscribe. */
  onStates(listener: (states: Record<string, boolean>) => void): () => void
  /** Calls `listener` once when the session ends: the link dropped, or `close`. */
  onClosed(listener: (reason: Error) => void): () => void
  /**
   * Switches `relayId` on or off: reads the nonce, signs the command with the board's secret,
   * writes it and returns the board's verdict. A `stale` verdict is retried once with a fresh
   * nonce. Throws when the board does not answer within 5 s, the link drops, the session is
   * closed, or `relayId` is not one of this board's channels. Sends run one at a time.
   */
  send(secret: string, relayId: string, on: boolean): Promise<BoardResult>
  /** Disconnects; a send in flight is rejected. */
  close(): Promise<void>
}

export interface BoardLink {
  /** The phone's Bluetooth state; `unsupported` where the BLE module is missing (Expo Go). */
  state(): Promise<BluetoothState>
  onState(listener: (state: BluetoothState) => void): () => void
  /**
   * Asks for what scanning and connecting need: on Android 12+ Nearby devices (BLUETOOTH_SCAN and
   * BLUETOOTH_CONNECT), on Android 11 and older the location permission BLE scans need there.
   * True on iOS, which asks on first use. Resolves whether everything was granted.
   */
  requestPermissions(): Promise<boolean>
  /**
   * Scans for boards advertising the board service: `onBoard` hears each board once, and again
   * when its name or signal changes. Returns the stop. `onError` hears a scan that could not start.
   */
  scan(onBoard: (board: BoardInRange) => void, onError?: (error: Error) => void): () => void
  /** Connects to a board found by `scan` and reads what it accepts and its states. */
  connect(deviceId: string): Promise<BoardSession>
}

/** The MTU asked for on Android: the 88-byte command in one write (iOS negotiates itself). */
const MTU = 185
const CONNECT_TIMEOUT_MS = 10_000
const RESULT_TIMEOUT_MS = 5_000
/** The BLE name is the Driver key cut to this many characters. */
const ADVERTISED_NAME_LENGTH = 20
const SCAN_LOW_LATENCY = 2 as BleScanMode

/** Whether a board advertising `advertisedName` is the one of Driver `driver` (`esp32-<board>`). */
export function driverMatchesAdvertisedName(
  driver: string,
  advertisedName: string | null,
): boolean {
  return !!advertisedName && driver.slice(0, ADVERTISED_NAME_LENGTH) === advertisedName
}

const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const toText = (bytes: number[]) => Buffer.from(bytes).toString('utf8')
const toBytes = (text: string) => Array.from(Buffer.from(text, 'utf8'))
const asError = (error: unknown) =>
  error instanceof Error
    ? error
    : new Error(typeof error === 'string' ? error : JSON.stringify(error))

function bluetoothState(state: string): BluetoothState {
  switch (state) {
    case 'on':
      return 'on'
    case 'off':
    case 'turning_on':
    case 'turning_off':
      return 'off'
    case 'unauthorized':
    case 'unsupported':
      return state
    default:
      return 'unknown'
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(asError(error))
      },
    )
  })
}

let link: BoardLink | null = null

/** The app's one link to the relay boards. Creates nothing native until first used. */
export function boardLink(): BoardLink {
  link ??= createBoardLink()
  return link
}

function createBoardLink(): BoardLink {
  let started: Promise<Ble> | null = null
  const ready = (): Promise<Ble> => {
    started ??= Promise.resolve()
      .then(async () => {
        // Required here, not imported at the top: the library constructs its manager on import and
        // throws where the native module is missing (Expo Go, Jest).
        // oxlint-disable-next-line typescript/no-require-imports
        const ble = (require('react-native-ble-manager') as { default: Ble }).default
        await ble.start({ showAlert: false })
        return ble
      })
      .catch((error: unknown) => {
        started = null
        throw asError(error)
      })
    return started
  }

  return {
    async state() {
      let ble: Ble
      try {
        ble = await ready()
      } catch {
        return 'unsupported'
      }
      return bluetoothState(await ble.checkState())
    },

    onState(listener) {
      let subscription: EventSubscription | null = null
      let off = false
      ready().then(
        (ble) => {
          if (!off)
            subscription = ble.onDidUpdateState(({ state }) => listener(bluetoothState(state)))
        },
        () => {},
      )
      return () => {
        off = true
        subscription?.remove()
      }
    },

    async requestPermissions() {
      if (Platform.OS !== 'android') return true
      const wanted =
        Number(Platform.Version) >= 31
          ? [
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]
          : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]
      const granted = await PermissionsAndroid.requestMultiple(wanted)
      return wanted.every(
        (permission) => granted[permission] === PermissionsAndroid.RESULTS.GRANTED,
      )
    },

    scan(onBoard, onError) {
      const seen = new Map<string, BoardInRange>()
      let subscription: EventSubscription | null = null
      let ble: Ble | null = null
      let stopped = false
      const heard = (peripheral: Peripheral) => {
        const advertised = peripheral.advertising?.serviceUUIDs ?? []
        if (!advertised.some((uuid) => sameUuid(uuid, BOARD_BLE_SERVICE))) return
        const before = seen.get(peripheral.id)
        const board: BoardInRange = {
          deviceId: peripheral.id,
          advertisedName:
            peripheral.advertising?.localName || peripheral.name || before?.advertisedName || null,
          rssi: typeof peripheral.rssi === 'number' ? peripheral.rssi : null,
        }
        if (before?.rssi === board.rssi && before.advertisedName === board.advertisedName) return
        seen.set(board.deviceId, board)
        onBoard(board)
      }
      ready()
        .then(async (manager) => {
          if (stopped) return
          ble = manager
          subscription = manager.onDiscoverPeripheral(heard)
          await manager.scan({
            serviceUUIDs: [BOARD_BLE_SERVICE],
            allowDuplicates: true,
            scanMode: SCAN_LOW_LATENCY,
          })
          if (stopped) await manager.stopScan()
        })
        .catch((error: unknown) => onError?.(asError(error)))
      return () => {
        if (stopped) return
        stopped = true
        subscription?.remove()
        ble?.stopScan().catch(() => {})
      }
    },

    async connect(deviceId) {
      const ble = await ready()
      try {
        await withTimeout(ble.connect(deviceId), CONNECT_TIMEOUT_MS, 'The board did not connect')
      } catch (error) {
        await ble.disconnect(deviceId).catch(() => {})
        throw error
      }
      return openSession(ble, deviceId)
    },
  }
}

async function openSession(ble: Ble, deviceId: string): Promise<BoardSession> {
  const read = async (characteristic: string) =>
    toText(await ble.read(deviceId, BOARD_BLE_SERVICE, characteristic))

  let ended: Error | null = null
  const enders = new Set<(reason: Error) => void>()
  const results = new Set<(text: string) => void>()
  const stateListeners = new Set<(states: Record<string, boolean>) => void>()
  let info: BoardInfo | null = null
  let states: Record<string, boolean> = {}

  const refreshStates = async () => {
    if (!info || ended) return
    const next = parseStates(info, await read(BOARD_BLE_STATES))
    if (ended || Object.keys(next).length === 0) return
    states = next
    for (const listener of [...stateListeners]) listener(states)
  }

  const subscriptions = [
    ble.onDisconnectPeripheral(({ peripheral }) => {
      if (peripheral === deviceId) end(new Error('The board disconnected'))
    }),
    ble.onDidUpdateValueForCharacteristic(({ peripheral, characteristic, value }) => {
      if (peripheral !== deviceId || ended) return
      if (sameUuid(characteristic, BOARD_BLE_RESULT)) {
        for (const listener of [...results]) listener(toText(value))
      } else if (sameUuid(characteristic, BOARD_BLE_STATES)) {
        // The notification may be cut to the link's MTU: the read has the whole value.
        refreshStates().catch(() => {})
      }
    }),
  ]

  function end(reason: Error) {
    if (ended) return
    ended = reason
    for (const subscription of subscriptions) subscription.remove()
    for (const ender of [...enders]) ender(reason)
    enders.clear()
    results.clear()
    stateListeners.clear()
  }

  /** `promise`, or the reason the session ended first. */
  const untilEnded = <T>(promise: Promise<T>): Promise<T> =>
    new Promise((resolve, reject) => {
      if (ended) return reject(ended)
      const ender = (reason: Error) => reject(reason)
      enders.add(ender)
      promise
        .then(resolve, (error: unknown) => reject(asError(error)))
        .finally(() => enders.delete(ender))
    })

  try {
    if (Platform.OS === 'android') {
      // Best effort: without it Android still sends the long command as a prepared write.
      await untilEnded(ble.requestMTU(deviceId, MTU)).catch(() => {})
    }
    await untilEnded(ble.retrieveServices(deviceId, [BOARD_BLE_SERVICE]))
    info = parseBoardInfo(
      await untilEnded(read(BOARD_BLE_BOARD)),
      await untilEnded(read(BOARD_BLE_CHANNELS)),
    )
    if (!info)
      throw new Error('This device is not a Renewvan relay board, or its firmware is too old')
    await untilEnded(ble.startNotification(deviceId, BOARD_BLE_SERVICE, BOARD_BLE_STATES))
    // Subscribed before any write: the board notifies `result` after every command.
    await untilEnded(ble.startNotification(deviceId, BOARD_BLE_SERVICE, BOARD_BLE_RESULT))
    states = parseStates(info, await untilEnded(read(BOARD_BLE_STATES)))
  } catch (error) {
    end(asError(error))
    await ble.disconnect(deviceId).catch(() => {})
    throw error
  }
  const boardInfo = info

  /** One signed write and the board's verdict on it. */
  const attempt = async (secret: string, relayId: string, on: boolean): Promise<BoardResult> => {
    const nonce = await read(BOARD_BLE_NONCE)
    const command = toBytes(
      await signedCommand(hmacSha256Hex, secret, nonce, boardInfo, relayId, on),
    )
    let heard: (text: string) => void = () => {}
    let dropped: (reason: Error) => void = () => {}
    const answer = new Promise<string>((resolve, reject) => {
      heard = resolve
      dropped = reject
      results.add(heard)
      enders.add(dropped)
    })
    try {
      const [, text] = await withTimeout(
        Promise.all([
          ble.write(deviceId, BOARD_BLE_SERVICE, BOARD_BLE_COMMAND, command, command.length),
          answer,
        ]),
        RESULT_TIMEOUT_MS,
        'The board did not answer within 5 s',
      )
      const result = parseResult(text)
      if (!result) throw new Error(`The board answered "${text}"`)
      return result
    } finally {
      results.delete(heard)
      enders.delete(dropped)
    }
  }

  let queue: Promise<unknown> = Promise.resolve()

  return {
    info: boardInfo,
    get states() {
      return states
    },
    onStates(listener) {
      if (ended) return () => {}
      stateListeners.add(listener)
      return () => stateListeners.delete(listener)
    },
    onClosed(listener) {
      if (ended) return () => {}
      enders.add(listener)
      return () => enders.delete(listener)
    },
    send(secret, relayId, on) {
      const sent = queue.then(() => {
        if (ended) throw ended
        return untilEnded(
          (async () => {
            const result = await attempt(secret, relayId, on)
            return result === 'stale' ? attempt(secret, relayId, on) : result
          })(),
        )
      })
      queue = sent.catch(() => {})
      return sent
    },
    async close() {
      if (ended) return
      end(new Error('The session is closed'))
      await ble.disconnect(deviceId).catch(() => {})
    },
  }
}
