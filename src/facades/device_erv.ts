import { BaseDeviceFacade } from './base_device.js'

import type { IDeviceFacade } from './interfaces.js'

export class DeviceErvFacade
  extends BaseDeviceFacade<'Erv'>
  implements IDeviceFacade<'Erv'>
{
  public readonly flags = {
    Power: 0x1,
    SetFanSpeed: 0x8,
    VentilationMode: 0x4,
  } as const
}
