import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { ConnectionStatus } from '@renewvan/core'
import type { BoardInfo, BoardResult } from '@renewvan/core/boardBle'
import { EMPTY_WINTER_MEMORY, type WinterMemory } from '@renewvan/core/winterMode'
import type { BoardInRange } from '@/ble/boardLink'
import { BluetoothRows } from './BluetoothRows'
import { DirectControlView } from './DirectControlView'
import { HubWakeView } from './HubWakeView'
import { UnreachableBanner } from './UnreachableBanner'

// Plain stand-ins for the form controls: HeroUI Native needs native styling Jest does not have.
jest.mock('@/components/native', () => {
  const { Pressable, Switch, Text, TextInput } = jest.requireActual('react-native')
  return {
    NativeButton: ({
      label,
      onPress,
      disabled,
    }: {
      label: string
      onPress: () => void
      disabled?: boolean
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    ),
    NativeSwitch: ({
      label,
      value,
      disabled,
      onChange,
    }: {
      label: string
      value: boolean
      disabled?: boolean
      onChange: (v: boolean) => void
    }) => (
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
      />
    ),
    NativeTextField: ({
      label,
      onChangeText,
      error,
    }: {
      label: string
      onChangeText: (t: string) => void
      error?: string | null
    }) => (
      <>
        <TextInput accessibilityLabel={label} onChangeText={onChangeText} />
        {error ? <Text>{error}</Text> : null}
      </>
    ),
    Segmented: () => null,
  }
})
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: () => () => null }))
jest.mock('uniwind', () => ({ useUniwind: () => ({ theme: 'light' }) }))
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: () => null },
}))
const mockOpenSettings = jest.fn()
jest.mock('@/components/settings/routes', () => ({
  openSettings: (view: string) => mockOpenSettings(view),
}))
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 0 }))

let mockStatus = 'disconnected'
jest.mock('@/bus/RenewvanBusProvider', () => ({ useRenewvanBus: () => ({ status: mockStatus }) }))
let mockDrivers: { key: string; name: string }[] = []
jest.mock('@/bus/LiveVanProvider', () => ({
  useLiveVan: () => ({
    relays: { 'van-03': { name: 'Main light' }, 'van-01': { name: 'Hub' } },
    drivers: mockDrivers,
  }),
}))
// The phone's Winter mode memory, with core's real offer: a wake the board accepts is kept.
let mockMemory: WinterMemory = EMPTY_WINTER_MEMORY
jest.mock('@/winterMode/WinterMemoryProvider', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react')
  const { bluetoothOffer } = jest.requireActual<typeof import('@renewvan/core/winterMode')>(
    '@renewvan/core/winterMode',
  )
  return {
    useWinterMemory: () => {
      const [wakeSent, setWakeSent] = useState(mockMemory.wakeSent)
      const memory = { ...mockMemory, wakeSent }
      return {
        ...memory,
        offer: bluetoothOffer(mockStatus as ConnectionStatus, memory),
        wakeAccepted: () => setWakeSent(true),
      }
    },
  }
})

const mockSecrets = new Map<string, string>()
jest.mock('@/ble/secrets', () => ({
  readBoardSecret: async (board: string) => mockSecrets.get(board) ?? null,
  saveBoardSecret: async (board: string, secret: string) => void mockSecrets.set(board, secret),
  forgetBoardSecret: async (board: string) => void mockSecrets.delete(board),
}))

// A fake link: the boards a scan hears, and one board that answers with `mockVerdict`.
const van: BoardInfo = {
  board: 'van',
  driver: 'esp32-van',
  hubPower: 'van-01',
  direct: ['van-03'],
}
const other: BoardInfo = { board: 'aux', driver: 'esp32-aux', hubPower: null, direct: [] }
let mockInRange: BoardInRange[] = []
let mockVerdict: (secret: string) => BoardResult = () => 'ok'
const mockSend = jest.fn()
const mockScan = jest.fn()
let mockStates: Record<string, boolean> = {}
jest.mock('@/ble/boardLink', () => ({
  errorMessage: (error: unknown) => String(error),
  boardLink: () => ({
    requestPermissions: async () => true,
    state: async () => 'on',
    onState: () => () => {},
    scan: (onBoard: (board: BoardInRange) => void) => {
      mockScan()
      mockInRange.forEach(onBoard)
      return () => {}
    },
    connect: async (deviceId: string) => {
      const info = deviceId === 'aux' ? other : van
      return {
        info,
        states: mockStates,
        onStates: () => () => {},
        onClosed: () => () => {},
        send: async (secret: string, relayId: string, on: boolean) => {
          mockSend(secret, relayId, on)
          return mockVerdict(secret)
        },
        close: async () => {},
      }
    },
  }),
}))

const board = (deviceId: string, advertisedName: string): BoardInRange => ({
  deviceId,
  advertisedName,
  rssi: -50,
})

beforeEach(() => {
  mockStatus = 'disconnected'
  mockDrivers = []
  mockStates = { 'van-01': false, 'van-03': false }
  mockOpenSettings.mockClear()
  mockSecrets.clear()
  mockSend.mockClear()
  mockScan.mockClear()
  mockVerdict = () => 'ok'
  mockInRange = [board('aux', 'esp32-aux'), board('van', 'esp32-van')]
  mockMemory = {
    winterMode: true,
    hubPower: { driver: 'esp32-van', relayId: 'van-01' },
    wakeSent: false,
  }
})

const settle = () => act(async () => {})

