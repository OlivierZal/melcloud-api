import type { ClassicAPIAdapter } from '../api/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import {
  type ClassicDeviceAny,
  type ClassicModel,
  type ClassicRegistry,
  isClassicDeviceOfType,
} from '../entities/index.ts'
import type { ClassicDeviceFacadeAny, ClassicFacade } from './classic-types.ts'
import { ClassicAreaFacade } from './classic-area.ts'
import { ClassicBuildingFacade } from './classic-building.ts'
import { ClassicDeviceAtaFacade } from './classic-device-ata.ts'
import { ClassicDeviceAtwHasZone2Facade } from './classic-device-atw-dual-zone.ts'
import { ClassicDeviceAtwFacade } from './classic-device-atw.ts'
import { ClassicDeviceErvFacade } from './classic-device-erv.ts'
import { ClassicFloorFacade } from './classic-floor.ts'

const getDeviceFromRegistry = (
  registry: ClassicRegistry,
  id: number,
): ClassicDeviceAny => {
  const device = registry.devices.getById(id)
  if (!device) {
    throw new Error('ClassicDevice not found in registry')
  }
  return device
}

const createDeviceFacade = (
  api: ClassicAPIAdapter,
  registry: ClassicRegistry,
  instance: ClassicModel,
): ClassicDeviceFacadeAny => {
  const device = getDeviceFromRegistry(registry, instance.id)
  if (isClassicDeviceOfType(device, ClassicDeviceType.Ata)) {
    return new ClassicDeviceAtaFacade(api, registry, device)
  }
  if (isClassicDeviceOfType(device, ClassicDeviceType.Atw)) {
    return device.data.HasZone2 ?
        new ClassicDeviceAtwHasZone2Facade(api, registry, device)
      : new ClassicDeviceAtwFacade(api, registry, device)
  }
  return new ClassicDeviceErvFacade(api, registry, device)
}

/**
 * Create the appropriate facade for a model instance based on its `modelKind` discriminant.
 * @param api - The API adapter for making requests.
 * @param registry - The model registry containing all synced models.
 * @param instance - The model instance to create a facade for.
 * @returns The facade matching the model's kind.
 * @category Facades
 */
export const createFacade = (
  api: ClassicAPIAdapter,
  registry: ClassicRegistry,
  instance: ClassicModel,
): ClassicFacade => {
  switch (instance.modelKind) {
    case 'area': {
      return new ClassicAreaFacade(api, registry, instance)
    }
    case 'building': {
      return new ClassicBuildingFacade(api, registry, instance)
    }
    case 'device': {
      return createDeviceFacade(api, registry, instance)
    }
    case 'floor': {
      return new ClassicFloorFacade(api, registry, instance)
    }
  }
}
