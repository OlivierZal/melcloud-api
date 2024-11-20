import { DeviceType } from '../enums.js'
import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models/index.js'

import { AreaFacade } from './area.js'
import { BuildingFacade } from './building.js'
import { DeviceAtaFacade } from './device_ata.js'
import { DeviceAtwFacade } from './device_atw.js'
import { DeviceErvFacade } from './device_erv.js'
import { FloorFacade } from './floor.js'

import type { IDeviceModel, IModel } from '../models/interfaces.js'

import type { IFacade } from './interfaces.js'
import type { FacadeManager } from './manager.js'

export const createFacade = (
  manager: FacadeManager,
  instance: IModel,
): IFacade => {
  if (instance instanceof AreaModel) {
    return new AreaFacade(manager, instance)
  }
  if (instance instanceof BuildingModel) {
    return new BuildingFacade(manager, instance)
  }
  if (instance instanceof DeviceModel) {
    switch (instance.type) {
      case DeviceType.Ata:
        return new DeviceAtaFacade(
          manager,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          instance as IDeviceModel<DeviceType.Ata>,
        )
      case DeviceType.Atw:
        return new DeviceAtwFacade(
          manager,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          instance as IDeviceModel<DeviceType.Atw>,
        )
      case DeviceType.Erv:
        return new DeviceErvFacade(
          manager,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          instance as IDeviceModel<DeviceType.Erv>,
        )
      default:
    }
  }
  if (instance instanceof FloorModel) {
    return new FloorFacade(manager, instance)
  }
  throw new Error('Model not supported')
}
