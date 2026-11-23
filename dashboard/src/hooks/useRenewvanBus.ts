import { useEffect, useReducer, useState } from 'react'
import mqtt, { type MqttClient } from 'mqtt'
import {
  buildCommands,
  commandAllowed,
  emptyBusData,
  reduceBusMessage,
  REAL_ROOT,
  visibleState,
  type BusData,
  type Commands,
  type ConnectionStatus,
  type Publish,
  type RenewvanBusState,
} from '@renewvan/core'
import { getEnv } from '@/config/runtimeEnv'

// The bus types the dashboard's components import from here, now owned by `@renewvan/core`.
export type {
  AutoSleepTimeoutMinutes,
  ConnectionStatus,
  DisplayPower,
  HubStatus,
  RouterHealth,
  TailscaleStatus,
} from '@renewvan/core'

/** What the bus has said (`BusData`), with the van the screens show in place of both roots. */
export interface RenewvanBus extends Omit<BusData, 'real' | 'demo'> {
  /** The visible van: the simulated one while Demo mode is on, never a mix (`visibleState`). */
  state: RenewvanBusState
  status: ConnectionStatus
  /** Sends one message now or not at all, through the Demo mode gate. Stable. */
  publish: Publish
  /** Every Command, bound to `publish`. Stable, so a context or a memoised child can hold them. */
  commands: Commands
}

type BusAction =
  | { type: 'message'; topic: string; payload: string; now: number }
  | { type: 'reset' }

function busReducer(prev: BusData, action: BusAction): BusData {
  if (action.type === 'reset') return emptyBusData
  return reduceBusMessage(prev, action.topic, action.payload, action.now)
}

/**
 * The send side of one hook instance: `publish` and the Commands bound to it, built once so they
 * stay the same functions for the hook's life. The hook tells it the current client and Demo mode
 * flag, which `publish` reads at send time.
 */
function createLink() {
  let client: MqttClient | null = null
  let demoMode = false
  // Now or never: no mqtt.js offline queue, so a Command never lands late, after the user moved on.
  const publish: Publish = (topic, payload) => {
    if (!client?.connected || !commandAllowed(demoMode, topic)) return
    client.publish(topic, payload, { qos: 1, retain: false })
  }
  return {
    publish,
    commands: buildCommands(publish),
    attach: (next: MqttClient | null) => {
      client = next
    },
    setDemoMode: (next: boolean) => {
      demoMode = next
    },
  }
}

/**
 * The live MQTT-over-WebSocket connection to the van's broker, and nothing else: what each message
 * means is `@renewvan/core`'s `reduceBusMessage`, what each Command sends is its `buildCommands`.
 * Env-configured via `VITE_MQTT_WS_URL` (required) and `VITE_MQTT_USERNAME`/`VITE_MQTT_PASSWORD`
 * (optional), resolved at runtime first, build-time as fallback (`../config/runtimeEnv`).
 *
 * It subscribes once to `renewvan/#`, which already covers the `renewvan/demo/` namespace: a second
 * wildcard would make the broker deliver every demo message twice.
 */
export function useRenewvanBus(): RenewvanBus {
  const [data, dispatch] = useReducer(busReducer, emptyBusData)
  // Without a broker URL the effect never connects, so the bus starts (and stays) disconnected.
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    getEnv('VITE_MQTT_WS_URL') ? 'connecting' : 'disconnected',
  )
  const [link] = useState(createLink)
  useEffect(() => link.setDemoMode(data.demoMode), [link, data.demoMode])

  useEffect(() => {
    const url = getEnv('VITE_MQTT_WS_URL')
    // No broker configured: the initial status already says disconnected.
    if (!url) return

    let disposed = false

    const client = mqtt.connect(url, {
      username: getEnv('VITE_MQTT_USERNAME'),
      password: getEnv('VITE_MQTT_PASSWORD'),
      reconnectPeriod: 2000,
    })
    link.attach(client)

    // `end()` fires `close` after the cleanup below has reset the status: a torn-down client
    // must not write any state again.
    const onStatus = (next: ConnectionStatus) => () => {
      if (!disposed) setStatus(next)
    }
    client.on('connect', () => {
      if (disposed) return
      setStatus('connected')
      client.subscribe(`${REAL_ROOT}/#`)
    })
    client.on('reconnect', onStatus('connecting'))
    client.on('close', onStatus('disconnected'))
    client.on('offline', onStatus('disconnected'))
    client.on('error', onStatus('disconnected'))
    client.on('message', (topic, message) => {
      if (disposed) return
      dispatch({ type: 'message', topic, payload: message.toString(), now: Date.now() })
    })

    return () => {
      disposed = true
      client.end(true)
      link.attach(null)
      dispatch({ type: 'reset' })
      setStatus('connecting')
    }
  }, [link])

  const { real: _real, demo: _demo, ...shared } = data
  return {
    ...shared,
    state: visibleState(data),
    status,
    publish: link.publish,
    commands: link.commands,
  }
}
