import { existsSync } from 'node:fs'
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
  // Caddy sits behind the hub's login: a dead `renewvan_session` answers 401 to the map and to the
  // history, which then both just look empty. Say so once, in the dev server's terminal.
  let warnedSession = false
  const viaCaddyProxy = {
    target: viaCaddy,
    changeOrigin: true,
    secure: false, // Caddy's `tls internal` cert is self-signed (dev only)
    headers: { Cookie: `renewvan_session=${env.INFLUX_VIA_CADDY_SESSION ?? ''}` },
    configure: (proxy: {
      on: (event: 'proxyRes', fn: (res: { statusCode?: number }) => void) => void
    }) => {
      proxy.on('proxyRes', (res) => {
        if (res.statusCode !== 401 || warnedSession) return
        warnedSession = true
        console.warn(
          '\n[dashboard] Caddy answered 401: INFLUX_VIA_CADDY_SESSION is missing or expired, so the map and the history stay empty. Sign in at the hub and copy a fresh `renewvan_session` cookie into dashboard/.env, then restart.\n',
        )
      })
    },
  }
  // The basemap is git-ignored and lives on the hub, so a fresh checkout has none. With Caddy
  // reachable and no local file, `vp dev` reads the hub's (same session, Range requests included).
  const basemapViaCaddy =
    viaCaddy && !existsSync(path.resolve(__dirname, 'public/maps/basemap.pmtiles'))
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
        ...(basemapViaCaddy ? { '/maps/basemap.pmtiles': viaCaddyProxy } : {}),
        '/influx': viaCaddy
          ? viaCaddyProxy
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
      pool: 'vmThreads',
    },
  }
})
