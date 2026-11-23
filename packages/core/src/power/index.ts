// `@renewvan/core/power`: the van's electrical system as a client shows it. Which battery is the
// primary one, the starter battery, a BMS protection alert, what each charger is doing, the
// battery's time to go, and the power flow (`flowFromBus`): its sources, battery and loads, their
// watts and the pulses along its edges.

export { bmsAlert, protectionLabel, type BmsAlert } from './bmsAlert'
export {
  CHARGING_LABELS,
  chargerWatts,
  charging,
  type Charging,
  type ChargingKind,
} from './charging'
export {
  AUTO_PRIMARY_BATTERY,
  compareInstanceIds,
  completeBatteryIds,
  primaryBattery,
  type PrimaryBattery,
  type PrimaryBatteryMode,
} from './primaryBattery'
export { starterBattery, type StarterBattery } from './starterBattery'
export { batteryTimeToGoS, formatTimeToGo } from './time-to-go'
export {
  BATTERY_STATE_LABEL,
  IDLE_W,
  PULSE_PAUSE_S,
  buildFlow,
  flowFromBus,
  flowSeconds,
  formatPower,
  inputWatts,
  pulseClock,
  pulsePass,
  pulseSeconds,
  sourceOpener,
  type FlowEdge,
  type FlowInput,
  type FlowNode,
  type InverterInput,
  type NodeId,
  type PowerSnapshot,
  type SourceId,
} from './flowModel'
