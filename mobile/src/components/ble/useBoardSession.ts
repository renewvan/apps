import { boardResultText, type BoardInfo, type BoardResult } from '@renewvan/core/boardBle'
import { useCallback, useEffect, useRef, useState } from 'react'
import { boardLink, type BoardSession } from '@/ble/boardLink'
import { forgetBoardSecret, readBoardSecret, saveBoardSecret } from '@/ble/secrets'

/** How a command ended, for the screen: a verdict, or the board's secret is needed first. */
export type CommandOutcome =
  | { kind: 'done'; result: BoardResult; text: string }
  | { kind: 'secret'; wrong: boolean }
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
  const [states, setStates] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const session = useRef<BoardSession | null>(null)

  const close = useCallback(() => {
    const current = session.current
    session.current = null
    setInfo(null)
    setStates({})
    setPhase('idle')
    void current?.close().catch(() => {})
  }, [])

  // Never leave a link open behind a closed screen.
  useEffect(() => () => void session.current?.close().catch(() => {}), [])

  /** Connects to a board found by a scan; resolves its info, or null when it failed. */
  const connect = useCallback(async (deviceId: string): Promise<BoardInfo | null> => {
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
        session.current = null
        setInfo(null)
        setStates({})
        setPhase('failed')
        setError('The connection to the relay board dropped. Move closer and try again.')
      })
      setPhase('connected')
      return opened.info
    } catch (connectError) {
      setPhase('failed')
      setError(
        `Could not connect to the relay board: ${connectError instanceof Error ? connectError.message : String(connectError)}`,
      )
      return null
    }
  }, [])

  /** Switches `relayId`: with `typedSecret` when the person just typed one, else the stored one. */
  const command = useCallback(
    async (relayId: string, on: boolean, typedSecret?: string): Promise<CommandOutcome> => {
      const current = session.current
      if (current === null) return { kind: 'failed', text: 'Not connected to the relay board.' }
      const board = current.info.board
      const secret = typedSecret ?? (await readBoardSecret(board).catch(() => null))
      if (!secret) return { kind: 'secret', wrong: false }
      try {
        const result = await current.send(secret, relayId, on)
        if (result === 'ok' && typedSecret !== undefined) await saveBoardSecret(board, typedSecret)
        if (result === 'denied') {
          if (typedSecret === undefined) await forgetBoardSecret(board).catch(() => {})
          return { kind: 'secret', wrong: true }
        }
        return { kind: 'done', result, text: boardResultText(result) }
      } catch (sendError) {
        return {
          kind: 'failed',
          text: `The relay board did not answer: ${sendError instanceof Error ? sendError.message : String(sendError)}`,
        }
      }
    },
    [],
  )

  return { phase, info, states, error, connect, close, command }
}
