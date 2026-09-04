# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [55.1.0] - 2026-09-04

### Changed

- **The session lifecycle and the request pipeline now come from `@olivierzal/api-core` 1.1.0.** `src/api/base.ts` — the mechanism the boundary section of CLAUDE.md had marked as next to cross — is now a thin layer over the core's `SessionAPI`: the persisted credentials, the login backoff, the logOut-epoch protocol, the single-flight `resumeSession`/`ensureSession`, the refusal record, the resilience pipeline around every request and the sync-cycle template all live in the core, at exactly melcloud's amended 55.0.0 level (the core carried this repo's verdicts before this repo adopted the core). What stays here is this SDK's own verdicts: the zod/Result boundary (`requestData`, `safeRequest`, `classifyError`, `normalizeUnauthorized` — zod is refused entry to the core), the `ensureAuthenticated` and `isRateLimited` surfaces (kept off the shared class by decision), the transport RESOLUTION (the `instanceof` gate keeps binding THIS repo's redaction-carrying `HttpClient`, so a bare core client is rebuilt rather than adopted), and the `[Classic]`/`[Home]` log labels (the core's optional `logLabel`). `AuthenticationError`, `AuthenticationThrottledError`, `RegistrySyncError`, `LoginCredentials` and the `setting` decorator are now re-exports of the core under their existing names and paths; `ClassicAPI` and `HomeAPI` are untouched.

  The proof the contract is unchanged: the cross-dialect session-lifecycle kernel crossed byte-identical and green on both legs; the export set is name-for-name identical before/after (556 = 556 across the root barrel and every subpath); the emitted `.d.ts` public surface has a zero delta on public names (protected members reshaped — see below).

  MINOR rather than patch because the move is observable at the edges without breaking anyone: the transient-retry log line now redacts sensitive query values from the URL it names; the request lifecycle events' `durationMs` is now measured on the monotonic clock (`performance.now()`), so a system-clock adjustment mid-request can no longer report a negative duration; and the protected (never public) class surface reshaped — `api`, `retryGuard` and the `syncManager` accessor left the emitted declarations with the mechanism, `username`/`password`/`loginBackoffUntil` became private, and the core's `protected isSessionServable()` arrived. The dialect classes are `private`-constructed, so no consumer can extend them and reach that surface.

### Fixed

- **The MELCloud redaction vocabulary is seated in the core's session log lines.** The core serializes the request/response/error log lines and the transient-retry URL; its `SessionAPIOptions.redaction` option now receives the ONE bound engine from `src/observability/context.ts`, so `contextkey`, the OAuth tokens and `owneremail` stay masked on every route — the 2026-08-21 leak's failure class, closed at the dispatch seam before it could reopen there. Pinned by wiring clauses that fail on a key the BASE vocabulary does not know.

## [55.0.0] - 2026-08-31

### Breaking changes

- **`authenticate()` now wraps an enforced post-auth sync failure in the new `RegistrySyncError`.** 54.0.0 made that failure propagate instead of resolving over an empty registry — the right verdict, unchanged here — but it propagated RAW, so a consumer telling "signed in, stale list" from "sign-in refused" had to fall back to judging by the session (`error instanceof AuthenticationError || !isAuthenticated()`), the discriminator this line of releases exists to retire — and with a real false positive: a transport failure during `doAuthenticate` over a PRE-EXISTING live session (a user switching accounts; `ClientLogin3` answering 500 over a stale key) reads "signed in, stale list" while the new credentials were never accepted. The failure now surfaces as `RegistrySyncError` with the sync's own error preserved as `cause`; a refused credential is never wrapped — it stays `AuthenticationError`. Both halves are kernel-pinned on both dialect legs.

  Migration: a caller matching the enforced-sync failure by its concrete type (`ValidationError`, a transport error) now finds it on `error.cause`; classification becomes `instanceof RegistrySyncError`, with no session re-derivation.

- **A definitively-refused stored credential is no longer served as "signed in".** Three deliberate verdicts composed into an unintended whole: Classic never wipes on a refusal (a Classic `401` does not name the session), a refusal changes the verdict but not the stored session, and every loss-surfacing path keyed on `isAuthenticated()` — which the surviving context key answers `true` indefinitely. Net effect, measured end to end: after a server-side password change the app showed "signed in" over a dead account forever, and `onAuthenticationLost` could NEVER fire while the stale key stood. The refusal VERDICT itself is now recorded — set where `resumeSession` swallows a DEFINITIVE rejection (never a throttle, whose lockout says nothing about the pair; never a transport blip), lifted by the next ACCEPTED sign-in — and consulted where the loss surfaces: `ensureAuthenticated()` answers `false`, and the sync-cycle epilogue emits `onAuthenticationLost` once per episode and leaves the auto-sync disarmed, exactly the existing lost-session shape. The stored session itself still stands: no clearing verdict changed. The record is in-memory by design, like the loss-episode marker — a restart re-witnesses the refusal on its first gated sign-in, and the persisted login backoff keeps that sign-in honest.

  Migration: `ensureAuthenticated()` newly answers `false` — and `onAuthenticationLost` newly fires — where the stored credentials are refused while an older session still stands. That is the honest report: the account is dead even though requests on the surviving key may still be served.

- **`resumeSession()` no longer reports a REFUSED sign-in as a resumed session.** 54.0.0 made it judge by the session rather than by the throw and claimed two shapes for that one `isAuthenticated()` reading. The first is right and is unchanged here: a sign-in the server ACCEPTED whose enforced post-auth sync then failed IS a resume — the session was established, and answering `false` there had `initialize()` emit a spurious `onAuthenticationLost` over credentials that had just worked. The second — "a refused re-sign-in over a session that is still live" — is wrong: a refusal refreshes nothing, so reporting it as a resume hands the caller the credential the server has just rejected. The two are distinguishable exactly where they diverge, at whether the `doAuthenticate` round-trip resolved, so the method now judges by that and needs no heuristic.

  Migration: a caller branching on the return value newly takes its failure branch when the stored credentials are refused while an older session still stands. Nothing else about that path changes — the refusal still clears nothing, `isAuthenticated()` still reads `true` over the surviving session, and the accepted-then-sync-failed shape still answers `true`. `initialize()` can newly emit `onAuthenticationLost` there, which is the honest report: the stored credentials really were refused.

### Fixed

- **Classic's reactive 401 no longer replays the request with the context key MELCloud just rejected.** `AuthRetryPolicy` replays on the strength of `reauthenticate()` alone, and Classic's `reauthenticate()` is `resumeSession()` — which, judging by the session, answered `true` over the very context key the 401 had just refused. The replay then spent a guaranteed-401 round-trip against an upstream that throttles; the retry guard capped it at exactly one per window, which is how it stayed invisible. Fixed by the verdict change above, at the one place both dialects share.

  Classic deliberately does NOT clear the persisted session on a reactive 401, and that stays: a Classic `401` does not name the session — a shared building's zone-level `GetSettings` answers `401` while the same context key keeps serving `/User/ListDevices` (measured 2026-08-26) — so clearing there would destroy a working session over one endpoint's authorization verdict. Home clears, because a BFF `401` is its access token being refused. Both halves are now pinned in the cross-dialect session-lifecycle kernel, which also drops the two dialect-local copies of the old verdict: the same claim recorded in three places is how it came to be corrected in one.

- **`resumeSession()` is single-flight.** Both consuming apps boot with `shouldResumeSessionInBackground: true`, so the background `initialize()`'s resume and the first request's `ensureSession` → `performSessionRefresh` → resume could both pass the login-backoff gate before either refusal armed it — two refused sign-ins nearly simultaneously, against an upstream whose measured field threshold was four in seventy seconds. Concurrent calls now share ONE in-flight attempt (the `ensureSession` memo pattern, one lifecycle layer up), and every caller's verdict describes that shared attempt; N concurrent calls spend one `doAuthenticate` round-trip, kernel-pinned on both legs. One deliberate asymmetry: a caller joining AFTER the shared sign-in was accepted, while its enforced registry sync still runs, reads the already-determined verdict instead of awaiting the shared promise — the one real caller in that window is the reactive-401 path that sync itself triggered (`reauthenticate` → `resumeSession`), and awaiting there would wait on its own caller.
- **`runSyncCycle`'s doc no longer contradicts its body, on three counts.** It claimed the template "log + swallow failures" while the body propagates (`runBestEffortSyncCycle` is the swallowing variant its own `@throws` links); it claimed to "always reschedule the next sync" while the epilogue reschedules only a cycle that settles signed-in — re-applying a raced sign-out or surfacing a lost session otherwise; and it claimed to return "the fetched entries" while it returns whatever the work resolves. Ported from api-core's already-corrected copy.

### Added

- **`RegistrySyncError`** — the dedicated type of the enforced post-auth sync failure, carrying the sync's own error as `cause` (see the breaking entry above). Exported from the root barrel and the `errors/` surface like its siblings.

## [54.1.0] - 2026-08-30

### Added

- **Every entry the Classic listing drops now says so, with its id and the reason.** 54.0.0 made the `/User/ListDevices` boundary drop entries the registry cannot model instead of failing the whole payload — the right degradation, and unchanged here — but it dropped them in SILENCE. Downstream the device is pruned from the registry and com.melcloud degrades it to a warning over frozen values: a unit that looks present and is stale, with nothing anywhere saying why. This SDK's logged strings are its primary evidence channel — they land verbatim in the diagnostic reports users paste into issues — so the boundary now reports what it dropped:

  ```text title="one line per sync cycle"
  [Classic] Dropped 1 of 12 /User/ListDevices entries: device 42 (unmodelled device type)
  ```

  The two reasons stay apart because they call for opposite responses, and until now nothing could tell them apart: `unmodelled device type` is a MELCloud model newer than this release, answered by a release that adds it; `malformed header` is a wire regression on a device this SDK already models, answered by an issue against the payload. An entry too broken to spell a numeric `DeviceID` is still reported, as `device unknown` — a device missing from the registry unmentioned is the failure this line exists to end, and being unnamed is the lesser half of it.

  ONE aggregated line per sync cycle, never one per entry: the listing carries every device of the account and runs on every cycle, so a per-entry line would storm the host's logger — hardest exactly when a wire regression takes the whole payload down and the report most needs to stay readable. The single line still names every dropped id, which is what makes it actionable: the report has to say WHICH device went stale.

  MINOR rather than patch: nothing existing changes shape — no signature, no type, no return value, no reworded string — and the drop behaviour itself is untouched, but the SDK emits an observable line it never emitted, on the surface this repo treats as contracted. Consumers' diagnostic reports and log assertions can newly depend on it.

### Fixed

- **The 54.0.0 entry below described the drop wrongly, on two counts; both are corrected there and recorded here.**
  - It presented the filter as rejecting an unmodelled `Type`. The predicate is `ClassicMinimalDeviceSchema.safeParse(…).success` — the WHOLE minimal header — so a null `DeviceName`, a non-numeric `AreaID` or a missing `Device` object drops its entry too. Reading the entry as written, a wire regression on one field and a genuinely new MELCloud model were the same invisible event; the log line above is what separates them at runtime.
  - It closed the twin question with "The heatzy twin has no equivalent exposure: its sync is per-device." That is false, and a sentence that closes a question wrongly is how the twin was left a month behind on the sign-in fix recorded in the very same release. heatzy-api validates `/bindings` atomically, fans `getValues` out through a `Promise.all` that one throwing member rejects whole, and resolves `product_key` through a `getProduct` that throws on an unknown one — which blocks sign-in outright for an account owning a just-released Heatzy product. The claim is withdrawn; closing that exposure is heatzy-api's, not this repo's.

## [54.0.0] - 2026-08-29

### Breaking changes

- **`authenticate()` now rejects when its enforced post-auth sync fails.** Its documented guarantee — "successful return guarantees the registry reflects server state" — was void: the enforced sync ran through `fetch()`, whose catch-all logs the failure and returns an empty list. A `ValidationError`, a device type this SDK predates or any registry error therefore resolved as a successful sign-in over an EMPTY registry, which consumers read as "this account has no devices". Callers that only handle `AuthenticationError` now see the real error instead; the credential check happened first, so the session is left signed in. The probe path is untouched — `tryReuseSession()` still swallows, because a boot-time network blip must not destroy a valid persisted session, and that split is now explicit: `syncRegistry()` is the best-effort hook, `enforceRegistrySync()` the propagating one.

  heatzy-api shipped exactly this fix a month ago (its 11.0.0); it never crossed to this twin. Found by a cross-repo audit, 2026-08-29.

- **A device type this SDK does not model no longer invalidates the whole account listing.** The Classic REGISTRY sync is bulk — one `/User/ListDevices` call carries every building — and the schema validated each entry's `Type` against a closed union inside an atomic array, so ONE unmodelled device made the whole payload fail. (The SDK's other sync kind, the per-device merge that follows a read or write response, takes its type from an already-modelled device and is unaffected.) Swallowed, that reported an empty registry; propagating (above), it would have read as "cannot sign in at all" for every user owning a model newer than this SDK. Entries the registry cannot model are now dropped at the listing boundary (`isModelledClassicDevice`), which is also what the registry has always relied on — it builds a model per entry with no runtime guard of its own. The guard is the whole minimal header, not the `Type` alone: a null `DeviceName`, a non-numeric `AreaID` or a missing `Device` object drops its entry just as surely — a wire regression rather than a new model. That, and the false claim this paragraph first made about the heatzy twin, are corrected in 54.1.0 below.

