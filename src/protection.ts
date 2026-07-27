/**
 * Protection temperature bounds — frost (Classic and Home) and overheat
 * (Home ATA only), each enforced identically by the official UIs.
 * Clamping lives here so a direct SDK/flow call cannot escape the bounds
 * the UIs guarantee.
 * @module
 */

/** Minimum gap required between min and max, in °C (both features). */
export const PROTECTION_GAP = 2

/** Absolute frost-protection min/max the units accept, in °C. */
export const FROST_PROTECTION_RANGE = { max: 16, min: 4 }

/** Absolute overheat-protection min/max the units accept, in °C. */
export const OVERHEAT_PROTECTION_RANGE = { max: 40, min: 31 }

const clampProtection = (
  min: number,
  max: number,
  range: { readonly max: number; readonly min: number },
): { max: number; min: number } => {
  const clampedMin = Math.max(
    range.min,
    Math.min(min, range.max - PROTECTION_GAP),
  )
  const clampedMax = Math.min(
    range.max,
    Math.max(max, range.min + PROTECTION_GAP),
  )
  return {
    max:
      clampedMax - clampedMin < PROTECTION_GAP
        ? clampedMin + PROTECTION_GAP
        : clampedMax,
    min: clampedMin,
  }
}

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
): { max: number; min: number } =>
  clampProtection(min, max, FROST_PROTECTION_RANGE)

/**
 * Clamp an overheat-protection min/max pair into range with the required
 * gap: min lands in [31, 38], max in [33, 40], and `max - min >= 2`.
 * @param min - Requested lower bound, in °C.
 * @param max - Requested upper bound, in °C.
 * @returns The clamped `{ min, max }` pair.
 */
export const clampOverheatProtection = (
  min: number,
  max: number,
): { max: number; min: number } =>
  clampProtection(min, max, OVERHEAT_PROTECTION_RANGE)
