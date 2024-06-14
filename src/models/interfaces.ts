import type { default as AreaModel, AreaModelAny } from './area'
import type { BuildingSettings, DeviceType, ListDevice } from '../types'
import type BuildingModel from './building'
import type { DeviceModelAny } from './device'
import type FloorModel from './floor'

export interface IBaseModel {
  readonly id: number
  readonly name: string
}

export interface IBaseSubBuildingModel extends IBaseModel {
  readonly building: BuildingModel | null
  readonly buildingId: number
}

export interface IBaseSubFloorModel extends IBaseSubBuildingModel {
  readonly floor: FloorModel | null
  readonly floorId: number | null
}

export interface IBaseSuperDeviceModel extends IBaseModel {
  readonly deviceIds: number[]
  readonly devices: DeviceModelAny[]
}

export interface IBuildingModel extends IBaseSuperDeviceModel {
  readonly data: BuildingSettings
}

export interface IAreaModel extends IBaseSubFloorModel, IBaseSuperDeviceModel {}

export interface IFloorModel
  extends IBaseSubBuildingModel,
    IBaseSuperDeviceModel {
  readonly areaIds: number[]
  readonly areas: AreaModel<number>[]
}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseSubFloorModel {
  readonly area: AreaModelAny | null
  readonly areaId: number | null
  readonly data: ListDevice[T]['Device']
  readonly type: T
}
