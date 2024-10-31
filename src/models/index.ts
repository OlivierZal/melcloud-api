import { AreaModel } from './area.js'
import { BuildingModel } from './building.js'
import { DeviceModel } from './device.js'
import { FloorModel } from './floor.js'

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
