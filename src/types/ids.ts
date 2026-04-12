/**
 * Branded (nominal) types for the four entity ID domains in the
 * MELCloud data model. At runtime these are plain `number` values --
 * the brand field never exists and adds zero overhead. At compile
 * time, TypeScript treats each one as a distinct type, so passing a
 * `BuildingID` where a `FloorID` is expected is a type error.
 */

// eslint-disable-next-line @typescript-eslint/naming-convention -- branded type sentinel
type Brand<T extends string> = number & { readonly __brand: T }

/** Unique identifier for a MELCloud area. */
export type AreaID = Brand<'AreaID'>

/** Unique identifier for a MELCloud building. */
export type BuildingID = Brand<'BuildingID'>

/** Unique identifier for a MELCloud device. */
export type DeviceID = Brand<'DeviceID'>

/** Unique identifier for a MELCloud floor. */
export type FloorID = Brand<'FloorID'>
