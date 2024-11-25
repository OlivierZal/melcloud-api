import { BaseDeviceFacade } from './base-device.js'

import type { DeviceType } from '../enums.js'

import type { IDeviceFacadeErv } from './interfaces.js'

export class DeviceErvFacade
  extends BaseDeviceFacade<DeviceType.Erv>
  implements IDeviceFacadeErv
{
  public readonly flags = {
    Power: 0x1,
    SetFanSpeed: 0x8,
    VentilationMode: 0x4,
  } as const
}
