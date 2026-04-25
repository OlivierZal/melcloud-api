import type { ClassicUpdateDeviceDataAta } from '../types/index.ts'
import { ClassicDeviceType, ClassicOperationMode } from '../constants.ts'
import { BaseDeviceFacade, clampToRange } from './classic-base-device.ts'
import { classicAtaFlags } from './classic-flags.ts'

/** Facade for Air-to-Air (ATA) devices with per-operation-mode temperature clamping. */
export class ClassicDeviceAtaFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Ata
> {
  public readonly flags: typeof classicAtaFlags = classicAtaFlags

  public readonly type: typeof ClassicDeviceType.Ata = ClassicDeviceType.Ata

  protected readonly temperaturesLegend: readonly string[] = [
    'SetTemperature',
    'RoomTemperature',
    'OutdoorTemperature',
  ]

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
