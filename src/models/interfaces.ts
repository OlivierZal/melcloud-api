import type { DeviceType } from '../enums.ts'
import type { ListDeviceData, ZoneSettings } from '../types/index.ts'

export interface IAreaModel extends IModel {
  readonly buildingId: number
  readonly floorId: number | null
}

export interface IBaseBuildingModel {
  readonly data: ZoneSettings
}

export interface IBaseDeviceModel<T extends DeviceType> {
  readonly data: ListDeviceData<T>
  readonly type: T
}

export interface IBuildingModel extends IBaseBuildingModel, IModel {
  readonly location: number
}

export interface IDeviceModel<T extends DeviceType>
  extends IBaseDeviceModel<T>, IModel {
  readonly areaId: number | null
  readonly buildingId: number
  readonly floorId: number | null
  readonly update: (data: Partial<ListDeviceData<T>>) => void
}

export interface IFloorModel extends IModel {
  readonly buildingId: number
}

export interface IModel {
  readonly id: number
  readonly name: string
}

export type IDeviceModelAny =
  | IDeviceModel<DeviceType.Ata>
  | IDeviceModel<DeviceType.Atw>
  | IDeviceModel<DeviceType.Erv>
