# CLAUDE.md

Typed Node.js client for the MELCloud (Classic) and MELCloud Home APIs.
ESM only, Node >= 22.20, published to GitHub Packages. `erasableSyntaxOnly`
is on: no runtime enums, no parameter properties, no runtime namespaces.

## Commands

- `npm run lint` / `npm run lint:fix` — ESLint (runs with an 8 GB heap).
- `npm test` / `npm run test:coverage` — vitest; coverage must stay at 100%.
- `npm run typecheck` — the native TypeScript 7 compiler, reached by its
  explicit path `node ./node_modules/@typescript/native/bin/tsc`; covers
  `src`, `tests` and the `*.config.ts` files (tsconfig `include`) — only
  `typedoc.config.js` stays outside it (JSDoc-typed under `@ts-check`;
  the lint still covers it). Official 6/7 side-by-side
  layout: the `typescript` name aliases `@typescript/typescript6` (the
  TS6 JS API) for the tools that import it (typedoc, typescript-eslint),
  while `@typescript/native` is the native 7.x compiler running typecheck
  and build — until TS 7.1 ships its programmatic API. `@typescript/native`
  does declare a `tsc` bin, but LOSES the `.bin/tsc` slot to
  `@typescript/old` (the TS 6 the compat package depends on) under
  npm's bin-conflict resolution — so the shim a bare `tsc` runs is
  TypeScript 6, like `.bin/tsc6`, and a bare `tsc` in a script would
  silently typecheck against TS 6. The explicit path is the only
  reliable route to the 7.x compiler; never shorten it.
- `npm run build` — purges `dist` before emitting, because `tsc` overwrites
  but never deletes: a module renamed or removed in `src` would otherwise
  survive in `dist`, and `files` ships that directory, so `prepare` would
  pack the fossil. The purge is inline rather than a `prebuild` hook so it
  cannot be skipped with `--ignore-scripts`.
- `npm run format` / `npm run format:fix` — prettier.
- `npm run docs` — typedoc. The config is `typedoc.config.js` (JSDoc-typed
  with `@ts-check`: typedoc cannot load `.ts` configs and silently ignores
  them); validation warnings fail the build.

## Domain gotchas

- A refused Classic sign-in is a SHAPE, not a status:
  `/Login/ClientLogin3` reports rejected credentials in its BODY, as
  `{ LoginData: null }`, and `doAuthenticate` (`src/api/classic.ts`)
  branches on `loginData === null` — it never reads the status. The
  SDK is status-agnostic there, and that is the load-bearing fact: the
  only status property the code depends on is that the refusal arrives
  as a SUCCESS status at all, since `HttpClient` throws `HttpError` on
  any non-2xx before the shape is ever inspected. The EXACT code is
  UNVERIFIED. This file asserted `201` until 2026-08-30 and the test
  fixtures stage `200`; neither is evidence of the wire — the fixtures
  are our own staging, and no live probe of a refused sign-in is on
  record. Do not restate a number here without one; if a probe is ever
  run, record its date the way the Home entries below do. What must
  never be assumed is that auth failures surface as a 401 `HttpError`:
  the 401 wrapping in Home's `doAuthenticate` (the core's
  `toAuthFailure`, over this SDK's default `[401]` vocabulary) exists
  for the Home API's OIDC/token-expiry flows, and Classic's own
  throttle refusal (`ErrorId` 6) rides the same success-status body.
- Wire-format types mirror the MELCloud APIs verbatim (PascalCase fields,
  one-letter report keys); do not rename them to satisfy style rules.
- `EffectiveFlags` bitfields: `src/facades/classic-flags.ts` is the one
  sanctioned home of hex magic numbers (files-scoped `no-magic-numbers`
  off); the two bitfield operators live behind documented inline
  `no-bitwise` disables at their use sites (`classic-update-devices.ts`
  flag test, `classic-base-device.ts` flag accumulation).
