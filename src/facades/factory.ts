import type { IAPI } from '../services/index.ts'

import { DeviceType } from '../enums.ts'
import {
  type IDeviceModelAny,
  type IModel,
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
  api: IAPI,
  instance: IDeviceModelAny,
): IDeviceFacadeAny => {
  switch (instance.type) {
    case DeviceType.Ata: {
      return new DeviceAtaFacade(api, instance)
    }
    case DeviceType.Atw: {
      if (instance.data.HasZone2) {
        return new DeviceAtwHasZone2Facade(api, instance)
      }
      return new DeviceAtwFacade(api, instance)
    }
    case DeviceType.Erv: {
      return new DeviceErvFacade(api, instance)
    }
    // No default
  }
}

export const createFacade = (api: IAPI, instance: IModel): IFacade => {
  if (instance instanceof AreaModel) {
    return new AreaFacade(api, instance)
  }
  if (instance instanceof BuildingModel) {
    return new BuildingFacade(api, instance)
  }
  if (instance instanceof DeviceModel) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- DeviceModel instances are always one of the three DeviceType variants
    return createDeviceFacade(api, instance as IDeviceModelAny)
  }
  if (instance instanceof FloorModel) {
    return new FloorFacade(api, instance)
  }
  throw new Error('Model not supported')
}
