import { useState, type CSSProperties } from 'react'
import {
  AlertDialog,
  Button,
  Card,
  Label,
  Spinner,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import {
  Fan,
  Flame,
  Heater as HeaterIcon,
  Info,
  SunSnow,
  ThermometerSnowflake,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { HeaterCommands } from '@renewvan/core/heater'
import {
  OPERATING_MODES,
  POWER_RANGE,
  SETPOINT_RANGE,
  hasError,
  phaseLabel,
  type HeaterTimer,
  type OperatingMode,
} from '@renewvan/core/sensors'
import type { Heater } from '@/types'
import { useIsMobile } from '@/hooks/use-media-query'
import { useLiveVan } from '@/hooks/useLiveVan'
import { DialSlider } from './DialSlider'
import { HeaterReadings } from './HeaterReadings'
import { Carousel } from '../start/Carousel'
import { RunTime } from './RunTime'
import { TimerHeader, TimerPicker } from './TimerPicker'
import { useHeaterController } from './useHeaterController'

/**
 * What drives the heaters: their Commands (the bus's, or the dev-only local heater's stand-in for
 * them), and the local heater's timer. The heaters themselves and whether they can be controlled are
 * the Live van's (`heaters`, `heaterTrust`): a heater whose Driver is offline reads Unknown, and in
 * Demo mode every control is disabled and nothing is ever sent. What a tap sends is the heater
 * controller's (`@renewvan/core/heater`).
 */
export interface HeaterPageProps {
  commands: HeaterCommands
  /**
   * The Autoterm-style timer (On in starts the heater, Off in stops it). The hub and Driver have no
   * timer field, so it only exists on the dev-only local heater; on a real heater the pickers are
   * disabled.
   */
  localTimer?: HeaterTimer
}

const OPERATING_MODE_ICONS: Record<OperatingMode, LucideIcon> = {
  power: Flame,
  temperature: ThermometerSnowflake,
  ventilation: Fan,
  thermostat: SunSnow,
}

/** The heater's name and what it is doing, as one row. */
function HeaterTitle({
  label,
  status,
  commands,
}: {
  label: string
  status: string | undefined
  /** When given, the status is replaced by the controls switch. */
  commands?: { on: boolean; disabled: boolean; onChange: (on: boolean) => void }
}) {
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <HeaterIcon aria-hidden="true" className="text-muted size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </h2>
      {commands ? (
        <div className="flex items-center gap-2">
          {/* The dial shows the phase; only "Unknown" (not reporting) is worth keeping up here. */}
          {commands.disabled && <span className="text-sm font-semibold">{status}</span>}
          <Switch
            isSelected={commands.on}
            isDisabled={commands.disabled}
            onChange={commands.onChange}
          >
            <Switch.Content>
              <Label className="sr-only">{`${label} controls`}</Label>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </div>
      ) : (
        <span className="text-sm font-semibold">{status}</span>
      )}
    </div>
  )
}

interface CardProps extends HeaterPageProps {
  id: string
  heater: Heater
  frozen: boolean
  /** The page's two cards (default), or the Start page's widget: one carousel card. */
  variant?: 'page' | 'widget'
}

const CARD_CLASS = 'min-h-0 gap-0! overflow-hidden p-0!'
/** Both cards' header row: one place for its padding, in line with the content's side padding. */
const HEADER_CLASS = 'flex-row! items-center justify-between gap-2 px-4 py-3 max-md:py-2.5'
/** On a phone Start/Stop lives in the dial card, so this card ends with its readings and notes: more room above and below. */
const CONTENT_CLASS = 'min-h-0 flex-1 gap-4 px-4 pb-3 max-md:pt-3 max-md:pb-5'
/** The dial card is tighter than the status card: the dial gets what the padding gives back. */
const DIAL_CONTENT_CLASS = 'min-h-0 flex-1 gap-2 overflow-y-auto p-3 pt-0 max-md:px-4'

/**
 * One heater as two cards: the dial that sets what it should do (left) and what it is doing
 * (right). The dial drives the target temperature, or the power level in the fixed-power mode,
 * the only setting that mode reads.
 */
export function HeaterCard({
  id,
  heater,
  frozen,
  variant = 'page',
  commands,
  localTimer,
}: CardProps) {
  const label = heater.name ?? id
  const { view, dispatch } = useHeaterController(id, heater, frozen, commands)
  const { reporting, commandsOn, controls } = view
  const isMobile = useIsMobile()
  const [confirmingStart, setConfirmingStart] = useState(false)
  // A mode the heater cannot switch to while it runs: asked about, then reached after a stop.
  const [switchTarget, setSwitchTarget] = useState<{ to: OperatingMode; reason: string } | null>(
    null,
  )
  const phase = reporting ? phaseLabel(heater) : undefined
  // Warm while the flame is on or coming up, the theme accent otherwise, and always the accent in
  // Ventilation, where the fan runs and nothing burns.
  const tone = view.heating ? 'var(--warning)' : 'var(--accent)'
  const toneFg = view.heating ? 'var(--warning-foreground)' : 'var(--accent-foreground)'
  const cabin = reporting ? heater.internal_temperature_c : undefined

  // Start/Stop sits under the mode buttons on a phone, and at the foot of the status card on the kiosk.
  const infoLine =
    view.info !== undefined ? (
      // At most two lines (touch screens have no hover to reveal a cut text). The readings above
      // keep their full height, so a second line pushes Start/Stop down instead of covering them.
      <p className="text-muted flex min-w-0 items-center gap-2 pb-1 text-xs">
        <Info aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="line-clamp-2 min-w-0">{view.info}</span>
      </p>
    ) : null
  // On the phone page and the widget the info line leads the mode buttons; on the kiosk it sits
  // right above Start/Stop.
  const infoAboveModes = isMobile || variant === 'widget'
  const startStop = (
    <div className="flex flex-col gap-1">
      {!infoAboveModes && infoLine}
      <div className="flex items-center gap-3">
        {view.offersStop ? (
          <Button
            variant="danger"
            className="min-h-11 flex-1"
            isDisabled={view.stopDisabled}
            onPress={() => dispatch({ kind: 'stop' })}
          >
            Stop
          </Button>
        ) : (
          <Button
            className="min-h-11 flex-1"
            isDisabled={view.startDisabled}
            onPress={() => setConfirmingStart(true)}
          >
            Start
          </Button>
        )}
        {view.runBusy && <Spinner size="sm" />}
      </div>
      {view.faultBlocksStart && (
        <span className="text-muted text-xs">Can&apos;t start with a fault.</span>
      )}
    </div>
  )

  const dialSlider = (
    <DialSlider
      label={view.byPower ? 'Power' : 'Target'}
      value={view.dialValue}
      min={view.byPower ? POWER_RANGE.min : SETPOINT_RANGE.min}
      max={view.byPower ? POWER_RANGE.max : SETPOINT_RANGE.max}
      unit={view.byPower ? '' : '°C'}
      tone={tone}
      status={phase}
      marker={view.byPower ? undefined : cabin}
      reading={cabin === undefined ? undefined : `${cabin.toFixed(1)} °C`}
      disabled={!view.settingsOk}
      busy={view.dialBusy}
      onCommit={(to) =>
        dispatch(view.byPower ? { kind: 'power', level: to } : { kind: 'setpoint', celsius: to })
      }
    />
  )

  const modeButtons = (
    <ToggleButtonGroup
      aria-label={`${label} mode`}
      fullWidth
      selectionMode="single"
      disallowEmptySelection
      isDisabled={view.modesDisabled}
      selectedKeys={new Set(view.mode === undefined ? [] : [view.mode])}
      onSelectionChange={(keys) => {
        const next = [...keys][0] as OperatingMode | undefined
        // HeroUI re-fires the selection on a re-tap of the selected segment: the controller ignores it.
        if (next === undefined) return
        // Ventilation and the heating modes exclude each other while the heater runs.
        const decision = dispatch({ kind: 'mode', mode: next })
        if (decision.kind === 'askStop')
          setSwitchTarget({ to: decision.to, reason: decision.reason })
      }}
    >
      {OPERATING_MODES.map(({ key, label: modeLabel }) => {
        const ModeIcon = OPERATING_MODE_ICONS[key]
        return (
          <ToggleButton
            key={key}
            id={key}
            aria-label={modeLabel}
            className="min-h-11 flex-1 data-[selected=true]:bg-[var(--tone)] data-[selected=true]:text-[var(--tone-fg)]"
          >
            {({ isSelected }) => (
              <>
                <ModeIcon aria-hidden="true" className="size-5 shrink-0" />
                {/* The current mode is named; the others are icons to save the width. */}
                {isSelected && <span className="truncate text-sm font-medium">{modeLabel}</span>}
              </>
            )}
          </ToggleButton>
        )
      })}
    </ToggleButtonGroup>
  )

  const readings = (
    <>
      {reporting && hasError(heater) && (
        <p
          role="alert"
          className="bg-danger/10 text-danger flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          Heater fault, error {heater.error_code}
        </p>
      )}
    </>
  )

  // The page's sensor readings, as plain content (Settings › Heater keeps a copy).
  const readoutsList = (
    <dl aria-label={`${label} readings`} className="grid grid-cols-2 gap-x-4 gap-y-2">
      <HeaterReadings heater={heater} reporting={reporting} />
      {/* The clock the Start button starts, as on Venus OS: only the Start widget shows it. */}
      {variant === 'widget' && <RunTime heater={heater} reporting={reporting} />}
    </dl>
  )

  const timerHeader = (
    <Card.Header className={`${HEADER_CLASS} mb-0 pb-0.5!`}>
      <TimerHeader timer={localTimer} disabled={!controls} />
    </Card.Header>
  )

  const dialogs = (
    <>
      <AlertDialog isOpen={confirmingStart} onOpenChange={setConfirmingStart}>
        {/* Controlled by `confirmingStart`; the root is a DialogTrigger that warns without a
            pressable child, so a hidden trigger satisfies it (same as the Relays page). */}
        <AlertDialog.Trigger aria-hidden="true" className="hidden" />
        <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              {({ close }) => (
                <>
                  <AlertDialog.Header>
                    <AlertDialog.Heading>
                      {view.armed ? `Start ventilation on ${label}?` : `Start ${label}?`}
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  {view.startSummary !== undefined && (
                    <AlertDialog.Body>{view.startSummary}</AlertDialog.Body>
                  )}
                  <AlertDialog.Footer>
                    <Button variant="tertiary" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      onPress={() => {
                        dispatch({ kind: 'start' })
                        close()
                      }}
                    >
                      {view.armed ? 'Start ventilation' : 'Start'}
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      {/* Venus-style: the mode cannot be reached while the heater runs, so offer the stop it needs. */}
      <AlertDialog
        isOpen={switchTarget !== null}
        onOpenChange={(open) => {
          if (!open) setSwitchTarget(null)
        }}
      >
        <AlertDialog.Trigger aria-hidden="true" className="hidden" />
        <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              {({ close }) => (
                <>
                  <AlertDialog.Header>
                    <AlertDialog.Heading>
                      Switch to {OPERATING_MODES.find((m) => m.key === switchTarget?.to)?.label}?
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>{switchTarget?.reason} Stop the heater first?</AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button variant="tertiary" onPress={close}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      onPress={() => {
                        if (switchTarget !== null) {
                          dispatch({ kind: 'stopThenMode', then: switchTarget.to })
                        }
                        close()
                      }}
                    >
                      Stop heater
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  )

  if (variant === 'widget') {
    // The Start page's widget: one card headed by the heater's name and status, then a carousel of
    // the dial (with the modes and Start/Stop) and the readings. Only the first card's header is
    // used; the readings carry none.
    return (
      <>
        <Card
          aria-label={`${label} widget`}
          className="shrink-0 gap-0! p-0!"
          style={{ '--tone': tone, '--tone-fg': toneFg } as CSSProperties}
        >
          <Card.Header className={HEADER_CLASS}>
            <HeaterTitle
              label={label}
              status={reporting ? phase : 'Unknown'}
              commands={{
                on: commandsOn,
                disabled: frozen || !reporting,
                onChange: (on) => commands.setHeaterCommandsEnabled(id, on),
              }}
            />
          </Card.Header>
          <Card.Content className="px-0 pb-5">
            <Carousel
              label={label}
              slides={[
                {
                  id: 'dial',
                  label: 'Setting',
                  content: (
                    <div className="flex w-full flex-col gap-2 px-4 pb-4">
                      {dialSlider}
                      {infoLine}
                      {modeButtons}
                      {startStop}
                    </div>
                  ),
                },
                {
                  id: 'readings',
                  label: 'Readings',
                  content: (
                    <div className="flex w-full flex-col gap-3 self-start pb-4">
                      {timerHeader}
                      <div className="flex flex-col gap-3 px-4">
                        <TimerPicker timer={localTimer} disabled={!controls} />
                        {readings}
                        {readoutsList}
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </Card.Content>
        </Card>
        {dialogs}
      </>
    )
  }

  return (
    <>
      <Card
        aria-label={`${label} setting`}
        className={CARD_CLASS}
        style={{ '--tone': tone, '--tone-fg': toneFg } as CSSProperties}
      >
        {/* The dial card leads with the heater's name and status, on the kiosk as on a phone. The
            readings card is titled only on a phone, where the cards stack. */}
        <Card.Header className={HEADER_CLASS}>
          <HeaterTitle
            label={label}
            status={reporting ? phase : 'Unknown'}
            commands={{
              on: commandsOn,
              // Frozen or not reporting: nothing would answer the change.
              disabled: frozen || !reporting,
              onChange: (on) => commands.setHeaterCommandsEnabled(id, on),
            }}
          />
        </Card.Header>
        <Card.Content className={DIAL_CONTENT_CLASS}>
          {dialSlider}
          {/* Bottom-anchored, on the same line as the status card's Start/Stop. */}
          <div className="mt-auto flex flex-col gap-3">
            {infoAboveModes && infoLine}
            {modeButtons}
            {isMobile && startStop}
          </div>
        </Card.Content>
      </Card>

      <Card aria-label={`${label} status`} className={CARD_CLASS}>
        {timerHeader}
        <Card.Content className={CONTENT_CLASS}>
          <TimerPicker timer={localTimer} disabled={!controls} />
          {/* The readings at their full height: nothing scrolls, and the one-line info line above
              Start/Stop leaves them room. */}
          <div className="flex flex-1 flex-col gap-3">
            {readings}
            {readoutsList}
          </div>

          {!isMobile && <div className="shrink-0">{startStop}</div>}
        </Card.Content>
      </Card>

      {dialogs}
    </>
  )
}

/** Banner for the one reason every heater reads Unknown or disabled. */
function Banner({ demo, driverOnline }: { demo: boolean; driverOnline: boolean }) {
  if (!demo && driverOnline) return null
  return (
    <p role="status" className="bg-surface text-muted rounded-xl px-3 py-2 text-xs">
      {demo
        ? 'Demo mode: controls are disabled.'
        : 'The heater driver is not online. The heater is unknown and its controls are disabled.'}
    </p>
  )
}

/**
 * The Heater page: one card per heater with its phase, readings and controls. The page claims no
 * more than the bus does: a command shows pending until the retained field changes, and a heater
 * whose Driver is down, or whose live fields are cleared, reads Unknown rather than off (hub ADR
 * 0021). Controls need the Driver's own `commands_enabled`.
 */
export function HeaterPage(commands: HeaterPageProps) {
  const { heaters, heaterTrust } = useLiveVan()
  const { demo, driverOnline } = heaterTrust
  const frozen = !heaterTrust.controllable
  const ids = Object.keys(heaters).sort()

  if (ids.length === 0) {
    return (
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <HeaterIcon aria-hidden="true" className="text-muted size-5" />
        <h2 className="text-foreground text-lg font-semibold">No heater yet.</h2>
        <p className="text-muted text-sm">Waiting for the heater driver to publish.</p>
      </section>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 max-md:pt-3">
      <Banner demo={demo} driverOnline={driverOnline} />
      <div
        className={`grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 ${
          ids.length === 1 ? 'md:min-h-0 md:flex-1 md:grid-rows-[minmax(0,1fr)]' : ''
        }`}
      >
        {ids.map((id) => (
          <HeaterCard key={id} id={id} heater={heaters[id]} frozen={frozen} {...commands} />
        ))}
      </div>
    </div>
  )
}
