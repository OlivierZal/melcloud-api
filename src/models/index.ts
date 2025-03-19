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

export { AreaModel, BuildingModel, DeviceModel, FloorModel }
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
