A typed Node.js client for the [MELCloud](https://app.melcloud.com/) and [MELCloud Home](https://melcloudhome.com/) APIs, providing access to Mitsubishi Electric air-to-air (Ata), air-to-water (Atw) and energy recovery ventilation (Erv) devices.

## Installation

```sh title="install"
npm install @olivierzal/melcloud-api
```

## Quick start

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
const facade = manager.get(device)
await facade.updateValues({ Power: true })
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
const facade = manager.get(device)
console.log(facade.name, facade.operationMode, facade.setTemperature)
await facade.updateValues({ setTemperature: 21 })
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

// Module-scoped subpaths for fine-grained imports (tree-shaking hints)
import { NoChangesError } from '@olivierzal/melcloud-api/errors'
import type { ClassicGetDeviceData } from '@olivierzal/melcloud-api/types'
```

Available subpaths: `/classic`, `/home`, `/api`, `/constants`, `/decorators`, `/entities`, `/enum-mappings`, `/errors`, `/facades`, `/observability`, `/resilience`, `/types`.

## Documentation

Full API reference at <https://olivierzal.github.io/melcloud-api/>.

## Disclaimer

This API is not endorsed, verified or approved by Mitsubishi Electric Corporation. Mitsubishi cannot be held liable for any claims or damages that may occur when using this app to control MELCloud devices.

## License

ISC
