// The dashboard's `components/widgets/weather/WeatherWidget.tsx`, drawn with React Native: current
// conditions + the week's outlook (today first) from Open-Meteo (no API key) at the van's GPS
// position, plus the van's own Inside/Outside readings from the driver-temperature probes on the
// bus. Outside shows the outdoor probe and falls back to Open-Meteo's air temperature, labelled
// "(forecast)", when the probe has no valid reading.

import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { tabular } from '@/components/ui'
import {
  INDOOR_ID,
  OUTDOOR_ID,
  formatTemperature,
  temperatureReading,
  parseForecast,
  type Weather,
} from '@renewvan/core/sensors'
import { useTheme } from '@/theme'
import type { TemperatureSensor } from '@/types'
import { WeatherForecast, WeatherIcon } from './WeatherForecast'

const FALLBACK = { lat: 52.52, lon: 13.41 } // Berlin, used when GPS has no fix
const REFRESH_MS = 10 * 60 * 1000

function useWeather(lat: number, lon: number) {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
          `&timezone=auto&forecast_days=7`
        // No cookies: this is not the hub, and the session must never leave it.
        const res = await fetch(url, { credentials: 'omit' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const next = parseForecast(await res.json())
        if (cancelled) return
        if (!next) throw new Error('unexpected response')
        setWeather(next)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    // `load` catches its own failures into `error`, so nothing is left to await.
    void load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [lat, lon])

  return { weather, error }
}

/** About a kilometre: finer than the forecast's grid, so GPS drift does not refetch it. */
const roundCoordinate = (n: number) => Math.round(n * 100) / 100

export interface WeatherWidgetProps {
  lat?: number
  lon?: number
  /** Live bus sensors; `indoor`/`outdoor` (lib/temperature.ts) drive the Inside/Outside readings. */
  temperatures: Record<string, Partial<TemperatureSensor>>
}

export function WeatherWidget({ lat, lon, temperatures }: WeatherWidgetProps) {
  const { colors } = useTheme()
  const { weather, error } = useWeather(
    roundCoordinate(lat ?? FALLBACK.lat),
    roundCoordinate(lon ?? FALLBACK.lon),
  )
  const indoor = temperatures[INDOOR_ID]
  const outdoor = temperatures[OUTDOOR_ID]

  return weather ? (
    <Loaded
      weather={weather}
      indoor={indoor}
      outdoor={outdoor}
      usingFallbackLocation={lat === undefined || lon === undefined}
    />
  ) : (
    <Text accessibilityRole="text" style={[styles.status, { color: colors.muted }]}>
      {error ? `Weather unavailable (${error})` : 'Loading weather…'}
    </Text>
  )
}

function Loaded({
  weather,
  indoor,
  outdoor,
  usingFallbackLocation,
}: {
  weather: Weather
  indoor: Partial<TemperatureSensor> | undefined
  outdoor: Partial<TemperatureSensor> | undefined
  usingFallbackLocation: boolean
}) {
  const { colors } = useTheme()
  // The outdoor probe is the source of truth; Open-Meteo's air temperature only stands in while
  // the probe has no valid reading, and is flagged so a forecast value is never mistaken for the
  // sensor.
  const outdoorFromProbe = temperatureReading(outdoor) !== null
  const outsideText = outdoorFromProbe
    ? formatTemperature(outdoor)
    : formatTemperature({ temperature_c: weather.temp, status: 'ok', unit: outdoor?.unit })

  return (
    <View style={styles.loaded}>
      <View style={styles.now}>
        <WeatherIcon code={weather.code} size={48} color={colors.foreground} />
        <View style={styles.reading}>
          <Text style={[styles.value, { color: colors.foreground }]}>{outsideText}</Text>
          <Text style={[styles.label, { color: colors.muted }]}>
            {outdoor?.name ?? 'Outside'}
            {!outdoorFromProbe && ' (forecast)'}
          </Text>
        </View>
        <View style={styles.reading}>
          <Text style={[styles.value, { color: colors.foreground }]}>
            {formatTemperature(indoor)}
          </Text>
          <Text style={[styles.label, { color: colors.muted }]}>{indoor?.name ?? 'Inside'}</Text>
        </View>
      </View>
      <WeatherForecast days={weather.days} />
      {usingFallbackLocation && (
        <Text style={[styles.fallback, { color: colors.muted }]}>
          no GPS fix - fallback location
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  status: { fontSize: 12, textAlign: 'center', paddingVertical: 24 },
  loaded: { gap: 24, paddingVertical: 8 },
  now: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 4 },
  reading: { alignItems: 'center', gap: 4 },
  value: { fontSize: 30, lineHeight: 34, fontWeight: '600', ...tabular },
  label: { fontSize: 12 },
  fallback: { fontSize: 9, textAlign: 'center' },
})
