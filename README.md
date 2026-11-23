# @olivierzal/melcloud-api

A typed Node.js client for the [MELCloud](https://app.melcloud.com/) and [MELCloud Home](https://melcloudhome.com/) APIs, providing access to Mitsubishi Electric air-to-air (Ata), air-to-water (Atw) and energy recovery ventilation (Erv) devices.

[![License](https://img.shields.io/github/license/OlivierZal/melcloud-api)](https://github.com/OlivierZal/melcloud-api/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlivierZal%2Fmelcloud-api%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=brightgreen)](https://github.com/OlivierZal/melcloud-api/blob/main/package.json)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/melcloud-api?sort=semver)](https://github.com/OlivierZal/melcloud-api/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/melcloud-api/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/melcloud-api/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OlivierZal/melcloud-api/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/OlivierZal/melcloud-api/security/code-scanning)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_melcloud-api&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_melcloud-api)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_melcloud-api&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_melcloud-api&metric=coverage)
[![Docs coverage](https://olivierzal.github.io/melcloud-api/coverage.svg)](https://olivierzal.github.io/melcloud-api/)

## Features

- **Two APIs, one package**: `ClassicAPI` for MELCloud Classic, Mitsubishi Electric's original MELCloud service, and `HomeAPI` for MELCloud Home.
- **Three kinds of units**: air-to-air and air-to-water on both APIs, energy recovery ventilation on MELCloud Classic only.
- **Read and control**: one unit, or a whole building at once (a floor or an area too on MELCloud Classic).
- **One vocabulary**: frost protection, holiday mode, error log, charts, air-to-air groups and air-to-water state have the same shape on both APIs.
- **Charts and energy**: energy, temperatures, operation modes and Wi-Fi signal as chart data, and hourly energy in kWh on MELCloud Home.
- **Session handling**: the session is renewed before it expires and restored after a restart when you provide a store.
- **Failure handling**: a read returns a `Result` to branch on, a write throws a typed error.
- **Retries and rate limits**: a read is retried up to 4 times, a write never is, and a rate limit pauses every read and write until it lifts.
- **Safe logs**: credentials are masked in what the client logs and in the HTTP errors it throws.
- **Typed and tree-shakable**: ESM with type declarations, and subpaths a browser bundle can import for the constants and pure helpers.

## Requirements

- Node.js `>=22.20.0`, ESM only.
- A MELCloud Classic or MELCloud Home account.
- A GitHub personal access token with the `read:packages` scope, to install the package.

## Installation

The package is published to GitHub Packages, not the public npm registry. Point the `@olivierzal` scope at it, with the token in `NODE_AUTH_TOKEN`:

```ini title=".npmrc"
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
@olivierzal:registry=https://npm.pkg.github.com
```

Then install the package at an exact version:

```sh title="install"
npm install --save-exact @olivierzal/melcloud-api
```

Major versions are frequent: pin the version you tested, and read the changelog before you upgrade.

## Quick start

`create()` signs in and loads the account's devices. It does not throw when the sign-in fails: check `isAuthenticated()`. A manager then hands out facades: a facade is the object through which you read and control a unit or a building.

### MELCloud Classic

```ts title="classic"
import {
  ClassicAPI,
  ClassicDeviceType,
  ClassicFacadeManager,
} from '@olivierzal/melcloud-api'

const api = await ClassicAPI.create({
  username: 'user@example.com',
  password: 'password',
})
if (!api.isAuthenticated()) {
  throw new Error('Sign-in failed')
}

const manager = new ClassicFacadeManager(api)
const [device] = api.registry.getDevicesByType(ClassicDeviceType.Ata)
if (device !== undefined) {
  const facade = manager.get(device)
  console.log(facade.name, facade.power, facade.data.RoomTemperature)
  if (!facade.power) {
    await facade.updateValues({ Power: true, SetTemperature: 21 })
  }
}
```

### MELCloud Home

```ts title="home"
import {
  HomeAPI,
  HomeDeviceType,
  HomeFacadeManager,
} from '@olivierzal/melcloud-api'

const api = await HomeAPI.create({
  username: 'user@example.com',
  password: 'password',
})
if (!api.isAuthenticated()) {
  throw new Error('Sign-in failed')
}

const manager = new HomeFacadeManager(api)
const [device] = api.registry.getDevicesByType(HomeDeviceType.Ata)
if (device !== undefined) {
  const facade = manager.get(device)
  console.log(facade.name, facade.power, facade.roomTemperature)
  if (!facade.power) {
    await facade.updateValues({ power: true, setTemperature: 21 })
  }
}
```

## Usage

### Sign in and keep the session

`api.authenticate({ username, password })` signs in after `create()`, and throws when it fails: `AuthenticationError` when MELCloud refuses the credentials, `AuthenticationThrottledError` (a subclass of it, to test first) when it is blocking sign-ins for a while, `RegistrySyncError` when the sign-in went through but the devices could not be read, and the network or HTTP failure itself otherwise. `api.logOut()` forgets the session, the credentials and the devices.

To keep the session across restarts, pass a `settingManager`: a string store with `get`, `set` and an optional `unset`. The next `create()` restores the session from it, and needs no credentials. Without a store, everything stays in memory.

```ts title="setting-manager"
import { HomeAPI } from '@olivierzal/melcloud-api'

// Stands in for your own persistent storage
const store = new Map<string, string>()
const api = await HomeAPI.create({
  username: 'user@example.com',
  password: 'password',
  settingManager: {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value)
    },
  },
})
```

The keys are `username`, `password`, `expiry` and `loginBackoffUntil` for either client, plus `contextKey` for `ClassicAPI`, and `accessToken` and `refreshToken` for `HomeAPI`. When one store serves both clients, give each its own key prefix in your `get` and `set`.

> [!IMPORTANT]
> The store receives the account password and the session tokens as plain strings. Back it with secure storage.

The client renews the session when it is within 5 minutes of expiry. On a 401, it signs in again once and replays the request once. When the session cannot be recovered, it calls `events.onAuthenticationLost` once, and stops refreshing the devices until `authenticate()` succeeds.

### Find devices, buildings and zones

`api.registry` holds what the account contains: `getDevices()`, `getDevicesByType(type)`, `getBuildings()`, and `getZones()`, a flat list made for a picker. The Classic registry also knows floors and areas.

`manager.get(model)` returns the facade of a registry entry. To look one up by id: `getById('devices', id)` on MELCloud Classic (also `'buildings'`, `'floors'` and `'areas'`), `getById(id)` or `getBuilding(id)` on MELCloud Home. Each returns `null` for an unknown id. On MELCloud Home, `get` takes a device of a known kind: one from `getDevicesByType`, or one narrowed with `device.isAta()` or `device.isAtw()`. Guards such as `isClassicAtwFacade` and `isHomeAtaFacade` narrow a device facade to its kind.

The client refreshes the registry by itself, every 5 minutes on MELCloud Classic and every minute on MELCloud Home: `syncIntervalMinutes` changes the cadence, and `false` turns it off. `api.fetch()` refreshes on demand, and returns an empty list instead of throwing. `events.onSyncComplete` is called after each successful refresh and each write. The timer does not keep the Node.js process alive. To shut a client down, call `api[Symbol.dispose]()`, and abort the `abortSignal` you gave `create()` to cancel its requests.

### Read and control a device

Every device facade has `name`, `power`, `rssi`, `isAvailable` (`false` after a day without contact with MELCloud), and `isInError` and `errorMessage` (a fault the unit itself reports). MELCloud Classic keeps the other values in `facade.data`, under MELCloud's own names (`RoomTemperature`, `SetTemperature`). MELCloud Home has a property for each (`roomTemperature`, `setTemperature`). An air-to-water facade adds `hotWater`, `zone1` and `zone2`.

`updateValues` writes the fields you pass. On an air-to-air unit they are `Power`, `OperationMode`, `SetTemperature`, `SetFanSpeed`, `VaneHorizontal` and `VaneVertical` on MELCloud Classic, with values from the `Classic*` constants (`ClassicOperationMode.heat`), and `power`, `operationMode`, `setTemperature`, `setFanSpeed`, `vaneHorizontalDirection` and `vaneVerticalDirection` on MELCloud Home, with string values (`'Heat'`), where `inStandbyMode` and `temperatureIncrementOverride` exist too. `updatePower(true)` only switches a unit on, `updatePower(false)` off.

A setpoint is clamped to the range the unit accepts before it is sent. A write that would change nothing throws `NoChangesError` and sends nothing: on MELCloud Classic when the registry already holds every value, on MELCloud Home when you pass no value. After a write, the registry holds the new state.

### Control several units at once

A group is the air-to-air units of a building: `manager.getById('buildings', id)` on MELCloud Classic (a floor or an area too, with `'floors'` and `'areas'`), `manager.getBuilding(id)` on MELCloud Home. Both read and write one state, `ClassicGroupState`, with values from the `Classic*` constants on either API:

```ts title="group"
import { type AtaGroup, ClassicOperationMode } from '@olivierzal/melcloud-api'

const heat = async (group: AtaGroup): Promise<void> => {
  const state = await group.getGroup()
  if (state.ok && state.value.Power !== true) {
    await group.updateGroupState({
      OperationMode: ClassicOperationMode.heat,
      Power: true,
      SetTemperature: 21,
    })
  }
}
```

On a read, a `null` field means the units differ. On a write, a field that is left out or `null` stays as it is. A building facade also switches every unit it covers with `updatePower(true)`. `combineAtaGroups([a, b])` makes one group of several, for a house split between two accounts: it reads all of them or fails, and writes to every one of them, without rollback.

### Set frost protection, holiday mode and overheat protection

Every facade reads and writes frost protection and holiday mode: Classic buildings, floors, areas and devices, Home devices and buildings.

```ts title="settings"
import type { SettingsTarget } from '@olivierzal/melcloud-api'

const leaveForAWeek = async (target: SettingsTarget): Promise<void> => {
  await target.updateFrostProtection({ isEnabled: true, max: 12, min: 8 })
  await target.updateHolidayMode({
    endDate: '2027-02-21T18:00:00',
    isEnabled: true,
    startDate: '2027-02-14T08:00:00',
  })
}
```

`getFrostProtection()` and `getHolidayMode()` return a `Result` on both APIs, its `value` `null` when the setting was never configured. A Home building returns the values its units share, and `null` for a field they differ on. Frost protection bounds are clamped to 4 to 16 °C, with at least 2 °C between `min` and `max`. Holiday dates are wall-clock times in the `timezone` you gave `create()`, or in the host's time zone, and holiday mode reads `isEnabled: false` once its window has ended.

Overheat protection (`getOverheatProtection()`, `updateOverheatProtection(update)`, 31 to 40 °C) exists on MELCloud Home only, for air-to-air units and the buildings that hold one. `combineSettingsTargets([a, b])` handles frost protection and holiday mode over several targets as one.

### Read charts, energy and the error log

Every device facade has `getEnergyReport(query?)`, `getTemperatures(query?)` and `getSignalStrength(hour?)`. Classic device facades and the Home air-to-water facade also have `getHourlyTemperatures(hour?)`, `getInternalTemperatures(query?)` and `getOperationModes(query?)`. `query` is `{ from?, to? }` in ISO dates, and `hour` is an hour of the current day, from 0 to 23.

A chart comes back as `labels` and `series`, ready for a plotting library. Labels follow the `locale` option of `create()`, the runtime's by default. On MELCloud Home, pass `timezone` as well: without it, charts are on UTC.

On MELCloud Home, `getEnergySeries({ from, to })` returns hourly energy as numbers: `{ consumed }` on an air-to-air unit, `{ consumed, produced }` on an air-to-water unit, each a list of `{ atEpochMs, kilowattHours }` points, oldest first. `atEpochMs` is the start of the hour, `to` is exclusive, and a value MELCloud garbles reads `null`.

`getErrorLog(query)` on a MELCloud Classic facade returns a page of `entries`, with the `nextFromDate` and `nextToDate` to pass as `from` and `to` for the next older page. `getErrorLog()` on a MELCloud Home device facade returns the whole log. Entries have one shape on both, `ErrorLogEntry`.

### Handle failures

A read that calls MELCloud does not throw on a network, HTTP or validation failure. It returns `{ ok: true, value }` or `{ ok: false, error }`. A write throws.

```ts title="failures"
import {
  type HomeDeviceAtaFacade,
  type ReportSurface,
  logFailure,
} from '@olivierzal/melcloud-api'

const readEnergy = async (facade: ReportSurface): Promise<void> => {
  const result = await facade.getEnergyReport({ from: '2026-11-01' })
  if (result.ok) {
    console.log(result.value.labels, result.value.series)
  } else if (result.error.kind === 'rate-limited') {
    console.log('Paused for', result.error.retryAfterMs, 'ms')
  } else {
    console.log('Read failed:', result.error.kind)
  }
}

const switchOff = async (facade: HomeDeviceAtaFacade): Promise<void> => {
  try {
    await facade.updatePower(false)
  } catch (error) {
    logFailure(console, 'Write failed:', error)
  }
}
```

`error.kind` is `network`, `unauthorized`, `rate-limited` (with `retryAfterMs`), `validation` (the answer does not have the expected shape, with `issue`), `server` (any other HTTP error, with `status`) or `not-found` (MELCloud Home only: the unit has left the account, with `entityId`).

A write throws `NoChangesError`, `UpdateRejectedError` when MELCloud Classic rejects a value (`attributeErrors` holds its messages per field), `RateLimitError` while requests are paused, `EntityNotFoundError` when the unit has left the account (`facade.exists` checks without throwing), `HttpError` when MELCloud answers an error status, or the network failure itself. All but the last two extend `APIError`, and `isAPIError` and `isHttpError` tell them apart. `logFailure(logger, label, error)` logs any of them on one line: the label, then the error and its causes. It logs anything else with its stack. A write to several units at once (a Home building, a combined group or target) throws a single failure as itself and several as one `AggregateError`.

### Retries, rate limits and timeouts

- A read is retried up to 4 times on a 500, 502, 503 or 504 answer, a failed connection or a timeout, after about 1, 2, 4 and 8 seconds. A write is never retried on those failures: one that MELCloud may have applied is not sent twice. A request you abort is not retried either.
- After a 429 answer, the client holds every read and write for as long as MELCloud asks in `Retry-After` (a number of seconds or a date), or for 2 hours when it gives none. Meanwhile a read returns `rate-limited`, a write throws `RateLimitError` (with `retryAfter` and `unblockAt`), and `api.isRateLimited` is `true`.
- A request times out after 30 seconds. `transport: { timeoutMs }` changes that, and `0` removes the limit (not recommended). The limit holds for every request the client makes, those of a MELCloud Home sign-in and session renewal included.

### Logs and events

`logger` takes any object with `log` and `error`, and defaults to `console`. The client logs each request and each response through `log` (the MELCloud Home sign-in exchange apart) and failures through `error`, prefixed `[Classic]` or `[Home]`. In those lines, and in the request and response a thrown `HttpError` carries, credentials and personal data read `******`: tokens, passwords, email addresses, device names, the account holder's name, postal addresses, coordinates, MAC and IP addresses. Building, floor and area names stay readable.

`events` takes callbacks: `onRequestStart`, `onRequestComplete`, `onRequestRetry` and `onRequestError` around each request, `onSyncComplete`, `onAuthenticationLost` and `onAuthenticationRestored`. A callback that throws is ignored.

### Choose an entry point

At the root, a name that belongs to one API carries a `Classic` or `Home` prefix. `/classic` and `/home` export the same symbols without it: `ClassicAPI` is `API` in `/classic` (one type apart: `ErrorLogEntry` in `/home` is the shared entry, not `HomeErrorLogEntry`). The root, `/classic` and `/home` need Node.js. The other subpaths hold constants, types and pure functions that a browser bundle can import: `/constants` (the enum-like constants), `/enum-mappings` (records that translate values between the two APIs, such as `operationModeFromClassic`), `/protection`, `/holiday-mode`, `/error-log` and `/temperature-range` (the types and helpers of those features), `/atw-state` and `/report` (types), and `/temporal` (`Temporal` and `Intl`).

```ts title="imports"
import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'
import { clampFrostProtection } from '@olivierzal/melcloud-api/protection'

const fanSpeed: Classic.FanSpeed = Classic.FanSpeed.auto
const values: Home.AtaValues = { setFanSpeed: 'Auto', setTemperature: 21 }
// `/protection` alone can go in a browser bundle: returns { max: 16, min: 4 }
const bounds = clampFrostProtection(2, 20)
```

## API reference

The generated reference is at <https://olivierzal.github.io/melcloud-api/>. It documents every symbol the root exports, under its prefixed name, with its options and types, grouped by category.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report a problem on the [issue tracker](https://github.com/OlivierZal/melcloud-api/issues).

## Security

For vulnerability reports, see [SECURITY.md](SECURITY.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## Disclaimer

This API is not endorsed, verified or approved by Mitsubishi Electric Corporation. Mitsubishi cannot be held liable for any claims or damages that may occur when using this client to control MELCloud devices.

## License

[MIT](LICENSE) © Olivier Zalmanski
