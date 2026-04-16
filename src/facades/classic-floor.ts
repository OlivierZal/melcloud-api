import type { ClassicDeviceAny, Floor } from '../entities/index.ts'
import type { FloorID } from '../types/index.ts'
import { BaseZoneFacade } from './classic-base-zone.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class FloorFacade extends BaseZoneFacade<Floor> {
  declare public readonly id: FloorID

  public override get devices(): ClassicDeviceAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly groupSpecificationKey = 'FloorID'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly tableName = 'Floor'

  protected get model(): {
    getById: (id: number) => Floor | undefined
  } {
    return this.registry.floors
  }
}
