# mobile

The Renewvan phone app: the same live view and controls as the dashboard ([`../dashboard`](../dashboard)), as a native
Android app (Expo / React Native). It shows the van's power, tanks, temperatures and tilt, switches
relays and runs the heater, from the van's own network or over Tailscale.

A separate app from the dashboard, in the same repo ([root README](../README.md)). The visual
language is the dashboard's phone layout, redrawn with React Native and platform components; the
logic that decides what a reading means (tank severity, power flow, heater rules, relay grouping)
is shared with the dashboard in `packages/core` (`@renewvan/core/<area>`), so the two cannot
disagree. The wire contract is the hub's (`hub/schema/*.schema.json`).

**Status: beta, 0.1.** Expect rough edges and changes before 1.0. The version is `version` in
`app.json` (shown in Settings); it stays numeric, `major.minor.patch`, as the stores require.

Android is the platform this version is built and tested on. Nothing in it is Android-only by
design (every control has a plain React Native fallback), but iOS has not been run.

## What it does

Five tabs in the platform's own bottom bar (`NativeTabs`, ADR 0006). The Renewvan logo is on the
left of each tab's header; on the right, the Alerts bell (red dot while an alert is open) and
Settings, both opening over the tabs:

| Tab      | Content                                                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home     | The dashboard's phone Start page: the weather (Open-Meteo forecast at the van's position, with its own inside and outside readings), the map, energy (power flow and battery), the heater, solar production, tilt, fresh and grey water |
| Energy   | Solar, alternator and shore charger into the battery and out to the loads, the battery's dial (charge, state and time to go), then the solar controller's daily harvest                                                                 |
| Controls | Titled panels of Off \| On relay controls, grouped and ordered as set in the dashboard's Settings. A critical load asks first. Last, the Hub power card with Start winter mode                                                          |
| Levels   | Sub-tabs: Tanks (level, litres, severity, drain or fill pace), Temperature (every sensor on a -20° to 50° scale) and Tilt                                                                                                               |
| Climate  | The heater: dial, operating modes, Start/Stop, readings                                                                                                                                                                                 |

Every page edits in place, as a phone's home screen does: hold a card (a Home widget, an Energy
card, a relay group's panel, a tank, a temperature sensor, a heater) and the page enters edit mode;
the held card lifts with an accent ring and follows the finger (the page scrolls at its edges), and
every card wears a red (−) badge that hides it. Done in the header, or leaving the page, ends it.
Each page has its editor under Settings › Sections, hidden cards included. The arrangement is this
phone's own (ADR 0007); Controls' groups and what is in them stay shared, set in Settings ›
Sections › Controls. Tilt is a single card and is not arranged. (`react-native-sortables`,
JavaScript only.)

The relay that powers the hub (Hub power, hub ADR 0033) is never an Off | On switch, and never
grouped, ordered or renamed: it has its own card at the end of Controls, whose Start winter mode
shuts the hub down and has the relay board cut its power. Hub wake, which powers it back on from
the phone near the van (hub ADR 0034), is not in this version yet.

Each tab keeps its own stack, so its state, scroll and pushed pages survive a tab switch; tapping the
active tab returns to its first page. The connection is not a header icon: a dropped connection
shows a banner on every page, and the router's signal is in Settings › Connectivity.
Not in this version: the heater timer, the solar
history charts that read InfluxDB, and the map's place name (the dashboard looks it up online;
the app shows the coordinates).

### Map

Where the van is, from its GPS receiver on the bus, drawn as the dashboard draws it: the
hub's offline Protomaps basemap (`/maps/basemap.pmtiles`, built by the dashboard's
`renewvan-build-basemap` skill) in the app's theme, the van marker facing its heading and leaning
with its pitch, and a readout of the coordinates, the fix, satellites in use, speed and heading.
It is a widget on Start (a still card with a button to the full map) and a full page under
Settings › This phone › Map. With no usable van GPS, a tap can use this phone's foreground
location instead, drawn separately as "Your phone" and never published. The map opens on the
current position, else on Freiburg; it never follows the position on its own, the locate button
brings it back.

The basemap is behind the hub's login. MapLibre fetches with its own HTTP client, which does
not share the app's cookie store, so the session cookie captured at sign-in is added as a
header to MapLibre's requests to the hub and to no other host (`src/components/map/mapSession.ts`).
A phone signed in before this version has no captured cookie and shows "Offline map
unavailable" until it signs out and in again. A broker connection has no hub to serve the map.

