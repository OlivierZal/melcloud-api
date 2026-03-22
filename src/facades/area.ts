import type { ModelRegistry } from '../models/index.ts'
import type {
  AreaModel as AreaModelContract,
  DeviceModelAny,
} from '../models/interfaces.ts'
import type { APIAdapter } from '../services/index.ts'

import { BaseZoneFacade } from './base-zone.ts'

/** Facade for an area, grouping devices within a floor or building. */
export class AreaFacade extends BaseZoneFacade<AreaModelContract> {
  public constructor(
    api: APIAdapter,
    registry: ModelRegistry,
    instance: AreaModelContract,
  ) {
    super(api, registry, instance, {
      frostProtectionLocation: 'AreaIds',
      groupSpecificationKey: 'AreaID',
      holidayModeLocation: 'Areas',
      tableName: 'Area',
    })
  }

  public override get devices(): DeviceModelAny[] {
    return this.registry.getDevicesByAreaId(this.id)
  }

  protected get model(): {
    getById: (id: number) => AreaModelContract | undefined
  } {
    return this.registry.areas
  }
}
