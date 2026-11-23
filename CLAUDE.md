# CLAUDE.md

Typed Node.js client for the MELCloud (Classic) and MELCloud Home APIs.
ESM only, Node >= 22.20, published to GitHub Packages. `erasableSyntaxOnly`
is on: no runtime enums, no parameter properties, no runtime namespaces.

The README speaks to the package's USER: what it gives, how to install
it and how to use it, with examples that compile. It never explains how
the package is built or why (owner's rule, 2026-11-22): the architecture
and the full surface are the generated reference's, the doctrine and its
reasons are this file's, the workflow is CONTRIBUTING.md's.

## Commands

- `npm run lint` / `npm run lint:fix` — ESLint (runs with an 8 GB heap).
- `npm test` / `npm run test:coverage` — vitest; coverage must stay at 100%.
- `npm run typecheck` — the native TypeScript 7 compiler, reached by its
  explicit path `node ./node_modules/@typescript/native/bin/tsc`; covers
  `src`, `tests` and the `*.config.ts` files (tsconfig `include`) — only
  `typedoc.config.js` stays outside it (JSDoc-typed under `@ts-check`;
  the lint still covers it). Official 6/7 side-by-side layout: the
  `typescript` name aliases `@typescript/typescript6` (the TS6 JS API)
  for the tools that import it (typedoc, typescript-eslint), while
  `@typescript/native` is the native 7.x compiler running typecheck and
  build — until TS 7.1 ships its programmatic API. Never shorten the
  path. Not because a bare `tsc` runs the wrong compiler today:
  re-measured 2026-11-22, in this tree and in fresh installs under npm
  10.9.8 and 11.20.0, `.bin/tsc` is the native 7.x compiler and `tsc6`
  the only shim of the TypeScript 6 compat package (it was the other way
  round when the layout was adopted, in August 2026). Two installed
  packages declare a `tsc` bin, `@typescript/native` and
  `@typescript/old` (the TypeScript 6 the compat package depends on),
  and npm gives the shim to one of them: the explicit path names the
  package the script means, so a layout change fails loudly instead of
  swapping the compiler behind the shim.
- `npm run build` — purges `dist` before emitting, because `tsc` overwrites
  but never deletes: a module renamed or removed in `src` would otherwise
  survive in `dist`, and `files` ships that directory, so `prepare` would
  pack the fossil. The purge is inline rather than a `prebuild` hook so it
  cannot be skipped with `--ignore-scripts`.
- `npm run format` / `npm run format:fix` — prettier.
- `npm run docs` — typedoc. The config is `typedoc.config.js` (JSDoc-typed
  with `@ts-check`: typedoc cannot load `.ts` configs and silently ignores
  them); validation warnings fail the build. A symbol forwarded from the
  core renders under the core's own comment, so a `{@link}` in it that
  names a symbol this package does not export fails the gate here, and
  nothing local can patch it: `externalSymbolLinkMappings` is consulted
  only for TypeScript-resolved or `{@link !name}` references, and a JSDoc
  block on the export specifier is read only when the symbol has no
  comment of its own — the comment is fixed in api-core (2.3.1 did, for
  `failureCauseChain`), never worked around here. The core is NOT
  external to this reference (`externalPattern` leaves `@olivierzal`
  out, 62.2.0): the theme hides an external package's members until its
  reader ticks "External", and under the default pattern that hid, on a
  first visit, eleven of the members of each client (`authenticate`,
  `logOut`, `dispose`, `setSyncInterval`…) and every member of the
  interfaces forwarded from the core (measured 2026-11-23: 514 hidden
  members, 423 after, what is left being `Error`'s own and Temporal's).
  `LifecycleEvents` is an alias of the core's generic, which typedoc
  renders as a name and no more: TypeDoc's `@interface` tag makes it
  render the seven callbacks. `jsdoc/check-tag-names` reads that tag as
  JSDoc's (redundant in TypeScript) and has no exemption for it, hence
  the described disable around that one block.

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
  That covers VALUES as much as keys, and a rename of this SDK's own
  names must never reach a string the wire reads: the 30.0.0 rename
  that prefixed every Classic export (2026-04-16) also prefixed the
  three zone literals of `ClassicSettingsParams['tableName']`, and for
  seven months every zone-level frost-protection and holiday-mode read
  asked MELCloud for `ClassicBuilding`, `ClassicFloor` or `ClassicArea`,
  tables it does not have (restored in 61.0.0; found by reading the
  rename's diff, the tests having been renamed with the code). A test
  that pins a wire value says so (`settings-table-names.test.ts`), and
  a rename's diff is read for string literals before it lands.
- `EffectiveFlags` bitfields: `src/facades/classic-flags.ts` is the one
  sanctioned home of hex magic numbers (files-scoped `no-magic-numbers`
  off); the two bitfield operators live in one module, `src/facades/classic-flag-bits.ts` (`combineFlags`, `hasFlag`), behind the family's two documented `no-bitwise` disables; their call sites (the `classic-update-devices.ts` flag test, the `classic-base-device.ts` flag accumulation, one facade test) name the operation instead of spelling it (2026-10-15).
- `EffectiveFlags` is AUTHORITATIVE on the Classic set endpoints: the
  unit keeps the flagged fields and lets everything else in the body
  fall back to its previous value. So the POST's answer SUFFICES, read
  through its flags: the fields its `EffectiveFlags` mark are what the
  registry model takes (`convertToListDeviceData`), and the rest of the
  answer, the body echoed back, is ignored. **No read confirms a write,
  before it or after it** (the owner's rule, from five years of field
  experience, 2026-09-08, restated 2026-11-23). A read there spends a
  request to learn the value just sent: measured 2026-11-23, the listing
  answers the WRITTEN value until the unit has communicated (an off-grid
  18.4 stayed listed for 8 min 18 s before the previous 18 came back),
  and a host taking that for the unit's state would be wrong for
  minutes. What the unit made of a write shows in the regular sync, in
  its own time. That is also what the half-degree grid protects (below):
  for a setpoint the unit will not hold, the flagged answer itself said
  what the unit never took. A probe on 2026-09-05 read the UNFLAGGED
  echo and concluded the opposite ("flags decorative, omitted fields
  zero-filled"); 56.0.0 built a live read around every write on that
  premise and 57.0.0 reverted it. `updateValues` therefore diffs the
  change set against the registry snapshot, computes the flags from that
  diff, and posts `{ ...setData, ...delta }` with no read of its own,
  the shape that had worked for years. Three writes reach a unit and all
  three are ONE POST: a device write (the model takes the answer's
  flagged fields), a power write and a group write (MELCloud only
  acknowledges them, so the member models take what was sent).
  `tests/contracts/classic-write-wire.test.ts` pins both halves where
  they matter, on the transport. One: each of the three is one request
  (an air-to-water unit's route included), a write that changes nothing
  none at all, and nothing leaves in the ten minutes that follow, so a
  read added by any route (a decorator, a helper, a new adapter call, a
  timer that waits for the unit to settle) fails the suite. Two: the
  answer IS read, through its flags — staged with another setpoint than
  the one sent and another fan speed than the unit's, under the
  setpoint's flag alone, the model takes that setpoint and keeps its
  fan speed; after a group or a power write the members hold what was
  sent. An INVESTIGATION that needs the unit's verdict on a write waits
  until `LastTimeStamp` has moved (seconds when MELCloud reads the unit
  online, up to its ten-minute cadence otherwise) and reads then: a
  probe's method, never the product's. What stands OUTSIDE the rule,
  read in the code on 2026-11-23 and stated so that nobody takes it for
  a regression nor copies it onto a unit write:
  - Frost protection and holiday mode are settings of a building, with
    neither state nor flags in their answer: they re-read the listing
    AFTER their POST (`@fetchDevices({ when: 'after' })`), and a facade
    that does not know yet at which level the setting lives reads it
    BEFORE the POST (`/FrostProtection/GetSettings`,
    `/HolidayMode/GetSettings`, once per facade).
  - The session layer is the core's and serves every request alike. A
    write that meets a session due for renewal is preceded by the
    sign-in and the listing every sign-in enforces; a write answered
    401 is followed by a sign-in, that listing, then ONE replay of the
    POST. In both the listing lands before the POST's answer, so the
    model still ends on that answer's flagged fields.
  - The periodic listing is never brought forward by a write: the core
    parks it for the write and three seconds more, and it then comes at
    its own time, the regular sync being how a unit's verdict shows.
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
- A field a per-type rule DERIVES must be flagged like the ones the
  caller named, or the unit drops it. `deriveUpdateData` therefore runs
  BEFORE `#computeFlags`, and `prepareUpdateData` only assembles the
  body afterwards. `ClassicDeviceAtwFacade` couples the companion zone
  there — the rule the official MELCloud app imposes, so it is ours to
  enforce too — and until 57.1.0 it ran after the flags, which meant it
  held only when the caller named both zones and silently failed in the
  one-zone case it was written for. The ATA setpoint rule is not a
  derivation at all: it reads what the caller asked, before the filter
  (`normalizeUpdateData`, in the half-degree bullet below).
- The snapshot is the write's BODY, so only a sync may write it. A
  group READ (`/Group/Get`) answers MELCloud's state for the GROUP, not
  what each member reports; until 59.2.1 `getGroup()` patched every
  ATA member with it, mirroring the write decorator's propagation for
  a read, and a member in Cool whose zone read Auto carried
  `OperationMode: Auto` — unflagged, then echoed back into the
  registry by the write's own decorator — on its next temperature
  write. The widget calls that read on load and on every real-time
  update, so the wrong snapshot was the normal state while a dashboard
  showed it — consistent with the field report of 2026-09-24
  ("repeatedly changes the operating mode from Cool back to Auto", no
  Flow involved), unconfirmed against its log: a displayed Auto is
  explained with certainty, a real mode change only if MELCloud applies
  the unflagged fields of a body. Only the registry sync and a write's
  own echo may update a device model.
- A `Result`-returning method never wears `@syncDevices()`: the
  decorator fires once the method has resolved, and a `Result` resolves
  on a failure too. `BaseDeviceFacade.getValues` announced a sync after
  a failed read until 62.0.2 (reproduced by a test before the fix); it
  notifies inline now, after the model update. The registry cycle holds
  the same rule from the other side, by throwing: a failed refresh
  never announces a completed sync, or a host would rewrite stale
  values as if they were fresh.
- The write that DOES re-impose a field is one whose caller names it.
  A form prefilled from the snapshot and applied later is the shape to
  watch: if a sync moves the snapshot between the prefill and the
  apply, fields the user never touched now differ from it, get flagged,
  and are written back. `ClassicDeviceAtaFacade.updateGroupState`
  sends a whole form that way. That is the first hypothesis to test for
  the "vertical vane keeps resetting to Auto" report (2026-09-04) and
  com.melcloud #1408 ("cooling reverts to 24° every 10 min",
  2026-07-15) — measured by a probe that reads once the unit has
  communicated (above), never by the unflagged echo of a POST. Home is
  unaffected: its PUT carries a real delta and
  has no flags (live-verified 2026-09-05: a vane write sticks across
  unrelated writes, mode changes and power cycles). The probe scripts
  were investigation artifacts kept out of the repo.
- Combining ATA groups is the SDK's, deciding which groups belong
  together is the host's (60.8.0). `combineAtaGroups` takes any
  `AtaGroup` — the Classic zone facades, both dialects' ATA device
  facades, the Home building facade — and answers the same contract:
  com.melcloud's merged building, a Classic building and a Home
  building of one name, is the use it was cut for, and it knows no
  name. Its read FAILS CLOSED: the groups are read at once and the first
  failed `Result` in group order comes back unchanged, never a fold of
  the groups that answered — half a house shown as the whole is a wrong
  answer, not a degraded one. Otherwise it folds through
  `aggregateClassicAtaGroupStates`, the Home building's own member
  fold, which carries six fields: the Classic wire's swing flags
  (`VaneHorizontalSwing`, `VaneVerticalSwing`) never reach a combined
  read, and no family consumer reads them. A write sends the same delta
  to every group at once, tolerates each group's `NoChangesError` (a
  Classic zone refuses an empty delta with it) and settles through the
  policy the Home building's member writes use
  (`src/facades/settle-writes.ts`): one failure rethrown as itself,
  several as one `AggregateError` in group order. There is no rollback —
  a group that accepted the delta keeps it when another refuses, so a
  rejected combined write may have landed in part.
- The settings follow the same rule (62.1.0): `combineSettingsTargets`
  takes any `SettingsTarget`, the frost-protection and holiday-mode
  contract every Classic facade, both dialects' device facades and the
  Home building facade answer, and returns one. Same read policy, in a
  module of its own now (`src/facades/settle-reads.ts`, which
  `combineAtaGroups` shares): at once, fail closed, and a read that
  THROWS where a failed one answers a `Result` (a Classic facade that
  covers no device, a Home unit gone from the registry) rejects the
  combined read at once, whatever its place. Same write policy:
  every target at once, no rollback. The fold is the Home building's own
  (`aggregateProtectionStates`, `aggregateHolidayModeStates`), which
  takes a fold among its members since then: a field one target already
  reads as mixed stays mixed, where the member fold would have read its
  `null` as off and answered a house that is off everywhere. What a
  Classic building answers is still a SAMPLE of its units when its
  settings live at device level (the settings-levels entry below): the
  combination folds answers, it does not deepen them. Overheat
  protection is outside the contract, Home alone having it: a host
  addresses the Home building for it. And a holiday window reaches each
  wire on that wire's clock, the two writes being each dialect's own.
- Home has no client-side no-change check. `updateValues` refuses only
  a payload with no defined value (`NoChangesError`), never one the
  unit already holds, so a Home group write PUTs every ATA member — and
  pays the `/context` sync that follows each PUT — even when the member
  already matches; the `NoChangesError` tolerance of the Home group
  writes only ever meets a delta whose every field failed to translate.
  Classic is the opposite: `updateValues` diffs against the snapshot and
  refuses a change set the unit already holds before any wire call.
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
- Home telemetry: `/telemetry/telemetry/actual/{id}` validates
  `measure` (unknown → 400, so the vocabulary is enumerable; only
  `rssi` and `power` — the on/off boolean history — exist; live-probed
  2026-07-17 on a guest account — guests DO get telemetry).
  `/telemetry/telemetry/energy/{id}` did not then and does now: probed
  on an air-to-water unit on 2026-11-21, every measure name answers
  `400` with an empty body — the two interval measures the SDK read
  until 61.0.0 (`interval_energy_consumed`, `interval_energy_produced`),
  a made-up one, none at all — except the air-to-air one,
  `cumulative_energy_consumed_since_last_upload`, which answers `200`
  with no point, indistinguishable from an idle window on a unit that
  is not idle. Never conclude "no data" from an empty payload without
  re-checking the measure name against a known-good one.
- The energy telemetry was narrowed on 2026-11-20 around noon UTC
  (com.melcloud's last read that passed on the owner's Homey is of
  11:08, the first that failed of 12:08). What it serves an air-to-air
  unit since, live-probed 2026-11-21: `interval` is `Hour` or `Day`,
  and `Minute`, `Week` and `Month` answer `400` whatever the window,
  the casing or the date format, where the grammar was a
  case-insensitive .NET enum of the five (anything else → 500,
  missing → 400; the `PT1H` ISO style never worked). Buckets are UTC
  hours and UTC days, sparse (only active periods return points), and
  the hour in progress is answered, moving in the counter's 100 Wh
  steps.
  `to` is NOT APPLIED: a response runs from `from` for a span of its
  own, or to now. At `Hour` the span is 24 buckets: a one-hour and a
  three-hour window, a day old, each came back with the 24 buckets
  that follow their `from`, and a 30-hour window with those 24 and no
  more. At `Day` it is 31 days: a 30-day window answered the 31st day
  too (charted double before it was caught), a month came back whole,
  and three months empty for a unit active on its last three days. A
  `from` inside a bucket does not answer that bucket whole: at 03:30
  and at 03:59 the 03:00 bucket was not answered at all, while a read
  from 06:38 did carry a 06:00 one. `fetchAtaEnergy`
  (`src/facades/home-energy.ts`) owns all of it: chunks of 24 hours or
  30 days counted on the UTC clock from a bucket boundary, a bucket
  answered twice kept once, and the hour buckets cut back to the
  window they were asked for. It sends `to` on the next bucket
  boundary all the same: the wire applied `to` before it was narrowed,
  and should it again, a bound cut to the minute would leave out the
  bucket that starts on it (found in review, by simulation).
- An air-to-water unit's energy is `/report/v1/combined-energy`
  (`getAtwEnergy`), the endpoint the MELCloud Home apps read
  themselves (public record: andrew-blake/melcloudhome, ADR-027),
  live-probed 2026-11-21. One report per request, with the datasets
  `interval_energy_consumed` and `interval_energy_produced` in kWh
  beside an `outside_temperature` one the SDK does not read. `period`
  is `Daily` (hour buckets), `Weekly` or `Monthly` (day buckets);
  `Hourly` and `Yearly` answer 500, and so does an air-to-air unit
  (probed at `Daily`). Idle buckets are left out; the hour in progress is
  there and grows (one bucket read 0.333 kWh at :51 and 0.467 once
  closed). THE TRAP: past one period — a day at `Daily`, seven days at
  `Weekly`, a calendar month at `Monthly`, counted from `from` — the
  wire repeats the previous point at each period boundary. Under a
  label the real bucket also carries it reads as a duplicate; where
  the real bucket is idle it stands alone under that label, so nothing
  can sift it out afterwards, and the report's own totals count it (a
  two-day `Daily` total read 8.2 for 8.07 of real buckets). A request
  therefore never spans more than one period and starts on a midnight
  of the unit: one day at `Daily`, 28 days at `Monthly`, which no
  month is shorter than — `fetchAtwEnergy`'s whole job. Checked
  against the wire with the built SDK the same day: its 30- and 92-day
  totals equal a single request's minus exactly the repeated points.
  The oldest chunk, at the edge of the ~91-day retention, answered 500
  twice before passing: the core's retry of a read is what carries it.
  The requests are built from calendar DATES of the unit
  (`toPeriodWindows`), each bound the start of a date: where a clock
  change skips midnight (the Azores, Chile, Egypt, Lebanon, Cuba) the
  day opens at 01:00, and spans counted from that instant opened every
  later request at 01:00 too (found in review, by simulation). The day
  the clocks go back was probed, 2026-10-25 on a unit of the EU: its
  25 hours came back whole from one request, no point repeated, and
  the two passes of the hour the clock reads twice carry ONE label —
  `02:00` twice in the produced dataset, once in the consumed one, the
  report's totals counting each. Which pass a lone label is cannot be
  told, so `toAtwEnergySeries` reads every such label on its LATER
  instant: read on the earlier one, a pass still in progress would
  pass for an hour that has closed, and a consumer counting closed
  hours would count it while it grows and never the rest.
- A bucket is FINAL once it has closed, on both endpoints. Watched
  around one close on 2026-11-21 (07:58Z to 08:15Z, ten reads): an
  air-to-air bucket and an air-to-water one read the same from 45 s
  before their close to 15 min after it, while the air-to-water hour
  in progress went on growing. The public record has the same for an
  air-to-water unit over a day-long soak (andrew-blake/melcloudhome,
  ADR-027: every completed hour equal to its final value from the
  first fetch after the close, 806 responses). One close and one
  account here: com.melcloud's lifetime meters count a closed hour on
  that footing, and a report showing a meter short of the MELCloud
  app's own figures is where to look first.
- Energy units and the series: the air-to-water datasets are kWh per
  bucket; the ATA `cumulative_energy_consumed_since_last_upload` is
  Wh, in 100 Wh quanta. The READ half of both dialects is
  library-owned: `getEnergySeries` on both Home device facades answers
  HOUR buckets — the finest grain the wire serves, and the one grain
  the two endpoints agree on, an instant each — in ONE unit, kWh, the
  ATA watt-hours DIVIDED by 1000 (division, not `* 0.001`: it is the
  exact arithmetic and the one consumers ran themselves), each
  bucket's start as an epoch-ms instant, per direction: `{ consumed }`
  on an air-to-air unit, `{ consumed, produced }` on an air-to-water
  one, which the wire answers together. A garbled sample degrades
  field-by-field to `null` (never `NaN`, never a throw) and keeps its
  entry. `HomeDeviceAtaFacade.getEnergy` stays wire-verbatim by
  decision — the escape hatch for consumers needing the raw
  `measureData` envelope, one request, the caller's to chunk — and
  consumers must never re-decode either dialect on top of the series.
- The Classic listing's `CurrentEnergyConsumed` is two things under
  one name. On an air-to-water unit it is the instantaneous power in
  kW, with `CurrentEnergyProduced` (typed, and what com.melcloud's
  `measure_power` reads since 2023). On an air-to-air unit, where this
  SDK does not type it, public clients read it as a counter in Wh
  behind `HasEnergyConsumedMeter` (pymelcloud, and Home Assistant's
  energy sensor through it); the untyped field survives into
  `ClassicDevice.data`, the listed payload being kept whole. Nothing of
  the air-to-air counter was measured here, and it is NOT a source for
  a meter: the public record has it reading 0 at times, moving 3.3 to
  7.7 times less than `/EnergyCost/Report` where MELCloud's energy
  correction is active, and no lifetime figure (com.melcloud's
  CLAUDE.md, the cures weighed and left).
- Linked units on Home are an OPEN question, and the wire gives no
  divisor (live-probed 2026-11-21, one account, read-only). On Classic
  an indoor unit that is off still reports energy while another unit of
  its outdoor unit runs (the owner's field experience), and the energy
  report carries `UsageDisclaimerPercentages`, a comma-separated list
  com.melcloud counts the entries of and divides by. Home has nothing
  of the kind: `/context` carries no unit count, the energy answer is
  `deviceId` and `measureData` (`type`, `values`) and no more, and the
  only trace of a link is a unit's `capabilities.isMultiSplitSystem`.
  `systemId` does not group siblings: it was `null` on the one
  multi-split unit read (a first-generation adapter, `melCloudWiFi`)
  and set on a unit that is not multi-split (`fourthGenWifi`). That
  multi-split unit answered no hour bucket over a day and 0.9 kWh over
  92 days, and its siblings are not in the account: whether Home
  answers a unit's own energy or its outdoor unit's on each is NOT
  measured. It takes an account holding two units of one outdoor unit;
  until then the Home meters count what the wire answers per unit,
  undivided.
- The grain of a Home energy CHART follows the span asked for, never
  the time of day (62.0.2): hour buckets up to one day of window, day
  buckets beyond, as the Classic report does (its wire answers hours
  for a one-day report alone). The cutoff sat at a day and a half
  until then, "halfway to the next whole-day option", which holds for
  whole days counted back from now: com.melcloud anchors "N days" on
  local midnight, so its "2 days" spans one to two days and charted
  hours before noon, days after. The minute of margin left above one
  day is for a rolling day, whose `from` the caller stamps a beat
  before the library stamps `to`.
- No instantaneous power exists anywhere on the Home API: not in
  `/context` settings (raw enumeration 2026-07-17: 11 ATA / 15 ATW
  names, none energy-bearing — no `CurrentEnergyConsumed/Produced`
  analog to Classic ATW's list fields), not as an `actual` measure.
  Any Home power figure must be derived from energy buckets ÷ duration,
  and the finest bucket is an hour since 2026-11-20.
- Historical telemetry windows mix semantics: May–June 2026 ATA daily
  values are counter samples (~10^5 Wh), not consumption — bound any
  backfill by plausibility or restrict it to recent windows. Observed
  retention ≥ 75/91 days (ATA/ATW), possibly just device onboarding
  age.
- The Home wire speaks TWO clocks, by endpoint family (live-probed
  2026-11-21). The telemetry endpoints (`/telemetry/telemetry/*`) are
  UTC wall clock, stamps and bounds alike. The report endpoints
  (`/report/v1/*`) are the UNIT's own wall clock: their stamps carry no
  zone and mean the unit's `/context` `timeZone`, a zoneless bound is
  read on that clock too, and a bound sent as an instant (`…Z`) is
  converted, and echoed back local. This file said "UTC everywhere"
  from 2026-07-18, on the observation that the freshest report sample
  equals "now" in UTC — which tells nothing apart: the wire appends a
  point at the `to` it understood, so the newest stamp equals `to` on
  either reading. Asking one window twice does: with its bounds sent
  as instants, a UTC+1 unit answers an hour more of samples, stamped
  later than "now in UTC" (449 points against 398 on `trendsummary`,
  the two other reports alike). `combined-energy` is read on the
  unit's clock since 62.0.0, the three temperature reports since
  62.0.1 (#1859): until then `#fetchReport` sent zoneless UTC bounds
  and `home-report.ts` read every stamp as UTC, so for a unit outside
  UTC every Home temperature chart, band and operation-mode pie missed
  its newest hours and showed the rest shifted by the unit's offset.
  Every report read goes through the base facade's `onUnitClock`,
  which hands it the unit's `timeZone` and answers `not-found` for an
  id the registry no longer holds. The holiday window is on the unit's
  clock too (the next entry). NOT MEASURED APART, and still read as
  UTC on the 2026-07-18 note alone: the `/monitor/*/errorlog` stamps.
  An error entry off by the unit's offset would be this, and telling
  needs an event whose time is known: the three units read on
  2026-11-21 held no entry at all.
  `HomeAPIConfig.timezone` anchors chart label rendering and day/hour
  windows in the facades, is the clock a holiday window is given and
  read back on (the host's zone when unset), and reads nothing on the
  wire.
- The Home holiday window (`POST /monitor/holidaymode`, `holidayMode` in
  `/context`), measured by writes on ONE unit on 2026-11-21 (the owner's
  go, a UTC+1 unit, every window disabled afterwards). Five facts, and
  what the SDK does with each (62.0.3, and 62.1.1 for the fifth).
  (1) Both bounds are read on the UNIT's wall clock. A window written
  with its start three minutes ahead on that clock answered 200 and was
  `active`, the unit off (`Power` `False`), within two seconds of its
  start; the same window written in UTC wall clock, so an hour earlier
  on the unit's, answered 404 and did not arm. A full cycle (start 30 s
  ahead, 90 s long) was active at its start and, one second after its
  end, inactive with the unit back on by itself: the end is read on the
  same clock. So an enabled window goes out as the caller's instants on
  each unit's clock (`pushHomeHolidayMode`, one write per clock the
  units sit on, a building's or a batch's units being free to differ),
  and a read projects each unit's bounds from its own clock
  (`toHomeHolidayModeState`). A bound in the hour a clock repeats is
  ambiguous on the wire itself, which carries no offset: a read takes
  its first pass.
  (2) The wire arms a window AT its start and takes none that has begun.
  An enabling write whose start is not ahead of the unit's clock (now,
  ten minutes earlier, about an hour earlier) answers 404 with an empty
  body, and the window is STORED all the same, enabled, without arming
  (each watched 75 s at the least, close to five minutes at the most).
  Starts 20 s, 30 s, a minute and 3 min ahead answered 200 and were
  found armed at the first read after their start, zero to ten seconds
  past it. So a start that is not a minute ahead of now is sent a minute
  ahead (`HOLIDAY_START_LEAD`): "from now" is what the consumer's flow
  cards ask, and the minute is what a slow request, or a host clock
  running late, needs to arrive before the start it carries.
  (3) Over a window that is RUNNING, the same two answers, and the
  refusal costs more. An enabling write carrying the running window's
  own start, past by then, answered 404, stored its new end and left the
  window inactive with the unit still off for the 30 s it was watched,
  nothing armed to bring it back; a disabling write sent then did not
  bring it back either, in the 26 s before another window armed. One
  carrying a start a minute ahead answered 200: the unit stayed off
  through that minute, the window inactive, and active again at its new
  start. Changing a holiday in progress, or setting it again, is
  therefore the same write as "from now", and (2) covers it.
  (4) The wire does not check the order of the bounds: a window ending
  two minutes before its start answered 200 and was stored enabled
  (disabled before its start; what it would have done at it is not
  known). So the order is judged on what each clock's write carries, the
  bounds on that clock to the second, and a window that ends before it
  can start is refused before any request (a `RangeError`,
  `toClockWindow`): two instants in order still read backwards on a
  clock in the hour it repeats, and as one second when less than a
  second apart. Every clock's write is built before the first goes out.
  (5) `enabled` says a window is set, `active` that it is in effect:
  `enabled` was still `true` 102 s after a window had closed (how long
  it stays so is not known). So the read state's `isEnabled` is the
  flag AND an end not yet past, judged on the wire's own clock each
  time the state is read (`toHolidayModeState`, 62.1.1, in
  `src/facades/holiday-mode-state.ts`), and on BOTH dialects, the
  neutral state meaning one thing. What Classic's `HMEnabled` does
  once a window has ended is NOT measured, and neither is what it then
  answers as `HMEndDate`: the state does not depend on the flag for as
  long as the wire still answers the end. The end is read as the
  bounds are projected, one parse: an end the wire left unset, or one
  that cannot be read, the value or the unit's clock, closes nothing
  and leaves the flag as it is (a read never takes a sync down). A
  window set ahead reads as its flag says before its start (`true` on
  MELCloud Home, measured); `active` is left unread. A window
  written a minute ahead over such a closed one, still enabled, was
  taken like the first: a 200, armed at its start, closed at its end,
  the unit back on by itself. A disabling write answers 200 and its
  dates are ignored: one sent with other dates left the stored ones as
  they were. After one that cut a RUNNING window short the unit was
  back on within ten seconds twice, and still off 8 s later once
  (re-applied by hand).
  THE LIMIT of all five: one unit, an hour ahead of UTC, its `timeZone`
  the same as its building's `timezone`. "The unit's clock" cannot be
  told there from a fixed UTC+1, nor from the building's or the
  account's zone; the unit's is taken, as for the reports, which rest on
  the same kind of unit.
  THE HISTORY: 42.6.0 (2026-07-23) sent the caller's wall clock as
  given, which the wire of today takes right wherever caller and unit
  share a zone, "from now" apart. 49.0.0 (tagged 2026-08-17) projected
  BOTH wires onto UTC, on com.melcloud#1593 (a window an hour late in
  the MELCloud UI and an hour early back, the offsets of a wire that
  stores UTC, which the Classic path had projected for until 2024). Of
  the Home wire this file said "UTC wall-clock everywhere (live-probed
  2026-07-18)", and the write's own comment "live-probed" with it, until
  62.0.1 (2026-11-21) recorded the holiday bounds as not measured apart.
  From 49.0.0 to 62.0.2 a Home window therefore went out early by the
  unit's UTC offset: an hour on the clock measured, two in a Central
  European summer if the wire's clock follows the unit's zone, which a
  November measure cannot tell. One starting sooner than that offset,
  "from now" included, was refused as already begun and left stored,
  unarmed (the UTC window of (1), three minutes ahead); one starting
  later started and ended that much early (deduced from (1), no such
  window was watched). A round trip hid it, the read undoing the write's
  projection. A window those versions stored reads back early by that
  offset from 62.0.3 on, which is when the wire will arm it.
