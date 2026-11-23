import { Power } from 'lucide-react-native'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { confirm, Segmented } from '@/components/native'
import { Banner, Card } from '@/components/ui'
import { criticalRelayIds, panelsFor, type RelayPanel } from '@/config/relayPanels'
import { EntityIcon } from '@/components/EntityIcon'
import { iconKey } from '@/lib/entityIcons'
import { DEFAULT_RELAY_GROUP_LIST } from '@renewvan/core/relays'
import { radius, useTheme } from '@/theme'
import type { Relay } from '@/types'
import { useCommandPhases, type Phase } from './useCommandPhases'

const SEGMENTS = [
  { key: 'off', label: 'Off' },
  { key: 'on', label: 'On' },
] as const

export interface RelayPanelsProps {
  relays: Record<string, Relay>
  /** Every Driver that publishes `relay` is online. False reads as Unknown. */
  driverOnline: boolean
  /** Demo mode: show the relays, but every control is disabled and nothing is ever sent. */
  demo: boolean
  /** Sends the TARGET state to the relay's `set` topic. */
  onSetRelay: (id: string, on: boolean) => void
  /** Loads that ask before switching. */
  criticalIds?: readonly string[]
  /** The shared relay groups: relay id to group name. */
  groups?: Readonly<Record<string, string>>
  /** The shared list of group names, in display order. */
  groupList?: readonly string[]
  /** The shared order of relays inside a card. */
  order?: readonly string[]
  /** The shared entity icons, `<entity>/<id>` to a name; a relay with none wears the neutral one. */
  icons?: Readonly<Record<string, string>>
}

function Channel({
  id,
  relay,
  icon,
  frozen,
  phase,
  onPick,
  onRetry,
}: {
  id: string
  relay: Relay
  icon: string | undefined
  /** Driver not online, or Demo mode: nothing selected, controls disabled. */
  frozen: boolean
  phase: Phase | undefined
  onPick: (to: boolean) => void
  onRetry: (to: boolean) => void
}) {
  const { colors } = useTheme()
  const label = relay.name ?? id
  const unknown = frozen || relay.state === undefined
  const pending = !unknown && phase?.kind === 'pending'
  const failed = !unknown && phase?.kind === 'failed'
  // While pending the control shows the TARGET, so a tap is visibly acknowledged.
  const shown = pending ? phase.to : relay.state
  const selected = unknown || shown === undefined ? undefined : shown ? 'on' : 'off'

  return (
    <View style={styles.channel}>
      <View style={styles.channelTitle}>
        <View style={styles.channelName}>
          {/* A neutral glyph unless the owner picked one: the app never guesses what a channel switches. */}
          <EntityIcon name={icon} fallback={Power} size={16} color={colors.muted} />
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              { color: relay.name === undefined ? colors.muted : colors.foreground },
            ]}
          >
            {label}
          </Text>
        </View>
        {pending && <ActivityIndicator size="small" color={colors.accent} />}
      </View>
      <Segmented
        label={label}
        options={SEGMENTS}
        selected={selected}
        disabled={unknown || pending}
        onSelect={(key) => {
          const to = key === 'on'
          // A re-tap of the selected segment sends nothing.
          if (to !== relay.state) onPick(to)
        }}
      />
      {unknown && <Text style={[styles.note, { color: colors.muted }]}>Unknown</Text>}
      {failed && (
        <View style={styles.failed}>
          <Text style={[styles.note, { color: colors.danger }]}>Didn&apos;t switch</Text>
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: colors.default }}
            hitSlop={12}
            onPress={() => onRetry(phase.to)}
            style={styles.retry}
          >
            <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

/** What every relay panel shares: whether the controls are frozen, and each channel's command. */
export function useRelayControls({
  relays,
  driverOnline,
  demo,
  onSetRelay,
  criticalIds = criticalRelayIds,
}: Pick<RelayPanelsProps, 'relays' | 'driverOnline' | 'demo' | 'onSetRelay' | 'criticalIds'>) {
  const frozen = demo || !driverOnline
  const { phaseOf, request } = useCommandPhases(relays, frozen, onSetRelay)

  const pick = (id: string, to: boolean) => {
    if (!criticalIds.includes(id)) return request(id, to)
    const verb = to ? 'on' : 'off'
    // `request` re-checks `frozen`, so a prompt left open while the
    // Driver drops sends nothing.
    confirm({
      title: `Switch ${verb} ${relays[id].name ?? id}?`,
      action: `Switch ${verb}`,
      onConfirm: () => request(id, to),
    })
  }
  return { frozen, phaseOf, pick, request }
}

export type RelayControls = ReturnType<typeof useRelayControls>

/** Why every relay control is disabled, when it is. */
export function RelayBanner({ demo, driverOnline }: { demo: boolean; driverOnline: boolean }) {
  return demo ? (
    <Banner>Demo mode: controls are disabled.</Banner>
  ) : !driverOnline ? (
    <Banner>
      The relay driver is not online. Every relay is unknown and its controls are disabled.
    </Banner>
  ) : null
}

/** The panels of the Controls tab, one per relay group with a channel on the bus, in the shared order. */
export function relayPanels({
  relays,
  groups = {},
  groupList = DEFAULT_RELAY_GROUP_LIST,
  order = [],
}: Pick<RelayPanelsProps, 'relays' | 'groups' | 'groupList' | 'order'>): RelayPanel[] {
  return panelsFor(Object.keys(relays), groups, groupList, order)
}

/**
 * One group's titled panel of labelled Off | On controls, one per channel. `state` means the
 * output was commanded and latched, never that the load is energised, so nothing here says more
 * than the bus does (hub ADR 0013).
 */
export function RelayPanelCard({
  panel,
  relays,
  icons = {},
  controls,
}: {
  panel: RelayPanel
  relays: Record<string, Relay>
  icons?: Readonly<Record<string, string>>
  controls: RelayControls
}) {
  const { colors } = useTheme()
  const { frozen, phaseOf, pick, request } = controls
  return (
    <Card style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.panelTitle, { color: colors.muted }]}>
        {panel.title}
      </Text>
      {panel.ids.map((id) => (
        <Channel
          key={id}
          id={id}
          relay={relays[id]}
          icon={icons[iconKey('relay', id)]}
          frozen={frozen}
          phase={phaseOf(id)}
          onPick={(to) => pick(id, to)}
          onRetry={(to) => request(id, to)}
        />
      ))}
    </Card>
  )
}

/** The corners of a relay panel, for a focus ring that follows them. */
export const RELAY_PANEL_RADIUS = radius['2xl']

const styles = StyleSheet.create({
  panel: { padding: 16, gap: 16, borderRadius: RELAY_PANEL_RADIUS },
  panelTitle: { fontSize: 14, fontWeight: '500' },
  channel: { gap: 6 },
  channelTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 20,
  },
  channelName: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  name: { fontSize: 14, flexShrink: 1 },
  note: { fontSize: 12 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  retry: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
})
