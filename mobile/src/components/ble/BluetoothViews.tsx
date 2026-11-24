import { allowedAction } from '@renewvan/core/boardBle'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { driverMatchesAdvertisedName, type BoardInRange } from '@/ble/boardLink'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { useRenewvanBus } from '@/bus/RenewvanBusProvider'
import { NativeButton, NativeTextField } from '@/components/native'
import {
  Box,
  DetailList,
  DetailRow,
  Group,
  NavRow,
  Note,
  SwitchRow,
} from '@/components/settings/kit'
import { useTheme } from '@/theme'
import { useWinterMemory } from '@/winterMode/WinterMemoryProvider'
import { radioProblem, useBoards } from './useBoards'
import { useBoardSession, type CommandOutcome } from './useBoardSession'

// Hub wake and Direct control (hub ADR 0034): the phone talks to a relay board over Bluetooth,
// bypassing the hub. Hub wake is always reachable here (prominently while the phone remembers Winter
// mode); Direct control only while the bus is unreachable, which is the only time it is offered.

const signal = (board: BoardInRange) =>
  board.rssi === null ? 'In range' : board.rssi > -70 ? 'Close by' : 'In range, weak signal'

/** The boards a scan found, or why there are none. */
function BoardsInRange({
  scanning,
  onPick,
  highlight,
  action,
}: {
  scanning: boolean
  onPick: (board: BoardInRange) => void
  /** The board to list first and mark (the remembered Hub power board). */
  highlight?: (board: BoardInRange) => boolean
  action: string
}) {
  const { colors } = useTheme()
  const { radio, boards, error } = useBoards(scanning)
  const problem = radioProblem(radio)
  if (problem) return <Note tone="danger">{problem}</Note>
  const sorted = highlight
    ? [...boards.filter(highlight), ...boards.filter((b) => !highlight(b))]
    : boards
  return (
    <Group title="Relay boards in range">
      {sorted.map((board) => (
        <NavRow
          key={board.deviceId}
          label={board.advertisedName ?? 'Relay board'}
          description={`${signal(board)}. Tap to ${action}.`}
          badge={highlight?.(board) ? 'Hub power' : undefined}
          onPress={() => onPick(board)}
        />
      ))}
      {error ? <Note tone="danger">{`Could not scan: ${error}`}</Note> : null}
      {sorted.length === 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 }}>
          <ActivityIndicator color={colors.muted} />
          <Note>Looking for relay boards. Stay near the van.</Note>
        </View>
      ) : null}
    </Group>
  )
}

/** Asks once for a board's secret; it is kept on this phone only after the board accepts it. */
function SecretPrompt({
  wrong,
  onSubmit,
  onCancel,
}: {
  wrong: boolean
  onSubmit: (secret: string) => void
  onCancel: () => void
}) {
  const [secret, setSecret] = useState('')
  return (
    <Box padded>
      <NativeTextField
        label="Board secret"
        secure
        autoFocus
        onChangeText={setSecret}
        onSubmit={() => secret && onSubmit(secret)}
        error={wrong ? 'The board did not accept this secret.' : null}
      />
      <Note>
        The secret this relay board was set up with (ble_wake_secret). This phone keeps it once the
        board accepts it, and never sends it over the air or to the hub.
      </Note>
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
        <NativeButton label="Cancel" variant="text" onPress={onCancel} />
        <NativeButton label="Send" disabled={secret === ''} onPress={() => onSubmit(secret)} />
      </View>
    </Box>
  )
}

type WakeStage = 'choose' | 'waking' | 'secret' | 'starting' | 'back'

