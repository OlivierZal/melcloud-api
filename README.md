# MELCloud API for Node.js

A typed Node.js client for the [MELCloud](https://app.melcloud.com/) API, providing access to Mitsubishi Electric air-to-air (Ata), air-to-water (Atw) and energy recovery ventilation (Erv) devices.

## Installation

```sh
npm install @olivierzal/melcloud-api
```

## Quick start

```ts
import { FacadeManager, MELCloudAPI } from '@olivierzal/melcloud-api'

// Create and authenticate
const api = await MELCloudAPI.create({
  username: 'user@example.com',
  password: 'password',
})

// Browse the device hierarchy
const manager = new FacadeManager(api, api.registry)
for (const zone of manager.getZones()) {
  console.log(zone.name)
}

// Read and update a device
const device = api.registry.devices.getById(deviceId)
const facade = manager.get(device)
const values = await facade.getValues()
await facade.setValues({ Power: true })
```

## Key exports

| Export | Description |
| --- | --- |
| `MELCloudAPI` | Main API client — authentication, device listing, commands |
| `FacadeManager` | High-level facade layer over devices and buildings |
| `AreaModel` `BuildingModel` `DeviceModel` `FloorModel` | Data models |
| `ModelRegistry` | Central registry of all synced models |
| `fetchDevices` `syncDevices` `updateDevice` `updateDevices` | Decorators for device lifecycle hooks |
| `DeviceType` `FanSpeed` `OperationMode` `Horizontal` `Vertical` … | Enums for device parameters |

## Configuration

`MELCloudAPI.create()` accepts an optional config object:

| Option | Description |
| --- | --- |
| `username` / `password` | MELCloud credentials |
| `settingManager` | Persistent storage adapter for credentials and tokens |
| `autoSyncInterval` | Interval (ms) for automatic device sync (`0` to disable) |
| `language` | API language |
| `timezone` | Timezone for date/time values |
| `logger` | Custom logger |
| `onSync` | Callback invoked after each device sync |
| `shouldVerifySSL` | Whether to verify SSL certificates |

## License

ISC
