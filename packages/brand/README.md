# @renewvan/brand

Renewvan's logo, app icons, colours and corner radius, once for both apps. Two things are edited by
hand; everything else is generated from them and committed:

- `src/tokens.ts`: brand blue `#0385f7`, navy `#0d1826`, HeroUI's light and dark theme tokens (oklch)
  and `--radius` (0.25rem).
- `svg/`: the logo masters (`symbol` blue, ink, white; `lockup` light, dark, ink, white; `avatar`
  blue, dark, light). They come from the design tool; replace a file rather than editing it.

After changing either:

```bash
pnpm --filter @renewvan/brand generate          # writes what changed
pnpm --filter @renewvan/brand generate --check  # writes nothing; fails if an output is stale
```

Commit the outputs with the change. The pre-commit hook and CI (`.github/workflows/brand.yml`) run
`--check`. The mobile app's icons and colours are native config: after a change there, run
`pnpm expo prebuild --clean` in `mobile/` (and ship a build, not an OTA update).

## What is generated where

| Output                                                                                        | From                                                            | Read by                                                             |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `tokens.web.css`                                                                              | tokens                                                          | dashboard `src/index.css` (`@import`, just before `src/global.css`) |
| `tokens.native.css`                                                                           | tokens                                                          | mobile `src/global.css` (`@import`, Uniwind)                        |
| `src/palette.ts` (`palettes`, `Palette`)                                                      | tokens, oklch → sRGB hex                                        | mobile `src/theme` (parts drawn by hand)                            |
| `src/logo.ts` (`logoSymbol`, `logoWordmark`)                                                  | `svg/renewvan-symbol-blue.svg`, `svg/renewvan-lockup-light.svg` | mobile `src/components/Logo.tsx`                                    |
| `dashboard/public/favicon.svg`, `favicon.ico` (16, 32, 48)                                    | `symbol-blue`                                                   | the browser tab                                                     |
| `dashboard/public/icon-*.png`, `apple-touch-icon.png`                                         | `symbol-white` on brand blue                                    | the PWA manifest, iOS                                               |
| `mobile/assets/*.png`                                                                         | `symbol-white` / `symbol-blue`                                  | `mobile/app.json`                                                   |
| colours in `dashboard/public/manifest.webmanifest`, `dashboard/index.html`, `mobile/app.json` | tokens                                                          | the PWA, Expo                                                       |

The dashboard imports the lockups straight from here (`@renewvan/brand/svg/renewvan-lockup-*.svg`).
The website (`renewvan.com`, another repo) still copies `svg/` by hand.

## Icon proportions

The van's width is its drawn width (strokes included), as a share of the icon's width. The icons
centre it on one point of the symbol (x 61, y 54, a little above the middle of its box); the splash
centres the symbol's own canvas.

| File                                                                         | Size              | Van                                        | Background                                         |
| ---------------------------------------------------------------------------- | ----------------- | ------------------------------------------ | -------------------------------------------------- |
| `dashboard/public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`      | 192, 512, 180     | 72%                                        | brand blue                                         |
| `dashboard/public/icon-maskable-512.png`                                     | 512               | 62% (Android's circle mask never clips it) | brand blue                                         |
| `dashboard/public/favicon.svg`, `favicon.ico`                                | 1024 / 16, 32, 48 | 100%                                       | none, blue van                                     |
| `mobile/assets/icon.png` (iOS, legacy Android)                               | 1024              | 72%                                        | brand blue                                         |
| `mobile/assets/android-icon-foreground.png`                                  | 1024              | 41.2%                                      | none (adaptive background: brand blue)             |
| `mobile/assets/android-icon-monochrome.png` (themed icon, notification icon) | 432               | 41.2%                                      | none                                               |
| `mobile/assets/splash-icon.png`                                              | 1024              | 80%, blue van                              | none (splash background: the theme's `background`) |

Android's adaptive icon shows the middle 72/108 of the canvas, so 41% of the width is 72% of the
launcher circle's radius; at 55% the van nearly touched the circle.

Colours the manifests take: the PWA's theme and background are navy; the adaptive icon's background
is brand blue; the notification colour is the UI accent (`--accent` as hex, `#0485f7`, a hair apart
from brand blue); the splash backgrounds are the light and dark `--background`.

## How the generator works

`scripts/generate.ts` runs on Node's own type stripping (Node 22.18+), no TypeScript runner.
`@resvg/resvg-js` (prebuilt, no system libraries) renders the PNGs; the .ico is the PNGs in an ICO
directory. Text outputs go through the workspace's Oxfmt and must match byte for byte. PNGs are
compared by their pixels, within a few levels per channel: resvg's antialiasing can differ by a step
between CPUs, so an icon rendered on a Mac passes `--check` on Linux CI, and `generate` never
rewrites an icon whose pixels did not change.
