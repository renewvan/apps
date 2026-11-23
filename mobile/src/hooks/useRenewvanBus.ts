// The module path the dashboard's copied helpers (`src/lib/connection.ts`, `tailscale.ts`) import
// their bus types from. Here the bus lives in `src/bus` and its types in `@renewvan/core`; this
// re-exports them under the dashboard's path so those files stay byte-for-byte copies.
export type {
  AutoSleepTimeoutMinutes,
  ConnectionStatus,
  DisplayPower,
  HubStatus,
  RouterHealth,
  TailscaleStatus,
} from '@renewvan/core'