- Home report semantics (comfort-graph / internaltemperatures /
  trendsummary): the BFF rounds the window down to full days of the
  unit (the clocks entry above);
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
- Classic communication lines are EDGES too (62.3.0), the twin of the
  Home connectivity lines below. A com.melcloud report of 2026-11-23
  showed a unit greyed as "not communicating" and nothing to date it:
  the listing body is over the core's 4 KiB bound, so `LastTimeStamp`
  never prints, and no line was written when the predicate flipped
  (its energy history placed the silence in May). `ClassicDevice`
  remembers the verdict of `hasStoppedCommunicating` — the ONE
  predicate, in `entities/types.ts`, the facade's `isAvailable` reads —
  and `trackCommunication()` answers the edge a listing sync crosses:
  `stale` on the first that reads the stamp over the window old, a unit
  that JOINS the registry that way included, so a host that starts over
  a silent unit says so at its first sync; `resumed` on the first that
  reads it fresh again. The registry collects them
  (`syncDevices` returns `ClassicCommunicationEvent[]`) and the cycle
  logs each, the unit by TYPE and ID, the stamp as the wire gave it
  (building-local wall clock, day-scale reasoning only). `stale` is an
  ERROR on purpose, and that is what makes an edge enough without a
  reminder: a Homey report keeps its error stream apart from the
  hundred lines of stdout (one line in the report above, hours old), so
  the line outlives the routine traffic that buries a `log`. Only a
  listing sync moves the record: a write's echo merges a partial
  payload and judges nothing.
  Three corrections of 62.3.1, each reproduced by an independent
  reading of 62.3.0. The line quotes the stamp and CLAIMS NO DURATION:
  the predicate judges a building-local stamp against a UTC clock, so a
  building west of UTC reads a day of silence after thirteen (UTC-11)
  to twenty-three (the Azores) hours of it, and "over 24 h" was false
  there (availability itself flips at that same instant, as it always
  did: only the written claim was new). A stamp that CANNOT BE READ
  still reads as heard from, for the line as for `isAvailable` (no unit
  is greyed on a stamp nobody can read), so it ends a silent unit's
  episode; what changed is the WORDING, which claimed "communicates
  again, last at null" and now says the listing gives no readable date
  (`readCommunicationSilence`, the three-way reading, tells the
  reporter which). A first cut of 62.3.1 made such a stamp move nothing
  for the line alone, and a second independent reading caught what that
  cost before release: the tile read available again with no line, and
  greyed again with none, the line and the tile no longer on ONE
  predicate. The edge is back on it. And the year-one stamp, MELCloud's
  marker for "never happened" (`isUninitializedWireDate`), is worded
  ("has never communicated with MELCloud") rather than dated. That the
  wire puts that marker in `LastTimeStamp` is NOT measured.
