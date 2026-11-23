// `@renewvan/core/relays`: the relay groups and the relays' order, both shared hub settings (hub
// ADR 0028). Resolving which group each relay is in, the edits a client makes to the group list
// (add, rename, reorder, remove) and their limits, and sorting relays by the shared order.

export {
  DEFAULT_RELAY_GROUP_LIST,
  RELAY_GROUP_LIST_MAX,
  RELAY_GROUP_MAX,
  RELAY_GROUP_NAME_MAX,
  UNASSIGNED_GROUP,
  addedRelayGroup,
  canAddRelayGroup,
  ownGroups,
  relayGroupNameProblem,
  renamedRelayGroups,
  reorderedRelayGroups,
  resolvedRelayGroups,
  withoutRelayGroup,
} from './relayGroups'
export { reorderedRelayOrder, sortByRelayOrder } from './relayOrder'
