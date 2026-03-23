A typed Node.js client for the [MELCloud](https://app.melcloud.com/) API, providing access to Mitsubishi Electric air-to-air (Ata), air-to-water (Atw) and energy recovery ventilation (Erv) devices.

## Installation

```sh
npm install @olivierzal/melcloud-api
```

## Quick start

```ts
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

## Documentation

Full API reference at <https://olivierzal.github.io/melcloud-api/>.

## License

ISC
