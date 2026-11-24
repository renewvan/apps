// `@renewvan/core/dial`: the Start-page dials (battery and tanks) as a client draws them, minus the
// colours: each dial carries a colour role (`DialTone`) that the app maps to its own palette.

export {
  batteryDial,
  batteryLevel,
  tankDial,
  type BatteryLevel,
  type DialTone,
  type DialView,
} from './dial'
