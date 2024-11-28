import { DeviceType } from '../enums.ts'
import {
  AreaModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
} from '../models/index.ts'

import { AreaFacade } from './area.ts'
import { BuildingFacade } from './building.ts'
import { DeviceAtaFacade } from './device-ata.ts'
import { DeviceAtwHasZone2Facade } from './device-atw-has-zone2.ts'
import { DeviceAtwFacade } from './device-atw.ts'
import { DeviceErvFacade } from './device-erv.ts'
import { FloorFacade } from './floor.ts'

import type { IModel } from '../models/interfaces.ts'
import type { IAPI } from '../services/interfaces.ts'

import type { IDeviceFacadeAny, IFacade } from './interfaces.ts'

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
  api: IAPI,
  instance: DeviceModel<T>,
): IDeviceFacadeAny => {
  if (isDeviceModelAta(instance)) {
    return new DeviceAtaFacade(api, instance)
  }
  if (isDeviceModelAtw(instance)) {
    if (instance.data.HasZone2) {
      return new DeviceAtwHasZone2Facade(api, instance)
    }
    return new DeviceAtwFacade(api, instance)
  }
  if (isDeviceModelErv(instance)) {
    return new DeviceErvFacade(api, instance)
  }
  throw new Error('Device model not supported')
}

export const createFacade = (api: IAPI, instance: IModel): IFacade => {
  if (instance instanceof AreaModel) {
    return new AreaFacade(api, instance)
  }
  if (instance instanceof BuildingModel) {
    return new BuildingFacade(api, instance)
  }
  if (instance instanceof DeviceModel) {
    return createDeviceFacade(api, instance)
  }
  if (instance instanceof FloorModel) {
    return new FloorFacade(api, instance)
  }
  throw new Error('Model not supported')
}
