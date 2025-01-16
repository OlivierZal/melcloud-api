import type { DeviceType } from '../enums.ts'
import type { ListDeviceData, ZoneSettings } from '../types/common.ts'

interface ISubBuildingModel extends IModel {
  readonly buildingId: number
  readonly building?: IBuildingModel
}

interface ISubFloorModel extends ISubBuildingModel {
  readonly floorId: number | null
  readonly floor?: IFloorModel | null
}

interface ISuperAreaModel extends ISuperDeviceModel {
  readonly areaIds: number[]
  readonly areas: IAreaModel[]
}

interface ISuperDeviceModel extends IModel {
  readonly deviceIds: number[]
  readonly devices: IDeviceModelAny[]
}

export interface IAreaModel extends ISubFloorModel, ISuperDeviceModel {}

export interface IBaseBuildingModel {
  readonly data: ZoneSettings
}

export interface IBaseDeviceModel<T extends DeviceType> {
  readonly data: ListDeviceData<T>
  readonly type: T
}

export interface IBuildingModel extends IBaseBuildingModel, ISuperAreaModel {
  readonly floorIds: number[]
  readonly floors: IFloorModel[]
  readonly location: number
}

export interface IDeviceModel<T extends DeviceType>
  extends IBaseDeviceModel<T>,
    ISubFloorModel {
  readonly areaId: number | null
  readonly area?: IAreaModel | null
  readonly update: (data: Partial<ListDeviceData<T>>) => void
}

export interface IFloorModel extends ISubBuildingModel, ISuperAreaModel {}

export interface IModel {
  readonly id: number
  readonly name: string
}

export type IDeviceModelAny =
  | IDeviceModel<DeviceType.Ata>
  | IDeviceModel<DeviceType.Atw>
  | IDeviceModel<DeviceType.Erv>
