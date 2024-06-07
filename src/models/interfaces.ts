import type {
  AreaData,
  BuildingData,
  BuildingSettings,
  DeviceType,
  FloorData,
  ListDevice,
} from '../types'
import type {
  AreaModel,
  AreaModelAny,
  BuildingModel,
  DeviceModelAny,
  FloorModel,
} from '.'

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
  update: (data: BuildingData) => void
  readonly data: BuildingSettings
}

export interface IAreaModel<T extends number | null>
  extends IBaseModel,
    IBaseSubBuildingModel,
    IBaseSubFloorModel,
    IBaseSuperDeviceModel {
  update: (data: AreaData<T>) => void
}

export interface IFloorModel
  extends IBaseModel,
    IBaseSubBuildingModel,
    IBaseSuperDeviceModel {
  update: (data: FloorData) => void
  readonly areaIds: number[]
  readonly areas: AreaModel<number>[]
}

export interface IDeviceModel<T extends keyof typeof DeviceType>
  extends IBaseModel,
    IBaseSubBuildingModel,
    IBaseSubFloorModel {
  update: (data: ListDevice[T]) => void
  readonly area: AreaModelAny | null
  readonly areaId: number | null
  readonly data: ListDevice[T]['Device']
  readonly type: T
}
