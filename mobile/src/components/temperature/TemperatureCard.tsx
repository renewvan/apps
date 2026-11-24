import { Thermometer } from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { Card, CardHeader, SolidChip, tabular } from '@/components/ui'
import { EntityIcon } from '@/components/EntityIcon'
import { signal } from '@renewvan/brand'
import {
  sensorLabel,
  temperatureBand,
  temperatureReading,
  type TemperatureBandKey,
} from '@renewvan/core/sensors'
import { instanceStateText, type InstanceState } from '@renewvan/core/van'
import { radius, useTheme, type Palette } from '@/theme'
import type { TemperatureSensor } from '@/types'

/** Display range of the scale, in °C. */
const MIN_C = -20
const MAX_C = 50
const MARKS = [-20, -10, 0, 10, 20, 30, 40, 50]
/** The scale's height; its corners are a level bar's (`radius.lg`), like the tank bars. */
const BAR_HEIGHT = 12

interface Band {
  label: string
  color: string
  fg: string
}

/** The colour and text colour of each band: the cold bands are fixed brand colours, the rest the palette's. */
function bandColors(key: TemperatureBandKey, colors: Palette): Pick<Band, 'color' | 'fg'> {
  switch (key) {
    case 'none':
      return { color: colors.default, fg: colors.foreground }
    case 'freezing':
      return { color: signal.freezing, fg: signal.freezingForeground }
    case 'cold':
      return { color: signal.cold, fg: signal.coldForeground }
    case 'cool':
      return { color: signal.cool, fg: signal.coolForeground }
    case 'comfortable':
      return { color: colors.accent, fg: colors.accentForeground }
    case 'warm':
      return { color: colors.warning, fg: colors.warningForeground }
    case 'hot':
      return { color: colors.danger, fg: colors.dangerForeground }
  }
}

/** One place a temperature becomes a colour and a word (the shared bands, in this palette). */
function band(c: number | null, colors: Palette): Band {
  const { key, label } = temperatureBand(c)
  return { label, ...bandColors(key, colors) }
}

const pctOf = (c: number) => Math.min(100, Math.max(0, ((c - MIN_C) / (MAX_C - MIN_C)) * 100))
const fmt = (c: number | null) =>
  c === null ? '--' : Number(c.toFixed(1)) === 0 ? '0.0' : c.toFixed(1)

/**
 * One temperature sensor, as the dashboard's phone row: the reading large, then a horizontal
 * gradient scale from -20° to 50° with a marker where the reading sits. A sensor whose status is
 * not `ok` shows no number: its last value is still retained on the broker but is no longer live.
 * One that is not reporting at all says so in its chip: Not reporting (Silent) or Driver offline.
 */
export function TemperatureCard({
  id,
  sensor,
  state = 'reporting',
  icon,
}: {
  id: string
  sensor: Partial<TemperatureSensor>
  /** The sensor's state in the Live van; reporting when not given. */
  state?: InstanceState
  /** The icon picked for this sensor in Settings (a shared hub setting), by name. */
  icon?: string
}) {
  const { colors } = useTheme()
  const c = temperatureReading(sensor)
  const b =
    state === 'reporting'
      ? band(c, colors)
      : { ...band(null, colors), label: instanceStateText('temperature', state) }
  const name = sensorLabel(id, sensor)

  return (
    <Card>
      <CardHeader
        icon={<EntityIcon name={icon} fallback={Thermometer} size={16} color={colors.muted} />}
        title={name}
        right={<SolidChip label={b.label} color={b.color} fg={b.fg} />}
      />
      <View
        accessible
        accessibilityLabel={
          c === null ? `${name}: no reading` : `${name}: ${fmt(c)} degrees Celsius`
        }
        style={styles.content}
      >
        <Text style={[styles.value, { color: colors.foreground }]}>
          {fmt(c)}
          <Text style={[styles.unit, { color: colors.muted }]}>°C</Text>
        </Text>
        <View style={styles.scale}>
          <Svg width="100%" height={BAR_HEIGHT}>
            <Defs>
              <LinearGradient id={`temp-${id}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#3b82f6" />
                <Stop offset="0.29" stopColor="#38bdf8" />
                <Stop offset="0.43" stopColor="#67e8f9" />
                <Stop offset="0.54" stopColor={colors.accent} />
                <Stop offset="0.66" stopColor={colors.accent} />
                <Stop offset="0.8" stopColor={colors.warning} />
                <Stop offset="1" stopColor={colors.danger} />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height={BAR_HEIGHT}
              rx={radius.lg}
              fill={`url(#temp-${id})`}
            />
          </Svg>
          {c !== null && (
            <View style={[styles.markerRail, { left: `${pctOf(c)}%` }]}>
              <View
                style={[
                  styles.marker,
                  { backgroundColor: colors.foreground, borderColor: colors.background },
                ]}
              />
            </View>
          )}
          <View style={styles.marks}>
            {MARKS.map((m) => (
              <Text key={m} style={[styles.mark, { color: colors.muted }]}>
                {m}°
              </Text>
            ))}
          </View>
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  value: { fontSize: 48, lineHeight: 52, fontWeight: '600', ...tabular },
  unit: { fontSize: 24, fontWeight: '600' },
  scale: { paddingTop: 6 },
  // Zero-width rail at the reading's position, so the marker centres on it.
  markerRail: { position: 'absolute', top: 0, width: 0, alignItems: 'center' },
  marker: { width: 24, height: 24, borderRadius: 12, borderWidth: 4 },
  marks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  mark: { fontSize: 10 },
})
