import type { DeviceType } from '../enums.ts'
import type { ListDeviceData, ZoneSettings } from '../types/index.ts'

/** Area model with parent building and optional floor references. */
export interface IAreaModel extends IModel {
  readonly buildingId: number
  readonly floorId: number | null
}

/** Base building model providing zone settings (frost protection, holiday mode). */
export interface IBaseBuildingModel {
  readonly data: ZoneSettings
}

/** Base device model with type-discriminated device data. */
export interface IBaseDeviceModel<T extends DeviceType> {
  readonly data: ListDeviceData<T>
  readonly type: T
}

/** Building model with geographic location. */
export interface IBuildingModel extends IBaseBuildingModel, IModel {

  /** Numeric location identifier used by the MELCloud API. */
  readonly location: number
}

/** Device model with full hierarchy references and mutable data. */
export interface IDeviceModel<T extends DeviceType>
  extends IBaseDeviceModel<T>, IModel {
  readonly areaId: number | null
  readonly buildingId: number
  readonly floorId: number | null

  /** Merge partial device data into the current state. */
  readonly update: (data: Partial<ListDeviceData<T>>) => void
}

/** Floor model with parent building reference. */
export interface IFloorModel extends IModel {
  readonly buildingId: number
}

/** Base identifiable model with numeric ID and display name. */
export interface IModel {
  readonly id: number
  readonly name: string
}

/** Union of all device model types. */
export type IDeviceModelAny =
  | IDeviceModel<DeviceType.Ata>
  | IDeviceModel<DeviceType.Atw>
  | IDeviceModel<DeviceType.Erv>
