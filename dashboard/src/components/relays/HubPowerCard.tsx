import { useEffect, useState } from 'react'
import { AlertDialog, Button, Chip, Label, Spinner, Switch } from '@heroui/react'
import { Snowflake } from 'lucide-react'
import { WINTER_MODE_ANSWER_MS, relaysLeftOn, reservedRelayIds } from '@renewvan/core/winterMode'
import { useLiveVan } from '@/hooks/useLiveVan'

export interface HubPowerCardProps {
  onStartWinterMode: () => void
  /** Switches a relay off when the confirm's "also switch these off" is on. */
  onSetRelay: (id: string, on: boolean) => void
  /** How long to wait for the hub to report Winter mode. Injected in tests. */
  answerMs?: number
}

/** Where a Start winter mode this card sent stands: the hub's `true` is read from the bus. */
type Sent = 'idle' | 'waiting' | 'failed'

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
  const { relays, hubPower, winterMode } = useLiveVan()
  const [confirming, setConfirming] = useState(false)
  const [alsoOff, setAlsoOff] = useState(false)
  const [sent, setSent] = useState<Sent>('idle')

  useEffect(() => {
    if (sent !== 'waiting' || winterMode.reported === true) return
    const timer = setTimeout(() => setSent('failed'), answerMs)
    return () => clearTimeout(timer)
  }, [sent, winterMode.reported, answerMs])

  if (hubPower.kind === 'none') return null

  const { problem } = winterMode
  const leftOn = relaysLeftOn(relays, hubPower)
  const names = leftOn.map((id) => relays[id].name ?? id)
  const reserved = reservedRelayIds(hubPower)
  const title = reserved.map((id) => relays[id]?.name ?? id).join(', ')
  const starting = winterMode.reported === true
  const waiting = sent === 'waiting' && !starting

  const start = () => {
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
      {starting ? (
        <p role="status" className="text-sm">
          Winter mode: the hub is shutting down, then the relay board cuts its power. Wake it with
          the Renewvan phone app, near the van.
        </p>
      ) : waiting ? (
        <p role="status" className="text-muted flex items-center gap-2 text-sm">
          <Spinner size="sm" />
          Starting Winter mode…
        </p>
      ) : sent === 'failed' ? (
        <p role="alert" className="text-danger text-sm">
          The hub did not start Winter mode. Check that the relay board is online, then try again.
        </p>
      ) : (
        problem && <p className="text-muted text-sm">{problem}</p>
      )}
      {!starting && (
        <Button
          variant="secondary"
          className="min-h-11"
          isDisabled={problem !== null || waiting}
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
                    </p>
                    {leftOn.length > 0 && (
                      <Switch className="w-full" isSelected={alsoOff} onChange={setAlsoOff}>
                        <Switch.Content className="w-full justify-between gap-3">
                          <Label className="text-sm">Also switch off {names.join(', ')}</Label>
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
