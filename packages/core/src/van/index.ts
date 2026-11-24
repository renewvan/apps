// `@renewvan/core/van`: the Live van (hub CONTEXT.md), the van as a client shows it, derived from
// the retained state of the bus in one place. Every instance the bus knows, reporting or Silent,
// with the calculations drawn only from reporting ones, the Primary battery resolved, the router
// chosen, and the trust rules applied (an entity whose Driver is offline reads as unknown or not
// controllable). Every screen of both apps reads it, not raw retained records.

export {
  instanceStateText,
  liveVan,
  type InstanceState,
  type LiveInstance,
  type LiveInstances,
  type LiveVan,
  type LiveVanInput,
  type Trust,
} from './liveVan'
