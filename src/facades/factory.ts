import type { APIAdapter } from '../services/index.ts'

import { DeviceType } from '../constants.ts'
import {
  type DeviceModelAny,
  type Model,
  type ModelRegistry,
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models/index.ts'

import type { DeviceFacadeAny, Facade } from './interfaces.ts'

import { AreaFacade } from './area.ts'
import { BuildingFacade } from './building.ts'
import { DeviceAtaFacade } from './device-ata.ts'
import { DeviceAtwHasZone2Facade } from './device-atw-has-zone2.ts'
import { DeviceAtwFacade } from './device-atw.ts'
import { DeviceErvFacade } from './device-erv.ts'
import { FloorFacade } from './floor.ts'

const createDeviceFacade = (
  api: APIAdapter,
  registry: ModelRegistry,
  instance: DeviceModelAny,
): DeviceFacadeAny => {
  switch (instance.type) {
    case DeviceType.Ata: {
      return new DeviceAtaFacade(api, registry, instance)
    }
    case DeviceType.Atw: {
      if (instance.data.HasZone2) {
        return new DeviceAtwHasZone2Facade(api, registry, instance)
      }
      return new DeviceAtwFacade(api, registry, instance)
    }
    case DeviceType.Erv: {
      return new DeviceErvFacade(api, registry, instance)
    }
    // No default
  }
}

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

/**
 * Create the appropriate facade for a model instance based on its runtime type.
 * @param api - The API adapter for making requests.
 * @param registry - The model registry containing all synced models.
 * @param instance - The model instance to create a facade for.
 * @returns The facade matching the model's runtime type.
 */
export const createFacade = (
  api: APIAdapter,
  registry: ModelRegistry,
  instance: Model,
): Facade => {
  if (instance instanceof AreaModel) {
    return new AreaFacade(api, registry, instance)
  }
  if (instance instanceof BuildingModel) {
    return new BuildingFacade(api, registry, instance)
  }
  if (instance instanceof DeviceModel) {
    return createDeviceFacade(
      api,
      registry,
      getDeviceFromRegistry(registry, instance.id),
    )
  }
  if (instance instanceof FloorModel) {
    return new FloorFacade(api, registry, instance)
  }
  throw new Error('Model not supported')
}
