import type { ClassicDeviceType } from '../constants.ts'
import type { ClassicListDeviceData } from '../types/index.ts'
import type { BaseModel } from './base.ts'
import type { ClassicBuilding } from './building.ts'
import type { ClassicDevice } from './classic-device.ts'

/** Base building model providing zone settings (frost protection, holiday mode). */
export type ClassicBaseBuilding = Pick<ClassicBuilding, 'data'>

/** Base type for all model classes. */
export type ClassicModel = BaseModel

/** Base device model with type-discriminated device data. */
export interface ClassicBaseDevice<T extends ClassicDeviceType> {
  readonly data: ClassicListDeviceData<T>
  readonly type: T
}

/**
 * Type guard that narrows a `ClassicDeviceAny` to a specific `ClassicDevice` variant.
 * @param device - The device model to narrow.
 * @param type - The expected device type literal.
 * @returns Whether the device matches the given type.
 */
export const isClassicDeviceOfType = <T extends ClassicDeviceType>(
  device: ClassicDevice<ClassicDeviceType>,
  type: T,
): device is ClassicDevice<T> => device.type === type

/** ClassicModel kind discriminants for polymorphic dispatch without instanceof. */
export type ClassicModelKind = 'area' | 'building' | 'device' | 'floor'

/** Base identifiable entity with numeric ID and display name. */
export interface Identifiable {
  readonly id: number
  readonly name: string
}

/** Union of all device model types. */
export type ClassicDeviceAny =
  | ClassicDevice<typeof ClassicDeviceType.Ata>
  | ClassicDevice<typeof ClassicDeviceType.Atw>
  | ClassicDevice<typeof ClassicDeviceType.Erv>
