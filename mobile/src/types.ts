// The domain types (one per entity on the bus, and the bus state that holds them) live in
// `@renewvan/core`, shared with the dashboard. This path stays, like the dashboard's `src/types.ts`,
// so the app's files import the bus types from one short path. A star export on purpose:
// React Native's Babel codegen plugin rejects a named `export { Commands }`.
export * from '@renewvan/core'
