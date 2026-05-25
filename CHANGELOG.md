# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [39.0.0] - 2026-05-25

### Breaking

- **Replace Luxon with the Stage-4 Temporal proposal**, polyfilled via [`temporal-polyfill`](https://github.com/fullcalendar/temporal-polyfill) until Node 22 reaches EOL (April 2027). The polyfill defers to native `globalThis.Temporal` once it ships unflagged (V8 14 / Node 26+), so this change is also the on-ramp for shedding the dependency entirely later.
  - `RateLimitError.retryAfter` is now `Temporal.Duration | null` (was Luxon `Duration | null`). Read with `retryAfter.total({ unit: 'seconds' })` (or `'milliseconds'`).
  - `RateLimitError.unblockAt` is now `Temporal.Instant | null` (was Luxon `DateTime | null`). Read with `unblockAt.toString()` or convert with `unblockAt.toZonedDateTimeISO(zone)`.
  - `RateLimitGate` constructor now accepts a `RateLimitDurationLike` shape (`{ days?, hours?, minutes?, seconds? }`) instead of Luxon's `DurationLike`. Existing call sites — both internal — already pass `{ hours: N }` and are unaffected.
  - The Classic API no longer mutates `LuxonSettings.defaultZone`. The configured `timezone` is held on the instance and threaded through `isSessionExpired` and `getErrorLog` so multiple `ClassicAPI` instances with different zones now stay independent (silent fix for a latent global-state bug).
  - The locale used to format report chart labels was previously read from `LuxonSettings.defaultLocale` (a global Luxon could see). It is now an explicit module-level setting; new exports `setReportLocale(locale)` / `getReportLocale()` from the package root replace it.

  See [#1510](https://github.com/OlivierZal/melcloud-api/pull/1510) for the full migration write-up.

### Added

- **`Temporal` re-export from the package root** (the polyfill namespace, falling back to native when available) for consumers that want to format error fields themselves without adding a polyfill dependency of their own.

### Fixed

- **Auto-sync and retry-guard timers no longer keep the Node event loop alive.** A script that just did `await ClassicAPI.create({ username, password })` (or `HomeAPI.create(...)`) and nothing else would sit idle for ~5 minutes until the auto-sync timer fired, because the internal `setTimeout` ref'd the loop. Both internal timers now call `.unref()`, matching the convention used by `undici`, `pg`, `ioredis`, `mongodb` and other modern Node clients. The auto-sync still fires on schedule whenever the host application has another reason to stay alive (HTTP server, other timers, open streams). Apps that previously relied on the auto-sync timer as an implicit keep-alive should now provide an explicit one (e.g. a long-lived server, a user-land `setInterval`, or `process.stdin.resume()` for CLIs). ([#1511](https://github.com/OlivierZal/melcloud-api/issues/1511), [#1512](https://github.com/OlivierZal/melcloud-api/pull/1512))

### Other

- Dependency refresh: `eslint`, `typescript-eslint`, `vitest` (+ `@vitest/*`), `@types/node`, `@swc/core`, `undici`, `@typescript/native-preview`, `@eslint/markdown` to their latest minor/patch.

## [38.0.2] - 2026-05-09

### Fixed

- **`HomeDeviceCapabilitiesSchema` enforced ATA-only fields on every device**, so any account whose `/context` carried `airToWaterUnits` failed Zod validation. The error was swallowed inside `HomeAPI.list()`, leaving `#user` null and `isAuthenticated()` falsely reporting `false` after a successful sign-in — `tryReuseSession`/`resumeSession` flapped on every reboot. Schema now requires `capabilities` to be an object but does not validate its shape; only the ATA facade reads specific fields, and only for ATA devices. ([#1503](https://github.com/OlivierZal/melcloud-api/pull/1503))

## [38.0.1] - 2026-05-01

### Fixed

- **Root export of `Result`, `Failure`, `Success`, `ApiRequestError` types and `ok`, `err`, `mapResult` runtime helpers.** Documented in the README's _Error handling_ section but missing from `dist/index.d.ts` in `38.0.0`, so consumers couldn't type their own helpers around `Result<T>` (the discriminated narrowing on `result.ok` worked, but explicit `Result<T>` annotations did not).
- `.npmrc` is now committed (was `.gitignore`'d). The token reference (`${NODE_AUTH_TOKEN}`) is interpolated at runtime so no secret is exposed; the file just describes the registry binding — committing it removes the friction of recreating it on every fresh clone and aligns this repo with `com.melcloud`'s setup.
- `README.md`: harmonised the documented env var on `NODE_AUTH_TOKEN` (was `GITHUB_TOKEN`) to match the committed `.npmrc` and the publish workflow.

## [38.0.0] - 2026-04-30

### Breaking

- **Result-based error contract on every Classic + Home best-effort getter.** Both `ClassicAPI` (12 methods: `getEnergy`, `getErrorEntries`, `getErrorLog`, `getFrostProtection`, `getGroup`, `getHolidayMode`, `getHourlyTemperatures`, `getInternalTemperatures`, `getOperationModes`, `getSignal`, `getTemperatures`, `getTiles`, `getValues`) and `HomeAPI` (4 methods: `getEnergy`, `getErrorLog`, `getSignal`, `getTemperatures`) now return `Promise<Result<T>>` instead of throwing on transport errors. The `{ data }` envelope is dropped — `result.value` is the unwrapped payload. Migration:

  ```ts title="migrate"
  // before
  const { data } = await api.getEnergy({ postData })
  // after
  const result = await api.getEnergy({ postData })
  if (!result.ok) {
    // result.error.kind is one of:
    //   'network' | 'unauthorized' | 'rate-limited' | 'server' | 'validation'
    return
  }
  const data = result.value
  ```

- **Cascade through facades.** Facade getters (`getEnergy`, `getFrostProtection`, `getGroup`, `getHolidayMode`, `getHourlyTemperatures`, `getInternalTemperatures`, `getOperationModes`, `getSignal`, `getSignalStrength`, `getTemperatures`, `getTiles`, `getValues`, `getErrorLog`) propagate the `Result` to the consumer instead of unwrapping internally. com.melcloud and other downstream consumers must update every facade-getter call site to branch on `result.ok`. Mutations (`update*`, `updatePower`) keep their throw-on-failure contract — the failure shape is unchanged.
- **Renamed**: `HomeError` → `ApiRequestError`. The same five-variant discriminated union (`network` / `unauthorized` / `rate-limited` / `validation` / `server`) now serves both Home and Classic since Classic and Home share the same SDK transport / resilience pipeline. The `HomeError` export is gone; consumers should reference `ApiRequestError` directly.
- **Drop the `{ data }` envelope on Classic API mutations + `list` + `login`.** The seven Classic API methods that previously returned `Promise<{ data: T }>` (`updateFrostProtection`, `updateHolidayMode`, `updateGroupState`, `updatePower`, `updateValues`, `list`, `login`) now return `Promise<T>` directly. The throw-on-failure contract is unchanged. Migration:

  ```ts title="migrate"
  // before
  const { data } = await api.updatePower({ postData })
  // after
  const data = await api.updatePower({ postData })
  ```

  Aligns Classic with Home's existing envelope-free contract on mutations (`updateValues: Promise<boolean>`, `list: Promise<HomeBuilding[]>`). The previous wrapper carried only `{ data }` — no `status`, no `headers` — so it was envelope theater rather than a load-bearing transport metadata carrier (Octokit-style). Modern resource-focused SDK convention (Stripe, Linear) drops the wrapper.

- **`Result<T>` no longer takes a second `TError` generic.** Every `Result<X, ApiRequestError>` instance becomes `Result<X>`; the error type is now baked into the discriminated union. Migration is mechanical (`Result<X, ApiRequestError>` → `Result<X>`). Domain-specific SDKs lock the error type rather than carry a generic-degree-of-freedom that nothing exercises.
- **`ClassicErrorLogQuery` field types and naming.** `limit` and `offset` were typed `string` and silently parsed via `Number(...)` with a `1` / `0` fallback on `NaN`, swallowing typos. They are now typed `number`, with no parsing — invalid input is a TypeScript error at the call site. The `limit` field is also renamed to `period` since its semantic is "days per page" (the variable was already `period` internally), not "max results returned". Migration:

  ```ts title="migrate"
  // before
  await api.getErrorLog({ limit: '7', offset: '2' }, [1])
  // after
  await api.getErrorLog({ offset: 2, period: 7 }, [1])
  ```

  If your consumer was relying on the silent NaN fallback (e.g. `limit: form.value` straight from a string input), parse and validate at the boundary before passing the number — that responsibility belongs to the caller, not the SDK.

### Added

- `ApiRequestError` discriminated union — typed failure surface for both Classic and Home getters.
- `mapResult(result, fn)` helper — standard Result `map` operation. Lets facade getters transform the success branch and propagate the failure branch unchanged in one expression.
- `BaseAPI.requestData(method, url, options?)` and `BaseAPI.safeRequest(method, url, options?)` — protected sibling methods that strip the `HttpResponse` envelope: `requestData` throws on transport failure (used by mutations and required sync paths); `safeRequest` Result-wraps it (used by best-effort getters). Same shape, both accept an optional `options.schema` for Zod validation. Replaces the previous free-function `validateRequest` / `runRequest` helpers (which required `host: this` plumbing and a redundant context string).
- `classifyError(error)` exported from `src/api/base.ts` — pure function classifying any thrown value into the `ApiRequestError` union. Used internally by `safeRequest` and accessible for tests / power users.
- `convertToListDeviceData` exported from the decorators module — used by `BaseDeviceFacade.getValues` to apply the registry update inline on the success branch (replaces the now-removed `@classicUpdateDevice()` decorator on `getValues`).
- `tests/helpers.ts` exposes `okValue(result)` — test-only helper that unwraps a successful `Result` or throws with the failure summary, removing assertion boilerplate.

### Changed

- `BaseFacade<T>` (Classic-only) renamed to `ClassicBaseFacade<T>` for naming consistency with the project-wide `Classic*` / `Home*` convention.
- `clampToRange` moved from `src/facades/classic-base-device.ts` to `src/utils.ts` — it is domain-neutral and consumed by both Classic and Home device facades.
- `SESSION_REFRESH_AHEAD_MS` centralised in `src/time-units.ts` (was duplicated in `src/api/classic.ts` and `src/api/home.ts`).
- `HomeDeviceAtaFacade.#setting` overloads tightened: explicit overloads for every known setting + a `: unknown` catch-all so unknown names force the caller to type-narrow (PR review feedback).
- The private `#errorLog` helper in `ClassicAPI` was renamed `#getErrorLog` to align with the verb-prefixed convention used by the other private methods (`#fetch`, `#getLanguageCode`, `#clearPersistedSession`).

### Removed

- `HomeError` type alias — replaced by `ApiRequestError` (see above).
- `validateRequest` / `runRequest` free-function helpers and their `ValidateHost` / `RunRequestOptions` / `ValidateRequestOptions` interfaces from `src/validation/` — replaced by `BaseAPI.safeRequest`.
- `unwrapOrThrow` helper — no longer needed once Result is propagated through facades to the consumer.

### Other

- New `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, GitHub issue templates, and `pull_request_template.md`.
- `README.md`: subpath list trimmed to the actually exported `./classic`, `./home`, and `./constants`. Quick-start examples now guard the destructured device against `undefined`. Installation section documents the `.npmrc` setup required to pull from GitHub Packages. New Error handling section documenting the canonical `if (!result.ok) { switch result.error.kind }` pattern for the Result-based getters.
- New composite GitHub Action `.github/actions/setup-node-and-install` centralises the `setup-node + npm ci --ignore-scripts` pattern reused across CI / docs / publish workflows.
- CI: `node-version` pinned to `lts/*` for the `audit` and `check` jobs (the `test` matrix still spans `22 / latest / lts/*`).
- `vitest.config.ts`: enable `clearMocks: true`; manual `vi.clearAllMocks()` calls removed from `beforeEach` blocks.
- Tests: `tests/fixtures.ts` renamed to `tests/classic-fixtures.ts` with all exports prefixed `classic*`. New `tests/home-fixtures.ts` consolidating the `HomeDevice` / `HomeDeviceData` factories duplicated across Home tests. Classic-only test helpers (`createMockClassicApi`, `populatedClassicRegistry`, `assertClassicDeviceType`) moved from `helpers.ts` to `classic-fixtures.ts` to keep `helpers.ts` scope-neutral.

## Earlier versions

For releases up to and including `37.2.1`, see the [GitHub releases page](https://github.com/OlivierZal/melcloud-api/releases) — entries were not tracked in this file before.

[Unreleased]: https://github.com/OlivierZal/melcloud-api/compare/39.0.0...HEAD
[39.0.0]: https://github.com/OlivierZal/melcloud-api/compare/38.0.2...39.0.0
[38.0.2]: https://github.com/OlivierZal/melcloud-api/compare/38.0.1...38.0.2
[38.0.1]: https://github.com/OlivierZal/melcloud-api/compare/38.0.0...38.0.1
[38.0.0]: https://github.com/OlivierZal/melcloud-api/compare/37.2.1...38.0.0
