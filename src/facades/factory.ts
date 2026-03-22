import type { ModelRegistry } from '../models/index.ts'
import type {
  AreaModel,
  BuildingModel,
  DeviceModel,
  DeviceModelAny,
  FloorModel,
  Model,
  ModelKind,
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

type FacadeFactory = (
  api: APIAdapter,
  registry: ModelRegistry,
  instance: Model,
) => Facade

const deviceFacadeFactories: Record<
  DeviceType,
  (api: APIAdapter, registry: ModelRegistry, instance: DeviceModelAny) => DeviceFacadeAny
> = {
  [DeviceType.Ata]: (api, registry, instance) =>
    new DeviceAtaFacade(api, registry, instance),
  [DeviceType.Atw]: (api, registry, instance) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- type-narrowed by factory dispatch
    const atw = instance as DeviceModel<typeof DeviceType.Atw>
    return atw.data.HasZone2 ?
        new DeviceAtwHasZone2Facade(api, registry, instance)
      : new DeviceAtwFacade(api, registry, instance)
  },
  [DeviceType.Erv]: (api, registry, instance) =>
    new DeviceErvFacade(api, registry, instance),
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

const createDeviceFacade: FacadeFactory = (api, registry, instance) => {
  const device = getDeviceFromRegistry(registry, instance.id)
  return deviceFacadeFactories[device.type](api, registry, device)
}

const facadeFactories: Record<ModelKind, FacadeFactory> = {
  area: (api, registry, instance) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- dispatched by modelKind
    new AreaFacade(api, registry, instance as AreaModel),
  building: (api, registry, instance) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- dispatched by modelKind
    new BuildingFacade(api, registry, instance as BuildingModel),
  // eslint-disable-next-line perfectionist/sort-objects -- device is a pre-defined function reference
  device: createDeviceFacade,
  floor: (api, registry, instance) =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- dispatched by modelKind
    new FloorFacade(api, registry, instance as FloorModel),
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
  const factory = facadeFactories[instance.modelKind] as
    | FacadeFactory
    | undefined
  if (!factory) {
    throw new Error('Model not supported')
  }
  return factory(api, registry, instance)
}
