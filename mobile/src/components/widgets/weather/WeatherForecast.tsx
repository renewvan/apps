import type { Day } from '@renewvan/core/sensors'
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
} from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'
import { tabular } from '@/components/ui'
import { alpha, radius, useTheme } from '@/theme'

// The dashboard's `components/widgets/weather/WeatherForecast.tsx`, drawn with React Native.

/** WMO weather code to icon; shared by the current conditions and each forecast day. */
export function WeatherIcon({ code, size, color }: { code: number; size: number; color: string }) {
  const Icon =
    code === 0
      ? Sun
      : code <= 2
        ? CloudSun
        : code === 3
          ? Cloud
          : code === 45 || code === 48
            ? CloudFog
            : (code >= 71 && code <= 77) || code === 85 || code === 86
              ? Snowflake
              : code >= 95
                ? CloudLightning
                : CloudRain
  return <Icon size={size} color={color} />
}

const dayName = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
const deg = (n: number) => `${Math.round(n)}°`

/** The outlook strip: today (highlighted) and the days after it, each with its icon and high/low. */
export function WeatherForecast({ days }: { days: Day[] }) {
  const { colors } = useTheme()
  return (
    <View style={styles.row}>
      {days.map((d, i) => (
        <View
          key={d.date}
          accessible
          accessibilityLabel={`${i === 0 ? 'Today' : dayName(d.date)}: high ${deg(d.max)}, low ${deg(d.min)}`}
          style={[
            styles.day,
            i === 0 && {
              backgroundColor: alpha(colors.foreground, 0.06),
              borderColor: alpha(colors.foreground, 0.1),
            },
          ]}
        >
          <Text style={[styles.text, { color: i === 0 ? colors.foreground : colors.muted }]}>
            {i === 0 ? 'Today' : dayName(d.date)}
          </Text>
          <WeatherIcon code={d.code} size={16} color={colors.foreground} />
          <Text style={[styles.text, { color: colors.foreground }]}>
            {deg(d.max)} <Text style={{ color: colors.muted }}>{deg(d.min)}</Text>
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  day: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: { fontSize: 10, lineHeight: 13, ...tabular },
})
