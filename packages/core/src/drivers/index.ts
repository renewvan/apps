// `@renewvan/core/drivers`: the Drivers on the bus as a client lists them. One row per Driver with
// its status and what it reports, the counts and summaries the Settings pages show, the router's
// Driver, the instance keys the Settings pages and the shared icon map use, and which capabilities
// (entity types) the van has.

export {
  driverRows,
  driversSummary,
  entityCountText,
  heaterDriversOnline,
  instanceCountText,
  relayDriversOnline,
  tiltDriversOffline,
  unsupportedDrivers,
  type DriverRow,
  type DriverStatus,
  type DriverTone,
  type EntityType,
  type UnsupportedDriver,
} from './drivers'
export { driverCounts, driverCountsText, type DriverCounts } from './hubDrivers'
export { routerDriver, routerName } from './routerDriver'
export {
  instanceKey,
  instanceLabel,
  ownerName,
  parseInstanceKey,
  type InstanceType,
} from './instances'
export { capabilitiesOf, type Capability } from './capabilities'