### Alerts

The dashboard's alert log: Settings › Alerts › Alert log (the header's Settings button and the Alerts row carry a red dot while any
alert is open) is the list, newest first. Alerts come from core's alert rules (`@renewvan/core/alerts`), shared with the dashboard and read off
the Live van, never from a threshold of the app's own:
a tank whose `alarm_state` is `alarm`, a low starter battery, a lost hub connection and a
Tailscale that is down. One opens when its condition starts and resolves when it ends (one whose
tank or battery stops reporting stays open until a reporting value clears it); the row
stays, marked Resolved. Any alert can be deleted, by sliding it left or by its ✕; Clear resolved
deletes every resolved one at once. Deleting an open alert only hides it: it stays quiet until its
condition clears, so it is not raised again at once. The log is kept on the phone, apart from the
dashboard's, and is forgotten on sign-out (another van's alerts are not this one's). Demo mode
lists and notifies the demo van's alerts but never stores them, and leaves the real van's as they
were.

Each new alert is also a system notification (channel "Alerts"; tapping it opens the list), and
Settings › Alerts switches that off. Muting only stops the notifications: the log still
records. The first alert asks the phone for permission, as does switching the setting back on.

These are **local** notifications: the app posts them while its process is alive and connected to
the van (in front, or recently backgrounded). Android suspends a backgrounded app's socket, so a
phone in a pocket for hours, or an app that was swiped away, hears nothing. Remote push (FCM) needs
a sender on the hub watching the same topics and a registered token per phone; that does not exist
yet.

### Hub wake and Direct control

Near the van, the phone reaches a relay board over Bluetooth, with no WiFi, router or hub (hub ADR
0034; the board side is `packages/ble-wake.yaml` in `driver-esp32`):

- **Hub wake** powers the hub back on after Winter mode. The phone remembers Winter mode (and which
  board powers the hub) from the hub's `true` until it reaches the bus again and the hub reports
  `false`, across restarts (`src/winterMode/`). While it remembers it and the van is out of reach,
  every page's banner offers Wake hub; otherwise Wake hub stays quietly in Settings › Connectivity.
  Only the remembered board is listed (a phone that remembers none lists every board and refuses
  one without Hub power); a tap connects, sends `on` to Hub power, and every page says the hub is
  starting until the bus is back.
- **Direct control**, only while the van is out of reach (the banner's Direct control button and
  Settings › Connectivity): a board's allowed channels (its `ble_channels`) as switches, with their
  state read from the board (shown as unknown when the board did not report it). Hub power is shown, never switched. Once the bus is reachable again the
  Bluetooth link is dropped: the bus is the only path whenever it is there.
- Each board's secret is typed once and kept in the phone's secure store only after the board
  accepted it; one the board refuses later (a reflashed board) is forgotten and asked again.

Boards are named by their Driver's name when the bus told the phone of it. When to offer what, and
what the phone remembers, are core's (`bluetoothOffer` and `nextWinterMemory` in
`@renewvan/core/winterMode`); every message and the board's advertised name are
`@renewvan/core/boardBle`'s. The screens are in `src/components/ble/`.
Bluetooth is a native module: it needs a development or store build, not Expo Go (where the
screens say Bluetooth is not available in this build).

### Settings

The dashboard's Settings tree, for a phone:

| Screen                         | What it does                                                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Devices                        | Every Driver and what it publishes, by driver or by entity. Tanks (readings, icon), temperature sensors (name, unit, icon), relays (name, icon, group), the heater (controls switch, sensor), batteries with BMS details and the Primary battery, solar chargers, chargers, GPS with satellite signal, tilt (set level, reset) |
| General                        | Firmware versions, About, the shared Demo mode switch                                                                                                                                                                                                                                                                          |
| General › Display & Appearance | The app's theme                                                                                                                                                                                                                                                                                                                |
| Sections                       | Each page's cards on this phone (which, and in what order): Home's widgets, Energy's cards and power diagram layout (Van tiles or Van orbs), Controls' panels, Levels' tanks and temperature sensors, Climate's heaters. Controls' shared relay groups (add, rename, reorder, remove, order the relays inside one)             |
| Alerts                         | Whether a new alert is posted as a notification on this phone, and the way to the alert list                                                                                                                                                                                                                                   |
| Dashboard                      | The van's touchscreen from anywhere: sleep or wake it, brightness, auto-sleep and its timeout                                                                                                                                                                                                                                  |
| Connectivity                   | The cellular router's signal and data use, the bus link and hub, Tailscale; Wake hub, and Direct control while the van is out of reach                                                                                                                                                                                         |
| Van                            | The vehicle's details                                                                                                                                                                                                                                                                                                          |
| Map                            | The full map: the van's position on the hub's offline basemap, with fix, satellites, speed and heading                                                                                                                                                                                                                         |
| Automation                     | A placeholder; automation is not available yet                                                                                                                                                                                                                                                                                 |
| Connection                     | Which van this phone is signed in to, and signing out (a red dot on the row while the van is out of reach)                                                                                                                                                                                                                     |

