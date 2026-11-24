import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { BoardInfo, BoardResult } from '@renewvan/core/boardBle'
import type { BoardInRange } from '@/ble/boardLink'
import { DirectControlView, HubWakeView } from './BluetoothViews'

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
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 0 }))

let mockStatus = 'disconnected'
jest.mock('@/bus/RenewvanBusProvider', () => ({ useRenewvanBus: () => ({ status: mockStatus }) }))
jest.mock('@/bus/LiveVanProvider', () => ({
  useLiveVan: () => ({ relays: { 'van-03': { name: 'Main light' }, 'van-01': { name: 'Hub' } } }),
}))
let mockMemory = {
  winterMode: true,
  hubPower: { driver: 'esp32-van', relayId: 'van-01' } as {
    driver: string
    relayId: string
  } | null,
  offer: { hubWake: 'prominent', directControl: true },
}
jest.mock('@/winterMode/WinterMemoryProvider', () => ({ useWinterMemory: () => mockMemory }))

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
jest.mock('@/ble/boardLink', () => ({
  driverMatchesAdvertisedName: (driver: string, name: string | null) => driver === name,
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
        states: { 'van-01': false, 'van-03': false },
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
  mockSecrets.clear()
  mockSend.mockClear()
  mockScan.mockClear()
  mockVerdict = () => 'ok'
  mockInRange = [board('aux', 'esp32-aux'), board('van', 'esp32-van')]
  mockMemory = {
    winterMode: true,
    hubPower: { driver: 'esp32-van', relayId: 'van-01' },
    offer: { hubWake: 'prominent', directControl: true },
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

  it('lists the remembered Hub power board first and wakes it with the stored secret', async () => {
    mockSecrets.set('van', 'right')
    await render(<HubWakeView />)
    await settle()
    const rows = screen.getAllByRole('button', { name: /Tap to wake the hub/ })
    expect(rows[0].props.accessibilityLabel).toMatch(/^esp32-van.*Hub power/)
    await act(async () => fireEvent.press(rows[0]))
    expect(mockSend).toHaveBeenCalledWith('right', 'van-01', true)
    expect(screen.getByText(/switched the hub on/)).toBeTruthy()
  })

  it('says so when the picked board does not power the hub', async () => {
    await render(<HubWakeView />)
    await settle()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-aux/ })))
    expect(screen.getByText(/esp32-aux does not power the hub/)).toBeTruthy()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('asks for the secret, and keeps it only once the board accepted it', async () => {
    mockVerdict = (secret) => (secret === 'right' ? 'ok' : 'denied')
    await render(<HubWakeView />)
    await settle()
    await act(async () => fireEvent.press(screen.getByRole('button', { name: /^esp32-van/ })))
    expect(mockSend).not.toHaveBeenCalled()

    await fireEvent.changeText(screen.getByLabelText('Board secret'), 'wrong')
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Send' })))
    console.log('SENDCALLS', JSON.stringify(mockSend.mock.calls))
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
