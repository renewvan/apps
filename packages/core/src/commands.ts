import { iconKey, type IconEntity } from './iconKey'
import {
  entityTopic,
  TOPIC_AUTO_SLEEP_ENABLED_SET,
  TOPIC_AUTO_SLEEP_TIMEOUT_SET,
  TOPIC_BRIGHTNESS_SET,
  TOPIC_DEMO_ENABLED_SET,
  TOPIC_DISPLAY_POWER_SET,
  TOPIC_ENTITY_ICONS_SET,
  TOPIC_PRIMARY_BATTERY_SET,
  TOPIC_RELAY_GROUP_LIST_SET,
  TOPIC_RELAY_GROUPS_SET,
  TOPIC_RELAY_ORDER_SET,
} from './topics'
import type { AutoSleepTimeoutMinutes, HeaterMode, TemperatureUnit } from './types'

// Every Command a client sends: a JSON value on the `/set` topic of the entity or setting it asks
// to change. Always a TARGET, never a toggle, so a Command delivered twice or late cannot flip a
// load back (hub ADR 0013, 0021). Its effect is read back from the retained state, never assumed.

/**
 * Sends one Command now or not at all. The client's `publish` owns the connection and the Demo
 * mode gate (`commandAllowed`): every Command here goes through it, the Demo switch included.
 */
export type Publish = (topic: string, payload: string) => void

export interface Commands {
  /** Sends the TARGET state, never a toggle: a toggle is not idempotent (hub ADR 0013). */
  setRelay: (id: string, on: boolean) => void
  setRelayName: (id: string, name: string) => void
  /**
   * Files a relay channel under a group (Lights, Appliances, USB, ...), or `null` to take it back
   * to Unassigned. The hub plugin owns the shared map (hub ADR 0028).
   */
  setRelayGroup: (id: string, group: string | null) => void
  /**
   * Replaces the list of groups on offer: their names, in display order. The hub plugin owns the
   * shared list and leaves the assignments alone, so a caller that renames or removes a group moves
   * or clears its relays first.
   */
  setRelayGroupList: (names: readonly string[]) => void
  /** Replaces the shared order of relay channels inside a group card: relay ids, first to last. */
  setRelayOrder: (ids: readonly string[]) => void
  /** Starts (`true`) or stops (`false`) the heater: a target, never a toggle (hub ADR 0021). */
  setHeaterRunning: (id: string, run: boolean) => void
  setHeaterMode: (id: string, mode: HeaterMode) => void
  /**
   * Starts (`true`) fan-only ventilation from off, or stops (`false`) the heater. Ventilation is an
   * action, not a `mode` value (hub ADR 0021).
   */
  setHeaterVentilating: (id: string, on: boolean) => void
  setHeaterThermostat: (id: string, on: boolean) => void
  /**
   * Turns the heater Driver's command switch on or off until the Driver restarts (hub ADR 0021). It
   * is the one heater Command the Driver accepts while commands are off.
   */
  setHeaterCommandsEnabled: (id: string, enabled: boolean) => void
  /** Integer 1-30 degrees C. */
  setHeaterSetpoint: (id: string, celsius: number) => void
  /** Integer 0-9. */
  setHeaterPowerLevel: (id: string, level: number) => void
  setTemperatureName: (id: string, name: string) => void
  setTemperatureUnit: (id: string, unit: TemperatureUnit) => void
  /**
   * Picks the icon every client draws an instance with: a lucide component name. The hub plugin
   * owns the shared map (hub ADR 0023).
   */
  setEntityIcon: (entity: IconEntity, id: string, icon: string) => void
  /** Captures the tilt sensor's current attitude as level (park the van level first); the driver persists it. */
  setTiltLevel: (id: string) => void
  /** Clears the captured level, so the angles read raw again. */
  resetTiltLevel: (id: string) => void
  /** `auto` or a battery instance id; the hub plugin persists it and republishes the retained state. */
  setPrimaryBattery: (value: string) => void
  /** Asks `driver-demo` to switch Demo mode for every client; the view follows the bus, not the tap. */
  setDemoMode: (demo: boolean) => void
  /** The kiosk's screen brightness: 0 to 100. */
  setKioskBrightness: (value: number) => void
  setKioskAutoSleepEnabled: (value: boolean) => void
  setKioskAutoSleepTimeoutMinutes: (value: AutoSleepTimeoutMinutes) => void
  /** Wakes (`true`) or sleeps (`false`) the kiosk's screen. */
  setKioskDisplayPower: (on: boolean) => void
}

/** Binds every Command to `publish`. Pure: build once, share everywhere. */
export function buildCommands(publish: Publish): Commands {
  const send = (topic: string, value: unknown) => publish(topic, JSON.stringify(value))
  return {
    setRelay: (id, on) => send(entityTopic('relay', id, 'set'), on),
    // A name is a JSON string, so it goes out quoted: `"Water pump"`.
    setRelayName: (id, name) => send(entityTopic('relay', id, 'name/set'), name),
    setRelayGroup: (id, group) => send(TOPIC_RELAY_GROUPS_SET, { id, group }),
    setRelayGroupList: (names) => send(TOPIC_RELAY_GROUP_LIST_SET, names),
    setRelayOrder: (ids) => send(TOPIC_RELAY_ORDER_SET, ids),
    setHeaterRunning: (id, run) => send(entityTopic('heater', id, 'set'), run),
    setHeaterMode: (id, mode) => send(entityTopic('heater', id, 'mode/set'), mode),
    setHeaterVentilating: (id, on) => send(entityTopic('heater', id, 'ventilating/set'), on),
    setHeaterThermostat: (id, on) => send(entityTopic('heater', id, 'thermostat/set'), on),
    setHeaterCommandsEnabled: (id, enabled) =>
      send(entityTopic('heater', id, 'commands_enabled/set'), enabled),
    setHeaterSetpoint: (id, celsius) => send(entityTopic('heater', id, 'setpoint_c/set'), celsius),
    setHeaterPowerLevel: (id, level) => send(entityTopic('heater', id, 'power_level/set'), level),
    setTemperatureName: (id, name) => send(entityTopic('temperature', id, 'name/set'), name),
    setTemperatureUnit: (id, unit) => send(entityTopic('temperature', id, 'unit/set'), unit),
    setEntityIcon: (entity, id, icon) =>
      send(TOPIC_ENTITY_ICONS_SET, { key: iconKey(entity, id), icon }),
    // The driver treats any payload as "capture"; `reset` clears. Quoted like every other payload.
    setTiltLevel: (id) => send(entityTopic('tilt', id, 'level_zero/set'), 'capture'),
    resetTiltLevel: (id) => send(entityTopic('tilt', id, 'level_zero/set'), 'reset'),
    setPrimaryBattery: (value) => send(TOPIC_PRIMARY_BATTERY_SET, value),
    setDemoMode: (demo) => send(TOPIC_DEMO_ENABLED_SET, demo),
    setKioskBrightness: (value) => send(TOPIC_BRIGHTNESS_SET, value),
    setKioskAutoSleepEnabled: (value) => send(TOPIC_AUTO_SLEEP_ENABLED_SET, value),
    setKioskAutoSleepTimeoutMinutes: (value) => send(TOPIC_AUTO_SLEEP_TIMEOUT_SET, value),
    // The one bare payload: the kiosk plugin's power topic takes `on` / `off`, not JSON.
    setKioskDisplayPower: (on) => publish(TOPIC_DISPLAY_POWER_SET, on ? 'on' : 'off'),
  }
}
