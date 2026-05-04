# @olivierzal/melcloud-api

A typed Node.js client for the [MELCloud](https://app.melcloud.com/) and [MELCloud Home](https://melcloudhome.com/) APIs, providing access to Mitsubishi Electric air-to-air (Ata), air-to-water (Atw) and energy recovery ventilation (Erv) devices.

[![License](https://img.shields.io/github/license/OlivierZal/melcloud-api)](LICENSE)
[![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlivierZal%2Fmelcloud-api%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=brightgreen)](package.json)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/melcloud-api?sort=semver)](https://github.com/OlivierZal/melcloud-api/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/melcloud-api/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/melcloud-api/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OlivierZal/melcloud-api/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/OlivierZal/melcloud-api/security/code-scanning)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_melcloud-api&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_melcloud-api)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_melcloud-api&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_melcloud-api&metric=coverage)
[![Docs coverage](https://olivierzal.github.io/melcloud-api/coverage.svg?v=2)](https://olivierzal.github.io/melcloud-api/)

## Features

- **Strongly typed** — full TypeScript types for both MELCloud Classic and MELCloud Home APIs, with 100% TSDoc coverage on the public surface.
- **Two APIs, one client** — Classic and Home behind consistent ergonomics; pick what your account uses.
- **Ata / Atw / Erv support** — air conditioners, heat pumps with hot water, and energy-recovery ventilation units.
- **Resilient by default** — auto-retry on transient failures, rate-limit awareness, pre-emptive session refresh.
- **Typed failures** — telemetry, reports and error-log getters return `Result<T>` so callers branch on `network` / `unauthorized` / `rate-limited` / `validation` / `server` instead of catching generic exceptions.
- **Tree-shakable** — `sideEffects: false` plus `/classic`, `/home` and `/constants` subpath exports for namespace-style imports.

## Requirements

- Node.js >= 22
- A valid MELCloud or MELCloud Home account
- For installing the package: a GitHub personal access token with the `read:packages` scope

## Installation

> [!IMPORTANT]
> This package is published to **GitHub Packages**, not the public npm registry.

Configure your project so npm fetches the `@olivierzal` scope from GitHub:

```ini title=".npmrc"
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
@olivierzal:registry=https://npm.pkg.github.com
```

`NODE_AUTH_TOKEN` must be a GitHub personal access token with the `read:packages` scope (export it in your shell or set it in your CI environment). Then:

```sh title="install"
npm install @olivierzal/melcloud-api
```

## Usage

### MELCloud (classic)

```ts title="classic"
import { ClassicAPI, ClassicFacadeManager } from '@olivierzal/melcloud-api'

const api = await ClassicAPI.create({
  username: 'user@example.com',
  password: 'password',
})

const manager = new ClassicFacadeManager(api, api.registry)

// Browse the device hierarchy
for (const zone of manager.getZones()) {
  console.log(zone.name)
}

// Interact with a device through its facade
const [device] = api.registry.getDevices()
if (device !== undefined) {
  const facade = manager.get(device)
  await facade.updateValues({ Power: true })
}
```

### MELCloud Home

```ts title="home"
import { HomeAPI, HomeFacadeManager } from '@olivierzal/melcloud-api'

const api = await HomeAPI.create({
  username: 'user@example.com',
  password: 'password',
})

await api.list()
const manager = new HomeFacadeManager(api)

// Interact with a device through its facade
const [device] = api.registry.getAll()
if (device !== undefined) {
  const facade = manager.get(device)
  console.log(facade.name, facade.operationMode, facade.setTemperature)
  await facade.updateValues({ setTemperature: 21 })
}
```

## Error handling

Best-effort getters (telemetry, reports, error logs, settings reads) return a `Result<T>` so callers can branch on the failure class — `network`, `unauthorized`, `rate-limited`, `validation`, or `server`. Mutations (`update*`, `updatePower`) keep their throw-on-failure contract.

```ts title="result"
const result = await facade.getEnergy({ from: '2024-01-01', to: '2024-12-31' })
if (!result.ok) {
  switch (result.error.kind) {
    case 'rate-limited':
      // result.error.retryAfterMs
      break
    case 'unauthorized':
      // re-authenticate before retrying
      break
    default:
      // network / server / validation — log and skip
  }
  return
}
const energy = result.value
```

## Imports

Exports follow a `Classic*` / `Home*` prefix convention so the target API is obvious at the call site. The `./classic` and `./home` subpaths re-export everything with the prefix stripped — a modern alternative to TypeScript's deprecated `namespace` keyword.

```ts title="imports"
// From the root — prefixed names, works in mixed Classic/Home contexts
import { ClassicAPI, HomeAPI, type ClassicGetDeviceData } from '@olivierzal/melcloud-api'

// From the Classic-scoped subpath — short names, no ambiguity
import { API, FanSpeed, type GetDeviceData } from '@olivierzal/melcloud-api/classic'

// From the Home-scoped subpath — short names
import { API, type AtaValues, type DeviceCapabilities } from '@olivierzal/melcloud-api/home'

// Namespace-like usage (recommended for mixed Classic + Home code)
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'
const a: Classic.GetDeviceData<0> = ...
const b: Home.AtaValues = ...

// Shared enum-like constants (e.g. CLASSIC_FLAG_UNCHANGED, HomeDeviceType)
import { ClassicDeviceType, HomeDeviceType } from '@olivierzal/melcloud-api/constants'
```

Available subpaths: `/classic`, `/home`, `/constants`.

## Documentation

Full API reference at <https://olivierzal.github.io/melcloud-api/>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

For vulnerability reports, see [SECURITY.md](SECURITY.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

> [!CAUTION]
> This API is not endorsed, verified or approved by Mitsubishi Electric Corporation. Mitsubishi cannot be held liable for any claims or damages that may occur when using this client to control MELCloud devices.

## License

[MIT](LICENSE) © Olivier Zalmanski
