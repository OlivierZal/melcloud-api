import type { ClassicArea, ClassicDeviceAny } from '../entities/index.ts'
import type { ClassicAreaID } from '../types/index.ts'
import { BaseZoneFacade } from './classic-base-zone.ts'

/** Facade for an area, grouping devices within a floor or building. */
export class ClassicAreaFacade extends BaseZoneFacade<ClassicArea> {
  declare public readonly id: ClassicAreaID

  public override get devices(): ClassicDeviceAny[] {
    return this.registry.getDevicesByAreaId(this.id)
  }

  protected readonly frostProtectionLocation = 'AreaIds'

  protected readonly groupSpecificationKey = 'AreaID'

  protected readonly holidayModeLocation = 'Areas'

  protected readonly tableName = 'ClassicArea'

  protected get model(): {
    getById: (id: number) => ClassicArea | undefined
  } {
    return this.registry.areas
  }
}