- A unit's OWN fault is a second contract, `FaultAware` (60.5.0):
  `isInError` (Classic `HasError`, Home `isInError`) and `errorMessage`
  (Classic `ErrorMessages`, trimmed; Home the `ErrorCode` entry of the
  unit's `/context` settings array, the code alone, gated on the flag —
  60.7.0). Home was read as flag-only until a unit in `E6` was read on
  2026-11-18: its settings array carried `IsInError: True` and
  `ErrorCode: E6` beside the top-level `isInError` — the `/context`
  device schemas are loose, so the entry was in the registry all along,
  and 60.5.0 had pointed consumers at the error log for a wording the
  listing already gave. Orthogonal to availability by measurement: a unit in `E6` (the
  indoor/outdoor communication fault) stayed `Offline: false` and echoed
  every `SetAta` with `200`, the fault attached (diagnostic report of
  2026-11-06), so nothing but the flag says the unit is faulted — and the
  listing has always carried the three fields (live-probed 2026-11-07 on
  the three device types). `tests/contracts/is-in-error.test.ts` pins the
  contract on both dialects as `is-available` does.
- Classic serves its reads over POST (`/EnergyCost/Report`, `/Report/*`,
  `/Group/Get`, `/Tile/Get2`): each passes `...READ_OVER_POST`
  (`idempotent: true`) so api-core retries it like a GET on a 500/502/
  503/504 and holds no sync tick for it. Measured 2026-10-21 on a Homey:
  the :05 bursts (sixteen Home reads, thirteen Classic reports) draw
  empty-bodied 500s and 502s from MELCloud on some devices every hour;
  without the retry, three consecutive misses on one device hold the
  host's "energy reports failing" warning. A write never gets the flag.