- `EffectiveFlags` is AUTHORITATIVE on the Classic set endpoints: the
  unit keeps the flagged fields and lets everything else in the body
  fall back to its previous value a few seconds later. **Judge a
  Classic write by re-reading the device seconds afterwards, never by
  the POST's response** — the response is written before the unit has
  settled and echoes the whole body it received. A probe on 2026-09-05
  read that echo and concluded the opposite ("flags decorative, omitted
  fields zero-filled"); 56.0.0 built a live-read-before-write path on
  that premise and 57.0.0 reverted it (owner's five years of field
  experience, 2026-09-08). `updateValues` therefore diffs the change set
  against the registry snapshot, computes the flags from that diff, and
  posts `{ ...setData, ...delta }` with no read of its own — the shape
  that had worked for years.
- Because the flags decide, the question is always WHICH FIELDS GET
  FLAGGED — and `updateValues` filters the caller's change set against
  the snapshot before computing them, so **the flag set is always a
  subset of the fields the caller named**. A stale snapshot cannot
  invent a flag for a field nobody asked about; it SUPPRESSES one. The
  caller asks for a value the stale snapshot already holds, the field
  is filtered out, `flags === 0`, `NoChangesError`, and the write never
  leaves — so the unit keeps the value the user was trying to change
  away from, and `#pushUpdate` in com.melcloud swallows that refusal
  without a warning. That silent no-op window is up to one sync
  interval wide (5 min default).
- A consequence of the same rule, standing since well before 56.0.0 and
  worth knowing before the next ATW fix: `prepareUpdateData` runs AFTER
  the flags are computed, so a field it adds on its own is carried
  unflagged and the unit therefore drops it.
  `ClassicDeviceAtwFacade.#coupleOperationModes` is exactly that shape —
  naming `OperationModeZone1` alone makes it adjust
  `OperationModeZone2`, which no flag covers. Clamping is unaffected: it
  only rewrites fields the caller named, which are already flagged.
  Fixing the coupling means flagging a field the caller did not request,
  so it needs its own verdict and a delayed re-read, not a quiet change.
- The write that DOES re-impose a field is one whose caller names it.
  A form prefilled from the snapshot and applied later is the shape to
  watch: if a sync moves the snapshot between the prefill and the
  apply, fields the user never touched now differ from it, get flagged,
  and are written back. `ClassicDeviceAtaFacade.updateGroupState`
  sends a whole form that way. That is the first hypothesis to test for
  the "vertical vane keeps resetting to Auto" report (2026-09-04) and
  com.melcloud #1408 ("cooling reverts to 24° every 10 min",
  2026-07-15) — measured by the delayed re-read above, never by the
  POST response. Home is unaffected: its PUT carries a real delta and
  has no flags (live-verified 2026-09-05: a vane write sticks across
  unrelated writes, mode changes and power cycles). The probe scripts
  were investigation artifacts kept out of the repo.
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
  on recent windows. The READ half of that dialect is library-owned
  since 55.2.0: `getEnergySeries` on both Home device facades resolves
  every value to ONE documented unit — kWh, the ATA watt-hours DIVIDED
  by 1000 (division, not `* 0.001`: it is the exact arithmetic and the
  one consumers ran themselves, so adoption is bit-identical) — and
  anchors each stamp as a UTC epoch-ms instant; a garbled sample
  degrades field-by-field to `null` (never `NaN`, never a throw) and
  keeps its entry, and the query's `interval` speaks the typed
  `HomeEnergyInterval` vocabulary. `getEnergy` stays wire-verbatim by
  decision — the escape hatch for consumers needing the raw
  `measureData` envelope — and consumers must never re-decode the
  dialect on top of it (timestamp format, interval grammar and
  per-type units all live behind `getEnergySeries` now).
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
- The Home wire speaks UTC wall-clock everywhere (live-probed
  2026-07-18: the freshest report sample equals "now" in UTC): report
  `x` samples, telemetry `time` values, and query windows alike.
  `HomeAPIConfig.timezone` only anchors chart label rendering and
  day/hour windows in the facades — never re-interpret wire values in
  a local zone.
- Home report semantics (comfort-graph / internaltemperatures /
  trendsummary): the BFF rounds the window down to full UTC days;
  datasets are irregular event-driven samples (each series has its own
  time grid — the facades resample with LOCF); `previousTriggers`
  carries the last pre-window sample per series (`value: null` with a
  `9999-12-31` sentinel when none) and seeds the resampler;
  comfort-graph annotations WITH a label
  (`REPORT.COMFORT_GRAPH.OVERLAY_KEY.<MODE>`, ATW only) are
  operation-mode bands — the same vocabulary as the Classic pie
  (`LEGIONELLA` ↔ `LegionellaPrevention`) — while annotations WITHOUT
  a label (internal-temperatures) mark missing-data ranges. Dataset
  `label` fields are i18n keys, useless for display.
