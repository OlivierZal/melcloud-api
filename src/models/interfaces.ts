import type { AreaModel, BuildingModel, DeviceModelAny, FloorModel } from '.'
import type { BuildingSettings, DeviceType, ListDevice } from '../types'

export interface IBaseModel {
  readonly id: number
  readonly name: string
}

interface IBaseSubBuildingModel {
  building: BuildingModel | null
  readonly buildingId: number
}

interface IBaseSuperDeviceModel {
  deviceIds: number[]
  devices: DeviceModelAny[]
}

export interface IBuildingModel extends IBaseModel, IBaseSuperDeviceModel {
  readonly data: BuildingSettings
}

export interface IAreaModel
  extends IBaseModel,
    IBaseSuperDeviceModel,
    IBaseSubBuildingModel {
  floor: FloorModel | null
  readonly floorId: number | null
}

export interface IFloorModel
  extends IBaseModel,
    IBaseSuperDeviceModel,
    IBaseSubBuildingModel {
  areaIds: number[]
  areas: AreaModel[]
}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseModel,
    IBaseSubBuildingModel {
  area: AreaModel | null
  floor: FloorModel | null
  readonly areaId: number | null
  readonly data: ListDevice[T]['Device']
  readonly floorId: number | null
  readonly type: T
}
