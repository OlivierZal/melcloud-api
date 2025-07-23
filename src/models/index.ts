import { AreaModel } from './area.ts'
import { BuildingModel } from './building.ts'
import { DeviceModel } from './device.ts'
import { FloorModel } from './floor.ts'

const models = {
  areaModel: AreaModel,
  buildingModel: BuildingModel,
  deviceModel: DeviceModel,
  floorModel: FloorModel,
}

AreaModel.setModels(models)
BuildingModel.setModels(models)
DeviceModel.setModels(models)
FloorModel.setModels(models)

export type {
  IAreaModel,
  IBaseBuildingModel,
  IBaseDeviceModel,
  IBuildingModel,
  IDeviceModel,
  IDeviceModelAny,
  IFloorModel,
  IModel,
} from './interfaces.ts'

export { AreaModel } from './area.ts'
export { BuildingModel } from './building.ts'
export { DeviceModel } from './device.ts'
export { FloorModel } from './floor.ts'
