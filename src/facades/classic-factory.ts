import type { ClassicAPIAdapter } from '../api/index.ts'
import type { ClassicRegistry, DeviceAny, Model } from '../entities/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import type { DeviceFacadeAny, Facade } from './interfaces.ts'
import { AreaFacade } from './classic-area.ts'
import { BuildingFacade } from './classic-building.ts'
import { ClassicDeviceAtaFacade } from './classic-device-ata.ts'
import { ClassicDeviceAtwHasZone2Facade } from './classic-device-atw-has-zone2.ts'
import { ClassicDeviceAtwFacade } from './classic-device-atw.ts'
import { ClassicDeviceErvFacade } from './classic-device-erv.ts'
import { FloorFacade } from './classic-floor.ts'

const getDeviceFromRegistry = (
  registry: ClassicRegistry,
  id: number,
): DeviceAny => {
  const device = registry.devices.getById(id)
  if (!device) {
    throw new Error('ClassicDevice not found in registry')
  }
  return device
}

const createDeviceFacade = (
  api: ClassicAPIAdapter,
  registry: ClassicRegistry,
  instance: Model,
): DeviceFacadeAny => {
  const device = getDeviceFromRegistry(registry, instance.id)
  switch (device.type) {
    case ClassicDeviceType.Ata: {
      return new ClassicDeviceAtaFacade(api, registry, device)
    }
    case ClassicDeviceType.Atw: {
      return device.data.HasZone2 ?
          new ClassicDeviceAtwHasZone2Facade(api, registry, device)
        : new ClassicDeviceAtwFacade(api, registry, device)
    }
    case ClassicDeviceType.Erv: {
      return new ClassicDeviceErvFacade(api, registry, device)
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
  api: ClassicAPIAdapter,
  registry: ClassicRegistry,
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
