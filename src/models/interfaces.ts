import type { BuildingSettings, DeviceType, ListDevice } from '../types'
import type { default as AreaModel, AreaModelAny } from './area'
import type BuildingModel from './building'
import type { DeviceModelAny } from './device'
import type FloorModel from './floor'

export interface IBaseModel {
  id: number
  name: string
}

export interface IBaseSubBuildingModel extends IBaseModel {
  building?: BuildingModel
  buildingId: number
}

export interface IBaseSubFloorModel extends IBaseSubBuildingModel {
  floor?: FloorModel | null
  floorId: number | null
}

export interface IBaseSuperDeviceModel extends IBaseModel {
  deviceIds: readonly number[]
  devices: readonly DeviceModelAny[]
}

export interface IBaseSuperAreaModel extends IBaseSuperDeviceModel {
  areaIds: readonly number[]
  areas: readonly AreaModel<number>[]
}

export interface IBuildingModel extends IBaseSuperAreaModel {
  data: BuildingSettings
  floorIds: readonly number[]
  floors: readonly FloorModel[]
}

export interface IAreaModel extends IBaseSubFloorModel, IBaseSuperDeviceModel {}

export interface IFloorModel
  extends IBaseSubBuildingModel,
    IBaseSuperAreaModel {}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseSubFloorModel {
  area?: AreaModelAny | null
  areaId: number | null
  data: ListDevice[T]['Device']
  type: T
  update: (data: Partial<ListDevice[T]['Device']>) => void
}
