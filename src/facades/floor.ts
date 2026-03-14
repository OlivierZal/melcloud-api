import type { IDeviceModelAny, IFloorModel } from '../models/index.ts'

import type { ISuperDeviceFacade } from './interfaces.ts'

import { BaseSuperDeviceFacade } from './base-super-device.ts'

/** Facade for a floor, grouping devices on that floor within a building. */
export class FloorFacade
  extends BaseSuperDeviceFacade<IFloorModel>
  implements ISuperDeviceFacade
{
  protected readonly frostProtectionLocation = 'FloorIds'

  protected readonly holidayModeLocation = 'Floors'

  protected readonly specification = 'FloorID'

  protected readonly tableName = 'Floor'

  public override get devices(): IDeviceModelAny[] {
    return this.registry.getDevicesByFloorId(this.id)
  }

  protected get model(): { getById: (id: number) => IFloorModel | undefined } {
    return this.registry.floors
  }
}
