import type { ClassicDeviceAny, ClassicFloor } from '../entities/index.ts'
import type { ClassicFloorID } from '../types/index.ts'
import { BaseZoneFacade } from './classic-base-zone.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class ClassicFloorFacade extends BaseZoneFacade<ClassicFloor> {
  declare public readonly id: ClassicFloorID

  public override get devices(): ClassicDeviceAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly groupSpecificationKey = 'FloorID'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly tableName = 'ClassicFloor'

  protected get model(): {
    getById: (id: number) => ClassicFloor | undefined
  } {
    return this.registry.floors
  }
}