- The nightly Classic failure was never an HTTP status: at 01:05 the 23
  `EnergyCost/Report` reads a Homey fires within half a second drew 14
  `TypeError: fetch failed` at undici's 10 s connect timeout and 9
  `TimeoutError` at the client's 30 s budget (2026-10-22), while the
  same burst passed 30 s later from a second host on the same public
  IP. Those two limits are also where the nights began to be lost.
  Until 24.0.0 (2026-04-12) the client waited without limit, and a
  slow answer after 01:05 was a late write: on the owner's Homey,
  January to April 2026, up to 190 s late with no read provably lost.
  Since then it is a lost read, from 2026-04-25 on, before the host's
  wall-clock anchoring of July made the loss near total (com.melcloud's
  CLAUDE.md dates both onsets). The limits stay all the same: a read
  never answered would otherwise stop its report until the host
  restarts.
  api-core 2.2.0 retries a read on those too (`isTransientFailure`),
  and every failure line the SDK writes goes through the core's
  `logFailure` (api-core 2.3.0, adopted with 60.3.0): a failure the core
  has a class for — an `HttpError`, the `APIError` family, a transport
  failure, anywhere in the `cause` chain — is ONE line naming that
  chain and carries no error object, because a host logger prints only
  the message and a transient's ten transport frames read as a crash in
  a report; anything else keeps the object and its stack. The seats
  here are `safeRequest`, the refresh-token exchange and the after-write
  refresh of `fetchDevices`; the cycle and resume lines are the core's
  own. Never spell a chain locally again (60.2.0's `describeCauses` went
  with the adoption) and never log a classified failure as
  `(label, error)`. The apps reach the same three helpers through the
  root barrel (60.4.0: `src/errors/index.ts` forwards `logFailure`,
  `isKnownFailure` and `failureCauseChain` beside the core's error
  family), so their own lines — com.melcloud's
  `Energy report fetch failed:` — take the one-line form without a
  direct api-core pin: the SDK stays the apps' only API boundary. The
  nights did still fail under the retry, and com.melcloud 46.16.1
  pulled the next lever, the burst itself: each device takes its own
  instant in a report's slot, the Classic nightly reads left 01:05, and
  a failed report run is retried by the host a quarter of an hour
  later. A connection pool per origin is NOT that lever: in diagnostic
  report 2acb0764 (2026-11) a Homey firing only two `EnergyCost/Report`
  reads at 00:05:00Z had both spend their five 30 s attempts, about
  165 s, on three nights running, and its device listing timed out
  until about 00:10Z — the silence is not one host's burst. Whether it
  is MELCloud's own or the doing of the app's installs firing together
  is not known. A longer timeout stays the wrong lever either way: it
  would have saved the slow nights of spring 2026 and not these, silent
  for five minutes and more, which the host's own instant and retry
  answer.
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
- Personal data is the vocabulary's SECOND tier, declared apart from
  the credentials (api-core 1.10.0, adopted with 59.4.0) because it
  answers a different rule: a credential never reaches a log because
  it opens an account; a user-entered string never reaches one because
  the user typed it, and a diagnostic report pasted into a public
  issue reproduces it — the "type and id only" rule the connectivity
  lines below follow, applied to the dumps that print bodies up to the
  core's 4 KiB bound (api-core 1.12.0). The engine blanks both tiers the same way,
  case-insensitively, through every seat the one bound engine reaches.
  `PERSONAL_DATA_KEYS` in `src/observability/context.ts` declares
  thirty-three keys, in three lots. Nineteen from this SDK's own types
  (59.4.0, 59.5.0): Home `/context`'s `givenDisplayName`, `firstname`,
  `lastname`; Classic `/User/ListDevices`'s `DeviceName`,
  `BuildingName`, `AreaName`, `FloorName`, `Zone1Name`, `Zone2Name`,
  `OwnerName`, `AddressLine1`, `AddressLine2`, `City`, `District`,
  `Postcode`, `Latitude`, `Longitude`; and the network identifiers
  `MacAddress` and `LocalIPAddress` (Home's `macAddress` rides the same
  match) — Recital 30 lists IP addresses among the online identifiers
  (CJEU C-582/14 _Breyer_, for a dynamic public address), the Article
  29 Working Party treated a MAC address as personal data (Opinion
  13/2011), the LAN address maps the owner's home network, and none of
  the three serves a diagnosis.
  Five from what real payloads still PRINTED (62.3.0). A com.melcloud
  report of 2026-11-23 carried the full name of a Classic account
  holder, so every exchange of one account was read through the bound
  engine that day, key paths and value shapes only, never a value. It
  found the bare `name` key (the account holder under
  `LoginData.Name`, printed whole at every sign-in; a building at the
  root of the Classic listing and under Home's `buildings` and
  `guestBuildings`; a Classic floor and area), `MapLatitude` and
  `MapLongitude` (the account's map, same sign-in answer),
  `WeatherObservations` (the weather at the building, which
  `/Group/Get` and `/Device/Get` carry: its sunrise and sunset, to the
  second, place the house about as well as the coordinates) and
  `connectedInterfaceIdentifier` (how Home addresses a unit's adapter:
  twelve hexadecimal digits on four units of five, the form of a MAC
  address — that it IS the adapter's MAC is not established, none
  equalled a Classic `MacAddress` on an account whose units are not the
  same ones).
  `name` had been EXCLUDED until then, by decision: Home spells a
  device setting's name with the same word (`HomeDeviceSetting.name`,
  the key `setting()` in `home-base-device.ts` reads), a key is blanked
  wherever it rides, and a dump with its setting names blanked
  diagnoses nothing. api-core 2.5.0 gave the vocabulary a way to take
  ONE seat back (`notPersonalUnder`), so the word is declared and
  `NOT_PERSONAL_UNDER` exempts it under `settings` alone: every other
  `name` either wire grows is blanked until someone argues for it.
  Never turn that around into a list of the parents where `name` IS
  personal: the Classic building sits at the root of its listing,
  where nothing encloses it.
  Nine on the key's NAME alone, each read `null` or empty on the
  accounts measured, so what they carry when set is not known:
  `CustomerName`, `BuildingAddress`, `BuildingCity` (the energy
  report), `Owner` (a building's owner record, of unknown shape; a
  number on a unit), `ListPendingInvite`,
  `ListOwnershipChangeRequest` (the sign-in answer) and, since 62.3.1,
  `Scene`, `SceneOwner` (a device read) and `WeatherForecast`, which
  carries what `WeatherObservations` does in the same body. Blanking a
  key that carries nothing costs a reader one thing, which the second
  reading of 62.3.1 named: the engine writes the mask over a `null`
  too, so a dump no longer tells a scene that is SET from none, on a
  unit whose setpoint "comes back". Printing a `null` as `null` under a
  blanked key would give that back at no cost to privacy; it is the
  engine's to decide (api-core), for every key and both SDKs at once,
  and is not done here. The same reading listed two
  keys the wire names a SECRET by, `Passcode` (a device read) and
  `RandomKey` (the sign-in answer): they joined the credential tier in
  62.3.1, on their name too. The five were in the measure's own output
  and the first pass decided nothing on them; an independent reading
  found them there.
  KEPT, as trades: `SerialNumber`, a unique device identifier but not
  observable on the network, and the figure a report and the owner name
  the unit by; the account and unit ids and the country, what a report
  names a thing by; and a Classic building's `Location` — a number that
  maps one to one to the building's city on the account measured (five
  buildings, three cities), so a place at city grain, but the engine
  matches a key wherever it rides, headers included, and `Location` is
  the HTTP header a sign-in diagnosis reads. `OwnerEmail`/`email` were
  already the credential tier's. When a wire field the user types is
  added, extend THAT list, never a log-site filter;
  `observability.test.ts` pins the list key by key, the exemption, the
  kept keys by name, and the dumps of a sign-in, a listing, a
  `/context` and a group read.
