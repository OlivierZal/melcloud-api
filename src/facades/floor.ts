import type {
  DeviceModelAny,
  FloorModel as FloorModelContract,
} from '../models/interfaces.ts'

import { BaseZoneFacade } from './base-super-device.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class FloorFacade extends BaseZoneFacade<FloorModelContract> {
  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly groupSpecificationKey = 'FloorID'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly tableName = 'Floor'

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected get model(): {
    getById: (id: number) => FloorModelContract | undefined
  } {
    return this.registry.floors
  }
}
