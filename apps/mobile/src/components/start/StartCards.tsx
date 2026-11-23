import { Move3d, Thermometer } from 'lucide-react-native'
import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import {
  VAN_REAR_PATH,
  VAN_REAR_W,
  VAN_SIDE_H,
  VAN_SIDE_PATH,
  VAN_SIDE_W,
} from '@/components/art/vanPaths'
import { MutedIcon, TitledCard, tabular } from '@/components/ui'
import { formatTemperature, INDOOR_ID, OUTDOOR_ID } from '@/lib/temperature'
import { formatDeg, isLevel, rearViewRotation, sideViewRotation, tiltReading } from '@/lib/tilt'
import { alpha, useTheme } from '@/theme'
import type { TemperatureSensor, Tilt } from '@/types'

/** Outside and inside at a glance: the Weather widget's readings without the forecast. */
export function TemperatureCard({
  temperatures,
}: {
  temperatures: Record<string, Partial<TemperatureSensor>>
}) {
  const { colors } = useTheme()
  const outdoor = temperatures[OUTDOOR_ID]
  const indoor = temperatures[INDOOR_ID]
  const cells = [
    { key: 'outside', sensor: outdoor, fallback: 'Outside' },
    { key: 'inside', sensor: indoor, fallback: 'Inside' },
  ]
  return (
    <TitledCard icon={<MutedIcon icon={Thermometer} />} title="Temperature">
      <View style={styles.temps}>
        {cells.map(({ key, sensor, fallback }) => (
          <View key={key} style={styles.temp}>
            <Text style={[styles.tempValue, { color: colors.foreground }]}>
              {formatTemperature(sensor)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{sensor?.name ?? fallback}</Text>
          </View>
        ))}
      </View>
    </TitledCard>
  )
}

const VAN_H = 40
/** A row to itself (Levels) has the width for a larger van and reading. */
const VAN_H_STACKED = 80

/** To the tenth of a degree shown: finer sensor noise would redraw the card at every message. */
function shown(deg: number | null): number | null {
  return deg === null ? null : Math.round(deg * 10) / 10
}

/**
 * The van's pitch (side view) and roll (rear view), each drawn tilted by its angle on a ground
 * line: green within a degree of level, amber beyond, and a dash with a grey van while the sensor
 * has no usable reading (dashboard `widgets/tilt/TiltWidget`). Side by side as on the dashboard,
 * or `stacked` in two rows, pitch over roll, where the card has a page to itself (Levels).
 */
export function TiltCard({
  tilt,
  stacked = false,
}: {
  tilt: Partial<Tilt> | undefined
  stacked?: boolean
}) {
  const { roll, pitch } = tiltReading(tilt)
  return (
    <TitledCard icon={<MutedIcon icon={Move3d} />} title="Tilt">
      <View style={[styles.tilt, stacked && styles.tiltStacked]}>
        <TiltView label="Pitch" deg={shown(pitch)} side stacked={stacked} />
        <TiltView label="Roll" deg={shown(roll)} side={false} stacked={stacked} />
      </View>
    </TitledCard>
  )
}

/** One outline of the van, from the side (pitch) or behind (roll), turned by `deg`. */
const TiltView = memo(function TiltView({
  label,
  deg,
  side,
  stacked,
}: {
  label: string
  deg: number | null
  side: boolean
  stacked: boolean
}) {
  const { colors } = useTheme()
  const tone = deg === null ? colors.muted : isLevel(deg) ? colors.success : colors.warning
  const rotation = side ? sideViewRotation(deg) : rearViewRotation(deg)
  const w = side ? VAN_SIDE_W : VAN_REAR_W
  const h = stacked ? VAN_H_STACKED : VAN_H
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${deg === null ? 'no reading' : formatDeg(deg)}`}
      // A row shares its width between the two; a column lets each take its own height.
      style={[styles.tiltCell, !stacked && styles.tiltCellShared]}
    >
      <View style={{ transform: [{ rotate: `${rotation}deg` }], transformOrigin: 'bottom' }}>
        <Svg width={(h * w) / VAN_SIDE_H} height={h} viewBox={`0 0 ${w} ${VAN_SIDE_H}`}>
          <Path
            d={side ? VAN_SIDE_PATH : VAN_REAR_PATH}
            fill="none"
            stroke={tone}
            // The same line weight on screen at either size.
            strokeWidth={(2.5 * VAN_H) / h}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={[styles.ground, { backgroundColor: alpha(colors.foreground, 0.25) }]} />
      <Text style={[styles.angle, stacked && styles.angleStacked, { color: tone }]}>
        {formatDeg(deg)}
      </Text>
      <Text style={{ color: colors.muted, fontSize: stacked ? 16 : 12 }}>{label}</Text>
    </View>
  )
})

const styles = StyleSheet.create({
  temps: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 4 },
  temp: { alignItems: 'center', gap: 4 },
  tempValue: { fontSize: 32, lineHeight: 36, fontWeight: '600', ...tabular },
  tilt: { flexDirection: 'row', gap: 16, paddingTop: 12 },
  tiltStacked: { flexDirection: 'column', gap: 48 },
  tiltCell: { alignItems: 'center', gap: 4 },
  tiltCellShared: { flex: 1 },
  ground: { alignSelf: 'stretch', height: 2, borderRadius: 1, marginVertical: 4 },
  angle: { fontSize: 18, fontWeight: '600', ...tabular },
  angleStacked: { fontSize: 32, lineHeight: 36 },
})