### Fixed

- **`resumeSession()` judges the outcome by the session rather than by the throw.** A sign-in that the server accepted before its registry sync failed — or a refused re-sign-in over a session that is still live — is reported as authenticated, which is the method's documented meaning. Returning `false` there had `initialize()` emit a spurious `onAuthenticationLost`, prompting the user to sign in again over credentials that were working.
- **A failed sync cycle no longer announces a completed sync.** Both dialects' `fetch()` carried the `@syncDevices` notification outside the swallow, so a refresh that failed still told consumers the registry was fresh — and they rewrote stale values as if they were. The notification now rides the cycle that actually landed.

## [53.1.1] - 2026-08-28

### Fixed

- **The level fallback of the protection and holiday reads is one-way again.** 52.0.2 restored the zone→device fallback but added a symmetric device→zone fallback for `FPDefined`/`HMDefined` `false` buildings that nothing motivated and that could actively lie: a zone-level answer for a building the flag excludes reads as "never configured" (`ok(null)`), so falling back there would mask a real device-level failure with a wrong answer. A `false` flag now reads the device level only, kernel-pinned alongside the restored direction. Caught in owner review of the 52.0.2 diff.

## [53.1.0] - 2026-08-27

### Changed

- **The API-client mechanisms are now imported from `@olivierzal/api-core` 1.0.0 (exact pin) instead of living here.** The HTTP client and `HttpError` (whole-snapshot redaction seated in the constructor), the redaction engine, the observability shells and `LifecycleEmitter`, the resilience primitives, `SyncManager`, the temporal entry point, the time units and the `APIError` base become thin re-exports of the shared package. These modules used to be heatzy-api's byte-identical twins ("edit both or neither"); the 2026-08-21 redaction fix took four days to cross to the twin, which expired that discipline — a mechanism now changes once, in api-core, and arrives everywhere as a pin bump. This repo keeps only its protocol layer: the MELCloud sensitive-key vocabulary (`src/observability/context.ts` builds the one bound redaction engine and injects it into every seat), the wire types, the schemas and the facades. Zero public-surface change: the export set is name-for-name identical before and after (283 = 283 symbols across the subpaths), so no consumer code changes.

### Added

- **`HttpStatus.BadRequest`** (400) — present in api-core's status vocabulary, now re-exported here.
- **An optional `zone` parameter on `isSessionExpired`** — offset-less expiry strings can be interpreted in a supplied IANA timezone instead of the runtime's.
- **`RetryGuard` implements `Disposable`** — usable with `using` for scope-bound release.

## [53.0.0] - 2026-08-27

### Changed

