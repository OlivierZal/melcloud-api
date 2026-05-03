import type { ClassicDeviceType } from '../constants.ts'
import type { ClassicListDeviceData } from '../types/index.ts'
import type { BaseModel } from './base.ts'
import type { ClassicBuilding } from './building.ts'
import type { ClassicDevice } from './classic-device.ts'

/** Base building model providing zone settings (frost protection, holiday mode). */
export type ClassicBaseBuilding = Pick<ClassicBuilding, 'data'>

/** Base device model with type-discriminated device data. */
export interface ClassicBaseDevice<T extends ClassicDeviceType> {
  readonly data: Readonly<ClassicListDeviceData<T>>
  readonly type: T
}

/**
 * Base type for all model classes.
 * @category Entities
 */
export type ClassicModel = BaseModel

/**
 * Type guard that narrows a `ClassicDeviceAny` to a specific `ClassicDevice` variant.
 * @param device - The device model to narrow.
 * @param type - The expected device type literal.
 * @returns Whether the device matches the given type.
 * @category Entities
 */
export const isClassicDeviceOfType = <T extends ClassicDeviceType>(
  device: ClassicDevice<ClassicDeviceType>,
  type: T,
): device is ClassicDevice<T> => device.type === type

/**
 * All classic device model variants. Kept non-distributive so
 * `createDeviceModel()` can construct a single `ClassicDevice` without
 * needing a per-variant switch; callers that need a specific literal
 * variant should use `isClassicDeviceOfType` to narrow explicitly.
 * @category Entities
 */
export type ClassicDeviceAny = ClassicDevice<ClassicDeviceType>

/** ClassicModel kind discriminants for polymorphic dispatch without instanceof. */
export type ClassicModelKind = 'area' | 'building' | 'device' | 'floor'
