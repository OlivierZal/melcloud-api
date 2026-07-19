# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [42.0.2] - 2026-07-19

### Fixed

- Classic ATA multi-day energy reports crashed in 42.0.1 (`RangeError: Non-finite day`): the labels rebuilt as localized dates were handed back to the shared formatter still tagged `day_of_week`, which re-parsed `"18 juil."` as a day number. Rebuilt (and clock) labels now carry `LabelType.raw`, which the formatter passes through untouched — ATW multi-day reports never crashed because their wire labels are `raw` already.

## [42.0.1] - 2026-07-19

### Fixed

- Home report charts failed beyond ~7 days (the widget's "loading problem" on wide ranges): a single wide request either hit the 10-second client timeout (minute-grained payloads) or came back with silently summarized annotations — live-probed: a 90-day query reported _less_ hot-water time than its own 30-day subwindow. The facades now split report windows into chunks of at most 30 days, fetched in parallel with a window-fitted period (`Hourly` within seven days, `Weekly` beyond — `Daily` collapses the mode annotations), and merge the responses: samples concatenated per series, boundary-crossing mode spans deduplicated (the BFF returns them in both adjacent chunks), LOCF seeds from the oldest chunk. A 90-day operation-modes pie now resolves in a few seconds with faithful durations.
- The day-spanning charts (Wi-Fi signal and today's temperatures) keep a full-day axis again on both API sides: the Classic hour-by-hour merge pads the not-yet-elapsed hours with blank samples, and the Home day windows now span midnight to midnight with samples blanked past now — the axis reads 00:00-24:00 all day instead of shrinking to the current hour.
- Home 1-day energy reports bucket hourly again: the day-versus-hour threshold now tolerates the sub-second drift between the caller's `from` stamp and the facade's `to` stamp, which pushed an exact 1-day window just over the limit and collapsed it onto daily bars spanning 2 calendar days.
- Home multi-day energy reports up to a month now bucket per calendar day of the display timezone, aggregated client-side from hourly wire buckets: the wire's own day buckets are UTC days, which stretched a 2-day window over 3 calendar bars and smeared evening usage onto the next bar in UTC+ zones. Beyond a month the raw UTC day buckets remain (the shift is invisible at that zoom).
- Classic multi-day energy report labels rebuild as localized dates anchored on the window's `from` when the bucket count matches its calendar-day span — the wire's vendor-dependent day labels (0-based .NET weekdays for ATA, raw days of month for ATW) now read like the Home charts' date axes.

## [42.0.0] - 2026-07-18

### Changed

- **Breaking:** the Home device facade report methods are now chart-ready, harmonized on the Classic contracts. `getTemperatures` (ATA and ATW) and ATW `getInternalTemperatures` return `Result<ReportChartLineOptions>` instead of raw `HomeReportData[]`: irregular wire samples are resampled onto a regular grid (hourly up to seven days, daily beyond) with last-observation-carried-forward, seeded from the wire's `previousTriggers`, under Classic legend names (`room_temperature` → `RoomTemperature`, `outside_temperature` → `OutdoorTemperature`); the ATW temperature chart merges the comfort-graph and internal-temperatures reports (the Classic wire cannot) and carries the comfort-graph operation-mode spans as background `bands`. Raw access remains available on the `HomeAPI` client methods.

### Added

- Classic `getEnergyReport(query?)` on the ATA and ATW device facades: the `/EnergyCost/Report` bucket arrays (per-mode consumption for ATA; consumed and produced per category for ATW, `CoP` excluded as a non-kWh ratio) as `ReportChartLineOptions` in `kWh`, with the endpoint's .NET 0-based day-of-week labels remapped to the ISO 1-based convention of the shared formatter. ERV resolves an empty chart without a wire call.
- Home ATW `getOperationModes(query?)`: the comfort-graph operation-mode annotations aggregated into Classic-shaped pie data — same mode vocabulary (`HotWater`, `Heating`, `Cooling`, `FreezeStat`, `LegionellaPrevention`), values in fractional days over the window, unannotated time as `Stop`.
- Home ATW `getHourlyTemperatures(hour?)`: the merged temperature series over one hour of today on a minute grid, with mode bands — a superset of the Classic hourly chart, whose wire only carries the internal series.
- Home `getSignalStrength(hour?)` (both device types): RSSI telemetry resampled on a minute grid over one hour of today, unit `dBm`.
- Home `getEnergyReport(query?)`: daily energy chart in `kWh` — ATA scales its watt-hour cumulative measure and charts omitted idle days as `0`; ATW charts one consumed and one produced series.
- `locale` and `timezone` on `HomeAPIConfig`, mirroring the Classic configuration: the Home wire speaks UTC wall-clock (live-probed 2026-07-18), so the timezone only anchors chart windows and label rendering.
- `ReportChartLineOptions.bands` (additive): optional operation-mode background bands as inclusive index ranges on the label grid; absent on every Classic chart.
- Completed wire types (live-probed): `ClassicEnergyDataAta`/`ClassicEnergyDataAtw` now carry `Labels`/`LabelType` (and the six ATW bucket arrays); `HomeReportData` now carries `annotations`, `previousTriggers`, `from` and `to`.

### Other

- Claude automation workflows (mirrors [OlivierZal/com.melcloud#1409](https://github.com/OlivierZal/com.melcloud/pull/1409)): every newly opened issue is triaged automatically — existing labels applied, duplicates looked up, one diagnostic comment posted; collaborator issues that @-mention Claude keep their interactive `claude.yml` handling — and a red `CI`/`Zizmor` run on a dependabot branch triggers one auto-fix attempt that diagnoses from the failed logs, fixes on the branch, verifies the full suite, and pushes through the Claude GitHub App token so CI re-runs and the existing auto-merge completes. The `workflow_run` trigger is deliberate (dependabot-triggered runs get a read-only token and cannot reach `CLAUDE_CODE_OAUTH_TOKEN`; the dependabot actor gate doubles as the loop guard) and is ignored for `dangerous-triggers` in the zizmor config.

## [41.3.0] - 2026-07-18

### Added

- `shouldResumeSessionInBackground` config option: `create()` resolves immediately and the persisted-session restore (probe or full login — tens of seconds on slow networks) runs off the critical path, with the lifecycle contract unchanged (auto-sync arming, `onAuthenticationLost`, login backoff). Keeps host-app inits within tight budgets such as Homey's 30-second `ready` timeout.

## [41.2.3] - 2026-07-18

### Fixed

- Home OIDC refusals (a re-rendered Cognito login page, or a callback ending without an authorization code) threw plain `Error`s, so the login backoff never engaged and doomed sign-ins were retried on every sync. Both paths now throw `AuthenticationError` — engaging the backoff and the session-lost notification — and carry the actual reason: the Cognito error message when the page re-renders, the landing URL plus the OIDC `error`/`error_description` when the callback has no code.

## [41.2.2] - 2026-07-18

### Fixed

- The Classic error-log year-1 sentinel filter only recognized the wall-clock dialect: sentinels arriving as instants (`0001-01-01T00:00:00Z`, live payload) slipped through and surfaced as fake year-1 dates. Year extraction now parses both MELCloud date dialects; unparseable inputs still keep their entries (Luxon-mirroring semantics).

## [41.2.1] - 2026-07-17

### Fixed

- Classic `/EnergyCost/Report` ATW payloads carry `null` CoP entries for idle periods (live payload, 2026-07-17): the schema now accepts them, so ATW energy reports validate again instead of failing since the 41.2.0 hardening. Consumers already coerce `null` to 0.

## [41.2.0] - 2026-07-16

### Added

- `LifecycleEvents.onAuthenticationLost` — emitted once per authentication-loss episode when a sync cycle ends unauthenticated with recoverable persisted state; any authenticated cycle re-arms it.
- `AuthenticationThrottledError`: Classic `ClientLogin3` `ErrorId 6` and Home HTTP 429 now classify as MELCloud-side login throttling.

### Changed

- Login backoff: after a failed credential login, `resumeSession` stops re-attempting doomed logins (15 minutes after a failure, 2 hours when throttled); refresh-token exchanges are never gated.

## [41.1.0] - 2026-07-14

### Added

- **Home account/building ATA groups.** Every registered Home device now carries its source `/context` building (`HomeDevice.building`, a `HomeBuildingRef { id, name }`, restated on every sync like `isOwner`), `HomeRegistry.getBuildingsByType(type)` groups devices per building, and the new **`HomeBuildingAtaFacade`** (via `HomeFacadeManager.getBuilding(id)`, cached per id and dropped when the building empties) speaks the same group contract as the Classic facades: `getGroup()` aggregates its members' states per field — diverging fields fold to `null`, the wire's mixed marker — and `updateGroupState()` translates the Classic delta to the Home vocabulary once and fans it out to every member (members already matching, i.e. `NoChangesError`, don't fail the group write; an all-null delta resolves without a wire call).
- **`HomeDeviceAtaFacade` gains the same `getGroup()`/`updateGroupState()`** (a device is a group of one), so all four target kinds — Classic zone, Classic device, Home building, Home device — share one group contract in the Classic group-state dialect.
- The Home↔Classic ATA group translation is exported: `toClassicAtaGroupState`, `toHomeAtaValues`, `aggregateClassicAtaGroupStates`, `toGroupFanSpeed` and the `HomeAtaGroupSource` slice.

Note: `HomeDevice`'s constructor now takes the typed entry bag (`{ building, device, isOwner, type }`) and `sync()` a required `building` — internal registry plumbing, mirroring the earlier `isOwner` threading.

- **`ClassicDeviceFacade<Ata>` gains `getGroup()` and `updateGroupState()`**, exposed through the new `ClassicDeviceAtaFacade` interface that `isClassicAtaFacade` now narrows to (and which `ClassicDeviceFacadeAny` carries). MELCloud's native group endpoints only address zones (building/floor/area), so a lone ATA device emulates them as a group of one: `getGroup` projects the device's own synced state onto the group keys with no wire call — a silent or unset fan speed reads as `null`, since a group state cannot hold `silent` — and `updateGroupState` writes back through the native per-device `SetAta` path (`FanSpeed`→`SetFanSpeed`, the vane directions drop their `Direction` suffix, `null` fields are the group "leave unchanged" sentinel and are dropped). Consumers can now drive a single device through the same zone-group contract. Purely additive: the narrowed type is a superset of `ClassicDeviceFacade<Ata>`.

## [41.0.0] - 2026-07-13

### Breaking

- **`HomeDeviceAtwFacade.operationModeZone1`/`operationModeZone2` return the normalized `HomeAtwZoneMode` union** (`'room' | 'flow' | 'curve' | 'room_cool' | 'flow_cool'`) instead of raw FTC strings, and **`HomeAtwValues.operationModeZone1/2` accept that union** — the wire dialect (PascalCase reads, camelCase writes) is now fully encapsulated. The external `*Thermostat` variants and unknown firmware strings degrade to the room modes so new FTC vocabulary can never break a consumer's sync.
- **`updateValues`/`updatePower` on the Home facades (and `updateAtaValues`/`updateAtwValues` on `HomeAPI`) resolve `void` and propagate the typed transport errors** instead of swallowing every failure into `false`, aligning the Home dialect with Classic's exception contract.

- **`HomeAtwOperationMode`'s `'Legionella'` member is renamed `'LegionellaPrevention'`.** The wire value `Legionella` was a guess that never existed: a live-captured running cycle (2026-07-13) reports `OperationMode` as `LegionellaPrevention`, which the guessed member left unmapped — Homey read a cleared operational state and an idle tank mid-cycle. Both facade derivations (`operationalState`, `hotWaterOperationalState`) map the observed spelling — the guessed one is dropped everywhere, since neither wire can produce it (Classic reports the state as the number `6`; its `legionella` label is our naming choice, not a wire string). The label members follow the observed word across BOTH dialects — `ClassicOperationModeState.legionella` (the number `6`), `ClassicOperationModeStateHotWater.legionella` and `HomeAtwOperationalState.legionella` are renamed `legionellaPrevention`, their string/number VALUES unchanged (the `'legionella'` capability id ships to Homey as before). Consumers keyed on the old members rename them, like the `HeatCurve` rename below.
- **`HomeAtwOperationModeZone`'s `'Curve'` member is renamed `'HeatCurve'`.** The wire value `Curve` never existed: `/context` settings report the weather-compensation zone mode as `HeatCurve`, and the device-update endpoint rejects `curve`/`Curve` with a bare 400 (live-probed against `/monitor/atwunit`). Consumers keyed on the old member rename it; no runtime behavior existed to preserve.
- **Error constructors now take an `options` bag as the second parameter**, aligning every custom error with the native `Error(message, options)` shape (and with `eslint-plugin-unicorn` v70's stricter `custom-error-definition`):
  - `EntityNotFoundError`: `new EntityNotFoundError(tableName, entityId, options?)` → `new EntityNotFoundError(tableName, { entityId, cause? })`.
  - `HttpError`: `new HttpError(message, response, config?)` → `new HttpError(message, { response, config?, cause? })`.
  - `RateLimitError` and `ValidationError` keep their public signatures but now forward the whole options bag to `super()`, so `cause` still lands on the standard `Error` chain — no observable behavior change.
- **`HomeAPI`'s persisted `expiry` is now produced by `Temporal`** (`Temporal.Now.instant().add({ seconds }).toString()`) instead of `new Date(…).toISOString()`. The value remains an ISO 8601 UTC instant and is parsed by the same session-expiry reader; only the fractional-second rendering may differ (trailing zeros are trimmed). Stored sessions written by earlier versions parse unchanged.
- **`HomeDevice`'s constructor and `sync()` take a required `isOwner` parameter, and `TypedHomeDeviceData.isOwner` is required.** An untagged registry sync is a compile error rather than a guess: an optional flag needs a default, and any default either invents an ownership the sync never observed (a fresh device falling back to guest) or preserves a stale one (an existing device keeping its pre-unshare tag) — for a flag meant to gate write UI, both silently misreport devices. Every sync now restates the origin from the latest `/context`.
- **`HomeBaseDeviceFacade` declares a new abstract `updateValues` method** (it backs the base's new `updatePower`). The class is exported for typing and its constructor is protected — instances are normally obtained via `HomeFacadeManager` — but an external subclass is still possible and must now implement `updateValues(values: { power?: boolean | null }): Promise<boolean>` (both in-package subclasses already did).
- **`HomeErrorLogEntry` now mirrors the real wire shape**: `{ timestamp, errorCode, errorReason, clearedTimestamp }` with nullable reason/cleared fields, per a live capture of a non-empty `GET /monitor/ataunit/{id}/errorlog`. The previous `{ date, errorCode, errorMessage }` shape never matched a real payload — every non-empty error log failed validation, and empty logs parsed vacuously, which is how the drift stayed hidden.
- **`HomeReportData.reportPeriod` is now `number | string`.** `GET /report/v1/comfort-graph` returns a numeric `reportPeriod` (e.g. `0`) while `internaltemperatures`/`trendsummary` return a string; the string-only schema rejected every comfort-graph response, so `getAtwTemperatures` always failed validation.
- **`temporal-polyfill` upgraded to its first stable major, `^1.0.1`** (was `^0.3.2`). The `Temporal.*` types are part of this library's public API (`RateLimitError.retryAfter`, `RateLimitError.unblockAt`, …), so consumers that install their own copy of the polyfill must align it to `^1` — mixing 0.x and 1.x instances would break cross-version `instanceof` checks. None of the upstream 1.0 breaking changes affect this library (ISO calendars only, no `Temporal.TimeZone`/`Temporal.Calendar` usage, ESM-only already, Node ≥ 22.19). Since v1 the polyfill also delegates to the native `Temporal` when the runtime ships one — turning the exit strategy announced in 39.0.0 into actual behavior.
- **For `exactOptionalPropertyTypes` consumers only, the input-type widening (see Changed) is source-breaking in the contravariant and derived-type directions.** Consumers without the flag are unaffected in every direction.
  - Hand-spelled implementations and mocks of the widened function-typed members (`ClassicFacade.notifySync`/`getErrorLog`/`updateHolidayMode`/`updateFrostProtection`, `ClassicAPIAdapter.getErrorLog`, the facade-manager zone filters) stop compiling if they inlined the old narrow parameter shapes — and because these members are `readonly` function-typed _properties_, the method-bivariance exemption does not apply (arrow properties, method shorthand, and `class implements` all fail alike). Migration: spell the parameters with the exported named types (`ClassicErrorLogQuery`, `ClassicHolidayModeQuery`, …), which track the library.
  - Derived types weaken: under the flag, `-?` (hence `Required<T>`) removes optionality but keeps an explicit `| undefined`, so `Required<ReportQuery>` is now `{ from: string | undefined; to: string | undefined }` — it both breaks reads and silently accepts `{ from: undefined }` as a "resolved" query. Where a resolved-defaults witness is needed, use the newly exported `Resolved<T>` (which strips the explicit `| undefined` along with `?`; this library's internal `getDuration`/`getChartPieOptions` use it themselves). Likewise, `BaseAPIConfig` is no longer assignable to `Partial<LoginCredentials>` — by design: that assignment would let a present-`undefined` credential leak into a type whose `exactOptionalPropertyTypes` contract forbids it.
  - One semantic tripwire moved from compile time to runtime: `updateHolidayMode({ from, to: maybeUndefined })` now compiles, and an undefined `to` — exactly like an absent one — _disables_ holiday mode instead of scheduling it. This is the documented semantics (and what plain-JS callers always got), but eOPT callers previously had a compile error forcing the decision.

### Changed

- **Full `eslint.config.ts` strictness audit** — every section reviewed against the installed plugin sources (52 findings adversarially verified), yielding three kinds of change:
  - **Latent config bugs fixed.** All `perfectionist/sort-imports` side-effect groups and `tsconfig-path` groups were dead names that silently disabled the intended ordering (side-effect imports were not pinned first — now they are, via the bare `side-effect`/`side-effect-style` selectors); `sort-exports`' `value-export` swallowed `named-export`/`wildcard-export` (replaced with the four compound groups, which also order named-before-wildcard within each block); `sort-modules` listed impossible `export-default-enum`/`export-default-type` groups; `sort-object-types`/`sort-interfaces` listed the impossible `optional-index-signature`; `settings.perfectionist.locales` was the invalid BCP-47 tag `en_US` (would crash any locale-aware comparison) and the custom alphabet was generated with the host's default locale, making lint results machine-dependent — both now pinned to `en-US`. Dead entries removed (`typedef: 'off'`, `naming-convention: 'off'` in the config-file override, no-op `groups: ['unknown']` options, redundant `languageOptions`, unreachable JSON ignores).
  - **Type-aware and correctness strictness raised** (all verified against typescript-eslint 8.59.4 / eslint 10.4.0 schemas): `strict-boolean-expressions` at full strictness (`allowString`/`allowNumber`/`allowNullableObject: false` — 19 implicit coercions made explicit), `no-shadow` with `builtinGlobals`/`hoist: 'all'` (polyfill re-exports allow-listed), `only-throw-error` disallowing `any`/`unknown` (drove a real API improvement: `normalizeUnauthorized` now returns `AuthenticationError | null` instead of passing `unknown` through), `no-unused-vars` keeps its single sanctioned escape as four inline disables on the decorator `context` parameters (the protocol imposes them; `reportUnusedDisableDirectives: 'error'` self-cleans) — no blanket `^_` pattern, and `naming-convention` now requires the underscore on unused parameters and forbids it on used ones, `no-floating-promises` checking thenables, `no-base-to-string` checking `unknown`, `prefer-nullish-coalescing` inside conditionals, fully explicit `restrict-template-expressions`, `no-magic-numbers` + `enforceConst`, ten core-rule strict options (`array-callback-return` + `checkForEach`, `no-cond-assign` `'always'`, `use-isnan` + `enforceForIndexOf`, `valid-typeof` + `requireStringLiterals`, …), `require-unicode-regexp` requiring the ES2024 `v` flag (25 literals migrated; one character class needed its dash escaped), and `reportUnusedDisableDirectives`/`reportUnusedInlineConfigs` hoisted to `'error'` globally.
  - **Coverage widened at zero or near-zero cost**: the vitest block now lints all of `tests/**` (catching one untyped `vi.fn` in `helpers.ts`) with the `all` preset's 51 `warn` rules hoisted to `error`, `prefer-expect-assertions` scoped to loop/callback expects (7 tests annotated), `warn-todo`, and `checkImportFunctions`; six jsdoc hygiene rules plus four content-quality rules (18 name-echo tag descriptions rewritten, `@throws` documented on `parseOrThrow`); import-x hardened (`no-extraneous-dependencies` restricted to `tests/**` + config files, inline-type `no-duplicates`, `caseSensitiveStrict` resolution, `esmodule` dynamic-require checks, named default exports only, `no-namespace`); `no-bitwise` re-enabled globally with the two bitfield files scoped out; `prefer-await` enabled with four documented fire-and-forget escapes; `unicorn/no-this-outside-of-class` re-enabled outside `src/decorators/` (typed `this` is that category's architecture); `unicorn/try-complexity` returned to its strict default of 1 (three conditional spreads hoisted out of `try` blocks, one rejection-watch extracted); plus package-json `require-*` rules, `yml/key-name-casing`, the full GitHub Actions step-key order, `json/top-level-interop`, and four stricter markdown options.
- **Destructuring enforcement is now scoped to declarations, and `unicorn/no-unreadable-object-destructuring` is enabled.** `@typescript-eslint/prefer-destructuring` keeps the strict `array`/`object` stance for `const` declarations but no longer polices assignment expressions nor forces renamed-property destructuring — mainstream style guides don't (Airbnb explicitly sets `AssignmentExpression.object: false`), and that enforcement manufactured exactly the patterns the unicorn readability rule forbids: destructuring into `this.*` (`;({ ContextKey: this.contextKey } = loginData)`), array-inside-object patterns, and >2-level nesting. The 7 such sites were rewritten as direct reads/assignments, and 3 single-property renamed destructurings that the old enforcement had manufactured (`const { value: data } = result`, `const { 'set-cookie': setCookies } = headers`, `const { setTimeout: realSetTimeout } = globalThis`) were reverted to direct member access; multi-property, rest-pattern, `await`-sourced and `for…of`-header destructurings remain — those are idiomatic, not forced.
- **Chart labels are formatted from `Temporal.PlainDate` values directly**, through the polyfill's Temporal-aware `Intl.DateTimeFormat` export (now re-exported by the internal `temporal` module alongside `Temporal`). This retires the epoch-milliseconds bridge (`PlainDate` → `toZonedDateTime('UTC')` → `epochMilliseconds`) and the `timeZone: 'UTC'` formatter option — plain types format their own calendar fields, per the ECMA-402 Temporal integration. Output labels are unchanged.
- **`eslint-plugin-unicorn` 64 → 70** under the `all` preset — the plugin more than doubled (147 → 325 rules), so the whole delta was audited against the codebase (823 pre-existing violations across 29 rules):
  - 12 new rules stay disabled in `eslint.config.ts`, each with a one-line rationale: naming rules that duplicate or contradict the tuned `@typescript-eslint/naming-convention` (`name-replacements` — the renamed `prevent-abbreviations` — suggests `error_`-style trailing underscores it forbids), JSDoc/TSDoc-hostile comment rules (`no-asterisk-prefix-in-documentation-comments` alone flagged 505 standard doc lines), rules conflicting with `perfectionist/sort-classes` and `@typescript-eslint/prefer-destructuring`, rules whose autofix requires Node 24+ built-ins (`Error.isError()`, `Uint8Array#toBase64()`) while `engines.node` is ≥ 22.19, and project-level false positives (`Symbol.dispose` flagged as non-standard, typed `this` in decorators, zod call-nesting depth).
  - A second audit pass re-enabled 4 rules with tuned options instead of blanket disables: `no-computed-property-existence-check` (the four `key in obj` filter predicates became `Object.hasOwn()` — own-property semantics the surrounding code already assumed), `try-complexity` (re-enabled here, then tightened to its strict default of 1 in the config review below; the session-expiry parser moved its parse expression out of the `try` block, which now wraps a single call — the rule's very intent), `max-nested-calls` at its strict default of 3, with two scoped escapes — two inline disables in `src/validation/schemas.ts` (zod schemas mirror the nesting of the payloads they validate) and `max: 4` for tests (mock builders nest factories; the one depth-5 fixture literal was hoisted into an `emptyTilesResponse()` factory), and `no-non-function-verb-prefix` ignoring the domain nouns `setCookie(s)`/`setData`.
  - The boolean-prefix vocabulary of `@typescript-eslint/naming-convention` grew from `is/has/can/should` to the full modern set (`are/can/did/has/have/is/requires/should/was/were/will`) — a pure widening, and the one genuine smell unicorn's (still disabled) `consistent-boolean-name` had spotted was fixed (`isCallCount`, a number, renamed `callCount`).
  - The rest of the delta was adopted: conditional object spreads use the logical form (`…(cond && { key })`), `NaN`/`Infinity` globals replace `Number.NaN`/`Number.POSITIVE_INFINITY` (unicorn v70 reversed its own doctrine here), iterator helpers replace spread-into-array (`map.values().toArray()`, iterator `filter`/`flatMap` chains), and the remaining `Date` usages moved to `Temporal` (chart-label epochs via `Temporal.PlainDate`, test fixtures via `Temporal.Now`/`Temporal.Instant`) — the single justified exception is `Date.parse` for RFC 9110 `Retry-After` HTTP-dates, which `Temporal` cannot parse.
- **Undefined-tolerant input types now spell `prop?: T | undefined`**, so consumers compiling with `exactOptionalPropertyTypes` can pass a possibly-`undefined` value as a plain property instead of a conditional spread (`...(from !== undefined && { from })` becomes `{ from }`): `ClassicErrorLogQuery`, `ClassicHolidayModeQuery`, `ClassicFrostProtectionQuery.isEnabled`, `ReportQuery`, the `type` filter of `ClassicFacadeManager.getBuildings`/`getZones` and `ClassicFacade.notifySync`, and the entire configuration surface — every optional property of `BaseAPIConfig` (the credential pair, now derived as `UndefinedTolerant<LoginCredentials>` instead of `Partial<LoginCredentials>`, whose mapped `?` does not admit an explicit `undefined` under that flag, plus `abortSignal`/`events`/`logger`/`settingManager`/`syncIntervalMinutes`/`transport`), `LifecycleEvents`' callbacks, `TransportConfig.timeoutMs`, `ClassicAPIConfig` (`language`/`locale`/`shouldVerifySSL`/`timezone`), and `HomeAPIConfig.baseURL`. Each widening is backed by an undefined-tolerant runtime path — destructuring defaults, `!== undefined` guards, optional chaining, or the HTTP layer dropping the key (`encodeParams` filter, `JSON.stringify`). The `updateValues` payloads (`ClassicGroupState`, `HomeAtaValues`, `HomeAtwValues`, `Partial<ClassicUpdateDeviceData<T>>`) intentionally stay exact: a present-`undefined` key used to diverge from an absent one at runtime there — see the fix below. No observable change for consumers without `exactOptionalPropertyTypes`; with the flag, the contravariant/derived-type edges are source-breaking — see the dedicated Breaking entry.

### Added

- **`HomeDeviceAtwFacade.operationalStateZone1`/`operationalStateZone2`** — per-zone derived states on the `ClassicOperationModeStateZone` vocabulary: the top-level `OperationMode` projected onto the zones (`Heating`/`Cooling`/`Defrost` map through, everything else reads `idle`), matching what the MELCloud Home app displays. The Classic flag refinements (`Idle{Zone}`, `Prohibit*`) do not exist on the Home wire, so `prohibited` is never produced.
- **`HomeDeviceAtwFacade.operationalState`** — the FTC `OperationMode` normalized to the Classic state vocabulary (`HomeAtwOperationalState`: `dhw`/`heating`/`cooling`/`defrost`/`legionella`/`idle`; `Stop` reads `idle`, unknown firmware strings read `null`), the top-level sibling of `hotWaterOperationalState`.
- **`HomeDeviceAtwFacade.hotWaterOperationalState`** — derived hot-water operational state mirroring the Classic ATW facade's `hotWater.operationalState` (forced production → `dhw`, prohibit flag → `prohibited`, FTC operation mode → `dhw`/`legionella`, otherwise `idle`), typed on the shared `ClassicOperationModeStateHotWater` vocabulary. The per-zone equivalents are not portable: the Home wire carries none of the `Idle{Zone}`/`Prohibit*{Zone}`/`{Zone}In*Mode` inputs the Classic derivation reads.
- **`HomeAtwOperationMode`** — the top-level FTC operation-mode vocabulary reported by the `OperationMode` device setting (live-captured `Cooling`, `LegionellaPrevention` and `Stop`, plus the states the MELCloud Home app surfaces), for consumers deriving an operational state. The facade's `operationMode` getter keeps returning `string` because firmware revisions may expose further values.
- **Runtime validation of Classic `EnergyCost/Report` payloads.** `ClassicAPI.getEnergy` now validates the response against new Zod schemas (`ClassicEnergyDataAtaSchema`, `ClassicEnergyDataAtwSchema` and their union `ClassicEnergyDataSchema`). Every hourly bucket and total is checked to be a finite number, so a missing or non-numeric field surfaces as a `Result` failure with `kind: 'validation'` instead of propagating as a silent `NaN` through consumers' energy/power/COP arithmetic. This closes the gap on the trust boundary documented in [OlivierZal/com.melcloud#1359](https://github.com/OlivierZal/com.melcloud/pull/1359): the library is the layer responsible for validating MELCloud responses, and the Classic energy endpoint was the last consumed payload without runtime coverage.
- **Device ownership on MELCloud Home devices (`isOwner`).** MELCloud Home's only owner/guest signal is which array a building sits in (`context.buildings` = owned, `context.guestBuildings` = invited); `list()` used to flatten both and drop the distinction. It is now threaded through the registry and exposed as `HomeDevice.isOwner` and `HomeBaseDeviceFacade.isOwner`; a device id duplicated across both arrays stays owned (guest entries sync first, and the registry upsert is last-write-wins per id). The flag reports the structural origin only — live probing shows the BFF accepts guest writes on shared ATA units, so `false` must not be read as read-only.
- **`updatePower(isOn = true)` on the MELCloud Home facade base.** The unit-level master on/off (the app's system OFF/ON toggle — and, for ATW, the only observed way to power the pump off), defined once on `HomeBaseDeviceFacade` for ATA and ATW alike, mirroring where the Classic side defines it (`ClassicBaseFacade.updatePower`). A thin wrapper over the now-abstract `updateValues({ power })` both subclasses already implement.
- **Build-provenance attestations on every published release.** The publish workflow now signs a [SLSA build-provenance attestation](https://docs.github.com/en/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds) (via `actions/attest-build-provenance`) that binds each published tarball to the exact workflow run and commit that produced it. Verify a downloaded package with `gh attestation verify <tarball> --repo OlivierZal/melcloud-api`. npm's own `--provenance` is specific to the public npm registry and cannot be used when publishing to GitHub Packages; GitHub Artifact Attestations are the registry-agnostic equivalent.
- **`UndefinedTolerant<T>` and `Resolved<T>` utility types**, the two `exactOptionalPropertyTypes` counterparts the standard library lacks: `UndefinedTolerant<T>` is `Partial<T>` whose properties also admit an explicit `undefined` (the input-side widening this release applies across the package — `BaseAPIConfig` derives its credential pair from `LoginCredentials` through it, keeping the exact type as the single source of truth), and `Resolved<T>` is `Required<T>` that also strips the explicit `| undefined` (the resolved-defaults witness that `Required` no longer provides over widened types — see Breaking).

### Fixed

- **ATW zone-mode writes are serialized to the camelCase wire form.** The BFF reads zone modes back in PascalCase but its PUT endpoint only accepts camelCase — `updateAtwValues({ operationModeZone1: 'HeatCurve' })` used to earn a bare 400 and surface as `false`. The API now lowers `operationModeZone1`/`operationModeZone2` on write (`HeatCurve` → `heatCurve`); the canonical PascalCase form stays the public type.
- **A present-but-`undefined` key in an `updateValues` payload now behaves exactly like an absent key.** Plain-JS consumers (and TypeScript consumers without `exactOptionalPropertyTypes`) can send one, and two update paths diverged on it:
  - Home ATA/ATW facades: `updateValues({ setTemperature: undefined })` defeated the `Object.keys(values).length === 0` emptiness guard, so an effectively-empty update was pushed to the BFF instead of throwing `NoChangesError`. Undefined-valued keys are now dropped (new `omitUndefined` util) before the guard, the clamping, and the forwarded payload.
  - Classic device facades: the change-detection filter counted an `undefined`-valued key as a change whenever the current value was defined, raising a phantom `EffectiveFlags` bit (e.g. `0x4` for an untouched `SetTemperature`) and bypassing `NoChangesError`. The filter now discards `undefined`-valued keys first; `null` keeps its sentinel meaning and still counts as a change.

### Other

- Adopt the stable TypeScript 7.0.2 native compiler (mirrors [OlivierZal/com.melcloud#1386](https://github.com/OlivierZal/com.melcloud/pull/1386)): drop the `@typescript/native-preview` nightlies and install stable `typescript@^7.0.2` under the upstream-recommended `@typescript/native` npm alias. `build` and `typecheck` now invoke `node ./node_modules/@typescript/native/bin/tsc` by explicit path, since two TypeScript packages both declare a `tsc` bin and the `node_modules/.bin/tsc` link is ambiguous. `typescript@~6.0.3` stays as the bare package name because `typescript-eslint` still requires the JS API with a peer range of `>=4.8.4 <6.1.0`; TS 7 is aliased alongside it until the stable programmatic API ships in TypeScript 7.1.
- Dependabot modernization (mirrors [OlivierZal/com.melcloud#1363](https://github.com/OlivierZal/com.melcloud/pull/1363)): auto-merge now squashes instead of creating merge commits (one commit per bump on `main`), all `github-actions` updates are grouped into a single weekly PR, and npm updates keep the 7-day cooldown as supply-chain protection (compromised releases are typically unpublished within days; security updates bypass the cooldown).
- Toolchain and CI hardening (practices already adopted in [OlivierZal/com.melcloud#1359](https://github.com/OlivierZal/com.melcloud/pull/1359)):
  - `tsconfig.json` now declares `"strict": true` explicitly — it is the TypeScript 6 default, but third-party tools that read the config shouldn't have to know that.
  - CI runs coverage and the Sonar upload only on the current-LTS matrix leg (`lts/*` — modern yet stable, and always blocking so the quality gate cannot be skipped silently), and the `latest` leg is `continue-on-error` so brand-new Node releases never block CI.
  - The audit workflow gained the `concurrency` block every other workflow already had.
  - Added `.nvmrc` (`22`) so `nvm use` / editor tooling picks the supported runtime, and `/.claude/` to `.prettierignore` to match.

## [39.0.0] - 2026-05-25

### Breaking

- **Replace Luxon with the Stage-4 Temporal proposal**, polyfilled via [`temporal-polyfill`](https://github.com/fullcalendar/temporal-polyfill) until Node 22 reaches EOL (April 2027). The polyfill defers to native `globalThis.Temporal` once it ships unflagged (V8 14 / Node 26+), so this change is also the on-ramp for shedding the dependency entirely later.
  - `RateLimitError.retryAfter` is now `Temporal.Duration | null` (was Luxon `Duration | null`). Read with `retryAfter.total({ unit: 'seconds' })` (or `'milliseconds'`).
  - `RateLimitError.unblockAt` is now `Temporal.Instant | null` (was Luxon `DateTime | null`). Read with `unblockAt.toString()` or convert with `unblockAt.toZonedDateTimeISO(zone)`.
  - `RateLimitGate` constructor now accepts a `RateLimitDurationLike` shape (`{ days?, hours?, minutes?, seconds? }`) instead of Luxon's `DurationLike`. Existing call sites — both internal — already pass `{ hours: N }` and are unaffected.
  - The Classic API no longer mutates `LuxonSettings.defaultZone`. The configured `timezone` is held on the instance and threaded through `isSessionExpired` and `getErrorLog` so multiple `ClassicAPI` instances with different zones now stay independent (silent fix for a latent global-state bug).
  - The locale used to format report chart labels was previously read from `LuxonSettings.defaultLocale` (a global Luxon could see). It is now an explicit per-instance `locale` field on `ClassicAPIConfig` (BCP-47 tag — independent of upstream `language`), defaulting to the runtime locale when unset.

  See [#1510](https://github.com/OlivierZal/melcloud-api/pull/1510) for the full migration write-up.

### Added

- **`Temporal` re-export from the package root** (the polyfill namespace, falling back to native when available) for consumers that want to format error fields themselves without adding a polyfill dependency of their own.

### Fixed

- **Auto-sync and retry-guard timers no longer keep the Node event loop alive.** A script that just did `await ClassicAPI.create({ username, password })` (or `HomeAPI.create(...)`) and nothing else would sit idle for ~5 minutes until the auto-sync timer fired, because the internal `setTimeout` ref'd the loop. Both internal timers now call `.unref()`, matching the convention used by `undici`, `pg`, `ioredis`, `mongodb` and other modern Node clients. The auto-sync still fires on schedule whenever the host application has another reason to stay alive (HTTP server, other timers, open streams). Apps that previously relied on the auto-sync timer as an implicit keep-alive should now provide an explicit one (e.g. a long-lived server, a user-land `setInterval`, or `process.stdin.resume()` for CLIs). ([#1511](https://github.com/OlivierZal/melcloud-api/issues/1511), [#1512](https://github.com/OlivierZal/melcloud-api/pull/1512))

### Other

- Dependency refresh: `eslint`, `typescript-eslint`, `vitest` (+ `@vitest/*`), `@types/node`, `@swc/core`, `undici`, `@typescript/native-preview`, `@eslint/markdown` to their latest minor/patch.
- **`engines.node` raised to `>=22.19.0`** to align with the floor declared by the bundled `undici@8.3.0` runtime dep (was `>=22`). Consumers on Node 22.0–22.18 should update to the latest 22.x LTS patch.

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

[42.0.2]: https://github.com/OlivierZal/melcloud-api/compare/42.0.1...42.0.2
[42.0.1]: https://github.com/OlivierZal/melcloud-api/compare/42.0.0...42.0.1
[42.0.0]: https://github.com/OlivierZal/melcloud-api/compare/41.3.0...42.0.0
[41.3.0]: https://github.com/OlivierZal/melcloud-api/compare/41.2.3...41.3.0
[41.2.3]: https://github.com/OlivierZal/melcloud-api/compare/41.2.2...41.2.3
[41.2.2]: https://github.com/OlivierZal/melcloud-api/compare/41.2.1...41.2.2
[41.2.1]: https://github.com/OlivierZal/melcloud-api/compare/41.2.0...41.2.1
[41.2.0]: https://github.com/OlivierZal/melcloud-api/compare/41.1.0...41.2.0
[41.1.0]: https://github.com/OlivierZal/melcloud-api/compare/41.0.0...41.1.0
[41.0.0]: https://github.com/OlivierZal/melcloud-api/compare/39.0.0...41.0.0
[39.0.0]: https://github.com/OlivierZal/melcloud-api/compare/38.0.2...39.0.0
[38.0.2]: https://github.com/OlivierZal/melcloud-api/compare/38.0.1...38.0.2
[38.0.1]: https://github.com/OlivierZal/melcloud-api/compare/38.0.0...38.0.1
[38.0.0]: https://github.com/OlivierZal/melcloud-api/compare/37.2.1...38.0.0
