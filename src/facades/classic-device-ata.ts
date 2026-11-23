import { type ClassicOperationMode, ClassicDeviceType } from '../constants.ts'
import {
  type HomeOperationMode,
  operationModeFromClassic,
} from '../enum-mappings.ts'
import { tolerateNoChanges } from '../errors/index.ts'
import {
  type AtaTemperatureBounds,
  type TemperatureRange,
  ataTemperatureStep,
  rangeForHomeMode,
} from '../temperature-range.ts'
import {
  type ClassicEnergyDataAta,
  type ClassicGroupState,
  type ClassicUpdateDeviceDataAta,
  type Result,
  ok,
} from '../types/index.ts'
import { clampToRange, isValue, resolved, roundToStep } from '../utils.ts'
import type { ClassicEnergyReportExtract } from './classic-types.ts'
import { BaseDeviceFacade, makeEnergyExtract } from './classic-base-device.ts'
import { classicAtaFlags } from './classic-flags.ts'
import { classicGroupMemberModes, toGroupFanSpeed } from './home-ata-group.ts'

// Group-state keys map onto the per-device update tags (`FanSpeed` →
// `SetFanSpeed`, the vane directions lose their `Direction` suffix); the
// group `null` "leave unchanged" sentinel is dropped from the write.
const toUpdateData = (
  state: ClassicGroupState,
): ClassicUpdateDeviceDataAta => ({
  ...(isValue(state.FanSpeed) && { SetFanSpeed: state.FanSpeed }),
  ...(isValue(state.OperationMode) && { OperationMode: state.OperationMode }),
  ...(isValue(state.Power) && { Power: state.Power }),
  ...(isValue(state.SetTemperature) && {
    SetTemperature: state.SetTemperature,
  }),
  ...(isValue(state.VaneHorizontalDirection) && {
    VaneHorizontal: state.VaneHorizontalDirection,
  }),
  ...(isValue(state.VaneVerticalDirection) && {
    VaneVertical: state.VaneVerticalDirection,
  }),
})

// `EnergyCost/Report` consumption buckets charted by `getEnergyReport`,
// in MELCloud display order.
const energyReportBuckets = [
  'Heating',
  'Cooling',
  'Auto',
  'Dry',
  'Fan',
  'Other',
] as const

/**
 * Facade for Air-to-Air (ATA) devices with per-operation-mode temperature
 * clamping.
 * @category Facades
 */
export class ClassicDeviceAtaFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Ata
> {
  public readonly flags: typeof classicAtaFlags = classicAtaFlags

  public readonly type: typeof ClassicDeviceType.Ata = ClassicDeviceType.Ata

  /**
   * Setpoint granularity in °C, from the unit's advertised
   * half-degree capability. A listing that does not say reads as half
   * degrees: what every unit measured answers, and the one reading
   * that can only send a unit what it was already sent.
   * @returns `1` on a unit that says it holds whole degrees only,
   * `0.5` otherwise.
   */
  public get temperatureStep(): number {
    return ataTemperatureStep(this.data.HasHalfDegreeIncrements ?? true)
  }

  protected override readonly extractEnergyReport: (
    data: ClassicEnergyDataAta,
  ) => ClassicEnergyReportExtract = makeEnergyExtract(energyReportBuckets)

  protected readonly temperaturesLegend: readonly string[] = [
    'SetTemperature',
    'RoomTemperature',
    'OutdoorTemperature',
  ]

  // The dialect extractor: Classic spells the three advertised pairs in
  // PascalCase, and the shared module resolves modes onto them.
  get #bounds(): AtaTemperatureBounds {
    const {
      data: {
        MaxTempAutomatic,
        MaxTempCoolDry,
        MaxTempHeat,
        MinTempAutomatic,
        MinTempCoolDry,
        MinTempHeat,
      },
    } = this
    return {
      automatic: { max: MaxTempAutomatic, min: MinTempAutomatic },
      coolDry: { max: MaxTempCoolDry, min: MinTempCoolDry },
      heatFan: { max: MaxTempHeat, min: MinTempHeat },
    }
  }

  /**
   * Read this device's current state projected as a group state, treating
   * the device as a group of one: MELCloud's group endpoints only address
   * zones, so the already-synced data is reused with no wire call. A silent
   * or unset fan speed reads as `null` (a group cannot hold silent).
   * @returns A success result wrapping the device's group state.
   */
  public async getGroup(): Promise<Result<ClassicGroupState>> {
    const { data } = await resolved(this)
    return ok({
      FanSpeed: toGroupFanSpeed(data.FanSpeed),
      OperationMode: data.OperationMode,
      Power: data.Power,
      SetTemperature: data.SetTemperature,
      VaneHorizontalDirection: data.VaneHorizontalDirection,
      VaneVerticalDirection: data.VaneVerticalDirection,
    })
  }

  /**
   * Member operation modes in the one group vocabulary, treating the
   * device as a group of one — the same read every zone facade answers,
   * projected from the synced list data with no wire call.
   * @param options - Member filter.
   * @param options.poweredOnly - `true` answers empty when the unit is
   * powered off.
   * @returns The device's own mode, alone or absent.
   */
  public getMemberOperationModes({
    poweredOnly: isPoweredOnly,
  }: {
    poweredOnly: boolean
  }): ClassicOperationMode[] {
    return classicGroupMemberModes(this.devices, isPoweredOnly)
  }

  /**
   * Setpoint bounds enforced for an operation mode — the cross-dialect
   * read: a caller needs no knowledge of which API backs the device.
   * @param mode - Operation mode to resolve; defaults to the active one.
   * @returns The interval, or `null` for a mode outside the known
   * vocabulary (the setpoint then goes unclamped).
   */
  public getTemperatureRange(
    mode: ClassicOperationMode | HomeOperationMode = this.setData.OperationMode,
  ): TemperatureRange | null {
    return rangeForHomeMode(
      this.#bounds,
      typeof mode === 'number' ? operationModeFromClassic[mode] : mode,
    )
  }

  /**
   * Apply a group state to this device through the native per-device SetAta
   * path; null fields are the group "leave unchanged" sentinel and are
   * dropped from the write. Group writes are no-op tolerant: an all-null
   * state resolves without a wire call, and a device already matching the
   * state (a tolerated `NoChangesError` from its update) counts as
   * success.
   * @param state - Group state to push to the device.
   */
  public async updateGroupState(state: ClassicGroupState): Promise<void> {
    const values = toUpdateData(state)
    if (Object.keys(values).length > 0) {
      await tolerateNoChanges(async () => this.updateValues(values))
    }
  }

  // The setpoint the unit will hold for the one asked: rounded to the
  // unit's step, then held within the bounds of the current or
  // requested operation mode. A Classic unit DROPS a setpoint off its
  // step and keeps the previous one (measured 2026-11-23: 18.4 written
  // on a half-degree unit, accepted with a 200 and listed until the
  // unit next communicated, then answered as 18).
  protected override readonly normalizeUpdateData: (
    data: Partial<ClassicUpdateDeviceDataAta>,
  ) => Partial<ClassicUpdateDeviceDataAta> = (data) => ({
    ...data,
    ...this.#toHeldSetpoint(data),
  })

  #toHeldSetpoint(data: Partial<ClassicUpdateDeviceDataAta>): {
    SetTemperature?: number
  } {
    const { OperationMode: operationMode, SetTemperature: value } = data
    if (value === undefined) {
      return {}
    }
    const rounded = roundToStep(value, this.temperatureStep)
    const range = this.getTemperatureRange(operationMode)
    return {
      SetTemperature: range === null ? rounded : clampToRange(rounded, range),
    }
  }
}
