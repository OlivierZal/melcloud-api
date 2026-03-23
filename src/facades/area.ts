import type { AreaModel, DeviceModelAny } from '../models/index.ts'

import { BaseZoneFacade } from './base-zone.ts'

/** Facade for an area, grouping devices within a floor or building. */
export class AreaFacade extends BaseZoneFacade<AreaModel> {
  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly groupSpecificationKey = 'AreaID'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly tableName = 'Area'

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByAreaId(this.id)
  }

  protected get model(): {
    getById: (id: number) => AreaModel | undefined
  } {
    return this.registry.areas
  }
}
