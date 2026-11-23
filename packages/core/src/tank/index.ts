// `@renewvan/core/tank`: a tank as a client shows it. Its level status and alarm severity (from the
// alarm thresholds the tank publishes), the labels for its fluid and status, the summary line and
// order of a van's tanks, and `tankView`, everything a tank card draws.

export {
  tankLevelStatus,
  tankSeverity,
  type TankLevelStatus,
  type TankSeverity,
} from './tank-alarm'
export { consumptionRateLph, sortTankIds, tankSummary } from './tank-display'
export { FLUID_LABELS, STATUS_LABELS } from './tank-labels'
export { tankView, type TankLabel, type TankView } from './tankView'
