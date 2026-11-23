# Renewvan apps

The TypeScript clients of the Renewvan bus, in one repo: the dashboard (the van's kiosk and a
laptop's browser) and the mobile app (Android, Expo). Both read the same MQTT bus the hub runs, and
nearly every feature lands in both, so the code they share lives once in `packages/core`
(`@renewvan/core`) instead of being copied between them. Why one repo, and what stays out of it (the
hub, the Drivers, the logger, the website): [hub ADR 0032](https://github.com/renewvan/hub/blob/main/docs/adr/0032-dashboard-and-mobile-share-one-apps-monorepo.md).

```
.
├── dashboard/         React + Vite+ web app, shipped as ghcr.io/renewvan/dashboard (v* tags)
├── mobile/            Expo / React Native phone app, shipped through EAS (builds and OTA updates)
├── packages/core/     @renewvan/core: the bus core (topics, parsers, reducer, Commands, Demo gate), pure TS
├── packages/brand/    @renewvan/brand: logo masters, theme tokens; generates both apps' icons, CSS and palette
├── .github/workflows/ one workflow per app, one for core and one for brand (path-filtered), the mobile OTA publish, the dashboard release
├── package.json       workspace scripts
├── pnpm-workspace.yaml
├── pnpm-lock.yaml     one lockfile for everything
└── vite.config.ts     lint, format and staged-file rules for the workspace
```

## Quickstart

One pnpm workspace (pnpm 11, pinned in `package.json`; [Vite+](https://viteplus.dev) `vp` provides
it, or use pnpm directly). Node.js comes from `.node-version`.

```bash
pnpm install          # once, at the root: installs both apps and sets up the pre-commit hook
```

### Dashboard (no Android SDK needed)

```bash
pnpm --filter dashboard dev          # or: cd dashboard && vp dev
pnpm --filter dashboard test
pnpm --filter dashboard build
```

Copy `dashboard/.env.example` to `dashboard/.env` and set `VITE_MQTT_WS_URL` to a broker.
See [dashboard/README.md](dashboard/README.md).

### Core (`packages/core`)

```bash
pnpm --filter @renewvan/core test       # or: cd packages/core && vp test
pnpm --filter @renewvan/core typecheck
```

Pure TypeScript shipped as source (no build step): no React, no MQTT client, no DOM or React Native,
relative imports only. Each app compiles it with its own toolchain (Vite, Metro, Jest).

### Brand (`packages/brand`)

```bash
pnpm --filter @renewvan/brand generate          # after editing src/tokens.ts or svg/
pnpm --filter @renewvan/brand generate --check  # what the hook and CI run
```

The logo masters and the colours and radius both apps draw, once. The icons, the theme CSS, mobile's
hex palette and the colours in the manifests are generated from them and committed. See
[packages/brand/README.md](packages/brand/README.md).

### Mobile app

```bash
pnpm --filter mobile start           # or: cd mobile && pnpm start
pnpm --filter mobile android         # development build: needs the Android SDK
pnpm --filter mobile test
```

It needs a development build (not Expo Go). See [mobile/README.md](mobile/README.md).

### Against Demo mode

Neither app needs a van. Run a local Mosquitto with a WebSocket listener and the hub's
`driver-demo` against it, then switch Demo mode on (Settings › General in either app, or
`mosquitto_pub -t renewvan/demo/enabled/set -m true`): both apps then show the simulated van and
send no commands. A dashboard dev build also takes `?flag.demo=1` in the URL.

## Checks

```bash
pnpm test             # both apps' tests
pnpm check            # dashboard: vp check (format, lint, types); mobile: typecheck and lint
```

The pre-commit hook (`.vite-hooks/pre-commit`) formats and lints the staged files, type-checks each
part the commit touches and runs only the tests related to the staged files (a change to the root
manifests runs the touched suites in full). CI runs every check and every suite of each part a PR
touches, on path filters; the dashboard's tests run in three shards beside its build.