- **A unit's capability rides a FLAG in a uniform payload, never the
  payload's shape — which is why heatzy-api's type-level fix does not
  cross here.** Every Classic ATW answers the same keys: the Zone 2
  fields are declared on all of them (`FlowTemperatureZone2`,
  `RoomTemperatureZone2`, `SetTemperatureZone2`…) and `HasZone2` says
  whether they mean anything, exactly as `CanCool`, `FPDefined` and
  `HMDefined` do for their own features. So the capability is DATA read
  per unit at runtime, and the honest expression is what this SDK
  already does: a nullable read (`zone2` answers `null` on a
  single-zone unit, `classic-device-atw.ts`) and runtime guards on the
  write path. heatzy-api 20.0.0 could put the equivalent capability in
  its TYPES — the presence derogation moved to `DeviceProFacade` alone —
  because its wire is the opposite: the KEYS and the value encodings
  differ per product generation (`cft_temp` against
  `cft_tempH`/`cft_tempL`, a label against a number), over a product
  identity resolved once at construction and already shaped as a facade
  class hierarchy. Making `HasZone2` a type here would take a per-unit
  generic over a single facade class — a far larger change than the one
  it would mirror, and one nothing has asked for. Recorded so the twin
  question is answered rather than re-opened: the fix does not cross,
  and the reason is the wire's shape.
- `FPDefined`/`HMDefined` are DECLARATIONS, not guarantees: MELCloud
  can refuse the zone-level read the flag promises. Measured on
  2026-08-26 (a shared building's zone-level `GetSettings` answers
  `401` on a valid session) under the prefixed table name of 30.0.0 to
  60.9.0, above, and again on 2026-11-21 under the restored one: of
  five buildings of one account, both building-level reads of ONE
  answer `401` while its unit answers at device level, and it is the
  one the listing gives `AccessLevel: 1` and `DirectAccess: false`
  (the four others, at 3 or 4 with direct access, answer `200`). The
  protection/holiday reads are therefore zone-first with a device-level
  fallback on failure whenever the flag is `true` or unknown — the
  original 2024 design; a 2026-03 refactor silently gated the fallback
  on the flag being unknown and shipped five months of dead fallback
  under a comment claiming otherwise. The fallback is deliberately
  ONE-WAY: a `false` flag reads the device level only, because no
  device-level refusal has ever been observed (the fourteen units read
  on 2026-11-21 included) and a zone answer for a building the flag
  excludes reads as "never configured" (`ok(null)`) — a wrong answer
  masking a real failure (review catch, 2026-08-28). All three clauses
  are kernel-pinned. Writes keep branching on the flag (the wire's own
  addressing).
- Where the Classic frost and holiday settings live, live-probed
  2026-11-21 (five buildings, fourteen units, read-only). The listing
  carries a BUILDING's own `FP*`/`HM*` fields and nothing for a floor,
  an area or a unit: a unit's settings cost one `GetSettings` each. A
  building with no definition of its own answers `200` at building
  level, `FPDefined: false` with the defaults (14 and 16), not a
  failure. And the units of one building do not share their settings:
  three units of one answered `HMDefined` true, true and false, and a
  unit holds an enabled frost protection (12 to 14) under a building
  that defines none. So the device-level read a building facade falls
  back on is a SAMPLE — one unit's answer given as the building's, the
  first in registry order — while its write goes to every unit. On the
  five buildings measured the sample and a fold of every unit read the
  same (single-unit buildings, or units that differ only in the
  `Defined` flag of a feature that is off), which is why the read
  stays as it is: the fold the Home building facade answers from
  `/context` for free would cost a request per unit here, and change
  the zone facades' return type, for a divergence nobody has seen. A
  report of a zone panel showing settings its units do not all hold is
  where that fold comes back.
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
  went stale and why. `inspectClassicListingEntry` owns the verdict
  and, since 59.7.1, is the predicate's only reader: the boolean face
  `isModelledClassicDevice` went once the boundary had moved to the
  inspector and nothing read the boolean any more.
- The Home drift line is a STREAK, not a line per fetch (59.2.0).
  While `/context` drifts from the strict schema, every fetch salvages
  the device entries — and used to log the drift each time, 1,440
  lines a day at Home's one-minute default cadence (five minutes is
  Classic's), the kind of storm 59.1.0 ended for the cycle line. The drift is keyed on its refused paths through the
  core's `FailureStreaks` (subject `GET /context (strict)`, cleared
  with the registry): reported when it opens, when the paths change,
  at most every five minutes, and closed by one `log` line when the
  strict parse holds again. This is heatzy-api's device streak's twin
  on the SAME class rather than a copy — the twin question #1789
  answered for capabilities, answered here for logging: the mechanism
  crosses, each SDK names its own subjects.
