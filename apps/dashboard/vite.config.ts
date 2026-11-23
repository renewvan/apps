import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins, loadEnv } from 'vite-plus'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Unprefixed (non-VITE_) variables, for the dev proxy only: Vite does not load .env into process.env.
  const env = loadEnv(mode, __dirname, '')
  const viaCaddy = env.INFLUX_VIA_CADDY_URL?.replace(/\/+$/, '')
  return {
    // Lint, format and staged-file checks live in the workspace root's vite.config.ts.
    plugins: lazyPlugins(() => [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // env.js is generated at container start, after the build, so it can never be in the
              // precache; cache it at runtime (network first) so the installed PWA shell can boot
              // when the hub is unreachable instead of losing its broker URL to a failed request.
              urlPattern: /\/env\.js$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'runtime-env',
                expiration: { maxAgeSeconds: 24 * 60 * 60 },
              },
            },
          ],
        },
      }),
    ]),
    server: {
      // History charts query InfluxDB at the same-origin `/influx`, which Caddy serves in production
      // and injects a read-only token into (ADR 0024). Two ways to reach it in dev:
      //  - INFLUX_VIA_CADDY_URL set (e.g. https://100.115.137.59 over Tailscale, or the Pi's LAN
      //    address): proxy straight to the Pi's Caddy, which already forwards /influx and holds the
      //    token. Caddy sits behind the login (hub ADR 0029), so send a session cookie: INFLUX_VIA_CADDY_SESSION. Its
      //    `tls internal` cert is self-signed, hence secure: false (dev only).
      //  - otherwise: tunnel the hub's Influx (`ssh -L 8086:localhost:8086 renewvan`) and put the
      //    read-only token in `.env` as INFLUXDB_DASHBOARD_TOKEN.
      // None of these are VITE_-prefixed, so they never reach the bundle.
      proxy: {
        '/influx': viaCaddy
          ? {
              target: viaCaddy,
              changeOrigin: true,
              secure: false,
              headers: { Cookie: `renewvan_session=${env.INFLUX_VIA_CADDY_SESSION ?? ''}` },
            }
          : {
              target: env.INFLUXDB_URL ?? 'http://localhost:8086',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/influx/, ''),
              headers: env.INFLUXDB_DASHBOARD_TOKEN
                ? { Authorization: `Token ${env.INFLUXDB_DASHBOARD_TOKEN}` }
                : {},
            },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
    },
  }
})