- **BREAKING — every error-log entry carries its normalized instants.** `ErrorLogEntry` (the `/error-log` subpath) grows a REQUIRED `atEpochMs: number | null`: the epoch instant of `at`, projected at each dialect's boundary so no consumer re-derives it wrong — which is exactly what happened: `at` is wall clock in two different disciplines (Classic building-local, Home UTC), and a consumer parsing it host-locally shifts every Classic entry by the host/building offset. Classic anchors `at` in the client's configured timezone (`ClassicAPIConfig.timezone`, host zone when unset — the same anchor the holiday projection uses), which makes the Classic instant exact only insofar as that timezone IS the building's: a building in another zone skews it by the zone delta (the recorded worldwide skew reaches ±14 h), so day-scale reasoning stays safe where sub-hour does not — the caveat is stated on the type. Home anchors in UTC (the live-probed Home-wire verdict) and is exact. `at` itself is UNCHANGED, and Classic's kept-garbage policy carries over: an unparseable `at` keeps its entry with `atEpochMs: null` — `null`, not `NaN`, because these instants cross JSON boundaries where `JSON.stringify` silently rewrites `NaN` to `null`; saying `null` ourselves keeps both sides of the boundary identical. `clearedAt` gains its optional twin `clearedAtEpochMs?: number | null`, present exactly where `clearedAt` is (Home, once cleared), UTC-anchored the same way — closing the same re-derivation gap for the cleared stamp. Migration: code CONSTRUCTING `ErrorLogEntry` values (hand-rolled adapters, test doubles) must add `atEpochMs`; readers are unaffected and can start trusting the instants instead of parsing the wall clocks.
- **BREAKING — the ATW hot-water snapshot says when legionella prevention last ran.** `AtwHotWaterState` (the `/atw-state` subpath) grows a REQUIRED `lastLegionellaActivationEpochMs: number | null`. Classic projects its `LastLegionellaActivationTime` list field — building-local wall clock like every Classic timestamp — through the same configured-timezone anchoring, under the same exactness caveat (a building in another zone skews the instant by the zone delta); the year-1 "never ran" sentinel — any offset spelling, judged as UTC year ≤ 1 — and an unparseable value read `null`. Home answers `null`: its `/context` settings carry no counterpart (verified against the enumerated settings), and `null` = "this wire cannot say" is the recorded pattern, nothing emulated. Migration: code constructing `AtwHotWaterState` values must add the field; readers are unaffected.
- **BREAKING — the published group interfaces grow a required member.** `ClassicZoneFacade` and `ClassicDeviceAtaFacade` (the interfaces carrying `getGroup`) now REQUIRE `getMemberOperationModes` — a consumer-side implementation of either interface (test doubles included) no longer compiles without it. Migration: implement it by projecting your members' `Power`/`OperationMode` (or delegate to a real facade); consumers merely CALLING facades are unaffected.
- **BREAKING — every flat device zone node names its device type.** `ClassicDeviceZone` grows a REQUIRED `deviceType: 'ata' | 'atw' | 'erv'`, projected by the registry (which always knew it) so a flat picker filters its leaves without resolving the model behind each id. Same precedent as `hasAta`/`hasAtw` in 50.0.0: code CONSTRUCTING zone nodes must add the field — concretely, com.melcloud's `app.mts` chart-zones mapper (`getClassicDeviceZones`) builds `{ id, level, model: 'devices', name }` nodes by hand and must now carry `deviceType` through (the registry node it maps from already has it); readers are unaffected.

### Added

