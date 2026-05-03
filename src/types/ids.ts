/**
 * Branded (nominal) types for the four entity ID domains in the
 * MELCloud data model. At runtime these are plain `number` values --
 * the brand field never exists and adds zero overhead. At compile
 * time, TypeScript treats each one as a distinct type, so passing a
 * `ClassicBuildingID` where a `ClassicFloorID` is expected is a type error.
 */

/** @internal */
type Brand<T extends string> = number & { readonly __brand: T }

/**
 * Unique identifier for a MELCloud area.
 * @category Types
 */
export type ClassicAreaID = Brand<'AreaID'>

/**
 * Unique identifier for a MELCloud building.
 * @category Types
 */
export type ClassicBuildingID = Brand<'BuildingID'>

/**
 * Unique identifier for a MELCloud device.
 * @category Types
 */
export type ClassicDeviceID = Brand<'DeviceID'>

/**
 * Unique identifier for a MELCloud floor.
 * @category Types
 */
export type ClassicFloorID = Brand<'FloorID'>

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- branding helpers: the only place raw `as` casts to branded IDs are allowed */
/**
 * Brand a plain number as an {@link ClassicAreaID}.
 * @param id - The raw numeric area identifier.
 * @returns The branded {@link ClassicAreaID}.
 */
export const toClassicAreaId = (id: number): ClassicAreaID =>
  id as ClassicAreaID

/**
 * Brand a plain number as a {@link ClassicBuildingID}.
 * @param id - The raw numeric building identifier.
 * @returns The branded {@link ClassicBuildingID}.
 */
export const toClassicBuildingId = (id: number): ClassicBuildingID =>
  id as ClassicBuildingID

/**
 * Brand a plain number as a {@link ClassicDeviceID}.
 * @param id - The raw numeric device identifier.
 * @returns The branded {@link ClassicDeviceID}.
 */
export const toClassicDeviceId = (id: number): ClassicDeviceID =>
  id as ClassicDeviceID

/**
 * Brand a plain number as a {@link ClassicFloorID}.
 * @param id - The raw numeric floor identifier.
 * @returns The branded {@link ClassicFloorID}.
 */
export const toClassicFloorId = (id: number): ClassicFloorID =>
  id as ClassicFloorID
/* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
