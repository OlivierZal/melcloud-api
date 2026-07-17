# CLAUDE.md

Typed Node.js client for the MELCloud (Classic) and MELCloud Home APIs.
ESM only, Node >= 22.19, published to GitHub Packages. `erasableSyntaxOnly`
is on: no runtime enums, no parameter properties, no runtime namespaces.

## Commands

- `npm run lint` / `npm run lint:fix` — ESLint (runs with an 8 GB heap).
- `npm test` / `npm run test:coverage` — vitest; coverage must stay at 100%.
- `npm run typecheck` — `tsc` from `@typescript/native` (TypeScript 7);
  does not cover `*.config.ts` (the lint does). The tooling (typedoc,
  typescript-eslint) still resolves the separate `typescript` 6.x install.
- `npm run format` / `npm run format:fix` — prettier.
- `npm run docs` — typedoc. The config is `typedoc.config.js` (JSDoc-typed
  with `@ts-check`: typedoc cannot load `.ts` configs and silently ignores
  them); validation warnings fail the build.

## Domain gotchas

- Classic auth failure is NOT a 401: `/Login/ClientLogin3` answers HTTP 201
  with `{ LoginData: null }` on rejected credentials. `doAuthenticate`
  throws `AuthenticationError` on that shape; the 401 wrapping in
  `toAuthFailure` exists for the Home API's OIDC/token-expiry flows. Never
  assume all auth failures surface as 401 `HttpError`.
- Wire-format types mirror the MELCloud APIs verbatim (PascalCase fields,
  one-letter report keys); do not rename them to satisfy style rules.
- `EffectiveFlags` bitfields (`src/facades/classic-flags.ts`) are the one
  sanctioned home of hex magic numbers and bitwise operators.
- The Home ATW wire speaks two dialects: `/context` settings report zone
  modes in PascalCase (`HeatCurve`, `CoolFlowTemperature`) but the PUT
  endpoint only accepts camelCase and answers a bare 400 otherwise — the
  API keeps PascalCase canonical and lowers on write. The
  weather-compensation member is `HeatCurve`; `Curve` never existed
  (live-probed against `/monitor/atwunit`, 2026-07-12).
- A 200 from the Home ATW PUT proves nothing by itself: the BFF binder
  silently ignores unknown fields (a garbage key is accepted). Only a
  `/context` readback showing the change proves a write path exists —
  never add a `HomeAtwValues` field on acceptance alone.
- Home telemetry, live-probed 2026-07-17 (guest account — guests DO get
  telemetry): `/telemetry/telemetry/actual/{id}` validates `measure`
  (unknown → 400, so the vocabulary is enumerable; only `rssi` and
  `power` — the on/off boolean history — exist), but
  `/telemetry/telemetry/energy/{id}` does NOT: an unknown measure gets a
  200 with empty `measureData`, indistinguishable from a real idle
  window. Never conclude "no data" from an empty payload without
  re-checking the measure name against a known-good one.
- Telemetry `interval` grammar is a case-insensitive .NET enum:
  `Minute`, `Hour`, `Day`, `Week`, `Month`; anything else → 500,
  missing → 400 (the `PT1H` ISO style never worked). Buckets are sparse
  (only active periods return points) and near-live at `Minute` grain
  (~1-2 min lag observed once — reconfirm under sustained activity).
- Telemetry units differ per measure: ATW
  `interval_energy_consumed/produced` are kWh per bucket; the ATA
  `cumulative_energy_consumed_since_last_upload` is Wh, delivered as
  100 Wh quantum pulses (a `100.0` point, then a `0.0` reset marker the
  next minute). Hour/Day server aggregation sums those pulses correctly
  on recent windows.
