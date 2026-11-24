import AsyncStorage from '@react-native-async-storage/async-storage'
import { bluetoothOffer, type BluetoothOffer } from '@renewvan/core/boardBle'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { useSession } from '@/session/SessionProvider'
import {
  EMPTY_WINTER_MEMORY,
  nextWinterMemory,
  parseWinterMemory,
  type WinterMemory,
} from './winterMemory'

const STORAGE_KEY = 'renewvan.winterMemory.v1'

export interface WinterMemoryValue extends WinterMemory {
  /** What the app offers over Bluetooth now (core's `bluetoothOffer`). */
  offer: BluetoothOffer
}

const WinterMemoryContext = createContext<WinterMemoryValue | null>(null)

/**
 * Keeps this phone's Winter mode memory in step with the Live van and on the phone across
 * restarts. Signed out, it is forgotten: another van's Hub power is not this one's.
 */
export function WinterMemoryProvider({ children }: { children: ReactNode }) {
  const van = useLiveVan()
  const { status } = useRenewvanBus()
  const { connection } = useSession()
  const [memory, setMemory] = useState<WinterMemory>(EMPTY_WINTER_MEMORY)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setMemory(parseWinterMemory(raw)))
      // An unreadable memory starts empty: the quiet Hub wake entry in Settings still works.
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Only once the stored memory is in: the first renders (status `connecting`, nothing retained
  // yet) must not overwrite it.
  const next = loaded
    ? connection === null
      ? EMPTY_WINTER_MEMORY
      : nextWinterMemory(memory, {
          status,
          winterMode: van.winterMode.reported,
          hubPower: van.hubPower,
        })
    : memory
  if (next !== memory) setMemory(next)

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory)).catch(() => {})
  }, [memory, loaded])

  const value: WinterMemoryValue = {
    ...memory,
    offer: bluetoothOffer({ status, rememberedWinterMode: memory.winterMode }),
  }
  return <WinterMemoryContext.Provider value={value}>{children}</WinterMemoryContext.Provider>
}

/** This phone's Winter mode memory and what it offers over Bluetooth. */
export function useWinterMemory(): WinterMemoryValue {
  const value = useContext(WinterMemoryContext)
  if (value === null) throw new Error('useWinterMemory needs a WinterMemoryProvider above it')
  return value
}
