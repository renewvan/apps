// `@renewvan/core/vanDetails`: the details of its own van (name, plate, map colour) a client keeps
// for its owner, and how they are read back from storage. Not the Live van (`@renewvan/core/van`).

export {
  EMPTY_VAN_DETAILS,
  HEX_COLOR,
  readVanDetails,
  VAN_COLOR_PRESETS,
  VAN_FIELDS,
  VAN_LABELS,
  type VanDetails,
} from './vanDetails'
