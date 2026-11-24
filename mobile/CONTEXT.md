# Renewvan mobile

The phone app for a van running the Renewvan hub. It shows what the hub's drivers publish and sends commands back. Entities, drivers and the bus are defined in the hub's `CONTEXT.md` (`../hub/CONTEXT.md` from this repo's root); this file only adds what is specific to the app.

## Language

**Live van**:
The van as the phone shows it (hub `CONTEXT.md`): `@renewvan/core/van`'s `liveVan`, built once per bus change by `LiveVanProvider` and read by every tab with `useLiveVan()`. Every instance the bus knows, each reporting, **Silent** (hub `CONTEXT.md`) or unknown (its Driver offline), with the power flow, the Primary battery and the starter drawn only from reporting ones; the Primary battery resolved, the router chosen, the **Capabilities**, and an entity whose Driver is offline unknown or not controllable (the tilt on Home, Levels, the map and Settings alike). Settings › Devices and its diagnostics read the raw retained records instead. The Energy tab's Chargers card, and Levels' tanks and temperature sensors, keep a Silent instance listed: a charger reads `Off`, a tank or sensor `Not reporting`, an unknown one `Driver offline` (core's `instanceStateText`). The power flow (the Energy tab's and Home's Energy widget) keeps a source the van has that is not reporting (a Silent shore charger, alternator charger or solar controller, or one whose Driver is offline) as a muted tile or orb reading `Off`, `Not reporting` or `Driver offline`, with no wire, no arc and never 0 W; a source with no instance at all is not drawn, and the totals read only reporting sources.
_Avoid_: bus state (the raw records), snapshot (the power flow's)

**Capability**:
One of the ten entity types the van currently has: part of the **Live van**, per entity type, as `loading`, `absent` or `present` (with an instance count and an `offline` flag). A type is present when a Driver's info `publishes` it or an entity of that type is on the bus.
_Avoid_: feature, module, "installed" as a noun (it is the rule, not the thing)

**Home**:
The app's first screen: the Start tab, a set of **Widgets** the phone's owner chooses, orders and hides.
_Avoid_: Start (the old name), Dashboard (the kiosk app)

**Widget**:
One block on Home, as on the dashboard's phone Start page (Weather, Map, Energy, Heater, …). It may need a **Capability**; it hides when that is absent.
_Avoid_: tile, card (those are looks, not the thing)
