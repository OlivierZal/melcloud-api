/**
 * Frost-protection temperature bounds, shared by the Classic and Home
 * APIs (the UI enforces the same limits on both). Clamping lives here so
 * a direct SDK/flow call cannot escape the bounds the UI guarantees.
 * @module
 */

/** Absolute min/max the units accept, in °C. */
export const FROST_PROTECTION_RANGE = { max: 16, min: 4 }

/** Minimum gap required between min and max, in °C. */
export const FROST_PROTECTION_GAP = 2

/**
 * Clamp a frost-protection min/max pair into range with the required gap:
 * min lands in [4, 14], max in [6, 16], and `max - min >= 2`.
 * @param min - Requested lower bound, in °C.
 * @param max - Requested upper bound, in °C.
 * @returns The clamped `{ min, max }` pair.
 */
export const clampFrostProtection = (
  min: number,
  max: number,
): { max: number; min: number } => {
  const clampedMin = Math.max(
    FROST_PROTECTION_RANGE.min,
    Math.min(min, FROST_PROTECTION_RANGE.max - FROST_PROTECTION_GAP),
  )
  const clampedMax = Math.min(
    FROST_PROTECTION_RANGE.max,
    Math.max(max, FROST_PROTECTION_RANGE.min + FROST_PROTECTION_GAP),
  )
  return {
    max:
      clampedMax - clampedMin < FROST_PROTECTION_GAP ?
        clampedMin + FROST_PROTECTION_GAP
      : clampedMax,
    min: clampedMin,
  }
}
