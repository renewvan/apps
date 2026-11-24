// `@renewvan/core/heater`: what a heater card does with a tap (the heater controller): intent →
// Commands to send, the gating and the flags the card draws, all under hub ADR 0021's safety rules.
// The give-up and the pending rules are `@renewvan/core/pending`'s; the heater's phase, mode and
// wording rules are `@renewvan/core/sensors`'.

export {
  decide,
  HEATER_FAILURE_TITLES,
  heaterView,
  INITIAL_CONTROL,
  observedField,
  observeHeater,
  perform,
  resumeAfterStop,
  type HeaterCommands,
  type HeaterControl,
  type HeaterDecision,
  type HeaterField,
  type HeaterIntent,
  type HeaterStep,
  type HeaterView,
} from './controller'