Two kinds of setting live there, and the screens say which is which:

- **Shared, on the bus.** Names, units, icons, relay groups and order, the Primary battery, Demo
  mode, the heater's switches, the tilt level and the kiosk's display. Changing one here changes it
  for the dashboard and every other phone, with the same command the dashboard sends.
- **This phone's own.** Alert notifications, theme, Start widgets, the power layout, hidden sensors, how Devices is sorted and the van's
  details, kept in the phone's app storage. The dashboard keeps its equivalents in the kiosk
  browser's storage, which nothing remote can reach; there is no bus topic for them yet, so the
  kiosk's own layout choices (its theme, Start view, navigation position) cannot be changed from
  here.

The app never claims more than the bus says. A command shows as pending until the retained state
changes; a relay or heater whose Driver is offline reads Unknown with its controls disabled; Demo
mode shows the simulated van and sends nothing; a dropped connection shows a banner, because every
bus topic is retained and the last values would otherwise look live.

## Connecting

The sign-in screen asks for the van's address, once. It is stored in the phone's secure store.

- **A hub address** (`192.168.1.50`, `https://renewvan.<tailnet>.ts.net`): the address you open
  the dashboard with. The app signs in to the hub's login service like the dashboard's login page
  does (hub ADR 0029), reads the broker account from `/env.js` and connects to the `/mqtt`
  WebSocket on the same address. The session is a cookie that lasts 30 days; the login password
  is never stored. This is the path that also works over Tailscale. It is HTTPS only: a plain
  `http://` address is refused (the password would cross the network in the clear), except
  `localhost`, `127.0.0.1` and the emulator's `10.0.2.2` for a development stand-in. The session is
  checked again each time the app comes back to the foreground, so one that ended while the phone
  slept lands on sign-in instead of a bus that keeps being refused.
- **A broker address** (`ws://192.168.1.50:9001`): straight to Mosquitto's WebSocket listener,
  with a broker account if the broker asks for one (hub ADR 0026). Van network and development.

