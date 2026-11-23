// `@renewvan/core`: what the dashboard and the mobile app share (hub ADR 0032), starting with the
// bus core. Pure TypeScript: no React, no MQTT client, no DOM or React Native. Each app owns its
// connection, batching and rendering, and feeds every message through `reduceBusMessage`.

// Everything the bus has said, one message at a time.
export { emptyBusData, reduceBusMessage, routerHealthOf, visibleState } from './reducer'

// The Commands (`buildCommands`, `Commands`, `Publish`), and the Demo mode gate a client's
// `publish` applies to them. A star export on purpose: React Native's Babel codegen plugin rejects
// any `export { Commands }` specifier (the name is reserved for `codegenNativeCommands`), so mobile
// could not compile a named re-export. Never re-export `Commands` by name in mobile either.
export * from './commands'
export { commandAllowed, DEMO_ROOT, REAL_ROOT } from './topics'
export { sendCommand, type CommandClient } from './commandClient'
export { iconKey, type IconEntity } from './iconKey'

// The domain and bus types.
export * from './types'
