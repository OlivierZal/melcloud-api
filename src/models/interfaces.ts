import type { DeviceType } from '../constants.ts'
import type { ListDeviceData, ZoneSettings } from '../types/index.ts'

/** Area model with parent building and optional floor references. */
export interface AreaModel extends Model {
  readonly buildingId: number
  readonly floorId: number | null
  readonly modelKind: 'area'
}

/** Base building model providing zone settings (frost protection, holiday mode). */
export interface BaseBuildingModel {
  readonly data: ZoneSettings
}

/** Base device model with type-discriminated device data. */
export interface BaseDeviceModel<T extends DeviceType> {
  readonly data: ListDeviceData<T>
  readonly type: T
}

/** Building model with geographic location. */
export interface BuildingModel extends BaseBuildingModel, Model {
  /** Numeric location identifier used by the MELCloud API. */
  readonly location: number
  readonly modelKind: 'building'
}

/** Device model with full hierarchy references and mutable data. */
export interface DeviceModel<T extends DeviceType>
  extends BaseDeviceModel<T>, Model {
  readonly areaId: number | null
  readonly buildingId: number
  readonly floorId: number | null
  readonly modelKind: 'device'

  /** Merge partial device data into the current state. */
  readonly update: (data: Partial<ListDeviceData<T>>) => void
}

/** Floor model with parent building reference. */
export interface FloorModel extends Model {
  readonly buildingId: number
  readonly modelKind: 'floor'
}

/** Model kind discriminants for polymorphic dispatch without instanceof. */
export type ModelKind = 'area' | 'building' | 'device' | 'floor'

/** Base identifiable entity with numeric ID and display name. */
export interface Identifiable {
  readonly id: number
  readonly name: string
}

/** Base identifiable model with kind discriminant for polymorphic dispatch. */
export interface Model extends Identifiable {
  readonly modelKind: ModelKind
}

/** Union of all device model types. */
export type DeviceModelAny =
  | DeviceModel<typeof DeviceType.Ata>
  | DeviceModel<typeof DeviceType.Atw>
  | DeviceModel<typeof DeviceType.Erv>
