import { AreaModel, type AreaModelAny } from './area'
import { BaseModel } from './base'
import { BuildingModel } from './building'
import { DeviceModel, type DeviceModelAny } from './device'
import { FloorModel } from './floor'

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
} from './interfaces'

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