- Home connectivity lines are EDGES, unthrottled by design (59.3.0). The
  only availability signal a Home unit has is the `/context`
  `isConnected` boolean, tracked as an in-memory streak that
  `isAvailable` reads against `STALE_COMMUNICATION_HOURS`; until 59.3.0
  nothing wrote a line when the flag flipped or the window closed, so a
  report could not date a Homey "unavailable". `HomeDevice.sync` answers
  the edge a sync crosses (`disconnected` on the first `false`, `stale`
  once per streak on the first sync past the window — the same
  predicate `isAvailable` reads, so the line follows the greyed tile at
  the next sync, up to a minute late, logged as an error so the report
  dates it —
  `reconnected` with the streak's start and sync count), the registry
  collects them and the sync cycle logs each one. That count is CYCLES,
  which holds only because the cycle hands the registry ONE entry per
  unit id (59.3.1): `/context` may list a unit under both `buildings`
  and `guestBuildings`, and the flat guest-then-owned list used to
  reach the registry as is — the upsert's last-write-wins kept the
  owned tag, at the price of two `sync()` passes per cycle, invisible
  until 59.3.0 started counting and then doubling its count. The list
  is collapsed through a `Map` in the same order, so the owned entry
  still wins (the order is load-bearing — never "drop repeats") and the
  unit is synced once; the buildings `fetch()` returns stay
  wire-verbatim, a cross-listed unit under both. No reminder and no
  coalescing, unlike the drift streak above: the flag's negative side
  is unproven (live-probed 12/12 `true` on healthy units; a `false` has
  never been witnessed on one), so if it flaps the open/close pairs ARE
  the finding a report must show, and at the one-minute cadence that is
  two lines per flap, never a line per fetch. The unit is named by TYPE
  and ID only — `givenDisplayName` and every other user-entered string
  are personal data and never reach a log line — and the drift line
  names the pruned unit the same way (id salvaged loosely from the raw
  entry, paths relative to the entry, never values).
  `HomeBaseDeviceFacade.isConnected` is the RAW flag, back after 44.0.0
  removed it, for comparison with the official app and never for
  availability: `isAvailable` stays the contract. The motivating report
  (2026-10-02): an Ecodan ATW on Home reads "offline for hours" while
  the ATA on the same account never does; the availability code is
  identical for both, so the asymmetry can only come from the per-unit
  flag, from the wider ATW strict schema (a drifting ATW entry is
  salvaged out of the registry — pruned, not offline — which the named
  drift line now tells apart) or from the Homey itself.
- A READ closes a vocabulary only where the SDK CONSUMES it (59.0.0).
  Home's `connectedInterfaceType` was the closed pair
  `fourthGenWifi | melCloudWiFi` on a label nothing reads, so the next
  adapter family would have failed the strict `/context` parse, been
  salvaged out of the registry, and logged the drift on every fetch.
  It is a `string` now. heatzy-api shipped that exact shape for two
  months (from its 10.0.0 rewrite until 19.0.0: closed literals on
  calibration and mode registers broke every radiator of three
  generations). A closed literal stays
  legitimate where the SDK depends on the value: the Classic `Type`
  discriminator, `LabelType` (the label formatters cannot render an
  unknown one), and the OAuth `token_type` — nothing reads it, but it
  guards the hard-coded `Bearer` authorization header against a server
  that switched schemes. `parseOrThrow` names the failing PATHS only —
  for a refused union, its closest branch's, since the union's own path
  is `(root)` for the energy report — never the received values (the
  login, token and `/context` payloads carry credentials and personal
  data), and leaves the issues to the ZodError `cause`, so a logged
  error prints them once.
- Timestamp normalization is library-owned: `ErrorLogEntry.atEpochMs`
  (+ its `clearedAtEpochMs` twin),
  `AtwHotWaterState.lastLegionellaActivationEpochMs` and
  `HomeEnergySeriesPoint.atEpochMs` carry the epoch
  instant, each dialect anchoring its own wall-clock discipline at its
  boundary — Classic timestamps are building-local wall clock anchored
  in the client's configured timezone (host zone when unset), Home
  telemetry stamps are UTC and the combined-energy labels the unit's
  own clock. The Classic instant is therefore exact only
  insofar as the configured timezone IS the building's: a building in
  another zone skews it by the zone delta (worldwide skew reaches
  ±14 h), so day-scale reasoning stays safe where sub-hour does not.
  Consumers never re-derive an epoch from the wall-clock `at`; the
  cannot-parse marker is `null`, never `NaN` (these instants cross
  JSON boundaries, where `JSON.stringify` silently rewrites `NaN` to
  `null`), an unparseable Classic `at` keeps its entry, and the
  legionella stamp's year-1 sentinel — any offset spelling, judged as
  UTC year <= 1 — reads `null`.
- The error-log page window is library-owned on BOTH sides (60.9.0):
  `resolveErrorLogWindow` tiles the pages, `isWithinErrorLogWindow`
  files an entry into one — the rule the Classic wire applies
  server-side, needed for the Home entries, which the Home wire answers
  as one unwindowed log. Days are read in the host's timezone and both
  bounds are inclusive; the newest page (no `to`) has no end and alone
  holds an entry with no instant, so such an entry shows once. Every
  other page passes its resolved end: a chained page's `to`, an offset
  page's `toDate` (its query carries no `to`, so left unset it would
  read as the newest page and file newer and undated entries again). A
  consumer merging the two dialects never re-derives the membership.
- Setpoint increments: both Home facades expose a derived
  `temperatureStep` (ATA from `hasHalfDegreeIncrements`, ATW from the
  FTC's own `temperatureIncrement` declaration — the direct field wins
  over a re-derivation from `hasHalfDegrees` whenever the wire states
  the step itself), and since 62.3.0 so does the Classic ATA facade,
  from the listing's `HasHalfDegreeIncrements` (one reader for both,
  `ataTemperatureStep` in `temperature-range.ts`). What stays
  deliberately unexposed is Classic
  `CanSetTemperatureIncrementOverride`: a device PERMISSION, never a
  step declaration — reading it as a step would be wrong, and its
  absence from the public surface remains a verdict, not a gap.
