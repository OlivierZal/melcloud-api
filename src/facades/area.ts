import type {
  AreaModel as AreaModelContract,
  DeviceModelAny,
} from '../models/interfaces.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

/** Facade for an area, grouping devices within a floor or building. */
export class AreaFacade
  extends BaseSuperDeviceFacade<AreaModelContract>
{
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly specification = 'AreaID'

  protected readonly tableName = 'Area'

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByAreaId(this.id)
  }

  protected get model(): { getById: (id: number) => AreaModelContract | undefined } {
    return this.registry.areas
  }
}
