import {
  type ClassicNonSilentFanSpeed,
  ClassicDeviceType,
  ClassicFanSpeed,
  ClassicOperationMode,
} from '../constants.ts'
import {
  type ClassicEnergyDataAta,
  type ClassicFailureData,
  type ClassicGroupState,
  type ClassicSuccessData,
  type ClassicUpdateDeviceDataAta,
  type Result,
  ok,
} from '../types/index.ts'
import { clampToRange } from '../utils.ts'
import type { ClassicEnergyReportExtract } from './classic-types.ts'
import { BaseDeviceFacade } from './classic-base-device.ts'
import { classicAtaFlags } from './classic-flags.ts'
import { tolerateNoChanges } from './home-ata-group.ts'

const isSet = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined

// A group state cannot express `silent` (its fan speed is non-silent only),
// so a silent or unset device fan reads as `null` — the "leave unchanged"
// sentinel — rather than being forced onto a group speed.
const toGroupFanSpeed = (
  fanSpeed: ClassicFanSpeed | undefined,
): ClassicNonSilentFanSpeed | null =>
  fanSpeed === undefined || fanSpeed === ClassicFanSpeed.silent ?
    null
  : fanSpeed

// Group-state keys map onto the per-device update tags (`FanSpeed` →
// `SetFanSpeed`, the vane directions lose their `Direction` suffix); the
// group `null` "leave unchanged" sentinel is dropped from the write.
const toUpdateData = (
  state: ClassicGroupState,
): ClassicUpdateDeviceDataAta => ({
  ...(isSet(state.FanSpeed) && { SetFanSpeed: state.FanSpeed }),
  ...(isSet(state.OperationMode) && { OperationMode: state.OperationMode }),
  ...(isSet(state.Power) && { Power: state.Power }),
  ...(isSet(state.SetTemperature) && { SetTemperature: state.SetTemperature }),
  ...(isSet(state.VaneHorizontalDirection) && {
    VaneHorizontal: state.VaneHorizontalDirection,
  }),
  ...(isSet(state.VaneVerticalDirection) && {
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

const extractEnergyReportAta = (
  data: ClassicEnergyDataAta,
): ClassicEnergyReportExtract => ({
  labels: data.Labels,
  labelType: data.LabelType,
  series: energyReportBuckets.map((name) => ({ data: data[name], name })),
})

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
  ) => ClassicEnergyReportExtract = extractEnergyReportAta

  protected readonly temperaturesLegend: readonly string[] = [
    'SetTemperature',
    'RoomTemperature',
    'OutdoorTemperature',
  ]

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
   * Apply a group state to this device through the native per-device SetAta
   * path; null fields are the group "leave unchanged" sentinel and are
   * dropped from the write. Group writes are no-op tolerant: an all-null
   * state resolves without a wire call, and a device already matching the
   * state (a tolerated `NoChangesError` from its update) counts as
   * success.
   * @param state - Group state to push to the device.
   * @returns The zone-shaped success outcome once the write completes.
   */
  public async updateGroupState(
    state: ClassicGroupState,
  ): Promise<ClassicFailureData | ClassicSuccessData> {
    const values = toUpdateData(state)
    if (Object.keys(values).length > 0) {
      await tolerateNoChanges(async () => this.updateValues(values))
    }
    return { AttributeErrors: null, Success: true }
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
    const range = this.#getTargetTemperatureRange(operationMode)
    return { SetTemperature: clampToRange(value, range) }
  }

  #getTargetTemperatureRange(operationMode = this.setData.OperationMode): {
    max: number
    min: number
  } {
    const {
      data: {
        MaxTempAutomatic: maxTemperatureAutomatic,
        MaxTempCoolDry: maxTemperatureCoolDry,
        MaxTempHeat: maxTemperatureHeatFan,
        MinTempAutomatic: minTemperatureAutomatic,
        MinTempCoolDry: minTemperatureCoolDry,
        MinTempHeat: minTemperatureHeatFan,
      },
    } = this
    return {
      [ClassicOperationMode.auto]: {
        max: maxTemperatureAutomatic,
        min: minTemperatureAutomatic,
      },
      [ClassicOperationMode.cool]: {
        max: maxTemperatureCoolDry,
        min: minTemperatureCoolDry,
      },
      [ClassicOperationMode.dry]: {
        max: maxTemperatureCoolDry,
        min: minTemperatureCoolDry,
      },
      [ClassicOperationMode.fan]: {
        max: maxTemperatureHeatFan,
        min: minTemperatureHeatFan,
      },
      [ClassicOperationMode.heat]: {
        max: maxTemperatureHeatFan,
        min: minTemperatureHeatFan,
      },
    }[operationMode]
  }
}
