import type { ClassicAPIAdapter } from '../api/index.ts'
import { ClassicDeviceType } from '../constants.ts'
import {
  type ClassicDeviceAny,
  type ClassicModel,
  isClassicDeviceOfType,
} from '../entities/index.ts'
import type { ClassicDeviceFacadeAny, ClassicFacade } from './classic-types.ts'
import { ClassicAreaFacade } from './classic-area.ts'
import { ClassicBuildingFacade } from './classic-building.ts'
import { ClassicDeviceAtaFacade } from './classic-device-ata.ts'
import { ClassicDeviceAtwFacade } from './classic-device-atw.ts'
import { ClassicDeviceErvFacade } from './classic-device-erv.ts'
import { ClassicFloorFacade } from './classic-floor.ts'

const getDeviceFromRegistry = (
  api: ClassicAPIAdapter,
  id: number,
): ClassicDeviceAny => {
  const device = api.registry.devices.getById(id)
  if (device === undefined) {
    throw new Error('ClassicDevice not found in registry')
  }
  return device
}

const createDeviceFacade = (
  api: ClassicAPIAdapter,
  instance: ClassicModel,
): ClassicDeviceFacadeAny => {
  const device = getDeviceFromRegistry(api, instance.id)
  if (isClassicDeviceOfType(device, ClassicDeviceType.Ata)) {
    return new ClassicDeviceAtaFacade(api, device)
  }
  return isClassicDeviceOfType(device, ClassicDeviceType.Atw)
    ? new ClassicDeviceAtwFacade(api, device)
    : new ClassicDeviceErvFacade(api, device)
}

/**
 * Create the appropriate facade for a model instance based on its `modelKind` discriminant.
 * @param api - The API adapter for making requests; its registry is the
 * one every facade reads.
 * @param instance - The model instance to create a facade for.
 * @returns The facade matching the model's kind.
 * @category Facades
 */
export const createFacade = (
  api: ClassicAPIAdapter,
  instance: ClassicModel,
): ClassicFacade => {
  switch (instance.modelKind) {
    case 'area': {
      return new ClassicAreaFacade(api, instance)
    }
    case 'building': {
      return new ClassicBuildingFacade(api, instance)
    }
    case 'device': {
      return createDeviceFacade(api, instance)
    }
    case 'floor': {
      return new ClassicFloorFacade(api, instance)
    }
  }
}
