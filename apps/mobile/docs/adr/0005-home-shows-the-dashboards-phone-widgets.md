# Home shows the dashboard's phone widgets

Home is the dashboard's phone Start page, widget for widget: Weather, Map, Energy (a carousel of the power flow, then the Primary battery's dial), Heater, Solar production, Tilt, Fresh water, Grey water, in that order and all on by default. The catalogue is `src/lib/widgets.ts`, after the dashboard's `START_WIDGET_IDS`. The group cards of [0001](0001-home-adapts-to-what-the-van-has.md) (Energy, Controls, Water, Climate, Van), the status circles and the app's own Battery and Power flow cards are gone, so the van looks the same on the kiosk's phone layout and in the app.

## Considered options

- **Keep the group cards beside the dashboard's widgets.** Rejected: two ways to show the same battery or tank on one page, and Home would still differ from the dashboard.
- **Put the relays on Home.** Rejected: the dashboard's phone Start page has none; relays are switched on the Controls tab.

## Consequences

- Weather is the dashboard's: Open-Meteo's forecast at the van's GPS position (Berlin without a fix), fetched straight from the phone, with the van's inside and outside readings. The app rounds the position to about a kilometre so GPS drift does not refetch it.
- Temperature, the inside and outside readings alone, is the app's own, after Weather and off by default.
- A widget the van has no device for still stays out of sight (0001); the dashboard shows it with an empty state instead.
- A phone that saved a layout keeps its order for the widgets that remain; the others are dropped, and the new ones appear at their default place.
- A new Home widget starts in the dashboard.
