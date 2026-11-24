import '@testing-library/jest-dom/vitest'
import { vi } from 'vite-plus/test'

// A developer's `.env` (broker URL and credentials for `vp dev`) is loaded into `import.meta.env`
// under Vitest too, so tests that read the connection settings passed or failed with the machine.
// Tests start from an empty environment and stub what they need.
for (const key of ['VITE_MQTT_WS_URL', 'VITE_MQTT_USERNAME', 'VITE_MQTT_PASSWORD']) {
  vi.stubEnv(key, undefined)
}
