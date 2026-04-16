import type { Area, DeviceAny } from '../entities/index.ts'
import type { AreaID } from '../types/index.ts'
import { BaseZoneFacade } from './classic-base-zone.ts'

/** Facade for an area, grouping devices within a floor or building. */
export class AreaFacade extends BaseZoneFacade<Area> {
  declare public readonly id: AreaID

  public override get devices(): DeviceAny[] {
    return this.registry.getDevicesByAreaId(this.id)
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
