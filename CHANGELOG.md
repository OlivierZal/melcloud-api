# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `SECURITY.md` describing the private vulnerability-reporting process.
- `CONTRIBUTING.md` documenting the local checks expected before opening a pull request.
- This `CHANGELOG.md`.
- GitHub issue forms (`bug_report`, `feature_request`) and `pull_request_template.md`.
- `.github/actions/setup-node-and-install` composite action centralising the `checkout + setup-node + npm ci --ignore-scripts` pattern reused across CI, docs, and publish workflows.
- `HomeResult<T>` type alias (`Result<T, HomeError>`) re-exported from `./types`.
- `tests/home-fixtures.ts` consolidating the `HomeDevice` / `HomeDeviceData` / `HomeDeviceCapabilities` factories that were duplicated across the Home test files.

### Refactored

- The Classic-only helpers `createMockApi`, `createPopulatedRegistry`, and `assertDeviceType` moved from `tests/helpers.ts` to `tests/classic-fixtures.ts` and renamed to `createMockClassicApi`, `populatedClassicRegistry`, and `assertClassicDeviceType` for consistency with the project-wide `Classic*` / `Home*` prefix convention. `tests/helpers.ts` now contains only scope-neutral helpers.

### Changed

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

[Unreleased]: https://github.com/OlivierZal/melcloud-api/compare/37.2.1...HEAD
