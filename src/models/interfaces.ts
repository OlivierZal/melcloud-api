import type { DeviceType } from '../enums.js'
import type { ListDevice, ZoneSettings } from '../types/index.js'

import type { AreaModel } from './area.js'
import type { BuildingModel } from './building.js'
import type { DeviceModel } from './device.js'
import type { FloorModel } from './floor.js'

export type AreaModelAny = AreaModel<null> | AreaModel<number>

export type DeviceModelAny =
  | DeviceModel<'Ata'>
  | DeviceModel<'Atw'>
  | DeviceModel<'Erv'>

export type Model = AreaModelAny | BuildingModel | DeviceModelAny | FloorModel

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
