// `@renewvan/core/winterMode`: Winter mode and Hub power (hub ADR 0033). Which relay powers the
// hub, why Start winter mode cannot be sent, the relays the confirm offers to switch off, and what a
// client remembers while the hub is gone.

export {
  WINTER_MODE_ANSWER_MS,
  hubPowerOf,
  relaysLeftOn,
  rememberedWinterMode,
  reservedRelayIds,
  winterModeProblem,
  type HubPower,
  type HubPowerClaim,
  type WinterModeGateInput,
} from './winterMode'
