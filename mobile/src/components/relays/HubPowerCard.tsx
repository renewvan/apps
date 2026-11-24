import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import {
  WINTER_MODE_ANSWER_MS,
  relaysLeftOn,
  reservedRelayIds,
  winterModeCard,
  type WinterModeSent,
} from '@renewvan/core/winterMode'
import { useLiveVan } from '@/bus/LiveVanProvider'
import { confirm, NativeButton } from '@/components/native'
import { Card, Chip } from '@/components/ui'
import { useTheme } from '@/theme'
import { RELAY_PANEL_RADIUS } from './RelayPanels'

export interface HubPowerCardProps {
  onStartWinterMode: () => void
  /** Switches a relay off when the confirm's "Also switch off" is on. */
  onSetRelay: (id: string, on: boolean) => void
  /** How long to wait for the hub to report Winter mode. Injected in tests. */
  answerMs?: number
}

/**
 * The relay that powers the hub (hub ADR 0033), reserved: a Hub power chip and Start winter mode,
 * never an Off | On switch. Its only way off is Winter mode, which the hub plugin finishes; the
 * board refuses a plain switch-off anyway. Drawn only while a board announces Hub power. The
 * dashboard's `HubPowerCard` is the same card: a change to one is checked against the other.
 */
export function HubPowerCard({
  onStartWinterMode,
  onSetRelay,
  answerMs = WINTER_MODE_ANSWER_MS,
}: HubPowerCardProps) {
  const { colors } = useTheme()
  const { relays, hubPower, winterMode, relayTrust } = useLiveVan()
  const [sent, setSent] = useState<WinterModeSent>('idle')
  // The van as of the latest render: the confirm stays open while it changes, so its answer reads
  // this, never the van it opened on.
  const latest = useRef({ problem: winterMode.problem, controllable: relayTrust.controllable })
  useEffect(() => {
    latest.current = { problem: winterMode.problem, controllable: relayTrust.controllable }
  })

  useEffect(() => {
    if (sent !== 'waiting' || winterMode.reported === true) return
    const timer = setTimeout(() => setSent('unanswered'), answerMs)
    return () => clearTimeout(timer)
  }, [sent, winterMode.reported, answerMs])

  if (hubPower.kind === 'none') return null

  const card = winterModeCard({ sent, ...winterMode })
  const leftOn = relaysLeftOn(relays, hubPower)
  const names = leftOn.map((id) => relays[id]?.name ?? id).join(', ')
  const title = reservedRelayIds(hubPower)
    .map((id) => relays[id]?.name ?? id)
    .join(', ')
  // A relay board offline (or Demo mode) holds every relay control: offer no switch that would do
  // nothing, and say which loads stay on.
  const canSwitchOff = leftOn.length > 0 && relayTrust.controllable
  const staysOn =
    leftOn.length > 0 && !canSwitchOff
      ? ` A relay board is offline, so ${names} ${leftOn.length === 1 ? 'stays' : 'stay'} on.`
      : ''

  const ask = () =>
    confirm({
      title: 'Start winter mode?',
      message: `The hub shuts down, then the relay board cuts its power about 90 seconds later. Once started it cannot be cancelled. To power the hub back on, use Wake hub in this app, near the van.${staysOn}`,
      action: 'Start winter mode',
      destructive: true,
      option: canSwitchOff ? { label: `Also switch off ${names}` } : undefined,
      onConfirm: (alsoOff) => {
        // The card shows a problem that arose while the confirm was open; never send past it, nor
        // start with loads the owner asked to switch off that can no longer be switched.
        const now = latest.current
        if (now.problem !== null || (alsoOff && !now.controllable)) return
        if (alsoOff) for (const id of leftOn) onSetRelay(id, false)
        onStartWinterMode()
        setSent('waiting')
      },
    })

  return (
    <View accessibilityLabel="Hub power">
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
          <Chip label="Hub power" tone="accent" />
        </View>
        <Text style={[styles.text, { color: colors.muted }]}>
          Powers the hub and router. Its only way off is Winter mode.
        </Text>
        {card.kind === 'starting' ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.text, { color: colors.foreground }]}
          >
            Winter mode: the hub is shutting down, then the relay board cuts its power. Wake it from
            this app, near the van.
          </Text>
        ) : card.kind === 'waiting' ? (
          <View accessibilityLiveRegion="polite" style={styles.waiting}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.text, { color: colors.muted }]}>Starting Winter mode…</Text>
          </View>
        ) : card.kind === 'lost' ? (
          <Text accessibilityLiveRegion="polite" style={[styles.text, { color: colors.muted }]}>
            Lost the connection to the hub before it reported Winter mode. It may have started: if
            the hub stays unreachable, it is shutting down.
          </Text>
        ) : card.kind === 'problem' ? (
          <Text style={[styles.text, { color: colors.muted }]}>{card.problem}</Text>
        ) : card.kind === 'failed' ? (
          <Text accessibilityRole="alert" style={[styles.text, { color: colors.danger }]}>
            The hub did not start Winter mode. Check that the relay board is online, then try again.
          </Text>
        ) : null}
        {card.kind !== 'starting' && (
          <NativeButton
            label="Start winter mode"
            variant="outlined"
            disabled={!card.canStart}
            onPress={ask}
          />
        )}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: RELAY_PANEL_RADIUS },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  text: { fontSize: 14 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8 },
})
