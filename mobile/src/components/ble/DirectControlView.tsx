import { allowedAction } from '@renewvan/core/boardBle'
import { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { NativeButton } from '@/components/native'
import { Box, DetailList, DetailRow, Group, Note, SwitchRow } from '@/components/settings/kit'
import { useWinterMemory } from '@/winterMode/WinterMemoryProvider'
import { BoardsInRange, SecretPrompt, useBoardName } from './BoardsInRange'
import { useBoardSession, type RelaySwitch } from './useBoardSession'

// Direct control (hub ADR 0034): switch a board's allowlisted channels over Bluetooth, bypassing
// the hub. Only while the bus is unreachable (core's `bluetoothOffer`): whenever it is reachable it
// is the only path, so the link is dropped.

/** Direct control: switch a board's allowed channels over Bluetooth while the van's network is off. */
export function DirectControlView() {
  const { offer } = useWinterMemory()
  const { relays } = useLiveVan()
  const boardName = useBoardName()
  const board = useBoardSession()
  const [pending, setPending] = useState<RelaySwitch | null>(null)
  const [asking, setAsking] = useState<(RelaySwitch & { secretRejected: boolean }) | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const allowed = offer.directControl
  const { close } = board

  // Whenever the bus is reachable it is the only path: drop the Bluetooth link.
  useEffect(() => {
    if (!allowed) close()
  }, [allowed, close])

  if (!allowed) {
    return (
      <Note>
        The van is reachable: switch its relays from Controls. Direct control is only for when the
        van’s network is off.
      </Note>
    )
  }

  const send = async (change: RelaySwitch, typedSecret?: string) => {
    setMessage(null)
    setPending(change)
    const outcome = await board.command(change, typedSecret)
    setPending(null)
    if (outcome.kind === 'secret') {
      return setAsking({ ...change, secretRejected: outcome.secretRejected })
    }
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
            lookingFor="Looking for relay boards. Stay near the van."
            onPick={(picked) => void board.connect(picked.deviceId)}
          />
        )}
      </>
    )
  }

  const name = (relayId: string) => relays[relayId]?.name || relayId
  const hubPowerState = info.hubPower ? board.states[info.hubPower] : undefined
  return (
    <>
      {asking ? (
        <SecretPrompt
          secretRejected={asking.secretRejected}
          onSubmit={(secret) => void send(asking, secret)}
          onCancel={() => setAsking(null)}
        />
      ) : null}
      {message ? <Note tone="danger">{message}</Note> : null}
      <Group
        title={boardName(info.driver)}
        note={
          info.direct.length === 0
            ? 'This board allows no channels over Bluetooth. They are chosen when the board is set up (ble_channels).'
            : undefined
        }
      >
        {info.direct.map((relayId) => {
          const state = board.states[relayId]
          return (
            <Box key={relayId}>
              <SwitchRow
                label={name(relayId)}
                description={
                  pending?.relayId === relayId
                    ? 'Sending…'
                    : state === undefined
                      ? 'State unknown: the board did not report it'
                      : undefined
                }
                value={state ?? false}
                disabled={pending !== null || !allowedAction(info, relayId, !state)}
                onChange={(on) => void send({ relayId, on })}
              />
            </Box>
          )
        })}
      </Group>
      {info.hubPower ? (
        <DetailList>
          <DetailRow
            label={`${name(info.hubPower)} (Hub power)`}
            value={hubPowerState === undefined ? 'Unknown' : hubPowerState ? 'On' : 'Off'}
          />
        </DetailList>
      ) : null}
      <NativeButton label="Disconnect" variant="outlined" onPress={board.close} />
    </>
  )
}
