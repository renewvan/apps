# Renewvan apps

The TypeScript clients of the Renewvan bus, in one repo: the dashboard (the van's kiosk and a
laptop's browser) and the mobile app (Android, Expo). Both read the same MQTT bus the hub runs, and
nearly every feature lands in both, so the code they share is to live once in `packages/core`
(`@renewvan/core`) instead of being copied between them. Why one repo, and what stays out of it (the
hub, the Drivers, the logger, the website): [hub ADR 0032](https://github.com/renewvan/hub/blob/main/docs/adr/0032-dashboard-and-mobile-share-one-apps-monorepo.md).

```
.
├── apps/
│   ├── dashboard/     React + Vite+ web app, shipped as ghcr.io/renewvan/dashboard (v* tags)
│   └── mobile/        Expo / React Native phone app, shipped through EAS (builds and OTA updates)
├── packages/          shared workspace packages (packages/core comes next)
├── .github/workflows/ one workflow per app (path-filtered), the mobile OTA publish, the dashboard release
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
pnpm --filter dashboard dev          # or: cd apps/dashboard && vp dev
pnpm --filter dashboard test
pnpm --filter dashboard build
```

Copy `apps/dashboard/.env.example` to `apps/dashboard/.env` and set `VITE_MQTT_WS_URL` to a broker.
See [apps/dashboard/README.md](apps/dashboard/README.md).

### Mobile app

```bash
pnpm --filter mobile start           # or: cd apps/mobile && pnpm start
pnpm --filter mobile android         # development build: needs the Android SDK
pnpm --filter mobile test
```

It needs a development build (not Expo Go). See [apps/mobile/README.md](apps/mobile/README.md).

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

The pre-commit hook (`.vite-hooks/pre-commit`) formats and lints the staged files and runs the
checks of each app the commit touches. CI does the same per app, on path filters.