- Classic reachability: the list `Offline` flag is garbage — live-probed
  2026-07-28, it flaps minute-to-minute on healthy units (9 of 13 alive
  devices flagged offline, membership changing between two runs one
  minute apart). The trustworthy signal is `LastTimeStamp` staleness,
  but it speaks building-local wall clock, not UTC (09:33 read at
  07:35 UTC in a UTC+2 building): worldwide skew reaches ±14 h, so only
  day-scale thresholds are safe. The device facades encapsulate this as
  the cross-dialect `isAvailable` contract (Classic: 24 h staleness;
  Home: the `/context` `isConnected` flag) — consumers must never map
  the raw `Offline` flag to anything (com.melcloud #1479/#1481).
- Classic `/EnergyCost/Report` returns per-bucket arrays for BOTH types
  (ATA per-mode consumption; ATW consumed + produced per category) with
  numeric `Labels`/`LabelType` — day-of-week labels are .NET 0-based
  (Sunday = 0) unlike the 1-based ISO labels of `Report/*`. ATA Home
  daily energy buckets are watt-hours and idle days are omitted
  entirely; ATW buckets are kWh.
- A `404` from Home's `/context` is not a failure: it is how the BFF
  answers an account that has no MELCloud Home home. The token was
  accepted (a rejected one answers `401`), so the session is valid and
  simply has nothing to describe — `isAuthenticated()` reads `true`,
  the registry stays empty, and no sign-in is attempted. Reading it as
  a stale session is what looped a real user's app for hours: reuse
  deemed failed → full sign-in → rejected at Cognito → 15-minute
  backoff → repeat (observed 2026-08-21).
- Secrets never travel inside a thrown error. `HttpError` redacts its
  whole snapshot at construction — request headers, BODY and query
  parameters, plus the response headers — because that object reaches
  every host logger and lands verbatim in the diagnostic reports users
  paste into issues; one leaked a live bearer token before the fix.
  The body matters as much as the header: Classic's
  `/Login/ClientLogin3` posts the account's password and email, so a
  header-only redaction (the first attempt, caught in review) still
  leaked the credential. Redaction sits in the constructor rather than
  at the logging sites so no future call site can reintroduce the
  leak; the sensitive-key vocabulary is the ONE bound `redaction`
  engine in `src/observability/context.ts`, seated into the core's
  call shells and log lines through `BaseAPI`'s super() options —
  never re-declared, never wrapped locally. The RESPONSE is redacted
  too, headers and body:
  an upstream echoes the credential it just rejected (a Classic 500
  returns `LoginData.ContextKey`, the OIDC token endpoint names the
  refresh token in its error text), which is why `response.data` is
  typed `unknown` — a failed body is a diagnostic payload, never a
  contract. Two rounds of review were needed to reach that: the first
  attempt redacted headers only, the second still left the response
  body raw. When adding a wire field that names a credential, extend
  the ONE vocabulary — `owneremail` is there because the Classic list
  payload carries the account address on every device of every
  successful sync, the single entry that blanks a routine 200.
- `FPDefined`/`HMDefined` are DECLARATIONS, not guarantees: MELCloud
  can refuse the zone-level read the flag promises (measured
  2026-08-26 — a shared building's zone-level `GetSettings` answers
  `401` on a valid session). The protection/holiday reads are
  therefore zone-first with a device-level fallback on failure
  whenever the flag is `true` or unknown — the original 2024 design; a
  2026-03 refactor silently gated the fallback on the flag being
  unknown and shipped five months of dead fallback under a comment
  claiming otherwise. The fallback is deliberately ONE-WAY: a `false`
  flag reads the device level only, because no device-level refusal
  has ever been observed and a zone answer for a building the flag
  excludes reads as "never configured" (`ok(null)`) — a wrong answer
  masking a real failure (review catch, 2026-08-28). All three
  clauses are kernel-pinned. Writes keep branching on the flag (the
  wire's own addressing).
- Two registry-sync hooks, and swapping them re-opens a shipped bug in
  either direction (54.0.0). `syncRegistry()` is the BEST-EFFORT hook:
  it logs and swallows, and only the non-destructive callers have it —
  the `tryReuseSession` probe and the middle rung of
  `ensureAuthenticated`. It must stay best-effort there because
  `initialize()` has no try/catch and both `create()` factories await
  it, so a propagating hook would turn a boot-time network blip into a
  REJECTED `create()`, over a persisted session that was merely
  unexercised. `enforceRegistrySync()` is the PROPAGATING hook and has
  exactly one caller: the enforced post-auth sync in `authenticate()`'s
  epilogue (`#finishLogin`). It must propagate because the enforced
  sync used to run through `fetch()`, whose catch-all logs and returns
  an empty list — so a registry failure resolved as a SUCCESSFUL
  sign-in over an empty registry, which consumers read as "this account
  has no devices". What `authenticate()` surfaces is the propagation
  WRAPPED: `RegistrySyncError`, the sync's own failure on `cause`, so
  consumers classify "signed in, stale list" BY TYPE instead of
  re-deriving it from `isAuthenticated()` (false positive: a transport
  blip during an account switch over a pre-existing live session). A
  refused credential never wears that type — it stays
  `AuthenticationError`; both halves are kernel-pinned on both legs.
  `resumeSession()` still never throws: it catches
  whatever the enforced sync propagated, so a registry failure never
  reaches a lifecycle caller. What it then REPORTS is the SIGN-IN
  ROUND-TRIP's verdict, not a re-reading of the session — an accepted
  sign-in whose enforced sync then failed is a resume (answering `false`
  there had `initialize()` emit a spurious `onAuthenticationLost` over
  credentials that had just worked), while a REFUSED sign-in is not,
  even when a live session predates the attempt and `isAuthenticated()`
  still reads `true`. Do not restate that as "judge by the session":
  54.0.0 collapsed the two shapes onto one `isAuthenticated()` reading
  and this file repeated the shorthand, which is exactly how a refused
  Classic sign-in came to be reported as a resume — handing the
  reactive-401 path the context key the server had just refused. Both
  sides of the hook split are kernel-pinned in
  `tests/contracts/session-lifecycle.test.ts`.
- The Classic `/User/ListDevices` boundary DROPS what it cannot model
  and must never do so silently. The drop exists because the REGISTRY
  sync is bulk — one call carries every device of the account — and the
  schema used to validate each entry's `Type` against a closed union
  INSIDE an atomic array, so one unmodelled device failed the whole
  payload; combined with the propagating hook above, that would have
  read as "cannot sign in at all" for every user owning a model newer
  than this release. The closed `Type` union therefore no longer lives
  in `ClassicBuildingListSchema` (its device entries are `z.unknown()`)
  but in `ClassicMinimalDeviceSchema`, applied per entry at the
  boundary. The predicate is the whole minimal
  header (`ClassicMinimalDeviceSchema`), not the `Type` alone — a null
  `DeviceName` or a non-numeric `AreaID` drops its entry too — so the
  two verdicts are reported apart (`unmodelled device type` = a model
  newer than this release; `malformed header` = a wire regression on a
  device already modelled) because they call for opposite responses.
  Reporting is ONE aggregated line per sync cycle naming every dropped
  id, never one line per entry: the listing carries every device of
  the account on every cycle, and a whole-payload regression is
  exactly when the diagnostic report must stay readable. A dropped
  entry that reaches the consumer unmentioned is the failure mode the
  line exists to end — com.melcloud degrades a pruned device to a
  warning over frozen values, so the report has to say which device
  went stale and why. `inspectClassicListingEntry` owns the verdict;
  `isModelledClassicDevice` stays its boolean face.
- Timestamp normalization is library-owned: `ErrorLogEntry.atEpochMs`
  (+ its `clearedAtEpochMs` twin),
  `AtwHotWaterState.lastLegionellaActivationEpochMs` and
  `HomeEnergySeriesPoint.atEpochMs` carry the epoch
  instant, each dialect anchoring its own wall-clock discipline at its
  boundary — Classic timestamps are building-local wall clock anchored
  in the client's configured timezone (host zone when unset), Home
  timestamps are UTC. The Classic instant is therefore exact only
  insofar as the configured timezone IS the building's: a building in
  another zone skews it by the zone delta (worldwide skew reaches
  ±14 h), so day-scale reasoning stays safe where sub-hour does not.
  Consumers never re-derive an epoch from the wall-clock `at`; the
  cannot-parse marker is `null`, never `NaN` (these instants cross
  JSON boundaries, where `JSON.stringify` silently rewrites `NaN` to
  `null`), an unparseable Classic `at` keeps its entry, and the
  legionella stamp's year-1 sentinel — any offset spelling, judged as
  UTC year <= 1 — reads `null`.
- Setpoint increments: both Home facades expose a derived
  `temperatureStep` (ATA from `hasHalfDegreeIncrements`, ATW from the
  FTC's own `temperatureIncrement` declaration — the direct field wins
  over a re-derivation from `hasHalfDegrees` whenever the wire states
  the step itself). What stays deliberately unexposed is Classic
  `CanSetTemperatureIncrementOverride`: a device PERMISSION, never a
  step declaration — reading it as a step would be wrong, and its
  absence from the public surface remains a verdict, not a gap.
- `resumeSession()` judges by the SIGN-IN ROUND-TRIP, never by the
  session — because two different failures both leave a live session
  standing, and only the round-trip separates them. An ACCEPTED
  sign-in whose enforced post-auth sync then threw IS a resume: the
  session was established, and answering `false` there had
  `initialize()` emit a spurious `onAuthenticationLost` over
  credentials that had just worked (the shape 54.0.0 was cut for). A
  REFUSED sign-in over a session that predates the attempt is not:
  nothing was refreshed, so a `true` hands the caller the credential
  the server has just rejected. 54.0.0 claimed BOTH shapes for the one
  `isAuthenticated()` reading and shipped the second wrong. They are
  distinguishable right there, with no heuristic: a counter bumped the
  instant `doAuthenticate` resolves, compared across the call. What a
  refusal must NOT do is clear — the verdict changes, the stored
  session does not.
- A refused stored credential is a RECORDED verdict, not a wiped
  session. Three sound verdicts used to compose into "a permanently
  dead Classic session is unreportable": Classic never wipes on a
  refusal, the refusal changes only the verdict, and every
  loss-surfacing path keyed on `isAuthenticated()` — which the
  surviving context key answers `true` forever, so after a server-side
  password change `onAuthenticationLost` could never fire.
  `#reportResumeFailure` therefore records a DEFINITIVE refusal
  (`#isCredentialRefused`; never a throttle — the pair may be valid,
  and prompting a re-log keeps the lockout alive — and never a
  transport blip), the next ACCEPTED sign-in lifts it, and the
  sync-cycle epilogue + `ensureAuthenticated` consult
  `isAuthenticated() && !refused` (the core's `isSessionServable()`,
  protected exactly so this repo's `ensureAuthenticated` reads the
  record instead of mirroring it — the record's writes stay the
  core's) so the loss surfaces once per episode through the existing
  machinery while the stored key deliberately stays. In-memory like the episode marker: a
  restart re-witnesses the refusal on its first gated sign-in, the
  persisted backoff keeping that sign-in honest. Kernel-pinned on both
  legs, throttle and transport negatives included.
- `resumeSession()` is single-flight (`#resumePromise`, the
  `ensureSession` memo one lifecycle layer up): concurrent paths — a
  background `initialize()`, the first request's `ensureSession`, a
  reactive 401 — share one sign-in round-trip, and every caller's
  verdict describes the shared attempt (N concurrent calls, one
  `doAuthenticate`, kernel-pinned). One deliberate asymmetry: a caller
  joining AFTER the shared sign-in was accepted, while the enforced
  registry sync still runs, reads the already-determined verdict
  WITHOUT awaiting the shared promise — the one real caller in that
  window is the reactive-401 path the enforced sync itself triggered
  (`reauthenticate` → `resumeSession`), and awaiting there would wait
  on its own caller. Do not "simplify" that branch into an await.
- The reactive-401 recovery is per-dialect, and Classic's asymmetry is
  deliberate. Home's `reauthenticate()` clears the persisted session
  first, because a BFF `401` IS its access token being refused.
  Classic's does not, because a Classic `401` does not name the
  session: the zone-level `GetSettings` refusal above answers `401`
  while the very same context key keeps serving `/User/ListDevices`,
  so clearing there would destroy a working session over one
  endpoint's authorization verdict. That leaves a rejected-but-live
  context key standing while the re-sign-in runs — which is exactly
  why the `resumeSession` verdict cannot be read off the session:
  while it was, `AuthRetryPolicy` spent its one guarded replay
  re-sending the key MELCloud had just refused, against an upstream
  that throttles. Both halves are kernel-pinned on both legs.
- `ensureAuthenticated()`'s middle rung calls `syncRegistry()`
  UNGUARDED, by decision — 54.0.0 dropped the `try`/`catch`,
  re-examined and upheld 2026-08-30. The hook's best-effort contract
  is the guarantee, and it is PINNED rather than merely documented:
  both shipped dialects reach it through `runBestEffortSyncCycle`, and
  the kernel's non-destructive-probe clause fails on BOTH legs the
  moment that swallow is removed. A defensive `catch` would also be
  uncoverable at 100 %: the only harness that can make the hook throw
  is `base-api.test.ts`'s synthetic subclass, whose `syncRegistry`
  mirrors the dialects on purpose, so covering the branch would mean
  making the harness lie about the contract it exists to mirror.

## Mechanism boundary (@olivierzal/api-core)

The API-client MECHANISMS live in `@olivierzal/api-core` (exact pin,
production dependency): the session lifecycle and the request pipeline
(`SessionAPI` — the session errors, `LoginCredentials` and the
`setting` decorator ride with it), the HTTP client and `HttpError`
(whole-snapshot redaction seated in the constructor), the redaction
engine, the observability shells and `LifecycleEmitter`, the resilience
primitives, `SyncManager`, the temporal entry point, the time units and
the `APIError` base — and, since 1.3.0, `ValidationError`, the
`syncDevices` decorator factory, the sign-in normalization
(`SessionAPI.toAuthFailure`) and the vitest-backed test helpers on the
core's `./testing` subpath. Those modules used to be heatzy-api's
byte-identical twins ("edit both or neither"); the 2026-08-21 leak —
the redaction fix took four days to cross to the twin — expired that
discipline, and the extraction replaced it. This repo keeps ONLY its
protocol layer: the sensitive-key VOCABULARY
(`src/observability/context.ts` builds the one bound `redaction`
engine; every seat — the `HttpClient` subclass, token-auth's direct
`HttpError`, and `BaseAPI`'s super() options, which carry it into the
core's own log lines and the `APICall*` shells the core constructs
itself — receives it), the wire types,
the schemas, the facades, and thin re-export modules that keep internal
import paths stable. A mechanism change happens in api-core and arrives
here as a release + exact-pin bump PR; never re-implement one locally.
The moved mechanism test suites live in api-core too — this repo's
`observability.test.ts`/`http-client.test.ts`/`base-api.test.ts` are
thin vocabulary/wiring suites pinning what is OURS: the key set, the
fact that the one bound engine carries it into the core's call shells,
and the `BaseAPI` wiring listed below. Re-testing core behavior in them would let coverage be
satisfied by the wrong suite.

`src/api/base.ts` crossed that boundary in 55.1.0: `BaseAPI` is a thin
layer over the core's `SessionAPI`, keeping only this repo's verdicts —
the zod/Result boundary (`requestData`/`safeRequest`/`classifyError`;
zod is refused entry to the core), the
`ensureAuthenticated` and `isRateLimited` surfaces (kept off the shared
class by decision; `ensureAuthenticated` reads the core's
`protected isSessionServable()`, never a local mirror of the refusal
record — the record's writes stay the core's alone), the transport
RESOLUTION, and the `[Classic]`/`[Home]` labels (the core's `logLabel`
option). The witness of the move was
`tests/contracts/session-lifecycle.test.ts`, a clause table run against
BOTH real dialect legs (never a synthetic `BaseAPI` subclass: a suite
whose hooks are `vi.fn`s proves the template calls its own hooks, not
that ClassicAPI and HomeAPI still behave the same after the move). It
crossed 55.1.0 byte-identical — a clause reworded during the move
would have proved nothing — and heatzy-api mirrors the same table on
its own dialect.

Byte-identity was the move's proof, not a standing constraint: the
move is complete, and the kernel is edited whenever a clause changes —
55.2.0 flipped the SyncManager label clause with the api-core 1.2.0
adoption (below). `src/api/base.ts` and `src/api/types.ts` stay on
their own merit, not to keep the kernel's imports resolvable: `base.ts`
holds the verdicts listed above, and `types.ts` holds this SDK's own
adapter and configuration interfaces (`BaseAPIAdapter`,
`BaseAPIConfig`, `BaseAPISettings`, `TransportConfig`) plus the
`SyncParams` instantiation of the core's lifecycle generics, and
re-exports seven core types (`Logger`, `SettingManager`, the request
lifecycle context and its four events) under this SDK's names —
neither file is a shim. The kernel also holds the seams the extraction was most
likely to blunt, which remain live constraints. The transport-resolution gate
must keep binding THIS repo's `HttpClient`: bound to the core class
instead, a bare core client would newly be ADOPTED rather than
re-wrapped, shipping a transport with no MELCloud redaction
vocabulary. The same leak class exists one seam over, at the core's
own serialization of the dispatch/error log lines and the
transient-retry URL: `BaseAPI`'s super() options must keep passing the
bound `redaction` engine, pinned by `base-api.test.ts`'s wiring
clauses, which fail on a key the base vocabulary does not know. And
`SyncManager` is a labelled seat like every other since api-core
1.2.0 (adopted with 55.2.0): the extraction crossed it on the RAW
host logger — a latent bug pinned AS IT WAS, its fix deferred "after
both adoptions land" — and once both adoptions landed (2026-09-04)
the deferral expired and the fix arrived exactly as prescribed, an
api-core release plus this repo's pin bump, never a local
re-implementation. A rejected auto-sync tick now names its dialect
(`[Classic]`/`[Home]` on `Auto-sync failed:`), and the kernel clause
that pinned the asymmetry flipped with the adoption and pins the
labelled line.

api-core 1.3.0 (adopted with 56.0.0) crossed three more twins and one
test seat, every one additive on the core's side:

- `ValidationError` is the core's, re-exported like `RegistrySyncError`
  (`src/errors/validation.ts`). The class imports nothing from zod, so
  the zod coupling that keeps `parseOrThrow` here — the constructor of
  every `ValidationError` this SDK throws — never applied to it. Local
  class-level clauses moved out with it; the core pins them.
- `syncDevices` is the core's decorator factory, re-exported
  (`src/decorators/sync-devices.ts`), generic over this SDK's
  `SyncParams`; the four call sites (`@syncDevices()`,
  `@syncDevices({ type })`) are unchanged. One delta inside the SDK: a
  bare `@syncDevices()` forwards `undefined` where the local copy
  forwarded `{ type: undefined }` — a clause asserting the latter is
  the adoption's to reword, never a reason to wrap the core's.
- The sign-in normalization is the core's protected
  `toAuthFailure(error, message)`, which narrows an `HttpError` whose
  status is in the `authFailureStatuses` vocabulary this instance was
  built with (the default `[401]`; the auth-retry rung already owned
  it) into `AuthenticationError` with the original as `cause`, `null`
  otherwise. `normalizeUnauthorized` is gone; Home's `doAuthenticate`
  binds in TWO statements — `const authError = this.toAuthFailure(…)`,
  then `if (authError !== null) throw authError`, then a bare
  `throw error` — never `throw this.toAuthFailure(…) ?? error`: the
  family's `only-throw-error` admits a catch variable rethrown bare
  and refuses the `??` expression (typed `unknown`), and no disable is
  added for it (probed under this repo's own overlay, 2026-09-07: one
  error on the one-liner, clean on the two-statement form).
  `base-api.test.ts` lost its table (the core pins the helper;
  `home-api.test.ts` pins the binding).
- `tests/helpers.ts` keeps only what is OURS — `okValue`,
  `matchObject`, `mockResponse` (the `Result` type and the vitest
  matcher/envelope shapes this suite asserts on). Everything the three
  SDK suites carried as a hand-maintained twin comes from
  `@olivierzal/api-core/testing`: `cast`, `defined`, `mock`,
  `createLogger`, `createSettingStore`,
  `createMockHttpClient(HttpClient, baseURL)` — THIS repo's transport
  class first, so the spy-wrapped client is the redaction-seating one
  the resolver accepts —, `mockFetchResponse` (nulls the body on 204,
  205 and 304), the `HttpError` factories and the `Temporal` clock
  spies (`mockTemporalNowInstant`/`mockTemporalNowZoned`, the Node 26
  native-Temporal fake-timer trap — exactly the fix that had to reach
  every copy). The subpath imports `vitest` from this repo's
  devDependencies and declares none: keep `vitest` a devDependency
  here (a missing one fails loudly at the import, in a dev context,
  never on the device), and never re-export the subpath. The suite
  blocks that re-ran the core's own clauses against re-exported
  symbols went with the helpers: `errors.test.ts` and
  `type-helpers.test.ts` keep only clauses naming SDK classes or
  pinning the wiring (an SDK error extends the core's base and passes
  the family guard; a re-exported class IS the core's — a local twin
  would break `instanceof` across the seam), `decorators.test.ts`
  keeps the stacking order and the `{ type }` vocabulary riding
  through `syncDevices`, not the decorator's own clauses.

## Tooling boundary (@olivierzal/configs)

The shared tooling lives in `@olivierzal/configs` (exact pin): the
eslint `library` preset (plugins are the package's dependencies — no
plugin devDeps here), the prettier config (`"prettier"` key in
package.json, no local file), the `tsconfig/library` base, `typedocBase`
and the vitest fragments — `swcPlugin` and `coverageDefaults` (the
`text`/`lcov` reporters and the four 100 % thresholds, spread into the
coverage block since configs 4.5.0). The overlays keep ONLY per-repo
verdicts, and this ledger names every one of them — re-count it
whenever an overlay changes:

- `eslint.config.ts`: the ignores (`coverage/`, `dist/`, `docs/`,
  `scripts/`); three `wireNamingEntries` — the `__brand` phantom, the
  PascalCase/UPPER_CASE wire fields, the snake_case OAuth/Home/Homey
  vocabularies; `wireNamingFiles`, the ten globs of the layers that
  speak to MELCloud (the strict core applies to the rest); the
  `classic-flags.ts` no-magic-numbers ledger; `webviewFloorBlock` over
  the ten-module browser-reachable closure; and the
  `require-unicode-regexp` `u` pin over all of `src` (the last two are
  argued under Lint doctrine below).
- `vitest.config.ts`: the decorator transform pairing (`oxc: false` +
  `plugins: [swcPlugin]`, the shape the configs README prescribes),
  `clearMocks`, the coverage `include` (`src/**/*.ts`) and the test
  `include` (`tests/**/*.test.ts`).
- `tsconfig.json` `outDir`/`include`; `tsconfig.build.json`
  `outDir`/`rootDir`/`include`.
- `typedoc.config.js`: the identity (name, links, `hostedBaseUrl`,
  `categoryOrder`, `intentionallyNotExported`) and the
  `externalSymbolLinkMappings` pointing core symbols at the api-core
  docs site.

Do not re-declare family policy locally — a rule evaluation or version
bump happens in configs, adoption is a reviewed pin bump.
`tsconfig.json` and `tsconfig.build.json` both extend the plain
`tsconfig/library` base and keep only the path-bearing keys local
(`outDir`/`include`, plus `rootDir` on the build side): a base carrying
paths would resolve them against `node_modules`. The `-build` alias
bases configs used to ship were content-free `{ extends }` shells of
the plain ones and left with configs 5.0.0 — nothing here ever
extended them.
Eleven workflows are stubs calling the family reusables in
OlivierZal/configs, pinned `@<sha> # vX.Y.Z`: `ci`, `claude`,
`claude-code-review`, `claude-dependabot-fix`, `claude-issue-triage`,
`dependabot`, `dependency-review`, `pr-title`, `zizmor` (the home-made
`audit` workflow is gone — `dependency-review` replaced it with configs
3.1.0, 2026-08-10) and, since configs 5.0.0, `docs` and `publish` over
`reusable-docs.yml` / `reusable-publish.yml`. The caller keeps the
`release` trigger and the grants the called jobs need (docs: contents
read, id-token write, packages read, pages write; publish:
attestations write, contents read, id-token write, packages write —
the `github-pages` and `npm` environments travel inside the
reusables), and `docs` keeps a `workflow_dispatch` with a boolean
`dry-run` input: the one rehearsal a release-only path gets, it runs
the build half on the reusable and skips the deploy — dispatch it once
after each configs adoption, before any release. The composite action
`.github/actions/setup-node-and-install` stays local because the called
jobs run the CALLER's copy (the reusables reference `./`), and it
passes `npm-token` on both installs (the configs dependency lives on
GitHub Packages, where even reads need auth). The zizmor
`use-trusted-publishing` ignore that excused the local publish step
left with the step — the reusable's ignore lives in configs.
`.nvmrc` is the INSTALL floor, derived in configs from the tree it
imposes on every consumer (22.22.2 today, from
`eslint-plugin-package-json`'s `^22.22.2 || >=24.15.0`); it is not
`engines`, which stays at the device floor (22.20 — what the code
needs where it runs). It moves with a configs adoption that re-derives
it, never by hand.

## Lint doctrine

- Shipped regexes stay on the `u` flag, and the reason outlives the
  firmware gap that first surfaced it: the consuming apps bundle this
  package into their PHONE WEBVIEWS. `/constants` and `/protection`
  are imported for values, not types, and esbuild inlines them —
  `coolingMin:16` sits in com.melcloud's shipped widget bundle — so
  every `src` module is a candidate for the worst webview engine the
  Homey mobile app admits: iOS 16.4's WebKit (its App Store minimum,
  read 2026-08-11), which predates the `v` flag. Under the apps'
  sub-es2024 esbuild target an escaped `v` literal ships as a
  `new RegExp` call and throws at runtime inside the feature that
  runs it — the parse-time crash of incident 45.x was this library's
  tsc output on device Node, a different path. No Homey update lifts
  that floor; the App Store minimum reaching 17.4 re-opens es2024.
  Scoping the rule to the reachable subset would drift with every
  import change, so the overlay pins `require-unicode-regexp` to `u`
  across all of `src`. The FULL es2023 floor (`webviewFloorBlock` —
  no `Object.groupBy`/`Map.groupBy`, no iterator helpers) applies on
  top of that to the browser-reachable closure alone: the flat subpath
  modules plus their value-import closure, held against drift by
  `tests/unit/webview-floor.test.ts`, which recomputes the closure and
  fails in both directions. Node-only layers (facades, entities, HTTP,
  observability) keep the modern-API freedom the device Node allows.

- Code adapts to the rules, never the reverse. Never add a disable — not
  inline, not through config options or ignore regexes: refactor until the
  rule passes (rename the binding, drop the unused parameter, restructure
  the seam). Existing disables are debt: remove them when touching the
  code they guard, never replicate them.
- The only tolerated exceptions are protocol- or rule-pair-imposed, each
  documented with a `-- reason`: bitfield operators, branded-type and
  parse-boundary casts, wire-imposed single-letter keys, namespace
  merging over type-only packages, and synchronous mocks of async
  contracts
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
- All-type exports hoist the keyword (`export type { A, B }`); mixed
  exports keep inline `type` specifiers, mirroring the
  inline-type-imports style. No shipped rule enforces the export side
  (`consistent-type-exports` tolerates inline specifiers once present;
  `import-x/consistent-type-specifier-style` covers imports only): the
  convention is maintained by hand, in review — a bespoke
  `no-restricted-syntax` selector for it was removed by decision
  (2026-07-28).
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
- Every FLAT module the root barrel re-exports earns its own subpath in
  the `exports` map, and `tests/unit/export-map.test.ts` holds that 1:1.
  The barrel reaches the HTTP stack, so a browser bundler resolving a
  VALUE through it fails on `undici`'s `node:` builtins (measured: 118
  errors); a consumer that cannot reach a published symbol copies it
  instead, which is the drift these subpaths exist to prevent — and the
  copy surfaces only later, at the cost of a release plus an adoption
  round everywhere, which is what the missing `/protection` cost. A
  subpath does NOT widen the API: the barrel already exports those
  symbols, so it only restores reach where the barrel cannot load. The
  criterion is the EMITTED closure, not the absence of edges —
  `/temperature-range` reaches `utils` yet bundles to 2 052 B because
  esbuild shakes out what no export touches. What forecloses a subpath
  is reaching the HTTP stack, never importing a sibling. Directory
  barrels (`errors/`, `types/`, `http/`…) are exempt by verdict, not by
  oversight: they are grouped surfaces rather than leaves, and none has
  been needed from a browser — the test pins their set so a new one
  forces that decision. `./package.json` is published too: an `exports`
  map otherwise hides the manifest from the tooling that reads it.
- The four SDK-internal decorators (`classicUpdateDevice`,
  `classicUpdateDevices`, `fetchDevices`, `syncDevices`) are NOT
  public since 56.0.0, by verdict: they bind to SDK internals
  (`classicUpdateDevices` takes `this: ClassicZoneFacade`,
  `fetchDevices` resolves a host over `ClassicAPIAdapter`), no repo in
  the family ever applied one, and typedoc already hid their option
  types (`UpdatePatchKind`) as wiring consumers never call.
  `src/decorators/index.ts` stays the internal barrel; the root and
  namespace barrels no longer re-export it, `export-map.test.ts` no
  longer exempts it, and there is no `Decorators` docs category.
  heatzy-api's twin export (`setting`/`syncDevices`/`updateDevice`)
  crosses in the same wave — the removal had to cross both twins at
  once.
- Tests import vitest APIs explicitly (no globals) and use `it` inside
  `describe`, `.each` for tables, `describe(fn)` function titles.
  Boolean names take a semantic prefix (`is`, `has`, `should`…); `device`
  is the one sanctioned exception (its `false` is a sentinel, not a flag).

## Repo process

- Companion docs are part of a change's definition of done: whenever a
  PR changes behavior, API surface, requirements or process, the same
  PR updates the affected companion files (README.md, CONTRIBUTING.md,
  SECURITY.md, CLAUDE.md) — never a later sweep; the 2026-08 README
  audit caught exactly the drift this prevents (a shipped Home ATW
  driver absent from its README, a stale `Result` kind list).

- The PR title IS the commit that lands: `squash_merge_commit_title` is
  `PR_TITLE`, so the title is the single source (under the former
  `COMMIT_OR_PR_TITLE`, a one-commit PR silently took its commit subject
  instead). It must follow Conventional Commits, which the required
  `PR title` check enforces (`.github/workflows/pr-title.yml`,
  byte-identical in the SEVEN repos that call the family reusables —
  every repo but `configs`, which hosts them and whose own copy
  differs; md5-verified 2026-08-30, the count having gone stale at five
  when `api-core` joined) — default type set, no scope
  allowlist, and no `subjectPattern`: subjects legitimately open on a
  proper noun. Dependabot's prefixes are pinned to `build(deps)` /
  `build(deps-dev)` rather than inferred, which is what had this repo
  land `Build(deps): Bump …` where the apps landed lowercase.
  The **subject** casing stays inferred and cannot be pinned:
  `commit-message` accepts only `prefix`, `prefix-development` and
  `include`, so Dependabot keeps matching each repo's own history
  (`Bump undici` in one, `bump temporal-polyfill` in another). Left
  alone by decision (2026-08): a Dependabot commit subject is not a
  contract, the PR title is — and the `PR title` check already holds
  that one.
- After every push, monitor the triggered pipelines to completion — the
  PR checks after a push, the publish run after a release — and act on
  the outcome: rerun transient infra failures (a SonarCloud 504 is not
  a finding), fix real ones. Work is not done while its pipeline is red
  or unwatched.
- Every review thread (Copilot or human) must end RESOLVED: with a code
  change when the point holds, or with a reasoned reply when it does
  not — verify claims against sources before acting either way. Resolve
  the thread once settled; none left dangling.
- Auto-merge is never armed on an authored PR (verdict 2026-09-07:
  api-core#12 had it armed and merged 13 s before Copilot's review
  landed, leaving two threads on a merged PR, one of them real). A PR is
  merged by hand, on its FINAL head, once three things hold at once:
  every check is SUCCESS or SKIPPED, the Sonar PR window is at zero open
  issues with the gate OK, and every review thread is settled. The
  Dependabot lane (`.github/workflows/dependabot.yml` arming
  `gh pr merge --auto` once CI passes) is the one deliberate exception
  and stays as documented.
- SonarCloud must be spotless for a PR to merge — and the quality gate
  passing is necessary, NOT sufficient: the free-tier gate tolerates
  3 % duplication on new code, lets code smells through, and cannot be
  customized, so the real bar is ours, held in review. That bar is
  zero on BOTH windows — new code and overall alike: zero open issues
  of every kind (bugs, code smells, vulnerabilities) across the whole
  project, 0 % duplicated lines across the whole codebase, and 100 %
  coverage (within the exclusions `sonar-project.properties`
  declares). A Sonar finding is handled like a lint error — the code
  adapts (duplication refactors into a shared module), or the
  divergence is settled as a documented verdict — never merged over.
- GitHub merge queue is impossible here: the feature is gated on
  ORGANISATION ownership and this repo is user-owned (verified 2026-08
  against the docs source). The workflows therefore declare no
  `merge_group` trigger — an event that cannot fire needs no handling,
  and "inert but harmless" is not a reason to keep configuration.
  Dependabot PRs auto-merge via `gh pr merge --auto`.
- The docs site deploys only on release or `gh workflow run docs.yml`;
  `gh workflow run docs.yml -f dry-run=true` builds it on the reusable
  without deploying (the rehearsal to run once after each configs
  adoption).
- CI: `Test (Node latest)` is `continue-on-error` by design — keep it out
  of required status checks. Sonar coverage runs on the `22` leg only.

## Releasing

- Publishing is not done until the consumer adopts: com.melcloud pins this
  library EXACTLY (no caret — a `^` is what silently held a published
  auth fix back for six days, 2026-08). Every release therefore ends
  with an adoption PR in com.melcloud bumping the exact pin; nothing reaches
  users otherwise.
- `SECURITY.md` names no version numbers by design ("only the latest
  published release") — nothing to bump there on release, and nothing
  that can drift.

- Publishing is release-triggered (`publish.yml`, a stub over configs'
  `reusable-publish.yml` since 5.0.0): a **published GitHub Release**
  packs the tarball, attests its provenance and publishes it to GitHub
  Packages. A
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
