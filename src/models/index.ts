import { AreaModel } from './area.js'
import { BaseModel } from './base.js'
import { BuildingModel } from './building.js'
import { DeviceModel } from './device.js'
import { FloorModel } from './floor.js'

AreaModel.setBuildingModel(BuildingModel)
AreaModel.setDeviceModel(DeviceModel)
AreaModel.setFloorModel(FloorModel)
BuildingModel.setAreaModel(AreaModel)
BuildingModel.setDeviceModel(DeviceModel)
BuildingModel.setFloorModel(FloorModel)
DeviceModel.setAreaModel(AreaModel)
DeviceModel.setBuildingModel(BuildingModel)
DeviceModel.setFloorModel(FloorModel)
FloorModel.setAreaModel(AreaModel)
FloorModel.setBuildingModel(BuildingModel)
FloorModel.setDeviceModel(DeviceModel)

export { AreaModel, BaseModel, BuildingModel, DeviceModel, FloorModel }
