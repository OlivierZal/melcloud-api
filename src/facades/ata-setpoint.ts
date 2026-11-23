import type { TemperatureRange } from '../temperature-range.ts'
import { clampToRange, roundToStep } from '../utils.ts'

// What an air-to-air setpoint becomes on its way to the unit, for both
// APIs. SDK-internal: the facades read it, no entry point publishes
// it, so the grid can move without a signature moving with it.

// Half-degree units advertise it; the rest step by a whole degree.
const HALF_DEGREE_STEP = 0.5
const WHOLE_DEGREE_STEP = 1

/**
 * The setpoint step of an ATA unit, from the half-degree capability
 * both APIs advertise: Classic as `HasHalfDegreeIncrements`, Home as
 * `hasHalfDegreeIncrements`.
 * @param hasHalfDegreeIncrements - The unit's advertised capability.
 * @returns `0.5` on a half-degree unit, `1` otherwise.
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
 */
export const toAtaSetpoint = (
  value: number,
  range: TemperatureRange | null,
): number => {
  const rounded = roundToStep(value, HALF_DEGREE_STEP)
  return range === null ? rounded : clampToRange(rounded, range)
}