- **`getMemberOperationModes({ poweredOnly })` on the whole ATA group surface** — every facade answering `getGroup` answers it: the Classic zone facades project their ATA members' `Power`/`OperationMode` straight off the synced list data, the Home building facade projects its members through the operation-mode bijection, and both ATA device facades answer their own as a group of one. One answer shape — `ClassicOperationMode[]`, the ONE group vocabulary, Classic-numbered whichever API served the members — so the consumers' mixed-mode scene resolvers (com.melcloud's `getClassicAtaDetailedStates` mode read and `getHomeBuildingAtaModes`) collapse into one neutral call. A Home member whose mode the bijection cannot say (the facades pass unknown wire modes through unchecked) is DROPPED like a non-ATA member, never projected as a hole in the array; a Classic member's off-vocabulary wire NUMERIC passes through verbatim — the wire already speaks the vocabulary's own namespace. The required interface growth this entails is its own BREAKING entry above; `isHomeOperationMode` joins the `/enum-mappings` guards.
- **The published report contract** — the new `/report` subpath names the five cross-dialect chart reads as neutral target interfaces (`EnergyReportTarget`, `HourlyTemperaturesReportTarget`, `OperationModesReportTarget`, `SignalStrengthReportTarget`, `TemperaturesReportTarget`) plus the two honest compositions: `ReportSurface` (what every device-level target answers) and `FullReportSurface` (Classic devices and Home ATW). The Home ATA facade deliberately stays on `ReportSurface` — its wire has no hourly-temperatures and no operation-modes report, and absence stays absent instead of being emulated. Type-only by construction, so the subpath pulls nothing into a browser bundle; type-level pins hold every facade to the interfaces, the Home ATA absence included.
- **Contract kernels for the three shipped-but-unpinned cross-dialect contracts** — a contract without a kernel is not unified, and these three ran unpinned: `tests/contracts/ata-group.test.ts` (getGroup/updateGroupState/member modes across Classic zone, Classic ATA device, Home building and Home ATA device — one `ClassicGroupState` vocabulary, the null mixed/leave-unchanged sentinel, the emulated legs' no-op tolerance, the native zone wire's own null), `tests/contracts/protection-write.test.ts` (frost writes clamped identically on five implementations, overheat on its two Home targets) and `tests/contracts/ata-setpoint-clamp.test.ts` (both ATA dialects clamp a setpoint against the unit's advertised per-mode bounds, and both pass an out-of-vocabulary mode through unclamped). The kernel-duplicated dialect-local clauses in the unit suites are deleted — the kernels are the one home of cross-dialect clauses.

## [52.0.2] - 2026-08-27

### Fixed

- **The zone→device level fallback of the Classic protection and holiday reads is restored.** The wire's `FPDefined`/`HMDefined` are declarations, not guarantees — a level they promise can still refuse the read (observed again 2026-08-26: a shared building's zone-level `GetSettings` answers `401` while the session is valid, `ListDevices` succeeding the second before). The original 2024 design read the declared level and fell back to the other on ANY failure; the 2026-03 module-architecture refactor (#1415) silently gated that fallback on the flag being _unknown_, which disabled it everywhere the flag was known — buildings included — while the helper's comment kept claiming the old semantics. The flag now orders the two attempts and a failed first read tries the other level once, exactly the 2024 behavior inside the `Result` world; both contract kernels pin the clause so a future refactor cannot drop it unnoticed a second time.

## [52.0.1] - 2026-08-25

### Security

- **The OIDC token endpoint's failure text is now actually redacted.** 52.0.0 overclaimed this: it stated the value the token endpoint echoes was covered ("every one of those values is now redacted"), but the endpoint's non-2xx body is kept as raw TEXT and the string redaction only understood form-encoded strings — JSON text such as `{"error":"invalid_grant","refresh_token":"…"}` passed through verbatim into the thrown `HttpError`, which the host then logs ("Refresh token exchange failed:"). The shared redaction vocabulary now attempts a JSON parse on every string: on success the parsed value is redacted recursively and re-serialized, so a token-bearing field inside JSON text reads `******` in the error snapshot and the call loggers alike; any other string keeps the form-encoded/raw behavior.
- **The request URL's query string is redacted in the `HttpError` snapshot.** A token can ride inline in the URL (`?code=…`) rather than in the `params` record; the query portion now passes through the same form-encoded redaction as the bodies. Latent hardening — no SDK call site puts a credential there today.

## [52.0.0] - 2026-08-21

### Changed

- **BREAKING — a thrown `HttpError` no longer carries a typed, verbatim payload.** `HttpError` loses its `T` type parameter and `response.data` is now `unknown`, because a failed response body is a DIAGNOSTIC payload rather than a contract: upstreams echo the credential they just rejected (a Classic 500 returns `LoginData.ContextKey`, a 401 can mirror the bearer, the OIDC token endpoint names the refresh token in its error text), and every one of those values is now redacted. Migration: an `HttpError<Foo>` annotation becomes `HttpError`, and code reading `error.response.data` narrows it itself — nothing in this SDK ever did.

### Security

- **Credentials no longer travel inside a thrown `HttpError`.** The error carried a verbatim snapshot of the exchange that failed, and that object reaches every host logger — including the diagnostic reports users paste into issues, where a live bearer token was found on 2026-08-21. It leaked far more than that token: the Classic sign-in posts the account's **password and email in the request body**, the context key rides `X-MitsContextKey`, a session cookie comes back in the response headers, and the response BODY echoes secrets of its own. Every field naming a secret now reads `******` — request headers, body and query parameters, response headers and body alike — redacted in the constructor, so no call site can reintroduce the leak by forgetting to sanitize. What the retry policies read (`retry-after` and friends) passes through untouched. Verified by probe against `util.inspect`, `console.error`, `JSON.stringify(error)` and the `{ ...error }` spread.
- **The account's email address no longer appears in a routine sync log.** `OwnerEmail` — which the Classic list payload carries on every device of every successful poll — was outside the redaction vocabulary, so a 200 response wrote it to the host log. It is now blanked like every other credential, along with the OAuth vocabulary (`access_token`, `refresh_token`, `id_token`, `token`, `code`, `code_verifier`, `client_secret`).

### Fixed

- **A `404` on Home's `/context` is an account with no home, not a stale session.** The BFF answers `404` when the signed-in account has no MELCloud Home home — the token was accepted, since a rejected one answers `401` — but the SDK read the missing context as a failed session reuse and escalated to a full sign-in, which then failed, armed the 15-minute login backoff and reported an authentication loss, indefinitely. Such an account now settles: `isAuthenticated()` reads `true`, `fetch()` answers `[]` with an empty registry, and no sign-in is attempted. The situation is stated once per episode, not once per poll, and the expected `404` is no longer filed as an API failure — a `404` from any other endpoint is classified exactly as before. Polling continues, so a home created later is picked up on its own.

### Added

- **`HttpStatus.NotFound`** — the 404 the Home context branch now names.

### Adoption note

`isAuthenticated()` no longer implies an identity: for an account with no home it reads `true` while `user` and `context` stay `null`. Consumers deriving a display name or an email from `getUser()` after checking `isAuthenticated()` should handle the `null`; consumers that only ask "can this session serve requests" need no change.

## [51.0.1] - 2026-08-18

### Changed

- Post-wave cleanup sweep, no public-surface change. Internal factorings: the Classic energy report chart is built in one pass from the neutral extract (no intermediate re-shaping); the Home "today or one hour" chart window (day-on-five-minutes with a "now" cutoff vs hour-on-minutes) resolves in ONE shared helper for the signal and hourly-temperature reads; the ATW dual-zone write coupling drops guards its own construction already proves; the building member-unit fold rides the shared `toHomeProtectionUnits`; the recurring `await Promise.resolve(…)` rule-pair escape is one named `resolved` helper carrying the single documented disable. Docs: README examples fixed to the current constructor and typed device reads; doc categories align the neutral contract modules (`/atw-state`, `/error-log`) with the protection/holiday precedent. Tests: kernel-duplicated cases deleted (the contract kernels are the one home of cross-dialect clauses), registry/API mock scaffolding unified on shared fixtures.

## [51.0.0] - 2026-08-18

### Changed

- **BREAKING — a second ATW zone is a capability, not a type.** `ClassicDeviceAtwHasZone2Facade` (class and published interface) and the `hasClassicZone2` guard are gone: the one `ClassicDeviceAtwFacade` answers `zone2: ClassicZoneState | null` (`null` on a single-zone unit), matching the Home facade's `hasZone2`-keyed nullable reads — the shape both dialects share. The dual-zone write coupling and the dual-zone chart legends stay, keyed on the unit's own `HasZone2` (a physical property, bound at construction). The two legend orders — whose tank pair deliberately diverges between variants (inherited wire order) — are now codified and test-pinned instead of implicit. Migration: replace `hasClassicZone2(facade)` with `facade.zone2 !== null`, and any `ClassicDeviceAtwHasZone2Facade` annotation with `ClassicDeviceAtwFacade`.
- **BREAKING — the ATW state speaks one cross-dialect vocabulary.** The new `/atw-state` subpath publishes `AtwZoneState` and `AtwHotWaterState`: the zone/hot-water snapshots BOTH dialects answer through the same `zone1`/`zone2`/`hotWater` reads. The Home ATW facade gains those reads; the Classic shapes stay precise through extensions (`ClassicZoneState`/`ClassicHotWaterState` keep boolean flags, the eco flag and the reported tank maximum) while the neutral fields the Home wire cannot produce are nullable (`null` = this wire cannot say). One migration note inside the Classic shape: `ClassicZoneState.operationMode` now speaks the shared STRING vocabulary (`HomeAtwZoneMode` — the Classic member names, the Home wire-normalized values and the consumer capability ids are one vocabulary); the numeric wire form projects through the total bijection at the facade boundary. Wire types (`OperationModeZone1/2` fields, update payloads) are untouched.

### Added

- **`FlatZone`** — the cross-dialect picker-node union (`ClassicFlatZone | HomeFlatZone`), so a consumer's zone picker speaks one published type; the `model` tags discriminate and the option-value convention stays `<model>_<id>`, split at the first underscore.
- Contract kernel `tests/contracts/atw-state.test.ts` (shared snapshots + the per-dialect precision quarantines), and pins for both ATW legend orders.

## [50.0.0] - 2026-08-18

### Changed

- **BREAKING — the error log speaks one cross-dialect vocabulary.** The new `/error-log` subpath publishes `ErrorLogEntry` (`at`/`deviceId` on every dialect, `message` when the wire carries a text, `code`/`clearedAt` where it has them — Home), the Classic page wrapper `ErrorLogPage` (`entries` + the chained window bounds) and the pure window arithmetic `resolveErrorLogWindow(query, timeZone?)` — the exact tiling the Classic API applies, published so a consumer paging without a Classic session tiles identical windows instead of re-deriving them. Migration: Classic pages rename `errors` → `entries` and each entry's `date`/`error` → `at`/`message` (`ClassicErrorDetails` is gone; `ClassicErrorLogQuery` aliases the neutral query, while `ClassicErrorLog`/`ClassicErrorLogEntry` stay PRECISE — a Classic entry keeps `deviceId: number` and a required `message`, so no numeric sink or message read loosens); the Home facade `getErrorLog()` now answers neutral entries (`timestamp`/`errorCode`/`errorReason`/`clearedTimestamp` → `at`/`code`/`message`/`clearedAt`, the facade's own id as `deviceId`) — the raw wire entries stay on `HomeAPI.getErrorLog`, reachable at the root as `HomeErrorLogEntry`; the `/home` subpath's `ErrorLogEntry` alias now names the NEUTRAL shape its facades return, no longer the raw wire one.
- **BREAKING — Home protection and holiday reads are the same async methods Classic answers.** The Home device facades' sync getters `frostProtection`, `holidayMode` and the ATA-only `overheatProtection` are replaced by `getFrostProtection()`, `getHolidayMode()` and `getOverheatProtection()` returning `Promise<Result<… | null>>` — same names and shapes as the Classic facades, answered from the synced `/context` without a wire call. `getOverheatProtection` lives on the base: an ATW unit answers `null` like a never-configured ATA unit, so the last consumer type-guard dies; the new `supportsOverheat` getter says which targets can hold one.
- **BREAKING — `HomeBuildingAtaFacade` grew into `HomeBuildingFacade`.** The building facade now holds BOTH connection types (`devices` covers ATA and ATW; `HomeFacadeManager.getBuilding` resolves for any building with a registered device, ATW-only included) and carries the per-target settings surface: aggregated `getFrostProtection`/`getHolidayMode`/`getOverheatProtection` (per-field folds — `AggregatedProtectionState`/`AggregatedHolidayModeState`, `null` the mixed marker, published with their `aggregate*States` folds), batch `updateFrostProtection`/`updateHolidayMode`/`updateOverheatProtection`, and a fan-out `updatePower`. The ATA group contract (`getGroup`/`updateGroupState`) is unchanged and keeps covering the ATA members only.

### Added

- **Per-device Home protection writes**: `updateFrostProtection`, `updateHolidayMode` and `updateOverheatProtection` on every Home device facade (single-unit batches; the overheat write on an ATW unit resolves without a wire call, mirroring the batch semantics) — the Classic facades' write surface, now uniform across dialects.
- **`HomeBuildingZone.hasAta`/`hasAtw`** on the flattened zone list, so a consumer no longer positionally scans the flat list to learn a building's connection-type membership. The flags state the building's FULL membership even under a type-filtered `getZones` view — a batch write always touches every member, so a filtered view must not misreport the scope. Required fields on a published interface: code CONSTRUCTING zone nodes must add them (readers are unaffected).
- **`getTemperatureRange` takes either dialect's mode** on both ATA facades — the total `operationMode` bijection resolves a Classic numeric mode on the Home facade and a Home string on the Classic one.
- **`HomeAPIAdapter.notifySync`** — the sync hook `HomeAPI` always had, now visible through the adapter contract like on the Classic side. Note: a REQUIRED member on a published contract — hand-rolled adapter implementations (tests' mocks aside) must add it, which is part of why this release is a major.
- Contract kernel `tests/contracts/error-log.test.ts`; the protection and holiday-mode kernels now ask both dialects the SAME method.

## [49.2.0] - 2026-08-18

### Added

- **The `ClassicOperationModeZone` ↔ `HomeAtwZoneMode` bijection** (`atwZoneModeFromClassic` / `atwZoneModeToClassic` on the `/enum-mappings` subpath): the two vocabularies name the same five FTC control bases, and the mapping now exists in one place instead of waiting to be hand-rolled by a consumer — the prerequisite for a future shared ATW state.
- **New readable surface**: `inStandbyMode` on every Home device facade (the ATW getter, hoisted; ATA units report the same setting and gain the read), and `temperatureStep` on the Home ATW facade (the FTC's advertised `temperatureIncrement`, the ATW counterpart of the ATA derivation from `hasHalfDegreeIncrements`).
- **`HomeDeviceValues`** names the ATA-or-ATW update payload the device-update endpoint accepts, and **`HomeEnergyQuery`** names the per-type energy-telemetry query (`measure` required on ATW, absent on ATA) — both shapes are now pinned by type-level tests.
- **`ClassicDeviceErvFacade` is published** — the one device type whose facade had no published name. It is exactly `ClassicDeviceFacade<typeof ClassicDeviceType.Erv>` (the ERV ventilation-mode filtering refines behavior, not shape); `ClassicDeviceFacadeAny` now spells its ERV member through it.

### Changed

- **The Home device base now carries everything the types share.** `capabilities` (narrowed per type through `TData`), `power`, `inStandbyMode`, `getEnergy`, `getErrorLog`, the constructor and the `updateValues` pipeline (omit-undefined → `NoChangesError` → per-type setpoint clamp → push) moved from the ATA/ATW facades into `HomeBaseDeviceFacade`; the subclasses keep only their genuine divergences (setpoint vocabulary, report merging) behind the protected `clampValues` hook — declared OPTIONAL on the base (the optional-method mirror of the Classic `extractEnergyReport` null hook), so a type with no bounds to enforce declares nothing and no existing subclass of the published base breaks. Every member remains reachable on the facade classes with a compatible signature — the move is inheritance, not removal. One deliberate looseness to know about: a reference typed `HomeBaseDeviceFacade<HomeDeviceData>` (the "any home device" supertype) accepts the union shapes on `updateValues` and `getEnergy`; the concrete facade types keep the narrow per-type contracts, which the new type-level tests pin.
- **The two Classic energy extractors collapsed into one factory** (`makeEnergyExtract(buckets)`): the ATA and ATW hooks were the same function modulo their bucket tuple, and now say so.

## [49.1.0] - 2026-08-18

### Added

- **Contract kernels for the two remaining de-facto cross-dialect contracts** — signal strength and energy report. `getSignalStrength` answers the same chart shape in dBm on every dialect (Classic's hour-by-hour zone fan-out and Home's five-minute single fetch are mechanics, not contract), and `getEnergyReport` answers the same chart shape in kWh on every dialect and type that has an energy wire. The holiday-mode write asymmetry on a disabled window is now pinned too: neither dialect projects the ignored bounds (Classic clears them to null components, Home forwards them untouched), so a malformed leftover date can no longer fail a disable on either side.

### Fixed

- **Classic report reads no longer touch the wire for device types whose report does not exist.** `getInternalTemperatures` and `getHourlyTemperatures` on ATA and ERV devices used to make a real `Report/GetInternalTemperatures` call only to render zero series (the wire is ATW-only, as the interface docs always said); they now resolve an empty chart without any I/O, driven by the same per-type descriptor idiom as the energy extractor (`internalTemperaturesLegend`, empty = the report does not exist for this type). ERV `getEnergy` — typed `never` since the beginning — now throws `No energy report exists for this device type` before any I/O instead of firing a request whose answer nothing could consume.

### Changed

- **The Classic report surface no longer leaks `shouldUseExactRange`.** The device classes took a second boolean parameter the published interfaces never declared; the classes now match the interfaces (`getInternalTemperatures(query?)`, `getOperationModes(query?)`, `getTemperatures(query?)`), the internal exact-range choice being each method's own. The published interface parameters are now optional, matching the classes — a widening, so existing callers compile unchanged.

## [49.0.0] - 2026-08-18

### Fixed

- **Holiday-mode windows are no longer shifted by the caller's UTC offset** ([com.melcloud#1593](https://github.com/OlivierZal/com.melcloud/issues/1593)). Both MELCloud wires store holiday-mode datetimes as UTC wall clock, but the facades passed the caller's wall clock through verbatim in both directions — so every window landed late by the caller's offset on write (+1 h in BST, +2 h in CEST) and displayed early by the same amount on read. The Classic write, the Home batch write and both dialects' reads now project between the caller's clock and UTC at the facade boundary. A projection existed once (`7ba6364f`, 2023) and was lost in a 2024 refactor; the contract tests that pinned the buggy verbatim round-trip now pin the projection, across both DST offsets.

### Changed

- **BREAKING — the holiday-mode contract now names its timezone.** `HolidayModeUpdate` and `HolidayModeState` datetimes are wall clock in the API's configured `timezone` (`ClassicAPIConfig.timezone` / `HomeAPIConfig.timezone`), falling back to the host's zone when unset. Any consumer that compensated for the missing projection by passing pre-converted UTC must stop: pass local wall clock and let the facade project. Consumers that passed local wall clock all along (the intended reading) need no change and simply start getting correct behavior.
- New internal projection helpers `toUtcWallClock` / `toZonedWallClock` carry the boundary conversion: writes throw on malformed input before any I/O; reads pass unparseable values through verbatim, so a bad wire value cannot take a sync down. DST-gap wall clocks resolve per Temporal's `'compatible'` disambiguation.

## [48.2.0] - 2026-08-11

### Added

- **Every flat module the root barrel re-exports now has its own subpath** — `/enum-mappings`, `/holiday-mode`, `/temperature-range` and `/temporal` join `/constants` and `/protection`. The root barrel cannot load in a browser bundle (it reaches the HTTP stack, whose `node:` builtins esbuild cannot resolve), so anything published only through it — including the shared `rangeForHomeMode`/`rangeForClassicMode` setpoint resolvers — was unreachable from a webview however browser-safe the module itself was (measured: `temperature-range` bundles to ~2 kB once addressed directly, esbuild pruning the unreached neighbours). The criterion is recorded and held by a test: subpaths mirror the barrel's flat re-exports one-to-one, so a future module cannot silently miss its path. Strictly additive — nothing is removed and no existing import changes.
- **`./package.json` is exposed through the export map**, so tooling that reads package metadata resolves it instead of being blocked by the map.
- **The browser-reachable closure now holds the es2023 webview floor** under lint and a closure-recomputing test: the modules the subpaths open to phone webviews are guaranteed to stay loadable on the engines those webviews run.

### Fixed

- **`build` purges `dist` before emitting**, so a module deleted from `src` can no longer survive as a stale compiled file and ship in a locally packed tarball — CI's fresh checkout made that safety circumstantial, not guaranteed.

## [48.1.0] - 2026-08-10

### Added

- **`/protection` subpath export**, so a browser bundle can read the published protection bounds instead of copying them. `FROST_PROTECTION_RANGE`, `OVERHEAT_PROTECTION_RANGE` and `PROTECTION_GAP` were reachable only through the root barrel, which pulls in the HTTP stack: bundling a _value_ from it for the browser fails on `undici`'s `node:` builtins (measured: 118 resolution errors), so a consuming webview copied the numbers into its own source instead. `dist/protection.js` imports nothing, so the new path bundles to 78 bytes with the three values inlined and the clamping helpers tree-shaken away. Strictly additive: nothing is removed and no existing import changes.

## [48.0.0] - 2026-08-10

### Changed

- **Breaking:** `engines.node` raised to `>=22.20.0` (was `>=22.19.0`). The floor now states the measured device fleet rather than the requirement of a bundled dependency: every up-to-date Homey Pro runs Node 22.20 (Early 2019) or 22.23 (2023), measured on-device 2026-08, so 22.19 was a number nothing executed. `undici`'s own `>=22.19.0` stays satisfied — the floor remains the highest of the dependency floors and the fleet floor. Nothing changes at runtime (`engines` is advisory absent `engine-strict`), but the package no longer claims support for Node 22.0–22.19.x.

## [47.1.1] - 2026-08-10

### Fixed

- **`getTemperatureRange` is now declared on the `ClassicDeviceAtaFacade` interface**, not only on the class behind it. Since 46.0.0 the published facade names resolve to the interfaces the manager returns, so a method absent from the interface is invisible to consumers however faithfully the class implements it — the Home side declared it, the Classic side did not, and calling it through a Classic ATA facade failed to typecheck. The signature mirrors the class exactly; no runtime behaviour changes.

## [47.1.0] - 2026-08-10

### Added

- **Per-mode ATA setpoint bounds, resolved identically whichever API backs the device.** `getTemperatureRange(mode?)` on the ATA facades answers the interval a unit enforces for an operation mode, defaulting to the active one, and returns `null` for a mode outside the known vocabulary — an unrecognised wire value passes through unclamped rather than borrowing another mode's bounds. Both dialects advertise the same three intervals and differ only in field spelling, so each facade supplies its own bounds and a single shared table resolves them.
- `TemperatureRange` and `AtaTemperatureBounds` types, plus the `rangeForHomeMode` and `rangeForClassicMode` resolvers, exported from the root barrel for callers who hold bounds directly.

## [47.0.1] - 2026-08-10

### Fixed

- **The library parses again on Homey Pro (2016–2019) running older firmware.** Three regexes in the token-authentication flow and one in the HTTP client carried the `v` flag, which is an ES2024 addition: the pre-Node-20 engine on those firmwares rejects it at _parse_ time, so importing the library threw `SyntaxError: Invalid regular expression flags` and took the host app down at boot before any code ran. All shipped regexes now use `u`, which is equivalent for these patterns — none uses the set notation `v` exists for — and a lint rule holds the constraint.

## [47.0.0] - 2026-08-07

### Changed

- **Breaking:** the snake_case members of two published constants are now camelCase — `ClassicLabelType.day_of_week` → `dayOfWeek`, `ClassicLabelType.month_of_year` → `monthOfYear`, and `ClassicTemperature.cooling_min` → `coolingMin`. These names are the library's own, not the wire's: **every numeric value is unchanged**, so no request or response shape moves and only source references need updating.

## [46.0.1] - 2026-08-06

### Fixed

- **Credentials are persisted only once the server accepts them.** `authenticate()` used to write the attempted username/password to the settings store and wipe the persisted session before the sign-in round-trip, so a mistyped login overwrote the working stored pair and tore down a live session. A rejected or failed attempt now leaves both untouched (the login backoff still arms); on success the session is replaced wholesale — the `doAuthenticate` hooks wipe before storing, so nothing from a previous account survives, including a refresh token the token response happens to omit.

## [46.0.0] - 2026-08-06

### Changed

- **Breaking:** the published facade type names `ClassicBuildingFacade`, `ClassicDeviceAtaFacade`, `ClassicDeviceAtwFacade` and `ClassicDeviceAtwHasZone2Facade` now resolve to the interfaces the SDK actually returns (from `ClassicFacadeManager.get` and the `isClassic*Facade` guards), not the implementation classes — annotating a narrowed facade with a published name now typechecks. The classes are no longer published; facades are obtained through the manager.
- `toHomeEnergyOptions` sources take an optional `scale` (defaults to `1` for measures already in kWh).

### Removed

- **Breaking:** `NetworkError` — the `Result` `network` variant carries transport failures (#1677).
- **Breaking:** `ClassicDevice.isAta()`/`.isAtw()`/`.isErv()` — narrow with `isClassicDeviceOfType(device, type)` or query `registry.getDevicesByType(type)`; the predicates had no remaining callers.

### Added

- `/home` barrel: the missing `DeviceFacadeAny`, `isAtaFacade`/`isAtwFacade` guards, `FrostProtectionPostData`, `HolidayModePostData`, `OverheatProtectionPostData`, `ProtectionUnits`, `ReportAnnotation`, `ReportTrigger`, and the dialect-neutral `fetchDevices`/`syncDevices` decorators.
- `/classic` barrel: the missing `BaseListDevice`, `BuildingOwner`, `DevicePermissions` and `QuantizedCoordinates` types.
- Root barrel: `HttpStatus`, `HttpErrorRequestConfig` and `TransportConfig` — reachable from public members (`HttpError.config`, `BaseAPIConfig.transport`, `error.response.status` narrowing), so consumers can now name them.

### Fixed

- Log redaction now recurses into nested objects: a sensitive key one level down (`{ body: { password } }`) was logged verbatim, while the same payload nested in an array was redacted.
- The retry backoff detaches its abort listener once a wait completes: a long-lived `abortSignal` (the documented Homey shutdown-signal use) no longer accumulates one listener per retried request.

## [45.1.0] - 2026-07-29

### Fixed

- **The sign-in backoff now waits the lockout MELCloud announces, instead of a flat two hours.** `ClientLogin3` counts the remaining lockout down in `LoginMinutes` on every throttle rejection (`ErrorId 6`), and the schema parsed neither it nor `LoginStatus`. A user report showed a 60-minute lockout answered with a 120-minute pause — an extra hour of a heat pump nobody could control, asked for by nothing. The two-hour constant is now the cap and the fallback: an absent window (the Home 429 carries none) or an absurd one cannot shorten the pause below what a blind caller would have waited, and a non-positive `LoginMinutes` reads as "none announced" (the endpoint sends sentinels such as `-10033`).

### Added

- **`AuthenticationThrottledError.retryAfter`** — the window the server announced, as a `Temporal.Duration`, mirroring `RateLimitError.retryAfter` so a consumer can phrase "try again in N minutes" without parsing the message. `null` when the upstream announced none. The constructor's options bag stays optional, so existing `new AuthenticationThrottledError(message)` call sites are unaffected.
- `ClassicLoginData.LoginMinutes`, typed and validated alongside the fields the login flow already consumed.

## [45.0.2] - 2026-07-28

### Fixed

- `ensureAuthenticated()` no longer signs the user out while probing. It went straight to `resumeSession()`, which routes through `authenticate()` and wipes the persisted session _before_ re-logging in — so a session that was merely unexercised (a boot-time context fetch that lost the network reads unauthenticated while a valid refresh token sits in storage) was destroyed by the probe meant to restore it, and a failing re-login then left the account signed out. The probe is now a non-destructive registry sync, with `resumeSession()` kept as the fallback.
- Classic `isAvailable` no longer swallows `EntityNotFoundError`: the registry lookup moved outside the guard that tolerates an unparsable timestamp, so a pruned id propagates like it already did on the Home facade instead of reading as reachable. A consumer that syncs availability before touching device data was calling `setAvailable()` on a vanished device.

## [45.0.0] - 2026-07-28

### Changed

- **Breaking — one settings vocabulary:** `ProtectionUpdate`/`ProtectionState` (frost and overheat) and `HolidayModeState` join `HolidayModeUpdate` as the cross-dialect contracts. Classic maps its `FP*`/`HM*` wire fields (`*Defined: false` surfaces as `null`); the Home getters map their camelCase `/context` descriptors. `ClassicFrostProtectionQuery` is replaced by `ProtectionUpdate` (`isEnabled` now explicit).
- **Breaking — one mutation outcome:** every facade mutation resolves `Promise<void>` and throws typed errors. Classic converts its `Success`/`AttributeErrors` wire union through the new `UpdateRejectedError` (carrying `attributeErrors`), including the power endpoint's bare-boolean acknowledgment; the Home and device-level group writes drop their faked success envelopes; `updatePower` drops its unread boolean echo. Building group writes settle every member and bundle concurrent failures into an `AggregateError`.
- **Breaking — one registry vocabulary:** `HomeRegistry.getAll` → `getDevices`, `getByType` → `getDevicesByType` (with Classic's narrowing overloads), `getBuildingsByType(type)` → `getBuildings({ type? })` (optional type merges both connection types; name-sorted), `sync` → `syncDevices`.
- **Breaking — manager parity:** `HomeFacadeManager` gains `getBuildings({ type? })`, `getZones({ type? })` (the flattened picker list, `HomeFlatZone`) and `getById(id)`; `ClassicFacadeManager` gains `getById(kind, id)` and its constructor takes `(api)` only — `ClassicAPIAdapter` now declares the `registry` it always had.
- **Breaking — one wire-method vocabulary on Home:** `updateAtaValues`/`updateAtwValues` → `updateValues`, `getAtaEnergy`/`getAtwEnergy` → `getEnergy`, `getAtaErrorLog`/`getAtwErrorLog` → `getErrorLog`, `getAtaTemperatures`/`getAtwTemperatures` → `getTemperatures`; the registry model's connection type routes the wire path. Reads fold an unknown id into the new `not-found` `ApiRequestError` variant (a cold open may query before the first fetch); writes throw `EntityNotFoundError`. `getAtwInternalTemperatures` stays ATW-only.
- **Breaking — one heartbeat name:** Home `list()` → `fetch()` (same sync-the-registry contract as Classic); Classic's raw no-registry `list()` is now private, and its low-level `login()` is protected behind `authenticate()`.
- **Breaking — facade identity parity:** Home device facades expose a literal-typed `type`, the `HomeDeviceFacadeAny` union and `isHomeAtaFacade`/`isHomeAtwFacade` guards; Classic device facades gain the `power` and `rssi` getters; `Identifiable` is generic (`Identifiable<TId>`, default `number`) and the Home facades implement `Identifiable<string>`; `ClassicDevice` gains `isAta()`/`isAtw()`/`isErv()`.
- **Breaking:** Home device facades resolve their model by id through the registry on every access instead of pinning the wrapper captured at construction — a pinned wrapper froze its data once the registry was rebuilt (logout/login), leaving a healed unit unavailable until restart. Accessors throw `EntityNotFoundError` (widened to Home GUID ids); the new `exists` getter is the non-throwing probe.

### Added

- `BaseAPIAdapter` — the session/infrastructure surface both dialect adapters extend, declaring the members consumers already used (`logOut`, and Classic's whole session half); `BaseAPISettings` declares the shared persisted material including the previously undeclared `loginBackoffUntil`; `ensureAuthenticated()` runs a sync check plus one best-effort `resumeSession` probe.

## [44.1.0] - 2026-07-28

### Changed

- Home `isAvailable` now applies the same day-scale persistence as Classic: the unit reads unavailable only after 24 hours of continuous `isConnected: false` (`HomeDevice.disconnectedSince` tracks the streak, in-memory). The flag's negative side is unproven — its live-probed record is 12/12 `true` on healthy units — and the persistence window makes a Classic-`Offline`-style tight-threshold boolean harmless, since such a flag never stays `false` through a report cycle. The shared threshold is exported as `STALE_COMMUNICATION_HOURS`.

## [44.0.0] - 2026-07-28

### Changed

- **Breaking:** the Home facade getter `isConnected` (introduced in 43.3.0) is replaced by a cross-dialect availability contract: every device facade — Classic and Home — now exposes `isAvailable` (the `AvailabilityAware` interface), `true` while MELCloud can still deliver writes to the unit. Home derives it from the `/context` `isConnected` flag; Classic from `LastTimeStamp` staleness with a 24-hour threshold — the `Offline` flag flaps minute-to-minute on healthy units (live-probed 2026-07-28), and the timestamp is building-local wall clock (±14 h of worldwide skew), so only day-scale staleness is trustworthy. An unparsable or future-skewed timestamp reads available.

### Fixed

- **Breaking:** Home device facades now resolve their model by id through the registry on every access, mirroring the Classic facades, instead of pinning the wrapper captured at construction. A pinned wrapper froze its data forever once the registry was rebuilt (logout/login, transient prune) — a cached facade could then report a healed unit unavailable until app restart. Accessors throw `EntityNotFoundError` (whose `entityId`/`tableName` widen to accept Home GUID strings and `'Device'`) when the id is gone, and the new `exists` getter offers the same non-throwing staleness probe as Classic.

### Added

- Classic list device data now types `LastTimeStamp` (already on the wire), the signal behind Classic `isAvailable`.

## [43.3.0] - 2026-07-28

### Added

- `isConnected` getter on the Home device facades, exposing the `/context` connectivity flag.

## [43.2.0] - 2026-07-27

### Added

- Home overheat-protection write path (Home ATA only, mirroring frost protection): `HomeAPI.updateOverheatProtection` (`POST /monitor/protection/overheat`) and `HomeManager.updateOverheatProtection` (bulk by device ids, non-ATA ids filtered out, no-op without at least one ATA).
- Generic `clampProtection` with `OVERHEAT_PROTECTION_RANGE` (31–40 °C) alongside the frost range, sharing the 2 °C min–max gap; `clampFrostProtection` is now a wrapper. The module moved from `frost-protection.ts` to `protection.ts`.

## [43.1.0] - 2026-07-23

### Added

- `ClassicFacadeManager.getZones` / `ClassicRegistry.getZones` now stamp each flattened zone with its owning building's display name — the new `ClassicFlatZone` (`ClassicZone & { buildingName }`) return type — so a flat picker (e.g. a Flow autocomplete with no tree) can tell same-named zones on different buildings apart. `buildingName` equals the zone's own name for a building zone.

## [43.0.1] - 2026-07-23

### Fixed

- Home `/context` no longer drifts from the strict schema when a unit reports frost/overheat protection or holiday mode without the runtime `active` flag (observed on live guest ATW units). `active` is now optional on `HomeFrostProtection`, `HomeOverheatProtection`, and `HomeHolidayMode`; previously the strict parse failed on every sync and fell back to the salvage schema, dropping that unit's protection data and logging a `ZodError` each cycle.

## [43.0.0] - 2026-07-23

### Changed

- **Breaking:** unified the holiday-mode write contract across the Classic and Home APIs. `ClassicFacade.updateHolidayMode` and `HomeFacadeManager.updateHolidayMode` now both take the shared `HolidayModeUpdate` shape `{ isEnabled, startDate, endDate }` (ISO 8601 wall-clock), replacing the Classic-only `ClassicHolidayModeQuery` `{ from?, to? }` presence-encoding. `isEnabled` is now explicit rather than inferred from the presence of `to`; `startDate`/`endDate` are ignored when disabling. Callers pass the full window — the start is no longer defaulted to "now" (the Home API carries no timezone context to anchor such a default, and unifying the contract means one caller-supplied window drives both sides). `ClassicHolidayModeQuery` and its `/classic` alias `HolidayModeQuery` are removed; import `HolidayModeUpdate` from the package root.

## [42.6.0] - 2026-07-23

### Added

- MELCloud Home frost protection and holiday mode. `HomeFacadeManager.updateFrostProtection(deviceIds, { isEnabled, min, max })` and `updateHolidayMode(deviceIds, { isEnabled, startDate, endDate })` write a set of Home devices in one per-account batch (`POST /monitor/protection/frost` / `/monitor/holidaymode`, grouped by ATA/ATW), with the frost bounds clamped to 4–16 °C with a ≥2° gap — the same limits the Classic side enforces (the clamp is now a shared helper). Each Home device facade exposes the current `frostProtection` / `holidayMode` from `/context`, and `HomeHolidayMode` gained its real `{ enabled, startDate, endDate, active }` shape (it was previously a structural placeholder).

## [42.5.0] - 2026-07-20

### Added

- New `LifecycleEvents.onAuthenticationRestored` callback: fires when a sync cycle ends authenticated after an `onAuthenticationLost` episode — the user logged back in or a retry recovered the session. Fires once per loss episode, so the two events always alternate; hosts can surface a "signed in again" confirmation to mirror the loss notification.

## [42.4.0] - 2026-07-20

### Added

- Every log line is now prefixed with the emitting client's label (`[Classic]` / `[Home]`): the two clients emit identically-worded lifecycle logs ("Session resume failed", "Automatic sign-ins paused"), so a host running both could not tell which account a diagnostics report was about.
- `AuthenticationThrottledError` is re-exported from the package root (it was only reachable through the internal errors module), so consumers can `instanceof` the login throttle instead of matching the error name.

## [42.3.0] - 2026-07-20

### Fixed

- Home sign-in refusals now classify correctly: the OIDC helper raises real `HttpError`s on non-2xx PAR/token responses, so a MELCloud Home HTTP 429 arms the 2-hour login-throttle pause (it previously surfaced as a plain `Error` and kept hammering the throttled endpoint) and transport-level 401s normalize to `AuthenticationError`.
- `logOut()` now clears the cached Home `/context` payload, as the `context` getter always documented — a signed-out client no longer exposes the previous account's buildings and devices.
- `logOut()` wins over async work it overlapped: a background session resume or sync cycle that completes after a sign-out can no longer resurrect the session (re-persisted tokens, repopulated registry, re-armed timer). The stale completion is detected and its state discarded.
- Classic report queries accept Z- and offset-suffixed ISO timestamps (`new Date().toISOString()` output): instants are lowered to wall-clock in the display timezone, mirroring the Home facades, instead of throwing an uncaught `RangeError`.

### Changed

- The login-backoff deadline persists through the `@setting` accessor like every other persisted field (same key, data-compatible), dropping the hand-rolled get/set/unset plumbing.
- Internal dedup: the no-op-tolerant group-write block, the day-grid enumeration, the energy interval table and the day-in-milliseconds constant each live in one place now; redundant credential re-stores in both `doAuthenticate` hooks removed.

## [42.2.0] - 2026-07-19

### Added

- Optional `unset` on the `SettingManager` interface. When a host delegates it, the `@setting` decorator deletes a key outright the moment its accessor is cleared to `''` (credentials, tokens, context key, expiry), and the login-backoff key is deleted when the pause is lifted — so `logOut()` leaves no empty-string leftovers in the host's store. Purely additive: hosts that do not provide `unset` keep the previous behaviour (clearing writes `''`, which reads back as absent all the same).

## [42.1.0] - 2026-07-19

### Added

- Public `logOut()` on the API clients — the inverse of `authenticate()`. In one owned, tested place it clears the persisted session (tokens/context/expiry), the stored username/password and the automatic-login backoff, stops the auto-sync timer, and empties the device/building registry, so `isAuthenticated()` reads `false` and no stale devices linger — identically on Classic and Home. User-initiated, so it neither arms the login backoff nor emits `onAuthenticationLost`. Downstream hosts should call this instead of deleting the SDK's persisted setting keys directly (which drifted per API: Classic de-authed immediately on the live `contextKey` read, while Home kept an in-memory `#user` until a later request happened to 401).

## [42.0.6] - 2026-07-19

### Fixed

- The automatic login backoff now persists its deadline through the `SettingManager`: it lived in memory only, so every host restart re-attempted a rejected sign-in immediately — field diagnostics showed four rejected Cognito sign-ins within 70 seconds across app restarts, each freshly created instance re-attempting despite the announced 15-minute pause (MELCloud throttles logins aggressively, so the hammering keeps a lockout alive). An explicit `authenticate()` — the user re-submitting credentials — still bypasses the gate and clears the persisted deadline on success; a corrupt persisted value reads as "no pause".

## [42.0.5] - 2026-07-19

### Fixed

- Mode bands now chart only within the hourly grid (7 days): on the daily grid of wider windows every burst rounded up to a full-day rectangle and the stacked translucent rectangles read as one solid dark wall that matched no legend swatch (on-device 14-day symptom). The single-chunk band window also ends the on-device load lottery that had reached 21 days; wider temperature charts keep the fast Weekly sampling without annotations.

## [42.0.4] - 2026-07-19

### Fixed

- The Home ATW temperature chart stopped loading at 30 days and wider: each 7-day `Hourly` comfort-graph call costs ~9 seconds at the BFF regardless of concurrency (probed via `scripts/probe-report-load.ts`: wall 9.0-9.9 s for 3, 5 and 9 parallel chunks alike), so windows needing several batches outlive the widget's 10-second budget. Mode bands now chart up to 21 days (one batch); wider temperature windows fall back to the fast Weekly sampling with the annotations dropped — the Weekly wire truncates them anyway.
- Chunk batches widened from 6 to 16 parallel requests (the BFF absorbs at least 10 with no wall-clock penalty), keeping a 90-day operation-modes pie on a single ~10-second batch, and the pie now drops each chunk's minute-grained sample payload before merging (it only reads the annotations), sparing the host's constrained heap.

## [42.0.3] - 2026-07-19

### Fixed

- Home ATW mode bands and operation-mode durations vanished beyond the first ~week of windows wider than 7 days: the BFF truncates the labeled comfort-graph annotations at period `Weekly` (live-probed via `scripts/probe-weekly-annotations.ts`: a 21-day Weekly query carried spans through day 6 only — exactly the on-device symptom — while the same window in 7-day `Hourly` chunks covered it fully). The annotation consumers (temperature-chart bands, operation-modes pie) now chunk at 7 days so every request stays on the faithful `Hourly` period; chunk fan-outs run in batches of 6 requests (a year is 53 chunks) with a failed batch short-circuiting the rest.

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

[55.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v55.0.0...v55.1.0
[55.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v54.1.0...v55.0.0
[54.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v54.0.0...v54.1.0
[54.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v53.1.1...v54.0.0
[53.1.1]: https://github.com/OlivierZal/melcloud-api/compare/v53.1.0...v53.1.1
[53.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v53.0.0...v53.1.0
[53.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v52.0.2...v53.0.0
[52.0.2]: https://github.com/OlivierZal/melcloud-api/compare/v52.0.1...v52.0.2
[52.0.1]: https://github.com/OlivierZal/melcloud-api/compare/v52.0.0...v52.0.1
[52.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v51.0.1...v52.0.0
[51.0.1]: https://github.com/OlivierZal/melcloud-api/compare/v51.0.0...v51.0.1
[51.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v50.0.0...v51.0.0
[50.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v49.2.0...v50.0.0
[49.2.0]: https://github.com/OlivierZal/melcloud-api/compare/v49.1.0...v49.2.0
[49.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v49.0.0...v49.1.0
[49.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v48.2.0...v49.0.0
[48.2.0]: https://github.com/OlivierZal/melcloud-api/compare/v48.1.0...v48.2.0
[48.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v48.0.0...v48.1.0
[48.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v47.1.1...v48.0.0
[47.1.1]: https://github.com/OlivierZal/melcloud-api/compare/v47.1.0...v47.1.1
[47.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v47.0.1...v47.1.0
[47.0.1]: https://github.com/OlivierZal/melcloud-api/compare/v47.0.0...v47.0.1
[47.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v46.0.1...v47.0.0
[46.0.1]: https://github.com/OlivierZal/melcloud-api/compare/v46.0.0...v46.0.1
[46.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v45.1.0...v46.0.0
[45.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v45.0.2...v45.1.0
[45.0.2]: https://github.com/OlivierZal/melcloud-api/compare/v45.0.0...v45.0.2
[45.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v44.1.0...v45.0.0
[44.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v44.0.0...v44.1.0
[44.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v43.3.0...v44.0.0
[43.3.0]: https://github.com/OlivierZal/melcloud-api/compare/v43.2.0...v43.3.0
[43.2.0]: https://github.com/OlivierZal/melcloud-api/compare/v43.1.0...v43.2.0
[43.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v43.0.1...v43.1.0
[43.0.1]: https://github.com/OlivierZal/melcloud-api/compare/v43.0.0...v43.0.1
[43.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v42.6.0...v43.0.0
[42.6.0]: https://github.com/OlivierZal/melcloud-api/compare/v42.5.0...v42.6.0
[42.5.0]: https://github.com/OlivierZal/melcloud-api/compare/v42.4.0...v42.5.0
[42.4.0]: https://github.com/OlivierZal/melcloud-api/compare/v42.3.0...v42.4.0
[42.3.0]: https://github.com/OlivierZal/melcloud-api/compare/v42.2.0...v42.3.0
[42.2.0]: https://github.com/OlivierZal/melcloud-api/compare/v42.1.0...v42.2.0
[42.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v42.0.6...v42.1.0
[42.0.6]: https://github.com/OlivierZal/melcloud-api/compare/v42.0.5...v42.0.6
[42.0.5]: https://github.com/OlivierZal/melcloud-api/compare/v42.0.4...v42.0.5
[42.0.4]: https://github.com/OlivierZal/melcloud-api/compare/v42.0.3...v42.0.4
[42.0.3]: https://github.com/OlivierZal/melcloud-api/compare/v42.0.2...v42.0.3
[42.0.2]: https://github.com/OlivierZal/melcloud-api/compare/v42.0.1...v42.0.2
[42.0.1]: https://github.com/OlivierZal/melcloud-api/compare/v42.0.0...v42.0.1
[42.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v41.3.0...v42.0.0
[41.3.0]: https://github.com/OlivierZal/melcloud-api/compare/v41.2.3...v41.3.0
[41.2.3]: https://github.com/OlivierZal/melcloud-api/compare/v41.2.2...v41.2.3
[41.2.2]: https://github.com/OlivierZal/melcloud-api/compare/v41.2.1...v41.2.2
[41.2.1]: https://github.com/OlivierZal/melcloud-api/compare/v41.2.0...v41.2.1
[41.2.0]: https://github.com/OlivierZal/melcloud-api/compare/v41.1.0...v41.2.0
[41.1.0]: https://github.com/OlivierZal/melcloud-api/compare/v41.0.0...v41.1.0
[41.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v39.0.0...v41.0.0
[39.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v38.0.2...v39.0.0
[38.0.2]: https://github.com/OlivierZal/melcloud-api/compare/v38.0.1...v38.0.2
[38.0.1]: https://github.com/OlivierZal/melcloud-api/compare/v38.0.0...v38.0.1
[38.0.0]: https://github.com/OlivierZal/melcloud-api/compare/v37.2.1...v38.0.0
