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

import type { Model } from '../models/interfaces.js'

import type { IFacade } from './interfaces.js'
import type { FacadeManager } from './manager.js'

export const createFacade = (
  manager: FacadeManager,
  instance: Model,
): IFacade => {
  if (instance instanceof AreaModel) {
    return new AreaFacade(manager, instance)
  }
  if (instance instanceof BuildingModel) {
    return new BuildingFacade(manager, instance)
  }
  if (instance instanceof DeviceModel) {
    switch (instance.type) {
      case 'Ata':
        return new DeviceAtaFacade(manager, instance)
      case 'Atw':
        return new DeviceAtwFacade(manager, instance)
      case 'Erv':
        return new DeviceErvFacade(manager, instance)
      default:
    }
  }
  if (instance instanceof FloorModel) {
    return new FloorFacade(manager, instance)
  }
  throw new Error('Model not supported')
}
