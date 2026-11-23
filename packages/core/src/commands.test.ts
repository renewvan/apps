import { describe, expect, it, vi } from 'vite-plus/test'
import { buildCommands, commandAllowed } from './index'

function setup() {
  const publish = vi.fn()
  return { publish, commands: buildCommands(publish) }
}

describe('buildCommands', () => {
  it('publishes brightness as a JSON number on the hyphenated /set topic', () => {
    const { publish, commands } = setup()

    commands.setKioskBrightness(42)

    expect(publish).toHaveBeenCalledExactlyOnceWith('renewvan/kiosk/display/brightness/set', '42')
  })

  it('publishes auto-sleep as a JSON boolean', () => {
    const { publish, commands } = setup()

    commands.setKioskAutoSleepEnabled(true)
    commands.setKioskAutoSleepEnabled(false)

    expect(publish).toHaveBeenNthCalledWith(
      1,
      'renewvan/kiosk/display/auto-sleep-enabled/set',
      'true',
    )
    expect(publish).toHaveBeenNthCalledWith(
      2,
      'renewvan/kiosk/display/auto-sleep-enabled/set',
      'false',
    )
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('publishes the auto-sleep timeout as a JSON number', () => {
    const { publish, commands } = setup()

    commands.setKioskAutoSleepTimeoutMinutes(15)

    expect(publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/kiosk/display/auto-sleep-timeout-minutes/set',
      '15',
    )
  })

  it('publishes the display power as a bare on or off, the one payload that is not JSON', () => {
    const { publish, commands } = setup()

    commands.setKioskDisplayPower(true)
    commands.setKioskDisplayPower(false)

    expect(publish).toHaveBeenNthCalledWith(1, 'renewvan/kiosk/display/power/set', 'on')
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/kiosk/display/power/set', 'off')
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('publishes the Demo switch as a JSON boolean through publish, so it meets the gate', () => {
    const { publish, commands } = setup()

    commands.setDemoMode(true)
    commands.setDemoMode(false)

    expect(publish).toHaveBeenNthCalledWith(1, 'renewvan/demo/enabled/set', 'true')
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/demo/enabled/set', 'false')
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it("publishes a sensor name as a quoted JSON string on that sensor's topic", () => {
    const { publish, commands } = setup()

    commands.setTemperatureName('outdoor', 'Galley roof')

    expect(publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/temperature/outdoor/name/set',
      '"Galley roof"',
    )
  })

  it("publishes a sensor unit as a quoted JSON string on that sensor's topic", () => {
    const { publish, commands } = setup()

    commands.setTemperatureUnit('28-000000259026', 'F')

    expect(publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/temperature/28-000000259026/unit/set',
      '"F"',
    )
  })

  it("publishes a relay's target state as a bare JSON boolean on that relay's set topic", () => {
    const { publish, commands } = setup()

    commands.setRelay('relay_03', true)
    commands.setRelay('relay_03', false)

    expect(publish).toHaveBeenNthCalledWith(1, 'renewvan/relay/relay_03/set', 'true')
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/relay/relay_03/set', 'false')
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it("publishes a relay name as a quoted JSON string on that relay's name/set topic", () => {
    const { publish, commands } = setup()

    commands.setRelayName('relay_03', 'Water "pump"')

    expect(publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/relay/relay_03/name/set',
      '"Water \\"pump\\""',
    )
  })

  it('publishes a heater start or stop as a bare JSON boolean on its set topic', () => {
    const { publish, commands } = setup()

    commands.setHeaterRunning('air2d', true)
    commands.setHeaterRunning('air2d', false)

    expect(publish).toHaveBeenNthCalledWith(1, 'renewvan/heater/air2d/set', 'true')
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/heater/air2d/set', 'false')
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('publishes a heater mode as a quoted JSON string on mode/set', () => {
    const { publish, commands } = setup()

    commands.setHeaterMode('air2d', 'power')

    expect(publish).toHaveBeenCalledExactlyOnceWith('renewvan/heater/air2d/mode/set', '"power"')
  })

  it('publishes a heater setpoint and power level as JSON numbers', () => {
    const { publish, commands } = setup()

    commands.setHeaterSetpoint('air2d', 21)
    commands.setHeaterPowerLevel('air2d', 4)

    expect(publish).toHaveBeenNthCalledWith(1, 'renewvan/heater/air2d/setpoint_c/set', '21')
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/heater/air2d/power_level/set', '4')
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it("publishes the heater driver's command switch as a bare JSON boolean", () => {
    const { publish, commands } = setup()

    commands.setHeaterCommandsEnabled('air2d', true)

    expect(publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/heater/air2d/commands_enabled/set',
      'true',
    )
  })

  it('publishes heater ventilation as a bare JSON boolean on ventilating/set', () => {
    const { publish, commands } = setup()

    commands.setHeaterVentilating('air2d', true)

    expect(publish).toHaveBeenCalledExactlyOnceWith('renewvan/heater/air2d/ventilating/set', 'true')
  })

  it('publishes heater thermostat as a bare JSON boolean on thermostat/set', () => {
    const { publish, commands } = setup()

    commands.setHeaterThermostat('air2d', false)

    expect(publish).toHaveBeenCalledExactlyOnceWith('renewvan/heater/air2d/thermostat/set', 'false')
  })

  it("publishes the tilt level capture and reset on that sensor's level_zero/set topic", () => {
    const { publish, commands } = setup()

    commands.setTiltLevel('tilt')
    commands.resetTiltLevel('tilt')

    expect(publish).toHaveBeenNthCalledWith(1, 'renewvan/tilt/tilt/level_zero/set', '"capture"')
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/tilt/tilt/level_zero/set', '"reset"')
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('publishes an entity icon as a key and a name on the hub icons topic', () => {
    const { publish, commands } = setup()

    commands.setEntityIcon('temperature', 'outdoor', 'Park')
    commands.setEntityIcon('tank', 'fresh', 'Droplet')

    expect(publish).toHaveBeenNthCalledWith(
      1,
      'renewvan/hub/icons/set',
      '{"key":"temperature/outdoor","icon":"Park"}',
    )
    expect(publish).toHaveBeenNthCalledWith(
      2,
      'renewvan/hub/icons/set',
      '{"key":"tank/fresh","icon":"Droplet"}',
    )
  })

  it('publishes a relay group as an id and a name on the hub relay-groups topic, null to clear', () => {
    const { publish, commands } = setup()

    commands.setRelayGroup('relay-x8-01', 'Lights')
    commands.setRelayGroup('relay-x8-01', null)

    expect(publish).toHaveBeenNthCalledWith(
      1,
      'renewvan/hub/relay-groups/set',
      '{"id":"relay-x8-01","group":"Lights"}',
    )
    expect(publish).toHaveBeenNthCalledWith(
      2,
      'renewvan/hub/relay-groups/set',
      '{"id":"relay-x8-01","group":null}',
    )
  })

  it('publishes the relay group list as a JSON array of names on the hub list set topic', () => {
    const { publish, commands } = setup()

    commands.setRelayGroupList(['Lights', 'USB'])
    commands.setRelayGroupList([])

    expect(publish).toHaveBeenNthCalledWith(
      1,
      'renewvan/hub/relay-group-list/set',
      '["Lights","USB"]',
    )
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/hub/relay-group-list/set', '[]')
  })

  it('publishes the relay order as a JSON array on the hub order set topic', () => {
    const { publish, commands } = setup()

    commands.setRelayOrder(['relay-x8-02', 'relay-x8-01'])

    expect(publish).toHaveBeenCalledExactlyOnceWith(
      'renewvan/hub/relay-order/set',
      '["relay-x8-02","relay-x8-01"]',
    )
  })

  it('publishes the Primary battery choice as a quoted JSON string on the hub set topic', () => {
    const { publish, commands } = setup()

    commands.setPrimaryBattery('auto')
    commands.setPrimaryBattery('wattcycle')

    expect(publish).toHaveBeenNthCalledWith(1, 'renewvan/hub/primary-battery/set', '"auto"')
    expect(publish).toHaveBeenNthCalledWith(2, 'renewvan/hub/primary-battery/set', '"wattcycle"')
    expect(publish).toHaveBeenCalledTimes(2)
  })
})

describe('commandAllowed', () => {
  it('sends every Command outside Demo mode', () => {
    for (const topic of [
      'renewvan/relay/relay_01/set',
      'renewvan/heater/cabin/set',
      'renewvan/temperature/indoor/name/set',
      'renewvan/hub/relay-groups/set',
    ]) {
      expect(commandAllowed(false, topic)).toBe(true)
    }
  })

  it('holds back every entity and shared-setting Command in Demo mode: the demo ids overlap the real ids', () => {
    for (const topic of [
      'renewvan/relay/relay_03/set',
      'renewvan/relay/relay_03/name/set',
      'renewvan/heater/cabin/set',
      'renewvan/heater/cabin/mode/set',
      'renewvan/temperature/indoor/name/set',
      'renewvan/tilt/tilt/level_zero/set',
      'renewvan/hub/icons/set',
      'renewvan/hub/relay-groups/set',
      'renewvan/hub/relay-group-list/set',
      'renewvan/hub/relay-order/set',
    ]) {
      expect(commandAllowed(true, topic)).toBe(false)
    }
  })

  it('lets kiosk Commands, the Primary battery and the Demo switch through in Demo mode', () => {
    for (const topic of [
      'renewvan/kiosk/display/brightness/set',
      'renewvan/kiosk/display/power/set',
      'renewvan/kiosk/display/auto-sleep-enabled/set',
      'renewvan/kiosk/display/auto-sleep-timeout-minutes/set',
      // A setting of this kiosk's reading, not a Command to a Driver.
      'renewvan/hub/primary-battery/set',
      // The switch itself: how anyone leaves Demo mode.
      'renewvan/demo/enabled/set',
    ]) {
      expect(commandAllowed(true, topic)).toBe(true)
    }
  })

  it('lets every Command buildCommands makes for the kiosk, Primary battery and Demo switch through the gate', () => {
    const sent: string[] = []
    const commands = buildCommands((topic) => {
      if (commandAllowed(true, topic)) sent.push(topic)
    })
    commands.setKioskBrightness(10)
    commands.setKioskDisplayPower(false)
    commands.setPrimaryBattery('auto')
    commands.setDemoMode(false)
    commands.setRelay('relay_01', true)
    commands.setHeaterRunning('cabin', true)
    expect(sent).toEqual([
      'renewvan/kiosk/display/brightness/set',
      'renewvan/kiosk/display/power/set',
      'renewvan/hub/primary-battery/set',
      'renewvan/demo/enabled/set',
    ])
  })
})
