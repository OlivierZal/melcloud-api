import type { IAreaModel, IDeviceModelAny } from '../models/index.ts'

import type { ISuperDeviceFacade } from './interfaces.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

export class AreaFacade
  extends BaseSuperDeviceFacade<IAreaModel>
  implements ISuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly specification = 'AreaID'

  protected readonly tableName = 'Area'

  public override get devices(): IDeviceModelAny[] {
    return this.registry.getDevicesByAreaId(this.id)
  }

  protected get model(): { getById: (id: number) => IAreaModel | undefined } {
    return this.registry.areas
  }
}
