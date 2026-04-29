# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [38.0.0] - 2026-04-30

### Breaking

- The 12 best-effort getters on the Classic API surface (`getEnergy`, `getErrorEntries`, `getFrostProtection`, `getGroup`, `getHolidayMode`, `getHourlyTemperatures`, `getInternalTemperatures`, `getOperationModes`, `getSignal`, `getTemperatures`, `getTiles`, `getValues`) now return a `ClassicResult<T>` (`Result<T, ApiRequestError>`) instead of throwing on transport errors and returning a `{ data }` envelope on success. Migration: replace `const { data } = await api.getXxx(...)` with `const result = await api.getXxx(...); if (!result.ok) /* handle result.error.kind */; const data = result.value`. Or use the new `unwrapOrThrow(...)` helper to preserve the previous throw-on-failure semantics in one line.
- `HomeError` is no longer exported as a distinct type; consumers using `Result<T, HomeError>` should switch to the `HomeResult<T>` alias or to the underlying `ApiRequestError`.
- The `{ data }` envelope previously surrounding the success payload is dropped by the wrapped methods — `result.value` is the unwrapped data, mirroring the Home API getters.

### Added

- `ApiRequestError` type — a single neutral discriminated union (`network` / `unauthorized` / `rate-limited` / `validation` / `server`) shared by Classic and Home best-effort getters. Replaces the duplicated `HomeError` / would-be-`ClassicError` design.
- `ClassicResult<T>` type alias (`Result<T, ApiRequestError>`) for symmetry with the existing `HomeResult<T>`.
- `unwrapOrThrow<T>(result)` helper — return the success value or rethrow the original `cause` (preserving the original exception class), falling back to a synthesised `Error` for variants without a cause. Lets facades preserve their throw-on-failure contract while the underlying API exposes the typed `Result` surface.
- `runRequest` helper (sibling of `validateRequest` without Zod schema validation) — wraps an operation in a `Result` with the same error classifier. Used by the Classic getters where responses are typed at compile time only.
- `SECURITY.md` describing the private vulnerability-reporting process.
- `CONTRIBUTING.md` documenting the local checks expected before opening a pull request.
- This `CHANGELOG.md`.
- GitHub issue forms (`bug_report`, `feature_request`) and `pull_request_template.md`.
- `.github/actions/setup-node-and-install` composite action centralising the `setup-node + npm ci --ignore-scripts` pattern reused across CI, docs, and publish workflows.
- `HomeResult<T>` type alias (`Result<T, ApiRequestError>`) re-exported from `./types`.
- `tests/home-fixtures.ts` consolidating the `HomeDevice` / `HomeDeviceData` / `HomeDeviceCapabilities` factories that were duplicated across the Home test files.

### Refactored

- The Classic-only helpers `createMockApi`, `createPopulatedRegistry`, and `assertDeviceType` moved from `tests/helpers.ts` to `tests/classic-fixtures.ts` and renamed to `createMockClassicApi`, `populatedClassicRegistry`, and `assertClassicDeviceType` for consistency with the project-wide `Classic*` / `Home*` prefix convention. `tests/helpers.ts` now contains only scope-neutral helpers.

### Changed

- Classic facades (`ClassicBaseFacade`, `BaseDeviceFacade`, `BaseZoneFacade`) now call `unwrapOrThrow(...)` internally to preserve their existing throw-on-failure contracts — the breaking change is API-surface-only. `HomeDeviceAtaFacade` already exposes typed `HomeResult<T>` via direct propagation.
- `HomeDeviceAtaFacade.#setting` overload set tightened: the catch-all `(name: string): string` overload — type-unsound because the implementation could return `number` for `'RoomTemperature'` / `'SetTemperature'` — was dropped in favor of explicit overloads for every known setting plus a catch-all returning `unknown` so any unknown name forces the caller to type-narrow (PR review feedback).
- `README.md`: subpath list trimmed to the actually exported `./classic`, `./home`, and `./constants`. Quick start examples now guard the destructured device against `undefined` (matches `noUncheckedIndexedAccess`). Installation section now documents the `.npmrc` setup required to pull from GitHub Packages.
- CI workflows now pin `node-version` to `lts/*` for the `audit` and `check` jobs (the `test` matrix still spans `22 / latest / lts/*` for forward-compat coverage).
- `tests/fixtures.ts` renamed to `tests/classic-fixtures.ts` and its exports prefixed with `classic` (`buildingData` → `classicBuildingData`, `ataDevice` → `classicAtaDevice`, …) for explicit scoping consistent with the source `Classic*`/`Home*` convention. The ESLint override now matches `tests/*fixtures.ts` so future fixture files inherit the loosened rules.
- `tests/unit/classic-api.test.ts` no longer redefines local `createBuilding` / `createDevice` factories — it imports `classicBuildingWithStructure` / `classicRawDevice` from the centralised fixtures.
- `vitest.config.ts` enables `clearMocks: true`; the now-redundant `vi.clearAllMocks()` calls in test `beforeEach` blocks were removed.
- `BaseFacade` (Classic-only) renamed to `ClassicBaseFacade` for naming consistency.
- `clampToRange` moved from `src/facades/classic-base-device.ts` to `src/utils.ts` — it is domain-neutral and consumed by both Classic and Home device facades.
- `SESSION_REFRESH_AHEAD_MS` centralised in `src/time-units.ts` (was duplicated in `src/api/classic.ts` and `src/api/home.ts`).
- `HomeDeviceAtaFacade.#setting` gained `'RoomTemperature' | 'SetTemperature' → number` overloads, so `roomTemperature` / `setTemperature` getters no longer wrap `Number(...)` at every call site.

## Earlier versions

For releases up to and including `37.2.1`, see the [GitHub releases page](https://github.com/OlivierZal/melcloud-api/releases) — entries were not tracked in this file before.

[Unreleased]: https://github.com/OlivierZal/melcloud-api/compare/38.0.0...HEAD
[38.0.0]: https://github.com/OlivierZal/melcloud-api/compare/37.2.1...38.0.0
