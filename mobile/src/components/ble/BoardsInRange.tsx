import { driverMatchesAdvertisedName } from '@renewvan/core/boardBle'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import type { BoardInRange } from '@/ble/boardLink'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { NativeButton, NativeTextField } from '@/components/native'
import { Box, Group, NavRow, Note } from '@/components/settings/kit'
import { useTheme } from '@/theme'
import { radioProblem, useBoards } from './useBoards'

// The parts Hub wake and Direct control share (hub ADR 0034): the relay boards a scan hears, each
// by its Driver's name when the bus told the phone of it, and the prompt for a board's secret.

const signal = (board: BoardInRange) =>
  board.rssi === null ? 'In range' : board.rssi > -70 ? 'Close by' : 'In range, weak signal'

/** A board's label: its Driver's name when known, else the Driver key it advertises. */
export function useBoardName(): (driverKey: string | null) => string {
  const { drivers } = useLiveVan()
  return (driverKey) =>
    drivers.find((row) => driverMatchesAdvertisedName(row.key, driverKey))?.name ??
    driverKey ??
    'Relay board'
}

/** The boards a scan found (only those `only` accepts, when given), or why there are none. */
export function BoardsInRange({
  scanning,
  onPick,
  only,
  lookingFor,
  action,
}: {
  scanning: boolean
  onPick: (board: BoardInRange) => void
  /** The one board to list (the remembered Hub power board); every board when absent. */
  only?: (board: BoardInRange) => boolean
  /** What the scan is looking for, while it has found nothing. */
  lookingFor: string
  action: string
}) {
  const { colors } = useTheme()
  const boardName = useBoardName()
  const { radio, boards, error } = useBoards(scanning)
  const problem = radioProblem(radio)
  if (problem) return <Note tone="danger">{problem}</Note>
  const listed = only ? boards.filter(only) : boards
  return (
    <Group title="Relay boards in range">
      {listed.map((board) => (
        <NavRow
          key={board.deviceId}
          label={boardName(board.advertisedName)}
          description={`${signal(board)}. Tap to ${action}.`}
          onPress={() => onPick(board)}
        />
      ))}
      {error ? <Note tone="danger">{`Could not scan: ${error}`}</Note> : null}
      {listed.length === 0 ? (
        <View style={styles.looking}>
          <ActivityIndicator color={colors.muted} />
          <Note>{lookingFor}</Note>
        </View>
      ) : null}
    </Group>
  )
}

/** Asks once for a board's secret; it is kept on this phone only after the board accepts it. */
export function SecretPrompt({
  secretRejected,
  onSubmit,
  onCancel,
}: {
  secretRejected: boolean
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
        error={secretRejected ? 'The board did not accept this secret.' : null}
      />
      <Note>
        The secret this relay board was set up with (ble_wake_secret). This phone keeps it once the
        board accepts it, and never sends it over the air or to the hub.
      </Note>
      <View style={styles.buttons}>
        <NativeButton label="Cancel" variant="text" onPress={onCancel} />
        <NativeButton label="Send" disabled={secret === ''} onPress={() => onSubmit(secret)} />
      </View>
    </Box>
  )
}

const styles = StyleSheet.create({
  looking: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 },
  buttons: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
})
