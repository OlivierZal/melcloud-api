/**
 * Branded (nominal) types for the four entity ID domains in the
 * MELCloud data model. At runtime these are plain `number` values --
 * the brand field never exists and adds zero overhead. At compile
 * time, TypeScript treats each one as a distinct type, so passing a
 * `BuildingID` where a `FloorID` is expected is a type error.
 */

type Brand<T extends string> = number & { readonly __brand: T }

/** Unique identifier for a MELCloud area. */
export type AreaID = Brand<'AreaID'>

/** Unique identifier for a MELCloud building. */
export type BuildingID = Brand<'BuildingID'>

/** Unique identifier for a MELCloud device. */
export type DeviceID = Brand<'DeviceID'>

/** Unique identifier for a MELCloud floor. */
export type FloorID = Brand<'FloorID'>

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- branding helpers: the only place raw `as` casts to branded IDs are allowed */
/**
 * Brand a plain number as an {@link AreaID}.
 * @param id - The raw numeric area identifier.
 * @returns The branded {@link AreaID}.
 */
export const toAreaId = (id: number): AreaID => id as AreaID

/**
 * Brand a plain number as a {@link BuildingID}.
 * @param id - The raw numeric building identifier.
 * @returns The branded {@link BuildingID}.
 */
export const toBuildingId = (id: number): BuildingID => id as BuildingID

/**
 * Brand a plain number as a {@link DeviceID}.
 * @param id - The raw numeric device identifier.
 * @returns The branded {@link DeviceID}.
 */
export const toDeviceId = (id: number): DeviceID => id as DeviceID

/**
 * Brand a plain number as a {@link FloorID}.
 * @param id - The raw numeric floor identifier.
 * @returns The branded {@link FloorID}.
 */
export const toFloorId = (id: number): FloorID => id as FloorID
/* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
