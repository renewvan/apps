# @renewvan/core

What the dashboard and the mobile app share, once ([hub ADR 0032](https://github.com/renewvan/hub/blob/main/docs/adr/0032-dashboard-and-mobile-share-one-apps-monorepo.md)).
Pure TypeScript shipped as source, with no build step: no React, no MQTT client, no DOM or React
Native. Each app compiles it with its own toolchain (Vite, Metro, Jest) and owns its connection,
batching, fetching and rendering.

## Entries

One entry per area, each a folder under `src/` whose `index.ts` is what the apps may import. Inside
the package, imports are relative; an area may use another area's entry and the bus types.

| Import                      | Folder            | What                                                                                                       |
| --------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `@renewvan/core`            | `src/`            | The bus core: topics, parsers, `reduceBusMessage`, the Commands, the Demo mode gate, and the domain types  |
| `@renewvan/core/drivers`    | `src/drivers/`    | The Drivers as Settings lists them, the router's Driver, instance keys, the van's capabilities             |
| `@renewvan/core/connection` | `src/connection/` | The uplink tier and badge, the bus status line, the hub's address and route, cellular operator, Tailscale  |
| `@renewvan/core/tank`       | `src/tank/`       | Tank alarm severity, labels, summary and order, and `tankView` (what a tank card draws)                    |
| `@renewvan/core/power`      | `src/power/`      | Primary and starter battery, BMS alert and details, chargers, time to go, units, the power flow            |
| `@renewvan/core/history`    | `src/history/`    | The Flux queries, the InfluxDB CSV parser and the solar yield views (each app keeps its own fetch)         |
| `@renewvan/core/sensors`    | `src/sensors/`    | Temperatures, GPS, tilt, heater rules, the van marker's heading, the weather forecast, byte and uptime     |
| `@renewvan/core/relays`     | `src/relays/`     | Relay groups and the relays' order, both shared hub settings                                               |
| `@renewvan/core/map`        | `src/map/`        | The basemap's MapLibre style (Protomaps flavors), typed with MapLibre's style-spec                         |
| `@renewvan/core/icons`      | `src/icons/`      | The icon names each Settings picker offers and `iconKey`; each app maps the names to its lucide components |
| `@renewvan/core/van`        | `src/van/`        | The Live van (`liveVan`): the van as a client shows it, drawn from the bus state with the trust rules      |
| `@renewvan/core/alerts`     | `src/alerts/`     | The alert rules off the Live van: which are open (`desiredAlerts`), `reconcile`, the Demo mode rule        |

A new area is a folder with an `index.ts` and an entry in `package.json` `exports`.

## Commands

```bash
pnpm --filter @renewvan/core test       # or: cd packages/core && vp test
pnpm --filter @renewvan/core typecheck
```

The tests are Vitest (`vite-plus/test`), next to the code they test. Mobile's Jest does not run
them; the pre-commit hook only adds `packages/` to Jest's roots to find the mobile tests that use a
staged core file.

`src/platform.d.ts` declares the few web-platform globals core reads that TypeScript's ES lib lacks
(`URL`), for core's own type check only: each app compiles core against its own declarations.
