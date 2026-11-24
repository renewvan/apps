import {
  Fan,
  Flame,
  Heater as HeaterIcon,
  Info,
  SunSnow,
  ThermometerSnowflake,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { confirm, NativeButton, NativeSwitch } from '@/components/native'
import { Carousel } from '@/components/Carousel'
import type { HeaterCommands } from '@renewvan/core/heater'
import { Card, CardHeader, tabular } from '@/components/ui'
import { useNow } from '@/hooks/useNow'
import {
  OPERATING_MODES,
  POWER_RANGE,
  SETPOINT_RANGE,
  formatClock,
  hasError,
  phaseLabel,
  type OperatingMode,
} from '@renewvan/core/sensors'
import { alpha, radius, useTheme } from '@/theme'
import type { Heater } from '@/types'
import { DialSlider } from './DialSlider'
import { TimerHeader, TimerPicker } from './HeaterTimer'
import { useHeaterController } from './useHeaterController'

const OPERATING_MODE_ICONS: Record<OperatingMode, LucideIcon> = {
  power: Flame,
  temperature: ThermometerSnowflake,
  ventilation: Fan,
  thermostat: SunSnow,
}

export interface HeaterCardProps {
  id: string
  heater: Heater
  /** Demo mode, or the heater's Driver is not online: everything reads Unknown and nothing is sent. */
  frozen: boolean
  commands: HeaterCommands
  /**
   * `page` (the Climate tab): the setting card, then a card of readings. `widget` (the Start tab):
   * one card with a carousel of the setting and of the timer with the readings, as the dashboard's
   * widget.
   */
  variant?: 'page' | 'widget'
}

function fmt(value: number | undefined, digits: number, unit: string): string {
  return value === undefined ? '—' : `${value.toFixed(digits)} ${unit}`
}

/**
 * How long the heater has been on: it counts every second from the heater's own `runtime_s`
 * whenever that arrives, from zero when it leaves Off, and reads 0:00 while it is off.
 */
function useRunTime(heater: Heater): number {
  const on = heater.phase !== undefined && heater.phase !== 'off'
  const runtime = heater.runtime_s
  const now = useNow(1000).getTime()
  const [seen, setSeen] = useState({ on, runtime })
  const [sync, setSync] = useState({ base: runtime ?? 0, at: now })
  if (seen.on !== on || seen.runtime !== runtime) {
    setSeen({ on, runtime })
    if (!on || !seen.on) setSync({ base: 0, at: now })
    else if (runtime !== undefined) setSync({ base: runtime, at: now })
  }
  return on ? sync.base + Math.max(0, now - sync.at) / 1000 : 0
}

function Readings({ heater, reporting }: { heater: Heater; reporting: boolean }) {
  const { colors } = useTheme()
  const seconds = useRunTime(heater)
  const show = (text: string) => (reporting ? text : '—')
  const rows: [label: string, value: string][] = [
    ['External', show(fmt(heater.external_temperature_c, 1, '°C'))],
    ['Internal', show(fmt(heater.internal_temperature_c, 1, '°C'))],
    ['Heater', show(fmt(heater.heater_temperature_c, 0, '°C'))],
    ['Voltage', show(fmt(heater.voltage_v, 1, 'V'))],
    ['Fan', show(fmt(heater.fan_rpm, 0, 'rpm'))],
    ['Fuel pump', show(fmt(heater.fuel_pump_hz, 1, 'Hz'))],
    ['Runtime', show(formatClock(seconds))],
  ]
  return (
    <View style={styles.readings}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.reading}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
          <Text style={[styles.readingValue, { color: colors.foreground }]}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * One heater: the dial that sets what it should do, the operating modes and Start/Stop, then what
 * it is doing. The dial drives the target temperature, or the power level in the fixed-power and
 * ventilation modes.
 *
 * The card claims no more than the bus does: a command shows pending until the retained field
 * changes, a heater whose Driver is down or whose live fields are cleared reads Unknown rather
 * than off, and controls need the Driver's own `commands_enabled` (hub ADR 0021).
 */
export function HeaterCard({ id, heater, frozen, commands, variant = 'page' }: HeaterCardProps) {
  const { colors } = useTheme()
  const label = heater.name ?? id
  const { view, dispatch } = useHeaterController(id, heater, frozen, commands)
  const { reporting, commandsOn } = view
  const phase = reporting ? phaseLabel(heater) : undefined
  // Warm while the flame is on or coming up, the theme accent otherwise, and always the accent in
  // Ventilation, where the fan runs and nothing burns.
  const tone = view.heating ? colors.warning : colors.accent
  const toneFg = view.heating ? colors.warningForeground : colors.accentForeground
  const cabin = reporting ? heater.internal_temperature_c : undefined

  const confirmStart = () => {
    confirm({
      title: view.armed ? `Start ventilation on ${label}?` : `Start ${label}?`,
      message: view.startSummary,
      action: view.armed ? 'Start ventilation' : 'Start',
      onConfirm: () => dispatch({ kind: 'start' }),
    })
  }

  const pickMode = (next: OperatingMode) => {
    const decision = dispatch({ kind: 'mode', mode: next })
    // Ventilation and the heating modes exclude each other while the heater runs: offer the stop.
    if (decision.kind !== 'askStop') return
    const name = OPERATING_MODES.find((m) => m.key === next)?.label
    confirm({
      title: `Switch to ${name}?`,
      message: `${decision.reason} Stop the heater first?`,
      action: 'Stop heater',
      destructive: true,
      onConfirm: () => dispatch({ kind: 'stopThenMode', then: next }),
    })
  }

  const header = (
    <CardHeader
      icon={<HeaterIcon size={16} color={colors.muted} />}
      title={label}
      right={
        <View style={styles.headerRight}>
          {/* The dial shows the phase; only "Unknown" (not reporting) is worth keeping up here. */}
          {!reporting && (
            <Text style={[styles.unknown, { color: colors.foreground }]}>Unknown</Text>
          )}
          <NativeSwitch
            label={`${label} controls`}
            value={commandsOn}
            // Frozen or not reporting: nothing would answer the change.
            disabled={frozen || !reporting}
            onChange={(on) => commands.setHeaterCommandsEnabled(id, on)}
          />
        </View>
      }
    />
  )

  const setting = (
    <>
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

      {view.info !== undefined && (
        <View style={styles.info}>
          <Info size={14} color={colors.muted} />
          <Text numberOfLines={2} style={[styles.infoText, { color: colors.muted }]}>
            {view.info}
          </Text>
        </View>
      )}

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={`${label} mode`}
        style={[
          styles.modes,
          { backgroundColor: colors.default, opacity: view.modesDisabled ? 0.5 : 1 },
        ]}
      >
        {OPERATING_MODES.map(({ key, label: modeLabel }) => {
          const ModeIcon = OPERATING_MODE_ICONS[key]
          const selected = key === view.mode
          const fg = selected ? toneFg : colors.foreground
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={modeLabel}
              accessibilityState={{ selected, disabled: view.modesDisabled }}
              disabled={view.modesDisabled}
              android_ripple={{ color: alpha(tone, 0.2) }}
              onPress={() => pickMode(key)}
              style={[styles.mode, selected && { backgroundColor: tone, flexGrow: 2.2 }]}
            >
              <ModeIcon size={20} color={fg} />
              {/* The current mode is named; the others are icons to save the width. */}
              {selected && (
                <Text numberOfLines={1} style={[styles.modeLabel, { color: fg }]}>
                  {modeLabel}
                </Text>
              )}
            </Pressable>
          )
        })}
      </View>

      <View style={styles.startStop}>
        <View style={{ flex: 1 }}>
          {view.offersStop ? (
            <NativeButton
              label="Stop"
              variant="danger"
              disabled={view.stopDisabled}
              onPress={() => dispatch({ kind: 'stop' })}
            />
          ) : (
            <NativeButton label="Start" disabled={view.startDisabled} onPress={confirmStart} />
          )}
        </View>
        {view.runBusy && <ActivityIndicator size="small" color={colors.accent} />}
      </View>
      {view.faultBlocksStart && (
        <Text style={{ color: colors.muted, fontSize: 12 }}>Can&apos;t start with a fault.</Text>
      )}
    </>
  )

  const readings = (
    <>
      <TimerHeader />
      <TimerPicker />
      {reporting && hasError(heater) && (
        <View
          accessibilityRole="alert"
          style={[styles.fault, { backgroundColor: alpha(colors.danger, 0.1) }]}
        >
          <TriangleAlert size={16} color={colors.danger} />
          <Text style={{ color: colors.danger, fontSize: 14 }}>
            Heater fault, error {heater.error_code}
          </Text>
        </View>
      )}
      <Readings heater={heater} reporting={reporting} />
    </>
  )

  if (variant === 'widget') {
    return (
      <Card>
        {header}
        <Carousel
          label={label}
          slides={[
            {
              id: 'dial',
              label: 'Setting',
              content: <View style={styles.content}>{setting}</View>,
            },
            {
              id: 'readings',
              label: 'Readings',
              content: <View style={styles.content}>{readings}</View>,
            },
          ]}
        />
      </Card>
    )
  }

  return (
    <>
      <Card>
        {header}
        <View style={styles.content}>{setting}</View>
      </Card>
      <Card style={styles.readingsCard}>{readings}</Card>
    </>
  )
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unknown: { fontSize: 14, fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { fontSize: 12, flex: 1 },
  modes: { flexDirection: 'row', borderRadius: radius['3xl'], overflow: 'hidden' },
  mode: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  modeLabel: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  startStop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  readingsCard: { padding: 16, gap: 12 },
  fault: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.xl,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  readings: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  reading: { width: '50%', gap: 2 },
  readingValue: { fontSize: 14, fontWeight: '600', ...tabular },
})
