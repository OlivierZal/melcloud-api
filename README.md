# MELCloud API for Node.js

A typed Node.js client for the [MELCloud](https://app.melcloud.com/) API, providing access to Mitsubishi Electric air-to-air (Ata), air-to-water (Atw) and energy recovery ventilation (Erv) devices.

## Installation

```sh
npm install @olivierzal/melcloud-api
```

## Usage

```ts
import { MELCloudAPI } from '@olivierzal/melcloud-api'

const api = new MELCloudAPI(/* ... */)
await api.authenticate()
```

## Key exports

| Export | Description |
| --- | --- |
| `MELCloudAPI` | Main API client — authentication, device listing, commands |
| `FacadeManager` | High-level facade layer over devices and buildings |
| `AreaModel` `BuildingModel` `DeviceModel` `FloorModel` | Data models |
| `DeviceType` `OperationMode` `FanSpeed` … | Enums for device parameters |

## API documentation

Full generated API docs are available at **https://olivierzal.github.io/melcloud-api/**.

## License

ISC
