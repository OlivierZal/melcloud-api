import type { ModelRegistry } from '../models/index.ts'
import type {
  DeviceModelAny,
  Model,
} from '../models/interfaces.ts'
import type { APIAdapter } from '../services/index.ts'

import { DeviceType } from '../constants.ts'

import type { DeviceFacadeAny, Facade } from './interfaces.ts'

import { AreaFacade } from './area.ts'
import { BuildingFacade } from './building.ts'
import { DeviceAtaFacade } from './device-ata.ts'
import { DeviceAtwHasZone2Facade } from './device-atw-has-zone2.ts'
import { DeviceAtwFacade } from './device-atw.ts'
import { DeviceErvFacade } from './device-erv.ts'
import { FloorFacade } from './floor.ts'

const getDeviceFromRegistry = (
  registry: ModelRegistry,
  id: number,
): DeviceModelAny => {
  const device = registry.devices.getById(id)
  if (!device) {
    throw new Error('Device not found in registry')
  }
  return device
}

const createDeviceFacade = (
  api: APIAdapter,
  registry: ModelRegistry,
  instance: Model,
): DeviceFacadeAny => {
  const device = getDeviceFromRegistry(registry, instance.id)
  switch (device.type) {
    case DeviceType.Ata: {
      return new DeviceAtaFacade(api, registry, device)
    }
    case DeviceType.Atw: {
      if (device.data.HasZone2) {
        return new DeviceAtwHasZone2Facade(api, registry, device)
      }
      return new DeviceAtwFacade(api, registry, device)
    }
    case DeviceType.Erv: {
      return new DeviceErvFacade(api, registry, device)
    }
    // No default
  }
}

/**
 * Create the appropriate facade for a model instance based on its `modelKind` discriminant.
 * @param api - The API adapter for making requests.
 * @param registry - The model registry containing all synced models.
 * @param instance - The model instance to create a facade for.
 * @returns The facade matching the model's kind.
 */
export const createFacade = (
  api: APIAdapter,
  registry: ModelRegistry,
  instance: Model,
): Facade => {
  switch (instance.modelKind) {
    case 'area': {
      return new AreaFacade(api, registry, instance)
    }
    case 'building': {
      return new BuildingFacade(api, registry, instance)
    }
    case 'device': {
      return createDeviceFacade(api, registry, instance)
    }
    case 'floor': {
      return new FloorFacade(api, registry, instance)
    }
    // No default
  }
}
