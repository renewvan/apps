import { driverMatchesAdvertisedName } from '@renewvan/core/boardBle'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import type { BoardInRange } from '@/ble/boardLink'
import { NativeButton } from '@/components/native'
import { Box, Group, Note } from '@/components/settings/kit'
import { useWinterMemory } from '@/winterMode/WinterMemoryProvider'
import { BoardsInRange, SecretPrompt, useBoardName } from './BoardsInRange'
import { useBoardSession, type CommandOutcome } from './useBoardSession'

// Hub wake (hub ADR 0034): power the hub back on from near the van, over Bluetooth to the board
// that announced Hub power. Always reachable here, prominently while the phone remembers Winter
// mode (core's `bluetoothOffer`).

type WakeStage = 'choose' | 'waking' | 'secret'

/** Hub wake: power the hub back on from near the van, over Bluetooth to the Hub power board. */
export function HubWakeView() {
  const memory = useWinterMemory()
  const board = useBoardSession()
  const boardName = useBoardName()
  const [stage, setStage] = useState<WakeStage>('choose')
  const [message, setMessage] = useState<string | null>(null)
  const [secretRejected, setSecretRejected] = useState(false)
  // This screen sent the wake: once the bus is back, the hub is back.
  const [woke, setWoke] = useState(false)
  // The person asked to wake again while the hub is still said to be starting.
  const [again, setAgain] = useState(false)
  const reachable = !memory.offer.directControl
  const remembered = memory.hubPower

  const finish = (outcome: CommandOutcome) => {
    if (outcome.kind === 'secret') {
      setSecretRejected(outcome.secretRejected)
      return setStage('secret')
    }
    setStage('choose')
    if (outcome.kind === 'done' && outcome.result === 'ok') {
      board.close()
      setWoke(true)
      setAgain(false)
      return memory.wakeAccepted()
    }
    setMessage(outcome.text)
  }

  const wake = async (typedSecret?: string) => {
    const hubPower = board.info?.hubPower
    if (!hubPower) return
    setStage('waking')
    finish(await board.command({ relayId: hubPower, on: true }, typedSecret))
  }

  const pick = async (picked: BoardInRange) => {
    setMessage(null)
    setStage('waking')
    const info = await board.connect(picked.deviceId)
    if (info === null) return setStage('choose')
    // Only the board that announced Hub power: a remembered one must still power that relay.
    if (info.hubPower === null || (remembered && info.hubPower !== remembered.relayId)) {
      board.close()
      setMessage(`${boardName(info.driver)} does not power the hub. Pick the board that does.`)
      return setStage('choose')
    }
    finish(await board.command({ relayId: info.hubPower, on: true }))
  }

  if (reachable && woke) {
    return (
      <Group title="Hub is back">
        <Note>The hub is on and the van is reachable again. Winter mode is over.</Note>
        <NativeButton label="Done" onPress={() => router.back()} />
      </Group>
    )
  }
  if (reachable) {
    return (
      <Note>
        The hub is on: the van is reachable. Hub wake powers the hub back on after Winter mode, from
        near the van.
      </Note>
    )
  }
  if (memory.offer.hubWake === 'starting' && !again) {
    return (
      <Group title="Hub starting">
        <Box padded>
          <ActivityIndicator />
          <Note>
            The relay board switched the hub on. It takes a minute or two to start; this phone
            reconnects on its own.
          </Note>
        </Box>
        <NativeButton label="Wake again" variant="outlined" onPress={() => setAgain(true)} />
      </Group>
    )
  }

  return (
    <>
      <Note>
        {memory.winterMode
          ? 'The van is in Winter mode: the hub is powered down. Stay near the van and wake it over Bluetooth.'
          : 'Power the hub back on over Bluetooth, from near the van, when it is powered down.'}
      </Note>
      {message ? <Note tone="danger">{message}</Note> : null}
      {board.error ? <Note tone="danger">{board.error}</Note> : null}
      {stage === 'secret' ? (
        <SecretPrompt
          secretRejected={secretRejected}
          onSubmit={(secret) => void wake(secret)}
          onCancel={() => {
            board.close()
            setStage('choose')
          }}
        />
      ) : stage === 'waking' ? (
        <Box padded>
          <ActivityIndicator />
          <Note>Waking the hub…</Note>
        </Box>
      ) : (
        <BoardsInRange
          scanning={board.phase !== 'connected' && board.phase !== 'connecting'}
          action="wake the hub"
          only={
            remembered
              ? (b) => driverMatchesAdvertisedName(remembered.driver, b.advertisedName)
              : undefined
          }
          lookingFor={
            remembered
              ? `Looking for ${boardName(remembered.driver)}, the board that powers the hub. Stay near the van.`
              : 'Looking for relay boards. Stay near the van.'
          }
          onPick={(picked) => void pick(picked)}
        />
      )}
    </>
  )
}
