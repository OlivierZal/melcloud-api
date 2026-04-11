import type { DeviceType } from '../constants.ts'
import type { ListDeviceData } from '../types/index.ts'
import type { BaseModel } from './base.ts'
import type { Building } from './building.ts'
import type { Device } from './device.ts'

/** Base building model providing zone settings (frost protection, holiday mode). */
export type BaseBuilding = Pick<Building, 'data'>

/** Base type for all model classes. */
export type Model = BaseModel

/** Base device model with type-discriminated device data. */
export interface BaseDevice<T extends DeviceType> {
  readonly data: ListDeviceData<T>
  readonly type: T
}

/**
 * Type guard that narrows a `DeviceAny` to a specific `Device` variant.
 * Overloads ensure the predicate type is always assignable to the union member.
 * @param device - The device model to narrow.
 * @param type - The expected device type literal.
 * @returns Whether the device matches the given type.
 */
export function isDeviceOfType(
  device: DeviceAny,
  type: typeof DeviceType.Ata,
): device is Device<typeof DeviceType.Ata>
export function isDeviceOfType(
  device: DeviceAny,
  type: typeof DeviceType.Atw,
): device is Device<typeof DeviceType.Atw>
export function isDeviceOfType(
  device: DeviceAny,
  type: typeof DeviceType.Erv,
): device is Device<typeof DeviceType.Erv>
export function isDeviceOfType(device: DeviceAny, type: DeviceType): boolean {
  return device.type === type
}

/** Model kind discriminants for polymorphic dispatch without instanceof. */
export type ModelKind = 'area' | 'building' | 'device' | 'floor'

/** Base identifiable entity with numeric ID and display name. */
export interface Identifiable {
  readonly id: number
  readonly name: string
}

/** Union of all device model types. */
export type DeviceAny =
  | Device<typeof DeviceType.Ata>
  | Device<typeof DeviceType.Atw>
  | Device<typeof DeviceType.Erv>
