import type { ModelRegistry } from '../models/index.ts'
import type {
  DeviceModelAny,
  FloorModel as FloorModelContract,
} from '../models/interfaces.ts'
import type { APIAdapter } from '../services/index.ts'

import { BaseZoneFacade } from './base-zone.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class FloorFacade extends BaseZoneFacade<FloorModelContract> {
  public constructor(
    api: APIAdapter,
    registry: ModelRegistry,
    instance: FloorModelContract,
  ) {
    super(api, registry, instance, {
      frostProtectionLocation: 'FloorIds',
      groupSpecificationKey: 'FloorID',
      holidayModeLocation: 'Floors',
      tableName: 'Floor',
    })
  }

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected get model(): {
    getById: (id: number) => FloorModelContract | undefined
  } {
    return this.registry.floors
  }
}
