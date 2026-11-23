# dashboard

Read-only React dashboard for the Renewvan hub's Renewvan bus — one responsive
app serving both the 7" in-van kiosk touchscreen (800×480 landscape) and a
laptop browser. Built
from the layout decided in `hub`'s throwaway `prototype/dashboard-06`
branch (variant C: domain pages + radial gauges).

Connects **directly** to the Renewvan bus broker over MQTT-over-WebSocket
(Mosquitto's WS listener) from the browser — no polling backend, not
offline-first. A dropped connection renders a clear "disconnected"
banner, distinguishable from legitimate last-known-state values (every
renewvan-bus topic is retained, so a fresh connection shows real state
immediately, not a blank screen).

## Layout

Three domain pages, same tabbed navigation at every supported width:

| Page   | Content                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tanks  | Radial gauge per tank (`level_pct`), liters-remaining readout, sensor-fault status in place of the readout when `status != ok`                                                                                                                                                                                                                                                                                                          |
| Power  | Tiles or Orbs diagram (Settings › Display & Appearance › Power page): solar, alternator and shore charger into the battery (`soc_pct`, voltage, current, power, time to go), out to the derived loads                                                                                                                                                                                                                                   |
| Map    | MapLibre basemap drawn offline from a regional PMTiles file on the hub (`docs/offline-map.md`), centred on the hub's fix (`latitude`, `longitude`) with a van marker and a fix quality / satellites / speed readout; a message in place of the map until the first fix, an empty map with the van on it outside the file's area, and the same empty map plus an "Offline map unavailable" notice when the file is missing or unreadable |
| Relays | Titled panels of labelled Off \| On controls, one per relay, labelled by the relay's wire `name` (else its id). A critical load asks before switching; a command that does not take effect in 4 seconds reads "Didn't switch" with Retry; an offline relay driver reads Unknown with every control disabled; Demo mode disables every control. `state` means latched, never energised                                                   |

## Brand colors and assets

The dashboard is the source of truth; the mobile app ([`../mobile`](../mobile)) and `renewvan.com/` copy from it. Change it here first.

| What                 | Value                                      | Where                                                                                                                        |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Brand blue (artwork) | `#0385f7`                                  | logo strokes (`assets/logo/svg/*-blue.svg`), `public/favicon.svg`, background of every PWA icon PNG                          |
| UI accent            | `oklch(62.04% 0.195 253.83)` (≈ `#0485f7`) | `--accent` and `--focus` in `src/global.css`; hue 253.83 also tints the neutrals                                             |
| Navy                 | `#0d1826`                                  | `theme_color` / `background_color` in `public/manifest.webmanifest`, `<meta name="theme-color">`, `renewvan-avatar-dark.svg` |

- Logo SVGs live in `assets/logo/svg/`: `symbol` (blue, ink, white), `lockup` (light, dark, ink, white) and `avatar` (blue, dark, light).
- PWA icons live in `public/`: `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` (purpose `any`, the van is 72% of the width), `icon-maskable-512.png` (the van is 62% of the width so Android's circle mask never clips it), `favicon.svg`, `favicon.ico`. They are exported by hand from `symbol-white.svg` on `#0385f7`; there is no generator.
- Copies: `../mobile/assets/` (same artwork, laid out for Android's adaptive icon) and `renewvan.com/public/logo/svg/` (byte-identical to `assets/logo/svg/`).

## Architecture

- `src/hooks/useRenewvanBus.ts` — the adapter: owns the MQTT client, subscribes
  `renewvan/#`, accumulates retained messages into a `RenewvanBusState`, exposes
  connection status. Not unit-tested (thin wrapper around `mqtt.js`), per
  the v0 spec's Testing Decisions.
- `src/components/*` — presentational components (`RelaysPage`, `Tabs`,
  `ConnectionBanner`), each unit-tested against fixed
  props matching the v0.1 schema shapes (`hub/schema/*.schema.json`).
- `src/components/*/*Page.tsx` — per-domain composition of the presentational components
  over `RenewvanBusState`, also unit-tested against fixture entity maps.
- `src/config/relayPanels.ts` — dashboard-side icons and critical loads for the Relays page,
  keyed by channel id (presentation only, never on the wire). It ships empty. The label is the
  relay's wire `name`. The groups are not here: edit the list in Settings › General › Display &
  Appearance › Relays page (`?page=settings&view=relays-page`) and pick a channel's group in
  Settings › Devices › Relays › the channel. Both are shared hub settings
  (`renewvan/hub/relay-group-list`, `renewvan/hub/relay-groups`, hub ADR 0028); a channel with no
  group lands in "Unassigned".

## Configuration

All config is `VITE_*` env vars, see `.env.example`. The published image resolves them at
container runtime from a generated `env.js` (so no credentials are baked into the image); a dev
build or a custom `vp run build` inlines them at build time from `.env`.

| Variable                                    | Default      | Notes                                                                                                                                                                             |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_MQTT_WS_URL`                          | _(required)_ | Broker WebSocket: `/mqtt` (recommended; the container's nginx proxies it to `mosquitto:9001`, so a browser needs only the page's own port) or a full URL, e.g. `ws://<host>:9001` |
| `VITE_MQTT_USERNAME` / `VITE_MQTT_PASSWORD` | _(none)_     | Read-scoped credentials; blank while the broker allows anonymous access                                                                                                           |

## Running

```bash
vp install
cp .env.example .env   # set VITE_MQTT_WS_URL at minimum
vp dev
```

Dev builds also read `?flag.<name>=<value>` URL flags (ignored in a built kiosk): `flag.demo=1` turns Demo
mode on, `flag.nav-pinned=1` pins the kiosk's bottom bar, `flag.heater-dev=1` gives the Heater page a local
heater, and any stored setting (`flag.theme=dark`, `flag.navbar-position=bottom`, ...) is written to
localStorage once. See [docs/heater.md](docs/heater.md) for the Heater page and its local heater.

## Testing

```bash
vp install
vp test
```

Presentational-component and page tests run against fixed props/fixture
entity maps only — no live MQTT connection required.

## Building / deploying

```bash
vp run build   # type-checks (`vp check`), then bundles to dist/ (`vp build`)
# the image is built from the repo root, so the shared packages/ are in its context
cd .. && docker build -f dashboard/Dockerfile -t dashboard .
docker run -p 8080:80 dashboard
```

The Dockerfile builds the static bundle (in CI, with no `VITE_*` set) and serves it via nginx
(`nginx.conf.template`). At container start `docker/generate-env-js.sh` (an nginx
`docker-entrypoint.d` script) writes `env.js` from the _container's_ environment, and the app
reads that before any build-time value (`src/config/runtimeEnv.ts`). So `hub`'s compose passes
`VITE_MQTT_WS_URL` (and the optional credentials) to the container as env vars — do **not**
bake credentials into a custom image. A plain `vp run build` outside a container has no
`env.js`, so it uses the `.env` values inlined at build time.

## Releasing

Start a release from **Actions → Release → Run workflow**, or
`gh workflow run release.yml -f bump=patch` (`minor`, `major`, or `-f version=0.2.0`
to set it explicitly). One run works out the next version from the latest `v*` tag,
commits the `package.json` bump (`chore: release vX.Y.Z`) to `main`, tags that commit,
creates the GitHub release and builds and publishes
`ghcr.io/<owner>/dashboard:<tag>` (and `:latest`) from it, so `main` always holds the
version of its latest release, which the Firmware page shows. `hub`'s deployment
compose file pins the image by tag (never builds from source — see
`hub/docs/adr/0001-compose-services-via-pinned-images-not-git-submodules.md`).

A beta from a feature branch: dispatch the workflow on that branch with **prerelease**
ticked. It runs the tests, publishes only its own tag (never `:latest`) and writes nothing
to `main`. The process is shared by every Renewvan repo and lives in `hub` (`hub/docs/adr/0015-one-release-process-via-reusable-workflows.md`);
this repo's `release.yml` only says what it ships.

## Manual verification

Automated tests cover the presentational layer only. Before relying on
this in the van, verify against real hardware/broker:

- Load on an actual 7" touchscreen (or an 800×480 simulator) and a laptop
  browser against the real Renewvan bus; confirm both wired tanks (`fresh`,
  `grey`), the house battery, and all 16 relay channels render live data
  once `tank`/`battery`/`relay` upstream components are publishing.
  (Ticket 06 item 5 — not verifiable from this environment: no physical
  kiosk display or reachable renewvan-bus broker here.)
- Kill the broker connection and confirm the connection-lost banner
  appears instead of stale-looking numbers.