- An ATA setpoint goes on the HALF DEGREE before it is clamped, on
  both dialects and in a Classic group write (62.3.0, narrowed to this
  in 62.3.1), because a unit holds a setpoint on its step and nothing
  else, and every such step lies on the half degree. Measured by writes
  on one half-degree unit of each dialect on 2026-11-23 (the owner's
  go, each unit restored). Classic DROPS an off-step value: `18.4`
  answered `200`, echoed and listed as `18.4` until the unit next
  communicated (8 min 18 s later, the unit reporting every ten minutes
  that evening), then the listing read `18`, the setpoint held before;
  `18.5` written next was held. The field report behind it
  (com.melcloud, the same day): an automation lowering a target by
  0.4 °C every half hour, re-sent every four minutes, of which only the
  whole degrees landed — `16.4` read back as `18`, `15.6` and `15.2` as
  `16`, six read-back lines in 86 minutes — read by its owner as
  "reverts to an old setting". Home ROUNDS it itself, late: `20.6` read
  `20.5` a minute later, `20.8` read `21`, `20.25` read `20` (a tie
  ended on the whole degree), and `20.75` still read `20.75` after two
  and a half minutes on a unit holding `21`: what the wire answers is
  the last write until the unit reports a CHANGE, so a value that
  rounds to the setpoint already held stays on display as written.
  `toAtaSetpoint` (`temperature-range.ts`) is the ONE writer's rule:
  nearest half degree, a tie going UP (`roundToStep`), then the bounds;
  on Home it moves the `x.25` tie half a degree up from where the unit
  alone put it, by decision (one rule for both dialects).
  THE GRID IS THE HALF DEGREE FOR EVERY UNIT, a unit that advertises
  whole degrees included, and that is a retreat: 62.3.0 rounded to the
  unit's own `temperatureStep`, and an independent reading the same day
  reproduced what that does to com.melcloud.extension on a whole-degree
  unit. The extension computes its target on a hard-coded half-degree
  grid and reads any tile value that is not its target as a change made
  by hand: `23.5` asked, `24` sent, `24` read back, `24` recorded as the
  user's comfort setpoint, which then ratchets up a degree at a time.
  No whole-degree unit could be measured, and no host can learn a
  unit's step through Homey today (com.melcloud publishes none as a
  capability option), so a whole-degree rounding has to arrive WITH its
  hosts: the app publishing the step, the extension reading it. Until
  then such a unit is sent half degrees as before; what it does with
  one is NOT measured (the extension's own half steps on such a unit,
  re-sent after each drop, would fit com.melcloud #1408, "cooling
  reverts to 24° every 10 min", at the ten-minute cadence measured
  above: a hypothesis, the report was not re-read against it).
  `temperatureStep` stays a READ on both ATA facades (Classic since
  62.3.0, from `HasHalfDegreeIncrements`; a listing that does not carry
  the flag reads as half degrees, the type saying optional because
  nothing validates a unit's listed payload). NOT measured either: the
  ATW zone setpoints, which keep their clamp alone, and the Classic
  GROUP endpoint, whose state is put on the half degree all the same
  (`toWireGroupState`, no bounds: a zone holds units of several ranges)
  so that the two halves of a combined house are sent one value; the
  zone facade's decorators read the state the write is GIVEN, which is
  why `updateGroupState` normalises and hands over to a private
  `#writeGroupState`.
  On Classic the rule is the device facade's `normalizeUpdateData`,
  applied to what the caller ASKED, before the no-change filter: what
  is compared with the snapshot is what would be SENT. A request the
  grid or the bounds bring back to the setpoint held is refused with
  `NoChangesError` and nothing leaves (the clamp, sitting in
  `deriveUpdateData` after the filter, used to re-send the held value),
  a setpoint held OUT of its mode's bounds is brought back in when it
  is asked again, and a mode change whose setpoint comes back to the
  one held flags the mode alone. That extends the stale-snapshot
  suppression described above (a request equal to a stale snapshot is
  not sent) to every request that normalises to it: same class, wider
  door. `deriveUpdateData` is the ATW's alone now (the companion zone,
  derived from what CHANGED, flagged before the body is assembled) and
  it still holds the ATW target-temperature clamp, so AFTER the filter:
  asking 70 for a tank whose ceiling of 60 the unit already holds
  re-sends 60, flagged — one redundant POST, nothing wrong on the unit
  (reproduced by the second reading of 62.3.1, left as it is there).
  Moving that clamp before the filter, like the ATA rule, is the natural
  follow-up, with ONE trap to mind: its `data[key] ?? range.min`
  fallback is dead only because the filter has already dropped every
  `undefined` key, so moved as written it would send the MINIMUM for a
  present-`undefined` key.
  Pinned on both dialects by `tests/contracts/ata-setpoint-clamp.test.ts`
  (the grid, the unclamped case, the three no-change refusals, the
  flags) and, for the group write, by `classic-facades.test.ts`.
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
  transport blip, which api-core 2.4.0 retries a minute later
  instead), the next ACCEPTED sign-in lifts it, and the
  sync-cycle epilogue + `ensureAuthenticated` consult
  `isAuthenticated() && !refused` (the core's `isSessionServable()`,
  protected exactly so this repo's `ensureAuthenticated` reads the
  record instead of mirroring it — the record's writes stay the
  core's) so the loss surfaces once per episode — announced the moment
  the refusal is recorded since api-core 2.4.0 — while the stored key
  deliberately stays. In-memory like the episode marker: a
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
the schemas and the facades; the directory barrels (`errors/`,
`http/`, `resilience/`, `decorators/`, `types/`) forward the core's
names directly — the one-line re-export shims that once sat between
were folded in 57.2.1, and the three local `APIError` subclasses extend
the core's class through the package specifier, never through the
errors barrel (an eval-time cycle under `class extends`). A mechanism
change happens in api-core and arrives here as a release + exact-pin
bump PR; never re-implement one locally.
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

api-core 1.5.0 (adopted with 57.2.0) crosses no new twin — it is three
session-lifecycle fixes in the mechanism, behaviour only, so this repo's
adoption is the pin and nothing else. Two of them change what a Classic
consumer can observe and are worth knowing here. The login-backoff gate
now schedules ONE retry at the deadline it refuses on, because the gate
returned without a wire call and `planNext()` — the only arm of the
auto-sync timer — lives in the cycle epilogue: a boot inside the window
armed no heartbeat at all and stayed dormant for the life of the
process, over a throttle (`ErrorId` 6) that says nothing about the
credential pair. And `ensureSession`'s single flight now excludes the
refresh's OWN traffic: the enforced post-auth sync the refresh triggers
re-entered the gate and joined the promise waiting on it, which hung
every request on the client — reachable here because
`ClassicLoginDataSchema` types `Expiry` as `z.string()`, so the ASP.NET
`0001-01-01` sentinel passes validation and leaves the expiry predicate
reading `true` forever. The third, the sign-in epilogue gated on the
most recent sign-in rather than on the sign-out alone, is invisible to
this SDK's own code and matters to the apps: an account switch no
longer reverts, and a raced sign-out no longer deletes a newer
session's material.

api-core 1.6.0 (adopted with 57.2.1) closes two gaps an independent
re-verification found in that epilogue, again behaviour only: a pair
the server has definitively refused is PARKED until the next accepted
sign-in — 1.5.0 recorded the refusal and still deferred a retry, so a
dead stored pair was replayed every 15-minute window for the life of
the process — while a throttle (`ErrorId` 6, which says nothing about
the pair) keeps its retry; and only a sign-in that BEGAN after the
last sign-out claims the session, so a losing flight answered after a
sign-out clears its own material instead of leaving a session standing
behind it.

api-core 1.7.1 (adopted with 57.3.0) parks the auto-sync tick around
every non-GET request and for a 3-second settle window after it —
heatzy-api's return to a 5-second cadence made a refresh overlapping a
write the common case, and the fix is the core's because both SDKs
share the seat. Here the tick is only ever DELAYED, never advanced: a
Classic write still costs no extra `ListDevices`, the 5-minute cadence
stays, and the ATW/ATA writes that `@fetchDevices({ when: 'after' })`
already follow with a refresh are unchanged. 1.7.0's
`HttpClientConfig.describeFailure` is NOT seated here: MELCloud's
refusals (`ErrorId`, `LoginData: null`) are read at their own
boundaries into `AuthenticationError`/`AuthenticationThrottledError`,
and a non-2xx body says nothing the status line does not.

api-core 2.3.0 (adopted with 60.3.0) crosses one small twin:
`logFailure(logger, label, error)`, with `isKnownFailure` and
`failureCauseChain` beside it. The core's two lines (`Failed to fetch
devices:`, `Session resume failed:`) ride it with the pin; this repo's
three seats call it directly — `safeRequest` (`src/api/base.ts`, whose
60.2.0 `describeCauses` copy went with it), `refreshAccessToken`
(`src/api/token-auth.ts`, whose `logger` is the core's `Logger`,
required: its one caller always hands it) and the after-write refresh
of `fetchDevices`. A known failure is one line, label then chain, with
no error object; anything else is `(label, error)`, so a bug keeps its
stack; a `RegistrySyncError` is judged by what it wraps. The kernel pins
the one-line form per leg through the driver's `refusedSignInChain` —
Classic's refusal rides the body (`LoginData: null`) and is one link,
Home's is a narrowed 401 and names its `HttpError` cause — and the
object form stays pinned where a plain `Error` is staged (home-api's
redirect-limit, missing-form, PAR and token-exchange clauses, under the
transient label since 2.4.0). Both
shapes are pinned at each of the three seats. Since 60.4.0 the errors
barrel forwards the three helpers to the apps under the core's names,
the way it forwards `AuthenticationError` and `RegistrySyncError`, so a
host's own failure line takes the same form through this SDK's pin
(`errors.test.ts` pins each as the core's own binding, read from the
package root); the rest of 2.3.0's surface — `failureReason`, the streak
class, the reminder interval — stays the core's and this SDK's. 60.4.0
pins 2.3.1, whose only change is the three helpers' JSDoc (`@category
Errors`, and `failureCauseChain` names `failureReason` in code font, no
longer as a `{@link}` this package cannot resolve — the docs gotcha
under `npm run docs`).

api-core 2.4.0 (adopted with 60.6.0) is behaviour only. A failed
AUTOMATIC resume that is not an `AuthenticationError` — a transport
blip, a 5xx, and on Home every OIDC flow fault that is not a refusal (a
redirect loop, a missing login form, a PAR or token-exchange failure) —
is retried a minute later (`loginBackoffUntil` armed for 60 s,
automatic sign-ins waiting for that retry, one `Session resume failed,
retried every minute:` line per streak) instead of arming nothing and
letting the next cycle announce a loss and disarm for good; an explicit
`authenticate()` failing at transport still arms nothing.
`onAuthenticationLost` fires only for a DEFINITIVE loss — the stored
credential refused, announced the moment the refusal is recorded (still
once per episode), or a persisted session dead with no credential
behind it. A cycle that ends unauthenticated over credentials nobody
refused announces nothing and stays armed: the scheduled retry owns the
recovery, or the heartbeat does when nothing was attempted — reachable
on Home only, whose refresh predicate lets a cycle with no recorded
expiry out without a sign-in, while every unauthenticated Classic cycle
signs in first. Cognito's own refusals stay definitive because
token-auth throws `AuthenticationError` for them (a re-rendered login
page, a chain that lands without a code). The kernel pins the three
branches; the additive surface (`isAuthFailure`,
`dispatch(…, { authenticated: false })`) is not seated here.

api-core 2.5.0 (adopted with 62.3.0) adds one option to the redaction
engine and changes nothing for an SDK that does not pass it:
`notPersonalUnder`, the enclosing keys under which a personal-data key
names something else and keeps its value. This repo passes
`{ settings: ['name'] }` (the personal-data entry under Domain gotchas
has the measure and the reasons). The mechanism stays the core's: the
walk carries the nearest enclosing key, the flat seats (headers, query
pairs, form-encoded pairs) know none and keep the personal reading, and
an exemption that names a credential or an undeclared key throws when
the engine is built — at this module's load, so in every suite.

`classifyError` keeps the thrown error on EVERY failure it describes
(`cause`), the `rate-limited` one included since 62.2.0. The descriptor
is for a caller that reads a `Result`; a caller that must throw again
needs the error itself. One does: below a building, a first Classic
frost-protection or holiday-mode write reads where the settings live
(`#getFrostProtectionLocation`, `#getHolidayModeLocation`; a building
knows from the listing's `FPDefined`/`HMDefined`), and
`throwLocationError` rethrows the failed read's `cause`. The gate's
refusal carried none, so that write threw `Error('Could not resolve
location: rate-limited')` where every other write throws
`RateLimitError` (reproduced on an area in
`tests/integration/api-lifecycle.test.ts`). `not-found` stays the one
kind with no `cause`: nothing was thrown.

The Home OIDC flow (`src/api/token-auth.ts`) drives `fetch` itself,
beside the transport: the multi-domain redirect chain needs its own
cookie jar and `redirect: 'manual'`. So nothing of the transport reaches
it unless it is handed over, and until 62.2.0 the timeout was not: a
sign-in or a renewal the server never answered ended on the caller's
`abortSignal` alone. `BaseAPI` now keeps the resolved transport's limit
(`timeoutMs`, the prebuilt client's `timeout` or the `{ timeoutMs }`
arm), and `HomeAPI` hands it to the flow with its abort as one
`RequestLimits`; the flow makes ONE signal per request, as the request
leaves (`requestSignal`: a timeout runs from the moment its signal is
made, so a signal made once for the whole flow would be a budget for
the ten-odd requests of a sign-in, not the per-request limit the
transport documents). A request past the limit rejects with the
`TimeoutError` the core classifies as a transport fault, hence the
transient paths above. `AbortSignal.timeout` does not run on vitest's
fake timers: the suite waits out a real 20 ms limit.

api-core 2.4.3 (adopted with 62.2.0) is behaviour only, and Home's
alone. `HomeAPI.reauthenticate` clears the session the server refused
before it tries to sign back in; with no credentials stored that
session is gone for good, and the clearing left the cycle's epilogue
reading a client that had never signed in, so `onAuthenticationLost`
never fired and the refresh stopped in silence. The core now announces
it from the reactive recovery itself: the kernel's "Home-only: a
refused session with no credentials behind it" clause, red against
2.4.2. `ClassicAPI` is untouched, by its own design: it does not clear
on a `401` (one can name an endpoint rather than the session), so with
no credentials it stays signed in over a context key the listing
refuses, and the cycle that ends there announces nothing (measured on
the Classic leg, 2026-11-23). Announcing there needs a verdict on which
`401` means a dead session, a rule the wire has not been measured for.

`ClassicFacadeManager.get` ships the typed required overloads,
`get(): null`, and ONE optional catch-all (`get(instance?: ClassicModel):
ClassicFacade | null`) — the shape the Home and heatzy managers had too
until 60.0.0 and heatzy-api's paired major dropped their `get(): null`
rung (one model class each, and their only production caller
null-checks the registry lookup first); the Classic manager keeps its
rung because its own `getById` feeds `get` the registry lookup's
`undefined`. The four typed optional mirrors it carried until 57.3.0
were cut as a BREAKING change (a caller holding `ClassicDevice<T> |
undefined` now reads `ClassicFacade | null` and narrows itself); no
family consumer held one — com.melcloud resolves by id through
`getById`. Owner's call 2026-09-14, cut alone rather than parked for a
bundled major.

api-core 1.3.0 (adopted with 56.0.0) crossed three more twins and one
test seat, every one additive on the core's side:

- `ValidationError` is the core's, forwarded like `RegistrySyncError`
  (by `src/errors/index.ts`, since 57.2.1 without a per-file shim). The
  class imports nothing from zod, so
  the zod coupling that keeps `parseOrThrow` here — the constructor of
  every `ValidationError` this SDK throws — never applied to it. Local
  class-level clauses moved out with it; the core pins them.
- `syncDevices` is the core's decorator factory, forwarded by
  `src/decorators/index.ts`, generic over this SDK's
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
  `matchObject` (the `Result` type and the vitest matcher shape this
  suite asserts on). Everything the three SDK suites carried as a
  hand-maintained twin comes from `@olivierzal/api-core/testing`:
  `cast`, `defined`, `mock`, `mockHttpResponse` (the `HttpResponse`
  envelope the transport spy answers with — 1.13.0; the local
  `mockResponse` twin and `classic-api.test.ts`'s `wrap` third copy
  went with 59.7.0),
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
  `scripts/`); two `wireNamingEntries` — the PascalCase/UPPER_CASE wire
  fields, the snake_case OAuth/Home/Homey vocabularies;
  `wireNamingFiles`, the ten globs of the layers that
  speak to MELCloud (the strict core applies to the rest); the
  `classic-flags.ts` no-magic-numbers ledger; `webviewFloorBlock` over
  the ten-module browser-reachable closure; and the
  `require-unicode-regexp` `u` pin over all of `src` (the last two are
  argued under Lint doctrine below).
