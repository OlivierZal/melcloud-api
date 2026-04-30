# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [38.0.0] - 2026-04-30

### Breaking

- **Result-based error contract on every Classic + Home best-effort getter.** Both `ClassicAPI` (12 methods: `getEnergy`, `getErrorEntries`, `getErrorLog`, `getFrostProtection`, `getGroup`, `getHolidayMode`, `getHourlyTemperatures`, `getInternalTemperatures`, `getOperationModes`, `getSignal`, `getTemperatures`, `getTiles`, `getValues`) and `HomeAPI` (4 methods: `getEnergy`, `getErrorLog`, `getSignal`, `getTemperatures`) now return `Promise<Result<T, ApiRequestError>>` instead of throwing on transport errors. The `{ data }` envelope is dropped — `result.value` is the unwrapped payload. Migration:

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
- `BaseAPI.safeRequest(method, url, options?)` — protected method wrapping a request in `Result`. Replaces the previous free-function `validateRequest` / `runRequest` helpers (which required `host: this` plumbing and a redundant context string). Optional `options.schema` enables Zod-level shape validation when the endpoint has one.
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
- `README.md`: subpath list trimmed to the actually exported `./classic`, `./home`, and `./constants`. Quick-start examples now guard the destructured device against `undefined`. Installation section documents the `.npmrc` setup required to pull from GitHub Packages.
- New composite GitHub Action `.github/actions/setup-node-and-install` centralises the `setup-node + npm ci --ignore-scripts` pattern reused across CI / docs / publish workflows.
- CI: `node-version` pinned to `lts/*` for the `audit` and `check` jobs (the `test` matrix still spans `22 / latest / lts/*`).
- `vitest.config.ts`: enable `clearMocks: true`; manual `vi.clearAllMocks()` calls removed from `beforeEach` blocks.
- Tests: `tests/fixtures.ts` renamed to `tests/classic-fixtures.ts` with all exports prefixed `classic*`. New `tests/home-fixtures.ts` consolidating the `HomeDevice` / `HomeDeviceData` factories duplicated across Home tests. Classic-only test helpers (`createMockClassicApi`, `populatedClassicRegistry`, `assertClassicDeviceType`) moved from `helpers.ts` to `classic-fixtures.ts` to keep `helpers.ts` scope-neutral.

## Earlier versions

For releases up to and including `37.2.1`, see the [GitHub releases page](https://github.com/OlivierZal/melcloud-api/releases) — entries were not tracked in this file before.

[Unreleased]: https://github.com/OlivierZal/melcloud-api/compare/38.0.0...HEAD
[38.0.0]: https://github.com/OlivierZal/melcloud-api/compare/37.2.1...38.0.0
