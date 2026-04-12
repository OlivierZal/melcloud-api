import type { DeviceAny, Floor } from '../models/index.ts'
import { toFloorId } from '../types/index.ts'
import { BaseZoneFacade } from './base-zone.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class FloorFacade extends BaseZoneFacade<Floor> {
  public override get devices(): DeviceAny[] {
    return this.registry.getDevicesByFloorId(toFloorId(this.id))
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