- `vitest.config.ts`: the decorator transform pairing (`oxc: false` +
  `plugins: [swcPlugin]`, the shape the configs README prescribes), the
  coverage `include` (`src/**/*.ts`) and the test `include`
  (`tests/**/*.test.ts`). `clearMocks` left the ledger with vitest 5,
  which clears before every test by default.
- `tsconfig.json` `outDir`/`include`; `tsconfig.build.json`
  `outDir`/`rootDir`/`include`.
- `typedoc.config.js`: the identity (name, links, `hostedBaseUrl`,
  `categoryOrder`, `intentionallyNotExported`), the
  `externalSymbolLinkMappings` pointing core symbols at the api-core
  docs site and the `externalPattern` that keeps the core's members in
  this reference.

Do not re-declare family policy locally — a rule evaluation or version
bump happens in configs, adoption is a reviewed pin bump.
`tsconfig.json` and `tsconfig.build.json` both extend the plain
`tsconfig/library` base and keep only the path-bearing keys local
(`outDir`/`include`, plus `rootDir` on the build side): a base carrying
paths would resolve them against `node_modules`. The `-build` alias
bases configs used to ship were content-free `{ extends }` shells of
the plain ones and left with configs 5.0.0 — nothing here ever
extended them.
Ten workflows are stubs calling the family reusables in
OlivierZal/configs, pinned `@<sha> # vX.Y.Z`: `ci`, `claude`,
`claude-code-review`, `claude-issue-triage`, `dependabot`,
`dependency-review`, `pr-title`, `zizmor` (`claude-dependabot-fix` went
with configs 6.0.0, which retired that workflow and the
`.github/zizmor.yml` ignore that existed only for it — the file is back
since zizmor 1.31 for one line-scoped entry, the `claude` stub's
owner-gated `issue_comment`; the home-made
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
`.github/actions/setup-node-and-install` is gone since the configs
6.1.0 adoption: the called jobs reach configs' own copy through
`$/`, GitHub's self-repository syntax (the repository that defines the
workflow, at the running commit; GitHub.com only, runner 2.336.0 or
newer), and it
passes `npm-token` on both installs (the configs dependency lives on
GitHub Packages, where even reads need auth). The zizmor
`use-trusted-publishing` ignore that excused the local publish step
left with the step — the reusable's ignore lives in configs.
`.nvmrc` is the INSTALL floor, derived in configs from the tree it
imposes on every consumer (22.23.0 today, from `eslint-plugin-es-x`'s
`^22.23.0 || ^24.18.0 || >=26.4.0` — configs 7.0.0 declares the same
range as its own `engines`; `eslint-plugin-package-json`'s
`^22.22.2 || >=24.15.0`, the previous binding floor, is now the looser
one); it is not `engines`, which stays at the device floor (22.20 —
what the code needs where it runs). It moves with a configs adoption
that re-derives it, never by hand.

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
  documented with a `-- reason`: bitfield operators, parse-boundary
  casts, wire-imposed single-letter keys, namespace
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
- `/classic` and `/home` are the two NAMESPACED barrels, not flat
  modules: each re-exports the root's `Classic*` or `Home*` symbols with
  the prefix stripped, so `import * as Classic from '…/classic'` reads
  `Classic.API`, `Classic.FanSpeed`. That is their whole reason: a
  modern alternative to a TypeScript `namespace`, which this repo could
  not use for values anyway (`erasableSyntaxOnly`, top of this file).
  The README shows the usage only (owner's rule above): the reason
  lives here.
- The four SDK-internal decorators (`classicUpdateDevice`,
  `classicUpdateDevices`, `fetchDevices`, `syncDevices`) are NOT
  public since 56.0.0, by verdict: they bind to SDK internals
  (`classicUpdateDevices` takes `this: ClassicZoneFacade`,
  `fetchDevices` binds an explicit refresh callback typed against the
  host class), no repo in
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

## 60.0.0 — shipped 2026-10-14

Each item below was confirmed on `main` by an independent reading
(consumer grep over the eight repositories, behaviour trace, recorded
decisions): zero production hits outside this package, and each is a
semver major because it narrows or removes a published type or option.
None justified a 60.0.0 on its own — a major for nothing is the cost
this ledger refuses — so they rode the major together. The verdicts:

- **`ClassicAPIConfig.shouldVerifySSL` and `undici` — shipped in
  60.0.0** (the lead item). A TLS kill switch left a library that
  handles account credentials, and `undici` left the whole dependency
  tree (api-core does not carry it). Added deliberately in 5dd3293
  (2024-05), never asserted, never passed by a consumer; the sanctioned
  seam for a self-signed proxy is `transport: new HttpClient({
dispatcher })`.
- **Branded ids, made real — shipped in 60.0.0** (direction set by the
  owner, 2026-10-14: a brand is TypeScript's strength when it verifies
  something). A brand is minted in ONE place, the zod schema that reads
  the id off the wire: `ClassicAreaIdSchema` and its three siblings in
  `validation/schemas.ts` (`z.number().brand<'AreaID'>()`), seated in
  the `/User/ListDevices` schema's device header, building, floor and
  area entries — so the listing now validates the floor and area id
  fields and `Name` it reads, where it validated only the building's.
  `ClassicAreaID`/`ClassicBuildingID`/`ClassicDeviceID`/`ClassicFloorID`
  are `z.infer` of those schemas; the wire types, the models
  (`BaseModel<TId>`, `ClassicModel` the discriminated union), the
  facades (`id: T['id']`) and the registry's relationship indexes carry
  them, and the six lookups take them again (59.7.0's widening to
  `number` was the compatible step). Zero cast in `src` and `tests`: the
  `toClassic*Id` helpers, their `no-unsafe-type-assertion` block and
  the `__brand` lint exemption are gone; the fixture factories take
  plain numbers and mint through the schemas (`classicBuildingId(1)` is
  `ClassicBuildingIdSchema.parse(1)`). HOST-FACING lookups stay
  `number` — `getById` on the four collections, the manager's
  `getById`, `getErrorLog(query, deviceIds)` (so
  `ClassicErrorLogPostData.DeviceIDs` is `number`),
  `ClassicGetDeviceDataParams` — because a Homey device stores a plain
  number and a branded id is assignable to `number`; a host that holds
  a number reaches the entity by id and reads the brand off the model.
  The schemas stay out of the package exports (typedoc lists them as
  intentionally not exported) so no id can be minted outside the SDK.
- **`getTiles` flat shapes — shipped in 60.0.0**: one signature per
  layer, `ClassicTilesData`/`ClassicTilesPostData` non-generic, the
  `as` and its `mapResult` gone (0 callers in the family; the narrowed
  `SelectedDevice` was unsound in the not-in-zone branch).
- **`rangeForClassicMode` deleted — shipped in 60.0.0**: the Classic
  ATA facade calls `rangeForHomeMode(bounds, operationModeFromClassic[mode])`
  as the Home facade does (same result for the four input classes).
- **`HomeBaseDeviceFacade.clampValues` abstract — shipped in 60.0.0**:
  both Home types implement it; the 49.2.0 "type with no bounds to
  enforce" was the ERV, a Classic type.
- **`ClassicArea` without its phantom `T` — shipped in 60.0.0** (and
  `syncArea`; `ClassicAreaData` no longer extends `ClassicFloorData`,
  whose `ID` is a floor id).
- **`HomeFacadeManager.get(): null` rung — shipped in 60.0.0**, with
  heatzy-api's `FacadeManager.get` ladder in the paired release: the
  only production caller null-checks the registry lookup before calling.
- **Kept, not removed**: `TransportConfig`'s `{ timeoutMs }` arm. It is
  the deliberate successor of `requestTimeout` (PR #1477), and its
  removal would leave no public way to tune the timeout, the base URL
  being module-private. Documented in the README instead (59.7.1).

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
  Since configs 9.0.0 the job first judges that commit: the latest run
  of `ci.yml` on `main` for it must have succeeded, and a run still
  going is waited for (eight minutes at the most), so a release can be
  cut as soon as its pull request is merged. The docs build is held to
  the same step.
- Prerelease/alpha flow keeps `main` on the target stable version (no
  `-alpha` suffix): branch from `main`, bump, commit, push, open a pull
  request for the branch, then cut a prerelease release off that branch
  — which publishes under `next`. The pull request is what gives the
  commit a CI run, and a draft will do: the publish job refuses a
  prerelease whose commit no run of `ci.yml` has judged, on whichever
  branch. The nine alphas of July 2026 were cut without one, and none of
  their commits ever ran the CI. Close the pull request once the alpha
  is out. The release must target the pushed branch tip, so commit the
  version bump first (otherwise the tag lands on the un-bumped commit):

  ```sh title="alpha"
  git switch -c release/41.0.0-alpha.0
  npm version 41.0.0-alpha.0 --no-git-tag-version
  git commit -am 'chore(release): 41.0.0-alpha.0'
  git push -u origin release/41.0.0-alpha.0
  gh pr create --draft --fill
  gh release create v41.0.0-alpha.0 --target release/41.0.0-alpha.0 --prerelease
  ```

  Consumers install it with `@olivierzal/melcloud-api@next` (GitHub
  Packages needs `NODE_AUTH_TOKEN`).

- Downstream `com.melcloud` (sibling repo, uses `/classic` + `/home`)
  upgrades by pinning the dep to the new version (exact for a prerelease)
  then running its `typecheck`/`lint`/`test`/`build`; open the PR from that
  repo. A major bump's breaking surface is the CHANGELOG `[Unreleased]`
  section.
