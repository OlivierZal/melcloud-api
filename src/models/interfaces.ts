import type {
  AreaModel,
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '.'
import type { BuildingSettings, DeviceType, ListDevice } from '../types'

export interface IBaseModel {
  readonly id: number
  readonly name: string
}

interface IBaseSubBuildingModel {
  readonly building: BuildingModel | null
  readonly buildingId: number
}

interface IBaseSubFloorModel {
  readonly floor: FloorModel | null
  readonly floorId: number | null
}

interface IBaseSuperDeviceModel {
  readonly deviceIds: number[]
  readonly devices: DeviceModelAny[]
}

export interface IBuildingModel extends IBaseModel, IBaseSuperDeviceModel {
  readonly data: BuildingSettings
}

export interface IAreaModel
  extends IBaseModel,
    IBaseSubBuildingModel,
    IBaseSubFloorModel,
    IBaseSuperDeviceModel {}

export interface IFloorModel
  extends IBaseModel,
    IBaseSubBuildingModel,
    IBaseSuperDeviceModel {
  readonly areaIds: number[]
  readonly areas: AreaModel<number>[]
}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseModel,
    IBaseSubBuildingModel,
    IBaseSubFloorModel {
  readonly area: AreaModelAny | null
  readonly areaId: number | null
  readonly data: ListDevice[T]['Device']
  readonly type: T
}