- No instantaneous power exists anywhere on the Home API: not in
  `/context` settings (raw enumeration 2026-07-17: 11 ATA / 15 ATW
  names, none energy-bearing — no `CurrentEnergyConsumed/Produced`
  analog to Classic ATW's list fields), not as an `actual` measure.
  Any Home power figure must be derived from energy buckets ÷ duration.
- Historical telemetry windows mix semantics: May–June 2026 ATA daily
  values are counter samples (~10^5 Wh), not consumption — bound any
  backfill by plausibility or restrict it to recent windows. Observed
  retention ≥ 75/91 days (ATA/ATW), possibly just device onboarding
  age.

## Lint doctrine

- Code adapts to the rules, never the reverse. Never add a disable — not
  inline, not through config options or ignore regexes: refactor until the
  rule passes (rename the binding, drop the unused parameter, restructure
  the seam). Existing disables are debt: remove them when touching the
  code they guard, never replicate them.
- The only tolerated exceptions are protocol- or rule-pair-imposed, each
  documented with a `-- reason`: bitfield operators, branded-type and
  parse-boundary casts, wire-imposed single-letter keys, namespace
  merging over type-only packages, fire-and-forget `.catch()`
  (`no-floating-promises` + `unicorn/prefer-await` leave no other form),
  and synchronous mocks of async contracts
  (`promise-function-async` autofixes the `Promise.resolve` escape back
  to `async`, then `require-await` fires). The TC39 decorator
  protocol keeps the `files`-scoped exceptions in `src/decorators/**`:
  the `this` rule-off (there is no class body to put `this` in) and the
  `_context` unused-parameter pattern (the context parameter pins the
  decorator kind at type level even when unused — do not remove it).
- A config-level `'off'` with a one-line reason is not a disable: it
  is the triage ledger for opt-in rules that were evaluated and
  refused (tool-ownership overlap, platform floor, absent domain).
  Disables suppress an adopted rule; ledger entries record a verdict —
  re-evaluate one when its stated reason expires (target bump, new
  tooling).
- Zero-warning policy: every enabled rule is at `error`.
- Metric caps (`complexity`, `max-depth`, `vitest/max-nested-describe`) are
  pinned to measured codebase ceilings: exceeding one means refactor, not
  bump. Prove any stricter option with an instrumented run (zero violations)
  before adopting it.
- Config comments are sober: one short line, only for non-obvious
  constraints (ownership by another tool, ordering, Node-version gates,
  measured ceilings).

## TypeScript & docs conventions

- Tool ownership: prettier = formatting, perfectionist = all sorting,
  `@typescript-eslint/naming-convention` = naming, import-x = imports,
  jsdoc plugin = doc comments on `src/**`.
- `readonly` on array parameters only when omitting it causes a type error
  — lean signatures over defensive typing for internal code.
- TSDoc (`flat/recommended-tsdoc-error`): documented functions need
  `@param name - Description.` for every parameter, `@returns` for
  non-void, `@template` per generic, `@throws` where relevant; no blank
  line between the description and the first tag. One-liner `/** … */` is
  fine for consts, types, and schemas.
- `src/temporal.ts` is the only sanctioned `temporal-polyfill` entry point
  (enforced by `no-restricted-imports`).
- Tests import vitest APIs explicitly (no globals) and use `it` inside
  `describe`, `.each` for tables, `describe(fn)` function titles.
  Boolean names take a semantic prefix (`is`, `has`, `should`…); `device`
  is the one sanctioned exception (its `false` is a sentinel, not a flag).

## Repo process

- After every push, monitor the triggered pipelines to completion — the
  PR checks after a push, the publish run after a release — and act on
  the outcome: rerun transient infra failures (a SonarCloud 504 is not
  a finding), fix real ones. Work is not done while its pipeline is red
  or unwatched.
- Every review thread (Copilot or human) must end RESOLVED: with a code
  change when the point holds, or with a reasoned reply when it does
  not — verify claims against sources before acting either way. Resolve
  the thread once settled; none left dangling.
- GitHub merge queue is impossible here: the repo is user-owned and the
  feature is org-only (verified via API — no ruleset payload enables it).
  Dependabot PRs auto-merge via `gh pr merge --auto`; the `merge_group`
  triggers in the workflows are inert but harmless.
- The docs site deploys only on release or `gh workflow run docs.yml`.
- CI: `Test (Node latest)` is `continue-on-error` by design — keep it out
  of required status checks. Sonar coverage runs on the `lts/*` leg only.

## Releasing

- Publishing is release-triggered (`publish.yml`): a **published GitHub
  Release** packs the tarball and publishes it to GitHub Packages. A
  release marked **prerelease** publishes under the `next` dist-tag; a
  normal one under `latest`. The version comes from
  `package.json` at the released commit, so bump it before tagging.
- Prerelease/alpha flow keeps `main` on the target stable version (no
  `-alpha` suffix): branch from `main`, bump, commit, push, then cut a
  prerelease release off that branch — which publishes under `next`. The
  release must target the pushed branch tip, so commit the version bump
  first (otherwise the tag lands on the un-bumped commit):

  ```sh title="alpha"
  git switch -c release/41.0.0-alpha.0
  npm version 41.0.0-alpha.0 --no-git-tag-version
  git commit -am 'chore(release): 41.0.0-alpha.0'
  git push -u origin release/41.0.0-alpha.0
  gh release create v41.0.0-alpha.0 --target release/41.0.0-alpha.0 --prerelease
  ```

  Consumers install it with `@olivierzal/melcloud-api@next` (GitHub
  Packages needs `NODE_AUTH_TOKEN`).

- Downstream `com.melcloud` (sibling repo, uses `/classic` + `/home`)
  upgrades by pinning the dep to the new version (exact for a prerelease)
  then running its `typecheck`/`lint`/`test`/`build`; open the PR from that
  repo. A major bump's breaking surface is the CHANGELOG `[Unreleased]`
  section.
