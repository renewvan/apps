import { useEffect, useState } from 'react'
import { boardLink, type BluetoothState, type BoardInRange } from '@/ble/boardLink'

export type RadioState = BluetoothState | 'checking' | 'denied'

/**
 * The relay boards in Bluetooth range while `active`: asks for the permissions, follows the
 * phone's Bluetooth, and scans while it is on. Inactive (a board is connected, or the screen has no
 * use for it) it stops scanning: Android allows only a few scan starts per half minute.
 */
export function useBoards(active: boolean): {
  radio: RadioState
  boards: BoardInRange[]
  error: string | null
} {
  const [radio, setRadio] = useState<RadioState>('checking')
  const [boards, setBoards] = useState<BoardInRange[]>([])
  const [error, setError] = useState<string | null>(null)
  const radioOn = radio === 'on'

  useEffect(() => {
    if (!active) return
    const link = boardLink()
    let cancelled = false
    const offState = link.onState((state) => {
      if (!cancelled) setRadio(state)
    })
    void (async () => {
      const granted = await link.requestPermissions().catch(() => false)
      if (cancelled) return
      if (!granted) return setRadio('denied')
      const state = await link.state().catch((): BluetoothState => 'unknown')
      if (!cancelled) setRadio(state)
    })()
    return () => {
      cancelled = true
      offState()
    }
  }, [active])

  useEffect(() => {
    if (!active || !radioOn) return
    const stop = boardLink().scan(
      (board) => {
        setError(null)
        setBoards((list) => {
          const rest = list.filter((b) => b.deviceId !== board.deviceId)
          return [...rest, board].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
        })
      },
      (scanError) => setError(scanError.message),
    )
    return stop
  }, [active, radioOn])

  return { radio, boards, error }
}

/** What to tell the person when the phone cannot scan, or null when it can. */
export function radioProblem(radio: RadioState): string | null {
  switch (radio) {
    case 'on':
    case 'checking':
      return null
    case 'off':
      return 'Bluetooth is off. Switch it on to reach the relay board.'
    case 'denied':
    case 'unauthorized':
      return 'Renewvan may not use Bluetooth. Allow Nearby devices for Renewvan in the phone settings.'
    case 'unsupported':
      return 'Bluetooth is not available in this build of the app.'
    case 'unknown':
      return 'Bluetooth is not ready yet.'
  }
}
