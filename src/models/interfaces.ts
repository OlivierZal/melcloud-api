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

export interface IModel {
  id: number
  name: string
}

export interface ISubBuildingModel extends IModel {
  buildingId: number
  building?: BuildingModel
}

export interface ISubFloorModel extends ISubBuildingModel {
  floorId: number | null
  floor?: FloorModel | null
}

export interface ISuperDeviceModel extends IModel {
  deviceIds: number[]
  devices: DeviceModelAny[]
}

export interface ISuperAreaModel extends ISuperDeviceModel {
  areaIds: number[]
  areas: AreaModel<number>[]
}

export interface IBaseBuildingModel {
  data: ZoneSettings
}

export interface IBuildingModel extends IBaseBuildingModel, ISuperAreaModel {
  floorIds: number[]
  floors: FloorModel[]
}

export interface IAreaModel extends ISubFloorModel, ISuperDeviceModel {}

export interface IFloorModel extends ISubBuildingModel, ISuperAreaModel {}

export interface IBaseDeviceModel<T extends keyof typeof DeviceType> {
  data: ListDevice[T]['Device']
  type: T
}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseDeviceModel<T>,
    ISubFloorModel {
  areaId: number | null
  update: (data: Partial<ListDevice[T]['Device']>) => void
  area?: AreaModelAny | null
}