/** Hub wake: power the hub back on from near the van, over Bluetooth to the Hub power board. */
export function HubWakeView() {
  const { status } = useRenewvanBus()
  const memory = useWinterMemory()
  const board = useBoardSession()
  const [sentStage, setStage] = useState<WakeStage>('choose')
  const [message, setMessage] = useState<string | null>(null)
  const [wrong, setWrong] = useState(false)
  const reachable = status === 'connected'
  // A wake that worked waits for the bus: once the hub is reachable again, the hub is back.
  const stage: WakeStage = sentStage === 'starting' && reachable ? 'back' : sentStage

  const finish = (outcome: CommandOutcome) => {
    if (outcome.kind === 'secret') {
      setWrong(outcome.wrong)
      return setStage('secret')
    }
    if (outcome.kind === 'done' && outcome.result === 'ok') {
      board.close()
      return setStage('starting')
    }
    setMessage(outcome.text)
    setStage('choose')
  }

  const wake = async (typedSecret?: string) => {
    const hubPower = board.info?.hubPower
    if (!hubPower) return
    setStage('waking')
    finish(await board.command(hubPower, true, typedSecret))
  }

  const pick = async (picked: BoardInRange) => {
    setMessage(null)
    setStage('waking')
    const info = await board.connect(picked.deviceId)
    if (info === null) return setStage('choose')
    if (info.hubPower === null) {
      board.close()
      setMessage(`${info.driver} does not power the hub. Pick the board that does.`)
      return setStage('choose')
    }
    setStage('waking')
    finish(await board.command(info.hubPower, true))
  }

  if (stage === 'starting') {
    return (
      <Group title="Hub starting">
        <Box padded>
          <ActivityIndicator />
          <Note>
            The relay board switched the hub on. It takes a minute or two to start; this phone
            reconnects on its own.
          </Note>
        </Box>
      </Group>
    )
  }
  if (stage === 'back') {
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

  const remembered = memory.hubPower
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
          wrong={wrong}
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
          highlight={
            remembered
              ? (b) => driverMatchesAdvertisedName(remembered.driver, b.advertisedName)
              : undefined
          }
          onPick={(picked) => void pick(picked)}
        />
      )}
    </>
  )
}

/** Direct control: switch a board's allowed channels over Bluetooth while the van's network is off. */
export function DirectControlView() {
  const { status } = useRenewvanBus()
  const { relays } = useLiveVan()
  const board = useBoardSession()
  const [pending, setPending] = useState<{ relayId: string; on: boolean } | null>(null)
  const [asking, setAsking] = useState<{ relayId: string; on: boolean; wrong: boolean } | null>(
    null,
  )
  const [message, setMessage] = useState<string | null>(null)
  const reachable = status === 'connected'
  const { close } = board

  // Whenever the bus is reachable it is the only path: drop the Bluetooth link.
  useEffect(() => {
    if (reachable) close()
  }, [reachable, close])

  if (reachable) {
    return (
      <Note>
        The van is reachable: switch its relays from Controls. Direct control is only for when the
        van’s network is off.
      </Note>
    )
  }

  const send = async (relayId: string, on: boolean, typedSecret?: string) => {
    setMessage(null)
    setPending({ relayId, on })
    const outcome = await board.command(relayId, on, typedSecret)
    setPending(null)
    if (outcome.kind === 'secret') return setAsking({ relayId, on, wrong: outcome.wrong })
    setAsking(null)
    if (outcome.kind === 'failed' || outcome.result !== 'ok') setMessage(outcome.text)
  }

  const info = board.info
  if (info === null) {
    return (
      <>
        <Note>
          The van’s network is off. Near the van, switch the channels each relay board allows over
          Bluetooth. Every change reaches the van once its network is back.
        </Note>
        {board.error ? <Note tone="danger">{board.error}</Note> : null}
        {board.phase === 'connecting' ? (
          <Box padded>
            <ActivityIndicator />
            <Note>Connecting…</Note>
          </Box>
        ) : (
          <BoardsInRange
            scanning
            action="control it"
            onPick={(picked) => void board.connect(picked.deviceId)}
          />
        )}
      </>
    )
  }

  const name = (relayId: string) => relays[relayId]?.name || relayId
  return (
    <>
      {asking ? (
        <SecretPrompt
          wrong={asking.wrong}
          onSubmit={(secret) => void send(asking.relayId, asking.on, secret)}
          onCancel={() => setAsking(null)}
        />
      ) : null}
      {message ? <Note tone="danger">{message}</Note> : null}
      <Group
        title={info.driver}
        note={
          info.direct.length === 0
            ? 'This board allows no channels over Bluetooth. They are chosen when the board is set up (ble_channels).'
            : undefined
        }
      >
        {info.direct.map((relayId) => (
          <Box key={relayId}>
            <SwitchRow
              label={name(relayId)}
              description={pending?.relayId === relayId ? 'Sending…' : undefined}
              value={board.states[relayId] ?? false}
              disabled={pending !== null || !allowedAction(info, relayId, !board.states[relayId])}
              onChange={(on) => void send(relayId, on)}
            />
          </Box>
        ))}
      </Group>
      {info.hubPower ? (
        <DetailList>
          <DetailRow
            label={`${name(info.hubPower)} (Hub power)`}
            value={board.states[info.hubPower] ? 'On' : 'Off'}
          />
        </DetailList>
      ) : null}
      <NativeButton label="Disconnect" variant="outlined" onPress={board.close} />
    </>
  )
}