The hub serves HTTPS with its own local CA (hub `docs/reference.md`, "Trust the root on each
phone"). Install that root on the phone as usual; the app is built to trust user-installed CAs
(`plugins/withHubNetworkSecurity.js`), which Android apps do not do by default.

## Architecture

- `src/app/` — Expo Router routes: `sign-in`, the `(tabs)` group (`NativeTabs`, one stack per
  tab), and `settings` and `alerts` stacked over the tabs. Protected routes switch between the two on the session.
- `src/session/` — which van this phone is signed in to: address parsing (`hubAddress.ts`), the
  hub's login service (`hubClient.ts`) and the stored session (`SessionProvider.tsx`).
- `src/bus/` — the bus adapter: one MQTT-over-WebSocket client subscribed to `renewvan/#`
  (`RenewvanBusProvider.tsx`, which batches messages into `@renewvan/core`'s `reduceBusMessage`)
  and the hook that binds core's Commands to it (`commands.ts`). What each topic does to the state,
  and the Commands themselves, live in `packages/core`, shared with the dashboard.
  `LiveVanProvider.tsx` builds the **Live van** (`@renewvan/core/van`) once per bus change: every
  tab reads it with `useLiveVan()`, never the raw bus records (Settings › Devices and its
  diagnostics excepted).
- `src/ble/` — the Bluetooth link to a relay board for Hub wake and Direct control when the van's
  network is off (hub ADR 0034): `boardLink.ts` (scan, connect, the signed command write, over
  `react-native-ble-manager`, a native module that needs a development build), `hmac.ts` (the
  HMAC core's `@renewvan/core/boardBle` signs with) and `secrets.ts` (each board's secret in the
  secure store). What the characteristics' text means is core's. Its config plugin is listed
  before `expo-location` in `app.json` on purpose: its manifest mod then runs after
  expo-location's and does not declare the location permissions a second time.
- `src/components/native/` — the form controls: buttons, text fields, the switch, the segmented
  choice and the slider, all HeroUI Native (`heroui-native`, the native sibling of the dashboard's
  HeroUI). Uniwind compiles `src/global.css`, which imports the theme tokens and the 4px
  `--radius` both apps share (`@renewvan/brand`), so both apps draw the same colours and corners (HeroUI's scale, as in the
  dashboard's [`docs/design-principles.md`](../dashboard/docs/design-principles.md)).
  Confirmations are HeroUI dialogs (`confirm`, mounted once by `ConfirmHost`), a heater command the
  heater never confirms is a HeroUI toast, and the dial ticks the phone's haptics.
- `src/components/<domain>/` — the cards each tab stacks. Gauges, the dial, the van diagram and
  the charts are drawn with `react-native-svg`.
- `src/lib/` — the phone's own helpers: the InfluxDB fetch (`influx.ts`), the lucide components
  for the entity icons (`entityIcons.ts`) and Home's widget catalogue (`widgets.ts`). The domain
  logic (tank severity, the power flow, heater rules, relay groups, ...) is `@renewvan/core`'s, one
  entry per area, shared with the dashboard; `src/types.ts` re-exports core's types.
- `src/components/settings/` — the Settings screens: one route (`/settings/[view]`) draws every
  view (`SettingsViewScreen.tsx`), built from the rows in `kit.tsx` under the platform's own app
  bar. `routes.ts` names the views.
- `src/alerts/` — the alert log: core's alerts written to it (`alertLog.ts`, pure and tested),
  its storage and the diff against the Live van (`AlertsProvider.tsx`), and the notifications
  (`notifications.ts`). The list is `components/alerts/AlertsScreen.tsx`, route `/alerts`.
- `src/preferences/` — the phone's own settings: what they are and how they are read back
  (`preferences.ts`, pure and tested) and where they are kept (`PreferencesProvider.tsx`).
- `src/theme/` — the shared light and dark palette as hex (`@renewvan/brand`'s `palettes`) and
  the radius scale; the app follows the phone's setting unless Settings says Light or Dark.

## App icon and colors

Both come from [`packages/brand`](../packages/brand/README.md) (`@renewvan/brand`), shared with the
dashboard. Edit its `src/tokens.ts` or `svg/`, run `pnpm --filter @renewvan/brand generate`, and never
tune the outputs here.

- Colors: `src/global.css` imports the theme tokens (`@renewvan/brand/tokens.native.css`) and
  `src/theme/index.ts` reads the same palette as hex (`palettes`, UI accent `#0485f7`, from
  `oklch(62.04% 0.195 253.83)`). The brand blue of the artwork is `#0385f7`, a hair apart from the accent.
- `src/components/Logo.tsx` draws the symbol from the logo master (`logoSymbol`) with react-native-svg.
- Generated into `assets/`: `icon.png` (1024, the van 72% of the width on brand blue),
  `android-icon-foreground.png` (1024, transparent, the van 41% of the width: Android shows the middle
  72/108 of the canvas, so that is 72% of the launcher circle's radius), `android-icon-monochrome.png`
  (432, same layout; themed icons and the notification icon) and `splash-icon.png`.
- Generated into `app.json`: the adaptive icon's background (brand blue), the notification colour
  (the UI accent) and the splash backgrounds (the light and dark `--background`).
- `android/` is generated, so run `pnpm expo prebuild --clean` after an icon or color changes; it is
  native config, so it ships in a build, not an OTA update.

## mqtt.js on React Native

`mqtt` (the same client the dashboard uses) expects Node-ish `Buffer`/`URL` globals not present in
the Hermes runtime. `index.ts` polyfills both before Expo Router's entry loads anything else.

## Running

The app uses native modules (Reanimated and Gesture Handler for HeroUI Native, the native tab bar,
the secure store), so it needs a
development build; Expo Go cannot run it.

```bash
pnpm install
pnpm expo run:android    # builds and installs the development build, then starts Metro
```

After the first build, `pnpm expo start --dev-client` is enough until a native dependency changes.

The local build needs the Android SDK (platform 36, build-tools 36, NDK 27; Gradle installs what is
missing) and a JDK. With JDK 17 or 21 it works as is. With JDK 25 the native (CMake) steps fail on
a JVM warning unless native access is enabled:

```bash
cd android && JAVA_TOOL_OPTIONS="--enable-native-access=ALL-UNNAMED" ./gradlew assembleDebug "-Dorg.gradle.jvmargs=-Xmx4g --enable-native-access=ALL-UNNAMED"
```

To try it without a van, run a local Mosquitto with a WebSocket listener and `renewvan/driver-demo`
against it, switch Demo mode on (`mosquitto_pub -t renewvan/demo/enabled/set -m true`), and enter
`ws://10.0.2.2:<port>` in the emulator (`10.0.2.2` is the host machine).

## Testing

```bash
pnpm typecheck
pnpm lint
pnpm test
```

The tests cover the logic: the bus connection and batching (the reducer is tested in
`packages/core`), address parsing, the stored preferences, the dial's
geometry and the phone's own helpers (the domain logic shared with the dashboard is tested in
`packages/core`). The screens have no automated tests; see Manual verification.

Dependencies are installed with pnpm, in the repo's one workspace (the version pinned in the root
`package.json`'s `packageManager`); `pnpm install` here installs both apps. The root
`pnpm-workspace.yaml` turns off pnpm's automatic peer installs: an optional web peer of
`expo-router` (`react-dom`) asks for a newer React than Expo SDK 57 pins, so it stays out, and the
root `.pnpmfile.cjs` keeps the dashboard's react-dom out of this app's tree too.

## Building for a physical phone

Not part of `hub`'s compose flow; installed once per phone. Build a standalone APK with
[EAS Build](https://docs.expo.dev/build/introduction/):

```bash
pnpm dlx eas-cli@latest build --platform android --profile preview
```

or locally with `cd android && ./gradlew assembleRelease` after `pnpm expo prebuild`. The `android/`
directory is generated (Continuous Native Generation) and not committed: native settings live in
`app.json` and `plugins/`.

## Over-the-air updates

The store build carries `expo-updates` with the `fingerprint` runtime version, so an update only
reaches builds whose native code matches. Builds on the `preview` and `production` profiles read the
channel of the same name; `development` has none. Settings › About shows the running update id and
a Check for updates button (then Restart to apply); an update is otherwise applied on the next cold
start, with no banner.

- Merging to `main` publishes to `preview` once the "Mobile tests" workflow passes
  (`.github/workflows/mobile-update.yml` at the repo root, needs the `EXPO_TOKEN` secret). A change
  outside this app and the shared packages and manifests publishes nothing.
- Production is a manual promotion: run the "Publish mobile update" workflow with
  `promote_to_production`. It runs in the protected `production` Environment, which holds its
  `EXPO_TOKEN`.
- **Rolling back**: republish the previous good update to the channel's branch, e.g.
  `pnpm dlx eas-cli@latest update:republish --group <previous-group-id> --branch production`
  (`pnpm dlx eas-cli@latest update:list --branch production` lists the groups), or
  `update:rollback-to-embedded` to return to the update built into the store binary.
- A change to native code (a new native module, a config plugin) changes the fingerprint and needs a
  new store build; JS and asset changes do not.

## Manual verification

Verified on an Android 14 emulator against a local broker: the five tabs with `driver-demo`'s
simulated van in light and dark, relay switching including the "Didn't switch" case, the heater's
dial, modes and Start, signing in through a stand-in for the hub's login service (cookie sent on
`/env.js` and on the `/mqtt` WebSocket), signing out, and reconnecting after a restart. In
Settings: the Devices lists and a relay's name, icon and group (commands checked on the broker), the
kiosk display's brightness, timeout and power commands, the theme, and the Start widgets' order and
visibility surviving a reinstall.

Not yet verified, and worth doing before relying on it:

- A real hub over HTTPS: installing Caddy's root on a phone and signing in with the real login.
- A physical phone, on the van's Wi-Fi and over Tailscale, including walking out of range and back.
- Alerts on a real van, and the notifications on a physical phone (Android 13+ permission prompt,
  channel, tap-through). The log logic is covered by tests; the screens and notifications are not.
- A real relay board and a real heater. Command topics and payloads are the dashboard's.
- The Settings commands against the real hub plugins and Drivers (relay groups and names, icons,
  temperature names and units, tilt level, Primary battery, the kiosk display). On the emulator
  they were checked as messages on the broker, not for their effect.
