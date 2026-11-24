// `@renewvan/core/sensors`: the van's other readings as a client shows them. Temperatures (in the
// chosen unit), the GPS fix and satellites, the van's tilt, the heater (its phase, mode, sensor,
// timers and what may be commanded now), the van marker's heading on the map, the weather forecast
// from Open-Meteo, and byte and uptime formatting.

export { formatBytes, formatUptime } from './format'
export {
  CONSTELLATION_LABELS,
  fixLabel,
  formatSnr,
  gpsSummary,
  groupSatellites,
  satelliteName,
  signalFraction,
  signalQuality,
  trackedCount,
  type ConstellationGroup,
  type SignalQuality,
} from './gps'
export {
  INDOOR_ID,
  OUTDOOR_ID,
  convertTemperature,
  formatTemperature,
  sensorLabel,
  sortedSensorIds,
  temperatureBand,
  temperatureReading,
  temperatureSummary,
  titleCase,
  type TemperatureBand,
  type TemperatureBandKey,
} from './temperature'
export {
  formatDeg,
  isLevel,
  rearViewRotation,
  sideViewRotation,
  tiltReading,
  type TiltReading,
} from './tilt'
export {
  HEATER_SENSORS,
  MODE_LABELS,
  OPERATING_MODES,
  PHASE_LABELS,
  POWER_RANGE,
  SETPOINT_RANGE,
  TIMER_PRESETS,
  canChangeSettings,
  canStart,
  canStop,
  formatClock,
  hasError,
  heaterSensor,
  isReporting,
  modeSwitchBlock,
  operatingMode,
  phaseLabel,
  sensorLocked,
  startSummary,
  statusLine,
  timerLabel,
  type HeaterSensor,
  type HeaterTimer,
  type HeaterTimerKind,
  type OperatingMode,
} from './heater'
export { compassPoint, facesLeft, headingDeg } from './vanMarker'
export { parseForecast, type Day, type Weather } from './forecast'
