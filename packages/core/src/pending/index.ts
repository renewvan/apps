// `@renewvan/core/pending`: a Command in flight (pending, then failed after a give-up) judged against
// the retained field that confirms it. Used by the heater controller and the relay switches.

export { GIVE_UP_MS, giveUp, observe, settle, track, type Pending, type Pendings } from './pending'
