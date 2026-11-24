import { useState } from 'react'
import { AlertDialog, Button, Spinner, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { ToggleLeft, type LucideIcon } from 'lucide-react'
import { criticalRelayIds, FALLBACK_RELAY_ICON, panelsFor, relayIcons } from '@/config/relayPanels'
import { useEntityIcons } from '@/hooks/useEntityIcon'
import { entityIcon } from '@/lib/entityIcons'
import { iconKey } from '@renewvan/core/icons'
import { reservedRelayIds } from '@renewvan/core/winterMode'
import { useLiveVan } from '@/hooks/useLiveVan'
import type { Relay } from '@/types'
import { useCommandPhases, type Phase } from './useCommandPhases'
import { HubPowerCard } from './HubPowerCard'

/**
 * The two segments of every control. `min-h-11` is the 44px touch target
 * (docs/design-principles.md); the solid fill on the selected segment is required, because the
 * default faint tint makes a mostly-off van read as a wall of "Off".
 */
const SEGMENT_CLASS =
  'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground min-h-11 flex-1'
const SEGMENTS = [
  { key: 'off', text: 'Off' },
  { key: 'on', text: 'On' },
] as const

/**
 * What the Relays page is handed. The relays, whether they can be switched (`relayTrust`: Unknown
 * while a relay Driver is offline, disabled in Demo mode) and the shared groups and order are the
 * Live van's.
 */
export interface RelaysPageProps {
  /** Sends the TARGET state to the relay's `set` topic. */
  onSetRelay: (id: string, on: boolean) => void
  /** Start winter mode (hub ADR 0033), from the Hub power card. */
  onStartWinterMode: () => void
  /** Loads that ask before switching. Defaults to the dashboard's own configuration. */
  criticalIds?: readonly string[]
  /**
   * Per-channel icons from the dashboard's own config, only for a load the owner has named. An icon
   * picked in Settings (the shared `renewvan/hub/icons`) wins over it. Defaults to the dashboard's own.
   */
  icons?: Readonly<Record<string, LucideIcon>>
}

interface ChannelProps {
  id: string
  relay: Relay
  /** The glyph for this channel: a configured one, else the neutral one. */
  Icon: LucideIcon
  /** Driver not online, or Demo mode: nothing selected, controls disabled. */
  frozen: boolean
  phase: Phase | undefined
  onPick: (to: boolean) => void
  /** Resends a failed command's target. */
  onRetry: (to: boolean) => void
}

function Channel({ id, relay, Icon, frozen, phase, onPick, onRetry }: ChannelProps) {
  const label = relay.name ?? id
  const known = relay.state !== undefined
  const unknown = frozen || !known
  const pending = !unknown && phase !== undefined && !phase.failed
  const failed = !unknown && phase?.failed === true
  // While pending the control shows the TARGET, so a tap is visibly acknowledged.
  const shown = pending ? phase.to : relay.state
  const selected = unknown || shown === undefined ? [] : [shown ? 'on' : 'off']

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="text-muted size-4 shrink-0" />
          <span className={`truncate text-sm ${relay.name === undefined ? 'text-muted' : ''}`}>
            {label}
          </span>
        </span>
        {pending && <Spinner size="sm" />}
      </div>
      <ToggleButtonGroup
        aria-label={label}
        fullWidth
        selectionMode="single"
        disallowEmptySelection
        isDisabled={unknown || pending}
        selectedKeys={new Set(selected)}
        onSelectionChange={(keys) => {
          const key = [...keys][0]
          if (key === undefined) return
          const to = key === 'on'
          // HeroUI re-fires the selection on a re-tap of the selected segment: send nothing.
          if (to !== relay.state) onPick(to)
        }}
      >
        {SEGMENTS.map(({ key, text }, index) => (
          <ToggleButton key={key} id={key} className={SEGMENT_CLASS}>
            {index > 0 && <ToggleButtonGroup.Separator />}
            {text}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {unknown && <span className="text-muted text-xs">Unknown</span>}
      {failed && (
        <span className="text-danger flex items-center gap-3 text-xs">
          Didn&apos;t switch
          <Button size="sm" variant="ghost" className="min-h-11" onPress={() => onRetry(phase.to)}>
            Retry
          </Button>
        </span>
      )}
    </div>
  )
}

/** Banner for the one reason every relay reads Unknown or disabled. */
function Banner({ demo, driverOnline }: { demo: boolean; driverOnline: boolean }) {
  if (!demo && driverOnline) return null
  return (
    <p role="status" className="bg-surface text-muted rounded-xl px-3 py-2 text-xs">
      {demo
        ? 'Demo mode: controls are disabled.'
        : 'The relay driver is not online. Every relay is unknown and its controls are disabled.'}
    </p>
  )
}

interface Confirming {
  id: string
  label: string
  to: boolean
}

/**
 * The Relays page: titled panels of labelled Off | On controls, one per channel. `state` means
 * the output was commanded and latched, never that the load is energised, so the page never says
 * a load is "on" in that sense and never claims more than the bus does (hub ADR 0013).
 */
export function RelaysPage({
  onSetRelay,
  onStartWinterMode,
  criticalIds = criticalRelayIds,
  icons = relayIcons,
}: RelaysPageProps) {
  const { relays, relayTrust, relayGroups, hubPower } = useLiveVan()
  const { demo, driverOnline } = relayTrust
  const { assignments: groups, list: groupList, order } = relayGroups
  const frozen = !relayTrust.controllable
  const sharedIcons = useEntityIcons()
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const { phaseOf, request } = useCommandPhases(relays, frozen, onSetRelay, () =>
    setConfirming(null),
  )
  // Hub power is never a switch in a group: it has its own card, last (hub ADR 0033).
  const reserved = new Set(reservedRelayIds(hubPower))
  const ids = Object.keys(relays).filter((id) => !reserved.has(id))

  if (ids.length === 0 && hubPower.kind === 'none') {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <ToggleLeft aria-hidden="true" className="text-muted size-5" />
        <h2 className="text-foreground text-lg font-semibold">No relays yet.</h2>
        <p className="text-muted text-sm">Waiting for the relay driver to publish.</p>
      </section>
    )
  }

  const pick = (id: string, to: boolean) => {
    if (criticalIds.includes(id)) setConfirming({ id, label: relays[id].name ?? id, to })
    else request(id, to)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 max-md:pt-3">
      <Banner demo={demo} driverOnline={driverOnline} />
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
        {panelsFor(ids, groups, groupList, order).map((panel) => (
          <section
            key={panel.title}
            aria-label={panel.title}
            className="bg-surface border-border flex flex-col gap-4 rounded-2xl border p-4"
          >
            <h2 className="text-muted text-sm font-medium">{panel.title}</h2>
            {panel.ids.map((id) => (
              <Channel
                key={id}
                id={id}
                relay={relays[id]}
                Icon={
                  entityIcon(sharedIcons[iconKey('relay', id)]) ?? icons[id] ?? FALLBACK_RELAY_ICON
                }
                frozen={frozen}
                phase={phaseOf(id)}
                onPick={(to) => pick(id, to)}
                onRetry={(to) => request(id, to)}
              />
            ))}
          </section>
        ))}
        <HubPowerCard onStartWinterMode={onStartWinterMode} onSetRelay={request} />
      </div>
      <AlertDialog
        isOpen={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null)
        }}
      >
        {/* The root is a React Aria DialogTrigger, which warns without a pressable child. This
            dialog is controlled by `confirming`, so the trigger is never pressed: it only
            satisfies the root, and is hidden so it adds no phantom button. */}
        <AlertDialog.Trigger aria-hidden="true" className="hidden" />
        <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              {({ close }) => (
                <>
                  <AlertDialog.Header>
                    <AlertDialog.Heading>
                      Switch {confirming?.to ? 'on' : 'off'} {confirming?.label}?
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Footer>
                    <Button variant="tertiary" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      onPress={() => {
                        if (confirming) request(confirming.id, confirming.to)
                        close()
                      }}
                    >
                      Switch {confirming?.to ? 'on' : 'off'}
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  )
}
