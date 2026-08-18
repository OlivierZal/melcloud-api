import { type ClassicOperationMode, ClassicDeviceType } from '../constants.ts'
import { tolerateNoChanges } from '../errors/index.ts'
import {
  type AtaTemperatureBounds,
  type TemperatureRange,
  rangeForClassicMode,
} from '../temperature-range.ts'
import {
  type ClassicEnergyDataAta,
  type ClassicGroupState,
  type ClassicUpdateDeviceDataAta,
  type Result,
  ok,
} from '../types/index.ts'
import { clampToRange, isValue } from '../utils.ts'
import type { ClassicEnergyReportExtract } from './classic-types.ts'
import { BaseDeviceFacade, makeEnergyExtract } from './classic-base-device.ts'
import { classicAtaFlags } from './classic-flags.ts'
import { toGroupFanSpeed } from './home-ata-group.ts'

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
 * Facade for Air-to-Air (ATA) devices with per-operation-mode temperature clamping.
 * @category Facades
 */
export class ClassicDeviceAtaFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Ata
> {
  public readonly flags: typeof classicAtaFlags = classicAtaFlags

  public readonly type: typeof ClassicDeviceType.Ata = ClassicDeviceType.Ata

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
  // Pure projection of cached data; the `await Promise.resolve(...)` shape
  // satisfies the async group contract shared with the zone facades without
  // an eslint disable (see `fetch` in classic-base-device.ts).
  public async getGroup(): Promise<Result<ClassicGroupState>> {
    const { data } = await Promise.resolve(this)
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
   * Setpoint bounds enforced for an operation mode — the cross-dialect
   * read: a caller needs no knowledge of which API backs the device.
   * @param mode - Operation mode to resolve; defaults to the active one.
   * @returns The interval, or `null` for a mode outside the known
   * vocabulary (the setpoint then goes unclamped).
   */
  public getTemperatureRange(
    mode: ClassicOperationMode = this.setData.OperationMode,
  ): TemperatureRange | null {
    return rangeForClassicMode(this.#bounds, mode)
  }

  /**
   * Apply a group state to this device through the native per-device SetAta
   * path; null fields are the group "leave unchanged" sentinel and are
   * dropped from the write. Group writes are no-op tolerant: an all-null
   * state resolves without a wire call, and a device already matching the
   * state (a tolerated `NoChangesError` from its update) counts as
   * success.
   * @param state - Group state to push to the device.
   * @returns The zone-shaped success outcome once the write completes.
   */
  public async updateGroupState(state: ClassicGroupState): Promise<void> {
    const values = toUpdateData(state)
    if (Object.keys(values).length > 0) {
      await tolerateNoChanges(async () => this.updateValues(values))
    }
  }

  // Clamp SetTemperature to the valid range for the current or requested
  // operation mode before sending to the Classic API
  protected override prepareUpdateData(
    data: Partial<ClassicUpdateDeviceDataAta>,
  ): Required<ClassicUpdateDeviceDataAta> {
    return super.prepareUpdateData({
      ...data,
      ...this.#clampTargetTemperature(data),
    })
  }

  #clampTargetTemperature(data: Partial<ClassicUpdateDeviceDataAta>): {
    SetTemperature?: number
  } {
    const { OperationMode: operationMode, SetTemperature: value } = data
    if (value === undefined) {
      return {}
    }
    const range = this.getTemperatureRange(operationMode)
    return {
      SetTemperature: range === null ? value : clampToRange(value, range),
    }
  }
}
