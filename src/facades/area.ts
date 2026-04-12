import type { Area, DeviceAny } from '../models/index.ts'
import type { AreaID } from '../types/index.ts'
import { BaseZoneFacade } from './base-zone.ts'

/** Facade for an area, grouping devices within a floor or building. */
export class AreaFacade extends BaseZoneFacade<Area> {
  public override get devices(): DeviceAny[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return this.registry.getDevicesByAreaId(this.id as AreaID)
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
