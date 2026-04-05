A typed Node.js client for the [MELCloud](https://app.melcloud.com/) and [MELCloud Home](https://melcloudhome.com/) APIs, providing access to Mitsubishi Electric air-to-air (Ata), air-to-water (Atw) and energy recovery ventilation (Erv) devices.

## Installation

```sh title="install"
npm install @olivierzal/melcloud-api
```

## Quick start

### MELCloud (classic)

```ts title="classic"
import { FacadeManager, MELCloudAPI } from '@olivierzal/melcloud-api'

const api = await MELCloudAPI.create({
  username: 'user@example.com',
  password: 'password',
})

const manager = new FacadeManager(api, api.registry)

// Browse the device hierarchy
for (const zone of manager.getZones()) {
  console.log(zone.name)
}

// Interact with a device through its facade
const facade = manager.get(device)
await facade.setValues({ Power: true })
```

### MELCloud Home

```ts title="home"
import { HomeFacadeManager, MELCloudHomeAPI } from '@olivierzal/melcloud-api'

const api = await MELCloudHomeAPI.create({
  username: 'user@example.com',
  password: 'password',
})

await api.list()
const manager = new HomeFacadeManager(api)

// Interact with a device through its facade
const [device] = api.registry.getAll()
const facade = manager.get(device)
console.log(facade.name, facade.operationMode, facade.setTemperature)
await facade.setValues({ setTemperature: 21 })
```

## Documentation

Full API reference at <https://olivierzal.github.io/melcloud-api/>.

## Disclaimer

This API is not endorsed, verified or approved by Mitsubishi Electric Corporation. Mitsubishi cannot be held liable for any claims or damages that may occur when using this app to control MELCloud devices.

## License

ISC
