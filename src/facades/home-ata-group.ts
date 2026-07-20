import type { ClassicGroupState, HomeAtaValues } from '../types/index.ts'
import {
  type ClassicFanSpeed as ClassicFanSpeedType,
  type ClassicNonSilentFanSpeed,
  ClassicFanSpeed,
} from '../constants.ts'
import {
  type HomeFanSpeed,
  type HomeHorizontal,
  type HomeOperationMode,
  type HomeVertical,
  fanSpeedFromClassic,
  fanSpeedToClassic,
  horizontalFromClassic,
  horizontalToClassic,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '../enum-mappings.ts'
import { NoChangesError } from '../errors/index.ts'

/**
 * The facade slice the Classic group-state projection reads. Structural so
 * callers and tests can pass plain objects instead of a live facade.
 * @category Facades
 */
export interface HomeAtaGroupSource {
  readonly operationMode: HomeOperationMode
  readonly power: boolean
  readonly setFanSpeed: HomeFanSpeed
  readonly setTemperature: number
  readonly vaneHorizontalDirection: HomeHorizontal
  readonly vaneVerticalDirection: HomeVertical
}

const isValue = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined

// The first value when every entry strictly equals it, `null` otherwise
// (including the empty case) — the per-field divergence fold of a group
// state. `null` IS the wire's mixed marker: consumers coerce a null
// operation mode to the MIXED sentinel themselves (`Number(null)` is `0`).
const allEqual = <T>(values: readonly (T | null)[]): T | null => {
  const [first = null] = values
  return values.every((value) => value === first) ? first : null
}

/**
 * A group state cannot express `silent` (its fan speed is non-silent only),
 * so a silent fan reads as `null` — the "leave unchanged" sentinel —
 * mirroring the Classic device facade's own projection of silent.
 * @param speed - Classic fan speed, possibly silent.
 * @returns The group-expressible fan speed, or `null` for silent.
 */
export const toGroupFanSpeed = (
  speed: ClassicFanSpeedType,
): ClassicNonSilentFanSpeed | null =>
  speed === ClassicFanSpeed.silent ? null : speed

/**
 * Projects a Home ATA device's current values onto the Classic group-state
 * dialect (a device is a group of one).
 * @param source - Home ATA facade slice to project.
 * @param source.operationMode - Current Home operation mode.
 * @param source.power - Whether the unit is powered on.
 * @param source.setFanSpeed - Current fan-speed setpoint.
 * @param source.setTemperature - Current temperature setpoint.
 * @param source.vaneHorizontalDirection - Current horizontal vane position.
 * @param source.vaneVerticalDirection - Current vertical vane position.
 * @returns The equivalent Classic group state.
 */
export const toClassicAtaGroupState = (
  source: HomeAtaGroupSource,
): ClassicGroupState => ({
  FanSpeed: toGroupFanSpeed(fanSpeedToClassic[source.setFanSpeed]),
  OperationMode: operationModeToClassic[source.operationMode],
  Power: source.power,
  SetTemperature: source.setTemperature,
  VaneHorizontalDirection: horizontalToClassic[source.vaneHorizontalDirection],
  VaneVerticalDirection: verticalToClassic[source.vaneVerticalDirection],
})

/**
 * Folds several members' group states into one, per field: the shared value
 * when every member agrees, `null` otherwise — the same divergence marker
 * the Classic group endpoint reports for its zones (consumers already read
 * a null operation mode as the MIXED sentinel).
 * @param states - One projected group state per member device.
 * @returns The aggregated group state; all-null when `states` is empty.
 */
export const aggregateClassicAtaGroupStates = (
  states: readonly ClassicGroupState[],
): ClassicGroupState => ({
  FanSpeed: allEqual(states.map((state) => state.FanSpeed ?? null)),
  OperationMode: allEqual(states.map((state) => state.OperationMode ?? null)),
  Power: allEqual(states.map((state) => state.Power ?? null)),
  SetTemperature: allEqual(states.map((state) => state.SetTemperature ?? null)),
  VaneHorizontalDirection: allEqual(
    states.map((state) => state.VaneHorizontalDirection ?? null),
  ),
  VaneVerticalDirection: allEqual(
    states.map((state) => state.VaneVerticalDirection ?? null),
  ),
})

/**
 * Translates a partial Classic group state into the Home update payload,
 * dropping absent keys (group deltas are partial; `null` is the group
 * "leave unchanged" sentinel and has no Home write semantics).
 * @param state - Partial Classic group state to translate.
 * @param state.FanSpeed - Fan-speed setpoint; absent or `null` skips it.
 * @param state.OperationMode - Operation mode; absent or `null` skips it.
 * @param state.Power - Power flag; absent or `null` skips it.
 * @param state.SetTemperature - Temperature setpoint; absent or `null` skips it.
 * @param state.VaneHorizontalDirection - Horizontal vane position; absent or `null` skips it.
 * @param state.VaneVerticalDirection - Vertical vane position; absent or `null` skips it.
 * @returns The equivalent Home ATA update payload.
 */
export const toHomeAtaValues = (state: ClassicGroupState): HomeAtaValues => ({
  ...(isValue(state.FanSpeed) && {
    setFanSpeed: fanSpeedFromClassic[state.FanSpeed],
  }),
  ...(isValue(state.OperationMode) && {
    operationMode: operationModeFromClassic[state.OperationMode],
  }),
  ...(isValue(state.Power) && { power: state.Power }),
  ...(isValue(state.SetTemperature) && {
    setTemperature: state.SetTemperature,
  }),
  ...(isValue(state.VaneHorizontalDirection) && {
    vaneHorizontalDirection:
      horizontalFromClassic[state.VaneHorizontalDirection],
  }),
  ...(isValue(state.VaneVerticalDirection) && {
    vaneVerticalDirection: verticalFromClassic[state.VaneVerticalDirection],
  }),
})

/**
 * Run a group-member update, counting a {@link NoChangesError} as
 * success: a device already matching the group state is fine by
 * definition, so zone group writes — and the group-of-one emulation —
 * are no-op tolerant.
 * @param update - The member update to run.
 */
export const tolerateNoChanges = async (
  update: () => Promise<unknown>,
): Promise<void> => {
  try {
    await update()
  } catch (error) {
    if (!(error instanceof NoChangesError)) {
      throw error
    }
  }
}
