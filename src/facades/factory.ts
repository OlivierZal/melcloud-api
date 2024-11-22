import { DeviceType } from '../enums.js'
import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models/index.js'

import { AreaFacade } from './area.js'
import { BuildingFacade } from './building.js'
import { DeviceAtaFacade } from './device-ata.js'
import { DeviceAtwFacade } from './device-atw.js'
import { DeviceErvFacade } from './device-erv.js'
import { FloorFacade } from './floor.js'

import type { IModel } from '../models/interfaces.js'

import type { IDeviceFacadeAny, IFacade } from './interfaces.js'
import type { FacadeManager } from './manager.js'

type DeviceModelAny = DeviceModel<
  DeviceType.Ata | DeviceType.Atw | DeviceType.Erv
>

const isDeviceModelAta = (
  instance: DeviceModelAny,
): instance is DeviceModel<DeviceType.Ata> =>
  instance instanceof DeviceModel && instance.type === DeviceType.Ata

const isDeviceModelAtw = (
  instance: DeviceModelAny,
): instance is DeviceModel<DeviceType.Atw> =>
  instance instanceof DeviceModel && instance.type === DeviceType.Atw

const isDeviceModelErv = (
  instance: DeviceModelAny,
): instance is DeviceModel<DeviceType.Erv> =>
  instance instanceof DeviceModel && instance.type === DeviceType.Erv

const createDeviceFacade = <T extends DeviceType>(
  manager: FacadeManager,
  instance: DeviceModel<T>,
): IDeviceFacadeAny => {
  if (isDeviceModelAta(instance)) {
    return new DeviceAtaFacade(manager, instance)
  }
  if (isDeviceModelAtw(instance)) {
    return new DeviceAtwFacade(manager, instance)
  }
  if (isDeviceModelErv(instance)) {
    return new DeviceErvFacade(manager, instance)
  }
  throw new Error('Device model not supported')
}

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
    return createDeviceFacade(manager, instance)
  }
  if (instance instanceof FloorModel) {
    return new FloorFacade(manager, instance)
  }
  throw new Error('Model not supported')
}
