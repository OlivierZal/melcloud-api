import type {
  ClassicUpdateDeviceData,
  ClassicUpdateDeviceDataAta,
} from '../types/index.ts'
import { ClassicDeviceType, ClassicOperationMode } from '../constants.ts'
import { BaseDeviceFacade, clampToRange } from './classic-base-device.ts'

/** Facade for Air-to-Air (ATA) devices with per-operation-mode temperature clamping. */
export class ClassicDeviceAtaFacade extends BaseDeviceFacade<
  typeof ClassicDeviceType.Ata
> {
  /*
   * MELCloud EffectiveFlags bitfield — each bit tells the Classic API which
   * fields in the update payload should actually be applied.
   */
  public readonly flags = {
    OperationMode: 0x2,
    Power: 0x1,
    SetFanSpeed: 0x8,
    SetTemperature: 0x4,
    VaneHorizontal: 0x1_00,
    VaneVertical: 0x10,
  } as const satisfies Record<
    keyof ClassicUpdateDeviceData<typeof ClassicDeviceType.Ata>,
    number
  >

  public readonly type = ClassicDeviceType.Ata

  protected readonly temperaturesLegend = [
    'SetTemperature',
    'RoomTemperature',
    'OutdoorTemperature',
  ]

  /*
   * Clamp SetTemperature to the valid range for the current or requested
   * operation mode before sending to the Classic API
   */
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
