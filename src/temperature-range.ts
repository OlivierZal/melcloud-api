import type { HomeOperationMode } from './enum-mappings.ts'
import { clampToRange, roundToStep } from './utils.ts'

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

// Half-degree units advertise it; the rest step by a whole degree.
const HALF_DEGREE_STEP = 0.5
const WHOLE_DEGREE_STEP = 1

/**
 * The setpoint step of an ATA unit, from the half-degree capability
 * both APIs advertise: Classic as `HasHalfDegreeIncrements`, Home as
 * `hasHalfDegreeIncrements`.
 * @param hasHalfDegreeIncrements - The unit's advertised capability.
 * @returns `0.5` on a half-degree unit, `1` otherwise.
 * @category Facades
 */
export const ataTemperatureStep = (hasHalfDegreeIncrements: boolean): number =>
  hasHalfDegreeIncrements ? HALF_DEGREE_STEP : WHOLE_DEGREE_STEP

/**
 * The setpoint an ATA write carries for the one a caller asked: on the
 * half degree, a tie going up, then within the bounds given.
 *
 * A unit holds a setpoint on its own step and nothing else (a Classic
 * unit DROPS a value off it and keeps the previous one), and every such
 * step lies on the half degree. The grid is the half degree for every
 * unit, a whole-degree one included: none could be measured, and a host
 * that computes its own targets on half degrees would read a
 * whole-degree rounding as a change made by hand.
 * @param value - The setpoint asked, in °C.
 * @param range - The bounds to hold it within, or `null` for none (a
 * mode outside the known vocabulary, a group of several units).
 * @returns The setpoint to send.
 * @category Facades
 */
export const toAtaSetpoint = (
  value: number,
  range: TemperatureRange | null,
): number => {
  const rounded = roundToStep(value, HALF_DEGREE_STEP)
  return range === null ? rounded : clampToRange(rounded, range)
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
 * @category Facades
 */
export const rangeForHomeMode = (
  bounds: AtaTemperatureBounds,
  mode: HomeOperationMode,
): TemperatureRange | null => {
  const key = BOUNDS_KEY_BY_MODE[mode] as keyof AtaTemperatureBounds | undefined
  return key === undefined ? null : bounds[key]
}
