import type { ClassicGroupState, HomeAtaValues } from '../types/index.ts'
import {
  type ClassicFanSpeed as ClassicFanSpeedType,
  type ClassicNonSilentFanSpeed,
  type ClassicOperationMode,
  ClassicDeviceType,
  ClassicFanSpeed,
} from '../constants.ts'
import {
  type ClassicDeviceAny,
  isClassicDeviceOfType,
} from '../entities/index.ts'
import {
  type HomeFanSpeed,
  type HomeHorizontal,
  type HomeOperationMode,
  type HomeVertical,
  fanSpeedFromClassic,
  fanSpeedToClassic,
  horizontalFromClassic,
  horizontalToClassic,
  isHomeOperationMode,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '../enum-mappings.ts'
import { allEqual, isValue } from '../utils.ts'

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

/**
 * A group state cannot express `silent` (its fan speed is non-silent only),
 * so a silent fan reads as `null` — the "leave unchanged" sentinel —
 * mirroring the Classic device facade's own projection of silent.
 * @param speed - Classic fan speed, possibly silent or unset.
 * @returns The group-expressible fan speed, or `null` for silent or
 * unset — the "leave unchanged" sentinel.
 */
export const toGroupFanSpeed = (
  speed: ClassicFanSpeedType | undefined,
): ClassicNonSilentFanSpeed | null =>
  speed === undefined || speed === ClassicFanSpeed.silent ? null : speed

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
 * Projects a Classic zone's ATA members onto the group vocabulary's
 * member modes: `Power` and `OperationMode` straight off the synced
 * list data, already Classic-numbered — the ONE group vocabulary,
 * whatever API serves the members.
 * @param devices - The zone's member devices (non-ATA members are
 * dropped — the group contract covers ATA members only).
 * @param isPoweredOnly - `true` keeps only powered-on members.
 * @returns One mode per kept member, in member order.
 */
export const classicGroupMemberModes = (
  devices: readonly ClassicDeviceAny[],
  isPoweredOnly: boolean,
): ClassicOperationMode[] =>
  devices
    .filter((device) => isClassicDeviceOfType(device, ClassicDeviceType.Ata))
    .filter(({ data }) => !isPoweredOnly || data.Power)
    .map(({ data }) => data.OperationMode)

/**
 * Projects Home ATA members onto the group vocabulary's member modes
 * through the operation-mode bijection — the same Classic-numbered
 * answer {@link classicGroupMemberModes} gives for Classic members.
 * @param members - The members' facade slices (a device facade is a
 * group of one); `operationMode` is taken as the raw wire string,
 * because the facades pass unknown or absent modes through unchecked.
 * A member whose mode the bijection cannot say is DROPPED like a
 * non-ATA member — never projected as a hole in the array.
 * @param isPoweredOnly - `true` keeps only powered-on members.
 * @returns One mode per kept member, in member order.
 */
export const homeGroupMemberModes = (
  members: readonly {
    readonly operationMode: string
    readonly power: boolean
  }[],
  isPoweredOnly: boolean,
): ClassicOperationMode[] =>
  members
    .filter((member) => !isPoweredOnly || member.power)
    .map(({ operationMode }) => operationMode)
    .filter(isHomeOperationMode)
    .map((mode) => operationModeToClassic[mode])

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
