import {
  boardResultText,
  type BoardInfo,
  type BoardResult,
  type RelayStates,
} from '@renewvan/core/boardBle'
import { useCallback, useEffect, useRef, useState } from 'react'
import { boardLink, errorMessage, type BoardSession } from '@/ble/boardLink'
import { forgetBoardSecret, readBoardSecret, saveBoardSecret } from '@/ble/secrets'

/** One relay switched on or off. */
export interface RelaySwitch {
  relayId: string
  on: boolean
}

/** How a command ended, for the screen: a verdict, or the board's secret is needed first. */
export type CommandOutcome =
  | { kind: 'done'; result: BoardResult; text: string }
  | { kind: 'secret'; secretRejected: boolean }
  | { kind: 'failed'; text: string }

export type SessionPhase = 'idle' | 'connecting' | 'connected' | 'failed'

/**
 * One Bluetooth session with a relay board: connect, the states it reports, and signed commands.
 * The board's secret comes from the phone's secure store; a secret typed in is saved only once the
 * board accepted it, and a stored one the board refuses is forgotten (the board was reflashed).
 */
export function useBoardSession() {
  const [phase, setPhase] = useState<SessionPhase>('idle')
  const [info, setInfo] = useState<BoardInfo | null>(null)
  const [states, setStates] = useState<RelayStates>({})
  const [error, setError] = useState<string | null>(null)
  const session = useRef<BoardSession | null>(null)

  /** Forgets the session on screen; the link itself is closed by the caller, or already gone. */
  const reset = useCallback((next: SessionPhase) => {
    session.current = null
    setInfo(null)
    setStates({})
    setPhase(next)
  }, [])

  const close = useCallback(() => {
    const current = session.current
    reset('idle')
    void current?.close().catch(() => {})
  }, [reset])

  // Never leave a link open behind a closed screen.
  useEffect(() => () => void session.current?.close().catch(() => {}), [])

  /** Connects to a board found by a scan; resolves its info, or null when it failed. */
  const connect = useCallback(
    async (deviceId: string): Promise<BoardInfo | null> => {
      setPhase('connecting')
      setError(null)
      try {
        const opened = await boardLink().connect(deviceId)
        session.current = opened
        setInfo(opened.info)
        setStates(opened.states)
        opened.onStates(setStates)
        opened.onClosed(() => {
          if (session.current !== opened) return
          reset('failed')
          setError('The connection to the relay board dropped. Move closer and try again.')
        })
        setPhase('connected')
        return opened.info
      } catch (connectError) {
        setPhase('failed')
        setError(`Could not connect to the relay board: ${errorMessage(connectError)}`)
        return null
      }
    },
    [reset],
  )

  /** Switches a relay: with `typedSecret` when the person just typed one, else the stored one. */
  const command = useCallback(
    async ({ relayId, on }: RelaySwitch, typedSecret?: string): Promise<CommandOutcome> => {
      const current = session.current
      if (current === null) return { kind: 'failed', text: 'Not connected to the relay board.' }
      const board = current.info.board
      const secret = typedSecret ?? (await readBoardSecret(board).catch(() => null))
      if (!secret) return { kind: 'secret', secretRejected: false }
      try {
        const result = await current.send(secret, relayId, on)
        if (result === 'ok' && typedSecret !== undefined) await saveBoardSecret(board, typedSecret)
        if (result === 'denied') {
          if (typedSecret === undefined) await forgetBoardSecret(board).catch(() => {})
          return { kind: 'secret', secretRejected: true }
        }
        return { kind: 'done', result, text: boardResultText(result) }
      } catch (sendError) {
        return {
          kind: 'failed',
          text: `The relay board did not answer: ${errorMessage(sendError)}`,
        }
      }
    },
    [],
  )

  return { phase, info, states, error, connect, close, command }
}
