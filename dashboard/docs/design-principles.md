# Design Principles

Standing constraints on this dashboard's UI, independent of any single feature. Consult before sizing or spacing interactive controls, or before giving anything a corner radius.

> **The 44×44px rule applies again on branch `HeroUI`.** The HeroUI layout spike (map: "HeroUI base layout: rebuild Header and Sidebar on HeroUI, coss removed") first shipped HeroUI's default component sizes (Button 36-40px, Tab 32px) and dropped the minimum for that effort only. The surfaces ported since re-adopted it: the sidebar rail items, the toast close button and the Tanks page's Configure button. Components not yet re-sized still ship HeroUI's defaults until their page is ported. The rule is not retired for the project: `main`'s standard stands.

## Touch targets: design for fat fingers and gloves

> "Develop these for people with fat fingers, assume that they maybe are using gloves in winter."

The kiosk is a touchscreen mounted in a van, operated by a driver who may be wearing winter gloves and glancing at the screen rather than looking closely. This rules out anything sized or spaced for a mouse pointer or a bare fingertip on a phone.

Concretely:

- **Minimum touch target: 44×44px**, matching [WCAG 2.5.5 (AAA)](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) and the iOS/Android platform minimums — not the smaller 24px WCAG AA floor. A glove blunts precision; err toward the larger end whenever a control's visual size can grow without crowding its neighbors.
- **Space out adjacent controls.** A tight row of small toggles (e.g. the Relays page's Off | On segments, `Sidebar` nav items) needs enough gap that a miss lands on empty space, not the next control.
- **Prefer whole-row hit areas over small controls.** Where a row already has a toggle/switch, make the entire row clickable rather than only the visual switch — the Settings Alerts and Auto-sleep rows (`AlertsView`, `DisplayView` in `src/components/settings/general/preferences/`) make the whole row one `Switch`, with the label and control inside `Switch.Content` and the padding inside it too (native hidden-input association, not a manual `onClick`), so tapping anywhere in the row toggles it. The Relays page (`RelaysPage`) is the other shape: each relay is a full-width two-segment Off | On control with a `min-h-11` (44px) hit area per segment and its Retry button, rather than a small switch.
- **No hover-only affordances.** A gloved finger on a touchscreen has no hover state; every interactive cue (selected-tab highlighting, focus rings) must be visible from a static touch/press state, not a `:hover` reveal.
  - HeroUI's `Toast` reveals its close button on `:hover` only, so on the kiosk it was unreachable. `src/index.css` overrides it: always visible on the frontmost toast, 44×44px hit area. Toasts also dismiss by swiping sideways (`AppToasts`), and sit top-centre just below the app header.

Applies to every interactive surface in `src/`: nav items, switches, buttons, sliders if any are added later.

## Corner radii: HeroUI's scale, from one token

The dashboard and the mobile app (`mobile/`) round corners the same way, so the two look like one product. There is one token, the theme's `--radius` (0.25rem = 4px, `radiusRem` in `packages/brand/src/tokens.ts`), and HeroUI derives its whole scale from it: `rounded-lg` 4px, `rounded-xl` 6px, `rounded-2xl` 8px, `rounded-3xl` 12px. HeroUI's components keep their own radius; anything we build takes **the radius of the HeroUI component it resembles**:

| Looks like HeroUI's | Radius | Ours |
|---|---|---|
| `Button`, `ToggleButton` (`rounded-3xl`) | 12px | every button and link-button, segmented toggles, steppers (heater −/+), drawer menu rows |
| `Card` (`--radius-3xl`) | 12px | cards and power tiles |
| `Chip` (`rounded-2xl`) | 8px | chips and badges, the **Demo** badge included |
| a Settings row or box | 8px (`rounded-2xl`) | Settings rows, boxes and notes, alert rows, relay panels |
| `Switch` track, notes (`rounded-xl`) | 6px | banners and inline notes, map overlay glass |
| `Switch` thumb, `Slider` knob, `Input` (`rounded-lg`, `--radius-field`) | 4px | level bars (tanks, charge, temperature scale, solar, BMS cells, GPS signal) |
| — (`rounded-full`) | circle | only what is round by nature: status dots, orbs, dials, radio buttons, colour swatches, the map's round badges |

- **No pills.** `rounded-full` on anything that is not a circle (a chip, a badge, a button) is not HeroUI's look. The bottom bar's selected-tab indicator copies the Android app's layout (behind the icon only) but keeps HeroUI's tab radius (`rounded-3xl`), not Material's pill.
- **No pixel radii** (`rounded-[16px]`): stay on the scale, so changing `--radius` moves everything.
- **Hand-drawn shapes take `--radius` too.** SVG corners (the cockpit rings, the heater dial) use `cornerRadius` in `start/arcs.ts`.
- **Change it in `packages/brand`.** Both apps get `--radius` from `@renewvan/brand` (the CSS each imports, and `radius` in mobile's `src/theme`, derived from it); edit `src/tokens.ts` there and run `pnpm --filter @renewvan/brand generate`. The website (`renewvan.com`) is noted to follow.
