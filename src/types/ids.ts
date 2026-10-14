import type { z } from 'zod'

import type {
  ClassicAreaIdSchema,
  ClassicBuildingIdSchema,
  ClassicDeviceIdSchema,
  ClassicFloorIdSchema,
} from '../validation/schemas.ts'

/**
 * Branded (nominal) types for the four entity id domains of the MELCloud
 * Classic data model. At runtime each one is a plain `number`; at compile
 * time TypeScript treats them as distinct types, so a `ClassicFloorID`
 * handed to a building lookup is a type error.
 *
 * A brand is minted in ONE place: the zod schema that reads the id off
 * the wire (`ClassicAreaIdSchema` and its siblings in
 * `validation/schemas.ts`, seated in the `/User/ListDevices` schemas).
 * The types below are inferred from those schemas, the wire types and
 * the models carry them, and nothing in this package casts a plain
 * number into one. A host holding a plain number (a Homey device stores
 * one) reaches an entity through the `number`-typed `getById` lookups
 * and reads the branded id off the model.
 */

/**
 * Unique identifier for a MELCloud area.
 * @category Types
 */
export type ClassicAreaID = z.infer<typeof ClassicAreaIdSchema>

/**
 * Unique identifier for a MELCloud building.
 * @category Types
 */
export type ClassicBuildingID = z.infer<typeof ClassicBuildingIdSchema>

/**
 * Unique identifier for a MELCloud device.
 * @category Types
 */
export type ClassicDeviceID = z.infer<typeof ClassicDeviceIdSchema>

/**
 * Unique identifier for a MELCloud floor.
 * @category Types
 */
export type ClassicFloorID = z.infer<typeof ClassicFloorIdSchema>
