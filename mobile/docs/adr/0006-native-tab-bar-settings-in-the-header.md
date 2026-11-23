# The native tab bar, with Settings and Alerts in the header

Supersedes ADR 0004. The bottom bar is the platform's own (`NativeTabs` from `expo-router/unstable-native-tabs`): Home, Energy, Controls, Levels, Climate, five equal tabs. The header of each tab's first page holds the logo on the left and, on the right, the Alerts bell and Settings, which open over the tabs. The heater, which shared Controls with the relays, has its own tab, Climate; Controls is the relays.

The raised Home button was the reason for the custom bar, and it was not worth what the custom bar cost: accessibility roles, label scaling, keyboard handling, haptics, shadows and an experimental `expo-router/ui` API all ours to maintain, and a bar that looked like neither platform. The native bar gives those for free, and on iOS 26 its glass.

The router's connection icon left the header with this change. A lost connection already shows a banner on every page (`Screen`), so the icon said nothing new; the signal and data use stay in Settings › Connectivity.

## Consequences

- Android allows five tabs at most. A sixth section goes into Settings or a sub-tab, not the bar.
- Every tab is always in the bar; a van without a heater or relays gets an empty state in that tab.
