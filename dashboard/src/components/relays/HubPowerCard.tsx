import { useEffect, useState } from 'react'
import { AlertDialog, Button, Chip, Label, Spinner, Switch } from '@heroui/react'
import { Snowflake } from 'lucide-react'
import {
  WINTER_MODE_ANSWER_MS,
  relaysLeftOn,
  reservedRelayIds,
  winterModeCard,
  type WinterModeSent,
} from '@renewvan/core/winterMode'
import { useLiveVan } from '@/hooks/useLiveVan'

export interface HubPowerCardProps {
  onStartWinterMode: () => void
  /** Switches a relay off when the confirm's "also switch these off" is on. */
  onSetRelay: (id: string, on: boolean) => void
  /** How long to wait for the hub to report Winter mode. Injected in tests. */
  answerMs?: number
}

/**
 * The relay that powers the hub (hub ADR 0033), reserved: a Hub power badge and Start winter mode,
 * never an on/off switch. Its only way off is Winter mode, which the hub plugin finishes; the board
 * refuses a plain switch-off anyway. Drawn only while a board announces Hub power.
 */
export function HubPowerCard({
  onStartWinterMode,
  onSetRelay,
  answerMs = WINTER_MODE_ANSWER_MS,
}: HubPowerCardProps) {
  const { relays, hubPower, winterMode, relayTrust } = useLiveVan()
  const [confirming, setConfirming] = useState(false)
  const [alsoOff, setAlsoOff] = useState(false)
  const [sent, setSent] = useState<WinterModeSent>('idle')

  useEffect(() => {
    if (sent !== 'waiting' || winterMode.reported === true) return
    const timer = setTimeout(() => setSent('unanswered'), answerMs)
    return () => clearTimeout(timer)
  }, [sent, winterMode.reported, answerMs])

  if (hubPower.kind === 'none') return null

  const card = winterModeCard({ sent, ...winterMode })
  const leftOn = relaysLeftOn(relays, hubPower)
  const names = leftOn.map((id) => relays[id].name ?? id).join(', ')
  const reserved = reservedRelayIds(hubPower)
  const title = reserved.map((id) => relays[id]?.name ?? id).join(', ')
  // A relay board offline (or Demo mode) holds every relay control: offer no switch that would do
  // nothing, and say which loads stay on.
  const canSwitchOff = leftOn.length > 0 && relayTrust.controllable

  const start = () => {
    // The dialog draws with the card, so this is the van now, not the van it opened on: never send
    // past a problem that arose meanwhile (the card says it), nor with loads that can no longer be
    // switched off.
    if (!card.canStart || (alsoOff && !canSwitchOff)) return
    if (alsoOff) for (const id of leftOn) onSetRelay(id, false)
    onStartWinterMode()
    setSent('waiting')
  }

  return (
    <section
      aria-label="Hub power"
      className="bg-surface border-border flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-medium">{title}</h2>
        <Chip size="sm" variant="soft" color="accent">
          Hub power
        </Chip>
      </div>
      <p className="text-muted text-sm">
        Powers the hub and router. Its only way off is Winter mode.
      </p>
      {card.kind === 'starting' ? (
        <p role="status" className="text-sm">
          Winter mode: the hub is shutting down, then the relay board cuts its power. Wake it with
          the Renewvan phone app, near the van.
        </p>
      ) : card.kind === 'waiting' ? (
        <p role="status" className="text-muted flex items-center gap-2 text-sm">
          <Spinner size="sm" />
          Starting Winter mode…
        </p>
      ) : card.kind === 'lost' ? (
        <p role="status" className="text-muted text-sm">
          Lost the connection to the hub before it reported Winter mode. It may have started: if the
          hub stays unreachable, it is shutting down.
        </p>
      ) : card.kind === 'problem' ? (
        <p className="text-muted text-sm">{card.problem}</p>
      ) : card.kind === 'failed' ? (
        <p role="alert" className="text-danger text-sm">
          The hub did not start Winter mode. Check that the relay board is online, then try again.
        </p>
      ) : null}
      {card.kind !== 'starting' && (
        <Button
          variant="secondary"
          className="min-h-11"
          isDisabled={!card.canStart}
          onPress={() => {
            setAlsoOff(false)
            setConfirming(true)
          }}
        >
          <Snowflake aria-hidden="true" className="size-4" />
          Start winter mode
        </Button>
      )}
      <AlertDialog isOpen={confirming} onOpenChange={setConfirming}>
        {/* Controlled by `confirming`: the trigger only satisfies React Aria's DialogTrigger. */}
        <AlertDialog.Trigger aria-hidden="true" className="hidden" />
        <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              {({ close }) => (
                <>
                  <AlertDialog.Header>
                    <AlertDialog.Heading>Start winter mode?</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body className="flex flex-col gap-3">
                    <p>
                      The hub shuts down, then the relay board cuts its power about 90 seconds
                      later. Once started it cannot be cancelled. To power the hub back on, use Wake
                      hub in the Renewvan phone app, near the van.
                      {leftOn.length > 0 && !canSwitchOff
                        ? ` A relay board is offline, so ${names} ${leftOn.length === 1 ? 'stays' : 'stay'} on.`
                        : null}
                    </p>
                    {canSwitchOff && (
                      <Switch className="w-full" isSelected={alsoOff} onChange={setAlsoOff}>
                        <Switch.Content className="w-full justify-between gap-3">
                          <Label className="text-sm">Also switch off {names}</Label>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Content>
                      </Switch>
                    )}
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button variant="tertiary" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onPress={() => {
                        start()
                        close()
                      }}
                    >
                      Start winter mode
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  )
}
