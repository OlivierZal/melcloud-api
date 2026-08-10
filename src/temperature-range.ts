import type { ClassicOperationMode } from './constants.ts'
import {
  type HomeOperationMode,
  operationModeFromClassic,
} from './enum-mappings.ts'

// Per-mode ATA setpoint bounds: the cross-dialect surface both APIs
// advertise under different spellings, and the single place where the
// five operation modes collapse onto the three ranges the hardware
// actually distinguishes.

/**
 * The three intervals an ATA unit advertises, whichever API describes
 * it. Both dialects publish exactly these pairs; only the field
 * spelling differs, so each facade supplies them and the resolution
 * below is shared.
 * @category Facades
 */
export interface AtaTemperatureBounds {
  /**
   * Bounds enforced in automatic mode.
   */
  readonly automatic: TemperatureRange
  /**
   * Bounds shared by cooling and drying.
   */
  readonly coolDry: TemperatureRange
  /**
   * Bounds shared by heating and fan.
   */
  readonly heatFan: TemperatureRange
}

/**
 * A setpoint interval in °C, inclusive on both ends — the cross-dialect
 * read twin of the raw bounds each API advertises: Classic maps its
 * `MinTemp*`/`MaxTemp*` wire fields onto it, Home its camelCase
 * `minTemp*`/`maxTemp*` capabilities.
 * @category Facades
 */
export interface TemperatureRange {
  /**
   * Highest settable temperature, in °C.
   */
  readonly max: number
  /**
   * Lowest settable temperature, in °C.
   */
  readonly min: number
}

// Keyed on the Home vocabulary because the Classic side already has a
// total bijection onto it (`operationModeFromClassic`): one table, both
// dialects, no second grouping to drift out of step.
const BOUNDS_KEY_BY_MODE: Record<
  HomeOperationMode,
  keyof AtaTemperatureBounds
> = {
  Automatic: 'automatic',
  Cool: 'coolDry',
  Dry: 'coolDry',
  Fan: 'heatFan',
  Heat: 'heatFan',
}

/**
 * Resolves the bounds enforced for a Home operation mode.
 * @param bounds - The unit's three advertised intervals.
 * @param mode - The Home operation mode to resolve.
 * @returns The interval for that mode, or `null` when the mode is
 * outside the known vocabulary — unknown wire values pass through
 * unclamped rather than borrowing another mode's bounds.
 */
export const rangeForHomeMode = (
  bounds: AtaTemperatureBounds,
  mode: HomeOperationMode,
): TemperatureRange | null => {
  const key = BOUNDS_KEY_BY_MODE[mode] as keyof AtaTemperatureBounds | undefined
  return key === undefined ? null : bounds[key]
}

/**
 * Resolves the bounds enforced for a Classic operation mode, through
 * the same table the Home side uses.
 * @param bounds - The unit's three advertised intervals.
 * @param mode - The Classic operation mode to resolve.
 * @returns The interval for that mode, or `null` when the mode is
 * outside the known vocabulary.
 */
export const rangeForClassicMode = (
  bounds: AtaTemperatureBounds,
  mode: ClassicOperationMode,
): TemperatureRange | null => {
  const homeMode = operationModeFromClassic[mode] as
    HomeOperationMode | undefined
  return homeMode === undefined ? null : rangeForHomeMode(bounds, homeMode)
}