describe('Hub wake', () => {
  it('offers nothing to wake while the van is reachable', async () => {
    mockStatus = 'connected'
    await render(<HubWakeView />)
    await settle()
    expect(screen.getByText(/The hub is on: the van is reachable/)).toBeTruthy()
    expect(mockScan).not.toHaveBeenCalled()
  })

  it('lists only the remembered Hub power board and wakes it with the stored secret', async () => {
    mockSecrets.set('van', 'right')
    await render(<HubWakeView />)
    await settle()
    const rows = screen.getAllByRole('button', { name: /Tap to wake the hub/ })
    expect(rows).toHaveLength(1)
    expect(rows[0].props.accessibilityLabel).toMatch(/^esp32-van/)
    await act(async () => fireEvent.press(rows[0]))
    expect(mockSend).toHaveBeenCalledWith('right', 'van-01', true)
    expect(screen.getByText(/switched the hub on/)).toBeTruthy()
  })

  it('refuses a board that no longer powers the remembered Hub power relay', async () => {
    mockMemory = { ...mockMemory, hubPower: { driver: 'esp32-van', relayId: 'van-02' } }
    await render(<HubWakeView />)
    await settle()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-van/ })))
    expect(screen.getByText(/esp32-van does not power the hub/)).toBeTruthy()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('lists every board for a phone that remembers none, and refuses one without Hub power', async () => {
    mockMemory = EMPTY_WINTER_MEMORY
    await render(<HubWakeView />)
    await settle()
    expect(screen.getAllByRole('button', { name: /Tap to wake the hub/ })).toHaveLength(2)
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-aux/ })))
    expect(screen.getByText(/esp32-aux does not power the hub/)).toBeTruthy()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('names a board by its Driver when the bus told the phone of it', async () => {
    mockDrivers = [{ key: 'esp32-van', name: 'ESP32 Van' }]
    await render(<HubWakeView />)
    await settle()
    expect(screen.getByRole('button', { name: /^ESP32 Van/ })).toBeTruthy()
  })

  it('asks for the secret, and keeps it only once the board accepted it', async () => {
    mockVerdict = (secret) => (secret === 'right' ? 'ok' : 'denied')
    await render(<HubWakeView />)
    await settle()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-van/ })))
    expect(mockSend).not.toHaveBeenCalled()

    await fireEvent.changeText(screen.getByLabelText('Board secret'), 'wrong')
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send' })))
    expect(screen.getByText('The board did not accept this secret.')).toBeTruthy()
    expect(mockSecrets.has('van')).toBe(false)

    await fireEvent.changeText(screen.getByLabelText('Board secret'), 'right')
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send' })))
    expect(mockSecrets.get('van')).toBe('right')
    expect(screen.getByText(/switched the hub on/)).toBeTruthy()
  })

  it('forgets a stored secret the board no longer accepts, and asks again', async () => {
    mockSecrets.set('van', 'old')
    mockVerdict = () => 'denied'
    await render(<HubWakeView />)
    await settle()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-van/ })))
    expect(mockSecrets.has('van')).toBe(false)
    expect(screen.getByLabelText('Board secret')).toBeTruthy()
  })
})

describe('Direct control', () => {
  it('is not offered while the van is reachable: the bus is the only path', async () => {
    mockStatus = 'connected'
    await render(<DirectControlView />)
    await settle()
    expect(screen.getByText(/switch its relays from Controls/)).toBeTruthy()
    expect(mockScan).not.toHaveBeenCalled()
  })

  it("switches a board's allowed channel by its name, and shows Hub power read-only", async () => {
    mockSecrets.set('van', 'right')
    await render(<DirectControlView />)
    await settle()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-van/ })))
    const light = screen.getByLabelText('Main light')
    expect(screen.queryByLabelText('Hub')).toBeNull()
    expect(screen.getByText('Hub (Hub power)')).toBeTruthy()
    await act(async () => fireEvent(light, 'valueChange', true))
    expect(mockSend).toHaveBeenCalledWith('right', 'van-03', true)
  })
})

describe('Direct control states', () => {
  it('says when the board did not report a channel', async () => {
    mockStates = {}
    await render(<DirectControlView />)
    await settle()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-van/ })))
    expect(screen.getByText(/State unknown/)).toBeTruthy()
    expect(screen.getByText('Unknown')).toBeTruthy()
  })
})

describe('the unreachable banner', () => {
  it('offers Hub wake and Direct control while the phone remembers Winter mode', async () => {
    await render(<UnreachableBanner />)
    expect(screen.getByText(/Winter mode: the hub is powered down/)).toBeTruthy()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Wake hub' })))
    expect(mockOpenSettings).toHaveBeenCalledWith('hub-wake')
    expect(screen.getByRole('button', { name: 'Direct control' })).toBeTruthy()
  })

  it('offers only Direct control when the phone remembers no Winter mode', async () => {
    mockMemory = EMPTY_WINTER_MEMORY
    await render(<UnreachableBanner />)
    expect(screen.getByText(/Not connected to the van/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Wake hub' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Direct control' })).toBeTruthy()
  })

  it('says the hub is starting once a wake was accepted', async () => {
    mockMemory = { ...mockMemory, wakeSent: true }
    await render(<UnreachableBanner />)
    expect(screen.getByText(/Hub starting/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Wake hub' })).toBeNull()
  })
})

describe('Settings › Connectivity', () => {
  it('offers Hub wake and Direct control while the van is unreachable', async () => {
    await render(<BluetoothRows />)
    expect(screen.getByRole('button', { name: /^Wake hub/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Direct control/ })).toBeTruthy()
  })

  it('offers Hub wake, never Direct control, while the van is reachable', async () => {
    mockStatus = 'connected'
    await render(<BluetoothRows />)
    expect(screen.getByRole('button', { name: /^Wake hub/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Direct control/ })).toBeNull()
  })
})
