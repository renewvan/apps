import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { WINTER_MODE_ANSWER_MS, relaysLeftOn, reservedRelayIds } from '@renewvan/core/winterMode'
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

/** Where a Start winter mode this card sent stands: the hub's `true` is read from the bus. */
type Sent = 'idle' | 'waiting' | 'failed'

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
  const { relays, hubPower, winterMode } = useLiveVan()
  const [sent, setSent] = useState<Sent>('idle')

  useEffect(() => {
    if (sent !== 'waiting' || winterMode.reported === true) return
    const timer = setTimeout(() => setSent('failed'), answerMs)
    return () => clearTimeout(timer)
  }, [sent, winterMode.reported, answerMs])

  if (hubPower.kind === 'none') return null

  const { problem } = winterMode
  const leftOn = relaysLeftOn(relays, hubPower)
  const names = leftOn.map((id) => relays[id]?.name ?? id)
  const title = reservedRelayIds(hubPower)
    .map((id) => relays[id]?.name ?? id)
    .join(', ')
  const starting = winterMode.reported === true
  const waiting = sent === 'waiting' && !starting

  const ask = () =>
    confirm({
      title: 'Start winter mode?',
      message:
        'The hub shuts down, then the relay board cuts its power about 90 seconds later. Once started it cannot be cancelled. To power the hub back on, use Wake hub in this app, near the van.',
      action: 'Start winter mode',
      destructive: true,
      option: leftOn.length > 0 ? { label: `Also switch off ${names.join(', ')}` } : undefined,
      onConfirm: (alsoOff) => {
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
        {starting ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.text, { color: colors.foreground }]}
          >
            Winter mode: the hub is shutting down, then the relay board cuts its power. Wake it from
            this app, near the van.
          </Text>
        ) : waiting ? (
          <View accessibilityLiveRegion="polite" style={styles.waiting}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.text, { color: colors.muted }]}>Starting Winter mode…</Text>
          </View>
        ) : sent === 'failed' ? (
          <Text accessibilityRole="alert" style={[styles.text, { color: colors.danger }]}>
            The hub did not start Winter mode. Check that the relay board is online, then try again.
          </Text>
        ) : problem ? (
          <Text style={[styles.text, { color: colors.muted }]}>{problem}</Text>
        ) : null}
        {!starting && (
          <NativeButton
            label="Start winter mode"
            variant="outlined"
            disabled={problem !== null || waiting}
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
