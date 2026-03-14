import type { IAPIAdapter } from '../services/index.ts'

import { DeviceType } from '../enums.ts'
import {
  type IDeviceModelAny,
  type IModel,
  type ModelRegistry,
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models/index.ts'

import type { IDeviceFacadeAny, IFacade } from './interfaces.ts'

import { AreaFacade } from './area.ts'
import { BuildingFacade } from './building.ts'
import { DeviceAtaFacade } from './device-ata.ts'
import { DeviceAtwHasZone2Facade } from './device-atw-has-zone2.ts'
import { DeviceAtwFacade } from './device-atw.ts'
import { DeviceErvFacade } from './device-erv.ts'
import { FloorFacade } from './floor.ts'

const createDeviceFacade = (
  api: IAPIAdapter,
  registry: ModelRegistry,
  instance: IDeviceModelAny,
): IDeviceFacadeAny => {
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

/** Create the appropriate facade for a model instance based on its runtime type. */
export const createFacade = (
  api: IAPIAdapter,
  registry: ModelRegistry,
  instance: IModel,
): IFacade => {
  if (instance instanceof AreaModel) {
    return new AreaFacade(api, registry, instance)
  }
  if (instance instanceof BuildingModel) {
    return new BuildingFacade(api, registry, instance)
  }
  if (instance instanceof DeviceModel) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DeviceModel instances are always one of the three DeviceType variants
    return createDeviceFacade(api, registry, instance as IDeviceModelAny)
  }
  if (instance instanceof FloorModel) {
    return new FloorFacade(api, registry, instance)
  }
  throw new Error('Model not supported')
}
