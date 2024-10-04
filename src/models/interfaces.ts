import type { DeviceType, ListDevice, ZoneSettings } from '../types'

import type { AreaModel, AreaModelAny } from './area'
import type { BuildingModel } from './building'
import type { DeviceModelAny } from './device'
import type { FloorModel } from './floor'

export interface IBaseModel {
  id: number
  name: string
}

export interface IBaseSubBuildingModel extends IBaseModel {
  buildingId: number
  building?: BuildingModel
}

export interface IBaseSubFloorModel extends IBaseSubBuildingModel {
  floorId: number | null
  floor?: FloorModel | null
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
  data: ZoneSettings
  floorIds: readonly number[]
  floors: readonly FloorModel[]
}

export interface IAreaModel extends IBaseSubFloorModel, IBaseSuperDeviceModel {}

export interface IFloorModel
  extends IBaseSubBuildingModel,
    IBaseSuperAreaModel {}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseSubFloorModel {
  areaId: number | null
  data: ListDevice[T]['Device']
  type: T
  update: (data: Partial<ListDevice[T]['Device']>) => void
  area?: AreaModelAny | null
}
