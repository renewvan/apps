import { commandAllowed } from './topics'

/** What `sendCommand` needs of an MQTT client; mqtt.js's `MqttClient` fits it. */
export interface CommandClient {
  connected: boolean
  publish(topic: string, payload: string, options: { qos: 1; retain: false }): unknown
}

/**
 * Sends one Command now or not at all: only while connected (mqtt.js would queue an offline
 * publish and send it on reconnect, maybe long after the tap gave up), only through the Demo mode
 * gate (`commandAllowed`), at QoS 1 and never retained. Returns whether it was sent.
 */
export function sendCommand(
  client: CommandClient | null | undefined,
  demoMode: boolean,
  topic: string,
  payload: string,
): boolean {
  if (!client?.connected || !commandAllowed(demoMode, topic)) return false
  client.publish(topic, payload, { qos: 1, retain: false })
  return true
}
