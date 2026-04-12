import type { Area, DeviceAny } from '../models/index.ts'
import { areaId } from '../types/index.ts'
import { BaseZoneFacade } from './base-zone.ts'

/** Facade for an area, grouping devices within a floor or building. */
export class AreaFacade extends BaseZoneFacade<Area> {
  public override get devices(): DeviceAny[] {
    return this.registry.getDevicesByAreaId(areaId(this.id))
  }

  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly groupSpecificationKey = 'AreaID'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly tableName = 'Area'

  protected get model(): {
    getById: (id: number) => Area | undefined
  } {
    return this.registry.areas
  }
}
