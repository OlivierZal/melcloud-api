import { OperationMode, type DeviceType } from '../enums.js'

import { BaseDeviceFacade } from './base-device.js'

import type { UpdateDeviceDataAta } from '../types/ata.js'

import type { IDeviceFacadeAta } from './interfaces.js'

export class DeviceAtaFacade
  extends BaseDeviceFacade<DeviceType.Ata>
  implements IDeviceFacadeAta
{
  public readonly flags = {
    OperationMode: 0x2,
    Power: 0x1,
    SetFanSpeed: 0x8,
    SetTemperature: 0x4,
    VaneHorizontal: 0x100,
    VaneVertical: 0x10,
  } as const

  protected override handle(
    data: Partial<UpdateDeviceDataAta>,
  ): Required<UpdateDeviceDataAta> {
    return super.handle({ ...data, ...this.#handleTargetTemperature(data) })
  }

  #getTargetTemperatureRange(operationMode = this.setData.OperationMode): {
    max: number
    min: number
  } {
    switch (operationMode) {
      case OperationMode.auto:
        return {
          max: this.data.MaxTempAutomatic,
          min: this.data.MinTempAutomatic,
        }
      case OperationMode.cool:
      case OperationMode.dry:
        return { max: this.data.MaxTempCoolDry, min: this.data.MinTempCoolDry }
      case OperationMode.fan:
      case OperationMode.heat:
      default:
        return { max: this.data.MaxTempHeat, min: this.data.MinTempHeat }
    }
  }

  #handleTargetTemperature(data: Partial<UpdateDeviceDataAta>): {
    SetTemperature?: number
  } {
    const { OperationMode: operationMode, SetTemperature: value } = data
    if (value !== undefined) {
      const { max, min } = this.#getTargetTemperatureRange(operationMode)
      return { SetTemperature: Math.min(Math.max(value, min), max) }
    }
    return {}
  }
}
