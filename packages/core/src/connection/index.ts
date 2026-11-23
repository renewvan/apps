// `@renewvan/core/connection`: how the client reaches the van and how the van reaches the world.
// The uplink tier and badge (router, cellular, Tailscale), the bus status line, the hub's address
// and route, the cellular operator's name from its PLMN, and the Tailscale lines.

export {
  BUS_TONE,
  busStatusText,
  cellularTier,
  connectionBadge,
  connectionTier,
  networkTypeLabel,
  uplinkHeadline,
  type CellularTier,
  type ConnectionInputs,
  type ConnectionTier,
} from './connection'
export {
  classifyHost,
  hubAddress,
  hubRouteText,
  type HubAddress,
  type HubRoute,
} from './hubAddress'
export { plmnOperatorName } from './plmn'
export {
  tailscaleDaemonText,
  tailscaleEndpoints,
  tailscalePeersText,
  tailscaleStatusText,
} from './tailscale'
