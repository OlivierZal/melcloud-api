import { AreaModel, type AreaModelAny } from './area.js'
import { BaseModel } from './base.js'
import { BuildingModel } from './building.js'
import { DeviceModel, type DeviceModelAny } from './device.js'
import { FloorModel } from './floor.js'

import type {
  IAreaModel,
  IBaseModel,
  IBaseSubBuildingModel,
  IBaseSubFloorModel,
  IBaseSuperAreaModel,
  IBaseSuperDeviceModel,
  IBuildingModel,
  IDeviceModel,
  IFloorModel,
} from './interfaces.js'

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

export {
  AreaModel,
  BaseModel,
  BuildingModel,
  DeviceModel,
  FloorModel,
  type AreaModelAny,
  type DeviceModelAny,
  type IAreaModel,
  type IBaseModel,
  type IBaseSubBuildingModel,
  type IBaseSubFloorModel,
  type IBaseSuperAreaModel,
  type IBaseSuperDeviceModel,
  type IBuildingModel,
  type IDeviceModel,
  type IFloorModel,
}
