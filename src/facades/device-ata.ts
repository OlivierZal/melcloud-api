import type { UpdateDeviceData, UpdateDeviceDataAta } from '../types/index.ts'
import { DeviceType, OperationMode } from '../constants.ts'
import { BaseDeviceFacade } from './base-device.ts'

/** Facade for Air-to-Air (ATA) devices with per-operation-mode temperature clamping. */
export class DeviceAtaFacade extends BaseDeviceFacade<typeof DeviceType.Ata> {
  /*
   * MELCloud EffectiveFlags bitfield — each bit tells the API which
   * fields in the update payload should actually be applied.
   */
  public readonly flags = {
    OperationMode: 0x2,
    Power: 0x1,
    SetFanSpeed: 0x8,
    SetTemperature: 0x4,
    VaneHorizontal: 0x1_00,
    VaneVertical: 0x10,
  } satisfies Record<keyof UpdateDeviceData<typeof DeviceType.Ata>, number>

  public readonly type = DeviceType.Ata

  protected readonly temperaturesLegend = [
    'SetTemperature',
    'RoomTemperature',
    'OutdoorTemperature',
  ]

  /*
   * Clamp SetTemperature to the valid range for the current or requested
   * operation mode before sending to the API
   */
  protected override prepareUpdateData(
    data: Partial<UpdateDeviceDataAta>,
  ): Required<UpdateDeviceDataAta> {
    return super.prepareUpdateData({
      ...data,
      ...this.#clampTargetTemperature(data),
    })
  }

  #clampTargetTemperature(data: Partial<UpdateDeviceDataAta>): {
    SetTemperature?: number
  } {
    const { OperationMode: operationMode, SetTemperature: value } = data
    if (value !== undefined) {
      const { max, min } = this.#getTargetTemperatureRange(operationMode)
      return { SetTemperature: Math.min(Math.max(value, min), max) }
    }
    return {}
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
      [OperationMode.auto]: {
        max: maxTemperatureAutomatic,
        min: minTemperatureAutomatic,
      },
      [OperationMode.cool]: {
        max: maxTemperatureCoolDry,
        min: minTemperatureCoolDry,
      },
      [OperationMode.dry]: {
        max: maxTemperatureCoolDry,
        min: minTemperatureCoolDry,
      },
      [OperationMode.fan]: {
        max: maxTemperatureHeatFan,
        min: minTemperatureHeatFan,
      },
      [OperationMode.heat]: {
        max: maxTemperatureHeatFan,
        min: minTemperatureHeatFan,
      },
    }[operationMode]
  }
}
