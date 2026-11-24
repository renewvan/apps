# Renewvan apps

One pnpm workspace with two apps and their shared packages. Read the root `README.md` first, then
the `AGENTS.md` of the app you work in: [dashboard/AGENTS.md](dashboard/AGENTS.md)
(Vite+, Vitest) and [mobile/AGENTS.md](mobile/AGENTS.md) (Expo, Jest). Their rules win
for their app.

## Workspace commands

```bash
pnpm install                       # at the root, after every pull
pnpm --filter dashboard <script>   # dev, test, build, typecheck, lint
pnpm --filter mobile <script>      # start, android, test, typecheck, lint
pnpm --filter @renewvan/core <script>  # test, typecheck (packages/core: pure TS, no React/MQTT/DOM/RN)
pnpm --filter @renewvan/brand <script> # generate [--check], test, typecheck (packages/brand: logo, icons, theme tokens)
pnpm test / pnpm check             # both apps
```

Each app also runs from its own directory (`cd dashboard && vp test`, `cd mobile &&
pnpm test`). Lint, format and staged-file rules for the whole workspace, mobile included, are in
the root `vite.config.ts` (Oxlint and Oxfmt through Vite+; `vp check` at the root covers every app).
Run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once per clone, so `git blame` skips
the formatting-only commits listed there.

## Rules

- Code both apps need goes in `packages/` (`packages/core`, `@renewvan/core`, depended on as
  `workspace:*`), never copied from one app into the other. Core's domain logic is one entry per
  area (`@renewvan/core/<area>`, listed in `packages/core/README.md`); apps import the entry, never a
  file inside it. The few parallel pieces not yet in core are listed in `mobile/AGENTS.md`.
- Screens read the **Live van** (`@renewvan/core/van`, hub `CONTEXT.md`) through each app's
  `useLiveVan()`, never the raw retained records: a rule about what a screen may trust (complete
  entities, the Primary battery, an offline Driver's entity reading unknown) is `liveVan`'s, tested
  once in core. Only Settings › Devices and its diagnostics read the raw records.
- Brand colours, `--radius`, the logo and the app icons live in `packages/brand`: edit its
  `src/tokens.ts` or `svg/` and run `pnpm --filter @renewvan/brand generate`; never edit a generated
  output (listed in its README) or copy a token into an app.
- Shared dependency versions (TypeScript, mqtt, Vite+) come from the catalog in
  `pnpm-workspace.yaml`. React and React Native never go there: each app pins its own.
- Commit scopes name the part of the repo: `feat(dashboard): …`, `fix(mobile): …`,
  `feat(core): …`; no scope for the workspace itself (`chore: …`, `ci: …`).
- A reformat is its own commit with formatter output only (`style(<app>): format with Oxfmt`),
  and its SHA goes in `.git-blame-ignore-revs`.
- The pre-commit hook is fast feedback on what the commit touches: lint and format of the staged
  files, type checks, and only the tests related to the staged files (Vitest `related`, Jest
  `--findRelatedTests`). CI runs every suite in full before anything reaches main. A slow or
  failing hook is fixed (in the code or in `.vite-hooks/pre-commit`), never skipped:
  `git commit --no-verify` is not the answer.
- All commits are authored as `renewvan <github@renewvan.com>`, never a personal identity.
- The `gh` CLI defaults to an account that is not a collaborator here: prefix every `gh` command
  with `GH_TOKEN=$(gh auth token --user renewvan)`. Never run `gh auth switch`.
