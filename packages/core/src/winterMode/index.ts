// `@renewvan/core/winterMode`: Winter mode and Hub power (hub ADR 0033). Which relay powers the
// hub, why Start winter mode cannot be sent, what the Hub power card shows, the relays the confirm
// offers to switch off, what a client remembers while the hub is gone and what it offers over
// Bluetooth then (ADR 0034).

export {
  EMPTY_WINTER_MEMORY,
  WINTER_MODE_ANSWER_MS,
  bluetoothOffer,
  hubPowerOf,
  nextWinterMemory,
  relaysLeftOn,
  rememberedWinterMode,
  reservedRelayIds,
  winterModeCard,
  winterModeProblem,
  type BluetoothOffer,
  type HubPower,
  type HubPowerClaim,
  type RememberedHubPower,
  type WinterMemory,
  type WinterModeCard,
  type WinterModeSent,
  type WinterModeGateInput,
} from './winterMode'
