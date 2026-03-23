import type { DeviceModelAny, FloorModel } from '../models/index.ts'

import { BaseZoneFacade } from './base-zone.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class FloorFacade extends BaseZoneFacade<FloorModel> {
  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly groupSpecificationKey = 'FloorID'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly tableName = 'Floor'

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected get model(): {
    getById: (id: number) => FloorModel | undefined
  } {
    return this.registry.floors
  }
}
